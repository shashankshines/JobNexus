/**
 * Event B: Payment Approved Template (Phase 2B.4)
 * Sent only after an authorized administrator's approval transaction commits successfully.
 */

import { PaymentApprovedEmailData, GeneratedEmailContent } from '../email.types';
import { renderBaseEmail, escapeHtml } from './base.template';

export function renderPaymentApprovedEmail(data: PaymentApprovedEmailData): GeneratedEmailContent {
  const formattedStart = new Date(data.currentPeriodStart).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
  });
  const formattedEnd = new Date(data.currentPeriodEnd).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
  });

  const contentHtml = `
    <!-- Approval Confirmation Card -->
    <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0; width: 40%;">Plan:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(data.planTitle)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Approved Amount:</td>
          <td style="color: #34d399; font-weight: 800; padding: 6px 0; text-align: right;">₹${data.amountInr} ${escapeHtml(data.currency)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Order Reference:</td>
          <td style="color: #e2e8f0; font-family: monospace; font-size: 12px; padding: 6px 0; text-align: right;">${escapeHtml(data.orderId)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Entitlement Status:</td>
          <td style="color: #10b981; font-weight: 700; padding: 6px 0; text-align: right;">ACTIVE (30 Days)</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Valid From:</td>
          <td style="color: #e2e8f0; padding: 6px 0; text-align: right;">${escapeHtml(formattedStart)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Valid Until:</td>
          <td style="color: #34d399; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(formattedEnd)}</td>
        </tr>
      </table>
    </div>

    <!-- Features Unlocked -->
    <div style="background-color: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #34d399;">
        Your Premium Benefits Are Now Unlocked:
      </h3>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #e2e8f0;">
        <li><strong>Unmasked Application Links:</strong> Direct 1-click links to Greenhouse, Lever, Ashby, and top verified employers.</li>
        <li><strong>Verified Company Intelligence:</strong> Direct company insights, authentic roles, and Indian eligibility flags.</li>
        <li><strong>Saved Job Isolation:</strong> Secure cloud bookmarking synced across your devices.</li>
      </ul>
    </div>
  `;

  const plainTextContent = `
PAYMENT VERIFICATION CONFIRMED:
- Plan: ${data.planTitle}
- Approved Amount: ₹${data.amountInr} ${data.currency}
- Order Reference: ${data.orderId}
- Status: ACTIVE (30 Days)
- Period: ${formattedStart} to ${formattedEnd}

UNLOCKED BENEFITS:
- Direct 1-click ATS application links
- Verified company intelligence & Indian eligibility tags
- Cloud-synced saved job isolation

Your Premium membership is now fully active until ${formattedEnd}.
`;

  const { html, text } = renderBaseEmail({
    preheader: `Payment approved! Your JobNexus Premium membership is now active until ${formattedEnd}.`,
    badgeText: 'Payment Approved',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.35)',
    badgeColor: '#34d399',
    title: 'Welcome to JobNexus Premium!',
    subtitle: 'Your ₹499 UPI payment has been verified against our banking records. Your 30-day Premium membership is now active.',
    contentHtml,
    ctaText: 'Access JobNexus Premium',
    ctaUrl: data.statusUrl,
    ctaBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    plainTextContent,
  });

  return {
    subject: `[JobNexus] Payment Approved — Welcome to JobNexus Premium! (Order ${data.orderId})`,
    html,
    text,
  };
}

