/**
 * Event C: Payment Rejected Template (Phase 2B.4)
 * Sent only after an authorized administrator's rejection transaction commits successfully.
 */

import { PaymentRejectedEmailData, GeneratedEmailContent } from '../email.types';
import { renderBaseEmail, escapeHtml, maskUtr } from './base.template';

export function renderPaymentRejectedEmail(data: PaymentRejectedEmailData): GeneratedEmailContent {
  const maskedUtr = maskUtr(data.maskedUtr);
  const formattedDate = new Date(data.submittedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const contentHtml = `
    <!-- Rejection Summary Card -->
    <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0; width: 40%;">Plan:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(data.planTitle)}</td>
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
          <td style="color: #94a3b8; padding: 6px 0;">Masked Reference:</td>
          <td style="color: #f87171; font-family: monospace; font-weight: 700; font-size: 13px; padding: 6px 0; text-align: right;">${escapeHtml(maskedUtr)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Submitted At:</td>
          <td style="color: #e2e8f0; padding: 6px 0; text-align: right;">${escapeHtml(formattedDate)}</td>
        </tr>
      </table>
    </div>

    <!-- Reason Callout Banner -->
    <div style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f87171;">
        Administrator Review Reason:
      </p>
      <p style="margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5; color: #ffffff;">
        &quot;${escapeHtml(data.rejectionReason)}&quot;
      </p>
    </div>

    <!-- Clear Next Steps & Financial Integrity Notice -->
    <div style="background-color: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #e2e8f0;">
        Recommended Next Steps:
      </h4>
      <ol style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #94a3b8;">
        <li>Check your UPI payment receipt in Google Pay, PhonePe, Paytm, or your banking app.</li>
        <li>Verify that the 12-digit UTR and payment date match the actual debited transaction.</li>
        <li>Resubmit the corrected transaction reference using the link below, or create a new order if required.</li>
      </ol>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.45;">
        <em>Note on Bank Transactions:</em> Rejection means our administrative team was unable to confirm bank credit for this reference. This does not indicate that your bank transaction was reversed or refunded by JobNexus.
      </p>
    </div>
  `;

  const plainTextContent = `
PAYMENT VERIFICATION UNSUCCESSFUL:
- Plan: ${data.planTitle}
- Order Reference: ${data.orderId}
- Submission ID: ${data.submissionId}
- Masked Reference: ${maskedUtr}
- Submitted At: ${formattedDate}

REASON PROVIDED BY ADMINISTRATOR:
"${data.rejectionReason}"

NEXT STEPS:
1. Verify the 12-digit UTR in your UPI app payment receipt.
2. Ensure the transfer was successfully debited to the JobNexus receiving VPA.
3. Open JobNexus to submit the corrected transaction reference.

Note on Bank Transactions:
Rejection means our administrative team was unable to confirm credit for this reference.
This does not indicate that your bank transaction was reversed or refunded by JobNexus.
`;

  const { html, text } = renderBaseEmail({
    preheader: `Payment verification update for order ${data.orderId}: Reference was not approved.`,
    badgeText: 'Verification Unsuccessful',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeBorder: 'rgba(239, 68, 68, 0.35)',
    badgeColor: '#f87171',
    title: 'Payment Verification Unsuccessful',
    subtitle: 'We were unable to verify the UPI payment reference submitted for your JobNexus order.',
    contentHtml,
    ctaText: 'Review Order & Correct Reference',
    ctaUrl: data.statusUrl,
    ctaBg: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    plainTextContent,
  });

  return {
    subject: `[JobNexus] Update on payment verification: Order ${data.orderId}`,
    html,
    text,
  };
}

