import crypto from 'node:crypto';
import { getFirestoreDb } from './client';
import {
  getSubmissionsCollection,
  getOrdersCollection,
  getUtrReservationsCollection,
  getSubscriptionsCollection,
  getAuditLogsCollection,
  PaymentSubmissionDocument,
  PaymentOrderDocument,
  SubscriptionDocument,
  AdminAuditLogDocument,
  UtrReservationDocument,
} from './collections';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';
import { getUserById } from '@/modules/auth/server/session.store';

// ============================================================================
// Types & Domain Errors
// ============================================================================

export interface SubmissionWithOrder extends PaymentSubmissionDocument {
  order?: PaymentOrderDocument | null;
}

export interface AdminOverviewMetrics {
  pendingCount: number;
  slaBreachCount: number;
  activeSubscribersCount: number;
  totalApprovedCount: number;
  totalRejectedCount: number;
  totalAuditLogsCount: number;
}

export class SubmissionNotFoundError extends Error {
  constructor(submissionId: string) {
    super(`Payment submission "${submissionId}" was not found.`);
    this.name = 'SubmissionNotFoundError';
  }
}

export class InvalidSubmissionStateError extends Error {
  constructor(submissionId: string, currentStatus: string, expected: string) {
    super(`Submission "${submissionId}" is in status "${currentStatus}". Expected "${expected}".`);
    this.name = 'InvalidSubmissionStateError';
  }
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

export class MandatoryReasonMissingError extends Error {
  constructor(actionName: string) {
    super(`A mandatory administrative reason is required to execute "${actionName}".`);
    this.name = 'MandatoryReasonMissingError';
  }
}

// ============================================================================
// Overview & Metric Queries
// ============================================================================

export async function getAdminOverview(): Promise<AdminOverviewMetrics> {
  const submissionsCol = getSubmissionsCollection();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  const [submissionsSnap, subscriptionsSnap, auditLogsSnap] = await Promise.all([
    submissionsCol.get(),
    subscriptionsCol.get(),
    auditLogsCol.get(),
  ]);

  const now = Date.now();
  let pendingCount = 0;
  let slaBreachCount = 0;
  let totalApprovedCount = 0;
  let totalRejectedCount = 0;

  for (const doc of submissionsSnap.docs) {
    const data = doc.data();
    if (data.status === 'pending_verification') {
      pendingCount++;
      const deadline = new Date(data.slaDeadlineAt).getTime();
      if (!isNaN(deadline) && deadline < now) {
        slaBreachCount++;
      }
    } else if (data.status === 'approved') {
      totalApprovedCount++;
    } else if (data.status === 'rejected') {
      totalRejectedCount++;
    }
  }

  let activeSubscribersCount = 0;
  for (const doc of subscriptionsSnap.docs) {
    const data = doc.data();
    if (data.status === 'active') {
      const endMs = new Date(data.currentPeriodEnd).getTime();
      if (!isNaN(endMs) && endMs > now) {
        activeSubscribersCount++;
      }
    }
  }

  return {
    pendingCount,
    slaBreachCount,
    activeSubscribersCount,
    totalApprovedCount,
    totalRejectedCount,
    totalAuditLogsCount: auditLogsSnap.size,
  };
}

// ============================================================================
// Submissions Listing & Inspection
// ============================================================================

export async function getAdminSubmissions(filter?: {
  status?: 'all' | 'pending_verification' | 'approved' | 'rejected';
  limit?: number;
  offset?: number;
}): Promise<{ submissions: SubmissionWithOrder[]; total: number }> {
  const submissionsCol = getSubmissionsCollection();
  const ordersCol = getOrdersCollection();

  const query = filter?.status && filter.status !== 'all'
    ? submissionsCol.where('status', '==', filter.status)
    : submissionsCol;

  const snap = await query.get();
  const allSubmissions: PaymentSubmissionDocument[] = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1));

  const total = allSubmissions.length;
  const offset = filter?.offset || 0;
  const limit = Math.min(Math.max(filter?.limit || 25, 1), 100);
  const pagedSubmissions = allSubmissions.slice(offset, offset + limit);

  // Attach associated orders and resolve subscriber email
  const submissionsWithOrders: SubmissionWithOrder[] = await Promise.all(
    pagedSubmissions.map(async (sub) => {
      let order: PaymentOrderDocument | null = null;
      try {
        const orderSnap = await ordersCol.doc(sub.orderId).get();
        if (orderSnap.exists) {
          order = orderSnap.data() || null;
        }
      } catch {
        order = null;
      }

      const localUser = getUserById(sub.userId);
      const userEmail = sub.userEmail || order?.userEmail || localUser?.email || undefined;

      return {
        ...sub,
        userEmail,
        order,
      };
    })
  );

  return {
    submissions: submissionsWithOrders,
    total,
  };
}

