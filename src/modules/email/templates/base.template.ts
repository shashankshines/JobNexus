/**
 * JobNexus Branded Transactional Email Base Layout (Phase 2B.4)
 * Provides high-contrast, responsive HTML email shell, typography, and sanitization.
 */

export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function maskUtr(utr: string): string {
  if (!utr) return '••••••••';
  const clean = utr.trim().toUpperCase();
  if (clean.length <= 4) return '••••' + clean;
  if (clean.length <= 8) return clean.slice(0, 2) + '••••' + clean.slice(-2);
  return clean.slice(0, 4) + '••••••••' + clean.slice(-4);
}

export interface BaseEmailProps {
  preheader: string;
  badgeText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaBg?: string;
  plainTextContent: string;
}

export function renderBaseEmail(props: BaseEmailProps): { html: string; text: string } {
  const {
    preheader,
    badgeText,
    badgeBg,
    badgeBorder,
    badgeColor,
    title,
    subtitle,
    contentHtml,
    ctaText,
    ctaUrl,
    ctaBg = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    plainTextContent,
  } = props;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #080c14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <!-- Preview Text (Hidden in email body) -->
  <div style="display: none; font-size: 1px; color: #080c14; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080c14; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container (Max 580px) -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0d1321; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);">
          
          <!-- Top Header Bar -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(13, 19, 33, 0) 100%);">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; vertical-align: middle;">
                      <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">Job<span style="color: #818cf8;">Nexus</span></span>
                      <span style="font-size: 11px; font-weight: 700; color: #a5b4fc; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); padding: 2px 7px; border-radius: 6px; margin-left: 8px; vertical-align: middle; text-transform: uppercase;">PREMIUM</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 32px 32px 28px 32px;">
              <!-- Status Badge -->
              <div style="margin-bottom: 16px;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; background: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor};">
                  ${escapeHtml(badgeText)}
                </span>
              </div>

              <!-- Title & Subtitle -->
              <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.55; color: #94a3b8;">
                ${escapeHtml(subtitle)}
              </p>

              <!-- Dynamic Body Content -->
              ${contentHtml}

              <!-- Primary CTA (if provided) -->
              ${
                ctaText && ctaUrl
                  ? `
              <div style="margin: 32px 0 16px 0; text-align: center;">
                <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; width: 100%; box-sizing: border-box; padding: 14px 24px; border-radius: 12px; background: ${ctaBg}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; text-align: center; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
                  ${escapeHtml(ctaText)}
                </a>
                <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b;">
                  Or open this link: <a href="${escapeHtml(ctaUrl)}" style="color: #818cf8; text-decoration: underline;">${escapeHtml(ctaUrl)}</a>
                </p>
              </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="padding: 24px 32px; background-color: rgba(3, 7, 18, 0.5); border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 12px; line-height: 1.5; color: #64748b;">
              <p style="margin: 0 0 8px 0;">
                <strong>JobNexus Billing & Subscription Service</strong><br>
                This transactional email was sent to confirm an administrative billing event.
              </p>
              <p style="margin: 0 0 8px 0; font-size: 11px;">
                <strong>Security Invariant:</strong> Manual UPI subscriptions are verified independently against banking statement records by authorized human administrators. JobNexus never requests your UPI PIN, passwords, or full bank account details.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} JobNexus. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `=====================================================
JOBNEXUS PREMIUM — ${badgeText.toUpperCase()}
=====================================================

${title}
${subtitle}

${plainTextContent}

${ctaText && ctaUrl ? `\n>>> ${ctaText}: ${ctaUrl}\n` : ''}

-----------------------------------------------------
Security Notice:
Manual UPI payments are independently verified against bank statements by human administrators. JobNexus never asks for your UPI PIN or passwords.

JobNexus Billing & Subscription Service
© ${new Date().getFullYear()} JobNexus. All rights reserved.
`;

  return { html, text };
}

