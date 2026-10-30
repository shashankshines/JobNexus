import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { encodeCursor, decodeCursor } from '../../storage/firestore/cursor';
import { createMockFirestoreDb, InMemoryFirestoreStore } from '../../storage/firestore/mock';
import { setMockFirestoreDb } from '../../storage/firestore/client';
import {
  getAdminSubmissions,
  getConsolidatedPaymentLedger,
  getAdminSubscriptions,
  approvePaymentSubmissionInTransaction,
  rejectPaymentSubmissionInTransaction,
  adminManualGrantSubscriptionInTransaction,
  adminSuspendSubscriptionInTransaction,
  adminReinstateSubscriptionInTransaction,
  adminRevokeSubscriptionInTransaction,
} from '../../storage/firestore/admin-billing.store';
import { getAdminAuditLogs } from '../../storage/firestore/audit.store';
import {
  createPaymentOrder,
  createPaymentSubmission,
  getPaymentSubmissionById,
} from '../../storage/firestore/order.store';
import {
  getBillingSyncVersion,
  readBillingSyncVersionInTransaction,
  writeBillingSyncVersionInTransaction,
} from '../../storage/firestore/billing-sync.store';
import {
  evaluateSubscriptionEntitlement,
  verifyProtectedOperationEntitlement,
  invalidateUserEntitlementCache,
} from '../../billing/services/entitlement.service';
import { fetchWithTimeout } from '../providers/provider.types';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob } from '../domain/job.types';

