import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { PREMIUM_PLAN } from '../../billing/domain/subscription.types';
import {
  getUserEntitlement,
  hasActivePremiumAccess,
} from '../../billing/services/entitlement.service';
import {
  saveSubscription,
  resetSubscriptionStore,
  recordBillingEvent,
} from '../../billing/services/subscription.store';
import {
  setMockFirestoreDb,
  resetFirestoreRegistry,
} from '../../storage/firestore/client';
import { createMockFirestoreDb } from '../../storage/firestore/mock';
import {
  getFirestoreSubscriptionByUserId,
  saveFirestoreSubscription,
} from '../../storage/firestore/subscription.store';
import { GET as billingStatusHandler } from '../../../app/api/billing/status/route';
import { POST as billingCheckoutHandler } from '../../../app/api/billing/checkout/route';
import { POST as billingCancelHandler } from '../../../app/api/billing/cancel/route';
import {
  resetAuthStore,
  createSession,
  findOrCreateGoogleUser,
  SESSION_COOKIE_NAME,
} from '../../auth/server/session.store';

function createAuthenticatedSession(userId: string, email = `${userId}@example.com`) {
  const user = findOrCreateGoogleUser({
    email,
    name: 'Test Member',
    sub: userId,
  });
  const session = createSession(user.id);
  return { ...session, user };
}

