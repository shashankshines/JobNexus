/**
 * Event E1: 30-Day Subscription Expiring Soon / Urgent Renewal Reminder Template
 * Sent at the 5-day pre-expiry window and final 24-hour urgent window.
 */

import { SubscriptionExpiringEmailData, GeneratedEmailContent } from '../email.types';
import { renderBaseEmail, escapeHtml } from './base.template';

export function renderSubscriptionExpiringEmail(
  data: SubscriptionExpiringEmailData
): GeneratedEmailContent {
  const formattedEnd = new Date(data.currentPeriodEnd).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const remainingSummary = data.isUrgent24h
    ? data.hoursRemaining <= 1
      ? 'Less than 1 hour remaining'
      : `${data.hoursRemaining} hours remaining`
    : data.daysRemaining === 1
      ? '1 day remaining'
      : `${data.daysRemaining} days remaining`;

  const contentHtml = `
    <!-- Renewal Summary Card -->
    <div style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0; width: 42%;">Plan:</td>
          <td style="color: #ffffff; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(data.planTitle)}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Renewal Amount:</td>
          <td style="color: #818cf8; font-weight: 800; padding: 6px 0; text-align: right;">₹${data.amountInr} ${escapeHtml(data.currency)} / 30 Days</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Current Cycle Ends:</td>
          <td style="color: #fbbf24; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(formattedEnd)} IST</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Time Remaining:</td>
          <td style="color: ${data.isUrgent24h ? '#f87171' : '#fbbf24'}; font-weight: 700; padding: 6px 0; text-align: right;">${escapeHtml(remainingSummary)}</td>
        </tr>
      </table>
    </div>

    <!-- Zero Lost Time Guarantee -->
    <div style="background-color: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #a5b4fc;">
        Zero Lost Hours When You Renew Early
      </h3>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
        Because JobNexus uses verified Manual UPI billing, memberships never charge your account automatically. Submitting your ₹${data.amountInr} renewal before expiry extends your access by a <strong>full +30 days on top of ${escapeHtml(formattedEnd)}</strong> — you never lose remaining days.
      </p>
    </div>
  `;

  const plainTextContent = `
SUBSCRIPTION RENEWAL REMINDER:
- Plan: ${data.planTitle}
- Renewal Amount: ₹${data.amountInr} ${data.currency} (30 Days)
- Current Cycle Ends: ${formattedEnd} IST
- Time Remaining: ${remainingSummary}

ZERO LOST HOURS:
Renewing before expiry adds a full +30 days directly onto ${formattedEnd} IST so you keep every remaining hour of your current cycle.

Renew your JobNexus Premium membership here:
${data.renewUrl}
`;

  const badgeText = data.isUrgent24h ? 'Final 24h Renewal Notice' : 'Renewal Window Open';
  const title = data.isUrgent24h
    ? 'Your JobNexus Premium Access Expires Within 24 Hours'
    : `Your JobNexus Premium Access Expires in ${data.daysRemaining} ${data.daysRemaining === 1 ? 'Day' : 'Days'}`;

  const { html, text } = renderBaseEmail({
    preheader: `${remainingSummary} on your 30-day JobNexus Premium cycle (ends ${formattedEnd} IST).`,
    badgeText,
    badgeBg: data.isUrgent24h ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
    badgeBorder: data.isUrgent24h ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)',
    badgeColor: data.isUrgent24h ? '#f87171' : '#fbbf24',
    title,
    subtitle:
      'Keep uninterrupted access to unmasked employer identities and direct 1-click ATS application links.',
    contentHtml,
    ctaText: `Renew Premium for +30 Days (₹${data.amountInr})`,
    ctaUrl: data.renewUrl,
    ctaBg: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    plainTextContent,
  });

  const subject = data.isUrgent24h
    ? `[JobNexus] Urgent: Your Premium Membership Expires in <24 Hours`
    : `[JobNexus] Renewal Reminder — Your 30-Day Premium Access Ends in ${data.daysRemaining} ${data.daysRemaining === 1 ? 'Day' : 'Days'}`;

  return { subject, html, text };
}
