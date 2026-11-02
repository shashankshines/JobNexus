import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { sweepAllSubscriptionRenewalNotifications } from '@/modules/billing/services/renewal-notifications.service';

/**
 * Verifies a Vercel Cron `Authorization: Bearer <CRON_SECRET>` header using
 * constant-time comparison. Fails closed when `CRON_SECRET` is unset or empty.
 */
function hasValidCronSecret(request: Request): boolean {
  const configuredSecret = (process.env.CRON_SECRET || '').trim();
  if (!configuredSecret) return false;

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const provided = authHeader.slice('Bearer '.length).trim();
  if (!provided || provided.length !== configuredSecret.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, 'utf8'),
      Buffer.from(configuredSecret, 'utf8')
    );
  } catch {
    return false;
  }
}

async function handleRenewalSweep(request: Request) {
  const isCronAuthorized = hasValidCronSecret(request);

  if (!isCronAuthorized) {
    const adminAuth = await authorizeAdminRequest(request);
    if (!adminAuth.authorized) {
      return NextResponse.json(
        { error: adminAuth.error || 'Unauthorized cron invocation.' },
        { status: adminAuth.statusCode }
      );
    }
  }

  try {
    const summary = await sweepAllSubscriptionRenewalNotifications();
    return NextResponse.json(
      {
        success: true,
        summary,
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[Billing Renewal Cron Error]:', error);
    return NextResponse.json(
      { error: 'Failed to complete subscription renewal notification sweep.' },
      { status: 503 }
    );
  }
}

export async function GET(request: Request) {
  return handleRenewalSweep(request);
}

export async function POST(request: Request) {
  return handleRenewalSweep(request);
}
