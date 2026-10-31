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
import { getUserById, getAllUsers } from '@/modules/auth/server/session.store';
import {
  evaluateSubscriptionEntitlement,
  invalidateUserEntitlementCache,
} from '@/modules/billing/services/entitlement.service';
import {
  sendPaymentApprovalNotification,
  sendPaymentRejectionNotification,
} from '@/modules/email/email.service';
import { invalidateAuditLogsCache } from './audit.store';
import {
  getBillingSyncVersion,
  bumpBillingSyncVersion,
  readBillingSyncVersionInTransaction,
  writeBillingSyncVersionInTransaction,
} from './billing-sync.store';
import { encodeCursor, decodeCursor } from './cursor';

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
  // Phase 2B.3C Financial & Subscriber Metrics
  verifiedRevenueInr: number;
  pendingClaimedRevenueInr: number;
  paymentBackedSubscribersCount: number;
  manualGrantSubscribersCount: number;
  expiringSoonCount: number;
}

export interface User360Identity {
  userId: string;
  email: string | null;
  name: string | null;
  provider: string | null;
  createdAt: string | null;
  isEmailVerified: boolean;
  status: string;
}

export interface User360Subscription {
  status: string;
  planId: string;
  source: 'payment_backed' | 'manual_grant' | 'unknown';
  updateOrigin?: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  isPremium: boolean;
  isEntitled: boolean;
  entitlementStatus: string;
  remainingDays: number;
  gracePeriod: boolean;
  notes?: string;
  terminatedAt?: string;
  terminationReason?: string;
  terminatedBy?: string;
}

export interface User360TimelineEvent {
  id: string;
  timestamp: string;
  category: 'order' | 'submission' | 'approval' | 'rejection' | 'subscription' | 'admin_action';
  action: string;
  summary: string;
  actor: string;
  details?: Record<string, unknown>;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
}

export interface User360Dossier {
  identity: User360Identity;
  subscription: User360Subscription | null;
  orders: PaymentOrderDocument[];
  submissions: SubmissionWithOrder[];
  auditLogs: AdminAuditLogDocument[];
  timeline: User360TimelineEvent[];
}

export interface PaymentLedgerItem {
  id: string;
  orderId: string;
  submissionId?: string;
  userId: string;
  userEmail?: string;
  amount: number;
  currency: string;
  utr?: string;
  status: 'verified' | 'pending' | 'rejected' | 'unsubmitted' | 'expired';
  orderCreatedAt: string;
  paymentDate?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  decisionReason?: string;
  verificationNotes?: string;
  upiIdSnapshot?: string;
  isOrphan?: boolean;
  isDuplicateUtr?: boolean;
  source: 'payment';
}

export interface PaymentLedgerSummary {
  verifiedPaymentAmountInr: number;
  verifiedRevenueInr: number; // Backward-compatible alias
  pendingClaimedAmountInr: number;
  pendingClaimedRevenueInr: number; // Backward-compatible alias
  rejectedClaimedAmountInr: number;
  totalOrdersCount: number;
  verifiedPaymentsCount: number;
  pendingSubmissionsCount: number;
  rejectedSubmissionsCount: number;
  unsubmittedOrdersCount: number;
  expiredOrdersCount: number;
  manualGrantsExcludedCount: number;
  unresolvedReviewCount: number;
  refundPolicyNote: string;
}