// ============================================================================
// Transactional Payment Approval
// ============================================================================

/**
 * Exactly-Once Payment Approval:
 * 1. Validates submission is pending_verification.
 * 2. Idempotently returns success if already approved.
 * 3. Authoritatively validates order amount (₹499), plan ('premium_monthly'), currency ('INR').
 * 4. Consumes the UTR reservation in upi_utr_reservations.
 * 5. Applies authoritative subscription formula:
 *    newPeriodEnd = max(now, currentPeriodEnd) + 30 days
 * 6. Sets subscription status to 'active' and records 'manual_upi' update origin.
 * 7. Records append-only audit log in admin_audit_logs.
 */
export async function approvePaymentSubmissionInTransaction(params: {
  submissionId: string;
  adminEmail: string;
  adminUserId: string;
  verificationNotes?: string;
}): Promise<{
  success: boolean;
  idempotent: boolean;
  submission: PaymentSubmissionDocument;
  subscription: SubscriptionDocument;
}> {
  const { submissionId, adminEmail, adminUserId, verificationNotes } = params;
  if (!submissionId) throw new Error('submissionId is required.');
  if (!adminEmail) throw new Error('adminEmail is required.');

  const db = getFirestoreDb();
  const submissionsCol = getSubmissionsCollection();
  const ordersCol = getOrdersCollection();
  const reservationsCol = getUtrReservationsCollection();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    // 1. Fetch submission document
    const submissionRef = submissionsCol.doc(submissionId);
    const submissionSnap = await transaction.get(submissionRef);

    if (!submissionSnap.exists) {
      throw new SubmissionNotFoundError(submissionId);
    }

    const submission = submissionSnap.data() as PaymentSubmissionDocument;

    // Idempotency check: already approved
    if (submission.status === 'approved') {
      const subSnap = await transaction.get(subscriptionsCol.doc(submission.userId));
      const existingSub = subSnap.exists ? (subSnap.data() as SubscriptionDocument) : null;
      return {
        success: true,
        idempotent: true,
        submission,
        subscription: existingSub!,
      };
    }

    if (submission.status !== 'pending_verification') {
      throw new InvalidSubmissionStateError(submissionId, submission.status, 'pending_verification');
    }

    // 2. Fetch and authoritatively validate order document
    const orderRef = ordersCol.doc(submission.orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new OrderValidationError(`Associated payment order "${submission.orderId}" does not exist.`);
    }

    const order = orderSnap.data() as PaymentOrderDocument;

    if (order.userId !== submission.userId) {
      throw new OrderValidationError(`Ownership mismatch: order owner "${order.userId}" !== submission user "${submission.userId}".`);
    }

    if (order.planId !== PREMIUM_PLAN.id) {
      throw new OrderValidationError(`Invalid planId "${order.planId}". Expected "${PREMIUM_PLAN.id}".`);
    }

    if (order.amountInr !== PREMIUM_PLAN.priceInr || order.currency !== 'INR') {
      throw new OrderValidationError(`Invalid order terms: ₹${order.amountInr} ${order.currency}. Expected ₹${PREMIUM_PLAN.priceInr} INR.`);
    }

    // 3. Fetch and validate UTR reservation
    const reservationRef = reservationsCol.doc(submission.utrNumber);
    const reservationSnap = await transaction.get(reservationRef);

    if (!reservationSnap.exists) {
      throw new OrderValidationError(`UTR reservation for "${submission.utrNumber}" does not exist.`);
    }

    const reservation = reservationSnap.data() as UtrReservationDocument;

    // Strict UTR state validation: prevent consuming released or already consumed UTRs
    if (reservation.status === 'consumed') {
      if (
        reservation.submissionId !== submission.submissionId ||
        reservation.orderId !== submission.orderId
      ) {
        throw new OrderValidationError(
          `UTR "${submission.utrNumber}" is already consumed by order "${reservation.orderId}".`
        );
      }
    } else if (reservation.status === 'released') {
      throw new OrderValidationError(
        `Cannot approve payment: UTR reservation for "${submission.utrNumber}" was released.`
      );
    } else if (reservation.status !== 'reserved') {
      throw new OrderValidationError(
        `Cannot approve payment: UTR reservation is in invalid status "${reservation.status}".`
      );
    } else {
      if (
        reservation.submissionId !== submission.submissionId ||
        reservation.orderId !== submission.orderId
      ) {
        throw new OrderValidationError(
          `UTR reservation belongs to submission "${reservation.submissionId}", expected "${submission.submissionId}".`
        );
      }
    }

    // 4. Fetch existing subscription for the user
    const subscriptionRef = subscriptionsCol.doc(submission.userId);
    const subscriptionSnap = await transaction.get(subscriptionRef);
    const existingSub = subscriptionSnap.exists ? (subscriptionSnap.data() as SubscriptionDocument) : null;

    // 5. Calculate new subscription period using established formula:
    // newPeriodEnd = max(now, currentPeriodEnd) + 30 days
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    let currentPeriodEndMs = 0;
    if (existingSub?.currentPeriodEnd) {
      const parsed = new Date(existingSub.currentPeriodEnd).getTime();
      if (!isNaN(parsed)) {
        currentPeriodEndMs = parsed;
      }
    }

    const baseMs = Math.max(now, currentPeriodEndMs);
    const newPeriodEndIso = new Date(baseMs + THIRTY_DAYS_MS).toISOString();

    const currentPeriodStartIso =
      existingSub?.status === 'active' && currentPeriodEndMs > now && existingSub.currentPeriodStart
        ? existingSub.currentPeriodStart
        : nowIso;

    // 6. Construct updated entities
    const updatedSubmission: PaymentSubmissionDocument = {
      ...submission,
      status: 'approved',
      reviewedBy: adminEmail,
      reviewedAt: nowIso,
      verificationNotes: verificationNotes?.trim() || 'Independent bank verification confirmed receipt.',
    };

    const resolvedUserEmail =
      submission.userEmail ||
      order.userEmail ||
      getUserById(submission.userId)?.email ||
      existingSub?.userEmail;

    const updatedSubscription: SubscriptionDocument = {
      id: existingSub?.id || `sub_${crypto.randomBytes(8).toString('hex')}`,
      userId: submission.userId,
      ...(resolvedUserEmail ? { userEmail: resolvedUserEmail } : {}),
      planId: 'premium_monthly',
      status: 'active',
      provider: 'manual_upi',
      paymentReference: submission.utrNumber,
      currentPeriodStart: currentPeriodStartIso,
      currentPeriodEnd: newPeriodEndIso,
      cancelAtPeriodEnd: false,
      createdAt: existingSub?.createdAt || nowIso,
      updatedAt: nowIso,
      lastUpdatedFrom: 'manual_upi',
    };

    // 7. Atomic transaction updates
    // Update submission status to approved
    transaction.update(submissionRef, {
      status: 'approved',
      reviewedBy: adminEmail,
      reviewedAt: nowIso,
      verificationNotes: updatedSubmission.verificationNotes,
    });

    // Mark UTR reservation consumed
    transaction.update(reservationRef, {
      status: 'consumed',
      consumedAt: nowIso,
    });

    // Set authoritative subscription
    transaction.set(subscriptionRef, updatedSubscription, { merge: true });

    // Append immutable audit log with deterministic event ID (retry-safe)
    const auditId = `audit_app_${submission.submissionId}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'payment_approved',
      targetUserId: submission.userId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: submission.submissionId,
      previousState: {
        submissionStatus: submission.status,
        currentPeriodEnd: existingSub?.currentPeriodEnd || null,
      },
      newState: {
        submissionStatus: 'approved',
        currentPeriodEnd: newPeriodEndIso,
        utrNumber: submission.utrNumber,
      },
      reason: updatedSubmission.verificationNotes,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return {
      success: true,
      idempotent: false,
      submission: updatedSubmission,
      subscription: updatedSubscription,
    };
  });
}

// ============================================================================
// Transactional Payment Rejection
// ============================================================================

/**
 * Transactional Payment Rejection:
 * 1. Validates mandatory rejection reason.
 * 2. Idempotently returns success if already rejected.
 * 3. Releases the reserved UTR so it is freed for corrections or dispute tracking.
 * 4. Records append-only audit log in admin_audit_logs.
 * 5. Does NOT mutate subscription records.
 */
export async function rejectPaymentSubmissionInTransaction(params: {
  submissionId: string;
  adminEmail: string;
  adminUserId: string;
  reason: string;
}): Promise<{
  success: boolean;
  idempotent: boolean;
  submission: PaymentSubmissionDocument;
}> {
  const { submissionId, adminEmail, adminUserId, reason } = params;
  if (!submissionId) throw new Error('submissionId is required.');
  if (!adminEmail) throw new Error('adminEmail is required.');

  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    throw new MandatoryReasonMissingError('Payment Rejection');
  }

  const db = getFirestoreDb();
  const submissionsCol = getSubmissionsCollection();
  const reservationsCol = getUtrReservationsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    // 1. All Reads: Read submission document
    const submissionRef = submissionsCol.doc(submissionId);
    const submissionSnap = await transaction.get(submissionRef);

    if (!submissionSnap.exists) {
      throw new SubmissionNotFoundError(submissionId);
    }

    const submission = submissionSnap.data() as PaymentSubmissionDocument;

    // Idempotency check: already rejected
    if (submission.status === 'rejected') {
      return {
        success: true,
        idempotent: true,
        submission,
      };
    }

    if (submission.status !== 'pending_verification') {
      throw new InvalidSubmissionStateError(submissionId, submission.status, 'pending_verification');
    }

    // 2. All Reads: Read UTR reservation document BEFORE any writes
    const reservationRef = reservationsCol.doc(submission.utrNumber);
    const reservationSnap = await transaction.get(reservationRef);

    if (reservationSnap.exists) {
      const reservation = reservationSnap.data() as UtrReservationDocument;
      if (reservation.status === 'consumed') {
        throw new Error(
          `CRITICAL: Cannot reject submission: UTR "${submission.utrNumber}" is already consumed by an approved payment.`
        );
      }
    }

    const nowIso = new Date().toISOString();

    const updatedSubmission: PaymentSubmissionDocument = {
      ...submission,
      status: 'rejected',
      decisionReason: trimmedReason,
      reviewedBy: adminEmail,
      reviewedAt: nowIso,
    };

    // 3. All Writes: Update submission to rejected
    transaction.update(submissionRef, {
      status: 'rejected',
      decisionReason: trimmedReason,
      reviewedBy: adminEmail,
      reviewedAt: nowIso,
    });

    // 4. All Writes: Release UTR reservation if it is reserved
    if (reservationSnap.exists) {
      const reservation = reservationSnap.data() as UtrReservationDocument;
      if (reservation.status === 'reserved') {
        transaction.update(reservationRef, {
          status: 'released',
          releasedAt: nowIso,
          releaseReason: trimmedReason,
        });
      }
    }

    // 5. All Writes: Append immutable audit log with deterministic event ID (retry-safe)
    const resolvedUserEmail =
      submission.userEmail ||
      getUserById(submission.userId)?.email;

    const auditId = `audit_rej_${submission.submissionId}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'payment_rejected',
      targetUserId: submission.userId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: submission.submissionId,
      previousState: {
        submissionStatus: submission.status,
      },
      newState: {
        submissionStatus: 'rejected',
        decisionReason: trimmedReason,
      },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return {
      success: true,
      idempotent: false,
      submission: updatedSubmission,
    };
  });
}

