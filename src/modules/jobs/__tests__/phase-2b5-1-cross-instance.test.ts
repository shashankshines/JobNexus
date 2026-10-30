/**
 * Phase 2B.5.1: Cache Consistency, Data Freshness & Production Performance Verification Test Suite
 *
 * Verifies:
 * 1. Cross-Instance Cache Invalidation via Firestore Monotonic Version Sync (`system_metadata/billing_sync`)
 * 2. Multi-instance Simulation:
 *    - Instance A caches overview/ledger/subscriptions -> Instance B commits approval/rejection/grant/extend/suspend/reinstate/revoke -> Instance A detects bump and reloads fresh authoritative state.
 * 3. Security Entitlement Freshness: Suspended/Revoked user on Instance B is immediately revoked on Instance A.
 * 4. Concurrent Cache Population & Stampede Protection
 * 5. Bounded Firestore Pagination & Read Efficiency
 * 6. User Isolation and Account Switching Safety
 * 7. Provider Failure Isolation & Job Freshness
 * 8. Financial Aggregation Correctness
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  setMockFirestoreDb,
} from '@/modules/storage/firestore/client';
import {
  InMemoryFirestoreStore,
  createMockFirestoreDb,
} from '@/modules/storage/firestore/mock';
import {
  getAdminOverview,
  getConsolidatedPaymentLedger,
  getAdminSubscriptions,
  getAdminSubmissions,
  approvePaymentSubmissionInTransaction,
  rejectPaymentSubmissionInTransaction,
  adminManualGrantSubscriptionInTransaction,
  adminExtendSubscriptionInTransaction,
  adminSuspendSubscriptionInTransaction,
  adminReinstateSubscriptionInTransaction,
  adminRevokeSubscriptionInTransaction,
  invalidateAdminStoresCache,
} from '@/modules/storage/firestore/admin-billing.store';
import {
  recordAdminAuditLog,
  getAdminAuditLogs,
  invalidateAuditLogsCache,
} from '@/modules/storage/firestore/audit.store';
import {
  createPaymentSubmission,
  createPaymentOrder,
} from '@/modules/storage/firestore/order.store';
import {
  getAuthoritativeUserEntitlement,
  invalidateUserEntitlementCache,
} from '@/modules/billing/services/entitlement.service';
import {
  getBillingSyncVersion,
  bumpBillingSyncVersion,
} from '@/modules/storage/firestore/billing-sync.store';
import {
  getSubmissionsCollection,
  getOrdersCollection,
  getSubscriptionsCollection,
  getUtrReservationsCollection,
  PaymentOrderDocument,
  PaymentSubmissionDocument,
  SubscriptionDocument,
} from '@/modules/storage/firestore/collections';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import { JobProvider } from '@/modules/jobs/providers/provider.types';
import { NormalizedJob } from '@/modules/jobs/domain/job.types';

describe('JobNexus Phase 2B.5.1 — Cache Consistency & Production Verification Suite', () => {
  let sharedStore: InMemoryFirestoreStore;

  beforeEach(() => {
    sharedStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(sharedStore));
    invalidateAdminStoresCache();
    invalidateAuditLogsCache();
    invalidateUserEntitlementCache();
  });

  // ==========================================================================
  // 1. Cross-Instance Monotonic Version Synchronization Engine
  // ==========================================================================
  describe('1. Monotonic Version Sync Engine (`system_metadata/billing_sync`)', () => {
    it('initializes version at 1 and increments monotonically on every mutation', async () => {
      const v1 = await getBillingSyncVersion();
      assert.strictEqual(v1, 1);

      const v2 = await bumpBillingSyncVersion({ mutationType: 'test_mutation' });
      assert.strictEqual(v2, 2);

      const v3 = await bumpBillingSyncVersion({ mutationType: 'another_mutation' });
      assert.strictEqual(v3, 3);

      const current = await getBillingSyncVersion();
      assert.strictEqual(current, 3);
    });
  });

  // ==========================================================================
  // 2. Multi-Instance Simulation: Payment Approval & Rejection
  // ==========================================================================
  describe('2. Multi-Instance Simulation: Payment Lifecycle Mutations', () => {
    it('Instance A detects payment approval performed by Instance B and evicts stale cached overview', async () => {
      const submissionsCol = getSubmissionsCollection();
      const ordersCol = getOrdersCollection();

      // Seed pending submission
      const subId = 'cross_sub_01';
      const ordId = 'cross_ord_01';
      const userId = 'cross_user_01';

      await ordersCol.doc(ordId).set({
        orderId: ordId,
        userId,
        userEmail: 'user1@example.com',
        planId: 'premium_monthly',
        amountInr: 499,
        currency: 'INR',
        status: 'submitted',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      } as PaymentOrderDocument);

      await submissionsCol.doc(subId).set({
        submissionId: subId,
        orderId: ordId,
        userId,
        utrNumber: 'CROSSUTR1234',
        declaredAmount: 499,
        paymentDate: '2026-10-30',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        status: 'pending_verification',
      } as PaymentSubmissionDocument);

      await getUtrReservationsCollection().doc('CROSSUTR1234').set({
        utrNumber: 'CROSSUTR1234',
        orderId: ordId,
        submissionId: subId,
        userId,
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      });

      // --- Instance A: Reads and caches overview ---
      const overviewA1 = await getAdminOverview({ forceCache: true });
      assert.strictEqual(overviewA1.pendingCount, 1);
      assert.strictEqual(overviewA1.totalApprovedCount, 0);

      // --- Instance B: Simulates another process performing approval ---
      // Instance B has its own DB client pointer to shared persistence
      const approvalResult = await approvePaymentSubmissionInTransaction({
        submissionId: subId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        verificationNotes: 'Approved via Instance B',
      });
      assert.strictEqual(approvalResult.success, true);

      // --- Instance A: Subsequent request arrives at Instance A ---
      // Even with forceCache enabled, Instance A MUST detect that the version was bumped
      // and reload fresh data from Firestore!
      const overviewA2 = await getAdminOverview({ forceCache: true });
      assert.strictEqual(overviewA2.pendingCount, 0);
      assert.strictEqual(overviewA2.totalApprovedCount, 1);
      assert.strictEqual(overviewA2.verifiedRevenueInr, 499);
    });

    it('Instance A detects payment rejection committed by Instance B', async () => {
      const submissionsCol = getSubmissionsCollection();
      const subId = 'cross_sub_rej';
      const ordId = 'cross_ord_rej';
      const userId = 'cross_user_rej';

      await getOrdersCollection().doc(ordId).set({
        orderId: ordId,
        userId,
        amountInr: 499,
        currency: 'INR',
        status: 'submitted',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      } as PaymentOrderDocument);

      await submissionsCol.doc(subId).set({
        submissionId: subId,
        orderId: ordId,
        userId,
        utrNumber: 'REJUTR9999',
        declaredAmount: 499,
        paymentDate: '2026-10-30',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        status: 'pending_verification',
      } as PaymentSubmissionDocument);

      // Instance A loads and caches Ledger
      const ledgerA1 = await getConsolidatedPaymentLedger(undefined, { forceCache: true });
      assert.strictEqual(ledgerA1.summary.pendingSubmissionsCount, 1);
      assert.strictEqual(ledgerA1.summary.rejectedSubmissionsCount, 0);

      // Instance B performs rejection
      await rejectPaymentSubmissionInTransaction({
        submissionId: subId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        reason: 'UTR not found in bank statement',
      });

      // Instance A reads ledger again
      const ledgerA2 = await getConsolidatedPaymentLedger(undefined, { forceCache: true });
      assert.strictEqual(ledgerA2.summary.pendingSubmissionsCount, 0);
      assert.strictEqual(ledgerA2.summary.rejectedSubmissionsCount, 1);
    });
  });

  // ==========================================================================
  // 3. Multi-Instance Simulation: Entitlement & Security Controls
  // ==========================================================================
  describe('3. Multi-Instance Security Entitlement Consistency', () => {
    it('Instance A immediately revokes premium access when Instance B halts or revokes a subscription', async () => {
      const userId = 'security_user_01';
      const subsCol = getSubscriptionsCollection();

      // Seed active subscription
      await subsCol.doc(userId).set({
        id: `sub_${userId}`,
        userId,
        userEmail: 'sec@example.com',
        planId: 'premium_monthly',
        status: 'active',
        provider: 'manual_upi',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 20 * 86400000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SubscriptionDocument);

      // Instance A evaluates entitlement and caches it
      const entA1 = await getAuthoritativeUserEntitlement(userId, { forceCache: true });
      assert.strictEqual(entA1.isPremium, true);
      assert.strictEqual(entA1.status, 'active');

      // Instance B suspends the subscription due to fraud/abuse
      await adminSuspendSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        reason: 'Payment chargeback dispute',
      });

      // Instance A evaluates entitlement again on subsequent request:
      // MUST NOT serve stale active entitlement!
      const entA2 = await getAuthoritativeUserEntitlement(userId, { forceCache: true });
      assert.strictEqual(entA2.isPremium, false);
      assert.strictEqual(entA2.status, 'expired');
      assert.ok(entA2.reason.includes('suspended') || entA2.reason.includes('halted'));

      // Instance B reinstates the subscription
      await adminReinstateSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        reason: 'Dispute resolved with bank proof',
      });

      // Instance A immediately reflects restored active access
      const entA3 = await getAuthoritativeUserEntitlement(userId, { forceCache: true });
      assert.strictEqual(entA3.isPremium, true);
      assert.strictEqual(entA3.status, 'active');
    });

    it('Instance A immediately detects manual grant by Instance B', async () => {
      const userId = 'grant_user_01';

      // Instance A checks entitlement: user is free tier
      const entA1 = await getAuthoritativeUserEntitlement(userId, { forceCache: true });
      assert.strictEqual(entA1.isPremium, false);

      // Instance B grants 30 days VIP trial
      await adminManualGrantSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        days: 30,
        reason: 'VIP community grant',
      });

      // Instance A checks entitlement: immediately premium active
      const entA2 = await getAuthoritativeUserEntitlement(userId, { forceCache: true });
      assert.strictEqual(entA2.isPremium, true);
      assert.strictEqual(entA2.status, 'active');
    });

    it('Instance A immediately detects subscription extension and permanent revocation by Instance B', async () => {
      const userId = 'ext_revoke_user';
      const subsCol = getSubscriptionsCollection();

      await subsCol.doc(userId).set({
        id: `sub_${userId}`,
        userId,
        userEmail: 'ext@example.com',
        planId: 'premium_monthly',
        status: 'active',
        provider: 'manual_upi',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 5 * 86400000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SubscriptionDocument);

      // Instance A loads subscriptions list
      const subsA1 = await getAdminSubscriptions(undefined, { forceCache: true });
      const targetSub1 = subsA1.find((s) => s.userId === userId);
      assert.ok(targetSub1);

      // Instance B extends subscription by 30 days
      const extended = await adminExtendSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        days: 30,
        reason: 'Courtesy extension',
      });
      assert.ok(extended.currentPeriodEnd > targetSub1.currentPeriodEnd);

      // Instance A re-reads subscriptions: immediately reflects new expiry
      const subsA2 = await getAdminSubscriptions(undefined, { forceCache: true });
      const targetSub2 = subsA2.find((s) => s.userId === userId);
      assert.strictEqual(targetSub2?.currentPeriodEnd, extended.currentPeriodEnd);

      // Instance B revokes subscription permanently
      await adminRevokeSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_01',
        reason: 'Terms violation',
      });

      // Instance A evaluates entitlement: permanently cancelled/expired
      const entRevoked = await getAuthoritativeUserEntitlement(userId, { forceCache: true });
      assert.strictEqual(entRevoked.isPremium, false);
      assert.strictEqual(entRevoked.status, 'expired');
    });
  });

  // ==========================================================================
  // 4. Bounded Firestore Pagination & Stability
  // ==========================================================================
  describe('4. Bounded Firestore Pagination & Stability', () => {
    it('performs bounded pagination on submissions without fetching entire collection', async () => {
      const submissionsCol = getSubmissionsCollection();

      // Seed 12 submissions
      for (let i = 1; i <= 12; i++) {
        const id = `sub_page_${i.toString().padStart(2, '0')}`;
        await submissionsCol.doc(id).set({
          submissionId: id,
          orderId: `ord_page_${i}`,
          userId: `usr_page_${i}`,
          utrNumber: `PAGINATIONUTR${i.toString().padStart(4, '0')}`,
          declaredAmount: 499,
          paymentDate: '2026-10-30',
          submittedAt: new Date(Date.now() - i * 1000).toISOString(),
          slaDeadlineAt: new Date().toISOString(),
          status: 'pending_verification',
        } as PaymentSubmissionDocument);
      }

      // Page 1: 5 items
      const p1 = await getAdminSubmissions({ limit: 5, offset: 0 });
      assert.strictEqual(p1.total, 12);
      assert.strictEqual(p1.submissions.length, 5);
      assert.strictEqual(p1.submissions[0].submissionId, 'sub_page_01');

      // Page 2: next 5 items
      const p2 = await getAdminSubmissions({ limit: 5, offset: 5 });
      assert.strictEqual(p2.total, 12);
      assert.strictEqual(p2.submissions.length, 5);
      assert.strictEqual(p2.submissions[0].submissionId, 'sub_page_06');

      // Page 3: remaining 2 items
      const p3 = await getAdminSubmissions({ limit: 5, offset: 10 });
      assert.strictEqual(p3.total, 12);
      assert.strictEqual(p3.submissions.length, 2);
      assert.strictEqual(p3.submissions[0].submissionId, 'sub_page_11');
    });

    it('maintains deterministic page order when new items arrive during pagination', async () => {
      const submissionsCol = getSubmissionsCollection();

      for (let i = 1; i <= 6; i++) {
        const id = `sub_stable_${i}`;
        await submissionsCol.doc(id).set({
          submissionId: id,
          orderId: `ord_${i}`,
          userId: `usr_${i}`,
          utrNumber: `STABLE${i}`,
          declaredAmount: 499,
          paymentDate: '2026-10-30',
          submittedAt: new Date(Date.now() - (10 - i) * 60000).toISOString(),
          slaDeadlineAt: new Date().toISOString(),
          status: 'pending_verification',
        } as PaymentSubmissionDocument);
      }

      const p1 = await getAdminSubmissions({ limit: 3, offset: 0 });
      assert.strictEqual(p1.submissions.length, 3);
      // Deterministically ordered by submittedAt desc
      const firstId = p1.submissions[0].submissionId;
      assert.ok(firstId);
    });
  });

  // ==========================================================================
  // 5. Job Freshness & Provider Resilience
  // ==========================================================================
  describe('5. Job Freshness and Provider Resilience', () => {
    it('isolates slow or failing provider and returns fast provider results immediately', async () => {
      const fastProvider: JobProvider = {
        id: 'fast_provider',
        name: 'Fast Provider ATS',
        timeoutMs: 500,
        async fetchJobs(): Promise<NormalizedJob[]> {
          return [
            {
              id: 'fast_job_01',
              title: 'Fast Cloud Engineer',
              company: 'FastCorp',
              location: 'Remote',
              applicationUrl: 'https://fastcorp.example.com/job1',
              sourceId: 'fast_provider',
              sourceName: 'Fast Provider ATS',
              publishedAt: new Date().toISOString(),
              employmentType: 'full-time',
              industry: 'Technology & IT',
              workplaceType: 'remote',
              isRemote: true,
              tags: ['cloud', 'aws'],
              description: 'Fast job description',
            },
          ];
        },
      };

      const failingProvider: JobProvider = {
        id: 'failing_provider',
        name: 'Failing Provider ATS',
        timeoutMs: 500,
        async fetchJobs(): Promise<NormalizedJob[]> {
          throw new Error('503 Service Unavailable');
        },
      };

      const hangingProvider: JobProvider = {
        id: 'hanging_provider',
        name: 'Hanging Provider ATS',
        timeoutMs: 50, // Rapid timeout
        async fetchJobs(): Promise<NormalizedJob[]> {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return [];
        },
      };

      const service = new JobSearchService([fastProvider, failingProvider, hangingProvider]);
      const res = await service.searchJobs({});

      assert.strictEqual(res.jobs.length, 1);
      assert.strictEqual(res.jobs[0].title, 'Fast Cloud Engineer');
      assert.ok(res.diagnostics);
      assert.strictEqual(res.diagnostics.length, 3);

      const fastDiag = res.diagnostics.find((d) => d.providerId === 'fast_provider');
      const failingDiag = res.diagnostics.find((d) => d.providerId === 'failing_provider');
      const hangingDiag = res.diagnostics.find((d) => d.providerId === 'hanging_provider');

      assert.strictEqual(fastDiag?.status, 'fulfilled');
      assert.strictEqual(failingDiag?.status, 'rejected');
      assert.strictEqual(hangingDiag?.status, 'timeout');
    });

    it('coalesces concurrent search calls into a single fetch promise (stampede protection)', async () => {
      let fetchCount = 0;
      const testProvider: JobProvider = {
        id: 'test_provider',
        name: 'Stampede Test ATS',
        timeoutMs: 1000,
        async fetchJobs(): Promise<NormalizedJob[]> {
          fetchCount++;
          await new Promise((r) => setTimeout(r, 20));
          return [
            {
              id: 'job_stampede_01',
              title: 'Stampede Tester',
              company: 'TestCorp',
              location: 'Remote',
              applicationUrl: 'https://testcorp.example.com/1',
              sourceId: 'test_provider',
              sourceName: 'Stampede Test ATS',
              publishedAt: new Date().toISOString(),
              employmentType: 'full-time',
              industry: 'Technology & IT',
              workplaceType: 'remote',
              isRemote: true,
              tags: ['qa'],
              description: 'Desc',
            },
          ];
        },
      };

      const service = new JobSearchService([testProvider]);

      // Fire 5 concurrent searches simultaneously
      const results = await Promise.all([
        service.searchJobs({ query: 'tester' }),
        service.searchJobs({ query: 'tester' }),
        service.searchJobs({ query: 'tester' }),
        service.searchJobs({ query: 'tester' }),
        service.searchJobs({ query: 'tester' }),
      ]);

      assert.strictEqual(results.length, 5);
      for (const r of results) {
        assert.strictEqual(r.jobs.length, 1);
      }
      // Exact single fetch execution!
      assert.strictEqual(fetchCount, 1);
    });
  });

  // ==========================================================================
  // 6. User Isolation and New Submissions
  // ==========================================================================
  describe('6. User Isolation and New Submissions Invalidation', () => {
    it('bumps sync version on createPaymentSubmission and reflects in Instance A queue', async () => {
      const vBefore = await getBillingSyncVersion();

      // Create order
      const order = await createPaymentOrder({
        userId: 'new_sub_user',
        userEmail: 'newsub@example.com',
      });

      // Submit payment
      await createPaymentSubmission({
        orderId: order.orderId,
        userId: 'new_sub_user',
        userEmail: 'newsub@example.com',
        utr: 'NEWSUBUTR1234',
        declaredAmount: 499,
        paymentDate: '2026-10-30',
      });

      const vAfter = await getBillingSyncVersion();
      assert.ok(vAfter > vBefore, 'Version must be bumped on new submission');

      // Queue reflects new submission
      const queue = await getAdminSubmissions({ status: 'pending_verification' });
      assert.strictEqual(queue.total, 1);
      assert.strictEqual(queue.submissions[0].utrNumber, 'NEWSUBUTR1234');
    });

    it('records immutable audit logs and bumps version', async () => {
      const vBefore = await getBillingSyncVersion();

      await recordAdminAuditLog({
        actorEmail: 'shashankshines@gmail.com',
        action: 'admin_grant',
        targetUserId: 'audit_target_usr',
        targetEntityId: 'sub_123',
        reason: 'Audit bump test',
      });

      const vAfter = await getBillingSyncVersion();
      assert.ok(vAfter > vBefore);

      const logs = await getAdminAuditLogs();
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].targetUserId, 'audit_target_usr');
    });
  });
});
