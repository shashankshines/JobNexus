import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { getAuthoritativeUserEntitlement } from '../../billing/services/entitlement.service';
import {
  setMockFirestoreDb,
  resetFirestoreRegistry,
} from '../../storage/firestore/client';
import { createMockFirestoreDb, InMemoryFirestoreStore } from '../../storage/firestore/mock';
import { saveFirestoreSubscription } from '../../storage/firestore/subscription.store';
import {
  getOrdersCollection,
  FIRESTORE_COLLECTIONS,
} from '../../storage/firestore/collections';
import {
  createPaymentOrder,
  getPaymentOrderById,
  createPaymentSubmission,
  getBusinessUpiConfig,
  isValidPaymentDate,
} from '../../storage/firestore/order.store';
import {
  normalizeUtr,
  isValidUtrFormat,
  getUtrReservationRef,
} from '../../storage/firestore/utr-reservation';
import {
  resetAuthStore,
  createSession,
  findOrCreateGoogleUser,
  SESSION_COOKIE_NAME,
} from '../../auth/server/session.store';
import { POST as billingOrderPostHandler, GET as billingOrderGetHandler } from '../../../app/api/billing/order/route';
import { POST as billingSubmitPostHandler, GET as billingSubmitGetHandler } from '../../../app/api/billing/submit/route';
import { POST as billingCheckoutHandler } from '../../../app/api/billing/checkout/route';
import { GET as billingStatusHandler } from '../../../app/api/billing/status/route';

