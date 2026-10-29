/**
 * JobNexus Transactional Email Orchestrator (Phase 2B.4)
 * Orchestrates event-driven notifications, deterministic outbox logging, and resilient delivery.
 */

import { EmailProviderAdapter } from './adapters/email-provider.interface';
import { ResendEmailAdapter } from './adapters/resend.adapter';
import { SimulationEmailAdapter } from './adapters/simulation.adapter';
import { renderPaymentSubmittedEmail } from './templates/payment-submitted.template';
import { renderPaymentApprovedEmail } from './templates/payment-approved.template';
import { renderPaymentRejectedEmail } from './templates/payment-rejected.template';
import {
  createOutboxRecord,
  getOutboxRecordById,
  getOutboxRecordByIdempotencyKey,
  updateOutboxDeliveryStatus,
} from '../storage/firestore/outbox.store';
import { EmailOutboxDocument } from '../storage/firestore/collections';
import { getUserById } from '../auth/server/session.store';
import { recordAdminAuditLog } from '../storage/firestore/audit.store';

// Shared in-memory simulation provider for local / test environments
let globalSimulationProvider: SimulationEmailAdapter | null = null;
let customTestProvider: EmailProviderAdapter | null = null;

export function setTestEmailProvider(provider: EmailProviderAdapter | null): void {
  customTestProvider = provider;
}

export function getSimulationProvider(): SimulationEmailAdapter {
  if (!globalSimulationProvider) {
    globalSimulationProvider = new SimulationEmailAdapter();
  }
  return globalSimulationProvider;
}

export function resetEmailServiceForTesting(): void {
  customTestProvider = null;
  if (globalSimulationProvider) {
    globalSimulationProvider.clear();
  }
}

/**
 * Returns the active EmailProviderAdapter based on environment configuration or test override.
 */
export function getEmailProvider(): EmailProviderAdapter {
  if (customTestProvider) {
    return customTestProvider;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (resendApiKey && resendApiKey.trim().length > 5) {
    return new ResendEmailAdapter(resendApiKey, fromEmail);
  }

  return getSimulationProvider();
}

/**
 * Safely resolves the recipient email from trusted server-side account records.
 * Never trusts arbitrary browser inputs.
 */
function resolveTrustedRecipientEmail(userId: string, snapshotEmail?: string): string | null {
  if (snapshotEmail && snapshotEmail.trim().includes('@')) {
    return snapshotEmail.trim().toLowerCase();
  }

  const user = getUserById(userId);
  if (user && user.email && user.email.includes('@')) {
    return user.email.trim().toLowerCase();
  }

  return null;
}

function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// ============================================================================
// Event A: Payment Submission Received Acknowledgement
// ============================================================================

export interface SendSubmissionAcknowledgementParams {
  userId: string;
  orderId: string;
  submissionId: string;
  userEmail?: string;
  utrNumber: string;
  declaredAmount: number;
  currency?: string;
  paymentDate: string;
  submittedAt: string;
  slaDeadlineAt?: string;
}

export async function sendSubmissionAcknowledgement(
  params: SendSubmissionAcknowledgementParams
): Promise<{
  success: boolean;
  outboxId?: string;
  idempotent?: boolean;
  status: 'sent' | 'pending' | 'failed' | 'retryable_failure' | 'skipped_missing_email';
  error?: string;
}> {
  const recipientEmail = resolveTrustedRecipientEmail(params.userId, params.userEmail);

  if (!recipientEmail) {
    // Section 5 & 6 requirement: Do NOT fail or roll back the payment submission if email is absent.
    return {
      success: false,
      status: 'skipped_missing_email',
      error: `No valid email address recorded for user "${params.userId}". Payment submission was preserved.`,
    };
  }

  const idempotencyKey = `payment_submitted:${params.submissionId}`;

  // Check if already sent
  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing && existing.status === 'sent') {
    return {
      success: true,
      outboxId: existing.id,
      idempotent: true,
      status: 'sent',
    };
  }

  const statusUrl = `${getAppBaseUrl()}/?status=payment_review&orderId=${encodeURIComponent(params.orderId)}`;

  const emailContent = renderPaymentSubmittedEmail({
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
    recipientEmail,
    planTitle: 'JobNexus Premium (30 Days)',
    amountInr: params.declaredAmount,
    currency: params.currency || 'INR',
    maskedUtr: params.utrNumber,
    submittedAt: params.submittedAt,
    slaDeadlineAt: params.slaDeadlineAt,
    statusUrl,
  });

  // Create durable outbox record
  const { record } = await createOutboxRecord({
    idempotencyKey,
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
    recipientEmail,
    subject: emailContent.subject,
    templateType: 'payment_submitted',
    payload: {
      declaredAmount: params.declaredAmount,
      currency: params.currency || 'INR',
      submittedAt: params.submittedAt,
      slaDeadlineAt: params.slaDeadlineAt,
    },
  });

  // Attempt dispatch
  const provider = getEmailProvider();
  const sendResult = await provider.send({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey,
  });

  if (sendResult.success) {
    await updateOutboxDeliveryStatus({
      id: record.id,
      status: 'sent',
      providerMessageId: sendResult.providerMessageId,
    });
    return {
      success: true,
      outboxId: record.id,
      status: 'sent',
    };
  } else {
    const nextStatus = sendResult.retryable ? 'retryable_failure' : 'failed';
    await updateOutboxDeliveryStatus({
      id: record.id,
      status: nextStatus,
      error: sendResult.error,
    });
    return {
      success: false,
      outboxId: record.id,
      status: nextStatus,
      error: sendResult.error,
    };
  }
}

