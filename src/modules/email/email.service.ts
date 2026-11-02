/**
 * JobNexus Transactional Email Orchestrator (Phase 2B.4)
 * Orchestrates event-driven notifications, deterministic outbox logging, and resilient delivery.
 */

import { EmailProviderAdapter } from './adapters/email-provider.interface';
import { ResendEmailAdapter } from './adapters/resend.adapter';
import { SmtpEmailAdapter } from './adapters/smtp.adapter';
import { SimulationEmailAdapter } from './adapters/simulation.adapter';
import { renderPaymentSubmittedEmail } from './templates/payment-submitted.template';
import { renderAdminPaymentReviewEmail } from './templates/admin-payment-review.template';
import { renderPaymentApprovedEmail } from './templates/payment-approved.template';
import { renderPaymentRejectedEmail } from './templates/payment-rejected.template';
import { renderSubscriptionExpiringEmail } from './templates/subscription-expiring.template';
import { renderSubscriptionExpiredEmail } from './templates/subscription-expired.template';
import { maskUtr } from './templates/base.template';
import { buildRenewalEmailIdempotencyKey } from '../billing/domain/renewal-window';
import { PREMIUM_PLAN } from '../billing/domain/subscription.types';
import {
  createOutboxRecord,
  getOutboxRecordById,
  getOutboxRecordByIdempotencyKey,
  updateOutboxDeliveryStatus,
} from '../storage/firestore/outbox.store';
import { EmailOutboxDocument } from '../storage/firestore/collections';
import { getUserById } from '../auth/server/session.store';
import { parseAdminEmails } from '../auth/server/admin.auth';
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

  const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const smtpPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM;

  if (smtpUser && smtpUser.trim().includes('@') && smtpPass && smtpPass.replace(/\s+/g, '').length >= 8) {
    return new SmtpEmailAdapter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
      user: smtpUser,
      pass: smtpPass,
      defaultFrom: fromEmail,
    });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.trim().length > 5) {
    return new ResendEmailAdapter(resendApiKey, fromEmail);
  }

  if (process.env.NODE_ENV === 'test') {
    return getSimulationProvider();
  }

  return {
    providerName: 'unconfigured',
    isConfigured: false,
    async send() {
      return {
        success: false,
        provider: 'unconfigured',
        error:
          'No live email provider configured. Add GMAIL_USER and GMAIL_APP_PASSWORD (or RESEND_API_KEY) in .env.local and retry from Admin Console.',
        retryable: true,
      };
    },
  };
}

function isTrulyDeliveredRecord(record: EmailOutboxDocument | null, activeProviderName: string): boolean {
  if (!record || record.status !== 'sent') return false;
  if (activeProviderName !== 'simulation' && record.providerMessageId?.startsWith('sim_msg_')) {
    return false;
  }
  return true;
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
  const configured =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : '') ||
    'http://localhost:3000';
  return configured.replace(/\/+$/, '');
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
  const provider = getEmailProvider();

  // Check if already sent via real provider (or simulation in test mode)
  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing && isTrulyDeliveredRecord(existing, provider.providerName)) {
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
      maskedUtr: maskUtr(params.utrNumber),
      submittedAt: params.submittedAt,
      slaDeadlineAt: params.slaDeadlineAt,
    },
  });

  // Attempt dispatch
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
// Event A2: Admin Approval Required Notification (Sent to ADMIN_EMAILS)
// ============================================================================