function createAuthenticatedSession(userId: string, email = `${userId}@example.com`) {
  const user = findOrCreateGoogleUser({
    email,
    name: `User ${userId}`,
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
  if (options.cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.cookie}`);
  }
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
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

describe('JobNexus — Manual UPI Payment Foundation (Phase 2B.1)', () => {
  let mockStore: InMemoryFirestoreStore;

  beforeEach(() => {
    resetAuthStore();
    resetFirestoreRegistry();
    mockStore = new InMemoryFirestoreStore();
    const mockDb = createMockFirestoreDb(mockStore);
    setMockFirestoreDb(mockDb);
    process.env.BUSINESS_UPI_ID = 'jobnexus@icici';
    process.env.BUSINESS_UPI_NAME = 'JobNexus Official';
  });

  afterEach(() => {
    resetAuthStore();
    resetFirestoreRegistry();
    setMockFirestoreDb(undefined);
  });

  // ==========================================================================
  // 1. Business UPI Configuration & Helper Invariants
  // ==========================================================================
  describe('1. Business UPI Configuration & Helper Invariants', () => {
    it('retrieves configured business UPI parameters', () => {
      const config = getBusinessUpiConfig();
      assert.strictEqual(config.upiId, 'jobnexus@icici');
      assert.strictEqual(config.payeeName, 'JobNexus Official');
    });

    it('validates payment dates correctly within the 30-day window', () => {
      const today = new Date().toISOString().split('T')[0];
      assert.strictEqual(isValidPaymentDate(today), true);

      // Yesterday
      const yesterday = new Date(Date.now() - 86400 * 1000).toISOString().split('T')[0];
      assert.strictEqual(isValidPaymentDate(yesterday), true);

      // 40 days ago -> invalid
      const longAgo = new Date(Date.now() - 40 * 86400 * 1000).toISOString().split('T')[0];
      assert.strictEqual(isValidPaymentDate(longAgo), false);

      // 5 days into future -> invalid
      const future = new Date(Date.now() + 5 * 86400 * 1000).toISOString().split('T')[0];
      assert.strictEqual(isValidPaymentDate(future), false);

      // Malformed strings
      assert.strictEqual(isValidPaymentDate('not-a-date'), false);
      assert.strictEqual(isValidPaymentDate('2026/10/29'), false);
      assert.strictEqual(isValidPaymentDate(''), false);
    });

    it('normalizes and validates legitimate UPI transaction references (UTRs)', () => {
      assert.strictEqual(normalizeUtr('UPI/ 429817293812 /ok'), '429817293812OK');
      assert.strictEqual(normalizeUtr('  utr: 9283-1283-9182  '), '928312839182');

      // Valid format
      assert.strictEqual(isValidUtrFormat('429817293812'), true);
      assert.strictEqual(isValidUtrFormat('AXIS1928374829'), true);

      // Invalid format (too short, too long, trivial patterns)
      assert.strictEqual(isValidUtrFormat('123'), false); // too short
      assert.strictEqual(isValidUtrFormat('000000000000'), false); // trivial
      assert.strictEqual(isValidUtrFormat('111111111111'), false); // single repeating char
      assert.strictEqual(isValidUtrFormat('123456789012'), false); // sequential pattern
    });
  });

  // ==========================================================================
  // 2. Order Creation & Retrieval API (/api/billing/order)
  // ==========================================================================
  describe('2. Payment Order Lifecycle (/api/billing/order)', () => {
    it('requires authentication to create a payment order', async () => {
      const req = createMockRequest('/api/billing/order', { method: 'POST' });
      const res = await billingOrderPostHandler(req);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.error.includes('Unauthorized'));
    });

    it('creates server-authoritative ₹499 order with 24h expiry', async () => {
      const session = createAuthenticatedSession('usr_order_1');
      const req = createMockRequest('/api/billing/order', {
        method: 'POST',
        cookie: session.sessionId,
      });

      const res = await billingOrderPostHandler(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.reused, false);
      assert.ok(data.order.orderId.startsWith('ord_'));
      assert.strictEqual(data.order.amountInr, 499);
      assert.strictEqual(data.order.amountInPaise, 49900);
      assert.strictEqual(data.order.currency, 'INR');
      assert.strictEqual(data.order.planId, 'premium_monthly');
      assert.strictEqual(data.order.status, 'created');
      assert.strictEqual(data.order.upiId, 'jobnexus@icici');
      assert.strictEqual(data.order.payeeName, 'JobNexus Official');

      // Check 24-hour expiry
      const createdTime = new Date(data.order.createdAt).getTime();
      const expiresTime = new Date(data.order.expiresAt).getTime();
      const diffHours = (expiresTime - createdTime) / (1000 * 60 * 60);
      assert.strictEqual(Math.round(diffHours), 24);

      // Verify order persisted in Firestore
      const persisted = await getPaymentOrderById(data.order.orderId);
      assert.ok(persisted);
      assert.strictEqual(persisted.userId, session.user.id);
    });

    it('reuses existing unexpired order idempotently across requests', async () => {
      const session = createAuthenticatedSession('usr_order_reuse');

      // First call -> creates new order
      const req1 = createMockRequest('/api/billing/order', {
        method: 'POST',
        cookie: session.sessionId,
      });
      const res1 = await billingOrderPostHandler(req1);
      const data1 = await res1.json();
      assert.strictEqual(res1.status, 201);
      assert.strictEqual(data1.reused, false);

      // Second call -> returns existing active order
      const req2 = createMockRequest('/api/billing/order', {
        method: 'POST',
        cookie: session.sessionId,
      });
      const res2 = await billingOrderPostHandler(req2);
      const data2 = await res2.json();
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(data2.reused, true);
      assert.strictEqual(data2.order.orderId, data1.order.orderId);

      // Third call with ?new=true -> creates fresh order
      const req3 = createMockRequest('/api/billing/order?new=true', {
        method: 'POST',
        cookie: session.sessionId,
      });
      const res3 = await billingOrderPostHandler(req3);
      const data3 = await res3.json();
      assert.strictEqual(res3.status, 201);
      assert.strictEqual(data3.reused, false);
      assert.notStrictEqual(data3.order.orderId, data1.order.orderId);
    });

    it('rejects order creation if user already has active Premium membership', async () => {
      const session = createAuthenticatedSession('usr_already_prem');

      // Give user active subscription in Firestore
      await saveFirestoreSubscription({
        id: 'sub_active_existing',
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

      const req = createMockRequest('/api/billing/order', {
        method: 'POST',
        cookie: session.sessionId,
      });
      const res = await billingOrderPostHandler(req);
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.alreadySubscribed, true);
    });

    it('enforces user ownership when retrieving orders by ID', async () => {
      const sessionA = createAuthenticatedSession('usr_owner_a');
      const sessionB = createAuthenticatedSession('usr_owner_b');

      const orderA = await createPaymentOrder({ userId: sessionA.user.id });

      // User A retrieves own order -> 200
      const reqA = createMockRequest(`/api/billing/order?orderId=${orderA.orderId}`, {
        cookie: sessionA.sessionId,
      });
      const resA = await billingOrderGetHandler(reqA);
      assert.strictEqual(resA.status, 200);
      const dataA = await resA.json();
      assert.strictEqual(dataA.order.orderId, orderA.orderId);

      // User B attempts to access User A's order -> 403 Forbidden
      const reqB = createMockRequest(`/api/billing/order?orderId=${orderA.orderId}`, {
        cookie: sessionB.sessionId,
      });
      const resB = await billingOrderGetHandler(reqB);
      assert.strictEqual(resB.status, 403);
    });

    it('returns 404 when querying an order that does not exist', async () => {
      const session = createAuthenticatedSession('usr_not_found');
      const req = createMockRequest('/api/billing/order?orderId=ord_nonexistent_123', {
        cookie: session.sessionId,
      });
      const res = await billingOrderGetHandler(req);
      assert.strictEqual(res.status, 404);
    });
  });

  // ==========================================================================
  // 3. Payment Submission & Transaction Safety (/api/billing/submit)
  // ==========================================================================
  describe('3. Payment Submission & Transaction Safety (/api/billing/submit)', () => {
    it('requires authentication to submit a payment reference', async () => {
      const req = createMockRequest('/api/billing/submit', {
        method: 'POST',
        body: { orderId: 'ord_1', utr: '492817291823', declaredAmount: 499, paymentDate: '2026-10-28' },
      });
      const res = await billingSubmitPostHandler(req);
      assert.strictEqual(res.status, 401);
    });

    it('rejects submissions with missing or invalid fields', async () => {
      const session = createAuthenticatedSession('usr_invalid_submit');

      // Missing orderId
      const req1 = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: { utr: '492817291823', declaredAmount: 499, paymentDate: '2026-10-28' },
      });
      const res1 = await billingSubmitPostHandler(req1);
      assert.strictEqual(res1.status, 400);

      // Missing utr
      const req2 = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: { orderId: 'ord_1', declaredAmount: 499, paymentDate: '2026-10-28' },
      });
      const res2 = await billingSubmitPostHandler(req2);
      assert.strictEqual(res2.status, 400);

      // Invalid amount
      const req3 = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: { orderId: 'ord_1', utr: '492817291823', declaredAmount: -10, paymentDate: '2026-10-28' },
      });
      const res3 = await billingSubmitPostHandler(req3);
      assert.strictEqual(res3.status, 400);

      // Invalid UTR format
      const req4 = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: { orderId: 'ord_1', utr: '000000000000', declaredAmount: 499, paymentDate: '2026-10-28' },
      });
      const res4 = await billingSubmitPostHandler(req4);
      assert.strictEqual(res4.status, 400);
      const data4 = await res4.json();
      assert.strictEqual(data4.code, 'INVALID_UTR');
    });

    it('atomically reserves UTR, creates submission with 12h SLA, and marks order submitted', async () => {
      const session = createAuthenticatedSession('usr_valid_submit');
      const order = await createPaymentOrder({ userId: session.user.id });
      const validUtr = '429817293812';
      const today = new Date().toISOString().split('T')[0];

      const req = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: {
          orderId: order.orderId,
          utr: `UPI/ ${validUtr}`,
          declaredAmount: 499,
          paymentDate: today,
          verificationNotes: 'Paid via GPay to JobNexus ICICI',
        },
      });

      const res = await billingSubmitPostHandler(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.submission.orderId, order.orderId);
      assert.strictEqual(data.submission.utrNumber, validUtr);
      assert.strictEqual(data.submission.status, 'pending_verification');
      assert.strictEqual(data.submission.declaredAmount, 499);
      assert.strictEqual(data.submission.paymentDate, today);

      // Verify 12-hour SLA deadline
      const submittedTime = new Date(data.submission.submittedAt).getTime();
      const slaDeadline = new Date(data.submission.slaDeadlineAt).getTime();
      const diffSlaHours = (slaDeadline - submittedTime) / (1000 * 60 * 60);
      assert.strictEqual(Math.round(diffSlaHours), 12);

      // Verify order status updated to 'submitted'
      const updatedOrder = await getPaymentOrderById(order.orderId);
      assert.strictEqual(updatedOrder?.status, 'submitted');

      // Verify UTR reservation document created with status 'reserved'
      const utrRef = getUtrReservationRef(validUtr);
      const utrSnap = await utrRef.get();
      assert.ok(utrSnap.exists);
      assert.strictEqual(utrSnap.data()?.status, 'reserved');
      assert.strictEqual(utrSnap.data()?.orderId, order.orderId);
      assert.strictEqual(utrSnap.data()?.userId, session.user.id);
    });

    it('detects UTR collision across different users and rejects with 409 Conflict', async () => {
      const sessionA = createAuthenticatedSession('usr_collision_a');
      const sessionB = createAuthenticatedSession('usr_collision_b');

      const orderA = await createPaymentOrder({ userId: sessionA.user.id });
      const orderB = await createPaymentOrder({ userId: sessionB.user.id });

      const sharedUtr = '9876543210AB';
      const today = new Date().toISOString().split('T')[0];

      // User A submits the UTR first
      const reqA = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: sessionA.sessionId,
        body: {
          orderId: orderA.orderId,
          utr: sharedUtr,
          declaredAmount: 499,
          paymentDate: today,
        },
      });
      const resA = await billingSubmitPostHandler(reqA);
      assert.strictEqual(resA.status, 201);

      // User B attempts to submit the same UTR -> 409 Conflict
      const reqB = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: sessionB.sessionId,
        body: {
          orderId: orderB.orderId,
          utr: sharedUtr,
          declaredAmount: 499,
          paymentDate: today,
        },
      });
      const resB = await billingSubmitPostHandler(reqB);
      assert.strictEqual(resB.status, 409);

      const dataB = await resB.json();
      assert.strictEqual(dataB.code, 'UTR_COLLISION');
      assert.ok(dataB.error.includes(sharedUtr));
    });

    it('rejects submission against an already submitted order', async () => {
      const session = createAuthenticatedSession('usr_repeat_order');
      const order = await createPaymentOrder({ userId: session.user.id });
      const today = new Date().toISOString().split('T')[0];

      // Submit once
      const req1 = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: {
          orderId: order.orderId,
          utr: '1122334455AA',
          declaredAmount: 499,
          paymentDate: today,
        },
      });
      const res1 = await billingSubmitPostHandler(req1);
      assert.strictEqual(res1.status, 201);

      // Attempt to submit again with another UTR against the same order -> 409 ORDER_ALREADY_SUBMITTED
      const req2 = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: {
          orderId: order.orderId,
          utr: '9988776655BB',
          declaredAmount: 499,
          paymentDate: today,
        },
      });
      const res2 = await billingSubmitPostHandler(req2);
      assert.strictEqual(res2.status, 409);
      const data2 = await res2.json();
      assert.strictEqual(data2.code, 'ORDER_ALREADY_SUBMITTED');
    });

    it('rejects submission against another user order (403 Forbidden)', async () => {
      const sessionA = createAuthenticatedSession('usr_victim');
      const sessionB = createAuthenticatedSession('usr_attacker');

      const orderA = await createPaymentOrder({ userId: sessionA.user.id });
      const today = new Date().toISOString().split('T')[0];

      // User B tries to submit payment against User A's order
      const req = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: sessionB.sessionId,
        body: {
          orderId: orderA.orderId,
          utr: '3344556677CC',
          declaredAmount: 499,
          paymentDate: today,
        },
      });
      const res = await billingSubmitPostHandler(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.code, 'FORBIDDEN');
    });

    it('rejects submission against an expired order', async () => {
      const session = createAuthenticatedSession('usr_expired_order');
      const order = await createPaymentOrder({ userId: session.user.id });

      // Artificially expire order in Firestore
      const expiredTime = new Date(Date.now() - 3600 * 1000).toISOString();
      await getOrdersCollection().doc(order.orderId).update({ expiresAt: expiredTime });

      const today = new Date().toISOString().split('T')[0];
      const req = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: {
          orderId: order.orderId,
          utr: '5566778899DD',
          declaredAmount: 499,
          paymentDate: today,
        },
      });

      const res = await billingSubmitPostHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'ORDER_EXPIRED');
    });
  });

  // ==========================================================================
  // 4. Entitlement Invariance (Pending Submissions NEVER Grant Premium)
  // ==========================================================================
  describe('4. Entitlement Invariance (Strict Security Gating)', () => {
    it('guarantees that created orders and pending submissions NEVER grant Premium access', async () => {
      const session = createAuthenticatedSession('usr_gating_test');

      // 1. Initially free
      let entitlement = await getAuthoritativeUserEntitlement(session.user.id);
      assert.strictEqual(entitlement.isPremium, false);
      assert.strictEqual(entitlement.tier, 'free');

      // 2. User creates an order
      const order = await createPaymentOrder({ userId: session.user.id });
      entitlement = await getAuthoritativeUserEntitlement(session.user.id);
      assert.strictEqual(entitlement.isPremium, false);
      assert.strictEqual(entitlement.tier, 'free');

      // 3. User submits a payment reference (status: pending_verification)
      const today = new Date().toISOString().split('T')[0];
      await createPaymentSubmission({
        orderId: order.orderId,
        userId: session.user.id,
        utr: '7788990011EE',
        declaredAmount: 499,
        paymentDate: today,
      });

      // 4. Entitlement service must STILL report free
      entitlement = await getAuthoritativeUserEntitlement(session.user.id);
      assert.strictEqual(entitlement.isPremium, false);
      assert.strictEqual(entitlement.tier, 'free');
      assert.strictEqual(entitlement.status, 'free');

      // 5. /api/billing/status route must return isPremium: false
      const statusReq = createMockRequest('/api/billing/status', {
        cookie: session.sessionId,
      });
      const statusRes = await billingStatusHandler(statusReq);
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.authenticated, true);
      assert.strictEqual(statusData.entitlement.isPremium, false);
      assert.strictEqual(statusData.entitlement.tier, 'free');
    });
  });

  // ==========================================================================
  // 5. Submission Listing and Retrieval
  // ==========================================================================
  describe('5. Submission Listing & Retrieval', () => {
    it('retrieves user submissions with strict isolation', async () => {
      const sessionA = createAuthenticatedSession('usr_list_a');
      const sessionB = createAuthenticatedSession('usr_list_b');

      const orderA1 = await createPaymentOrder({ userId: sessionA.user.id });
      const today = new Date().toISOString().split('T')[0];

      const subA1 = await createPaymentSubmission({
        orderId: orderA1.orderId,
        userId: sessionA.user.id,
        utr: '9900112233FF',
        declaredAmount: 499,
        paymentDate: today,
      });

      // User A retrieves their own submission by ID
      const reqA = createMockRequest(`/api/billing/submit?submissionId=${subA1.submissionId}`, {
        cookie: sessionA.sessionId,
      });
      const resA = await billingSubmitGetHandler(reqA);
      assert.strictEqual(resA.status, 200);
      const dataA = await resA.json();
      assert.strictEqual(dataA.submission.submissionId, subA1.submissionId);

      // User B attempts to view User A's submission -> 403 Forbidden
      const reqB = createMockRequest(`/api/billing/submit?submissionId=${subA1.submissionId}`, {
        cookie: sessionB.sessionId,
      });
      const resB = await billingSubmitGetHandler(reqB);
      assert.strictEqual(resB.status, 403);

      // User A lists all their submissions
      const listReqA = createMockRequest('/api/billing/submit', {
        cookie: sessionA.sessionId,
      });
      const listResA = await billingSubmitGetHandler(listReqA);
      assert.strictEqual(listResA.status, 200);
      const listDataA = await listResA.json();
      assert.strictEqual(listDataA.submissions.length, 1);
      assert.strictEqual(listDataA.submissions[0].submissionId, subA1.submissionId);

      // User B has 0 submissions
      const listReqB = createMockRequest('/api/billing/submit', {
        cookie: sessionB.sessionId,
      });
      const listResB = await billingSubmitGetHandler(listReqB);
      assert.strictEqual(listResB.status, 200);
      const listDataB = await listResB.json();
      assert.strictEqual(listDataB.submissions.length, 0);
    });
  });

  // ==========================================================================
  // 6. Refactored Checkout Endpoint (/api/billing/checkout)
  // ==========================================================================
  describe('6. Refactored Checkout Endpoint (/api/billing/checkout)', () => {
    it('creates or retrieves manual UPI payment order without any Razorpay dependency', async () => {
      const session = createAuthenticatedSession('usr_checkout_clean');
      const req = createMockRequest('/api/billing/checkout', {
        method: 'POST',
        cookie: session.sessionId,
        body: { planId: 'premium_monthly' },
      });

      const res = await billingCheckoutHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.checkout.isManualUpi, true);
      assert.strictEqual(data.checkout.upiId, 'jobnexus@icici');
      assert.strictEqual(data.checkout.payeeName, 'JobNexus Official');
      assert.strictEqual(data.checkout.amount, 49900);
      assert.ok(data.order.orderId);
    });
  });

  // ==========================================================================
  // 7. Read-Only Refresh Invariance (/api/billing/submit & /api/billing/status)
  // ==========================================================================
  describe('7. Read-Only Refresh Invariance', () => {
    it('refresh calls are strictly read-only and never mutate records or create orders', async () => {
      const session = createAuthenticatedSession('usr_refresh_readonly');
      const order = await createPaymentOrder({ userId: session.user.id });
      const today = new Date().toISOString().split('T')[0];

      const submission = await createPaymentSubmission({
        orderId: order.orderId,
        userId: session.user.id,
        utr: 'REFRESH999888',
        declaredAmount: 499,
        paymentDate: today,
      });

      // Snapshot orders and submissions collections in Firestore mock
      const ordersColData = mockStore.getCollectionData(FIRESTORE_COLLECTIONS.ORDERS);
      const subColData = mockStore.getCollectionData(FIRESTORE_COLLECTIONS.SUBMISSIONS);
      const ordersCountBefore = ordersColData.size;
      const subBefore = { ...subColData.get(submission.submissionId) };

      // User simulates multiple status refreshes
      for (let i = 0; i < 5; i++) {
        // 1. Refresh submissions list
        const submitReq = createMockRequest('/api/billing/submit', {
          cookie: session.sessionId,
        });
        const submitRes = await billingSubmitGetHandler(submitReq);
        assert.strictEqual(submitRes.status, 200);
        const submitJson = await submitRes.json();
        assert.strictEqual(submitJson.success, true);
        assert.strictEqual(submitJson.submissions[0].status, 'pending_verification');

        // 2. Refresh billing status
        const statusReq = createMockRequest('/api/billing/status', {
          cookie: session.sessionId,
        });
        const statusRes = await billingStatusHandler(statusReq);
        assert.strictEqual(statusRes.status, 200);
        const statusJson = await statusRes.json();
        assert.strictEqual(statusJson.entitlement.isPremium, false);
      }

      // Assert zero mutation invariants
      assert.strictEqual(ordersColData.size, ordersCountBefore, 'No additional orders must be created');
      const subAfter = subColData.get(submission.submissionId);
      assert.deepStrictEqual(subAfter, subBefore, 'Submission record must be completely unmutated');
    });

    it('refresh reflects admin approval without modifying subscription expiry timestamp', async () => {
      const session = createAuthenticatedSession('usr_refresh_approved');
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Seed an approved subscription in Firestore
      await saveFirestoreSubscription({
        id: 'sub_approved_test',
        userId: session.user.id,
        planId: 'premium_monthly',
        status: 'active',
        provider: 'manual_upi',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: expiryDate,
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Refresh billing status
      const statusReq = createMockRequest('/api/billing/status', {
        cookie: session.sessionId,
      });
      const statusRes = await billingStatusHandler(statusReq);
      assert.strictEqual(statusRes.status, 200);
      const statusJson = await statusRes.json();

      assert.strictEqual(statusJson.entitlement.isPremium, true);
      assert.strictEqual(statusJson.entitlement.status, 'active');
      assert.strictEqual(statusJson.entitlement.subscription.currentPeriodEnd, expiryDate);

      // Verify second refresh returns identical expiry timestamp without mutating
      const statusRes2 = await billingStatusHandler(statusReq);
      const statusJson2 = await statusRes2.json();
      assert.strictEqual(statusJson2.entitlement.subscription.currentPeriodEnd, expiryDate);
    });
  });
});
