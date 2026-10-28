import crypto from 'node:crypto';
import { PREMIUM_PLAN, SubscriptionRecord } from '../domain/subscription.types';

export interface CreateCheckoutResult {
  subscriptionId: string;
  orderId?: string;
  keyId?: string;
  amount: number;
  currency: string;
  planId: string;
  isMock: boolean;
}

/**
 * Returns true if real Razorpay credentials are fully configured on the server.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  return Boolean(
    keyId &&
    keySecret &&
    !keyId.includes('placeholder') &&
    !keySecret.includes('placeholder')
  );
}

/**
 * Verifies Razorpay Webhook HMAC-SHA256 signature using the raw request payload.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined
): boolean {
  if (!signature || !rawBody) return false;

  const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  const effectiveSecret =
    secret || (process.env.NODE_ENV !== 'production' ? 'test_webhook_secret_key_12345' : '');

  if (!effectiveSecret) {
    // If webhook secret is unconfigured, reject for security in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Razorpay Webhook] Missing RAZORPAY_WEBHOOK_SECRET in production. Rejecting event.');
    }
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', effectiveSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const providedBuf = Buffer.from(signature.trim(), 'utf-8');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (err) {
    console.error('[Razorpay Webhook Signature Verification Error]:', err);
    return false;
  }
}

/**
 * Creates a server-authorized checkout or subscription object for ₹499/month.
 * Amount, currency, and plan are strictly enforced server-side.
 */
export async function createRazorpayCheckout(
  userId: string,
  userEmail: string
): Promise<CreateCheckoutResult> {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const planId = (process.env.RAZORPAY_PLAN_ID || '').trim();

  // If real credentials are present, invoke Razorpay Subscriptions API
  if (isRazorpayConfigured() && planId) {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        plan_id: planId,
        total_count: 120, // 10 years auto-renew
        quantity: 1,
        customer_notify: 1,
        notes: {
          userId,
          userEmail,
          product: 'JobNexus Premium',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Razorpay Subscription API Error]:', err);
      throw new Error('Failed to create Razorpay subscription session.');
    }

    const data = await response.json();
    return {
      subscriptionId: data.id,
      keyId,
      amount: PREMIUM_PLAN.amountInPaise,
      currency: PREMIUM_PLAN.currency,
      planId: PREMIUM_PLAN.id,
      isMock: false,
    };
  }

  // Safe Sandboxed / Test Mode (when credentials are unconfigured or in tests)
  // In production without keys, fail closed
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Razorpay payment gateway credentials are not configured in production.');
  }

  const mockSubId = `sub_mock_${crypto.randomBytes(8).toString('hex')}`;
  return {
    subscriptionId: mockSubId,
    keyId: keyId || 'rzp_test_placeholder_key',
    amount: PREMIUM_PLAN.amountInPaise,
    currency: PREMIUM_PLAN.currency,
    planId: PREMIUM_PLAN.id,
    isMock: true,
  };
}

/**
 * Translates a verified Razorpay webhook payload into a standardized subscription transition.
 */
export function parseRazorpayWebhookEvent(payload: Record<string, unknown>): {
  eventType: string;
  providerSubscriptionId?: string;
  providerPaymentId?: string;
  providerCustomerId?: string;
  userId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  status?: SubscriptionRecord['status'];
} | null {
  const eventType = typeof payload.event === 'string' ? payload.event : '';
  if (!eventType) return null;

  const entityContainer = payload.payload as Record<string, unknown> | undefined;
  const subEntity = (entityContainer?.subscription as { entity?: Record<string, unknown> } | undefined)?.entity;
  const paymentEntity = (entityContainer?.payment as { entity?: Record<string, unknown> } | undefined)?.entity;

  const providerSubscriptionId =
    (subEntity?.id as string) || (paymentEntity?.subscription_id as string) || undefined;
  const providerPaymentId = (paymentEntity?.id as string) || undefined;
  const providerCustomerId =
    (subEntity?.customer_id as string) || (paymentEntity?.customer_id as string) || undefined;

  const notes = (subEntity?.notes as Record<string, string> | undefined) ||
    (paymentEntity?.notes as Record<string, string> | undefined);
  const userId = notes?.userId;

  let currentPeriodStart: string | undefined;
  let currentPeriodEnd: string | undefined;

  if (subEntity?.current_start && typeof subEntity.current_start === 'number') {
    currentPeriodStart = new Date(subEntity.current_start * 1000).toISOString();
  }
  if (subEntity?.current_end && typeof subEntity.current_end === 'number') {
    currentPeriodEnd = new Date(subEntity.current_end * 1000).toISOString();
  }

  // Default next period: +30 days if not explicitly supplied
  if (!currentPeriodEnd) {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    currentPeriodEnd = nextMonth.toISOString();
  }
  if (!currentPeriodStart) {
    currentPeriodStart = new Date().toISOString();
  }

  let status: SubscriptionRecord['status'] | undefined;

  switch (eventType) {
    case 'subscription.activated':
    case 'subscription.charged':
      status = 'active';
      break;
    case 'subscription.pending':
      status = 'pending';
      break;
    case 'subscription.halted':
      status = 'halted';
      break;
    case 'subscription.cancelled':
    case 'subscription.completed':
      status = 'cancelled';
      break;
    case 'payment.failed':
      status = 'halted';
      break;
    default:
      break;
  }

  return {
    eventType,
    providerSubscriptionId,
    providerPaymentId,
    providerCustomerId,
    userId,
    currentPeriodStart,
    currentPeriodEnd,
    status,
  };
}
