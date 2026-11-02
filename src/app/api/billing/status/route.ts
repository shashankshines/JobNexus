import { NextResponse } from 'next/server';
import { validateSession, extractSessionId } from '@/modules/auth/server/session.store';
import { getAuthoritativeUserEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  getSubmissionsByUserId,
  getActiveOrderForUser,
} from '@/modules/storage/firestore/order.store';
import { resolveBillingFlowSnapshot } from '@/modules/billing/domain/billing-flow-state';

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
    // Authoritative parallel read-only lookup directly from Cloud Firestore
    const [entitlement, submissions, activeOrder] = await Promise.all([
      getAuthoritativeUserEntitlement(auth.user.id),
      getSubmissionsByUserId(auth.user.id),
      getActiveOrderForUser(auth.user.id),
    ]);

    const billingFlow = resolveBillingFlowSnapshot({
      entitlement,
      submissions,
      activeOrder,
    });

    return NextResponse.json(
      {
        authenticated: true,
        entitlement,
        billingFlow,
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