export interface PaymentLedgerFilter {
  status?: 'all' | 'verified' | 'pending' | 'rejected' | 'unsubmitted' | 'expired';
  query?: string;
  cursor?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
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
// In-Memory Performance Cache (Phase 2B.5 & 2B.5.1 Multi-Instance Sync)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

let cachedAdminOverview: CacheEntry<AdminOverviewMetrics> | null = null;
let cachedLedgerSnapshot: { items: PaymentLedgerItem[]; summary: PaymentLedgerSummary; timestamp: number; version: number } | null = null;
let cachedSubscriptionsSnapshot: { docs: SubscriptionDocument[]; timestamp: number; version: number } | null = null;
const ADMIN_CACHE_TTL_MS = 20 * 1000; // 20-second snapshot cache

export function invalidateAdminStoresCache(): void {
  cachedAdminOverview = null;
  cachedLedgerSnapshot = null;
  cachedSubscriptionsSnapshot = null;
}

// ============================================================================
// Overview & Metric Queries
// ============================================================================

export async function getAdminOverview(options?: { bypassCache?: boolean; forceCache?: boolean }): Promise<AdminOverviewMetrics> {
  const now = Date.now();
  const isTestEnv = process.env.NODE_ENV === 'test' && !options?.forceCache;
  const currentVersion = await getBillingSyncVersion();

  if (
    !isTestEnv &&
    !options?.bypassCache &&
    cachedAdminOverview &&
    cachedAdminOverview.version === currentVersion &&
    now - cachedAdminOverview.timestamp < ADMIN_CACHE_TTL_MS
  ) {
    return cachedAdminOverview.data;
  }

  const submissionsCol = getSubmissionsCollection();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  const [submissionsSnap, subscriptionsSnap, auditLogsSnap] = await Promise.all([
    submissionsCol.get(),
    subscriptionsCol.get(),
    auditLogsCol.get(),
  ]);

  let pendingCount = 0;
  let slaBreachCount = 0;
  let totalApprovedCount = 0;
  let totalRejectedCount = 0;
  let pendingClaimedRevenueInr = 0;

  for (const doc of submissionsSnap.docs) {
    const data = doc.data();
    if (data.status === 'pending_verification') {
      pendingCount++;
      pendingClaimedRevenueInr += Number(data.declaredAmount) || 499;
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
  let paymentBackedSubscribersCount = 0;
  let manualGrantSubscribersCount = 0;
  let expiringSoonCount = 0;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  for (const doc of subscriptionsSnap.docs) {
    const data = doc.data();
    if (data.status === 'active') {
      const endMs = new Date(data.currentPeriodEnd).getTime();
      if (!isNaN(endMs) && endMs > now) {
        activeSubscribersCount++;
        if (
          data.lastUpdatedFrom === 'manual_upi' ||
          data.provider === 'manual_upi' ||
          data.provider === 'razorpay'
        ) {
          paymentBackedSubscribersCount++;
        } else {
          manualGrantSubscribersCount++;
        }
        if (endMs <= now + sevenDaysMs) {
          expiringSoonCount++;
        }
      }
    }
  }

  // Authoritative verified revenue: approved payment count * ₹499
  const verifiedRevenueInr = totalApprovedCount * 499;

  const metrics: AdminOverviewMetrics = {
    pendingCount,
    slaBreachCount,
    activeSubscribersCount,
    totalApprovedCount,
    totalRejectedCount,
    totalAuditLogsCount: auditLogsSnap.size,
    verifiedRevenueInr,
    pendingClaimedRevenueInr,
    paymentBackedSubscribersCount,
    manualGrantSubscribersCount,
    expiringSoonCount,
  };

  cachedAdminOverview = { data: metrics, timestamp: now, version: currentVersion };
  return metrics;
}

// ============================================================================
// Submissions Listing & Inspection
// ============================================================================

export async function getAdminSubmissions(filter?: {
  status?: 'all' | 'pending_verification' | 'approved' | 'rejected';
  limit?: number;
  offset?: number;
  cursor?: string;
  query?: string;
}): Promise<{
  submissions: SubmissionWithOrder[];
  total: number;
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore: boolean;
}> {
  const submissionsCol = getSubmissionsCollection();
  const ordersCol = getOrdersCollection();

  const baseQuery = filter?.status && filter.status !== 'all'
    ? submissionsCol.where('status', '==', filter.status)
    : submissionsCol;

  const limit = Math.min(Math.max(filter?.limit || 5, 1), 100);
  const offset = filter?.offset || 0;

  let pagedSubmissions: PaymentSubmissionDocument[] = [];
  let total = 0;
  let hasMore = false;
  let nextCursor: string | null = null;

  if (!filter?.query) {
    // 1. Efficient count aggregation: read-cost = 1 metadata index entry
    const countPromise = 'count' in baseQuery && typeof (baseQuery as unknown as { count: () => { get: () => Promise<{ data: () => { count: number } }> } }).count === 'function'
      ? (baseQuery as unknown as { count: () => { get: () => Promise<{ data: () => { count: number } }> } }).count().get().then((res) => res.data().count)
      : baseQuery.get().then((res) => res.size);

    // 2. Cursor pagination vs offset
    let dataQuery: any = baseQuery.orderBy('submittedAt', 'desc').orderBy('submissionId', 'desc');

    const decodedCursor = filter?.cursor ? decodeCursor(filter.cursor) : null;
    if (decodedCursor && typeof dataQuery.startAfter === 'function') {
      dataQuery = dataQuery.startAfter(decodedCursor.primary, decodedCursor.secondary).limit(limit + 1);
    } else if (typeof dataQuery.offset === 'function' && offset > 0) {
      dataQuery = dataQuery.offset(offset).limit(limit + 1);
    } else {
      dataQuery = dataQuery.limit(limit + 1);
    }

    const [totalCount, pageSnap] = await Promise.all([countPromise, dataQuery.get()]);
    total = totalCount;

    const rawDocs: PaymentSubmissionDocument[] = pageSnap.docs.map((d: any) => d.data());
    if (rawDocs.length > limit) {
      hasMore = true;
      pagedSubmissions = rawDocs.slice(0, limit);
    } else {
      hasMore = false;
      pagedSubmissions = rawDocs;
    }

    if (pagedSubmissions.length > 0) {
      const last = pagedSubmissions[pagedSubmissions.length - 1];
      nextCursor = hasMore ? encodeCursor(last.submittedAt, last.submissionId) : null;
    }
  } else {
    const snap = await baseQuery.get();
    let allSubmissions: PaymentSubmissionDocument[] = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1));

    const q = filter.query.trim().toLowerCase();
    allSubmissions = allSubmissions.filter((sub) => {
      const localUser = getUserById(sub.userId);
      const email = sub.userEmail || localUser?.email || '';
      return (
        sub.utrNumber.toLowerCase().includes(q) ||
        sub.userId.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q)
      );
    });

    total = allSubmissions.length;
    const startIndex = filter.cursor ? 0 : offset;
    pagedSubmissions = allSubmissions.slice(startIndex, startIndex + limit);
    hasMore = startIndex + limit < total;
    if (pagedSubmissions.length > 0 && hasMore) {
      const last = pagedSubmissions[pagedSubmissions.length - 1];
      nextCursor = encodeCursor(last.submittedAt, last.submissionId);
    }
  }

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
      let userEmail = sub.userEmail || order?.userEmail || localUser?.email || undefined;

      if (!userEmail) {
        try {
          const subDocSnap = await getSubscriptionsCollection().doc(sub.userId).get();
          if (subDocSnap.exists && subDocSnap.data()?.userEmail) {
            userEmail = subDocSnap.data()!.userEmail;
          }
        } catch {
          // fallback ignore
        }
      }

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
    nextCursor,
    prevCursor: null,
    hasMore,
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

  const result = await db.runTransaction(async (transaction) => {
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

    // 4.5. Transactional Read: Prepare billing sync version counter
    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

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

    // Atomically increment billing sync version in the exact same transaction batch
    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'payment_approved',
      targetUserId: submission.userId,
      targetEntityId: submission.submissionId,
    });

