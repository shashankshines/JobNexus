/**
 * JobNexus 30-Day Subscription Expiration & Renewal Notification Orchestrator
 *
 * Coordinates:
 * 1. Read-only renewal window enrichment (`enrichRenewalSnapshotWithOutboxStatus`)
 *    for `GET /api/billing/status` (preserving strict zero-mutation GET invariants).
 * 2. Single-subscriber event-driven notification dispatch (`dispatchUserRenewalNotificationIfDue`)
 *    for `POST /api/billing/renewal-notify`.
 * 3. Scheduled batch cron sweep (`sweepAllSubscriptionRenewalNotifications`)
 *    for `GET /api/cron/billing/renewals` so offline subscribers receive timely
 *    5-day, 24-hour, and post-expiry renewal emails.
 */

import { getFirestoreDb } from '@/modules/storage/firestore/client';
import {
  getSubscriptionsCollection,
  getSubmissionsCollection,
  getOrdersCollection,
  SubscriptionDocument,
  PaymentSubmissionDocument,
} from '@/modules/storage/firestore/collections';
import { getFirestoreSubscriptionByUserId } from '@/modules/storage/firestore/subscription.store';
import { getSubmissionsByUserId } from '@/modules/storage/firestore/order.store';
import { getOutboxRecordByIdempotencyKey } from '@/modules/storage/firestore/outbox.store';
import { getUserById } from '@/modules/auth/server/session.store';
import {
  evaluateRenewalWindow,
  RenewalWindowSnapshot,
  RenewalEmailMilestone,
} from '../domain/renewal-window';
import type { SubscriptionRecord } from '../domain/subscription.types';
import {
  getEmailProvider,
  sendSubscriptionExpiringReminder,
  sendSubscriptionExpiredNotification,
} from '@/modules/email/email.service';
import { invalidateUserEntitlementCache } from './entitlement.service';
import { createAdminNotificationWithRecovery } from '@/modules/notifications/admin-notifications.service';

/**
 * Read-only check whether a given renewal email idempotency key has already been
 * delivered or exhausted automatic retry attempts.
 */
export async function isRenewalMilestoneOutboxSettled(
  idempotencyKey: string | null | undefined
): Promise<boolean> {
  if (!idempotencyKey) return false;
  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (!existing) return false;

  const activeProviderName = getEmailProvider().providerName;
  if (existing.status === 'sent') {
    if (
      activeProviderName !== 'simulation' &&
      existing.providerMessageId?.startsWith('sim_msg_')
    ) {
      return false;
    }
    return true;
  }

  if (existing.status === 'failed') {
    return true;
  }

  if (
    existing.status === 'retryable_failure' &&
    (existing.attempts || 0) >= (existing.maxAttempts || 3)
  ) {
    return true;
  }

  return false;
}

/**
 * Read-only enrichment of a `RenewalWindowSnapshot` with outbox delivery state.
 * Performs ZERO Firestore writes.
 */
export async function enrichRenewalSnapshotWithOutboxStatus(
  renewal: RenewalWindowSnapshot
): Promise<RenewalWindowSnapshot> {
  if (!renewal.emailIdempotencyKey) {
    return {
      ...renewal,
      emailAlreadyDispatched: false,
    };
  }

  const settled = await isRenewalMilestoneOutboxSettled(renewal.emailIdempotencyKey);
  return {
    ...renewal,
    emailAlreadyDispatched: settled,
  };
}

/**
 * Resolves a subscriber's email across Firestore subscription records, session fallback,
 * in-memory user registry, and historical Firestore submissions/orders (cold-instance safe).
 */
async function resolveSubscriberEmailForRenewal(
  subscription: SubscriptionRecord,
  fallbackEmail?: string
): Promise<string | null> {
  const candidates: Array<unknown> = [
    subscription.userEmail,
    fallbackEmail,
    subscription.metadata?.userEmail,
    subscription.metadata?.targetEmail,
    getUserById(subscription.userId)?.email,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().includes('@')) {
      return candidate.trim().toLowerCase();
    }
  }

  // Cold serverless fallback: inspect user's historical submissions or orders in Firestore
  try {
    const subSnap = await getSubmissionsCollection()
      .where('userId', '==', subscription.userId)
      .limit(5)
      .get();
    for (const doc of subSnap.docs) {
      const email = doc.data()?.userEmail;
      if (typeof email === 'string' && email.trim().includes('@')) {
        return email.trim().toLowerCase();
      }
    }

    const orderSnap = await getOrdersCollection()
      .where('userId', '==', subscription.userId)
      .limit(5)
      .get();
    for (const doc of orderSnap.docs) {
      const email = doc.data()?.userEmail;
      if (typeof email === 'string' && email.trim().includes('@')) {
        return email.trim().toLowerCase();
      }
    }
  } catch {
    // Non-fatal fallback lookup
  }

  return null;
}