// ============================================================================
// Manual Entitlement Controls
// ============================================================================

/**
 * Admin Manual Grant:
 * Grants Premium access for a given duration (default 30 days) with a mandatory administrative reason.
 * Does NOT create a payment order or fabricate a payment submission.
 */
export async function adminManualGrantSubscriptionInTransaction(params: {
  targetUserId: string;
  adminEmail: string;
  adminUserId: string;
  days?: number;
  reason: string;
}): Promise<SubscriptionDocument> {
  const { targetUserId, adminEmail, adminUserId, days = 30, reason } = params;
  if (!targetUserId) throw new Error('targetUserId is required.');
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) throw new MandatoryReasonMissingError('Manual Premium Grant');

  const safeDays = Math.min(Math.max(days, 1), 365);
  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    const existingSub = subSnap.exists ? (subSnap.data() as SubscriptionDocument) : null;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const durationMs = safeDays * 24 * 60 * 60 * 1000;

    let currentPeriodEndMs = 0;
    if (existingSub?.currentPeriodEnd) {
      const parsed = new Date(existingSub.currentPeriodEnd).getTime();
      if (!isNaN(parsed)) currentPeriodEndMs = parsed;
    }

    const baseMs = Math.max(now, currentPeriodEndMs);
    const newPeriodEndIso = new Date(baseMs + durationMs).toISOString();
    const resolvedUserEmail = existingSub?.userEmail || getUserById(targetUserId)?.email;

    const newSub: SubscriptionDocument = {
      id: existingSub?.id || `sub_${crypto.randomBytes(8).toString('hex')}`,
      userId: targetUserId,
      ...(resolvedUserEmail ? { userEmail: resolvedUserEmail } : {}),
      planId: 'premium_monthly',
      status: 'active',
      provider: 'manual',
      currentPeriodStart: existingSub?.currentPeriodStart || nowIso,
      currentPeriodEnd: newPeriodEndIso,
      cancelAtPeriodEnd: false,
      createdAt: existingSub?.createdAt || nowIso,
      updatedAt: nowIso,
      lastUpdatedFrom: 'admin_grant',
    };

    transaction.set(subRef, newSub, { merge: true });

    // Append audit log
    const auditId = `audit_${crypto.randomBytes(8).toString('hex')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'admin_grant',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: newSub.id,
      previousState: existingSub ? { status: existingSub.status, currentPeriodEnd: existingSub.currentPeriodEnd } : null,
      newState: { status: 'active', currentPeriodEnd: newPeriodEndIso, daysGranted: safeDays },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return newSub;
  });
}

/**
 * Admin Subscription Extension:
 * Extends an existing active subscription by adding additional days without shortening any current validity.
 */
export async function adminExtendSubscriptionInTransaction(params: {
  targetUserId: string;
  adminEmail: string;
  adminUserId: string;
  days?: number;
  reason: string;
}): Promise<SubscriptionDocument> {
  const { targetUserId, adminEmail, adminUserId, days = 30, reason } = params;
  if (!targetUserId) throw new Error('targetUserId is required.');
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) throw new MandatoryReasonMissingError('Subscription Extension');

  const safeDays = Math.min(Math.max(days, 1), 365);
  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`Cannot extend: No subscription found for user "${targetUserId}". Use manual grant instead.`);
    }

    const existingSub = subSnap.data() as SubscriptionDocument;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const durationMs = safeDays * 24 * 60 * 60 * 1000;

    let currentPeriodEndMs = 0;
    if (existingSub.currentPeriodEnd) {
      const parsed = new Date(existingSub.currentPeriodEnd).getTime();
      if (!isNaN(parsed)) currentPeriodEndMs = parsed;
    }

    const baseMs = Math.max(now, currentPeriodEndMs);
    const newPeriodEndIso = new Date(baseMs + durationMs).toISOString();
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;

    const updatedSub: SubscriptionDocument = {
      ...existingSub,
      status: 'active',
      currentPeriodEnd: newPeriodEndIso,
      updatedAt: nowIso,
      lastUpdatedFrom: 'admin_manual',
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Append audit log
    const auditId = `audit_${crypto.randomBytes(8).toString('hex')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'subscription_extended',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: existingSub.id,
      previousState: { currentPeriodEnd: existingSub.currentPeriodEnd },
      newState: { currentPeriodEnd: newPeriodEndIso, daysAdded: safeDays },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return updatedSub;
  });
}