export interface SendAdminSubmissionAlertParams {
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

export async function sendAdminSubmissionAlert(
  params: SendAdminSubmissionAlertParams
): Promise<{
  success: boolean;
  status: 'sent' | 'pending' | 'failed' | 'retryable_failure' | 'skipped_missing_email';
  sentCount: number;
  outboxIds: string[];
  error?: string;
}> {
  const adminEmails = Array.from(parseAdminEmails()).filter((e) => e.includes('@'));
  if (adminEmails.length === 0) {
    return {
      success: false,
      status: 'skipped_missing_email',
      sentCount: 0,
      outboxIds: [],
      error: 'No authorized administrator emails configured in ADMIN_EMAILS.',
    };
  }

  const applicantEmail = resolveTrustedRecipientEmail(params.userId, params.userEmail) || undefined;
  const adminReviewUrl = `${getAppBaseUrl()}/admin?tab=verifications`;
  const provider = getEmailProvider();

  let sentCount = 0;
  let sawRetryableFailure = false;
  let lastError: string | undefined;
  const outboxIds: string[] = [];

  for (const adminEmail of adminEmails) {
    const idempotencyKey = `admin_payment_review:${params.submissionId}:${adminEmail}`;
    const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
    if (existing && isTrulyDeliveredRecord(existing, provider.providerName)) {
      sentCount++;
      outboxIds.push(existing.id);
      continue;
    }

    const emailContent = renderAdminPaymentReviewEmail({
      userId: params.userId,
      orderId: params.orderId,
      submissionId: params.submissionId,
      recipientEmail: adminEmail,
      applicantEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: params.declaredAmount,
      currency: params.currency || 'INR',
      maskedUtr: params.utrNumber,
      paymentDate: params.paymentDate,
      submittedAt: params.submittedAt,
      slaDeadlineAt: params.slaDeadlineAt,
      statusUrl: adminReviewUrl,
    });

    const { record } = await createOutboxRecord({
      idempotencyKey,
      userId: params.userId,
      orderId: params.orderId,
      submissionId: params.submissionId,
      recipientEmail: adminEmail,
      subject: emailContent.subject,
      templateType: 'admin_payment_review',
      payload: {
        applicantEmail,
        declaredAmount: params.declaredAmount,
        currency: params.currency || 'INR',
        maskedUtr: maskUtr(params.utrNumber),
        paymentDate: params.paymentDate,
        submittedAt: params.submittedAt,
        slaDeadlineAt: params.slaDeadlineAt,
      },
    });
    outboxIds.push(record.id);

    const sendResult = await provider.send({
      to: adminEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      idempotencyKey,
    });

    if (sendResult.success) {
      sentCount++;
      await updateOutboxDeliveryStatus({
        id: record.id,
        status: 'sent',
        providerMessageId: sendResult.providerMessageId,
      });
    } else {
      const nextStatus = sendResult.retryable ? 'retryable_failure' : 'failed';
      if (sendResult.retryable) sawRetryableFailure = true;
      lastError = sendResult.error;
      await updateOutboxDeliveryStatus({
        id: record.id,
        status: nextStatus,
        error: sendResult.error,
      });
    }
  }

  if (sentCount === adminEmails.length) {
    return { success: true, status: 'sent', sentCount, outboxIds };
  }
  return {
    success: false,
    status: sawRetryableFailure ? 'retryable_failure' : 'failed',
    sentCount,
    outboxIds,
    error: lastError,
  };
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
  const provider = getEmailProvider();

  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing && isTrulyDeliveredRecord(existing, provider.providerName)) {
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
    amountInr: params.amountInr ?? PREMIUM_PLAN.priceInr,
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
      amountInr: params.amountInr ?? PREMIUM_PLAN.priceInr,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
    },
  });

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
  const provider = getEmailProvider();

  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing && isTrulyDeliveredRecord(existing, provider.providerName)) {
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
    amountInr: params.amountInr ?? PREMIUM_PLAN.priceInr,
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
      maskedUtr: maskUtr(params.maskedUtr),
      rejectionReason: params.rejectionReason,
      submittedAt: params.submittedAt,
    },
  });

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
// Event E1: 30-Day Subscription Expiring Soon / Urgent Renewal Reminder
// ============================================================================

export interface SendSubscriptionExpiringReminderParams {
  userId: string;
  subscriptionId: string;
  userEmail?: string;
  currentPeriodEnd: string;
  daysRemaining: number;
  hoursRemaining: number;
  isUrgent24h: boolean;
  amountInr?: number;
  currency?: string;
}