    return {
      success: true,
      idempotent: false,
      submission: updatedSubmission,
      subscription: updatedSubscription,
    };
  });

  // Trigger Event B: Transactional Payment Approval Email
  if (!result.idempotent) {
    invalidateAdminStoresCache();
    invalidateAuditLogsCache();
    invalidateUserEntitlementCache(result.submission.userId);
    try {
      await bumpBillingSyncVersion({
        mutationType: 'payment_approved',
        targetUserId: result.submission.userId,
        targetEntityId: result.submission.submissionId,
      });
    } catch {
      // ignore
    }
    try {
      await sendPaymentApprovalNotification({
        userId: result.submission.userId,
        orderId: result.submission.orderId,
        submissionId: result.submission.submissionId,
        userEmail: result.subscription.userEmail || result.submission.userEmail,
        amountInr: 499,
        currentPeriodStart: result.subscription.currentPeriodStart,
        currentPeriodEnd: result.subscription.currentPeriodEnd,
      });
    } catch (emailErr) {
      console.error('[AdminBilling] Approval email failed to dispatch:', emailErr);
    }
  }

  return result;
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

  const result = await db.runTransaction(async (transaction) => {
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

    // 2. All Reads: Read UTR reservation document and sync version BEFORE any writes
    const reservationRef = reservationsCol.doc(submission.utrNumber);
    const reservationSnap = await transaction.get(reservationRef);
    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

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

    // Atomically increment billing sync version in the exact same transaction batch
    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'payment_rejected',
      targetUserId: submission.userId,
      targetEntityId: submission.submissionId,
    });

    return {
      success: true,
      idempotent: false,
      submission: updatedSubmission,
    };
  });

  // Trigger Event C: Transactional Payment Rejection Email
  if (!result.idempotent) {
    invalidateAdminStoresCache();
    invalidateAuditLogsCache();
    invalidateUserEntitlementCache(result.submission.userId);
    try {
      await bumpBillingSyncVersion({
        mutationType: 'payment_rejected',
        targetUserId: result.submission.userId,
        targetEntityId: result.submission.submissionId,
      });
    } catch {
      // ignore
    }
    try {
      await sendPaymentRejectionNotification({
        userId: result.submission.userId,
        orderId: result.submission.orderId,
        submissionId: result.submission.submissionId,
        userEmail: result.submission.userEmail,
        maskedUtr: result.submission.utrNumber,
        rejectionReason: result.submission.decisionReason || trimmedReason,
        submittedAt: result.submission.submittedAt,
      });
    } catch (emailErr) {
      console.error('[AdminBilling] Rejection email failed to dispatch:', emailErr);
    }
  }

  return result;
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

  const res = await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    const existingSub = subSnap.exists ? (subSnap.data() as SubscriptionDocument) : null;
    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

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
      metadata: {
        ...(existingSub?.metadata || {}),
        revoked: false,
        grantReason: trimmedReason,
      },
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

    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'admin_grant',
      targetUserId,
      targetEntityId: newSub.id,
    });

    return newSub;
  });

  invalidateAdminStoresCache();
  invalidateAuditLogsCache();
  invalidateUserEntitlementCache(targetUserId);
  try {
    await bumpBillingSyncVersion({
      mutationType: 'admin_grant',
      targetUserId,
      targetEntityId: res.id,
    });
  } catch {
    // ignore
  }
  return res;
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

  const res = await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`Cannot extend: No subscription found for user "${targetUserId}". Use manual grant instead.`);
    }

    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

    const existingSub = subSnap.data() as SubscriptionDocument;
    if (existingSub.metadata?.revoked === true) {
      throw new Error(
        `Cannot extend permanently revoked subscription for user "${targetUserId}". Use an explicit Premium grant if restoration is authorized.`
      );
    }

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

    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'subscription_extended',
      targetUserId,
      targetEntityId: existingSub.id,
    });

    return updatedSub;
  });

  invalidateAdminStoresCache();
  invalidateAuditLogsCache();
  invalidateUserEntitlementCache(targetUserId);
  try {
    await bumpBillingSyncVersion({
      mutationType: 'subscription_extension',
      targetUserId,
      targetEntityId: res.id,
    });
  } catch {
    // ignore
  }
  return res;
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

  const res = await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

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
        suspendedBy: adminEmail,
        suspendedByUserId: adminUserId,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Use a unique event ID so rapid repeated lifecycle changes retain every audit entry.
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_suspend_${crypto.randomBytes(12).toString('hex')}`;
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

    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'subscription_suspended',
      targetUserId,
      targetEntityId: existingSub.id,
    });

    return updatedSub;
  });

  invalidateAdminStoresCache();
  invalidateAuditLogsCache();
  invalidateUserEntitlementCache(targetUserId);
  try {
    await bumpBillingSyncVersion({
      mutationType: 'subscription_suspended',
      targetUserId,
      targetEntityId: res.id,
    });
  } catch {
    // ignore
  }
  return res;
}

/**
 * Admin Reinstate Subscription:
 * Restores a suspended (halted) or reversibly terminated subscription to 'active' status.
 * PRESERVES the existing period end without automatically granting an extra 30 days.
 * An optional extendDays can be provided if an extension is explicitly authorized.
 * Strict protection: CANNOT reinstate a permanently revoked or cancelled subscription.
 * Expired terminations (original period already lapsed) CANNOT be ordinarily reinstated.
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

  const res = await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

    const existingSub = subSnap.data() as SubscriptionDocument;

    // Safety Invariant: Permanently revoked subscriptions cannot be restored via generic reinstatement
    if (existingSub.status === 'cancelled' || existingSub.metadata?.revoked === true) {
      throw new Error(
        `Cannot reinstate revoked subscription for user "${targetUserId}". Permanently revoked or cancelled subscriptions require an explicit manual grant.`
      );
    }

    // Idempotency check: already active and no extension requested
    if (existingSub.status === 'active' && (!extendDays || extendDays <= 0)) {
      return existingSub;
    }

    // Accept both 'halted' (suspended) and 'terminated' statuses for reinstatement
    if (existingSub.status !== 'halted' && existingSub.status !== 'terminated') {
      throw new Error(
        `Cannot reinstate subscription in status "${existingSub.status}". Only suspended or terminated subscriptions can be reinstated.`
      );
    }

    // If the original period has expired, reinstatement via this route is not permitted.
    // Administrator must use manual grant or extend instead.
    const now = Date.now();
    const periodEndMs = existingSub.currentPeriodEnd ? new Date(existingSub.currentPeriodEnd).getTime() : 0;
    if (!isNaN(periodEndMs) && periodEndMs <= now && (!extendDays || extendDays <= 0)) {
      throw new Error(
        `Cannot reinstate: the original subscription period expired on ${new Date(existingSub.currentPeriodEnd).toLocaleDateString('en-IN')}. ` +
        `Use 'Grant Premium' or 'Extend Subscription' to restore access with new days.`
      );
    }

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
        reinstatedBy: adminEmail,
        reinstatedByUserId: adminUserId,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Use a unique event ID so rapid repeated lifecycle changes retain every audit entry.
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_reinstate_${crypto.randomBytes(12).toString('hex')}`;
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

    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'subscription_reinstated',
      targetUserId,
      targetEntityId: existingSub.id,
    });

    return updatedSub;
  });

  invalidateAdminStoresCache();
  invalidateAuditLogsCache();
  invalidateUserEntitlementCache(targetUserId);
  try {
    await bumpBillingSyncVersion({
      mutationType: 'subscription_reinstated',
      targetUserId,
      targetEntityId: res.id,
    });
  } catch {
    // ignore
  }
  return res;
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

  const res = await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

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
        revokedBy: adminEmail,
        revokedByUserId: adminUserId,
        preRevocationPeriodEnd: existingSub.currentPeriodEnd,
        preRevocationStatus: existingSub.status,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Use a unique event ID so rapid repeated lifecycle changes retain every audit entry.
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_permanent_revoke_${crypto.randomBytes(12).toString('hex')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'subscription_permanently_revoked',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: existingSub.id,
      previousState: { status: existingSub.status, currentPeriodEnd: existingSub.currentPeriodEnd },
      newState: { status: 'cancelled', currentPeriodEnd: nowIso, revoked: true },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'subscription_permanently_revoked',
      targetUserId,
      targetEntityId: existingSub.id,
    });

    return updatedSub;
  });

  invalidateAdminStoresCache();
  invalidateAuditLogsCache();
  invalidateUserEntitlementCache(targetUserId);
  try {
    await bumpBillingSyncVersion({
      mutationType: 'subscription_permanently_revoked',
      targetUserId,
      targetEntityId: res.id,
    });
  } catch {
    // ignore
  }
  return res;
}