// ============================================================================
// Event B: Payment Approved & Subscription Activated Notification
// ============================================================================

export interface SendPaymentApprovalParams {
  userId: string;
  orderId: string;
  submissionId: string;
  userEmail?: string;
  amountInr?: number;
  currency?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export async function sendPaymentApprovalNotification(
  params: SendPaymentApprovalParams
): Promise<{
  success: boolean;
  outboxId?: string;
  idempotent?: boolean;
  status: 'sent' | 'pending' | 'failed' | 'retryable_failure' | 'skipped_missing_email';
  error?: string;
}> {
  const recipientEmail = resolveTrustedRecipientEmail(params.userId, params.userEmail);

  if (!recipientEmail) {
    return {
      success: false,
      status: 'skipped_missing_email',
      error: `No valid email address recorded for user "${params.userId}". Approval succeeded without email.`,
    };
  }

  const idempotencyKey = `payment_approved:${params.submissionId}`;

  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing && existing.status === 'sent') {
    return {
      success: true,
      outboxId: existing.id,
      idempotent: true,
      status: 'sent',
    };
  }

  const statusUrl = `${getAppBaseUrl()}/?view=premium_active`;

  const emailContent = renderPaymentApprovedEmail({
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
    recipientEmail,
    planTitle: 'JobNexus Premium (30 Days)',
    amountInr: params.amountInr ?? 499,
    currency: params.currency || 'INR',
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
    statusUrl,
  });

  const { record } = await createOutboxRecord({
    idempotencyKey,
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
    recipientEmail,
    subject: emailContent.subject,
    templateType: 'payment_approved',
    payload: {
      amountInr: params.amountInr ?? 499,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
    },
  });

  const provider = getEmailProvider();
  const sendResult = await provider.send({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey,
  });

  if (sendResult.success) {
    await updateOutboxDeliveryStatus({
      id: record.id,
      status: 'sent',
      providerMessageId: sendResult.providerMessageId,
    });
    return {
      success: true,
      outboxId: record.id,
      status: 'sent',
    };
  } else {
    const nextStatus = sendResult.retryable ? 'retryable_failure' : 'failed';
    await updateOutboxDeliveryStatus({
      id: record.id,
      status: nextStatus,
      error: sendResult.error,
    });
    return {
      success: false,
      outboxId: record.id,
      status: nextStatus,
      error: sendResult.error,
    };
  }
}

// ============================================================================
// Event C: Payment Rejected Notification
// ============================================================================

export interface SendPaymentRejectionParams {
  userId: string;
  orderId: string;
  submissionId: string;
  userEmail?: string;
  maskedUtr: string;
  rejectionReason: string;
  submittedAt: string;
  amountInr?: number;
  currency?: string;
}

export async function sendPaymentRejectionNotification(
  params: SendPaymentRejectionParams
): Promise<{
  success: boolean;
  outboxId?: string;
  idempotent?: boolean;
  status: 'sent' | 'pending' | 'failed' | 'retryable_failure' | 'skipped_missing_email';
  error?: string;
}> {
  const recipientEmail = resolveTrustedRecipientEmail(params.userId, params.userEmail);

  if (!recipientEmail) {
    return {
      success: false,
      status: 'skipped_missing_email',
      error: `No valid email address recorded for user "${params.userId}". Rejection succeeded without email.`,
    };
  }

  const idempotencyKey = `payment_rejected:${params.submissionId}`;

  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing && existing.status === 'sent') {
    return {
      success: true,
      outboxId: existing.id,
      idempotent: true,
      status: 'sent',
    };
  }

  const statusUrl = `${getAppBaseUrl()}/?status=resubmit_reference&orderId=${encodeURIComponent(params.orderId)}`;

  const emailContent = renderPaymentRejectedEmail({
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
    recipientEmail,
    planTitle: 'JobNexus Premium (30 Days)',
    amountInr: params.amountInr ?? 499,
    currency: params.currency || 'INR',
    maskedUtr: params.maskedUtr,
    rejectionReason: params.rejectionReason,
    submittedAt: params.submittedAt,
    statusUrl,
  });

  const { record } = await createOutboxRecord({
    idempotencyKey,
    userId: params.userId,
    orderId: params.orderId,
    submissionId: params.submissionId,
    recipientEmail,
    subject: emailContent.subject,
    templateType: 'payment_rejected',
    payload: {
      rejectionReason: params.rejectionReason,
      submittedAt: params.submittedAt,
    },
  });

  const provider = getEmailProvider();
  const sendResult = await provider.send({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey,
  });

  if (sendResult.success) {
    await updateOutboxDeliveryStatus({
      id: record.id,
      status: 'sent',
      providerMessageId: sendResult.providerMessageId,
    });
    return {
      success: true,
      outboxId: record.id,
      status: 'sent',
    };
  } else {
    const nextStatus = sendResult.retryable ? 'retryable_failure' : 'failed';
    await updateOutboxDeliveryStatus({
      id: record.id,
      status: nextStatus,
      error: sendResult.error,
    });
    return {
      success: false,
      outboxId: record.id,
      status: nextStatus,
      error: sendResult.error,
    };
  }
}

