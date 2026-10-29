/**
 * Event A: Payment Submission Received Template (Phase 2B.4)
 * Sent immediately after a valid UPI payment submission is successfully persisted.
 */

import { PaymentSubmittedEmailData, GeneratedEmailContent } from '../email.types';
import { renderBaseEmail, escapeHtml, maskUtr } from './base.template';

export function renderPaymentSubmittedEmail(data: PaymentSubmittedEmailData): GeneratedEmailContent {
  const maskedUtr = maskUtr(data.maskedUtr);
  const formattedDate = new Date(data.submittedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const contentHtml = `
    <!-- Order Summary Card -->
    <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0; width: 40%;">Plan:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(data.planTitle)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Claimed Amount:</td>
          <td style="color: #34d399; font-weight: 700; padding: 6px 0; text-align: right;">₹${data.amountInr} ${escapeHtml(data.currency)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Order Reference:</td>
          <td style="color: #e2e8f0; font-family: monospace; font-size: 12px; padding: 6px 0; text-align: right;">${escapeHtml(data.orderId)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Submission ID:</td>
          <td style="color: #e2e8f0; font-family: monospace; font-size: 12px; padding: 6px 0; text-align: right;">${escapeHtml(data.submissionId)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Masked UTR:</td>
          <td style="color: #818cf8; font-family: monospace; font-weight: 700; font-size: 13px; padding: 6px 0; text-align: right;">${escapeHtml(maskedUtr)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Submitted At:</td>
          <td style="color: #e2e8f0; padding: 6px 0; text-align: right;">${escapeHtml(formattedDate)}</td>
        </tr>
      </table>
    </div>

    <!-- Review Target Notice Banner -->
    <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #fde68a;">
        <strong>Awaiting Manual Review:</strong> Our administrative team reviews UPI references against bank credit records. Target review window is within 12 hours.
      </p>
    </div>

    <!-- Security Invariant Reminder -->
    <div style="background-color: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 10px; padding: 12px 16px;">
      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #c7d2fe;">
        <strong>Important:</strong> Submitting a transaction reference records your claim for verification. Premium access is not activated merely because a UTR was submitted. Access unlocks automatically once approval is formally recorded by our team.
      </p>
    </div>
  `;

  const plainTextContent = `
TRANSACTION DETAILS:
- Plan: ${data.planTitle}
- Claimed Amount: ₹${data.amountInr} ${data.currency}
- Order Reference: ${data.orderId}
- Submission ID: ${data.submissionId}
- Masked UTR: ${maskedUtr}
- Submitted At: ${formattedDate}

Awaiting Manual Review:
Our administrative team reviews UPI references against banking records.
Target review window is within 12 hours.

Important Security Notice:
Submitting a transaction reference records your claim for verification.
Premium access is NOT activated merely because a UTR was submitted.
Access unlocks once an administrator formally verifies bank credit and records approval.
`;

  const { html, text } = renderBaseEmail({
    preheader: `Payment details received for order ${data.orderId}. Awaiting manual verification.`,
    badgeText: 'Awaiting Verification',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
    badgeColor: '#fbbf24',
    title: 'Payment Details Submitted',
    subtitle: 'We have received your manual UPI payment reference. Our team is independently verifying the transaction against banking records.',
    contentHtml,
    ctaText: 'Check Payment Status',
    ctaUrl: data.statusUrl,
    ctaBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    plainTextContent,
  });

  return {
    subject: `[JobNexus] Payment details received: Order ${data.orderId} (Awaiting Verification)`,
    html,
    text,
  };
}

