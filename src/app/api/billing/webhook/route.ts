import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRazorpayWebhookSignature,
  parseRazorpayWebhookEvent,
} from '@/modules/billing/providers/razorpay.provider';
import {
  getSubscriptionById,
  getSubscriptionByUserId,
  saveSubscription,
  recordBillingEvent,
} from '@/modules/billing/services/subscription.store';
import { SubscriptionRecord, PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // 1. Webhook Signature Verification
    const isValidSignature = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      console.warn('[Billing Webhook] Rejected invalid or unverified webhook signature.');
      return NextResponse.json(
        { error: 'Invalid or unverified webhook signature' },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // 2. Event Idempotency Check
    const eventId =
      (typeof payload.event_id === 'string' && payload.event_id) ||
      (typeof payload.id === 'string' && payload.id) ||
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const eventType = typeof payload.event === 'string' ? payload.event : 'unknown';

    const recorded = recordBillingEvent({
      id: eventId,
      provider: 'razorpay',
      eventType,
      payload,
      createdAt: new Date().toISOString(),
    });

    if (!recorded) {
      // Event already recorded & processed safely
      return NextResponse.json({
        received: true,
        duplicate: true,
        message: 'Event already processed',
      });
    }

    // 3. Parse Event Lifecycle
    const parsed = parseRazorpayWebhookEvent(payload);
    if (!parsed) {
      return NextResponse.json({ received: true, ignored: true });
    }

    // 4. Locate or initialize subscription record
    let sub: SubscriptionRecord | undefined;
    if (parsed.providerSubscriptionId) {
      sub = getSubscriptionById(parsed.providerSubscriptionId);
    }
    if (!sub && parsed.userId) {
      sub = getSubscriptionByUserId(parsed.userId);
    }

    if (sub) {
      // Update existing subscription
      if (parsed.status) {
        sub.status = parsed.status;
      }
      if (parsed.currentPeriodStart) {
        sub.currentPeriodStart = parsed.currentPeriodStart;
      }
      if (parsed.currentPeriodEnd) {
        sub.currentPeriodEnd = parsed.currentPeriodEnd;
      }
      if (parsed.providerPaymentId) {
        sub.providerPaymentId = parsed.providerPaymentId;
      }
      if (parsed.providerCustomerId) {
        sub.providerCustomerId = parsed.providerCustomerId;
      }
      if (parsed.eventType === 'subscription.cancelled') {
        sub.cancelAtPeriodEnd = false; // explicitly cancelled
        sub.cancelledAt = new Date().toISOString();
      }

      saveSubscription(sub);
      return NextResponse.json({
        received: true,
        processed: true,
        subscriptionId: sub.id,
        status: sub.status,
      });
    }

    // If subscription was created out-of-band or first webhook charge arrives
    if (parsed.userId && parsed.status) {
      const now = new Date().toISOString();
      const newSub: SubscriptionRecord = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: parsed.userId,
        planId: PREMIUM_PLAN.id,
        status: parsed.status,
        provider: 'razorpay',
        providerSubscriptionId: parsed.providerSubscriptionId,
        providerCustomerId: parsed.providerCustomerId,
        providerPaymentId: parsed.providerPaymentId,
        currentPeriodStart: parsed.currentPeriodStart || now,
        currentPeriodEnd: parsed.currentPeriodEnd || now,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      };

      saveSubscription(newSub);
      return NextResponse.json({
        received: true,
        processed: true,
        subscriptionId: newSub.id,
        status: newSub.status,
      });
    }

    return NextResponse.json({
      received: true,
      processed: false,
      message: 'No associated subscription found',
    });
  } catch (error) {
    console.error('[Billing Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal webhook error' }, { status: 500 });
  }
}
