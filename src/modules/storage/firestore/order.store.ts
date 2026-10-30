import crypto from 'node:crypto';
import { getFirestoreDb } from './client';
import {
  getOrdersCollection,
  getSubmissionsCollection,
  PaymentOrderDocument,
  PaymentSubmissionDocument,
} from './collections';
import {
  normalizeUtr,
  isValidUtrFormat,
  UtrFormatError,
  reserveUtrInTransaction,
} from './utr-reservation';
import { getPaymentSettings } from './settings.store';
import { invalidateAdminStoresCache } from './admin-billing.store';
import {
  bumpBillingSyncVersion,
  readBillingSyncVersionInTransaction,
  writeBillingSyncVersionInTransaction,
} from './billing-sync.store';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';

// ============================================================================
// Business UPI Configuration
// ============================================================================

export interface BusinessUpiConfig {
  upiId: string;
  payeeName: string;
}

export function getBusinessUpiConfig(): BusinessUpiConfig {
  const upiId = (process.env.BUSINESS_UPI_ID || '').trim() || 'jobnexus@icici';
  const payeeName = (process.env.BUSINESS_UPI_NAME || '').trim() || 'JobNexus';
  return { upiId, payeeName };
}

// ============================================================================
// Typed Domain Errors
// ============================================================================

export class OrderNotFoundError extends Error {
  public readonly orderId: string;
  constructor(orderId: string) {
    super(`Payment order "${orderId}" was not found.`);
    this.name = 'OrderNotFoundError';
    this.orderId = orderId;
  }
}

export class OrderOwnershipError extends Error {
  public readonly orderId: string;
  constructor(orderId: string, message = `Access denied: you do not own order "${orderId}".`) {
    super(message);
    this.name = 'OrderOwnershipError';
    this.orderId = orderId;
  }
}

export class OrderExpiredError extends Error {
  public readonly orderId: string;
  public readonly expiresAt: string;
  constructor(orderId: string, expiresAt: string) {
    super(`Payment order "${orderId}" expired at ${expiresAt}. Please create a new order.`);
    this.name = 'OrderExpiredError';
    this.orderId = orderId;
    this.expiresAt = expiresAt;
  }
}

export class OrderAlreadySubmittedError extends Error {
  public readonly orderId: string;
  constructor(orderId: string) {
    super(`Payment order "${orderId}" already has a submitted payment reference.`);
    this.name = 'OrderAlreadySubmittedError';
    this.orderId = orderId;
  }
}

