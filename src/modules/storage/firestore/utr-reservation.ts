import { Transaction, DocumentReference } from 'firebase-admin/firestore';
import {
  getUtrReservationsCollection,
  UtrReservationDocument,
} from './collections';

/**
 * UTR Normalization and Validation Engine
 */

const TRIVIAL_PATTERNS = new Set([
  '000000000000',
  '123456789012',
  '111111111111',
  '222222222222',
  '333333333333',
  '444444444444',
  '555555555555',
  '666666666666',
  '777777777777',
  '888888888888',
  '999999999999',
  'ABCDEFGHIJKL',
  'TESTTRANSACTION',
]);

/**
 * Cleans, sanitizes, and normalizes a user-submitted UPI UTR / Transaction Reference.
 * Strips common prefixes (UPI/, UTR:, REF:, TXN:), symbols, and whitespace.
 * Returns an authoritative uppercase string.
 */
export function normalizeUtr(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim().toUpperCase();

  // Strip common transaction prefixes
  cleaned = cleaned.replace(/^(UPI\/|UTR:|REF:|TXN:|ID:|NO:)\s*/i, '');
  // Remove whitespace, slashes, dashes, hash signs
  cleaned = cleaned.replace(/[\s\-_#/]/g, '');

  return cleaned;
}

/**
 * Validates whether a normalized transaction reference satisfies legitimate UPI criteria.
 * Supports standard 12-digit numeric bank UTRs as well as 10-22 character alphanumeric provider refs.
 */
export function isValidUtrFormat(utr: string): boolean {
  if (!utr) return false;
  const normalized = normalizeUtr(utr);

  // Must be between 10 and 22 alphanumeric characters
  if (!/^[A-Z0-9]{10,22}$/.test(normalized)) {
    return false;
  }

  // Reject trivial or test values
  if (TRIVIAL_PATTERNS.has(normalized)) {
    return false;
  }

  // Reject strings composed entirely of a single repeating character
  const firstChar = normalized[0];
  const allSame = normalized.split('').every((c) => c === firstChar);
  if (allSame) {
    return false;
  }

  return true;
}

// ============================================================================
// Typed Domain Errors
// ============================================================================

export class UtrFormatError extends Error {
  public readonly utr: string;

  constructor(utr: string) {
    super(`Invalid UPI transaction reference format: "${utr}".`);
    this.name = 'UtrFormatError';
    this.utr = utr;
  }
}

export type UtrConflictReason =
  | 'different_user'
  | 'different_operation'
  | 'already_consumed'
  | 'already_reserved';

export class UtrCollisionError extends Error {
  public readonly utr: string;
  public readonly existingOrderId?: string;
  public readonly conflictReason?: UtrConflictReason;

  constructor(utr: string, existingOrderId?: string, conflictReason?: UtrConflictReason) {
    super(`Transaction reference ${utr} has already been registered or verified.`);
    this.name = 'UtrCollisionError';
    this.utr = utr;
    this.existingOrderId = existingOrderId;
    this.conflictReason = conflictReason;
  }
}

export class UtrNotFoundError extends Error {
  public readonly utr: string;

  constructor(utr: string) {
    super(`Reservation document for UTR "${utr}" was not found.`);
    this.name = 'UtrNotFoundError';
    this.utr = utr;
  }
}

export class UtrStateError extends Error {
  public readonly utr: string;
  public readonly currentStatus: string;
  public readonly targetStatus: string;

  constructor(utr: string, currentStatus: string, targetStatus: string, message: string) {
    super(message);
    this.name = 'UtrStateError';
    this.utr = utr;
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

export class UtrOwnershipError extends Error {
  public readonly utr: string;

  constructor(utr: string, message: string) {
    super(message);
    this.name = 'UtrOwnershipError';
    this.utr = utr;
  }
}

/**
 * Returns a document reference for the deterministic UTR reservation document.
 */
export function getUtrReservationRef(utr: string): DocumentReference<UtrReservationDocument> {
  const normalized = normalizeUtr(utr);
  const col = getUtrReservationsCollection();
  return col.doc(normalized);
}

// ============================================================================
// Idempotency Evaluation Engine
// ============================================================================

export type UtrIdempotencyDecision =
  | { action: 'proceed_reserve' }
  | { action: 'idempotent_in_flight'; existing: UtrReservationDocument }
  | { action: 'collision_consumed'; existing: UtrReservationDocument }
  | {
      action: 'collision_conflict';
      reason: 'different_user' | 'different_operation';
      existing: UtrReservationDocument;
    };

/**
 * Pure evaluation function distinguishing retries from collisions.
 */
export function evaluateUtrIdempotency(
  existing: UtrReservationDocument | null | undefined,
  incoming: {
    utr: string;
    userId: string;
    orderId: string;
    submissionId: string;
  }
): UtrIdempotencyDecision {
  if (!existing) {
    return { action: 'proceed_reserve' };
  }

  if (existing.status === 'consumed') {
    return { action: 'collision_consumed', existing };
  }

  if (existing.status === 'released') {
    // A released reservation can safely be re-reserved by a new or corrected submission
    return { action: 'proceed_reserve' };
  }

  if (existing.status === 'reserved') {
    // Check if this is the exact same user, order, and submission (idempotent network retry)
    if (
      existing.userId === incoming.userId &&
      existing.orderId === incoming.orderId &&
      existing.submissionId === incoming.submissionId
    ) {
      return { action: 'idempotent_in_flight', existing };
    }

    // Different user or different order/submission = collision
    const reason =
      existing.userId !== incoming.userId ? 'different_user' : 'different_operation';
    return { action: 'collision_conflict', reason, existing };
  }

  return { action: 'proceed_reserve' };
}

// ============================================================================
// Transactional Operations
// ============================================================================

/**
 * Transactionally reserves a UTR reference inside a Firestore Transaction.
 * Guarantees O(1) collision detection across all parallel submissions.
 * Distinguishes legitimate idempotent retries from conflicting duplicate claims.
 */
export async function reserveUtrInTransaction(
  transaction: Transaction,
  params: {
    utr: string;
    orderId: string;
    submissionId: string;
    userId: string;
  }
): Promise<UtrReservationDocument> {
  const normalized = normalizeUtr(params.utr);
  if (!isValidUtrFormat(normalized)) {
    throw new UtrFormatError(params.utr);
  }

  const reservationRef = getUtrReservationRef(normalized);
  const snapshot = await transaction.get(reservationRef);
  const existing = snapshot.exists ? snapshot.data() || null : null;

  const decision = evaluateUtrIdempotency(existing, {
    utr: normalized,
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
  });

  if (decision.action === 'idempotent_in_flight') {
    // Legitimate retry of the same in-flight submission: return existing without error
    return decision.existing;
  }

  if (decision.action === 'collision_consumed') {
    throw new UtrCollisionError(
      normalized,
      decision.existing.orderId,
      'already_consumed'
    );
  }

  if (decision.action === 'collision_conflict') {
    throw new UtrCollisionError(
      normalized,
      decision.existing.orderId,
      decision.reason
    );
  }

  const history = existing?.history ? [...existing.history] : [];
  if (existing && existing.status === 'released' && existing.releasedAt) {
    history.push({
      orderId: existing.orderId,
      submissionId: existing.submissionId,
      userId: existing.userId,
      releasedAt: existing.releasedAt,
      releaseReason: existing.releaseReason,
    });
  }

  const reservation: UtrReservationDocument = {
    utrNumber: normalized,
    orderId: params.orderId,
    submissionId: params.submissionId,
    userId: params.userId,
    status: 'reserved',
    reservedAt: new Date().toISOString(),
    ...(history.length > 0 ? { history } : {}),
  };

  transaction.set(reservationRef, reservation);
  return reservation;
}

/**
 * Transactionally marks a UTR reservation as consumed upon administrator approval.
 * Enforces strict state validation:
 * - Must be in 'reserved' status
 * - Idempotent if already consumed for the same order and submission
 * - Fails if UTR is missing, released, or belongs to another submission
 */
export async function consumeUtrInTransaction(
  transaction: Transaction,
  params:
    | {
        utr: string;
        orderId?: string;
        submissionId?: string;
      }
    | string
): Promise<UtrReservationDocument> {
  const normalized = normalizeUtr(typeof params === 'string' ? params : params.utr);
  const expectedOrderId = typeof params === 'object' ? params.orderId : undefined;
  const expectedSubmissionId = typeof params === 'object' ? params.submissionId : undefined;

  const reservationRef = getUtrReservationRef(normalized);
  const snapshot = await transaction.get(reservationRef);

  if (!snapshot.exists) {
    throw new UtrNotFoundError(normalized);
  }

  const existing = snapshot.data();
  if (!existing) {
    throw new UtrNotFoundError(normalized);
  }

  // Idempotent repeat check: if already consumed for the exact same order and submission
  if (existing.status === 'consumed') {
    if (
      expectedOrderId &&
      expectedSubmissionId &&
      existing.orderId === expectedOrderId &&
      existing.submissionId === expectedSubmissionId
    ) {
      return existing; // Idempotent success
    }
    throw new UtrStateError(
      normalized,
      existing.status,
      'consumed',
      `UTR ${normalized} has already been consumed for order ${existing.orderId}.`
    );
  }

  if (existing.status === 'released') {
    throw new UtrStateError(
      normalized,
      existing.status,
      'consumed',
      `Cannot consume released UTR ${normalized}. A released reference must be re-reserved before consumption.`
    );
  }

  if (existing.status !== 'reserved') {
    throw new UtrStateError(
      normalized,
      existing.status,
      'consumed',
      `Cannot consume UTR ${normalized} in invalid status "${existing.status}".`
    );
  }

  // Verify ownership matches expected context if provided
  if (expectedOrderId && existing.orderId !== expectedOrderId) {
    throw new UtrOwnershipError(
      normalized,
      `Cannot consume UTR ${normalized}: owned by order ${existing.orderId}, expected ${expectedOrderId}.`
    );
  }
  if (expectedSubmissionId && existing.submissionId !== expectedSubmissionId) {
    throw new UtrOwnershipError(
      normalized,
      `Cannot consume UTR ${normalized}: owned by submission ${existing.submissionId}, expected ${expectedSubmissionId}.`
    );
  }

  const updatedDoc: Partial<UtrReservationDocument> = {
    status: 'consumed',
    consumedAt: new Date().toISOString(),
  };

  transaction.update(reservationRef, updatedDoc);
  return { ...existing, ...updatedDoc } as UtrReservationDocument;
}

/**
 * Transactionally releases a UTR reservation if an order or submission is rejected or cancelled.
 * Enforces:
 * - A 'consumed' reservation cannot ever be released via standard release.
 * - Missing reservation throws UtrNotFoundError.
 * - Releasing an already 'released' reservation is an idempotent no-op.
 * - Verifies orderId and submissionId match if provided.
 */
export async function releaseUtrInTransaction(
  transaction: Transaction,
  params:
    | {
        utr: string;
        orderId?: string;
        submissionId?: string;
        reason?: string;
      }
    | string
): Promise<void> {
  const normalized = normalizeUtr(typeof params === 'string' ? params : params.utr);
  const expectedOrderId = typeof params === 'object' ? params.orderId : undefined;
  const expectedSubmissionId = typeof params === 'object' ? params.submissionId : undefined;
  const reason = typeof params === 'object' ? params.reason : undefined;

  const reservationRef = getUtrReservationRef(normalized);
  const snapshot = await transaction.get(reservationRef);

  if (!snapshot.exists) {
    throw new UtrNotFoundError(normalized);
  }

  const existing = snapshot.data();
  if (!existing) {
    throw new UtrNotFoundError(normalized);
  }

  // A consumed payment reference can NEVER be released
  if (existing.status === 'consumed') {
    throw new UtrStateError(
      normalized,
      existing.status,
      'released',
      `CRITICAL: Cannot release consumed UTR ${normalized}. Approved financial references cannot be released.`
    );
  }

  // Idempotent no-op if already released
  if (existing.status === 'released') {
    return;
  }

  if (existing.status !== 'reserved') {
    throw new UtrStateError(
      normalized,
      existing.status,
      'released',
      `Cannot release UTR ${normalized} in unknown status "${existing.status}".`
    );
  }

  // Validate ownership if context provided
  if (expectedOrderId && existing.orderId !== expectedOrderId) {
    throw new UtrOwnershipError(
      normalized,
      `Cannot release UTR ${normalized}: owned by order ${existing.orderId}, expected ${expectedOrderId}.`
    );
  }
  if (expectedSubmissionId && existing.submissionId !== expectedSubmissionId) {
    throw new UtrOwnershipError(
      normalized,
      `Cannot release UTR ${normalized}: owned by submission ${existing.submissionId}, expected ${expectedSubmissionId}.`
    );
  }

  transaction.update(reservationRef, {
    status: 'released',
    releasedAt: new Date().toISOString(),
    releaseReason: reason,
  });
}
