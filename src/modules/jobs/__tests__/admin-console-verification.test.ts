import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import {
  InMemoryFirestoreStore,
  createMockFirestoreDb,
} from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  PaymentOrderDocument,
  PaymentSubmissionDocument,
  UtrReservationDocument,
  SubscriptionDocument,
} from '@/modules/storage/firestore/collections';
import {
  getAdminOverview,
  approvePaymentSubmissionInTransaction,
  rejectPaymentSubmissionInTransaction,
  adminManualGrantSubscriptionInTransaction,
  adminSuspendSubscriptionInTransaction,
  adminReinstateSubscriptionInTransaction,
  getAdminAuditLogs,
} from '@/modules/storage/firestore/admin-billing.store';
import { evaluateSubscriptionEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  createSession,
  findOrCreateGoogleUser,
  registerCredentialsUser,
  expireSessionForTesting,
  resetAuthStore,
} from '@/modules/auth/server/session.store';

// API Routes
import { GET as getOverviewRoute } from '@/app/api/admin/overview/route';
import { GET as getSubmissionsRoute } from '@/app/api/admin/billing/submissions/route';
import { POST as approveRoute } from '@/app/api/admin/billing/submissions/approve/route';
import { POST as rejectRoute } from '@/app/api/admin/billing/submissions/reject/route';
import { GET as getSubscriptionsRoute } from '@/app/api/admin/subscriptions/route';
import { POST as controlRoute } from '@/app/api/admin/subscriptions/control/route';
import { GET as getAuditLogsRoute } from '@/app/api/admin/audit-logs/route';