/**
 * Race-safe transactional transition of a lapsed `active` subscription to `expired`.
 * Re-reads the subscription inside a Firestore transaction to ensure a concurrent
 * admin renewal approval is never overwritten.
 */
async function markLapsedSubscriptionExpiredIfStillLapsed(
  userId: string,
  nowMs: number
): Promise<boolean> {
  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const subRef = subscriptionsCol.doc(userId);
  const nowIso = new Date(nowMs).toISOString();

  try {
    const transitioned = await db.runTransaction(async (tx) => {
      const snap = await tx.get(subRef);
      if (!snap.exists) return false;
      const current = snap.data() as SubscriptionDocument;
      if (current.status !== 'active') return false;
      if (!current.currentPeriodEnd) return false;

      const endMs = new Date(current.currentPeriodEnd).getTime();
      if (Number.isNaN(endMs) || endMs > nowMs) {
        return false;
      }

      tx.set(
        subRef,
        {
          status: 'expired',
          updatedAt: nowIso,
          lastUpdatedFrom: 'system_expiry',
        },
        { merge: true }
      );
      return true;
    });

    if (transitioned) {
      invalidateUserEntitlementCache(userId);
    }
    return transitioned;
  } catch (err) {
    console.warn(`[RenewalSweep] Non-fatal error transitioning lapsed subscription for ${userId}:`, err);
    return false;
  }
}

export interface UserRenewalDispatchResult {
  triggered: boolean;
  idempotent: boolean;
  stage: RenewalWindowSnapshot['stage'];
  milestone: RenewalEmailMilestone | null;
  deliveryStatus?: string;
  outboxId?: string;
  expiredStatusTransitioned?: boolean;
  error?: string;
}

/**
 * Evaluates a single subscriber's 30-day renewal window and dispatches any due
 * pre-expiry (5d / 24h) or post-expiry email idempotently.
 */
export async function dispatchUserRenewalNotificationIfDue(params: {
  userId: string;
  fallbackEmail?: string;
  nowMs?: number;
  preloadedSubscription?: SubscriptionRecord | null;
  preloadedSubmissions?: PaymentSubmissionDocument[];
}): Promise<UserRenewalDispatchResult> {
  const { userId, fallbackEmail } = params;
  const nowMs = typeof params.nowMs === 'number' ? params.nowMs : Date.now();

  const [subscription, submissions] = await Promise.all([
    params.preloadedSubscription !== undefined
      ? Promise.resolve(params.preloadedSubscription)
      : getFirestoreSubscriptionByUserId(userId),
    params.preloadedSubmissions !== undefined
      ? Promise.resolve(params.preloadedSubmissions)
      : getSubmissionsByUserId(userId),
  ]);

  const hasPendingVerification = submissions.some(
    (s) => s.status === 'pending_verification'
  );

  const renewal = evaluateRenewalWindow({
    subscription,
    hasPendingVerification,
    nowMs,
  });

  let expiredStatusTransitioned = false;
  if (subscription && subscription.status === 'active' && renewal.stage === 'expired') {
    expiredStatusTransitioned = await markLapsedSubscriptionExpiredIfStillLapsed(
      userId,
      nowMs
    );
  }

  if (!subscription || !renewal.emailMilestone || !renewal.currentPeriodEnd) {
    return {
      triggered: false,
      idempotent: false,
      stage: renewal.stage,
      milestone: null,
      expiredStatusTransitioned,
    };
  }

  const recipientEmail = await resolveSubscriberEmailForRenewal(
    subscription,
    fallbackEmail
  );

  if (
    renewal.emailMilestone === 'expiring_5d' ||
    renewal.emailMilestone === 'expiring_24h'
  ) {
    const res = await sendSubscriptionExpiringReminder({
      userId,
      subscriptionId: subscription.id,
      userEmail: recipientEmail || undefined,
      currentPeriodEnd: renewal.currentPeriodEnd,
      daysRemaining: renewal.daysRemaining,
      hoursRemaining: renewal.hoursRemaining,
      isUrgent24h: renewal.emailMilestone === 'expiring_24h',
    });

    return {
      triggered: res.status === 'sent' && !res.idempotent,
      idempotent: Boolean(res.idempotent),
      stage: renewal.stage,
      milestone: renewal.emailMilestone,
      deliveryStatus: res.status,
      outboxId: res.outboxId,
      expiredStatusTransitioned,
      error: res.error,
    };
  }

  const res = await sendSubscriptionExpiredNotification({
    userId,
    subscriptionId: subscription.id,
    userEmail: recipientEmail || undefined,
    expiredAt: renewal.currentPeriodEnd,
  });

  return {
    triggered: res.status === 'sent' && !res.idempotent,
    idempotent: Boolean(res.idempotent),
    stage: renewal.stage,
    milestone: 'expired',
    deliveryStatus: res.status,
    outboxId: res.outboxId,
    expiredStatusTransitioned,
    error: res.error,
  };
}

