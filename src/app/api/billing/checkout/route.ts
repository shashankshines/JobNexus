import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { validateSession, extractSessionId } from '@/modules/auth/server/session.store';
import { PREMIUM_PLAN, SubscriptionRecord } from '@/modules/billing/domain/subscription.types';
import { getUserEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  saveSubscription,
  getSubscriptionByUserId,
} from '@/modules/billing/services/subscription.store';
import { createRazorpayCheckout } from '@/modules/billing/providers/razorpay.provider';

export async function POST(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to initiate subscription checkout.' },
      { status: 401 }
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed, defaults to premium_monthly
    }

    const planId = (body.planId as string) || PREMIUM_PLAN.id;
    if (planId !== PREMIUM_PLAN.id) {
      return NextResponse.json(
        { error: `Invalid plan specified. Only '${PREMIUM_PLAN.id}' is supported.` },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription
    const currentEntitlement = getUserEntitlement(auth.user.id);
    if (currentEntitlement.isPremium && currentEntitlement.status === 'active' && !currentEntitlement.subscription?.cancelAtPeriodEnd) {
      return NextResponse.json(
        {
          error: 'You already have an active JobNexus Premium membership.',
          alreadySubscribed: true,
          entitlement: currentEntitlement,
        },
        { status: 409 }
      );
    }

    // Generate checkout payload (server enforces ₹499 amount)
    const checkoutResult = await createRazorpayCheckout(auth.user.id, auth.user.email);

    // Save pending subscription record in durable store
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const existingSub = getSubscriptionByUserId(auth.user.id);
    const subRecord: SubscriptionRecord = {
      id: existingSub?.id || `sub_${crypto.randomBytes(8).toString('hex')}`,
      userId: auth.user.id,
      planId: PREMIUM_PLAN.id,
      status: 'created',
      provider: checkoutResult.isMock ? 'test' : 'razorpay',
      providerSubscriptionId: checkoutResult.subscriptionId,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: existingSub?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      idempotencyKey: checkoutResult.subscriptionId,
    };

    saveSubscription(subRecord);

    return NextResponse.json({
      success: true,
      plan: {
        id: PREMIUM_PLAN.id,
        name: PREMIUM_PLAN.name,
        priceInr: PREMIUM_PLAN.priceInr,
        amountInPaise: PREMIUM_PLAN.amountInPaise,
        currency: PREMIUM_PLAN.currency,
        interval: PREMIUM_PLAN.interval,
      },
      checkout: checkoutResult,
    });
  } catch (error) {
    console.error('[Billing Checkout Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate checkout.' },
      { status: 500 }
    );
  }
}