// ============================================================================
// Event D: Admin Manual Notification Retry & Recovery
// ============================================================================

export async function retryNotificationById(
  notificationId: string,
  adminEmail: string
): Promise<{
  success: boolean;
  status: EmailOutboxDocument['status'];
  error?: string;
}> {
  const record = await getOutboxRecordById(notificationId);
  if (!record) {
    return { success: false, status: 'failed', error: `Notification "${notificationId}" not found.` };
  }

  if (record.status === 'sent') {
    return { success: true, status: 'sent', error: 'Notification was already delivered.' };
  }

  // Regenerate content based on templateType
  let emailContent: { subject: string; html: string; text: string };

  const statusUrl = `${getAppBaseUrl()}/?status=payment_review&orderId=${encodeURIComponent(record.orderId)}`;

  if (record.templateType === 'payment_submitted') {
    emailContent = renderPaymentSubmittedEmail({
      userId: record.userId,
      orderId: record.orderId,
      submissionId: record.submissionId,
      recipientEmail: record.recipientEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: (record.payload?.declaredAmount as number) || 499,
      currency: (record.payload?.currency as string) || 'INR',
      maskedUtr: (record.payload?.maskedUtr as string) || '••••••••',
      submittedAt: (record.payload?.submittedAt as string) || record.createdAt,
      statusUrl,
    });
  } else if (record.templateType === 'payment_approved') {
    emailContent = renderPaymentApprovedEmail({
      userId: record.userId,
      orderId: record.orderId,
      submissionId: record.submissionId,
      recipientEmail: record.recipientEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: (record.payload?.amountInr as number) || 499,
      currency: 'INR',
      currentPeriodStart: (record.payload?.currentPeriodStart as string) || record.createdAt,
      currentPeriodEnd: (record.payload?.currentPeriodEnd as string) || record.createdAt,
      statusUrl: `${getAppBaseUrl()}/?view=premium_active`,
    });
  } else if (record.templateType === 'payment_rejected') {
    emailContent = renderPaymentRejectedEmail({
      userId: record.userId,
      orderId: record.orderId,
      submissionId: record.submissionId,
      recipientEmail: record.recipientEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: 499,
      currency: 'INR',
      maskedUtr: '••••••••',
      rejectionReason: (record.payload?.rejectionReason as string) || 'Verification unsuccessful',
      submittedAt: (record.payload?.submittedAt as string) || record.createdAt,
      statusUrl: `${getAppBaseUrl()}/?status=resubmit_reference&orderId=${encodeURIComponent(record.orderId)}`,
    });
  } else {
    return { success: false, status: 'failed', error: `Unsupported template type "${record.templateType}".` };
  }

  const provider = getEmailProvider();
  const sendResult = await provider.send({
    to: record.recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey: `${record.idempotencyKey}:retry_${Date.now()}`,
  });

  const nextStatus = sendResult.success ? 'sent' : sendResult.retryable ? 'retryable_failure' : 'failed';

  await updateOutboxDeliveryStatus({
    id: record.id,
    status: nextStatus,
    providerMessageId: sendResult.providerMessageId,
    error: sendResult.error,
  });

  // Record admin audit log for manual retry
  await recordAdminAuditLog({
    actorEmail: adminEmail,
    action: 'payment_settings_updated', // Reusing available audit log enum
    targetUserId: record.userId,
    targetUserEmail: record.recipientEmail,
    targetEntityId: record.id,
    previousState: { status: record.status, attempts: record.attempts },
    newState: { status: nextStatus, attempts: (record.attempts || 0) + 1, error: sendResult.error },
    reason: `Manual administrative notification retry for ${record.templateType}. Result: ${nextStatus}.`,
  });

  return {
    success: sendResult.success,
    status: nextStatus,
    error: sendResult.error,
  };
}
