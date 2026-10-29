import { NextRequest, NextResponse } from 'next/server';
import {
  extractSessionId,
  validateSession,
} from '@/modules/auth/server/session.store';
import { getAuthoritativeUserEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  getFirestoreSubscriptionByUserId,
  saveFirestoreSubscription,
} from '@/modules/storage/firestore/subscription.store';
import type { SubscriptionRecord } from '@/modules/billing/domain/subscription.types';

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

    // Strict user isolation: look up subscription exclusively in Cloud Firestore
    let sub: SubscriptionRecord | null = null;
    try {
      sub = await getFirestoreSubscriptionByUserId(auth.user.id);
    } catch (err) {
      console.error('[Billing Cancel Error]: Firestore subscription lookup failed:', err);
      return NextResponse.json(
        { error: 'Subscription service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    if (!sub || sub.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'No active subscription found for this account' },
        { status: 404 }
      );
    }

    if (sub.status === 'cancelled') {
      const entitlement = await getAuthoritativeUserEntitlement(auth.user.id);
      return NextResponse.json(
        {
          message: 'Subscription is already cancelled',
          entitlement,
        },
        { status: 200 }
      );
    }

    // Schedule cancellation for the end of the paid billing period
    const now = new Date().toISOString();
    sub.cancelAtPeriodEnd = true;
    sub.cancelledAt = now;
    sub.updatedAt = now;

    try {
      await saveFirestoreSubscription(sub, { lastUpdatedFrom: 'user_cancel' });
    } catch (err) {
      console.error('[Billing Cancel Error]: Firestore save failed:', err);
      return NextResponse.json(
        { error: 'Failed to record cancellation. Please try again shortly.' },
        { status: 503 }
      );
    }

    const entitlement = await getAuthoritativeUserEntitlement(auth.user.id);

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