/**
 * Admin Terminate Subscription (Reversible):
 * Sets status to 'terminated' — immediately disabling Premium access while preserving
 * the original subscription document, payment history, currentPeriodEnd, and UTR records.
 * Unlike permanent revocation, termination can be reversed by an administrator via reinstatement,
 * provided the original subscription period has not expired.
 *
 * Invariants:
 * - status → 'terminated'
 * - currentPeriodEnd is PRESERVED (not zeroed like revocation)
 * - cancelAtPeriodEnd → false
 * - metadata.terminatedAt, terminationReason, preTerminationStatus, preTerminationPeriodEnd recorded
 * - Audit event 'subscription_terminated' appended immutably
 * - Billing sync version incremented atomically
 * - Cannot terminate an already permanently revoked subscription
 */
export async function adminTerminateSubscriptionInTransaction(params: {
  targetUserId: string;
  adminEmail: string;
  adminUserId: string;
  reason: string;
}): Promise<SubscriptionDocument> {
  const { targetUserId, adminEmail, adminUserId, reason } = params;
  if (!targetUserId) throw new Error('targetUserId is required.');
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) throw new MandatoryReasonMissingError('Subscription Termination');

  const db = getFirestoreDb();
  const subscriptionsCol = getSubscriptionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  const res = await db.runTransaction(async (transaction) => {
    const subRef = subscriptionsCol.doc(targetUserId);
    const subSnap = await transaction.get(subRef);
    if (!subSnap.exists) {
      throw new Error(`No subscription record found for user "${targetUserId}".`);
    }

    const syncCtx = await readBillingSyncVersionInTransaction(transaction);
    const existingSub = subSnap.data() as SubscriptionDocument;

    // Historical cancellations and permanent revocations are never reinterpreted as reversible termination.
    if (existingSub.status === 'cancelled') {
      throw new Error(
        existingSub.metadata?.revoked === true
          ? `Cannot terminate: subscription for user "${targetUserId}" has already been permanently revoked. This action is irreversible.`
          : `Cannot terminate: subscription for user "${targetUserId}" is already cancelled. Historical cancellation is not reversible termination.`
      );
    }

    // Idempotency: already terminated
    if (existingSub.status === 'terminated') {
      return existingSub;
    }

    if (existingSub.status !== 'active' && existingSub.status !== 'halted') {
      throw new Error(
        `Cannot terminate subscription in status "${existingSub.status}". Only active or suspended subscriptions can be terminated.`
      );
    }

    const nowIso = new Date().toISOString();

    // Preserve original currentPeriodEnd so reinstatement knows the valid window
    const updatedSub: SubscriptionDocument = {
      ...existingSub,
      status: 'terminated',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: existingSub.currentPeriodEnd, // PRESERVED
      updatedAt: nowIso,
      lastUpdatedFrom: 'admin_manual',
      metadata: {
        ...(existingSub.metadata || {}),
        terminatedAt: nowIso,
        terminationReason: trimmedReason,
        terminatedBy: adminEmail,
        terminatedByUserId: adminUserId,
        preTerminationPeriodEnd: existingSub.currentPeriodEnd,
        preTerminationStatus: existingSub.status,
      },
    };

    transaction.set(subRef, updatedSub, { merge: true });

    // Append immutable audit log
    const resolvedUserEmail = existingSub.userEmail || getUserById(targetUserId)?.email;
    const auditId = `audit_terminate_${crypto.randomBytes(12).toString('hex')}`;
    const auditRef = auditLogsCol.doc(auditId);
    const auditEntry: AdminAuditLogDocument = {
      id: auditId,
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'subscription_terminated',
      targetUserId,
      ...(resolvedUserEmail ? { targetUserEmail: resolvedUserEmail } : {}),
      targetEntityId: existingSub.id,
      previousState: { status: existingSub.status, currentPeriodEnd: existingSub.currentPeriodEnd },
      newState: {
        status: 'terminated',
        currentPeriodEnd: existingSub.currentPeriodEnd,
        preTerminationPeriodEnd: existingSub.currentPeriodEnd,
      },
      reason: trimmedReason,
      timestamp: nowIso,
    };
    transaction.set(auditRef, auditEntry);

    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'subscription_terminated',
      targetUserId,
      targetEntityId: existingSub.id,
    });

    return updatedSub;
  });

  invalidateAdminStoresCache();
  invalidateAuditLogsCache();
  invalidateUserEntitlementCache(targetUserId);
  try {
    await bumpBillingSyncVersion({
      mutationType: 'subscription_terminated',
      targetUserId,
      targetEntityId: res.id,
    });
  } catch {
    // ignore
  }
  return res;
}