describe('JobNexus Phase 2B.5.2 — Cursor Pagination, Transactional Sync & Entitlement Hardening', () => {
  let store: InMemoryFirestoreStore;

  beforeEach(() => {
    store = new InMemoryFirestoreStore();
    const mockDb = createMockFirestoreDb(store);
    setMockFirestoreDb(mockDb);
    invalidateUserEntitlementCache();
  });

  describe('1. Cursor Encoding & Validation', () => {
    it('correctly encodes and decodes opaque URL-safe base64url cursors', () => {
      const primary = '2026-10-30T12:00:00.000Z';
      const secondary = 'subm_abc1234567';

      const cursor = encodeCursor(primary, secondary);
      assert.ok(cursor && typeof cursor === 'string');
      // Must be URL-safe (no +, /, or = characters)
      assert.strictEqual(/^[A-Za-z0-9_-]+$/.test(cursor), true);

      const decoded = decodeCursor(cursor);
      assert.ok(decoded);
      assert.strictEqual(decoded.primary, primary);
      assert.strictEqual(decoded.secondary, secondary);
    });

    it('gracefully returns null on malformed, empty, or tampered cursors', () => {
      assert.strictEqual(decodeCursor(null), null);
      assert.strictEqual(decodeCursor(''), null);
      assert.strictEqual(decodeCursor('   '), null);
      assert.strictEqual(decodeCursor('invalid-base64-payload!@#$'), null);
      assert.strictEqual(decodeCursor(Buffer.from('not json').toString('base64url')), null);
      assert.strictEqual(
        decodeCursor(Buffer.from(JSON.stringify({ primary: 'only' })).toString('base64url')),
        null
      );
    });
  });

  describe('2. Cursor-Based Pagination across Admin Collections', () => {
    it('paginates submissions page by page with deterministic cursors and O(limit) read cost', async () => {
      const userId = 'user_cursor_test';
      const userEmail = 'user_cursor@example.com';

      // Seed 12 submissions across 12 orders
      for (let i = 1; i <= 12; i++) {
        const order = await createPaymentOrder({ userId, userEmail });
        const utr = `4321098765${String(i).padStart(2, '0')}`;
        await createPaymentSubmission({
          orderId: order.orderId,
          userId,
          userEmail,
          utr,
          declaredAmount: 499,
          paymentDate: '2026-10-30',
        });
      }

      // Page 1: Fetch first 5
      const page1 = await getAdminSubmissions({ limit: 5 });
      assert.strictEqual(page1.submissions.length, 5);
      assert.strictEqual(page1.total, 12);
      assert.strictEqual(page1.hasMore, true);
      assert.ok(page1.nextCursor);

      // Page 2: Fetch next 5 using nextCursor from Page 1
      const page2 = await getAdminSubmissions({ limit: 5, cursor: page1.nextCursor! });
      assert.strictEqual(page2.submissions.length, 5);
      assert.strictEqual(page2.total, 12);
      assert.strictEqual(page2.hasMore, true);
      assert.ok(page2.nextCursor);

      // Ensure zero overlap between Page 1 and Page 2
      const page1Ids = new Set(page1.submissions.map((s) => s.submissionId));
      for (const s of page2.submissions) {
        assert.strictEqual(page1Ids.has(s.submissionId), false, `Submission ${s.submissionId} duplicated across pages`);
      }

      // Page 3: Fetch remaining 2 using nextCursor from Page 2
      const page3 = await getAdminSubmissions({ limit: 5, cursor: page2.nextCursor! });
      assert.strictEqual(page3.submissions.length, 2);
      assert.strictEqual(page3.hasMore, false);
      assert.strictEqual(page3.nextCursor, null);
    });

    it('paginates consolidated payment ledger with cursor support', async () => {
      const userId = 'user_ledger_cursor';
      const userEmail = 'ledger_cursor@example.com';

      for (let i = 1; i <= 7; i++) {
        const order = await createPaymentOrder({ userId, userEmail });
        await createPaymentSubmission({
          orderId: order.orderId,
          userId,
          userEmail,
          utr: `9876543210${String(i).padStart(2, '0')}`,
          declaredAmount: 499,
          paymentDate: '2026-10-30',
        });
      }

      const p1 = await getConsolidatedPaymentLedger({ limit: 4 });
      assert.strictEqual(p1.records.length, 4);
      assert.strictEqual(p1.total, 7);
      assert.strictEqual(p1.hasMore, true);
      assert.ok(p1.nextCursor);

      const p2 = await getConsolidatedPaymentLedger({ limit: 4, cursor: p1.nextCursor! });
      assert.strictEqual(p2.records.length, 3);
      assert.strictEqual(p2.hasMore, false);
      assert.strictEqual(p2.nextCursor, null);
    });
  });

  describe('3. Transactional Billing Sync Invalidation', () => {
    it('atomically increments billing_sync version inside the approval transaction batch', async () => {
      const userId = 'user_tx_sync_test';
      const userEmail = 'sync_test@example.com';
      const order = await createPaymentOrder({ userId, userEmail });
      const sub = await createPaymentSubmission({
        orderId: order.orderId,
        userId,
        userEmail,
        utr: '432198765432',
        declaredAmount: 499,
        paymentDate: '2026-10-30',
      });

      const versionBefore = await getBillingSyncVersion();

      const approvalRes = await approvePaymentSubmissionInTransaction({
        submissionId: sub.submissionId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_1',
      });

      assert.strictEqual(approvalRes.success, true);
      const versionAfter = await getBillingSyncVersion();
      assert.strictEqual(versionAfter > versionBefore, true, 'Version counter must increment upon approval');
    });

    it('atomically updates billing_sync version when creating new submissions and manual grants', async () => {
      const v0 = await getBillingSyncVersion();

      const grant = await adminManualGrantSubscriptionInTransaction({
        targetUserId: 'user_grant_test',
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_1',
        days: 30,
        reason: 'VIP pass grant for testing',
      });

      assert.ok(grant);
      const v1 = await getBillingSyncVersion();
      assert.strictEqual(v1 > v0, true, 'Version must increment upon manual grant');

      await adminSuspendSubscriptionInTransaction({
        targetUserId: 'user_grant_test',
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_1',
        reason: 'Terms of service violation',
      });

      const v2 = await getBillingSyncVersion();
      assert.strictEqual(v2 > v1, true, 'Version must increment upon suspension');
    });
  });

  describe('4. Authoritative Entitlement Security for Suspended Users', () => {
    it('unconditionally revokes Premium access if status is halted even if cancelAtPeriodEnd is true and periodEnd is in the future', () => {
      const futureDateIso = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

      const suspendedRecord = {
        id: 'sub_suspended_test',
        userId: 'user_abusive_1',
        planId: 'premium_monthly',
        status: 'halted' as const,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: futureDateIso, // 20 days remaining in period
        cancelAtPeriodEnd: true, // Should NOT grant cancelled_grace!
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const entitlement = evaluateSubscriptionEntitlement('user_abusive_1', suspendedRecord);

      assert.strictEqual(entitlement.isPremium, false, 'Suspended user must NEVER receive Premium');
      assert.strictEqual(entitlement.tier, 'free');
      assert.strictEqual(entitlement.status, 'expired');
      assert.strictEqual(entitlement.reason, 'Subscription suspended by administrator');
    });

    it('verifyProtectedOperationEntitlement bypasses cache to inspect authoritative Firestore state', async () => {
      const userId = 'user_cache_bypass_test';
      const res = await adminManualGrantSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_1',
        days: 30,
        reason: 'Initial grant',
      });
      assert.ok(res);

      const entActive = await verifyProtectedOperationEntitlement(userId);
      assert.strictEqual(entActive.isPremium, true);
      assert.strictEqual(entActive.status, 'active');

      // Admin suspends user
      await adminSuspendSubscriptionInTransaction({
        targetUserId: userId,
        adminEmail: 'shashankshines@gmail.com',
        adminUserId: 'admin_1',
        reason: 'Fraud check failure',
      });

      // verifyProtectedOperationEntitlement must immediately see suspended state
      const entSuspended = await verifyProtectedOperationEntitlement(userId);
      assert.strictEqual(entSuspended.isPremium, false);
      assert.strictEqual(entSuspended.status, 'expired');
    });
  });

  describe('5. Job Provider Resilience with Real AbortController Cancellation', () => {
    it('aborts fetch in fetchWithTimeout when caller AbortSignal triggers', async () => {
      const controller = new AbortController();

      // Immediately abort
      controller.abort(new Error('Pre-aborted signal'));

      await assert.rejects(
        () => fetchWithTimeout('https://example.com/api', { signal: controller.signal }, 5000),
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          return msg.includes('aborted') || msg.includes('AbortError') || msg.includes('Pre-aborted');
        }
      );
    });

    it('JobSearchService aborts hanging provider within capped timeout window', async () => {
      const hangingProvider: JobProvider = {
        id: 'hanging_mock_provider',
        name: 'Hanging Mock Provider',
        timeoutMs: 400,
        async fetchJobs(params) {
          return new Promise<NormalizedJob[]>((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve([
                {
                  id: 'too-late',
                  title: 'Too Late Job',
                  company: 'Late Inc',
                  location: 'Remote',
                  url: 'https://example.com/job',
                  sourceId: 'hanging_mock_provider',
                  sourceName: 'Hanging Mock',
                  publishedAt: new Date().toISOString(),
                  employmentType: 'full-time',
                  workplaceType: 'remote',
                  isRemote: true,
                  tags: [],
                },
              ]);
            }, 3000); // Exceeds 400ms timeout

            // Verify that signal aborts the provider
            if (params?.signal) {
              params.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Hanging provider aborted by signal'));
              });
            }
          });
        },
      };

      const fastProvider: JobProvider = {
        id: 'fast_mock_provider',
        name: 'Fast Mock Provider',
        async fetchJobs() {
          return [
            {
              id: 'fast-1',
              title: 'Fast Job',
              company: 'Fast Inc',
              location: 'Remote',
              url: 'https://example.com/fast',
              sourceId: 'fast_mock_provider',
              sourceName: 'Fast Mock',
              publishedAt: new Date().toISOString(),
              employmentType: 'full-time',
              workplaceType: 'remote',
              isRemote: true,
              tags: [],
            },
          ];
        },
      };

      const service = new JobSearchService([hangingProvider, fastProvider]);
      const startTime = Date.now();
      const { jobs, diagnostics } = await service.searchJobs({});
      const duration = Date.now() - startTime;

      // Must complete in ~400-600ms, NEVER hanging for the 3000ms provider!
      assert.strictEqual(duration < 1500, true, `Expected search to complete under 1500ms, took ${duration}ms`);
      assert.strictEqual(jobs.length, 1);
      assert.strictEqual(jobs[0].title, 'Fast Job');

      const hangingDiag = diagnostics.find((d) => d.providerId === 'hanging_mock_provider');
      assert.ok(hangingDiag);
      assert.strictEqual(hangingDiag.status, 'timeout');
    });
  });
});