/**
 * Admin Suspend Subscription:
 * Sets status to 'halted' with cancelAtPeriodEnd false, immediately cutting off Premium access.
 * PRESERVES original currentPeriodEnd so paid validity is not erased or truncated.
 * Records administrator identity, timestamp, reason, and prior state in audit logs.
 */
export async function adminSuspendSubscriptionInTransaction(params: {
  targetUserId: string;
  adminEmail: string;
  adminUserId: string;
  reason: string;
}): Promise<SubscriptionDocument> {
  const { targetUserId, adminEmail, adminUserId, reason } = params;
  if (!targetUserId) throw new Error('targetUserId is required.');
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) throw new MandatoryReasonMissingError('Subscription Suspension');

  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const existingSub = subSnap.data() as SubscriptionDocument;

    // Idempotent if already halted
    if (existingSub.status === 'halted') {
      return existingSub;
    }

    if (existingSub.status === 'cancelled' || existingSub.metadata?.revoked === true) {
      throw new Error(`Cannot suspend already cancelled or revoked subscription for user "${targetUserId}".`);
    }

    const nowIso = new Date().toISOString();

    // Preserve original currentPeriodEnd; status 'halted' immediately revokes Premium in entitlement.service
    const updatedSub: SubscriptionDocument = {
      ...existingSub,
      status: 'halted',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: existingSub.currentPeriodEnd,
      updatedAt: nowIso,
      lastUpdatedFrom: 'admin_manual',
      metadata: {
        ...(existingSub.metadata || {}),
        preSuspensionPeriodEnd: existingSub.currentPeriodEnd,
        preSuspensionStatus: existingSub.status,
        suspendedAt: nowIso,
        suspensionReason: trimmedReason,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Append audit log with deterministic event ID
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_suspend_${targetUserId}_${nowIso.slice(0, 19).replace(/[:]/g, '-')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'subscription_suspended',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: existingSub.id,
      previousState: { status: existingSub.status, currentPeriodEnd: existingSub.currentPeriodEnd },
      newState: { status: 'halted', currentPeriodEnd: existingSub.currentPeriodEnd },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return updatedSub;
  });
}

