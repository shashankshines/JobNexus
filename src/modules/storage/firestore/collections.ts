import { CollectionReference, DocumentData } from 'firebase-admin/firestore';
import { getFirestoreDb } from './client';
import type { SubscriptionRecord } from '@/modules/billing/domain/subscription.types';

/**
 * JobNexus Firestore Canonical Collection Names
 */
export const FIRESTORE_COLLECTIONS = {
  ORDERS: 'upi_orders',
  SUBMISSIONS: 'upi_submissions',
  UTR_RESERVATIONS: 'upi_utr_reservations',
  SUBSCRIPTIONS: 'billing_subscriptions',
  ADMIN_AUDIT_LOGS: 'admin_audit_logs',
  EMAIL_OUTBOX: 'email_outbox',
  CONFIG: 'billing_config',
  SYSTEM_METADATA: 'system_metadata',
} as const;

export type FirestoreCollectionName =
  typeof FIRESTORE_COLLECTIONS[keyof typeof FIRESTORE_COLLECTIONS];

/**
 * Document Models for Firestore Persistence
 */

export interface PaymentOrderDocument {
  orderId: string;
  userId: string;
  userEmail?: string;
  planId: 'premium_monthly';
  amountInr: number; // 499
  amountInPaise: number; // 49900
  currency: 'INR';
  status: 'created' | 'submitted' | 'expired';
  upiId: string;
  payeeName: string;
  paymentDescription?: string;
  configVersion?: number;
  createdAt: string; // ISO
  expiresAt: string; // ISO
}

export interface PaymentSettingsDocument {
  upiId: string;
  payeeName: string;
  paymentDescription: string;
  updatedAt: string; // ISO
  updatedBy: string; // admin email
  version: number;   // 1, 2, 3...
}

export interface PaymentSubmissionDocument {
  submissionId: string;
  orderId: string;
  userId: string;
  userEmail?: string;
  utrNumber: string; // Normalized uppercase alphanumeric
  declaredAmount: number;
  paymentDate: string; // YYYY-MM-DD
  receiptPath?: string;
  receiptContentType?: string;
  submittedAt: string; // ISO
  slaDeadlineAt: string; // ISO (submittedAt + 12h)
  status: 'pending_verification' | 'approved' | 'rejected';
  decisionReason?: string;
  reviewedBy?: string; // Admin email
  reviewedAt?: string; // ISO
  verificationNotes?: string;
}

export interface UtrReservationHistoryEntry {
  orderId: string;
  submissionId: string;
  userId: string;
  releasedAt: string;
  releaseReason?: string;
}

export interface UtrReservationDocument {
  utrNumber: string; // Document ID is the normalized UTR
  orderId: string;
  submissionId: string;
  userId: string;
  status: 'reserved' | 'consumed' | 'released';
  reservedAt: string; // ISO
  consumedAt?: string; // ISO
  releasedAt?: string; // ISO
  releaseReason?: string;
  history?: UtrReservationHistoryEntry[];
}

export interface SubscriptionDocument extends SubscriptionRecord {
  // Extends authoritative SubscriptionRecord with Firestore timestamp metadata
  lastUpdatedFrom?:
    | 'webhook'
    | 'admin_manual'
    | 'admin_grant'
    | 'system_expiry'
    | 'razorpay'
    | 'manual_upi'
    | 'user_cancel'
    | 'migration';
}

export interface AdminAuditLogDocument {
  id: string;
  actorId: string;
  actorEmail: string;
  action:
    | 'payment_approved'
    | 'payment_rejected'
    | 'admin_grant'
    | 'admin_deactivate'
    | 'utr_released'
    | 'payment_settings_updated'
    | 'subscription_extended'
    | 'subscription_suspended'
    | 'subscription_reinstated'
    | 'subscription_terminated'
    | 'subscription_revoked'
    | 'subscription_permanently_revoked';
  targetUserId: string;
  targetUserEmail?: string;
  targetEntityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown>;
  reason?: string;
  timestamp: string; // ISO
}

export interface EmailOutboxDocument {
  id: string;
  idempotencyKey: string;
  userId: string;
  orderId: string;
  submissionId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  templateType:
    | 'payment_submitted'
    | 'payment_approved'
    | 'payment_rejected'
    | 'premium_activated'
    | 'premium_deactivated'
    | 'sla_breach_alert';
  payload: Record<string, unknown>;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'retryable_failure';
  attempts: number;
  maxAttempts: number;
  providerMessageId?: string;
  lastAttemptAt?: string;
  sentAt?: string;
  error?: string;
  createdAt: string; // ISO
}

/**
 * Type-Safe Firestore Collection Reference Accessors
 */

function getTypedCollection<T extends DocumentData>(collectionName: string): CollectionReference<T> {
  const db = getFirestoreDb();
  return db.collection(collectionName) as CollectionReference<T>;
}

export function getOrdersCollection(): CollectionReference<PaymentOrderDocument> {
  return getTypedCollection<PaymentOrderDocument>(FIRESTORE_COLLECTIONS.ORDERS);
}

export function getSubmissionsCollection(): CollectionReference<PaymentSubmissionDocument> {
  return getTypedCollection<PaymentSubmissionDocument>(FIRESTORE_COLLECTIONS.SUBMISSIONS);
}

export function getUtrReservationsCollection(): CollectionReference<UtrReservationDocument> {
  return getTypedCollection<UtrReservationDocument>(FIRESTORE_COLLECTIONS.UTR_RESERVATIONS);
}

export function getSubscriptionsCollection(): CollectionReference<SubscriptionDocument> {
  return getTypedCollection<SubscriptionDocument>(FIRESTORE_COLLECTIONS.SUBSCRIPTIONS);
}

export function getAuditLogsCollection(): CollectionReference<AdminAuditLogDocument> {
  return getTypedCollection<AdminAuditLogDocument>(FIRESTORE_COLLECTIONS.ADMIN_AUDIT_LOGS);
}

export function getEmailOutboxCollection(): CollectionReference<EmailOutboxDocument> {
  return getTypedCollection<EmailOutboxDocument>(FIRESTORE_COLLECTIONS.EMAIL_OUTBOX);
}

export function getBillingConfigCollection(): CollectionReference<PaymentSettingsDocument> {
  return getTypedCollection<PaymentSettingsDocument>(FIRESTORE_COLLECTIONS.CONFIG);
}

export function getSystemMetadataCollection(): CollectionReference<DocumentData> {
  return getTypedCollection<DocumentData>(FIRESTORE_COLLECTIONS.SYSTEM_METADATA);
}