export async function sendSubscriptionExpiringReminder(
  params: SendSubscriptionExpiringReminderParams
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
      error: `No valid email address recorded for user "${params.userId}". Renewal reminder skipped.`,
    };
  }

  const milestone = params.isUrgent24h ? 'expiring_24h' : 'expiring_5d';
  const idempotencyKey = buildRenewalEmailIdempotencyKey({
    milestone,
    userId: params.userId,
    currentPeriodEnd: params.currentPeriodEnd,
  });

  const provider = getEmailProvider();
  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);

  if (existing) {
    if (isTrulyDeliveredRecord(existing, provider.providerName)) {
      return {
        success: true,
        outboxId: existing.id,
        idempotent: true,
        status: 'sent',
      };
    }
    if (existing.status === 'failed') {
      return {
        success: false,
        outboxId: existing.id,
        idempotent: true,
        status: 'failed',
        error: existing.error,
      };
    }
    if (
      existing.status === 'retryable_failure' &&
      (existing.attempts || 0) >= (existing.maxAttempts || 3)
    ) {
      return {
        success: false,
        outboxId: existing.id,
        idempotent: true,
        status: 'retryable_failure',
        error: existing.error,
      };
    }
  }

  const renewUrl = `${getAppBaseUrl()}/?renew=1`;
  const amountInr = params.amountInr ?? PREMIUM_PLAN.priceInr;
  const currency = params.currency || 'INR';

  const emailContent = renderSubscriptionExpiringEmail({
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    recipientEmail,
    planTitle: 'JobNexus Premium (30 Days)',
    amountInr,
    currency,
    currentPeriodEnd: params.currentPeriodEnd,
    daysRemaining: params.daysRemaining,
    hoursRemaining: params.hoursRemaining,
    isUrgent24h: params.isUrgent24h,
    renewUrl,
  });

  const { record } = await createOutboxRecord({
    idempotencyKey,
    userId: params.userId,
    orderId: params.subscriptionId,
    submissionId: milestone,
    recipientEmail,
    subject: emailContent.subject,
    templateType: 'subscription_expiring_soon',
    payload: {
      subscriptionId: params.subscriptionId,
      amountInr,
      currency,
      currentPeriodEnd: params.currentPeriodEnd,
      daysRemaining: params.daysRemaining,
      hoursRemaining: params.hoursRemaining,
      isUrgent24h: params.isUrgent24h,
      milestone,
    },
  });

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
// Event E2: 30-Day Subscription Expired Notification
// ============================================================================

export interface SendSubscriptionExpiredParams {
  userId: string;
  subscriptionId: string;
  userEmail?: string;
  expiredAt: string;
  amountInr?: number;
  currency?: string;
}