describe('JobNexus — Admin Console Forensic Verification & Entitlement Controls (Phase 2B.3B)', () => {
  let mockStore: InMemoryFirestoreStore;
  const designatedAdminEmail = 'shashankshines@gmail.com';
  const nonAdminEmail = 'regular.user@gmail.com';

  beforeEach(() => {
    resetAuthStore();
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    process.env.ADMIN_EMAILS = designatedAdminEmail;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  // ==========================================================================
  // Section 1: Authentication & Authorization Guards
  // ==========================================================================
  describe('1. Admin Authorization Server Guards Across All Sensitive Routes', () => {
    it('denies unauthenticated requests with 401 across all endpoints', async () => {
      const endpoints = [
        () => getOverviewRoute(new NextRequest('http://localhost:3000/api/admin/overview')),
        () => getSubmissionsRoute(new NextRequest('http://localhost:3000/api/admin/billing/submissions')),
        () => approveRoute(new NextRequest('http://localhost:3000/api/admin/billing/submissions/approve', { method: 'POST', body: '{}' })),
        () => rejectRoute(new NextRequest('http://localhost:3000/api/admin/billing/submissions/reject', { method: 'POST', body: '{}' })),
        () => getSubscriptionsRoute(new NextRequest('http://localhost:3000/api/admin/subscriptions')),
        () => controlRoute(new NextRequest('http://localhost:3000/api/admin/subscriptions/control', { method: 'POST', body: '{}' })),
        () => getAuditLogsRoute(new NextRequest('http://localhost:3000/api/admin/audit-logs')),
      ];

      for (const callEndpoint of endpoints) {
        const res = await callEndpoint();
        assert.strictEqual(res.status, 401, 'Endpoint must return 401 for unauthenticated request');
        const data = await res.json();
        assert.strictEqual(data.success, false);
      }
    });

    it('denies expired sessions with 401', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_exp',
        email: designatedAdminEmail,
        name: 'Shashank Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);
      expireSessionForTesting(sessionId);

      const req = new NextRequest('http://localhost:3000/api/admin/overview', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getOverviewRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it('denies authenticated non-allowlisted Google users with 403', async () => {
      const nonAdminUser = findOrCreateGoogleUser({
        sub: 'google_regular_99',
        email: nonAdminEmail,
        name: 'Regular Candidate',
        email_verified: true,
      });
      const { sessionId } = createSession(nonAdminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/overview', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getOverviewRoute(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /not authorized/i);
    });

    it('denies credentials-based accounts even if they supply an admin email', async () => {
      const credAdminEmail = 'credentials.admin@jobnexus.world';
      process.env.ADMIN_EMAILS = `${designatedAdminEmail},${credAdminEmail}`;
      const { user: credUser } = registerCredentialsUser({
        email: credAdminEmail,
        name: 'Credentials Admin',
        password: 'SecurePassword123!',
      });
      assert(credUser);
      const { sessionId } = createSession(credUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/overview', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getOverviewRoute(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /requires Google OAuth/i);
    });

    it('authorizes allowlisted Google admin successfully with 200', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_valid',
        email: designatedAdminEmail,
        name: 'Shashank Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/overview', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getOverviewRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.metrics !== undefined);
    });
  });

  // ==========================================================================
  // Section 2: Overview Metrics
  // ==========================================================================
  describe('2. Admin Overview Metrics Aggregation', () => {
    it('correctly calculates pending, SLA breaches, active subscribers, and audit counts', async () => {
      const submissionsCol = mockStore.getCollectionData('upi_submissions');
      const subscriptionsCol = mockStore.getCollectionData('billing_subscriptions');
      const auditCol = mockStore.getCollectionData('admin_audit_logs');

      const now = Date.now();
      // 1 normal pending submission
      submissionsCol.set('sub_1', {
        submissionId: 'sub_1',
        status: 'pending_verification',
        slaDeadlineAt: new Date(now + 6 * 3600 * 1000).toISOString(),
      });
      // 1 SLA breached pending submission
      submissionsCol.set('sub_2', {
        submissionId: 'sub_2',
        status: 'pending_verification',
        slaDeadlineAt: new Date(now - 2 * 3600 * 1000).toISOString(),
      });
      // 1 approved submission
      submissionsCol.set('sub_3', {
        submissionId: 'sub_3',
        status: 'approved',
      });
      // 1 active subscription
      subscriptionsCol.set('user_10', {
        userId: 'user_10',
        status: 'active',
        currentPeriodEnd: new Date(now + 20 * 86400 * 1000).toISOString(),
      });
      // 1 expired subscription
      subscriptionsCol.set('user_11', {
        userId: 'user_11',
        status: 'active',
        currentPeriodEnd: new Date(now - 5 * 86400 * 1000).toISOString(),
      });
      // 1 audit entry
      auditCol.set('audit_1', { id: 'audit_1' });

      const metrics = await getAdminOverview();
      assert.strictEqual(metrics.pendingCount, 2);
      assert.strictEqual(metrics.slaBreachCount, 1);
      assert.strictEqual(metrics.totalApprovedCount, 1);
      assert.strictEqual(metrics.activeSubscribersCount, 1);
      assert.strictEqual(metrics.totalAuditLogsCount, 1);
    });
  });

  // ==========================================================================
  // Section 3: Payment Approval Flow & Exactly-Once Invariant
  // ==========================================================================
  describe('3. Payment Approval Flow & Exactly-Once Guarantees', () => {
    const testOrderId = 'ord_test_app_1';
    const testSubmissionId = 'subm_test_app_1';
    const testUtr = '987654321012';
    const testUserId = 'usr_applicant_42';

    beforeEach(() => {
      // Setup order
      mockStore.getCollectionData('upi_orders').set(testOrderId, {
        orderId: testOrderId,
        userId: testUserId,
        planId: 'premium_monthly',
        amountInr: 499,
        amountInPaise: 49900,
        currency: 'INR',
        status: 'submitted',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      } as PaymentOrderDocument);

      // Setup reservation
      mockStore.getCollectionData('upi_utr_reservations').set(testUtr, {
        utrNumber: testUtr,
        orderId: testOrderId,
        submissionId: testSubmissionId,
        userId: testUserId,
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      } as UtrReservationDocument);

      // Setup submission
      mockStore.getCollectionData('upi_submissions').set(testSubmissionId, {
        submissionId: testSubmissionId,
        orderId: testOrderId,
        userId: testUserId,
        utrNumber: testUtr,
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        status: 'pending_verification',
      } as PaymentSubmissionDocument);
    });

    it('approves payment atomically: consumes UTR, activates subscription, appends audit log', async () => {
      const result = await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        verificationNotes: 'ICICI ref matched bank statement #8912',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.idempotent, false);
      assert.strictEqual(result.submission.status, 'approved');
      assert.strictEqual(result.subscription.status, 'active');
      assert.strictEqual(result.subscription.userId, testUserId);
      assert.strictEqual(result.subscription.provider, 'manual_upi');
      assert.strictEqual(result.subscription.paymentReference, testUtr);

      // Verify UTR reservation was consumed
      const resDoc = mockStore.getCollectionData('upi_utr_reservations').get(testUtr);
      assert.strictEqual(resDoc?.status, 'consumed');
      assert.ok(resDoc?.consumedAt);

      // Verify authoritative entitlement immediately reflects Premium active
      const entitlement = evaluateSubscriptionEntitlement(testUserId, result.subscription);
      assert.strictEqual(entitlement.isPremium, true);
      assert.strictEqual(entitlement.tier, 'premium');
      assert.strictEqual(entitlement.status, 'active');

      // Verify audit log entry was created
      const auditLogs = mockStore.getCollectionData('admin_audit_logs');
      assert.strictEqual(auditLogs.size, 1);
      const audit = Array.from(auditLogs.values())[0];
      assert.strictEqual(audit.action, 'payment_approved');
      assert.strictEqual(audit.targetUserId, testUserId);
      assert.strictEqual(audit.targetEntityId, testSubmissionId);
      assert.strictEqual(audit.actorEmail, designatedAdminEmail);
    });

    it('is strictly idempotent on retries and duplicate clicks', async () => {
      // First approval
      const first = await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
      });
      assert.strictEqual(first.idempotent, false);
      const firstExpiry = first.subscription.currentPeriodEnd;

      // Second approval (retry)
      const second = await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
      });
      assert.strictEqual(second.idempotent, true);
      assert.strictEqual(second.subscription.currentPeriodEnd, firstExpiry, 'Retry must not extend subscription twice');

      // Audit logs must not duplicate
      const auditLogs = mockStore.getCollectionData('admin_audit_logs');
      assert.strictEqual(auditLogs.size, 1);
    });

    it('extends existing active subscription without shortening remaining days', async () => {
      // Create user with active subscription having 10 days remaining
      const future10Days = new Date(Date.now() + 10 * 86400 * 1000).toISOString();
      mockStore.getCollectionData('billing_subscriptions').set(testUserId, {
        id: 'sub_existing_1',
        userId: testUserId,
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date(Date.now() - 20 * 86400 * 1000).toISOString(),
        currentPeriodEnd: future10Days,
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SubscriptionDocument);

      const result = await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
      });

      const newEndMs = new Date(result.subscription.currentPeriodEnd).getTime();
      const expectedEndMs = new Date(future10Days).getTime() + 30 * 86400 * 1000;
      assert.strictEqual(Math.abs(newEndMs - expectedEndMs) < 1000, true, 'Must add 30 days to the future expiry date');
    });

    it('API route /api/admin/billing/submissions/approve enforces confirmationChecked', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_app_check',
        email: designatedAdminEmail,
        name: 'Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      // Without confirmationChecked
      const reqFail = new NextRequest('http://localhost:3000/api/admin/billing/submissions/approve', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: testSubmissionId, confirmationChecked: false }),
      });
      const resFail = await approveRoute(reqFail);
      assert.strictEqual(resFail.status, 400);
      const dataFail = await resFail.json();
      assert.match(dataFail.error, /Independent verification confirmation required/i);

      // With confirmationChecked
      const reqPass = new NextRequest('http://localhost:3000/api/admin/billing/submissions/approve', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: testSubmissionId, confirmationChecked: true, verificationNotes: 'Statement ok' }),
      });
      const resPass = await approveRoute(reqPass);
      assert.strictEqual(resPass.status, 200);
      const dataPass = await resPass.json();
      assert.strictEqual(dataPass.success, true);
    });
  });

  // ==========================================================================
  // Section 4: Payment Rejection Flow
  // ==========================================================================
  describe('4. Payment Rejection Flow & UTR Release', () => {
    const testOrderId = 'ord_test_rej_1';
    const testSubmissionId = 'subm_test_rej_1';
    const testUtr = '123456789099';
    const testUserId = 'usr_applicant_rej';

    beforeEach(() => {
      mockStore.getCollectionData('upi_orders').set(testOrderId, {
        orderId: testOrderId,
        userId: testUserId,
        planId: 'premium_monthly',
        amountInr: 499,
        currency: 'INR',
        status: 'submitted',
      });
      mockStore.getCollectionData('upi_utr_reservations').set(testUtr, {
        utrNumber: testUtr,
        orderId: testOrderId,
        submissionId: testSubmissionId,
        userId: testUserId,
        status: 'reserved',
      });
      mockStore.getCollectionData('upi_submissions').set(testSubmissionId, {
        submissionId: testSubmissionId,
        orderId: testOrderId,
        userId: testUserId,
        utrNumber: testUtr,
        status: 'pending_verification',
      });
    });

    it('rejects submission with mandatory reason, releases UTR, and leaves subscription untouched', async () => {
      const result = await rejectPaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        reason: 'UTR not credited in ICICI statement',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.submission.status, 'rejected');
      assert.strictEqual(result.submission.decisionReason, 'UTR not credited in ICICI statement');

      // Verify UTR is released
      const resDoc = mockStore.getCollectionData('upi_utr_reservations').get(testUtr);
      assert.strictEqual(resDoc?.status, 'released');
      assert.strictEqual(resDoc?.releaseReason, 'UTR not credited in ICICI statement');

      // Verify user has no active subscription
      const sub = mockStore.getCollectionData('billing_subscriptions').get(testUserId);
      assert.strictEqual(sub, undefined);

      // Verify audit log
      const auditLogs = mockStore.getCollectionData('admin_audit_logs');
      assert.strictEqual(auditLogs.size, 1);
      const audit = Array.from(auditLogs.values())[0];
      assert.strictEqual(audit.action, 'payment_rejected');
    });

    it('fails when rejection reason is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await rejectPaymentSubmissionInTransaction({
            submissionId: testSubmissionId,
            adminEmail: designatedAdminEmail,
            adminUserId: 'admin_usr_1',
            reason: '   ',
          });
        },
        /mandatory administrative reason/i
      );
    });
  });

  // ==========================================================================
  // Section 5: Manual Entitlement Management Controls
  // ==========================================================================
  describe('5. Manual Entitlement Controls (Grant, Extend, Suspend, Reinstate)', () => {
    const testUserId = 'usr_manual_ctrl_1';

    it('manual grant creates 30 days active Premium and logs audit', async () => {
      const sub = await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        days: 30,
        reason: 'VIP community grant for hackathon winner',
      });

      assert.strictEqual(sub.status, 'active');
      assert.strictEqual(sub.provider, 'manual');
      assert.strictEqual(sub.lastUpdatedFrom, 'admin_grant');

      const entitlement = evaluateSubscriptionEntitlement(testUserId, sub);
      assert.strictEqual(entitlement.isPremium, true);

      // Verify audit entry
      const auditLogs = mockStore.getCollectionData('admin_audit_logs');
      const audit = Array.from(auditLogs.values()).find((a) => a.action === 'admin_grant');
      assert.ok(audit);
      assert.strictEqual(audit.targetUserId, testUserId);
    });

    it('suspend halts access immediately', async () => {
      // Setup active subscription
      await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        days: 30,
        reason: 'Initial setup',
      });

      const suspended = await adminSuspendSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        reason: 'Violation of Terms of Service',
      });

      assert.strictEqual(suspended.status, 'halted');
      assert.strictEqual(suspended.cancelAtPeriodEnd, false);

      // Verify entitlement evaluation is immediately free/expired
      const entitlement = evaluateSubscriptionEntitlement(testUserId, suspended);
      assert.strictEqual(entitlement.isPremium, false);
      assert.strictEqual(entitlement.tier, 'free');
    });

    it('reinstate restores active access', async () => {
      // First grant and then suspend
      await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        days: 30,
        reason: 'Initial setup',
      });
      await adminSuspendSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        reason: 'Suspension for check',
      });

      const reinstated = await adminReinstateSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_usr_1',
        reason: 'Appeal approved',
      });

      assert.strictEqual(reinstated.status, 'active');
      const entitlement = evaluateSubscriptionEntitlement(testUserId, reinstated);
      assert.strictEqual(entitlement.isPremium, true);
    });

    it('API route /api/admin/subscriptions/control enforces mandatory reason', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_ctrl_check',
        email: designatedAdminEmail,
        name: 'Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const reqFail = new NextRequest('http://localhost:3000/api/admin/subscriptions/control', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant', targetUserId: 'usr_abc', reason: '' }),
      });
      const resFail = await controlRoute(reqFail);
      assert.strictEqual(resFail.status, 400);
      const dataFail = await resFail.json();
      assert.match(dataFail.error, /mandatory administrative reason/i);
    });
  });

  // ==========================================================================
  // Section 6: Audit Log & Read-Only Invariance
  // ==========================================================================
  describe('6. Immutable Audit Trail & Read-Only Refresh Invariance', () => {
    it('retrieves audit logs ordered by timestamp descending', async () => {
      const auditCol = mockStore.getCollectionData('admin_audit_logs');
      auditCol.set('a_1', {
        id: 'a_1',
        action: 'payment_approved',
        targetUserId: 'usr_1',
        timestamp: '2026-10-29T10:00:00Z',
      });
      auditCol.set('a_2', {
        id: 'a_2',
        action: 'payment_rejected',
        targetUserId: 'usr_2',
        timestamp: '2026-10-29T11:00:00Z',
      });

      const logs = await getAdminAuditLogs();
      assert.strictEqual(logs.length, 2);
      assert.strictEqual(logs[0].id, 'a_2', 'Newest log must be first');
    });

    it('read-only status queries via /api/admin/subscriptions do not modify state', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_ro_check',
        email: designatedAdminEmail,
        name: 'Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/subscriptions', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getSubscriptionsRoute(req);
      assert.strictEqual(res.status, 200);

      // Verify no audit logs were created from read queries
      const logs = await getAdminAuditLogs();
      assert.strictEqual(logs.length, 0);
    });
  });

  // ==========================================================================
  // Section 8: Subscriber Email Resolution, Display, and Filtering
  // ==========================================================================
  describe('8. Subscriber Email Resolution, Display, and Filtering Across Admin Queues', () => {
    it('returns userEmail in getAdminSubmissions from order, submission, or user record', async () => {
      const subscriber = findOrCreateGoogleUser({
        sub: 'sub_email_lookup_123',
        email: 'applicant.one@gmail.com',
        name: 'Applicant One',
        email_verified: true,
      });

      mockStore.getCollectionData('upi_orders').set('ord_test_email_1', {
        orderId: 'ord_test_email_1',
        userId: subscriber.id,
        userEmail: 'applicant.one@gmail.com',
        planId: 'premium_monthly',
        amountInr: 499,
        amountInPaise: 49900,
        currency: 'INR',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus',
        status: 'submitted',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      mockStore.getCollectionData('upi_submissions').set('subm_test_email_1', {
        submissionId: 'subm_test_email_1',
        orderId: 'ord_test_email_1',
        userId: subscriber.id,
        userEmail: 'applicant.one@gmail.com',
        utrNumber: '998877665544',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        status: 'pending_verification',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 43200000).toISOString(),
      });

      const adminUser = findOrCreateGoogleUser({
        sub: 'admin_subscriber_lookup',
        email: designatedAdminEmail,
        name: 'Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/billing/submissions?status=pending_verification', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getSubmissionsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.submissions.length, 1);
      assert.strictEqual(data.submissions[0].userEmail, 'applicant.one@gmail.com');
      assert.strictEqual(data.submissions[0].utrNumber, '998877665544');
    });

    it('filters subscriptions by subscriber email address via query parameter', async () => {
      mockStore.getCollectionData('billing_subscriptions').set('usr_alpha', {
        id: 'sub_alpha',
        userId: 'usr_alpha',
        userEmail: 'alpha.dev@gmail.com',
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
        provider: 'manual_upi',
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockStore.getCollectionData('billing_subscriptions').set('usr_beta', {
        id: 'sub_beta',
        userId: 'usr_beta',
        userEmail: 'beta.engineer@gmail.com',
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
        provider: 'manual_upi',
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const adminUser = findOrCreateGoogleUser({
        sub: 'admin_sub_filter',
        email: designatedAdminEmail,
        name: 'Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      // Search by partial email "alpha.dev"
      const req = new NextRequest('http://localhost:3000/api/admin/subscriptions?query=alpha.dev', {
        headers: { authorization: `Bearer ${sessionId}` },
      });
      const res = await getSubscriptionsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.subscriptions.length, 1);
      assert.strictEqual(data.subscriptions[0].userEmail, 'alpha.dev@gmail.com');
    });

    it('resolves target user by email in subscription control route and persists targetUserEmail in audit trail', async () => {
      const subscriber = findOrCreateGoogleUser({
        sub: 'sub_control_email_lookup',
        email: 'prospect.candidate@gmail.com',
        name: 'Prospect Candidate',
        email_verified: true,
      });

      const adminUser = findOrCreateGoogleUser({
        sub: 'admin_control_by_email',
        email: designatedAdminEmail,
        name: 'Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/subscriptions/control', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          action: 'grant',
          targetUserId: 'prospect.candidate@gmail.com', // Providing email instead of raw ID
          days: 30,
          reason: 'Promotion trial access',
        }),
      });

      const res = await controlRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.subscription.userId, subscriber.id);
      assert.strictEqual(data.subscription.userEmail, 'prospect.candidate@gmail.com');

      // Verify audit log has targetUserEmail
      const auditLogs = await getAdminAuditLogs();
      assert.strictEqual(auditLogs.length, 1);
      assert.strictEqual(auditLogs[0].targetUserEmail, 'prospect.candidate@gmail.com');
      assert.strictEqual(auditLogs[0].targetUserId, subscriber.id);
    });
  });
});