export interface RenewalSweepSummary {
  evaluatedCount: number;
  expiring5dSent: number;
  expiring24hSent: number;
  expiredSent: number;
  idempotentSkipped: number;
  suppressedPendingVerification: number;
  excludedAdminRestricted: number;
  transitionedToExpiredCount: number;
  failedCount: number;
  timestamp: string;
}

/**
 * Batch sweep across all Firestore subscriptions to dispatch due 5-day, 24-hour,
 * and post-expiry notifications even when subscribers have not opened the app.
 */
export async function sweepAllSubscriptionRenewalNotifications(
  nowMs?: number
): Promise<RenewalSweepSummary> {
  const effectiveNowMs = typeof nowMs === 'number' ? nowMs : Date.now();

  const [subsSnap, pendingSubsSnap] = await Promise.all([
    getSubscriptionsCollection().get(),
    getSubmissionsCollection()
      .where('status', '==', 'pending_verification')
      .get(),
  ]);

  const pendingSubmissionsByUser = new Map<string, PaymentSubmissionDocument[]>();
  for (const doc of pendingSubsSnap.docs) {
    const data = doc.data();
    if (!data?.userId) continue;
    const list = pendingSubmissionsByUser.get(data.userId) || [];
    list.push(data);
    pendingSubmissionsByUser.set(data.userId, list);
  }

  const summary: RenewalSweepSummary = {
    evaluatedCount: subsSnap.docs.length,
    expiring5dSent: 0,
    expiring24hSent: 0,
    expiredSent: 0,
    idempotentSkipped: 0,
    suppressedPendingVerification: 0,
    excludedAdminRestricted: 0,
    transitionedToExpiredCount: 0,
    failedCount: 0,
    timestamp: new Date(effectiveNowMs).toISOString(),
  };

  for (const doc of subsSnap.docs) {
    const sub = doc.data();
    if (!sub?.userId) continue;

    const pendingForUser = pendingSubmissionsByUser.get(sub.userId) || [];
    const preview = evaluateRenewalWindow({
      subscription: sub,
      hasPendingVerification: pendingForUser.length > 0,
      nowMs: effectiveNowMs,
    });

    if (preview.isAdminRestricted) {
      summary.excludedAdminRestricted++;
      continue;
    }

    if (
      preview.hasPendingRenewalVerification &&
      (preview.stage === 'expiring_soon' ||
        preview.stage === 'expiring_urgent' ||
        preview.stage === 'expired')
    ) {
      summary.suppressedPendingVerification++;
    }

    const result = await dispatchUserRenewalNotificationIfDue({
      userId: sub.userId,
      nowMs: effectiveNowMs,
      preloadedSubscription: sub,
      preloadedSubmissions: pendingForUser,
    });

    if (result.expiredStatusTransitioned) {
      summary.transitionedToExpiredCount++;
    }

    if (!result.milestone) {
      continue;
    }

    if (result.idempotent) {
      summary.idempotentSkipped++;
    } else if (result.triggered) {
      if (result.milestone === 'expiring_5d') summary.expiring5dSent++;
      else if (result.milestone === 'expiring_24h') summary.expiring24hSent++;
      else if (result.milestone === 'expired') summary.expiredSent++;

      if (result.milestone === 'expiring_5d' || result.milestone === 'expiring_24h') {
        await createAdminNotificationWithRecovery({
          eventKey: `sub_expiring_${sub.userId}_${result.milestone}`,
          type: 'subscription_expiring',
          priority: result.milestone === 'expiring_24h' ? 'high' : 'normal',
          status: 'unread',
          title: 'Subscription expiring soon',
          message: `Subscriber ${sub.userEmail || sub.userId} has ${result.milestone === 'expiring_24h' ? 'less than 24 hours' : '5 days'} remaining on their Premium membership.`,
          actionLabel: 'View Subscriber',
          actionUrl: `/admin?tab=users&userId=${encodeURIComponent(sub.userId)}`,
          userId: sub.userId,
          userEmail: sub.userEmail,
          metadata: { milestone: result.milestone, currentPeriodEnd: sub.currentPeriodEnd },
        });
      }
    } else if (
      result.deliveryStatus === 'failed' ||
      result.deliveryStatus === 'retryable_failure' ||
      result.deliveryStatus === 'skipped_missing_email'
    ) {
      summary.failedCount++;
    }
  }

  return summary;
}

