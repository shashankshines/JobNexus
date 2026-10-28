import { NextRequest, NextResponse } from 'next/server';
import {
  extractSessionId,
  validateSession,
} from '@/modules/auth/server/session.store';
import {
  getSubscriptionByUserId,
  saveSubscription,
} from '@/modules/billing/services/subscription.store';
import { getUserEntitlement } from '@/modules/billing/services/entitlement.service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionId = extractSessionId(request);
    const auth = validateSession(sessionId);

    if (!auth.valid || !auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to manage subscription.' },
        { status: 401 }
      );
    }

    // Strict user isolation: look up subscription only for the authenticated user ID
    const sub = getSubscriptionByUserId(auth.user.id);
    if (!sub || sub.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'No active subscription found for this account' },
        { status: 404 }
      );
    }

    if (sub.status === 'cancelled') {
      return NextResponse.json(
        {
          message: 'Subscription is already cancelled',
          entitlement: getUserEntitlement(auth.user.id),
        },
        { status: 200 }
      );
    }

    // Schedule cancellation for the end of the paid billing period
    const now = new Date().toISOString();
    sub.cancelAtPeriodEnd = true;
    sub.cancelledAt = now;
    sub.updatedAt = now;

    saveSubscription(sub);

    const entitlement = getUserEntitlement(auth.user.id);

    return NextResponse.json({
      success: true,
      message: 'Subscription will cancel at the end of your billing cycle. You retain full Premium access until then.',
      entitlement,
    });
  } catch (error) {
    console.error('[Billing Cancel Error]:', error);
    return NextResponse.json({ error: 'Failed to process cancellation request' }, { status: 500 });
  }
}
