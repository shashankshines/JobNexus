import { NextRequest, NextResponse } from 'next/server';
import { validateSession, extractSessionId } from '@/modules/auth/server/session.store';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';
import { getAuthoritativeUserEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  createPaymentOrder,
  getPaymentOrderById,
  getActiveOrderForUser,
} from '@/modules/storage/firestore/order.store';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to create a payment order.' },
      { status: 401 }
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional, defaults to premium_monthly
    }

    const planId = (body.planId as string) || PREMIUM_PLAN.id;
    if (planId !== PREMIUM_PLAN.id) {
      return NextResponse.json(
        { error: `Invalid plan specified. Only '${PREMIUM_PLAN.id}' is supported.` },
        { status: 400 }
      );
    }

    // Check if user already holds an active Premium membership
    let currentEntitlement;
    try {
      currentEntitlement = await getAuthoritativeUserEntitlement(auth.user.id);
    } catch (err) {
      console.error('[Billing Order POST Error]: Firestore entitlement lookup failed:', err);
      return NextResponse.json(
        { error: 'Subscription service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    if (
      currentEntitlement.isPremium &&
      currentEntitlement.status === 'active' &&
      !currentEntitlement.subscription?.cancelAtPeriodEnd
    ) {
      return NextResponse.json(
        {
          error: 'You already have an active JobNexus Premium membership.',
          alreadySubscribed: true,
          entitlement: currentEntitlement,
        },
        { status: 409 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceNew = searchParams.get('new') === 'true';

    // Check for an active unexpired order unless a new one was explicitly requested
    if (!forceNew) {
      try {
        const existingOrder = await getActiveOrderForUser(auth.user.id);
        if (existingOrder) {
          return NextResponse.json({
            success: true,
            order: existingOrder,
            reused: true,
            instructions: {
              upiId: existingOrder.upiId,
              payeeName: existingOrder.payeeName,
              amountInr: existingOrder.amountInr,
              note: existingOrder.paymentDescription
                ? `${existingOrder.paymentDescription} - ${existingOrder.orderId}`
                : `JobNexus Premium - ${existingOrder.orderId}`,
            },
          });
        }
      } catch (err) {
        console.error('[Billing Order POST Error]: Firestore lookup for active order failed:', err);
        return NextResponse.json(
          { error: 'Storage service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
    }

    // Create a new order with server-enforced amount (₹499)
    try {
      const newOrder = await createPaymentOrder({
        userId: auth.user.id,
        userEmail: auth.user.email,
      });
      return NextResponse.json(
        {
          success: true,
          order: newOrder,
          reused: false,
          instructions: {
            upiId: newOrder.upiId,
            payeeName: newOrder.payeeName,
            amountInr: newOrder.amountInr,
            note: newOrder.paymentDescription
              ? `${newOrder.paymentDescription} - ${newOrder.orderId}`
              : `JobNexus Premium - ${newOrder.orderId}`,
          },
        },
        { status: 201 }
      );
    } catch (err) {
      console.error('[Billing Order POST Error]: Firestore save failed:', err);
      return NextResponse.json(
        { error: 'Failed to create payment order. Please try again shortly.' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('[Billing Order POST Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal order error.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to retrieve payment orders.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  try {
    if (orderId) {
      const order = await getPaymentOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: `Order "${orderId}" not found.` }, { status: 404 });
      }

      // Enforce user ownership isolation
      if (order.userId !== auth.user.id) {
        return NextResponse.json(
          { error: 'Forbidden. You do not have permission to access this order.' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, order });
    }

    // If no orderId is provided, return the most recent active order for this user
    const activeOrder = await getActiveOrderForUser(auth.user.id);
    if (!activeOrder) {
      return NextResponse.json(
        { error: 'No active payment order found for this user.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, order: activeOrder });
  } catch (err) {
    console.error('[Billing Order GET Error]:', err);
    return NextResponse.json(
      { error: 'Storage service temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }
}