// ============================================================================
// User 360° Profile Dossier Query
// ============================================================================

export async function getUser360Profile(userIdOrEmail: string): Promise<User360Dossier> {
  const normalized = (userIdOrEmail || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('User ID or email is required to retrieve User 360 profile.');
  }

  // 1. Resolve canonical user record
  let user = getUserById(userIdOrEmail);
  if (!user) {
    const all = getAllUsers();
    user = all.find(
      (u) =>
        u.id.toLowerCase() === normalized ||
        u.email?.toLowerCase() === normalized
    ) || null;
  }

  const resolvedUserId = user?.id || userIdOrEmail;
  const resolvedEmail = user?.email || (userIdOrEmail.includes('@') ? userIdOrEmail : null);

  // 2. Concurrently fetch subscription, orders, submissions, and audit logs for this user (Phase 2B.5 Parallelism)
  const subscriptionsCol = getSubscriptionsCollection();
  const ordersCol = getOrdersCollection();
  const submissionsCol = getSubmissionsCollection();
  const auditLogsCol = getAuditLogsCollection();

  const [subSnap, ordersSnap, submissionsSnap, auditSnap] = await Promise.all([
    subscriptionsCol.doc(resolvedUserId).get().catch(() => null),
    ordersCol.where('userId', '==', resolvedUserId).get(),
    submissionsCol.where('userId', '==', resolvedUserId).get(),
    auditLogsCol.where('targetUserId', '==', resolvedUserId).get(),
  ]);

  let subscriptionDoc: SubscriptionDocument | null = null;
  if (subSnap && subSnap.exists) {
    subscriptionDoc = subSnap.data() || null;
  }

  // Evaluate authoritative entitlement
  const entitlement = evaluateSubscriptionEntitlement(resolvedUserId, subscriptionDoc);
  const auditLogs: AdminAuditLogDocument[] = auditSnap?.docs.map((d) => d.data()) || [];
  auditLogs.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  const latestTermination = auditLogs.find((log) => log.action === 'subscription_terminated');

  let remainingDays = 0;
  if (subscriptionDoc?.currentPeriodEnd) {
    const endMs = new Date(subscriptionDoc.currentPeriodEnd).getTime();
    if (!isNaN(endMs)) {
      remainingDays = Math.max(0, Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000)));
    }
  }

  let subSource: 'payment_backed' | 'manual_grant' | 'unknown' = 'unknown';
  if (subscriptionDoc) {
    if (
      subscriptionDoc.lastUpdatedFrom === 'manual_upi' ||
      subscriptionDoc.provider === 'manual_upi' ||
      subscriptionDoc.provider === 'razorpay' ||
      !!subscriptionDoc.paymentReference
    ) {
      subSource = 'payment_backed';
    } else if (
      subscriptionDoc.lastUpdatedFrom === 'admin_manual' ||
      subscriptionDoc.lastUpdatedFrom === 'admin_grant' ||
      subscriptionDoc.provider === 'manual' ||
      !subscriptionDoc.paymentReference
    ) {
      subSource = 'manual_grant';
    }
  }

  const userSubscription: User360Subscription | null = subscriptionDoc
    ? {
        status: subscriptionDoc.status,
        planId: subscriptionDoc.planId,
        source: subSource,
        updateOrigin: subscriptionDoc.lastUpdatedFrom,
        currentPeriodStart: subscriptionDoc.currentPeriodStart || null,
        currentPeriodEnd:
          (subscriptionDoc.metadata?.revoked === true &&
            typeof subscriptionDoc.metadata.preRevocationPeriodEnd === 'string'
            ? subscriptionDoc.metadata.preRevocationPeriodEnd
            : subscriptionDoc.currentPeriodEnd) || null,
        isPremium: entitlement.isPremium,
        isEntitled: entitlement.isPremium,
        entitlementStatus:
          subscriptionDoc.status === 'halted'
            ? 'suspended'
            : subscriptionDoc.status === 'terminated'
              ? 'terminated'
              : subscriptionDoc.status === 'cancelled'
                ? (subscriptionDoc.metadata?.revoked === true ? 'permanently revoked' : 'cancelled')
                : entitlement.status,
        remainingDays,
        gracePeriod: entitlement.status === 'cancelled_grace',
        notes: typeof subscriptionDoc.metadata?.grantReason === 'string'
          ? (subscriptionDoc.metadata.grantReason as string)
          : undefined,
        terminatedAt: typeof subscriptionDoc.metadata?.terminatedAt === 'string'
          ? subscriptionDoc.metadata.terminatedAt
          : latestTermination?.timestamp,
        terminationReason: typeof subscriptionDoc.metadata?.terminationReason === 'string'
          ? subscriptionDoc.metadata.terminationReason
          : latestTermination?.reason,
        terminatedBy: typeof subscriptionDoc.metadata?.terminatedBy === 'string'
          ? subscriptionDoc.metadata.terminatedBy
          : latestTermination?.actorEmail,
      }
    : null;

  // Process Orders
  const orders: PaymentOrderDocument[] = ordersSnap.docs.map((d) => d.data());
  orders.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  // Process Submissions
  const rawSubmissions: PaymentSubmissionDocument[] = submissionsSnap.docs.map((d) => d.data());
  const submissionsWithOrders: SubmissionWithOrder[] = rawSubmissions.map((sub) => {
    const matchingOrder = orders.find((o) => o.orderId === sub.orderId) || null;
    return {
      ...sub,
      userEmail: sub.userEmail || resolvedEmail || undefined,
      order: matchingOrder,
    };
  });
  submissionsWithOrders.sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1));

  // Process Audit Logs
  // 6. Build Chronological Timeline Events
  const timeline: User360TimelineEvent[] = [];

  for (const ord of orders) {
    timeline.push({
      id: `evt_ord_${ord.orderId}`,
      timestamp: ord.createdAt,
      category: 'order',
      action: 'order_created',
      summary: `Initiated payment order ${ord.orderId} (₹${ord.amountInr} ${ord.currency})`,
      actor: resolvedEmail || resolvedUserId,
      badgeColor: 'indigo',
      details: {
        orderId: ord.orderId,
        amount: ord.amountInr,
        upiId: ord.upiId,
        expiresAt: ord.expiresAt,
      },
    });
  }

  for (const sub of rawSubmissions) {
    const utrStr = sub.utrNumber || (sub as unknown as { utr?: string }).utr || 'N/A';
    timeline.push({
      id: `evt_sub_${sub.submissionId}`,
      timestamp: sub.submittedAt,
      category: 'submission',
      action: 'payment_submitted',
      summary: `Submitted UPI claim with UTR ${utrStr} (₹${sub.declaredAmount})`,
      actor: sub.userEmail || resolvedEmail || resolvedUserId,
      badgeColor: 'amber',
      details: {
        submissionId: sub.submissionId,
        utr: utrStr,
        declaredAmount: sub.declaredAmount,
        paymentDate: sub.paymentDate || 'Not recorded',
        status: sub.status,
      },
    });

    if (sub.reviewedAt && sub.reviewedBy) {
      const isApp = sub.status === 'approved';
      timeline.push({
        id: `evt_dec_${sub.submissionId}`,
        timestamp: sub.reviewedAt,
        category: isApp ? 'approval' : 'rejection',
        action: isApp ? 'payment_approved' : 'payment_rejected',
        summary: isApp
          ? `Verified & Approved ₹${sub.declaredAmount} (UTR: ${utrStr})`
          : `Rejected payment claim (Reason: ${sub.decisionReason || 'Unverified'})`,
        actor: sub.reviewedBy,
        badgeColor: isApp ? 'emerald' : 'rose',
        details: {
          submissionId: sub.submissionId,
          utr: utrStr,
          reviewedBy: sub.reviewedBy,
          decisionReason: sub.decisionReason,
          verificationNotes: sub.verificationNotes,
        },
      });
    }
  }

  for (const log of auditLogs) {
    if (log.action !== 'payment_approved' && log.action !== 'payment_rejected') {
      timeline.push({
        id: `evt_audit_${log.id}`,
        timestamp: log.timestamp,
        category: 'admin_action',
        action: log.action,
        summary: `Admin action: ${log.action.replace(/_/g, ' ')}${log.reason ? ` — "${log.reason}"` : ''}`,
        actor: log.actorEmail,
        badgeColor:
          log.action.includes('grant') || log.action.includes('extend') || log.action.includes('reinstate')
            ? 'emerald'
            :             log.action.includes('suspend') || log.action.includes('revoke') || log.action.includes('terminat')
              ? 'rose'
              : 'indigo',
        details: {
          action: log.action,
          reason: log.reason,
          actorEmail: log.actorEmail,
          previousState: log.previousState,
          newState: log.newState,
        },
      });
    }
  }

  // Sort timeline newest first with deterministic tie-breaking
  timeline.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (isNaN(timeA) && isNaN(timeB)) return a.id.localeCompare(b.id);
    if (isNaN(timeA)) return 1;
    if (isNaN(timeB)) return -1;
    if (timeB !== timeA) return timeB - timeA;
    return a.id.localeCompare(b.id);
  });

  const identity: User360Identity = {
    userId: resolvedUserId,
    email: resolvedEmail,
    name: user?.name || null,
    provider: user?.provider || null,
    createdAt: user?.createdAt ? new Date(user.createdAt).toISOString() : null,
    isEmailVerified: user?.provider === 'google',
    status: 'active',
  };

  return {
    identity,
    subscription: userSubscription,
    orders,
    submissions: submissionsWithOrders,
    auditLogs,
    timeline,
  };
}