function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === 'object') {
    headers.set('Content-Type', 'application/json');
  }
  if (options.cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.cookie}`);
  }

  const rawBody =
    typeof options.body === 'string'
      ? options.body
      : options.body
      ? JSON.stringify(options.body)
      : undefined;

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers,
    body: rawBody,
  });
}

describe('JobNexus Premium — Subscription & Entitlement Domain Tests', () => {
  beforeEach(() => {
    resetAuthStore();
    resetSubscriptionStore();
    setMockFirestoreDb(createMockFirestoreDb());
  });

  afterEach(() => {
    setMockFirestoreDb(undefined);
    resetFirestoreRegistry();
  });

  // =========================================================================
  // 1. Plan Definition & Server Enforced Pricing
  // =========================================================================
  it('enforces fixed ₹499/month pricing parameters server-side', () => {
    assert.strictEqual(PREMIUM_PLAN.id, 'premium_monthly');
    assert.strictEqual(PREMIUM_PLAN.name, 'JobNexus Premium');
    assert.strictEqual(PREMIUM_PLAN.priceInr, 499);
    assert.strictEqual(PREMIUM_PLAN.amountInPaise, 49900);
    assert.strictEqual(PREMIUM_PLAN.currency, 'INR');
    assert.strictEqual(PREMIUM_PLAN.interval, 'monthly');
    assert.ok(PREMIUM_PLAN.taxTerms.includes('GST'));
    assert.ok(PREMIUM_PLAN.disclaimer.includes('JobNexus is a career discovery'));
  });

  // =========================================================================
  // 2. Entitlement Evaluation State Machine
  // =========================================================================
  it('defaults non-subscribers to free tier with isPremium = false', () => {
    const entitlement = getUserEntitlement('user_anon_123');
    assert.strictEqual(entitlement.userId, 'user_anon_123');
    assert.strictEqual(entitlement.tier, 'free');
    assert.strictEqual(entitlement.isPremium, false);
    assert.strictEqual(entitlement.status, 'free');
    assert.strictEqual(hasActivePremiumAccess('user_anon_123'), false);
  });

  it('keeps pending or created checkout subscriptions at free tier', () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400 * 1000);

    saveSubscription({
      id: 'sub_test_created_1',
      userId: 'user_pending_1',
      planId: 'premium_monthly',
      status: 'created',
      provider: 'test',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const ent = getUserEntitlement('user_pending_1');
    assert.strictEqual(ent.isPremium, false);
    assert.strictEqual(ent.tier, 'free');
  });

  it('grants Premium access when subscription is active and within paid period', () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400 * 1000);

    saveSubscription({
      id: 'sub_test_active_1',
      userId: 'user_active_1',
      planId: 'premium_monthly',
      status: 'active',
      provider: 'razorpay',
      providerSubscriptionId: 'sub_rzp_live_123',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const ent = getUserEntitlement('user_active_1');
    assert.strictEqual(ent.isPremium, true);
    assert.strictEqual(ent.tier, 'premium');
    assert.strictEqual(ent.status, 'active');
    assert.strictEqual(hasActivePremiumAccess('user_active_1'), true);
  });

  it('revokes Premium access when active subscription billing period expires', () => {
    const expiredStart = new Date(Date.now() - 60 * 86400 * 1000);
    const expiredEnd = new Date(Date.now() - 30 * 86400 * 1000); // Expired 30 days ago

    saveSubscription({
      id: 'sub_test_expired_1',
      userId: 'user_expired_1',
      planId: 'premium_monthly',
      status: 'active',
      provider: 'razorpay',
      currentPeriodStart: expiredStart.toISOString(),
      currentPeriodEnd: expiredEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: expiredStart.toISOString(),
      updatedAt: expiredStart.toISOString(),
    });

    const ent = getUserEntitlement('user_expired_1');
    assert.strictEqual(ent.isPremium, false);
    assert.strictEqual(ent.status, 'expired');
    assert.strictEqual(hasActivePremiumAccess('user_expired_1'), false);
  });

  it('retains Premium grace period access when cancelled at period end until expiry', () => {
    const now = new Date();
    const futureEnd = new Date(now.getTime() + 15 * 86400 * 1000); // 15 days remaining

    saveSubscription({
      id: 'sub_test_cancel_grace_1',
      userId: 'user_cancel_grace_1',
      planId: 'premium_monthly',
      status: 'active',
      provider: 'razorpay',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: futureEnd.toISOString(),
      cancelAtPeriodEnd: true,
      cancelledAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const ent = getUserEntitlement('user_cancel_grace_1');
    assert.strictEqual(ent.isPremium, true);
    assert.strictEqual(ent.status, 'cancelled_grace');
    assert.ok(ent.reason.includes('scheduled cancellation') || ent.reason.includes('cancellation scheduled'));
  });

  // =========================================================================
  // 3. Billing Event Recording & Idempotency
  // =========================================================================
  it('safely handles duplicate billing events with idempotency guard', () => {
    const eventId = 'evt_unique_test_456';
    const firstAttempt = recordBillingEvent({
      id: eventId,
      provider: 'manual_upi',
      eventType: 'payment_verified',
      payload: { id: eventId },
      createdAt: new Date().toISOString(),
    });
    assert.strictEqual(firstAttempt, true);

    const secondAttempt = recordBillingEvent({
      id: eventId,
      provider: 'manual_upi',
      eventType: 'payment_verified',
      payload: { id: eventId },
      createdAt: new Date().toISOString(),
    });
    assert.strictEqual(secondAttempt, false); // Blocked duplicate
  });

  // =========================================================================
  // 4. API Endpoints Integration Tests
  // =========================================================================
  it('GET /api/billing/status requires authentication', async () => {
    const req = createMockRequest('http://localhost:3000/api/billing/status');
    const res = await billingStatusHandler(req);
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/billing/status returns user entitlement with Cache-Control headers', async () => {
    const session = createAuthenticatedSession('user_auth_status_1');
    const req = createMockRequest('http://localhost:3000/api/billing/status', {
      cookie: session.sessionId,
    });

    const res = await billingStatusHandler(req);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('cache-control')?.includes('no-store'));

    const data = await res.json();
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.entitlement.userId, session.user.id);
    assert.strictEqual(data.entitlement.tier, 'free');
  });

  it('POST /api/billing/checkout initiates ₹499 checkout and prevents duplicate subscriptions', async () => {
    const session = createAuthenticatedSession('user_checkout_test_1');
    const req = createMockRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      cookie: session.sessionId,
      body: { planId: 'premium_monthly' },
    });

    const res = await billingCheckoutHandler(req);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.plan.amountInPaise, 49900);
    assert.strictEqual(data.plan.priceInr, 499);
    assert.ok(data.checkout.orderId);

    // Attempting checkout while actively subscribed returns 409 Conflict
    await saveFirestoreSubscription({
      id: 'sub_test_active',
      userId: session.user.id,
      planId: 'premium_monthly',
      status: 'active',
      provider: 'manual_upi',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const conflictReq = createMockRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      cookie: session.sessionId,
      body: {},
    });
    const conflictRes = await billingCheckoutHandler(conflictReq);
    assert.strictEqual(conflictRes.status, 409);
  });

  it('POST /api/billing/checkout rejects unauthorized client-specified plans', async () => {
    const session = createAuthenticatedSession('user_tamper_1');
    const req = createMockRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      cookie: session.sessionId,
      body: { planId: 'hacked_free_plan' },
    });

    const res = await billingCheckoutHandler(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid plan specified'));
  });

  it('POST /api/billing/cancel isolates by authenticated user and schedules period-end cancellation', async () => {
    // Set up user A with active subscription in Cloud Firestore
    const sessionA = createAuthenticatedSession('user_a_cancel');
    const future = new Date(Date.now() + 20 * 86400 * 1000).toISOString();

    await saveFirestoreSubscription({
      id: 'sub_user_a',
      userId: sessionA.user.id,
      planId: 'premium_monthly',
      status: 'active',
      provider: 'razorpay',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: future,
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Set up user B
    const sessionB = createAuthenticatedSession('user_b_cancel');

    // User B attempts to cancel when having no subscription -> 404
    const reqB = createMockRequest('http://localhost:3000/api/billing/cancel', {
      method: 'POST',
      cookie: sessionB.sessionId,
    });
    const resB = await billingCancelHandler(reqB);
    assert.strictEqual(resB.status, 404);

    // User A cancels their own subscription -> 200 with grace period preserved
    const reqA = createMockRequest('http://localhost:3000/api/billing/cancel', {
      method: 'POST',
      cookie: sessionA.sessionId,
    });
    const resA = await billingCancelHandler(reqA);
    assert.strictEqual(resA.status, 200);

    const dataA = await resA.json();
    assert.strictEqual(dataA.success, true);
    assert.strictEqual(dataA.entitlement.status, 'cancelled_grace');
    assert.strictEqual(dataA.entitlement.isPremium, true); // Retains access until period end

    const updatedSub = await getFirestoreSubscriptionByUserId(sessionA.user.id);
    assert.strictEqual(updatedSub?.cancelAtPeriodEnd, true);
    assert.ok(updatedSub?.cancelledAt);
  });
});
