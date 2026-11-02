import { NextRequest, NextResponse } from 'next/server';
import { validateSession, extractSessionId } from '@/modules/auth/server/session.store';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';
import { getAuthoritativeUserEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  createPaymentOrder,
  getActiveOrderForUser,
  getSubmissionsByUserId,
} from '@/modules/storage/firestore/order.store';
import { getFirestoreSubscriptionByUserId } from '@/modules/storage/firestore/subscription.store';
import {
  evaluateRenewalWindow,
  isAdministrativelyRestrictedSubscription,
} from '@/modules/billing/domain/renewal-window';

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Check authoritative subscription, entitlement, and pending submissions
    let currentEntitlement;
    let subscriptionRecord;
    let submissions;
    try {
      [currentEntitlement, subscriptionRecord, submissions] = await Promise.all([
        getAuthoritativeUserEntitlement(auth.user.id),
        getFirestoreSubscriptionByUserId(auth.user.id),
        getSubmissionsByUserId(auth.user.id),
      ]);
    } catch (err) {
      console.error('[Billing Checkout Error]: Firestore entitlement lookup failed:', err);
      return NextResponse.json(
        { error: 'Subscription service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    if (isAdministrativelyRestrictedSubscription(subscriptionRecord)) {
      return NextResponse.json(
        {
          error:
            'Your subscription is under administrative restriction and ineligible for self-service renewal. Please contact support.',
          restricted: true,
        },
        { status: 403 }
      );
    }

    const hasPendingVerification = submissions.some(
      (s) => s.status === 'pending_verification'
    );
    if (hasPendingVerification) {
      return NextResponse.json(
        {
          error:
            'You already have a UPI payment reference awaiting administrator verification.',
          pendingVerification: true,
        },
        { status: 409 }
      );
    }

    const renewalWindow = evaluateRenewalWindow({
      subscription: subscriptionRecord,
      hasPendingVerification: false,
    });

    if (
      currentEntitlement.isPremium &&
      currentEntitlement.status === 'active' &&
      !currentEntitlement.subscription?.cancelAtPeriodEnd &&
      !renewalWindow.isWithinRenewalWindow
    ) {
      return NextResponse.json(
        {
          error:
            'You already have an active JobNexus Premium membership. Early renewal opens 5 days before your cycle ends.',
          alreadySubscribed: true,
          entitlement: currentEntitlement,
          renewal: renewalWindow,
        },
        { status: 409 }
      );
    }

    // Retrieve or create authoritative payment order
    let order;
    try {
      const active = await getActiveOrderForUser(auth.user.id);
      if (active) {
        order = active;
      } else {
        order = await createPaymentOrder({
          userId: auth.user.id,
          userEmail: auth.user.email,
        });
      }
    } catch (err) {
      console.error('[Billing Checkout Error]: Order creation failed:', err);
      return NextResponse.json(
        { error: 'Failed to initialize payment order. Please try again shortly.' },
        { status: 503 }
      );
    }

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
      order,
      checkout: {
        orderId: order.orderId,
        amount: order.amountInPaise,
        currency: order.currency,
        planId: order.planId,
        upiId: order.upiId,
        payeeName: order.payeeName,
        isManualUpi: true,
      },
    });
  } catch (error) {
    console.error('[Billing Checkout Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate checkout.' },
      { status: 500 }
    );
  }
}