// ============================================================================
// Consolidated Payment Ledger Query
// ============================================================================

export async function getConsolidatedPaymentLedger(
  params?: PaymentLedgerFilter,
  options?: { bypassCache?: boolean; forceCache?: boolean }
): Promise<{
  records: PaymentLedgerItem[];
  summary: PaymentLedgerSummary;
  total: number;
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore?: boolean;
}> {
  const now = Date.now();
  const isTestEnv = process.env.NODE_ENV === 'test' && !options?.forceCache;
  const currentVersion = await getBillingSyncVersion();
  let items: PaymentLedgerItem[] = [];
  let summary!: PaymentLedgerSummary;

  if (
    !isTestEnv &&
    !options?.bypassCache &&
    cachedLedgerSnapshot &&
    cachedLedgerSnapshot.version === currentVersion &&
    now - cachedLedgerSnapshot.timestamp < ADMIN_CACHE_TTL_MS
  ) {
    items = [...cachedLedgerSnapshot.items];
    summary = cachedLedgerSnapshot.summary;
  } else {
    const ordersCol = getOrdersCollection();
    const submissionsCol = getSubmissionsCollection();
    const subscriptionsCol = getSubscriptionsCollection();

    const [ordersSnap, submissionsSnap, subscriptionsSnap] = await Promise.all([
      ordersCol.get(),
      submissionsCol.get(),
      subscriptionsCol.get(),
    ]);

    const allOrders: PaymentOrderDocument[] = ordersSnap.docs.map((d) => d.data());
    const allSubmissions: PaymentSubmissionDocument[] = submissionsSnap.docs.map((d) => d.data());
    const allSubscriptions: SubscriptionDocument[] = subscriptionsSnap.docs.map((d) => d.data());

    items = [];

    const orderMap = new Map<string, PaymentOrderDocument>();
    for (const ord of allOrders) {
      orderMap.set(ord.orderId, ord);
    }

  // Pre-calculate UTR frequency to surface collision / duplicate claims
  const utrOccurrences = new Map<string, number>();
  for (const sub of allSubmissions) {
    const rawUtr = (sub.utrNumber || (sub as unknown as { utr?: string }).utr || '').trim().toUpperCase();
    if (rawUtr) {
      utrOccurrences.set(rawUtr, (utrOccurrences.get(rawUtr) || 0) + 1);
    }
  }

  // 1. Process submissions
  const handledOrderIds = new Set<string>();

  for (const sub of allSubmissions) {
    handledOrderIds.add(sub.orderId);
    const ord = orderMap.get(sub.orderId);
    const isOrphan = !ord;
    const localUser = getUserById(sub.userId);
    const userEmail = sub.userEmail || ord?.userEmail || localUser?.email || undefined;

    let status: 'verified' | 'pending' | 'rejected' = 'pending';
    if (sub.status === 'approved') status = 'verified';
    else if (sub.status === 'rejected') status = 'rejected';

    const utrStr = sub.utrNumber || (sub as unknown as { utr?: string }).utr;
    const normUtr = (utrStr || '').trim().toUpperCase();
    const isDuplicateUtr = Boolean(normUtr && (utrOccurrences.get(normUtr) || 0) > 1);

    items.push({
      id: sub.submissionId,
      orderId: sub.orderId,
      submissionId: sub.submissionId,
      userId: sub.userId,
      userEmail,
      amount: ord?.amountInr || sub.declaredAmount || 499,
      currency: ord?.currency || 'INR',
      utr: utrStr,
      status,
      orderCreatedAt: ord?.createdAt || sub.submittedAt,
      paymentDate: sub.paymentDate || undefined,
      submittedAt: sub.submittedAt,
      reviewedAt: sub.reviewedAt,
      reviewedBy: sub.reviewedBy,
      decisionReason: sub.decisionReason,
      verificationNotes: sub.verificationNotes,
      upiIdSnapshot: ord?.upiId,
      isOrphan,
      isDuplicateUtr,
      source: 'payment',
    });
  }

  // 2. Process orders without submissions
  for (const ord of allOrders) {
    if (!handledOrderIds.has(ord.orderId)) {
      const localUser = getUserById(ord.userId);
      const userEmail = ord.userEmail || localUser?.email || undefined;
      const isExpired = new Date(ord.expiresAt).getTime() < now;

      items.push({
        id: ord.orderId,
        orderId: ord.orderId,
        userId: ord.userId,
        userEmail,
        amount: ord.amountInr || 499,
        currency: ord.currency || 'INR',
        status: isExpired ? 'expired' : 'unsubmitted',
        orderCreatedAt: ord.createdAt,
        upiIdSnapshot: ord.upiId,
        source: 'payment',
      });
    }
  }

  // Financial Summary calculations (Strict Deduplication & Metric Separation)
  let verifiedPaymentAmountInr = 0;
  let verifiedPaymentsCount = 0;
  let pendingClaimedAmountInr = 0;
  let pendingSubmissionsCount = 0;
  let rejectedClaimedAmountInr = 0;
  let rejectedSubmissionsCount = 0;
  let unsubmittedOrdersCount = 0;
  let expiredOrdersCount = 0;
  let unresolvedReviewCount = 0;

  // Track distinct approved orders to prevent double-counting across retried or duplicated records
  const verifiedOrderIds = new Set<string>();

  for (const item of items) {
    if (item.isOrphan || item.isDuplicateUtr) {
      unresolvedReviewCount++;
    }

    if (item.status === 'verified') {
      if (!item.isOrphan && !verifiedOrderIds.has(item.orderId)) {
        verifiedOrderIds.add(item.orderId);
        verifiedPaymentsCount++;
        verifiedPaymentAmountInr += (item.amount || 499);
      }
    } else if (item.status === 'pending') {
      pendingSubmissionsCount++;
      pendingClaimedAmountInr += item.amount;
    } else if (item.status === 'rejected') {
      rejectedSubmissionsCount++;
      rejectedClaimedAmountInr += item.amount;
    } else if (item.status === 'unsubmitted') {
      unsubmittedOrdersCount++;
    } else if (item.status === 'expired') {
      expiredOrdersCount++;
    }
  }

  // Count manual grants (strictly excluded from payment ledger revenue)
  let manualGrantsExcludedCount = 0;
  for (const sub of allSubscriptions) {
    const isPayment =
      sub.lastUpdatedFrom === 'manual_upi' ||
      sub.provider === 'manual_upi' ||
      sub.provider === 'razorpay' ||
      !!sub.paymentReference;
    if (sub.status === 'active' && !isPayment) {
      manualGrantsExcludedCount++;
    }
  }

  summary = {
    verifiedPaymentAmountInr,
    verifiedRevenueInr: verifiedPaymentAmountInr,
    pendingClaimedAmountInr,
    pendingClaimedRevenueInr: pendingClaimedAmountInr,
    rejectedClaimedAmountInr,
    totalOrdersCount: allOrders.length,
    verifiedPaymentsCount,
    pendingSubmissionsCount,
    rejectedSubmissionsCount,
    unsubmittedOrdersCount,
    expiredOrdersCount,
    manualGrantsExcludedCount,
    unresolvedReviewCount,
    refundPolicyNote:
      'Refunds and payment reversals are not automated through this interface and must be audited manually against bank statements.',
  };

    cachedLedgerSnapshot = { items: [...items], summary, timestamp: now, version: currentVersion };
  }

  // Filter items
  let filtered = items;

  if (params?.status && params.status !== 'all') {
    filtered = filtered.filter((i) => i.status === params.status);
  }

  if (params?.query) {
    const q = params.query.trim().toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.orderId.toLowerCase().includes(q) ||
        i.userId.toLowerCase().includes(q) ||
        (i.utr && i.utr.toLowerCase().includes(q)) ||
        (i.userEmail && i.userEmail.toLowerCase().includes(q))
    );
  }

  if (params?.dateFrom) {
    const fromTime = new Date(params.dateFrom).getTime();
    if (!isNaN(fromTime)) {
      filtered = filtered.filter((i) => new Date(i.orderCreatedAt).getTime() >= fromTime);
    }
  }

  if (params?.dateTo) {
    const toTime = new Date(params.dateTo).getTime();
    if (!isNaN(toTime)) {
      filtered = filtered.filter((i) => new Date(i.orderCreatedAt).getTime() <= toTime + 86400000);
    }
  }

  // Sort descending by orderCreatedAt or submittedAt
  filtered.sort((a, b) => {
    const timeA = new Date(a.submittedAt || a.orderCreatedAt).getTime();
    const timeB = new Date(b.submittedAt || b.orderCreatedAt).getTime();
    return timeB - timeA;
  });

  const total = filtered.length;
  const offset = params?.offset || 0;
  const limit = Math.min(Math.max(params?.limit || 5, 1), 200);

  let startIndex = offset;
  if (params?.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const foundIdx = filtered.findIndex((i) => i.id === decoded.secondary || i.orderId === decoded.secondary);
      if (foundIdx !== -1) {
        startIndex = foundIdx + 1;
      }
    }
  }

  const pagedRecords = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < total;
  const nextCursor =
    pagedRecords.length > 0 && hasMore
      ? encodeCursor(
          pagedRecords[pagedRecords.length - 1].submittedAt ||
            pagedRecords[pagedRecords.length - 1].orderCreatedAt,
          pagedRecords[pagedRecords.length - 1].id
        )
      : null;

  return {
    records: pagedRecords,
    summary,
    total,
    nextCursor,
    prevCursor: null,
    hasMore,
  };
}

