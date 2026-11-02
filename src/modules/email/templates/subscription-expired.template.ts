/**
 * Event E2: 30-Day Subscription Expired Notification Template
 * Sent once when a subscriber's 30-day Premium period concludes without a verified renewal.
 */

import { SubscriptionExpiredEmailData, GeneratedEmailContent } from '../email.types';
import { renderBaseEmail, escapeHtml } from './base.template';

export function renderSubscriptionExpiredEmail(
  data: SubscriptionExpiredEmailData
): GeneratedEmailContent {
  const formattedExpiredAt = new Date(data.expiredAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const contentHtml = `
    <!-- Expiration Summary Card -->
    <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0; width: 42%;">Previous Plan:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(data.planTitle)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Period Ended:</td>
          <td style="color: #f87171; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(formattedExpiredAt)} IST</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Current Tier:</td>
          <td style="color: #e2e8f0; font-weight: 600; padding: 6px 0; text-align: right;">Free Discovery</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">30-Day Renewal:</td>
          <td style="color: #818cf8; font-weight: 800; padding: 6px 0; text-align: right;">₹${data.amountInr} ${escapeHtml(data.currency)}</td>
        </tr>
      </table>
    </div>

    <!-- Account Preservation Notice -->
    <div style="background-color: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #34d399;">
        Your Saved Jobs &amp; Account History Are Safe
      </h3>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
        All of your bookmarked roles and account preferences remain securely saved in JobNexus. Renewing for ₹${data.amountInr} restores instant company unmasking and direct 1-click ATS application links for a fresh 30-day cycle.
      </p>
    </div>
  `;

  const plainTextContent = `
SUBSCRIPTION PERIOD ENDED:
- Previous Plan: ${data.planTitle}
- Period Ended: ${formattedExpiredAt} IST
- Current Tier: Free Discovery
- 30-Day Renewal Rate: ₹${data.amountInr} ${data.currency}

YOUR SAVED JOBS ARE SAFE:
All of your bookmarked opportunities and account history remain preserved. Reactivate anytime to restore direct employer ATS application links.

Reactivate JobNexus Premium here:
${data.renewUrl}
`;

  const { html, text } = renderBaseEmail({
    preheader: `Your 30-day JobNexus Premium cycle ended on ${formattedExpiredAt} IST. Renew anytime to restore direct ATS links.`,
    badgeText: 'Membership Expired',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
    badgeColor: '#fbbf24',
    title: 'Your 30-Day JobNexus Premium Period Has Ended',
    subtitle:
      'Your account has transitioned back to Free Discovery. Renew anytime via UPI to restore unmasked direct ATS application links.',
    contentHtml,
    ctaText: `Reactivate Premium for 30 Days (₹${data.amountInr})`,
    ctaUrl: data.renewUrl,
    ctaBg: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    plainTextContent,
  });

  return {
    subject: `[JobNexus] Your 30-Day Premium Membership Has Ended — Renew Anytime`,
    html,
    text,
  };
}