export class InvalidPaymentDateError extends Error {
  public readonly dateStr: string;
  constructor(dateStr: string) {
    super(`Invalid payment date "${dateStr}". Must be YYYY-MM-DD within the past 30 days.`);
    this.name = 'InvalidPaymentDateError';
    this.dateStr = dateStr;
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function isValidPaymentDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;

  const now = Date.now();
  const past30Days = now - 30 * 86400 * 1000;
  const future1Day = now + 86400 * 1000;
  return d.getTime() >= past30Days && d.getTime() <= future1Day;
}

// ============================================================================
// Order Operations
// ============================================================================

/**
 * Creates a server-controlled PaymentOrderDocument in Firestore.
 * Price, currency, and plan parameters are strictly enforced server-side.
 * Validity window is 24 hours.
 */
export async function createPaymentOrder(params: {
  userId: string;
  userEmail?: string;
  planId?: string;
}): Promise<PaymentOrderDocument> {
  const { userId, userEmail } = params;
  if (!userId) {
    throw new Error('userId is required to create a payment order.');
  }

  // Retrieve current active payment configuration snapshot
  const settings = await getPaymentSettings();
  const orderId = `ord_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const orderDoc: PaymentOrderDocument = {
    orderId,
    userId,
    ...(userEmail ? { userEmail: userEmail.trim().toLowerCase() } : {}),
    planId: PREMIUM_PLAN.id,
    amountInr: PREMIUM_PLAN.priceInr, // ₹499
    amountInPaise: PREMIUM_PLAN.amountInPaise, // 49900
    currency: 'INR',
    status: 'created',
    upiId: settings.upiId,
    payeeName: settings.payeeName,
    paymentDescription: settings.paymentDescription,
    configVersion: settings.version,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const ordersCol = getOrdersCollection();
  await ordersCol.doc(orderId).set(orderDoc);

  return orderDoc;
}

/**
 * Retrieves an order by its unique orderId.
 */
export async function getPaymentOrderById(orderId: string): Promise<PaymentOrderDocument | null> {
  if (!orderId) return null;
  const ordersCol = getOrdersCollection();
  const snap = await ordersCol.doc(orderId).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

/**
 * Looks up any active, unexpired, unsubmitted order for a given user.
 * Allows idempotent reuse of an active order across reloads.
 */
export async function getActiveOrderForUser(userId: string): Promise<PaymentOrderDocument | null> {
  if (!userId) return null;
  const ordersCol = getOrdersCollection();
  const snap = await ordersCol.where('userId', '==', userId).get();

  const nowIso = new Date().toISOString();
  const activeOrders = snap.docs
    .map((d) => d.data())
    .filter((o) => o.status === 'created' && o.expiresAt > nowIso)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return activeOrders[0] || null;
}

// ============================================================================
// Submission Operations
// ============================================================================

/**
 * Transactionally records a user's UPI payment submission.
 * - Enforces order ownership, order existence, and order expiry.
 * - Atomically reserves the UTR reference in upi_utr_reservations to prevent collisions.
 * - Creates a PaymentSubmissionDocument in upi_submissions with status 'pending_verification'.
 * - Sets the 12-hour SLA deadline.
 * - Updates the order status to 'submitted'.
 */
export async function createPaymentSubmission(params: {
  orderId: string;
  userId: string;
  userEmail?: string;
  utr: string;
  declaredAmount: number;
  paymentDate: string;
  receiptPath?: string;
  verificationNotes?: string;
}): Promise<PaymentSubmissionDocument> {
  const { orderId, userId, userEmail, utr, declaredAmount, paymentDate } = params;

  if (!orderId) throw new Error('orderId is required.');
  if (!userId) throw new Error('userId is required.');
  if (!utr) throw new Error('utr reference is required.');

  const normalizedUtr = normalizeUtr(utr);
  if (!isValidUtrFormat(normalizedUtr)) {
    throw new UtrFormatError(utr);
  }

  if (typeof declaredAmount !== 'number' || isNaN(declaredAmount) || declaredAmount <= 0) {
    throw new Error('declaredAmount must be a positive number.');
  }

  if (!isValidPaymentDate(paymentDate)) {
    throw new InvalidPaymentDateError(paymentDate);
  }

  const db = getFirestoreDb();

  const submissionDoc = await db.runTransaction(async (transaction) => {
    // 1. Fetch and validate order
    const orderRef = getOrdersCollection().doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new OrderNotFoundError(orderId);
    }

    const order = orderSnap.data() as PaymentOrderDocument;

    // 1.5. Transactional Read: Prepare billing sync version counter
    const syncCtx = await readBillingSyncVersionInTransaction(transaction);

    // 2. Enforce user ownership
    if (order.userId !== userId) {
      throw new OrderOwnershipError(orderId);
    }

    // 3. Enforce order expiration
    if (new Date(order.expiresAt).getTime() < Date.now()) {
      throw new OrderExpiredError(orderId, order.expiresAt);
    }

    // 4. Check if order was already submitted
    if (order.status === 'submitted') {
      throw new OrderAlreadySubmittedError(orderId);
    }

    // 5. Generate deterministic submission identity
    const submissionId = `subm_${crypto.randomBytes(8).toString('hex')}`;

    // 6. Transactionally reserve UTR in upi_utr_reservations (detects collisions O(1))
    await reserveUtrInTransaction(transaction, {
      utr: normalizedUtr,
      orderId: order.orderId,
      submissionId,
      userId,
    });

    // 7. Construct authoritative submission document with 12h SLA
    const now = new Date();
    const slaDeadlineAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
    const resolvedEmail = (userEmail || order.userEmail)?.trim().toLowerCase();

    const submissionDoc: PaymentSubmissionDocument = {
      submissionId,
      orderId: order.orderId,
      userId,
      ...(resolvedEmail ? { userEmail: resolvedEmail } : {}),
      utrNumber: normalizedUtr,
      declaredAmount,
      paymentDate,
      submittedAt: now.toISOString(),
      slaDeadlineAt: slaDeadlineAt.toISOString(),
      status: 'pending_verification',
      ...(params.receiptPath ? { receiptPath: params.receiptPath } : {}),
      ...(params.verificationNotes ? { verificationNotes: params.verificationNotes.trim() } : {}),
    };

    const submissionRef = getSubmissionsCollection().doc(submissionId);
    transaction.set(submissionRef, submissionDoc);

    // 8. Update order status to submitted
    transaction.update(orderRef, { status: 'submitted' });

    // 8.5. Transactional Write: Atomically increment billing sync version in the same batch
    writeBillingSyncVersionInTransaction(transaction, syncCtx, {
      mutationType: 'new_submission',
      targetUserId: userId,
      targetEntityId: submissionDoc.submissionId,
    });

    return submissionDoc;
  });

  try {
    invalidateAdminStoresCache();
    await bumpBillingSyncVersion({
      mutationType: 'new_submission',
      targetUserId: userId,
      targetEntityId: submissionDoc.submissionId,
    });
  } catch {
    // ignore
  }

  return submissionDoc;
}

/**
 * Retrieves a submission by its unique submissionId.
 */
export async function getPaymentSubmissionById(
  submissionId: string
): Promise<PaymentSubmissionDocument | null> {
  if (!submissionId) return null;
  const submissionsCol = getSubmissionsCollection();
  const snap = await submissionsCol.doc(submissionId).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

/**
 * Lists all submissions for a given user, ordered by submittedAt descending.
 */
export async function getSubmissionsByUserId(
  userId: string
): Promise<PaymentSubmissionDocument[]> {
  if (!userId) return [];
  const submissionsCol = getSubmissionsCollection();
  const snap = await submissionsCol.where('userId', '==', userId).get();

  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1));
}
