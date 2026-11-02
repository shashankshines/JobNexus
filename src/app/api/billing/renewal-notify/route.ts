import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import { dispatchUserRenewalNotificationIfDue } from '@/modules/billing/services/renewal-notifications.service';

/**
 * POST /api/billing/renewal-notify
 *
 * Authenticated, idempotent endpoint that evaluates the signed-in subscriber's
 * 30-day renewal window and dispatches any due pre-expiry (5-day / 24-hour)
 * or post-expiry email notification.
 *
 * Kept strictly separate from `GET /api/billing/status` so status polling remains
 * 100% read-only.
 */
export async function POST(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to check renewal notifications.' },
      { status: 401 }
    );
  }

  try {
    const result = await dispatchUserRenewalNotificationIfDue({
      userId: auth.user.id,
      fallbackEmail: auth.user.email,
    });

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[Billing Renewal Notify Error]:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate renewal notification.' },
      { status: 503 }
    );
  }
}
