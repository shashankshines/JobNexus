/**
 * Admin Action Required: New Payment Verification Alert Template
 * Sent immediately to designated administrators (ADMIN_EMAILS) whenever a customer
 * submits manual UPI payment details for approval.
 */

import { AdminPaymentReviewEmailData, GeneratedEmailContent } from '../email.types';
import { renderBaseEmail, escapeHtml, maskUtr } from './base.template';

export function renderAdminPaymentReviewEmail(
  data: AdminPaymentReviewEmailData
): GeneratedEmailContent {
  const masked = maskUtr(data.maskedUtr);
  const applicantDisplay = data.applicantEmail?.trim() || data.userId;

  const formattedSubmittedAt = new Date(data.submittedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const formattedSla = data.slaDeadlineAt
    ? new Date(data.slaDeadlineAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Within 12 hours';

  const contentHtml = `
    <!-- Admin Submission Summary Card -->
    <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(245, 158, 11, 0.28); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0; width: 40%;">Subscriber Email:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(applicantDisplay)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">User ID:</td>
          <td style="color: #cbd5e1; font-family: monospace; font-size: 12px; padding: 6px 0; text-align: right;">${escapeHtml(data.userId)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Plan:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(data.planTitle)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Claimed Amount:</td>
          <td style="color: #34d399; font-weight: 800; padding: 6px 0; text-align: right;">₹${data.amountInr} ${escapeHtml(data.currency)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Payment Date:</td>
          <td style="color: #e2e8f0; padding: 6px 0; text-align: right;">${escapeHtml(data.paymentDate)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Order ID:</td>
          <td style="color: #e2e8f0; font-family: monospace; font-size: 12px; padding: 6px 0; text-align: right;">${escapeHtml(data.orderId)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Submission ID:</td>
          <td style="color: #e2e8f0; font-family: monospace; font-size: 12px; padding: 6px 0; text-align: right;">${escapeHtml(data.submissionId)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">UTR (Masked):</td>
          <td style="color: #fbbf24; font-family: monospace; font-weight: 700; font-size: 13px; padding: 6px 0; text-align: right;">${escapeHtml(masked)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Submitted At:</td>
          <td style="color: #e2e8f0; padding: 6px 0; text-align: right;">${escapeHtml(formattedSubmittedAt)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">12h SLA Target:</td>
          <td style="color: #fde68a; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(formattedSla)}</td>
        </tr>
      </table>
    </div>

    <!-- Verification Checklist Banner -->
    <div style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 14px 16px;">
      <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #fde68a;">
        <strong>Action Required:</strong> Open the JobNexus Admin Console Verification Queue to view the full unmasked UTR reference, verify ₹${data.amountInr} credit in the bank statement, and record Approval or Rejection.
      </p>
    </div>
  `;

  const plainTextContent = `
NEW PAYMENT SUBMISSION AWAITING ADMIN APPROVAL:
- Subscriber: ${applicantDisplay} (${data.userId})
- Plan: ${data.planTitle}
- Claimed Amount: ₹${data.amountInr} ${data.currency}
- Payment Date: ${data.paymentDate}
- Order ID: ${data.orderId}
- Submission ID: ${data.submissionId}
- Masked UTR: ${masked}
- Submitted At: ${formattedSubmittedAt}
- 12h SLA Target: ${formattedSla}

Action Required:
Sign in with your authorized Google administrator account to inspect the full UTR in the Verification Queue, confirm bank credit, and approve or reject this claim.
`;

  const { html, text } = renderBaseEmail({
    preheader: `Approval required: ${applicantDisplay} submitted ₹${data.amountInr} UPI payment details (Order ${data.orderId}).`,
    badgeText: 'Admin Approval Required',
    badgeBg: 'rgba(245, 158, 11, 0.18)',
    badgeBorder: 'rgba(245, 158, 11, 0.45)',
    badgeColor: '#fbbf24',
    title: 'Payment Approval Required',
    subtitle: `${applicantDisplay} just submitted manual UPI payment details for JobNexus Premium. Bank credit verification is required.`,
    contentHtml,
    ctaText: 'Review & Approve in Admin Console',
    ctaUrl: data.statusUrl,
    ctaBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    plainTextContent,
  });

  return {
    subject: `[JobNexus Admin] Approval Required: ₹${data.amountInr} Payment from ${applicantDisplay} (${data.orderId})`,
    html,
    text,
  };
}

