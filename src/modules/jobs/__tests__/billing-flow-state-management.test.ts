import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import { resolveBillingFlowSnapshot } from '@/modules/billing/domain/billing-flow-state';
import {
  createPaymentOrder,
  createPaymentSubmission,
} from '@/modules/storage/firestore/order.store';
import {
  approvePaymentSubmissionInTransaction,
  rejectPaymentSubmissionInTransaction,
  invalidateAdminStoresCache,
} from '@/modules/storage/firestore/admin-billing.store';
import {
  createSession,
  findOrCreateGoogleUser,
  resetAuthStore,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/server/session.store';
import { resetEmailServiceForTesting } from '@/modules/email/email.service';
import { GET as getBillingStatusRoute } from '@/app/api/billing/status/route';
import type { UserEntitlement } from '@/modules/billing/domain/subscription.types';
import type {
  PaymentOrderDocument,
  PaymentSubmissionDocument,
} from '@/modules/storage/firestore/collections';

describe('Billing Modal Single-Source-of-Truth State Management (Zero Screen Toggle)', () => {
  let firestoreStore: InMemoryFirestoreStore;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'shashankshines@gmail.com';
    firestoreStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(firestoreStore));
    invalidateAdminStoresCache();
    resetAuthStore();
    resetEmailServiceForTesting();
  });

  describe('1. Deterministic Billing Flow Resolver (resolveBillingFlowSnapshot)', () => {
    const freeEntitlement: UserEntitlement = {
      userId: 'usr_test_1',
      isPremium: false,
      tier: 'free',
      status: 'free',
      reason: 'No active subscription',
    };

    const activeEntitlement: UserEntitlement = {
      userId: 'usr_test_1',
      isPremium: true,
      tier: 'premium',
      status: 'active',
      reason: 'Active subscription',
      subscription: {
        id: 'sub_active_1',
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodEnd: '2026-12-02T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        provider: 'manual_upi',
      },
    };

    const expiredEntitlement: UserEntitlement = {
      userId: 'usr_test_1',
      isPremium: false,
      tier: 'free',
      status: 'expired',
      reason: 'Subscription period ended',
    };

    const makeSubmission = (
      overrides: Partial<PaymentSubmissionDocument>
    ): PaymentSubmissionDocument => ({
      submissionId: 'subm_fec128c285a45720',
      orderId: 'ord_a9bfd4e16fd4f64c',
      userId: 'usr_test_1',
      userEmail: 'sweekarshines@gmail.com',
      utrNumber: '123232323333',
      declaredAmount: 499,
      paymentDate: '2026-11-02',
      submittedAt: '2026-11-02T09:00:00.000Z',
      slaDeadlineAt: '2026-11-02T21:00:00.000Z',
      status: 'pending_verification',
      ...overrides,
    });

    const makeOrder = (
      overrides: Partial<PaymentOrderDocument>
    ): PaymentOrderDocument => ({
      orderId: 'ord_fresh_1',
      userId: 'usr_test_1',
      userEmail: 'sweekarshines@gmail.com',
      planId: 'premium_monthly',
      amountInr: 349,
      amountInPaise: 34900,
      currency: 'INR',
      status: 'created',
      upiId: 'jobnexus@icici',
      payeeName: 'JobNexus Technologies',
      createdAt: '2026-11-02T09:10:00.000Z',
      expiresAt: '2026-11-03T09:10:00.000Z',
      ...overrides,
    });

    it('resolves directly to status_view when user has a pending_verification submission (never plan_review)', () => {
      const pending = makeSubmission({ status: 'pending_verification' });
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: freeEntitlement,
        submissions: [pending],
        activeOrder: null,
        checkedAt: '2026-11-02T09:28:21.000Z',
      });

      assert.strictEqual(snapshot.step, 'status_view');
      assert.strictEqual(snapshot.hasPendingVerification, true);
      assert.strictEqual(snapshot.hasRejectedSubmission, false);
      assert.strictEqual(snapshot.submission?.submissionId, 'subm_fec128c285a45720');
      assert.strictEqual(snapshot.order, null);
    });

    it('resolves directly to status_view when user has active Premium with an approved submission', () => {
      const approved = makeSubmission({
        status: 'approved',
        reviewedBy: 'shashankshines@gmail.com',
        reviewedAt: '2026-11-02T10:00:00.000Z',
      });
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: activeEntitlement,
        submissions: [approved],
        activeOrder: null,
      });

      assert.strictEqual(snapshot.step, 'status_view');
      assert.strictEqual(snapshot.submission?.status, 'approved');
      assert.strictEqual(snapshot.hasPendingVerification, false);
      assert.strictEqual(snapshot.hasRejectedSubmission, false);
    });

    it('resolves to status_view even for manual-grant Premium users who have no UPI submission document', () => {
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: activeEntitlement,
        submissions: [],
        activeOrder: null,
      });

      assert.strictEqual(snapshot.step, 'status_view');
      assert.strictEqual(snapshot.submission, null);
      assert.strictEqual(snapshot.hasPendingVerification, false);
    });

    it('allows expired former subscribers with historical approved submissions to renew on plan_review', () => {
      const oldApproved = makeSubmission({
        submissionId: 'subm_old_approved',
        status: 'approved',
        submittedAt: '2026-09-01T10:00:00.000Z',
        reviewedAt: '2026-09-01T11:00:00.000Z',
      });
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: expiredEntitlement,
        submissions: [oldApproved],
        activeOrder: null,
      });

      assert.strictEqual(snapshot.step, 'plan_review');
      assert.strictEqual(snapshot.submission, null);
      assert.strictEqual(snapshot.hasPendingVerification, false);
      assert.strictEqual(snapshot.hasRejectedSubmission, false);
    });

    it('surfaces rejected submission in status_view when user has not started a newer order', () => {
      const rejected = makeSubmission({
        status: 'rejected',
        decisionReason: 'UTR reference did not match bank statement.',
        reviewedAt: '2026-11-02T10:00:00.000Z',
      });
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: freeEntitlement,
        submissions: [rejected],
        activeOrder: null,
      });

      assert.strictEqual(snapshot.step, 'status_view');
      assert.strictEqual(snapshot.hasRejectedSubmission, true);
      assert.strictEqual(snapshot.hasPendingVerification, false);
      assert.strictEqual(
        snapshot.submission?.decisionReason,
        'UTR reference did not match bank statement.'
      );
    });

    it('advances to payment_instructions when user creates a newer order after a rejected submission', () => {
      const rejected = makeSubmission({
        orderId: 'ord_rejected_1',
        status: 'rejected',
        reviewedAt: '2026-11-02T10:00:00.000Z',
      });
      const newerOrder = makeOrder({
        orderId: 'ord_retry_2',
        status: 'created',
        createdAt: '2026-11-02T10:05:00.000Z',
      });

      const snapshot = resolveBillingFlowSnapshot({
        entitlement: freeEntitlement,
        submissions: [rejected],
        activeOrder: newerOrder,
      });

      assert.strictEqual(snapshot.step, 'payment_instructions');
      assert.strictEqual(snapshot.order?.orderId, 'ord_retry_2');
      assert.strictEqual(snapshot.submission, null);
      assert.strictEqual(snapshot.hasRejectedSubmission, false);
    });

    it('resumes payment_instructions when free user has an active unexpired created order', () => {
      const activeOrder = makeOrder({ orderId: 'ord_in_progress' });
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: freeEntitlement,
        submissions: [],
        activeOrder,
      });

      assert.strictEqual(snapshot.step, 'payment_instructions');
      assert.strictEqual(snapshot.order?.orderId, 'ord_in_progress');
      assert.strictEqual(snapshot.submission, null);
    });

    it('defaults to plan_review for free user with no active order or pending submission', () => {
      const snapshot = resolveBillingFlowSnapshot({
        entitlement: freeEntitlement,
        submissions: [],
        activeOrder: null,
      });

      assert.strictEqual(snapshot.step, 'plan_review');
      assert.strictEqual(snapshot.order, null);
      assert.strictEqual(snapshot.submission, null);
      assert.strictEqual(snapshot.hasPendingVerification, false);
      assert.strictEqual(snapshot.hasRejectedSubmission, false);
    });
  });

  describe('2. Atomic GET /api/billing/status Endpoint Lifecycle Integration', () => {
    it('returns authoritative billingFlow alongside entitlement in one read-only round-trip across full lifecycle', async () => {
      const subscriber = findOrCreateGoogleUser({
        sub: 'google_sweekar_state_test',
        email: 'sweekarshines@gmail.com',
        name: 'Sweekar Shines',
      });
      const session = createSession(subscriber.id);

      const callStatus = async () => {
        const req = new NextRequest('http://localhost:3000/api/billing/status', {
          method: 'GET',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${session.sessionId}`,
          },
        });
        const res = await getBillingStatusRoute(req);
        assert.strictEqual(res.status, 200);
        assert.ok(res.headers.get('Cache-Control')?.includes('no-store'));
        return res.json();
      };

      // Stage A: Fresh free user -> plan_review
      const initialData = await callStatus();
      assert.strictEqual(initialData.entitlement.isPremium, false);
      assert.strictEqual(initialData.billingFlow.step, 'plan_review');
      assert.strictEqual(initialData.billingFlow.hasPendingVerification, false);

      // Stage B: Active order created -> payment_instructions
      const order = await createPaymentOrder({
        userId: subscriber.id,
        userEmail: subscriber.email,
      });
      const afterOrderData = await callStatus();
      assert.strictEqual(afterOrderData.billingFlow.step, 'payment_instructions');
      assert.strictEqual(afterOrderData.billingFlow.order.orderId, order.orderId);

      // Stage C: Payment reference submitted -> status_view (Pending Verification) on Frame 1
      const submission = await createPaymentSubmission({
        orderId: order.orderId,
        userId: subscriber.id,
        userEmail: subscriber.email,
        utr: '482910374655',
        declaredAmount: 499,
        paymentDate: new Date().toISOString().split('T')[0],
      });

      const docCountBeforeRead =
        firestoreStore.getCollectionData('upi_orders').size +
        firestoreStore.getCollectionData('upi_submissions').size +
        firestoreStore.getCollectionData('billing_subscriptions').size;

      const pendingData = await callStatus();
      assert.strictEqual(pendingData.entitlement.isPremium, false);
      assert.strictEqual(pendingData.billingFlow.step, 'status_view');
      assert.strictEqual(pendingData.billingFlow.hasPendingVerification, true);
      assert.strictEqual(pendingData.billingFlow.submission.submissionId, submission.submissionId);
      assert.strictEqual(pendingData.billingFlow.submission.status, 'pending_verification');

      const docCountAfterRead =
        firestoreStore.getCollectionData('upi_orders').size +
        firestoreStore.getCollectionData('upi_submissions').size +
        firestoreStore.getCollectionData('billing_subscriptions').size;
      assert.strictEqual(docCountAfterRead, docCountBeforeRead, 'GET /api/billing/status must remain strictly read-only');

      // Stage D: Admin rejects -> status_view (Rejected)
      await rejectPaymentSubmissionInTransaction({
        submissionId: submission.submissionId,
        adminUserId: 'usr_admin_1',
        adminEmail: 'shashankshines@gmail.com',
        reason: 'Incorrect UTR reference entered',
      });
      const rejectedData = await callStatus();
      assert.strictEqual(rejectedData.entitlement.isPremium, false);
      assert.strictEqual(rejectedData.billingFlow.step, 'status_view');
      assert.strictEqual(rejectedData.billingFlow.hasRejectedSubmission, true);
      assert.strictEqual(rejectedData.billingFlow.submission.status, 'rejected');

      // Stage E: User starts a fresh order & submits valid UTR, Admin approves -> status_view (Active Premium)
      const secondOrder = await createPaymentOrder({
        userId: subscriber.id,
        userEmail: subscriber.email,
      });
      const secondSub = await createPaymentSubmission({
        orderId: secondOrder.orderId,
        userId: subscriber.id,
        userEmail: subscriber.email,
        utr: '983746512098',
        declaredAmount: 499,
        paymentDate: new Date().toISOString().split('T')[0],
      });
      await approvePaymentSubmissionInTransaction({
        submissionId: secondSub.submissionId,
        adminUserId: 'usr_admin_1',
        adminEmail: 'shashankshines@gmail.com',
        verificationNotes: 'Verified against ICICI corporate statement',
      });

      const approvedData = await callStatus();
      assert.strictEqual(approvedData.entitlement.isPremium, true);
      assert.strictEqual(approvedData.billingFlow.step, 'status_view');
      assert.strictEqual(approvedData.billingFlow.hasPendingVerification, false);
      assert.strictEqual(approvedData.billingFlow.submission.status, 'approved');
    });
  });

  describe('3. UI Anti-Flicker & Managed State Invariants', () => {
    it('prevents UpiPaymentFlow from defaulting to plan_review before billing resolution or running post-mount /api/billing/submit screen flips', () => {
      const upiFlowPath = path.join(
        process.cwd(),
        'src/app/components/billing/UpiPaymentFlow.tsx'
      );
      const source = fs.readFileSync(upiFlowPath, 'utf8');

      assert.ok(
        !source.includes("useState<UpiPaymentStep>('plan_review')"),
        'UpiPaymentFlow must not unconditionally initialize step to plan_review'
      );
      assert.ok(
        !source.includes('checkInitialStatus'),
        'UpiPaymentFlow must not run legacy post-mount checkInitialStatus screen-flip effect'
      );
      assert.ok(
        !/fetch\(\s*['"]\/api\/billing\/submit['"]\s*,\s*\{\s*cache:/.test(source),
        'UpiPaymentFlow must not trigger a GET /api/billing/submit lookup on mount'
      );
      assert.ok(
        source.includes('isResolvingInitialState'),
        'UpiPaymentFlow must guard unresolved cold mounts instead of flashing plan_review'
      );
    });

    it('wires preloaded billingFlow from AuthContext through page.tsx into PremiumOfferModal', () => {
      const authPath = path.join(process.cwd(), 'src/app/context/AuthContext.tsx');
      const pagePath = path.join(process.cwd(), 'src/app/page.tsx');
      const modalPath = path.join(process.cwd(), 'src/app/components/PremiumOfferModal.tsx');

      const authSource = fs.readFileSync(authPath, 'utf8');
      const pageSource = fs.readFileSync(pagePath, 'utf8');
      const modalSource = fs.readFileSync(modalPath, 'utf8');

      assert.ok(authSource.includes('setBillingFlow(data.billingFlow)'));
      assert.ok(authSource.includes('isBillingResolved'));
      assert.ok(pageSource.includes('billingFlow={billingFlow}'));
      assert.ok(pageSource.includes('isBillingResolved={isBillingResolved}'));
      assert.ok(pageSource.includes('onBillingFlowChange={syncBillingFlow}'));
      assert.ok(
        pageSource.includes('if (isHeroPaused || isPremiumOfferOpen || isProfileModalOpen) return;'),
        'Hero word rotation timer must pause while modals are open'
      );
      assert.ok(modalSource.includes('billingFlow={billingFlow}'));
      assert.ok(modalSource.includes('isBillingResolved={isBillingResolved}'));
    });
  });
});