export async function sendSubscriptionExpiredNotification(
  params: SendSubscriptionExpiredParams
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
      error: `No valid email address recorded for user "${params.userId}". Expiry notification skipped.`,
    };
  }

  const idempotencyKey = buildRenewalEmailIdempotencyKey({
    milestone: 'expired',
    userId: params.userId,
    currentPeriodEnd: params.expiredAt,
  });

  const provider = getEmailProvider();
  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);

  if (existing) {
    if (isTrulyDeliveredRecord(existing, provider.providerName)) {
      return {
        success: true,
        outboxId: existing.id,
        idempotent: true,
        status: 'sent',
      };
    }
    if (existing.status === 'failed') {
      return {
        success: false,
        outboxId: existing.id,
        idempotent: true,
        status: 'failed',
        error: existing.error,
      };
    }
    if (
      existing.status === 'retryable_failure' &&
      (existing.attempts || 0) >= (existing.maxAttempts || 3)
    ) {
      return {
        success: false,
        outboxId: existing.id,
        idempotent: true,
        status: 'retryable_failure',
        error: existing.error,
      };
    }
  }

  const renewUrl = `${getAppBaseUrl()}/?renew=1`;
  const amountInr = params.amountInr ?? PREMIUM_PLAN.priceInr;
  const currency = params.currency || 'INR';

  const emailContent = renderSubscriptionExpiredEmail({
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    recipientEmail,
    planTitle: 'JobNexus Premium (30 Days)',
    amountInr,
    currency,
    expiredAt: params.expiredAt,
    renewUrl,
  });

  const { record } = await createOutboxRecord({
    idempotencyKey,
    userId: params.userId,
    orderId: params.subscriptionId,
    submissionId: 'expired',
    recipientEmail,
    subject: emailContent.subject,
    templateType: 'subscription_expired',
    payload: {
      subscriptionId: params.subscriptionId,
      amountInr,
      currency,
      expiredAt: params.expiredAt,
      milestone: 'expired',
    },
  });

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

  const provider = getEmailProvider();
  if (isTrulyDeliveredRecord(record, provider.providerName)) {
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
      amountInr: (record.payload?.declaredAmount as number) || PREMIUM_PLAN.priceInr,
      currency: (record.payload?.currency as string) || 'INR',
      maskedUtr: (record.payload?.maskedUtr as string) || '••••••••',
      submittedAt: (record.payload?.submittedAt as string) || record.createdAt,
      slaDeadlineAt: record.payload?.slaDeadlineAt as string | undefined,
      statusUrl,
    });
  } else if (record.templateType === 'admin_payment_review') {
    emailContent = renderAdminPaymentReviewEmail({
      userId: record.userId,
      orderId: record.orderId,
      submissionId: record.submissionId,
      recipientEmail: record.recipientEmail,
      applicantEmail: record.payload?.applicantEmail as string | undefined,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: (record.payload?.declaredAmount as number) || PREMIUM_PLAN.priceInr,
      currency: (record.payload?.currency as string) || 'INR',
      maskedUtr: (record.payload?.maskedUtr as string) || '••••••••',
      paymentDate: (record.payload?.paymentDate as string) || record.createdAt.slice(0, 10),
      submittedAt: (record.payload?.submittedAt as string) || record.createdAt,
      slaDeadlineAt: record.payload?.slaDeadlineAt as string | undefined,
      statusUrl: `${getAppBaseUrl()}/admin?tab=verifications`,
    });
  } else if (record.templateType === 'payment_approved') {
    emailContent = renderPaymentApprovedEmail({
      userId: record.userId,
      orderId: record.orderId,
      submissionId: record.submissionId,
      recipientEmail: record.recipientEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: (record.payload?.amountInr as number) || PREMIUM_PLAN.priceInr,
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
      amountInr: (record.payload?.amountInr as number) || PREMIUM_PLAN.priceInr,
      currency: 'INR',
      maskedUtr: (record.payload?.maskedUtr as string) || '••••••••',
      rejectionReason: (record.payload?.rejectionReason as string) || 'Verification unsuccessful',
      submittedAt: (record.payload?.submittedAt as string) || record.createdAt,
      statusUrl: `${getAppBaseUrl()}/?status=resubmit_reference&orderId=${encodeURIComponent(record.orderId)}`,
    });
  } else if (record.templateType === 'subscription_expiring_soon') {
    emailContent = renderSubscriptionExpiringEmail({
      userId: record.userId,
      subscriptionId: (record.payload?.subscriptionId as string) || record.orderId,
      recipientEmail: record.recipientEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: (record.payload?.amountInr as number) || PREMIUM_PLAN.priceInr,
      currency: (record.payload?.currency as string) || 'INR',
      currentPeriodEnd: (record.payload?.currentPeriodEnd as string) || record.createdAt,
      daysRemaining: (record.payload?.daysRemaining as number) || 1,
      hoursRemaining: (record.payload?.hoursRemaining as number) || 24,
      isUrgent24h: Boolean(record.payload?.isUrgent24h),
      renewUrl: `${getAppBaseUrl()}/?renew=1`,
    });
  } else if (record.templateType === 'subscription_expired') {
    emailContent = renderSubscriptionExpiredEmail({
      userId: record.userId,
      subscriptionId: (record.payload?.subscriptionId as string) || record.orderId,
      recipientEmail: record.recipientEmail,
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: (record.payload?.amountInr as number) || PREMIUM_PLAN.priceInr,
      currency: (record.payload?.currency as string) || 'INR',
      expiredAt: (record.payload?.expiredAt as string) || record.createdAt,
      renewUrl: `${getAppBaseUrl()}/?renew=1`,
    });
  } else {
    return { success: false, status: 'failed', error: `Unsupported template type "${record.templateType}".` };
  }

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
