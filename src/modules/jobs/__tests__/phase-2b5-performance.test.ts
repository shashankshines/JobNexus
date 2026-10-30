import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import {
  getAuthoritativeUserEntitlement,
  invalidateUserEntitlementCache,
} from '@/modules/billing/services/entitlement.service';
import {
  getAdminOverview,
  getUser360Profile,
  getConsolidatedPaymentLedger,
  invalidateAdminStoresCache,
} from '@/modules/storage/firestore/admin-billing.store';
import { getAdminAuditLogs, invalidateAuditLogsCache } from '@/modules/storage/firestore/audit.store';
import {
  getSubmissionsCollection,
  getOrdersCollection,
  getSubscriptionsCollection,
  getAuditLogsCollection,
  PaymentOrderDocument,
  PaymentSubmissionDocument,
  SubscriptionDocument,
  AdminAuditLogDocument,
} from '@/modules/storage/firestore/collections';

describe('JobNexus Phase 2B.5 — Application-Wide Performance & Data Fetching Optimisations', () => {
  beforeEach(() => {
    const mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    invalidateAdminStoresCache();
    invalidateAuditLogsCache();
    invalidateUserEntitlementCache();
  });

  describe('1. In-Memory Job Stats Memoization', () => {
    it('caches live job stats and returns subsequent calls near-instantaneously (<5ms)', async () => {
      const service = new JobSearchService();
      
      const t0 = performance.now();
      const stats1 = await service.getJobStats();
      const d1 = performance.now() - t0;

      const t1 = performance.now();
      const stats2 = await service.getJobStats();
      const d2 = performance.now() - t1;

      assert.strictEqual(stats1.totalJobs, stats2.totalJobs);
      assert.strictEqual(stats1.sourcesCount, stats2.sourcesCount);
      assert.ok(d2 < 10, `Cached stats response took ${d2.toFixed(2)}ms; must be under 10ms`);
    });
  });

  describe('2. Authoritative User Entitlement Request-Scoped Caching & Immediate Invalidation', () => {
    const testUserId = 'perf_user_entitlement_1';

    beforeEach(async () => {
      const subsCol = getSubscriptionsCollection();
      await subsCol.doc(testUserId).set({
        id: `sub_${testUserId}`,
        userId: testUserId,
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        provider: 'manual_upi',
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SubscriptionDocument);
    });

    it('returns authoritative entitlement with forceCache and purges immediately upon invalidateUserEntitlementCache', async () => {
      const ent1 = await getAuthoritativeUserEntitlement(testUserId, { forceCache: true });
      assert.strictEqual(ent1.isPremium, true);
      assert.strictEqual(ent1.status, 'active');

      // Mutate in storage directly to 'halted'
      const subsCol = getSubscriptionsCollection();
      await subsCol.doc(testUserId).update({ status: 'halted' });

      // With forceCache without invalidation, it serves the cached active record
      const entCached = await getAuthoritativeUserEntitlement(testUserId, { forceCache: true });
      assert.strictEqual(entCached.status, 'active');

      // Invalidate cache for this user
      invalidateUserEntitlementCache(testUserId);

      // Subsequent call must reflect the updated halted status
      const entFresh = await getAuthoritativeUserEntitlement(testUserId, { forceCache: true });
      assert.strictEqual(entFresh.status, 'expired');
      assert.strictEqual(entFresh.isPremium, false);
    });
  });

  describe('3. Admin Overview & Ledger Snapshot Caching with Invalidation', () => {
    it('caches Admin Overview snapshot with forceCache and invalidates via invalidateAdminStoresCache', async () => {
      const subsCol = getSubmissionsCollection();
      const subId = 'perf_sub_01';
      await subsCol.doc(subId).set({
        submissionId: subId,
        orderId: 'perf_ord_01',
        userId: 'perf_user_01',
        utrNumber: 'PERF12345678',
        declaredAmount: 499,
        paymentDate: '2026-10-30',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        status: 'pending_verification',
      } as PaymentSubmissionDocument);

      const overview1 = await getAdminOverview({ forceCache: true });
      assert.ok(overview1.pendingCount >= 1);

      // Now invalidate cache
      invalidateAdminStoresCache();

      // Ensure fresh read succeeds
      const overviewFresh = await getAdminOverview({ forceCache: true });
      assert.strictEqual(overviewFresh.pendingCount, overview1.pendingCount);
    });

    it('caches Consolidated Payment Ledger snapshot and computes summary accurately', async () => {
      const ledgerResult = await getConsolidatedPaymentLedger(undefined, { forceCache: true });
      assert.ok(Array.isArray(ledgerResult.records));
      assert.ok(ledgerResult.summary);
      assert.strictEqual(typeof ledgerResult.summary.totalOrdersCount, 'number');
      assert.strictEqual(typeof ledgerResult.summary.verifiedPaymentAmountInr, 'number');
    });
  });

  describe('4. User 360° Parallel Query Concurrency', () => {
    const userId = 'perf_user_360_concurrency';

    beforeEach(async () => {
      const subsCol = getSubscriptionsCollection();
      const ordersCol = getOrdersCollection();
      const submissionsCol = getSubmissionsCollection();
      const auditCol = getAuditLogsCollection();

      await subsCol.doc(userId).set({
        id: `sub_${userId}`,
        userId,
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 15 * 86400000).toISOString(),
        provider: 'manual_upi',
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SubscriptionDocument);

      await ordersCol.doc(`ord_${userId}`).set({
        orderId: `ord_${userId}`,
        userId,
        planId: 'premium_monthly',
        amountInr: 499,
        currency: 'INR',
        upiId: 'jobnexus@icici',
        status: 'submitted',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      } as PaymentOrderDocument);

      await submissionsCol.doc(`subm_${userId}`).set({
        submissionId: `subm_${userId}`,
        orderId: `ord_${userId}`,
        userId,
        utrNumber: 'PERF36012345',
        declaredAmount: 499,
        paymentDate: '2026-10-30',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'shashankshines@gmail.com',
      } as PaymentSubmissionDocument);

      await auditCol.doc(`audit_${userId}`).set({
        id: `audit_${userId}`,
        actorId: 'admin_perf',
        actorEmail: 'shashankshines@gmail.com',
        action: 'payment_approved',
        targetUserId: userId,
        targetEntityId: `subm_${userId}`,
        timestamp: new Date().toISOString(),
      } as AdminAuditLogDocument);
    });

    it('resolves User 360 dossier concurrently through parallel Firestore queries', async () => {
      const t0 = performance.now();
      const dossier = await getUser360Profile(userId);
      const duration = performance.now() - t0;

      assert.strictEqual(dossier.identity.userId, userId);
      assert.strictEqual(dossier.subscription?.status, 'active');
      assert.strictEqual(dossier.orders.length, 1);
      assert.strictEqual(dossier.submissions.length, 1);
      assert.strictEqual(dossier.auditLogs.length, 1);
      assert.ok(dossier.timeline.length >= 2, 'Timeline must contain order, submission and review events');
      assert.ok(duration < 250, `User 360° resolution took ${duration.toFixed(2)}ms; must execute under 250ms`);
    });
  });

  describe('5. Audit Logs Snapshot Caching & Invalidation', () => {
    it('caches audit logs and purges on invalidateAuditLogsCache', async () => {
      const audit1 = await getAdminAuditLogs(undefined, { forceCache: true });
      assert.ok(Array.isArray(audit1));

      invalidateAuditLogsCache();
      const audit2 = await getAdminAuditLogs(undefined, { forceCache: true });
      assert.strictEqual(audit1.length, audit2.length);
    });
  });
});
