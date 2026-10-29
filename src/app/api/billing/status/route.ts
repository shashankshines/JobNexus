import { NextResponse } from 'next/server';
import { validateSession, extractSessionId } from '@/modules/auth/server/session.store';
import { getAuthoritativeUserEntitlement } from '@/modules/billing/services/entitlement.service';

export async function GET(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to view subscription status.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  }

  try {
    // Authoritative production read directly from Cloud Firestore
    const entitlement = await getAuthoritativeUserEntitlement(auth.user.id);

    return NextResponse.json(
      {
        authenticated: true,
        entitlement,
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    // Fail closed: Never silently fall back to stale local storage or free tier on operational failure
    console.error('[Billing Status Error]: Authoritative Firestore entitlement lookup failed:', error);
    return NextResponse.json(
      { error: 'Subscription service temporarily unavailable. Please try again shortly.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