// ============================================================================
// Subscriptions & Audit Queries
// ============================================================================

export async function getAdminSubscriptions(
  params?: {
    limit?: number;
    offset?: number;
    cursor?: string;
    userId?: string;
    query?: string;
    entitlementStatus?: 'all' | 'active' | 'free' | 'expired' | 'suspended' | 'terminated' | 'cancelled';
    source?: 'all' | 'payment_backed' | 'manual_grant';
    expiringSoon?: boolean;
    sortBy?: 'currentPeriodEnd' | 'userId' | 'status' | 'updatedAt';
    sortDir?: 'asc' | 'desc';
  },
  options?: { bypassCache?: boolean; forceCache?: boolean }
): Promise<SubscriptionDocument[] & { total: number; nextCursor?: string | null; hasMore?: boolean }> {
  const now = Date.now();
  const isTestEnv = process.env.NODE_ENV === 'test' && !options?.forceCache;
  const currentVersion = await getBillingSyncVersion();
  let enriched: SubscriptionDocument[];

  if (
    !isTestEnv &&
    !options?.bypassCache &&
    cachedSubscriptionsSnapshot &&
    cachedSubscriptionsSnapshot.version === currentVersion &&
    now - cachedSubscriptionsSnapshot.timestamp < ADMIN_CACHE_TTL_MS
  ) {
    enriched = [...cachedSubscriptionsSnapshot.docs];
  } else {
    const subscriptionsCol = getSubscriptionsCollection();
    const snap = await subscriptionsCol.get();
    const rawDocs: SubscriptionDocument[] = snap.docs.map((d) => d.data());

    enriched = rawDocs.map((sub) => {
      const localUser = getUserById(sub.userId);
      const userEmail = sub.userEmail || localUser?.email || undefined;
      return {
        ...sub,
        userEmail,
      };
    });

    cachedSubscriptionsSnapshot = { docs: [...enriched], timestamp: now, version: currentVersion };
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  let subs = enriched;

  const filterTerm = (params?.query || params?.userId || '').trim().toLowerCase();
  if (filterTerm) {
    subs = subs.filter(
      (s) =>
        s.userId.toLowerCase().includes(filterTerm) ||
        (s.userEmail && s.userEmail.toLowerCase().includes(filterTerm))
    );
  }

  if (params?.entitlementStatus && params.entitlementStatus !== 'all') {
    subs = subs.filter((s) => {
      const ent = evaluateSubscriptionEntitlement(s.userId, s);
      if (params.entitlementStatus === 'active') return ent.isPremium && ent.status === 'active';
      if (params.entitlementStatus === 'free') return !ent.isPremium && ent.status === 'free';
      if (params.entitlementStatus === 'expired') return ent.status === 'expired';
      if (params.entitlementStatus === 'suspended') return s.status === 'halted';
      if (params.entitlementStatus === 'terminated') return s.status === 'terminated';
      if (params.entitlementStatus === 'cancelled') return s.status === 'cancelled';
      return true;
    });
  }

  if (params?.source && params.source !== 'all') {
    subs = subs.filter((s) => {
      const isPayment =
        s.lastUpdatedFrom === 'manual_upi' || s.provider === 'manual_upi' || s.provider === 'razorpay';
      if (params.source === 'payment_backed') return isPayment;
      if (params.source === 'manual_grant') return !isPayment;
      return true;
    });
  }

  if (params?.expiringSoon) {
    subs = subs.filter((s) => {
      if (s.status !== 'active') return false;
      const endMs = new Date(s.currentPeriodEnd).getTime();
      return !isNaN(endMs) && endMs >= now && endMs <= now + sevenDaysMs;
    });
  }

  // Sorting
  const sortBy = params?.sortBy || 'updatedAt';
  const sortDir = params?.sortDir === 'asc' ? 1 : -1;

  subs.sort((a, b) => {
    if (sortBy === 'currentPeriodEnd') {
      const timeA = new Date(a.currentPeriodEnd).getTime() || 0;
      const timeB = new Date(b.currentPeriodEnd).getTime() || 0;
      return (timeA - timeB) * sortDir;
    }
    if (sortBy === 'userId') {
      return a.userId.localeCompare(b.userId) * sortDir;
    }
    if (sortBy === 'status') {
      return a.status.localeCompare(b.status) * sortDir;
    }
    // Default updatedAt
    const timeA = new Date(a.updatedAt).getTime() || 0;
    const timeB = new Date(b.updatedAt).getTime() || 0;
    return (timeA - timeB) * sortDir;
  });

  const total = subs.length;
  const offset = params?.offset || 0;
  const limit = Math.min(Math.max(params?.limit || 5, 1), 200);

  let startIndex = offset;
  if (params?.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const foundIdx = subs.findIndex(
        (s) => s.id === decoded.secondary || s.userId === decoded.secondary
      );
      if (foundIdx !== -1) {
        startIndex = foundIdx + 1;
      }
    }
  }

  const paged = subs.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < total;
  const nextCursor =
    paged.length > 0 && hasMore
      ? encodeCursor(paged[paged.length - 1].updatedAt, paged[paged.length - 1].id)
      : null;

  return Object.assign(paged, { total, nextCursor, hasMore });
}

export { recordAdminAuditLog, getAdminAuditLogs } from './audit.store';
