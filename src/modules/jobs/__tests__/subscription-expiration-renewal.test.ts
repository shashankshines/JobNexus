import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import {
  InMemoryFirestoreStore,
  createMockFirestoreDb,
} from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  FIRESTORE_COLLECTIONS,
  getSubscriptionsCollection,
} from '@/modules/storage/firestore/collections';
import { saveFirestoreSubscription } from '@/modules/storage/firestore/subscription.store';
import {
  createPaymentOrder,
  createPaymentSubmission,
} from '@/modules/storage/firestore/order.store';
import {
  approvePaymentSubmissionInTransaction,
  rejectPaymentSubmissionInTransaction,
  invalidateAdminStoresCache,
} from '@/modules/storage/firestore/admin-billing.store';
import {
  evaluateSubscriptionEntitlement,
  invalidateUserEntitlementCache,
} from '@/modules/billing/services/entitlement.service';
import {
  evaluateRenewalWindow,
  DAY_MS,
  HOUR_MS,
} from '@/modules/billing/domain/renewal-window';
import { resolveBillingFlowSnapshot } from '@/modules/billing/domain/billing-flow-state';
import {
  sweepAllSubscriptionRenewalNotifications,
  dispatchUserRenewalNotificationIfDue,
} from '@/modules/billing/services/renewal-notifications.service';
import {
  getSimulationProvider,
  resetEmailServiceForTesting,
  retryNotificationById,
  sendSubscriptionExpiredNotification,
  sendSubscriptionExpiringReminder,
  setTestEmailProvider,
} from '@/modules/email/email.service';
import {
  createSession,
  findOrCreateGoogleUser,
  resetAuthStore,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/server/session.store';
import { GET as billingStatusGet } from '@/app/api/billing/status/route';
import { POST as billingOrderPost } from '@/app/api/billing/order/route';
import { POST as billingCheckoutPost } from '@/app/api/billing/checkout/route';
import { POST as billingRenewalNotifyPost } from '@/app/api/billing/renewal-notify/route';
import { GET as cronRenewalsGet } from '@/app/api/cron/billing/renewals/route';
import type { SubscriptionRecord } from '@/modules/billing/domain/subscription.types';

function makeSubscription(
  overrides: Partial<SubscriptionRecord> & { userId: string }
): SubscriptionRecord {
  const now = Date.now();
  return {
    id: `sub_${overrides.userId}`,
    planId: 'premium_monthly',
    status: 'active',
    provider: 'manual_upi',
    currentPeriodStart: new Date(now - 25 * DAY_MS).toISOString(),
    currentPeriodEnd: new Date(now + 5 * DAY_MS).toISOString(),
    cancelAtPeriodEnd: false,
    createdAt: new Date(now - 25 * DAY_MS).toISOString(),
    updatedAt: new Date(now - 25 * DAY_MS).toISOString(),
    ...overrides,
  };
}

describe('30-Day Subscription Expiration Window & Renewal Notifications (End-to-End)', () => {
  let firestoreStore: InMemoryFirestoreStore;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'shashankshines@gmail.com';
    process.env.CRON_SECRET = 'test_cron_secret_30d_renewal_9911';
    firestoreStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(firestoreStore));
    invalidateAdminStoresCache();
    invalidateUserEntitlementCache();
    resetAuthStore();
    resetEmailServiceForTesting();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
    if (originalAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    }
  });

  // ==========================================================================
  // 1. Pure 30-Day Renewal Window Evaluator & Edge Cases
  // ==========================================================================
  describe('1. Renewal Window Evaluator (evaluateRenewalWindow)', () => {
    const fixedNow = new Date('2026-11-02T12:00:00.000Z').getTime();

    it('classifies > 5 days remaining as active_healthy with no banner, no early checkout, and no email', () => {
      const sub = makeSubscription({
        userId: 'usr_healthy',
        currentPeriodEnd: new Date(fixedNow + 18 * DAY_MS).toISOString(),
      });
      const snap = evaluateRenewalWindow({ subscription: sub, nowMs: fixedNow });

      assert.strictEqual(snap.stage, 'active_healthy');
      assert.strictEqual(snap.isWithinRenewalWindow, false);
      assert.strictEqual(snap.canRenewNow, false);
      assert.strictEqual(snap.shouldShowInAppBanner, false);
      assert.strictEqual(snap.emailMilestone, null);
      assert.strictEqual(snap.daysRemaining, 18);
    });

    it('opens 5-day renewal window (24h < remaining <= 5d) with expiring_5d email and in-app banner', () => {
      const sub = makeSubscription({
        userId: 'usr_5d',
        currentPeriodEnd: new Date(fixedNow + 4 * DAY_MS).toISOString(),
      });
      const snap = evaluateRenewalWindow({ subscription: sub, nowMs: fixedNow });

      assert.strictEqual(snap.stage, 'expiring_soon');
      assert.strictEqual(snap.isWithinRenewalWindow, true);
      assert.strictEqual(snap.canRenewNow, true);
      assert.strictEqual(snap.shouldShowInAppBanner, true);
      assert.strictEqual(snap.emailMilestone, 'expiring_5d');
      assert.strictEqual(snap.daysRemaining, 4);
    });

    it('escalates to final 24h urgent window (0 < remaining <= 24h) with expiring_24h email — including short <=24h grants', () => {
      const sub = makeSubscription({
        userId: 'usr_24h',
        currentPeriodStart: new Date(fixedNow - 2 * HOUR_MS).toISOString(),
        currentPeriodEnd: new Date(fixedNow + 10 * HOUR_MS).toISOString(),
      });
      const snap = evaluateRenewalWindow({ subscription: sub, nowMs: fixedNow });

      assert.strictEqual(snap.stage, 'expiring_urgent');
      assert.strictEqual(snap.isWithinRenewalWindow, true);
      assert.strictEqual(snap.canRenewNow, true);
      assert.strictEqual(snap.shouldShowInAppBanner, true);
      assert.strictEqual(snap.emailMilestone, 'expiring_24h');
      assert.strictEqual(snap.hoursRemaining, 10);
    });

    it('emits expired email within 30 days post-expiry, and suppresses unsolicited emails for >30d dormant expirations while keeping in-app renewal banner', () => {
      const recentlyExpired = makeSubscription({
        userId: 'usr_recent_exp',
        currentPeriodEnd: new Date(fixedNow - 2 * DAY_MS).toISOString(),
      });
      const recentSnap = evaluateRenewalWindow({
        subscription: recentlyExpired,
        nowMs: fixedNow,
      });
      assert.strictEqual(recentSnap.stage, 'expired');
      assert.strictEqual(recentSnap.canRenewNow, true);
      assert.strictEqual(recentSnap.shouldShowInAppBanner, true);
      assert.strictEqual(recentSnap.emailMilestone, 'expired');

      const dormantExpired = makeSubscription({
        userId: 'usr_dormant_exp',
        currentPeriodEnd: new Date(fixedNow - 45 * DAY_MS).toISOString(),
      });
      const dormantSnap = evaluateRenewalWindow({
        subscription: dormantExpired,
        nowMs: fixedNow,
      });
      assert.strictEqual(dormantSnap.stage, 'expired');
      assert.strictEqual(dormantSnap.canRenewNow, true);
      assert.strictEqual(dormantSnap.shouldShowInAppBanner, true);
      assert.strictEqual(dormantSnap.emailMilestone, null);
    });

    it('suppresses renewal emails and duplicate Renew CTA when subscriber already has a pending_verification UTR', () => {
      for (const offset of [3 * DAY_MS, 6 * HOUR_MS, -3 * HOUR_MS]) {
        const sub = makeSubscription({
          userId: 'usr_pending_utr',
          currentPeriodEnd: new Date(fixedNow + offset).toISOString(),
        });
        const snap = evaluateRenewalWindow({
          subscription: sub,
          hasPendingVerification: true,
          nowMs: fixedNow,
        });
        assert.strictEqual(snap.canRenewNow, false);
        assert.strictEqual(snap.emailMilestone, null);
        assert.strictEqual(snap.shouldShowInAppBanner, true);
        assert.strictEqual(snap.hasPendingRenewalVerification, true);
      }
    });

    it('respects user cancelAtPeriodEnd opt-out for pre-expiry emails while keeping in-app countdown and reactivation enabled', () => {
      const sub = makeSubscription({
        userId: 'usr_cancel_grace',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(fixedNow + 3 * DAY_MS).toISOString(),
      });
      const snap = evaluateRenewalWindow({ subscription: sub, nowMs: fixedNow });

      assert.strictEqual(snap.stage, 'expiring_soon');
      assert.strictEqual(snap.emailMilestone, null);
      assert.strictEqual(snap.canRenewNow, true);
      assert.strictEqual(snap.shouldShowInAppBanner, true);
    });

    it('excludes halted, terminated, and permanently revoked subscriptions from renewal emails, banners, and self-serve checkout', () => {
      const restrictedCases: SubscriptionRecord[] = [
        makeSubscription({ userId: 'usr_halted', status: 'halted' }),
        makeSubscription({ userId: 'usr_terminated', status: 'terminated' }),
        makeSubscription({
          userId: 'usr_revoked',
          status: 'cancelled',
          metadata: { revoked: true },
        }),
      ];

      for (const sub of restrictedCases) {
        const snap = evaluateRenewalWindow({ subscription: sub, nowMs: fixedNow });
        assert.strictEqual(snap.isAdminRestricted, true);
        assert.strictEqual(snap.canRenewNow, false);
        assert.strictEqual(snap.shouldShowInAppBanner, false);
        assert.strictEqual(snap.emailMilestone, null);
      }
    });

    it('evaluates explicit status === "expired" as expired in evaluateSubscriptionEntitlement', () => {
      const explicitExpired = makeSubscription({
        userId: 'usr_explicit_exp',
        status: 'expired',
        currentPeriodEnd: new Date(fixedNow - DAY_MS).toISOString(),
      });
      const ent = evaluateSubscriptionEntitlement('usr_explicit_exp', explicitExpired);
      assert.strictEqual(ent.isPremium, false);
      assert.strictEqual(ent.status, 'expired');
    });
  });

  // ==========================================================================
  // 2. Transactional Renewal Emails, Multi-Cycle Idempotency & Retry Caps
  // ==========================================================================
  describe('2. Email Templates, Multi-Cycle Idempotency, Retry Cap & Admin Manual Retry', () => {
    it('dispatches 5d, 24h, and expired emails idempotently per billing cycle and resets cleanly on +30d renewal', async () => {
      const sim = getSimulationProvider();
      const cycle1End = '2026-11-06T12:00:00.000Z';

      // 5d reminder — first call sends, second call is strictly idempotent
      const r5a = await sendSubscriptionExpiringReminder({
        userId: 'usr_cycle_1',
        subscriptionId: 'sub_cycle_1',
        userEmail: 'subscriber@example.com',
        currentPeriodEnd: cycle1End,
        daysRemaining: 4,
        hoursRemaining: 96,
        isUrgent24h: false,
      });
      assert.strictEqual(r5a.success, true);
      assert.strictEqual(r5a.status, 'sent');
      assert.ok(!r5a.idempotent);

      const r5b = await sendSubscriptionExpiringReminder({
        userId: 'usr_cycle_1',
        subscriptionId: 'sub_cycle_1',
        userEmail: 'subscriber@example.com',
        currentPeriodEnd: cycle1End,
        daysRemaining: 3,
        hoursRemaining: 72,
        isUrgent24h: false,
      });
      assert.strictEqual(r5b.idempotent, true);
      assert.strictEqual(sim.getSentEmails().length, 1);
      assert.ok(sim.getSentEmails()[0].html.includes('?renew=1'));
      assert.ok(sim.getSentEmails()[0].html.includes('Zero Lost Hours'));

      // 24h urgent reminder on same cycle — distinct milestone key, sends once
      const r24 = await sendSubscriptionExpiringReminder({
        userId: 'usr_cycle_1',
        subscriptionId: 'sub_cycle_1',
        userEmail: 'subscriber@example.com',
        currentPeriodEnd: cycle1End,
        daysRemaining: 1,
        hoursRemaining: 12,
        isUrgent24h: true,
      });
      assert.strictEqual(r24.success, true);
      assert.ok(!r24.idempotent);
      assert.strictEqual(sim.getSentEmails().length, 2);
      assert.ok(sim.getSentEmails()[1].subject.includes('<24 Hours'));

      // Next 30-day cycle (+30d) — fresh periodEnd gets fresh reminder!
      const cycle2End = '2026-12-06T12:00:00.000Z';
      const rNextCycle = await sendSubscriptionExpiringReminder({
        userId: 'usr_cycle_1',
        subscriptionId: 'sub_cycle_1',
        userEmail: 'subscriber@example.com',
        currentPeriodEnd: cycle2End,
        daysRemaining: 5,
        hoursRemaining: 120,
        isUrgent24h: false,
      });
      assert.strictEqual(rNextCycle.success, true);
      assert.ok(!rNextCycle.idempotent);
      assert.strictEqual(sim.getSentEmails().length, 3);
    });

    it('caps automatic retryable failures at maxAttempts (3) while allowing Admin manual retryNotificationById recovery', async () => {
      let providerCallCount = 0;
      setTestEmailProvider({
        providerName: 'flaky_smtp',
        isConfigured: true,
        async send() {
          providerCallCount++;
          return {
            success: false,
            provider: 'flaky_smtp',
            error: 'Temporary SMTP timeout',
            retryable: true,
          };
        },
      });

      const expiredAt = '2026-11-01T10:00:00.000Z';
      let outboxId = '';
      for (let i = 0; i < 5; i++) {
        const res = await sendSubscriptionExpiredNotification({
          userId: 'usr_flaky',
          subscriptionId: 'sub_flaky',
          userEmail: 'flaky@example.com',
          expiredAt,
        });
        outboxId = res.outboxId || outboxId;
      }

      // Auto-sweep must stop calling SMTP after 3 attempts
      assert.strictEqual(providerCallCount, 3);

      // Admin fixes SMTP and triggers manual retryNotificationById -> succeeds!
      setTestEmailProvider(null); // restores simulation provider in NODE_ENV=test
      const manualRetry = await retryNotificationById(
        outboxId,
        'shashankshines@gmail.com'
      );
      assert.strictEqual(manualRetry.success, true);
      assert.strictEqual(manualRetry.status, 'sent');
      assert.strictEqual(getSimulationProvider().getSentEmails().length, 1);
      assert.ok(
        getSimulationProvider()
          .getSentEmails()[0]
          .html.includes('Your Saved Jobs &amp; Account History Are Safe')
      );
    });

    it('gracefully skips email dispatch without throwing when subscriber has no recorded email anywhere', async () => {
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_no_email_anywhere',
          currentPeriodEnd: new Date(Date.now() + 2 * DAY_MS).toISOString(),
        })
      );
      const res = await dispatchUserRenewalNotificationIfDue({
        userId: 'usr_no_email_anywhere',
      });
      assert.strictEqual(res.triggered, false);
      assert.strictEqual(res.deliveryStatus, 'skipped_missing_email');
    });
  });

  // ==========================================================================
  // 3. Scheduled Cron Sweep & Cold-Serverless Email Fallback
  // ==========================================================================
  describe('3. Cron Sweep (/api/cron/billing/renewals & sweepAllSubscriptionRenewalNotifications)', () => {
    it('enforces CRON_SECRET / Admin auth and sweeps all cohorts accurately with race-safe expiry transition', async () => {
      const now = Date.now();

      // 1. Unauthorized request -> 401
      const unauthRes = await cronRenewalsGet(
        new NextRequest('http://localhost:3000/api/cron/billing/renewals')
      );
      assert.strictEqual(unauthRes.status, 401);

      // 2. Wrong Bearer token -> 401
      const badTokenRes = await cronRenewalsGet(
        new NextRequest('http://localhost:3000/api/cron/billing/renewals', {
          headers: { authorization: 'Bearer wrong_secret_value_123456' },
        })
      );
      assert.strictEqual(badTokenRes.status, 401);

      // Seed diverse subscriber cohorts in Firestore:
      // Cohort A: Healthy (20d left) -> 0 emails
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_healthy',
          userEmail: 'healthy@example.com',
          currentPeriodEnd: new Date(now + 20 * DAY_MS).toISOString(),
        })
      );

      // Cohort B: 4 days left -> 5d reminder email
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_5d',
          userEmail: 'five-days@example.com',
          currentPeriodEnd: new Date(now + 4 * DAY_MS).toISOString(),
        })
      );

      // Cohort C: 8 hours left, legacy doc WITHOUT userEmail on SubscriptionDocument
      // (email exists only on historical upi_orders doc — cold serverless fallback!)
      await createPaymentOrder({
        userId: 'usr_cohort_24h_cold',
        userEmail: 'cold-fallback@example.com',
      });
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_24h_cold',
          currentPeriodEnd: new Date(now + 8 * HOUR_MS).toISOString(),
        })
      );

      // Cohort D: 3 days left WITH pending_verification renewal UTR -> suppressed!
      const pendingOrder = await createPaymentOrder({
        userId: 'usr_cohort_pending',
        userEmail: 'already-paid@example.com',
      });
      await createPaymentSubmission({
        orderId: pendingOrder.orderId,
        userId: 'usr_cohort_pending',
        userEmail: 'already-paid@example.com',
        utr: '998877665544',
        declaredAmount: 499,
        paymentDate: new Date(now).toISOString().split('T')[0],
      });
      getSimulationProvider().clear(); // clear submission acknowledgement emails before sweep

      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_pending',
          userEmail: 'already-paid@example.com',
          currentPeriodEnd: new Date(now + 3 * DAY_MS).toISOString(),
        })
      );

      // Cohort E: Administratively halted & permanently revoked -> excluded!
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_halted',
          userEmail: 'halted@example.com',
          status: 'halted',
          currentPeriodEnd: new Date(now + 2 * DAY_MS).toISOString(),
        })
      );
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_revoked',
          userEmail: 'revoked@example.com',
          status: 'cancelled',
          metadata: { revoked: true },
          currentPeriodEnd: new Date(now - DAY_MS).toISOString(),
        })
      );

      // Cohort F: Lapsed 3 hours ago with status still 'active' -> expired email + status transitioned to 'expired'
      await saveFirestoreSubscription(
        makeSubscription({
          userId: 'usr_cohort_lapsed',
          userEmail: 'lapsed@example.com',
          status: 'active',
          currentPeriodEnd: new Date(now - 3 * HOUR_MS).toISOString(),
        })
      );

      // 3. Execute authorized Cron Sweep
      const cronRes = await cronRenewalsGet(
        new NextRequest('http://localhost:3000/api/cron/billing/renewals', {
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
        })
      );
      assert.strictEqual(cronRes.status, 200);
      const cronJson = await cronRes.json();
      assert.strictEqual(cronJson.success, true);

      const { summary } = cronJson;
      assert.strictEqual(summary.evaluatedCount, 7);
      assert.strictEqual(summary.expiring5dSent, 1);
      assert.strictEqual(summary.expiring24hSent, 1);
      assert.strictEqual(summary.expiredSent, 1);
      assert.strictEqual(summary.suppressedPendingVerification, 1);
      assert.strictEqual(summary.excludedAdminRestricted, 2);
      assert.strictEqual(summary.transitionedToExpiredCount, 1);

      const recipients = getSimulationProvider()
        .getSentEmails()
        .map((e) => e.to)
        .sort();
      assert.deepStrictEqual(recipients, [
        'cold-fallback@example.com',
        'five-days@example.com',
        'lapsed@example.com',
      ]);

      // Verify lapsed subscription was transitioned to 'expired' in Firestore
      const lapsedDoc = (
        await getSubscriptionsCollection().doc('usr_cohort_lapsed').get()
      ).data();
      assert.strictEqual(lapsedDoc?.status, 'expired');
      assert.strictEqual(lapsedDoc?.lastUpdatedFrom, 'system_expiry');

      // 4. Re-running sweep immediately must send ZERO duplicate emails
      const secondSweep = await sweepAllSubscriptionRenewalNotifications(now);
      assert.strictEqual(secondSweep.expiring5dSent, 0);
      assert.strictEqual(secondSweep.expiring24hSent, 0);
      assert.strictEqual(secondSweep.expiredSent, 0);
      assert.strictEqual(secondSweep.idempotentSkipped, 3);
      assert.strictEqual(getSimulationProvider().getSentEmails().length, 3);
    });
  });

  // ==========================================================================
  // 4. Early Renewal Checkout, Zero-Lost-Hours +30d Approval & Read-Only Status
  // ==========================================================================
  describe('4. Early Renewal Checkout, Zero-Lost-Hours Extension & API Guards', () => {
    it('blocks order/checkout at >5d, unblocks inside <=5d window, preserves remaining days (+30d) on approval, and keeps GET /api/billing/status read-only', async () => {
      const user = findOrCreateGoogleUser({
        sub: 'google_early_renewer',
        email: 'renewer@example.com',
        name: 'Early Renewer',
      });
      const session = createSession(user.id);
      const cookieHeader = `${SESSION_COOKIE_NAME}=${session.sessionId}`;

      const now = Date.now();

      // A. Active with 20 days left -> POST /api/billing/order & /checkout return 409
      await saveFirestoreSubscription(
        makeSubscription({
          userId: user.id,
          userEmail: user.email,
          currentPeriodEnd: new Date(now + 20 * DAY_MS).toISOString(),
        })
      );
      invalidateUserEntitlementCache();

      const blockedOrderRes = await billingOrderPost(
        new NextRequest('http://localhost:3000/api/billing/order', {
          method: 'POST',
          headers: { cookie: cookieHeader },
        })
      );
      assert.strictEqual(blockedOrderRes.status, 409);

      const blockedCheckoutRes = await billingCheckoutPost(
        new NextRequest('http://localhost:3000/api/billing/checkout', {
          method: 'POST',
          headers: { cookie: cookieHeader },
        })
      );
      assert.strictEqual(blockedCheckoutRes.status, 409);

      // B. Move into 5-day renewal window (3 days remaining)
      const originalExpiryMs = now + 3 * DAY_MS;
      const originalExpiryIso = new Date(originalExpiryMs).toISOString();
      await saveFirestoreSubscription(
        makeSubscription({
          userId: user.id,
          userEmail: user.email,
          currentPeriodStart: new Date(now - 27 * DAY_MS).toISOString(),
          currentPeriodEnd: originalExpiryIso,
        })
      );
      invalidateUserEntitlementCache();

      // Verify GET /api/billing/status is 100% read-only (zero outbox/order/sub writes)
      const outboxBefore = firestoreStore.getCollectionData(
        FIRESTORE_COLLECTIONS.EMAIL_OUTBOX
      ).size;
      const statusRes1 = await billingStatusGet(
        new NextRequest('http://localhost:3000/api/billing/status', {
          headers: { cookie: cookieHeader },
        })
      );
      const statusData1 = await statusRes1.json();
      assert.strictEqual(statusRes1.status, 200);
      assert.strictEqual(statusData1.renewal.stage, 'expiring_soon');
      assert.strictEqual(statusData1.renewal.canRenewNow, true);
      assert.strictEqual(statusData1.renewal.emailMilestone, 'expiring_5d');
      assert.strictEqual(statusData1.renewal.emailAlreadyDispatched, false);
      assert.strictEqual(
        firestoreStore.getCollectionData(FIRESTORE_COLLECTIONS.EMAIL_OUTBOX).size,
        outboxBefore,
        'GET /api/billing/status must never write to email_outbox'
      );

      // Trigger POST /api/billing/renewal-notify -> sends 5d email and flips emailAlreadyDispatched to true
      const notifyRes = await billingRenewalNotifyPost(
        new NextRequest('http://localhost:3000/api/billing/renewal-notify', {
          method: 'POST',
          headers: { cookie: cookieHeader },
        })
      );
      const notifyJson = await notifyRes.json();
      assert.strictEqual(notifyRes.status, 200);
      assert.strictEqual(notifyJson.triggered, true);
      assert.strictEqual(notifyJson.milestone, 'expiring_5d');

      const statusRes2 = await billingStatusGet(
        new NextRequest('http://localhost:3000/api/billing/status', {
          headers: { cookie: cookieHeader },
        })
      );
      const statusData2 = await statusRes2.json();
      assert.strictEqual(statusData2.renewal.emailAlreadyDispatched, true);

      // C. Subscriber initiates Early Renewal Order inside 5-day window -> 201 Created!
      const renewalOrderRes = await billingOrderPost(
        new NextRequest('http://localhost:3000/api/billing/order', {
          method: 'POST',
          headers: { cookie: cookieHeader },
        })
      );
      assert.strictEqual(renewalOrderRes.status, 201);
      const renewalOrderData = await renewalOrderRes.json();
      const renewalOrderId = renewalOrderData.order.orderId;

      // Reopening modal while renewal order is created resumes payment_instructions!
      const midCheckoutStatus = await (
        await billingStatusGet(
          new NextRequest('http://localhost:3000/api/billing/status', {
            headers: { cookie: cookieHeader },
          })
        )
      ).json();
      assert.strictEqual(midCheckoutStatus.billingFlow.step, 'payment_instructions');
      assert.strictEqual(midCheckoutStatus.billingFlow.order.orderId, renewalOrderId);

      // D. Submit renewal UTR -> duplicate order creation is blocked with 409 pendingVerification
      const renewalSubmission = await createPaymentSubmission({
        orderId: renewalOrderId,
        userId: user.id,
        userEmail: user.email,
        utr: '554433221199',
        declaredAmount: 499,
        paymentDate: new Date(now).toISOString().split('T')[0],
      });

      const dupOrderWhilePending = await billingOrderPost(
        new NextRequest('http://localhost:3000/api/billing/order', {
          method: 'POST',
          headers: { cookie: cookieHeader },
        })
      );
      assert.strictEqual(dupOrderWhilePending.status, 409);
      const dupJson = await dupOrderWhilePending.json();
      assert.strictEqual(dupJson.pendingVerification, true);

      // E. Admin approves early renewal -> new expiry = originalExpiry + 30 days (33 days total, zero lost hours!)
      const approval = await approvePaymentSubmissionInTransaction({
        submissionId: renewalSubmission.submissionId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'adm_1',
      });
      const expectedExtendedMs = originalExpiryMs + 30 * DAY_MS;
      const actualExtendedMs = new Date(
        approval.subscription.currentPeriodEnd
      ).getTime();
      assert.ok(
        Math.abs(actualExtendedMs - expectedExtendedMs) < 1000,
        `Expected extended period end ~${new Date(expectedExtendedMs).toISOString()}, got ${approval.subscription.currentPeriodEnd}`
      );
    });

    it('surfaces rejected early-renewal UTR in status_view for active subscribers and blocks administratively restricted accounts with 403', async () => {
      const user = findOrCreateGoogleUser({
        sub: 'google_rejected_early',
        email: 'earlyreject@example.com',
        name: 'Early Reject',
      });
      const session = createSession(user.id);
      const cookieHeader = `${SESSION_COOKIE_NAME}=${session.sessionId}`;
      const now = Date.now();

      await saveFirestoreSubscription(
        makeSubscription({
          userId: user.id,
          userEmail: user.email,
          currentPeriodStart: new Date(now - 26 * DAY_MS).toISOString(),
          currentPeriodEnd: new Date(now + 4 * DAY_MS).toISOString(),
        })
      );
      invalidateUserEntitlementCache();

      const order = await createPaymentOrder({
        userId: user.id,
        userEmail: user.email,
      });
      const submission = await createPaymentSubmission({
        orderId: order.orderId,
        userId: user.id,
        userEmail: user.email,
        utr: '776655443322',
        declaredAmount: 499,
        paymentDate: new Date(now).toISOString().split('T')[0],
      });

      await rejectPaymentSubmissionInTransaction({
        submissionId: submission.submissionId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'adm_1',
        reason: 'Incorrect UTR digits entered on renewal.',
      });

      const statusData = await (
        await billingStatusGet(
          new NextRequest('http://localhost:3000/api/billing/status', {
            headers: { cookie: cookieHeader },
          })
        )
      ).json();

      // Active subscriber still has 4 days of Premium, AND sees their rejected renewal UTR!
      assert.strictEqual(statusData.entitlement.isPremium, true);
      assert.strictEqual(statusData.billingFlow.step, 'status_view');
      assert.strictEqual(statusData.billingFlow.hasRejectedSubmission, true);
      assert.strictEqual(
        statusData.billingFlow.submission.submissionId,
        submission.submissionId
      );

      // Now administratively suspend the subscription -> /api/billing/order returns 403
      await saveFirestoreSubscription(
        makeSubscription({
          userId: user.id,
          userEmail: user.email,
          status: 'halted',
          currentPeriodEnd: new Date(now + 4 * DAY_MS).toISOString(),
        })
      );
      invalidateUserEntitlementCache();

      const restrictedRes = await billingOrderPost(
        new NextRequest('http://localhost:3000/api/billing/order', {
          method: 'POST',
          headers: { cookie: cookieHeader },
        })
      );
      assert.strictEqual(restrictedRes.status, 403);
      const restrictedData = await restrictedRes.json();
      assert.strictEqual(restrictedData.restricted, true);
    });

    it('resolves historical approved submission + expired entitlement cleanly to plan_review with expired renewal context', () => {
      const fixedNow = new Date('2026-11-02T12:00:00.000Z').getTime();
      const expiredSub = makeSubscription({
        userId: 'usr_hist',
        status: 'expired',
        currentPeriodEnd: new Date(fixedNow - 2 * DAY_MS).toISOString(),
      });
      const ent = evaluateSubscriptionEntitlement('usr_hist', expiredSub);
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: ent,
        submissions: [],
        activeOrder: null,
        subscription: expiredSub,
        nowMs: fixedNow,
      });

      assert.strictEqual(snapshot.step, 'plan_review');
      assert.strictEqual(snapshot.renewal.stage, 'expired');
      assert.strictEqual(snapshot.renewal.canRenewNow, true);
    });
  });

  // ==========================================================================
  // 5. Vercel Cron & Client In-App Renewal Wiring Verification
  // ==========================================================================
  describe('5. Cron Schedule & In-App UI Contract Verification', () => {
    it('configures daily Vercel Cron for /api/cron/billing/renewals and wires in-app banner, ?renew=1 deep-link, and early-renewal modal flow', () => {
      const repoRoot = process.cwd();
      const vercelConfig = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8')
      );
      assert.ok(Array.isArray(vercelConfig.crons));
      const renewalCron = vercelConfig.crons.find(
        (c: { path?: string; schedule?: string }) =>
          c.path === '/api/cron/billing/renewals'
      );
      assert.ok(renewalCron, 'vercel.json must register /api/cron/billing/renewals');
      assert.strictEqual(renewalCron.schedule, '0 4 * * *');

      const authContextSrc = fs.readFileSync(
        path.join(repoRoot, 'src/app/context/AuthContext.tsx'),
        'utf8'
      );
      assert.ok(authContextSrc.includes("fetch('/api/billing/renewal-notify'"));

      const upiFlowSrc = fs.readFileSync(
        path.join(repoRoot, 'src/app/components/billing/UpiPaymentFlow.tsx'),
        'utf8'
      );
      assert.ok(upiFlowSrc.includes('Renew for +30 Days (₹499)'));
      assert.ok(upiFlowSrc.includes('newlyBecamePremium'));

      const homePageSrc = fs.readFileSync(
        path.join(repoRoot, 'src/app/page.tsx'),
        'utf8'
      );
      assert.ok(homePageSrc.includes('aria-label="Subscription renewal notification"'));
      assert.ok(homePageSrc.includes("params.get('renew') !== '1'"));
      assert.ok(homePageSrc.includes('Access Valid Until'));
    });
  });
});
