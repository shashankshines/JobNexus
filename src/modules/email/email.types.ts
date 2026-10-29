/**
 * JobNexus Transactional Email Types & Contracts (Phase 2B.4)
 * Defines notification events, payloads, delivery statuses, and provider contracts.
 */

export type NotificationEventType =
  | 'payment_submitted'
  | 'payment_approved'
  | 'payment_rejected';

export type EmailDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'retryable_failure';

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  from?: string;
}

export interface EmailSendResult {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface BaseNotificationData {
  userId: string;
  orderId: string;
  submissionId: string;
  recipientEmail: string;
  recipientName?: string;
  statusUrl: string;
}

export interface PaymentSubmittedEmailData extends BaseNotificationData {
  planTitle: string;
  amountInr: number;
  currency: string;
  maskedUtr: string;
  submittedAt: string;
  slaDeadlineAt?: string;
}

export interface PaymentApprovedEmailData extends BaseNotificationData {
  planTitle: string;
  amountInr: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface PaymentRejectedEmailData extends BaseNotificationData {
  planTitle: string;
  amountInr: number;
  currency: string;
  maskedUtr: string;
  rejectionReason: string;
  submittedAt: string;
}

export interface GeneratedEmailContent {
  subject: string;
  html: string;
  text: string;
}

