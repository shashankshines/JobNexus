import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  getOrdersCollection,
  getSubmissionsCollection,
  getSubscriptionsCollection,
  getAuditLogsCollection,
  PaymentOrderDocument,
  PaymentSubmissionDocument,
  SubscriptionDocument,
  AdminAuditLogDocument,
} from '@/modules/storage/firestore/collections';
import {
  getUser360Profile,
  getConsolidatedPaymentLedger,
  getAdminSubscriptions,
} from '@/modules/storage/firestore/admin-billing.store';
import {
  createSession,
  findOrCreateGoogleUser,
  resetAuthStore,
} from '@/modules/auth/server/session.store';

// API Routes to test
import { GET as getUser360Route } from '@/app/api/admin/users/[userId]/route';
import { GET as getLedgerRoute } from '@/app/api/admin/billing/ledger/route';

describe('JobNexus — Admin Console Phase 2B.3C: User 360°, Payment Ledger & Subscriber Management', () => {
  let mockStore: InMemoryFirestoreStore;
  const adminEmail = 'shashankshines@gmail.com';
  const normalUserEmail = 'subscriber@example.com';

  beforeEach(() => {
    resetAuthStore();
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    process.env.ADMIN_EMAILS = adminEmail;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  // Helper to create an admin session token
  async function createAdminSessionId(): Promise<string> {
    const user = await findOrCreateGoogleUser({
      sub: 'google_admin_sub_123',
      email: adminEmail,
      name: 'Shashank Lakhotia',
      picture: 'https://example.com/photo.jpg',
    });
    const { sessionId } = createSession(user.id);
    return sessionId;
  }

  // Helper to create a regular user session token
  async function createRegularUserSessionId(): Promise<string> {
    const user = await findOrCreateGoogleUser({
      sub: 'google_regular_sub_456',
      email: normalUserEmail,
      name: 'Regular User',
      picture: 'https://example.com/user.jpg',
    });
    const { sessionId } = createSession(user.id);
    return sessionId;
  }

  describe('1. User 360° Profile Dossier (getUser360Profile)', () => {
    it('aggregates identity, authoritative subscription, orders, submissions, and timeline for a payment-backed subscriber', async () => {
      // 1. Seed user in auth store
      const user = await findOrCreateGoogleUser({
        sub: 'google_sub_360',
        email: 'alice@example.com',
        name: 'Alice Wonder',
      });

      // 2. Seed order
      const order: PaymentOrderDocument = {
        orderId: 'ord_alice_1',
        userId: user.id,
        userEmail: 'alice@example.com',
        planId: 'premium_monthly',
        amountInr: 499,
        amountInPaise: 49900,
        currency: 'INR',
        status: 'submitted',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus Tech',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
      };
      await getOrdersCollection().doc(order.orderId).set(order);

      // 3. Seed submission
      const submission: PaymentSubmissionDocument = {
        submissionId: 'subm_alice_1',
        orderId: order.orderId,
        userId: user.id,
        userEmail: 'alice@example.com',
        utrNumber: '998877665544',
        declaredAmount: 499,
        paymentDate: '2026-10-28',
        submittedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
        slaDeadlineAt: new Date(Date.now() + 3600000 * 4).toISOString(),
        status: 'approved',
        decisionReason: 'Verified credit in ICICI statement',
        reviewedBy: adminEmail,
        reviewedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      };
      await getSubmissionsCollection().doc(submission.submissionId).set(submission);

      // 4. Seed active subscription
      const subDoc: SubscriptionDocument = {
        id: `sub_${user.id}`,
        userId: user.id,
        userEmail: 'alice@example.com',
        planId: 'premium_monthly',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(Date.now() - 3600000 * 18).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 3600000 * 24 * 28).toISOString(),
        paymentReference: submission.utrNumber,
        provider: 'manual_upi',
        lastUpdatedFrom: 'manual_upi',
        createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      };
      await getSubscriptionsCollection().doc(user.id).set(subDoc);

      // 5. Seed audit log
      const auditLog: AdminAuditLogDocument = {
        id: 'audit_alice_1',
        actorId: 'admin_actor_id',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        action: 'payment_approved',
        actorEmail: adminEmail,
        targetUserId: user.id,
        targetUserEmail: 'alice@example.com',
        targetEntityId: submission.submissionId,
        reason: 'Payment verified',
        newState: { utr: submission.utrNumber, amount: 499 },
      };
      await getAuditLogsCollection().doc(auditLog.id).set(auditLog);

      // Run getUser360Profile by userId
      const dossier = await getUser360Profile(user.id);
      assert.ok(dossier, 'Dossier must be returned');
      assert.strictEqual(dossier.identity.userId, user.id);
      assert.strictEqual(dossier.identity.email, 'alice@example.com');
      assert.strictEqual(dossier.identity.isEmailVerified, true);

      // Subscription & Entitlement check
      assert.ok(dossier.subscription);
      assert.strictEqual(dossier.subscription.isPremium, true);
      assert.strictEqual(dossier.subscription.source, 'payment_backed');
      assert.strictEqual(dossier.subscription.entitlementStatus, 'active');
      assert.ok(dossier.subscription.remainingDays > 25);

      // Orders & Submissions
      assert.strictEqual(dossier.orders.length, 1);
      assert.strictEqual(dossier.orders[0].orderId, order.orderId);
      assert.strictEqual(dossier.submissions.length, 1);
      assert.strictEqual(dossier.submissions[0].utrNumber, '998877665544');

      // Timeline events sorted in descending order
      assert.ok(dossier.timeline.length >= 3, 'Timeline must include order, submission, and audit log');
      for (let i = 0; i < dossier.timeline.length - 1; i++) {
        const curr = new Date(dossier.timeline[i].timestamp).getTime();
        const next = new Date(dossier.timeline[i + 1].timestamp).getTime();
        assert.ok(curr >= next, 'Timeline events must be in descending order');
      }

      // Also verify retrieval by email
      const dossierByEmail = await getUser360Profile('alice@example.com');
      assert.ok(dossierByEmail);
      assert.strictEqual(dossierByEmail.identity.userId, user.id);
    });

    it('identifies manual grant subscriber correctly without payment records', async () => {
      const grantUserId = 'usr_manual_vip_42';
      const subDoc: SubscriptionDocument = {
        id: `sub_${grantUserId}`,
        userId: grantUserId,
        userEmail: 'vip@example.com',
        planId: 'premium_monthly',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 3600000 * 24 * 30).toISOString(),
        paymentReference: undefined,
        provider: 'manual',
        lastUpdatedFrom: 'admin_grant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await getSubscriptionsCollection().doc(grantUserId).set(subDoc);

      const dossier = await getUser360Profile(grantUserId);
      assert.ok(dossier.subscription);
      assert.strictEqual(dossier.subscription.isPremium, true);
      assert.strictEqual(dossier.subscription.source, 'manual_grant');
      assert.strictEqual(dossier.orders.length, 0);
      assert.strictEqual(dossier.submissions.length, 0);
    });

    it('returns free-tier dossier when user has no active subscription', async () => {
      const freeUserId = 'usr_pure_free_99';
      const dossier = await getUser360Profile(freeUserId);
      assert.strictEqual(dossier.identity.userId, freeUserId);
      assert.ok(dossier.subscription === null || !dossier.subscription.isPremium);
      assert.strictEqual(dossier.orders.length, 0);
      assert.strictEqual(dossier.timeline.length, 0);
    });

    it('returns entitlementStatus: suspended when a user subscription is halted', async () => {
      const suspendedUserId = 'usr_suspended_test_55';
      const subDoc: SubscriptionDocument = {
        id: `sub_${suspendedUserId}`,
        userId: suspendedUserId,
        userEmail: 'suspended@example.com',
        planId: 'premium_monthly',
        status: 'halted',
        cancelAtPeriodEnd: false,
        currentPeriodStart: '2026-10-01T00:00:00.000Z',
        currentPeriodEnd: '2026-11-01T00:00:00.000Z',
        provider: 'manual_upi',
        lastUpdatedFrom: 'admin_manual',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
      };
      await getSubscriptionsCollection().doc(suspendedUserId).set(subDoc);

      const dossier = await getUser360Profile(suspendedUserId);
      assert.ok(dossier.subscription);
      assert.strictEqual(dossier.subscription.isPremium, false);
      assert.strictEqual(dossier.subscription.status, 'halted');
      assert.strictEqual(dossier.subscription.entitlementStatus, 'suspended', 'Halted subscription must report suspended in User 360, not expired');
    });

    it('ensures deterministic tie-breaking on identical timeline event timestamps', async () => {
      const tieUserId = 'usr_tie_break_99';
      const sameTimestamp = '2026-10-28T12:00:00.000Z';

      const logA: AdminAuditLogDocument = {
        id: 'log_aaa_first',
        action: 'subscription_extended',
        actorId: 'admin_test_1',
        actorEmail: adminEmail,
        targetEntityId: tieUserId,
        targetUserId: tieUserId,
        timestamp: sameTimestamp,
        reason: 'Reason A',
      };
      const logB: AdminAuditLogDocument = {
        id: 'log_zzz_second',
        action: 'admin_grant',
        actorId: 'admin_test_1',
        actorEmail: adminEmail,
        targetEntityId: tieUserId,
        targetUserId: tieUserId,
        timestamp: sameTimestamp,
        reason: 'Reason B',
      };

      await getAuditLogsCollection().doc(logA.id).set(logA);
      await getAuditLogsCollection().doc(logB.id).set(logB);

      const dossier = await getUser360Profile(tieUserId);
      const auditEvents = dossier.timeline.filter((e) => e.id.startsWith('evt_audit_'));
      assert.strictEqual(auditEvents.length, 2);
      // 'log_aaa_first' vs 'log_zzz_second' should order deterministically
      assert.strictEqual(auditEvents[0].id, 'evt_audit_log_aaa_first');
      assert.strictEqual(auditEvents[1].id, 'evt_audit_log_zzz_second');
    });
  });

  describe('2. Consolidated Payment & Order Ledger (getConsolidatedPaymentLedger)', () => {
    beforeEach(async () => {
      // Seed 3 orders:
      // 1. Order + approved submission (verified payment = ₹499)
      const ord1: PaymentOrderDocument = {
        orderId: 'ord_leg_1',
        userId: 'usr_leg_1',
        userEmail: 'user1@test.com',
        planId: 'premium_monthly',
        amountInr: 499,
        amountInPaise: 49900,
        currency: 'INR',
        status: 'submitted',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus Tech',
        createdAt: '2026-10-25T10:00:00.000Z',
        expiresAt: '2026-10-26T10:00:00.000Z',
      };
      const sub1: PaymentSubmissionDocument = {
        submissionId: 'subm_leg_1',
        orderId: ord1.orderId,
        userId: ord1.userId,
        userEmail: ord1.userEmail,
        utrNumber: '111122223333',
        declaredAmount: 499,
        paymentDate: '2026-10-25',
        submittedAt: '2026-10-25T10:05:00.000Z',
        slaDeadlineAt: '2026-10-25T22:05:00.000Z',
        status: 'approved',
        decisionReason: 'Bank confirmed',
        reviewedBy: adminEmail,
        reviewedAt: '2026-10-25T10:30:00.000Z',
      };

      // 2. Order + pending submission (pending claim = ₹499)
      const ord2: PaymentOrderDocument = {
        orderId: 'ord_leg_2',
        userId: 'usr_leg_2',
        userEmail: 'user2@test.com',
        planId: 'premium_monthly',
        amountInr: 499,
        amountInPaise: 49900,
        currency: 'INR',
        status: 'submitted',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus Tech',
        createdAt: '2026-10-26T12:00:00.000Z',
        expiresAt: '2026-10-27T12:00:00.000Z',
      };
      const sub2: PaymentSubmissionDocument = {
        submissionId: 'subm_leg_2',
        orderId: ord2.orderId,
        userId: ord2.userId,
        userEmail: ord2.userEmail,
        utrNumber: '444455556666',
        declaredAmount: 499,
        paymentDate: '2026-10-26',
        submittedAt: '2026-10-26T12:05:00.000Z',
        slaDeadlineAt: '2026-10-27T00:05:00.000Z',
        status: 'pending_verification',
      };

      // 3. Order created but never submitted (unsubmitted checkout)
      const ord3: PaymentOrderDocument = {
        orderId: 'ord_leg_3',
        userId: 'usr_leg_3',
        userEmail: 'user3@test.com',
        planId: 'premium_monthly',
        amountInr: 499,
        amountInPaise: 49900,
        currency: 'INR',
        status: 'created',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus Tech',
        createdAt: '2026-10-27T14:00:00.000Z',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      // Also seed a manual grant subscription (must be excluded from payment revenue)
      const manualSub: SubscriptionDocument = {
        id: 'sub_manual_vip',
        userId: 'usr_manual_vip',
        userEmail: 'manual_vip@test.com',
        planId: 'premium_monthly',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: '2026-10-25T00:00:00.000Z',
        currentPeriodEnd: '2026-11-25T00:00:00.000Z',
        provider: 'manual',
        lastUpdatedFrom: 'admin_grant',
        createdAt: '2026-10-25T00:00:00.000Z',
        updatedAt: '2026-10-25T00:00:00.000Z',
      };

      await getOrdersCollection().doc(ord1.orderId).set(ord1);
      await getOrdersCollection().doc(ord2.orderId).set(ord2);
      await getOrdersCollection().doc(ord3.orderId).set(ord3);
      await getSubmissionsCollection().doc(sub1.submissionId).set(sub1);
      await getSubmissionsCollection().doc(sub2.submissionId).set(sub2);
      await getSubscriptionsCollection().doc(manualSub.userId).set(manualSub);
    });

    it('calculates financial integrity metrics accurately without inflating revenue with manual grants', async () => {
      const { summary, total } = await getConsolidatedPaymentLedger({});

      assert.strictEqual(total, 3, 'Total ledger records should be 3 orders');
      assert.strictEqual(summary.verifiedRevenueInr, 499, 'Only approved payments contribute to verified revenue (1 * 499)');
      assert.strictEqual(summary.verifiedPaymentsCount, 1);
      assert.strictEqual(summary.pendingClaimedRevenueInr, 499, 'Pending claims = 499');
      assert.strictEqual(summary.pendingSubmissionsCount, 1);
      assert.strictEqual(summary.unsubmittedOrdersCount, 1);
      assert.strictEqual(summary.manualGrantsExcludedCount, 1, 'Manual grant should be recognized and excluded');
      assert.ok(summary.refundPolicyNote.includes('Refunds and payment reversals are not automated'));
    });

    it('filters ledger records by status', async () => {
      const verifiedResult = await getConsolidatedPaymentLedger({ status: 'verified' });
      assert.strictEqual(verifiedResult.records.length, 1);
      assert.strictEqual(verifiedResult.records[0].orderId, 'ord_leg_1');

      const pendingResult = await getConsolidatedPaymentLedger({ status: 'pending' });
      assert.strictEqual(pendingResult.records.length, 1);
      assert.strictEqual(pendingResult.records[0].orderId, 'ord_leg_2');

      const unsubmittedResult = await getConsolidatedPaymentLedger({ status: 'unsubmitted' });
      assert.strictEqual(unsubmittedResult.records.length, 1);
      assert.strictEqual(unsubmittedResult.records[0].orderId, 'ord_leg_3');
    });

    it('filters ledger records by search query (UTR, Order ID, User Email)', async () => {
      // By UTR
      const utrResult = await getConsolidatedPaymentLedger({ query: '111122223333' });
      assert.strictEqual(utrResult.records.length, 1);
      assert.strictEqual(utrResult.records[0].orderId, 'ord_leg_1');

      // By Order ID
      const orderResult = await getConsolidatedPaymentLedger({ query: 'ord_leg_2' });
      assert.strictEqual(orderResult.records.length, 1);

      // By Email
      const emailResult = await getConsolidatedPaymentLedger({ query: 'user3@test.com' });
      assert.strictEqual(emailResult.records.length, 1);
      assert.strictEqual(emailResult.records[0].orderId, 'ord_leg_3');
    });

    it('handles missing paymentDate accurately without substituting submission timestamp', async () => {
      // Seed submission with undefined paymentDate (simulating legacy document without paymentDate)
      const subNoDate = {
        submissionId: 'subm_no_date_99',
        orderId: 'ord_leg_1',
        userId: 'usr_leg_1',
        userEmail: 'user1@test.com',
        utrNumber: '999988887777',
        declaredAmount: 499,
        paymentDate: undefined,
        submittedAt: '2026-10-29T10:00:00.000Z',
        slaDeadlineAt: '2026-10-29T22:00:00.000Z',
        status: 'pending_verification',
      } as unknown as PaymentSubmissionDocument;
      await getSubmissionsCollection().doc(subNoDate.submissionId).set(subNoDate);

      const result = await getConsolidatedPaymentLedger({ query: '999988887777' });
      assert.strictEqual(result.records.length, 1);
      assert.strictEqual(result.records[0].paymentDate, undefined, 'Must not substitute submission timestamp for paymentDate');
    });

    it('detects duplicate UTR references and flags isDuplicateUtr', async () => {
      const duplicateUtr = 'DUPLICATE1234';
      const subA: PaymentSubmissionDocument = {
        submissionId: 'subm_dup_a',
        orderId: 'ord_leg_1',
        userId: 'usr_leg_1',
        userEmail: 'user1@test.com',
        utrNumber: duplicateUtr,
        declaredAmount: 499,
        paymentDate: '2026-10-28',
        submittedAt: '2026-10-28T10:00:00.000Z',
        slaDeadlineAt: '2026-10-28T22:00:00.000Z',
        status: 'pending_verification',
      };
      const subB: PaymentSubmissionDocument = {
        submissionId: 'subm_dup_b',
        orderId: 'ord_leg_2',
        userId: 'usr_leg_2',
        userEmail: 'user2@test.com',
        utrNumber: duplicateUtr,
        declaredAmount: 499,
        paymentDate: '2026-10-28',
        submittedAt: '2026-10-28T11:00:00.000Z',
        slaDeadlineAt: '2026-10-28T23:00:00.000Z',
        status: 'pending_verification',
      };

      await getSubmissionsCollection().doc(subA.submissionId).set(subA);
      await getSubmissionsCollection().doc(subB.submissionId).set(subB);

      const result = await getConsolidatedPaymentLedger({ query: duplicateUtr });
      assert.strictEqual(result.records.length, 2);
      assert.strictEqual(result.records[0].isDuplicateUtr, true);
      assert.strictEqual(result.records[1].isDuplicateUtr, true);
      assert.ok(result.summary.unresolvedReviewCount > 0, 'Unresolved review count must flag duplicate UTR claims');
    });

    it('identifies orphan submissions without order records as isOrphan', async () => {
      const orphanSub: PaymentSubmissionDocument = {
        submissionId: 'subm_orphan_999',
        orderId: 'ord_non_existent_999',
        userId: 'usr_orphan_999',
        userEmail: 'orphan@test.com',
        utrNumber: 'ORPHANUTR888',
        declaredAmount: 499,
        paymentDate: '2026-10-28',
        submittedAt: '2026-10-28T09:00:00.000Z',
        slaDeadlineAt: '2026-10-28T21:00:00.000Z',
        status: 'pending_verification',
      };
      await getSubmissionsCollection().doc(orphanSub.submissionId).set(orphanSub);

      const result = await getConsolidatedPaymentLedger({ query: 'ORPHANUTR888' });
      assert.strictEqual(result.records.length, 1);
      assert.strictEqual(result.records[0].isOrphan, true, 'Submission without matching order must have isOrphan: true');
      assert.strictEqual(result.records[0].status, 'pending');
      assert.ok(result.summary.unresolvedReviewCount > 0);
    });
  });

  describe('3. Subscriber Management Enhancements (getAdminSubscriptions)', () => {
    beforeEach(async () => {
      const now = Date.now();
      // 1. Payment backed active subscriber (expires in 20 days)
      const sub1: SubscriptionDocument = {
        id: 'sub_usr_sub_1',
        userId: 'usr_sub_1',
        userEmail: 'paid@example.com',
        planId: 'premium_monthly',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(now - 3600000 * 24 * 10).toISOString(),
        currentPeriodEnd: new Date(now + 3600000 * 24 * 20).toISOString(),
        provider: 'manual_upi',
        lastUpdatedFrom: 'manual_upi',
        paymentReference: 'UTR123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 2. Manual grant expiring soon (expires in 3 days)
      const sub2: SubscriptionDocument = {
        id: 'sub_usr_sub_2',
        userId: 'usr_sub_2',
        userEmail: 'expiring@example.com',
        planId: 'premium_monthly',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(now - 3600000 * 24 * 27).toISOString(),
        currentPeriodEnd: new Date(now + 3600000 * 24 * 3).toISOString(),
        provider: 'manual',
        lastUpdatedFrom: 'admin_grant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Suspended subscriber
      const sub3: SubscriptionDocument = {
        id: 'sub_usr_sub_3',
        userId: 'usr_sub_3',
        userEmail: 'suspended@example.com',
        planId: 'premium_monthly',
        status: 'halted',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(now - 3600000 * 24 * 10).toISOString(),
        currentPeriodEnd: new Date(now + 3600000 * 24 * 20).toISOString(),
        provider: 'manual',
        lastUpdatedFrom: 'admin_manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await getSubscriptionsCollection().doc(sub1.userId).set(sub1);
      await getSubscriptionsCollection().doc(sub2.userId).set(sub2);
      await getSubscriptionsCollection().doc(sub3.userId).set(sub3);
    });

    it('filters subscribers by source: payment_backed vs manual_grant', async () => {
      const paymentSubs = await getAdminSubscriptions({ source: 'payment_backed' });
      assert.strictEqual(paymentSubs.length, 1);
      assert.strictEqual(paymentSubs[0].userId, 'usr_sub_1');

      const manualSubs = await getAdminSubscriptions({ source: 'manual_grant' });
      assert.strictEqual(manualSubs.length, 2);
    });

    it('filters subscribers expiring soon (within 7 days)', async () => {
      const expiringSubs = await getAdminSubscriptions({ expiringSoon: true });
      assert.strictEqual(expiringSubs.length, 1);
      assert.strictEqual(expiringSubs[0].userId, 'usr_sub_2');
    });

    it('filters subscribers by status (active vs suspended)', async () => {
      const suspended = await getAdminSubscriptions({ entitlementStatus: 'suspended' });
      assert.strictEqual(suspended.length, 1);
      assert.strictEqual(suspended[0].userId, 'usr_sub_3');
    });
  });

  describe('4. API Route Authorization Guards', () => {
    it('rejects unauthorized requests to /api/admin/users/[userId] with 401/403', async () => {
      // Unauthenticated
      const reqUnauth = new NextRequest('http://localhost:3000/api/admin/users/usr_123');
      const resUnauth = await getUser360Route(reqUnauth, { params: Promise.resolve({ userId: 'usr_123' }) });
      assert.strictEqual(resUnauth.status, 401);

      // Non-admin user
      const userSessionId = await createRegularUserSessionId();
      const reqNonAdmin = new NextRequest('http://localhost:3000/api/admin/users/usr_123', {
        headers: { authorization: `Bearer ${userSessionId}` },
      });
      const resNonAdmin = await getUser360Route(reqNonAdmin, { params: Promise.resolve({ userId: 'usr_123' }) });
      assert.strictEqual(resNonAdmin.status, 403);
    });

    it('allows designated administrator to query /api/admin/users/[userId]', async () => {
      const adminSessionId = await createAdminSessionId();
      const req = new NextRequest('http://localhost:3000/api/admin/users/usr_target_999', {
        headers: { authorization: `Bearer ${adminSessionId}` },
      });
      const res = await getUser360Route(req, { params: Promise.resolve({ userId: 'usr_target_999' }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.dossier.identity.userId, 'usr_target_999');
    });

    it('rejects unauthorized requests to /api/admin/billing/ledger and allows admin', async () => {
      // Unauthenticated
      const reqUnauth = new NextRequest('http://localhost:3000/api/admin/billing/ledger');
      const resUnauth = await getLedgerRoute(reqUnauth);
      assert.strictEqual(resUnauth.status, 401);

      // Admin allowed
      const adminSessionId = await createAdminSessionId();
      const reqAdmin = new NextRequest('http://localhost:3000/api/admin/billing/ledger?status=all', {
        headers: { authorization: `Bearer ${adminSessionId}` },
      });
      const resAdmin = await getLedgerRoute(reqAdmin);
      assert.strictEqual(resAdmin.status, 200);
      const json = await resAdmin.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.records));
      assert.ok(json.summary);
    });
  });
});