/**
 * Admin Reinstate Subscription:
 * Restores a suspended or halted subscription to 'active' status.
 * PRESERVES the existing period end without automatically granting an extra 30 days.
 * An optional extendDays can be provided if an extension is explicitly authorized.
 * Strict protection: CANNOT reinstate a revoked or cancelled subscription.
 */
export async function adminReinstateSubscriptionInTransaction(params: {
  targetUserId: string;
  adminEmail: string;
  adminUserId: string;
  reason: string;
  extendDays?: number;
}): Promise<SubscriptionDocument> {
  const { targetUserId, adminEmail, adminUserId, reason, extendDays } = params;
  if (!targetUserId) throw new Error('targetUserId is required.');
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) throw new MandatoryReasonMissingError('Subscription Reinstatement');

  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const existingSub = subSnap.data() as SubscriptionDocument;

    // Safety Invariant: Revoked subscriptions cannot be restored via generic reinstatement
    if (existingSub.status === 'cancelled' || existingSub.metadata?.revoked === true) {
      throw new Error(
        `Cannot reinstate revoked subscription for user "${targetUserId}". A revoked subscription requires an explicit manual grant.`
      );
    }

    // Idempotency check: already active and no extension requested
    if (existingSub.status === 'active' && (!extendDays || extendDays <= 0)) {
      return existingSub;
    }

    if (existingSub.status !== 'halted') {
      throw new Error(
        `Cannot reinstate subscription in status "${existingSub.status}". Only halted subscriptions can be reinstated.`
      );
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    // Financial Integrity Invariant: Preserve existing currentPeriodEnd; do NOT auto-grant 30 free days!
    let newPeriodEndIso = existingSub.currentPeriodEnd;
    if (extendDays && extendDays > 0) {
      const safeDays = Math.min(Math.max(extendDays, 1), 365);
      const extendMs = safeDays * 24 * 60 * 60 * 1000;
      let currentPeriodEndMs = 0;
      if (existingSub.currentPeriodEnd) {
        const parsed = new Date(existingSub.currentPeriodEnd).getTime();
        if (!isNaN(parsed)) currentPeriodEndMs = parsed;
      }
      const baseMs = Math.max(now, currentPeriodEndMs);
      newPeriodEndIso = new Date(baseMs + extendMs).toISOString();
    }

    const updatedSub: SubscriptionDocument = {
      ...existingSub,
      status: 'active',
      currentPeriodEnd: newPeriodEndIso,
      cancelAtPeriodEnd: false,
      updatedAt: nowIso,
      lastUpdatedFrom: 'admin_manual',
      metadata: {
        ...(existingSub.metadata || {}),
        reinstatedAt: nowIso,
        reinstatementReason: trimmedReason,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Append audit log with deterministic event ID
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_reinstate_${targetUserId}_${nowIso.slice(0, 19).replace(/[:]/g, '-')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'subscription_reinstated',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: existingSub.id,
      previousState: { status: existingSub.status, currentPeriodEnd: existingSub.currentPeriodEnd },
      newState: { status: 'active', currentPeriodEnd: newPeriodEndIso, daysExtended: extendDays || 0 },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return updatedSub;
  });
}

/**
 * Admin Revoke Subscription:
 * Permanently cancels subscription access with cancelAtPeriodEnd false and terminates period end.
 * Revoked subscriptions cannot be reinstated through generic reinstate actions.
 */
export async function adminRevokeSubscriptionInTransaction(params: {
  targetUserId: string;
  adminEmail: string;
  adminUserId: string;
  reason: string;
}): Promise<SubscriptionDocument> {
  const { targetUserId, adminEmail, adminUserId, reason } = params;
  if (!targetUserId) throw new Error('targetUserId is required.');
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) throw new MandatoryReasonMissingError('Subscription Revocation');

  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  return await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const existingSub = subSnap.data() as SubscriptionDocument;

    // Idempotent if already revoked
    if (existingSub.status === 'cancelled' && existingSub.metadata?.revoked === true) {
      return existingSub;
    }

    const nowIso = new Date().toISOString();

    const updatedSub: SubscriptionDocument = {
      ...existingSub,
      status: 'cancelled',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: nowIso, // Permanently terminates current validity period
      cancelledAt: nowIso,
      updatedAt: nowIso,
      lastUpdatedFrom: 'admin_manual',
      metadata: {
        ...(existingSub.metadata || {}),
        revoked: true,
        revokedAt: nowIso,
        revocationReason: trimmedReason,
        preRevocationPeriodEnd: existingSub.currentPeriodEnd,
        preRevocationStatus: existingSub.status,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Append audit log with deterministic event ID
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_revoke_${targetUserId}_${nowIso.slice(0, 19).replace(/[:]/g, '-')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'subscription_revoked',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: existingSub.id,
      previousState: { status: existingSub.status, currentPeriodEnd: existingSub.currentPeriodEnd },
      newState: { status: 'cancelled', currentPeriodEnd: nowIso, revoked: true },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    return updatedSub;
  });
}

// ============================================================================
// Subscriptions & Audit Queries
// ============================================================================

export async function getAdminSubscriptions(params?: {
  limit?: number;
  userId?: string;
  query?: string;
}): Promise<SubscriptionDocument[]> {
  const subscriptionsCol = getSubscriptionsCollection();

  const snap = await subscriptionsCol.get();
  const rawDocs: SubscriptionDocument[] = snap.docs.map((d) => d.data());

  const enriched = rawDocs.map((sub) => {
    const localUser = getUserById(sub.userId);
    const userEmail = sub.userEmail || localUser?.email || undefined;
    return {
      ...sub,
      userEmail,
    };
  });

  const filterTerm = (params?.query || params?.userId || '').trim().toLowerCase();
  let subs = enriched;
  if (filterTerm) {
    subs = enriched.filter(
      (s) =>
        s.userId.toLowerCase().includes(filterTerm) ||
        (s.userEmail && s.userEmail.toLowerCase().includes(filterTerm))
    );
  }

  subs.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  const limit = Math.min(Math.max(params?.limit || 50, 1), 200);
  return subs.slice(0, limit);
}

export async function getAdminAuditLogs(params?: {
  limit?: number;
  action?: string;
  targetUserId?: string;
}): Promise<AdminAuditLogDocument[]> {
  const auditLogsCol = getAuditLogsCollection();
  const snap = await auditLogsCol.get();
  let logs: AdminAuditLogDocument[] = snap.docs.map((d) => d.data());

  if (params?.action) {
    logs = logs.filter((l) => l.action === params.action);
  }
  if (params?.targetUserId) {
    logs = logs.filter((l) => l.targetUserId === params.targetUserId);
  }

  const enriched = logs.map((log) => {
    const localUser = getUserById(log.targetUserId);
    const targetUserEmail = log.targetUserEmail || localUser?.email || undefined;
    return {
      ...log,
      targetUserEmail,
    };
  });

  enriched.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  const limit = Math.min(Math.max(params?.limit || 50, 1), 200);
  return enriched.slice(0, limit);
}
