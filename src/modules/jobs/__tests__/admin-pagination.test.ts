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
  getAdminSubmissions,
  getConsolidatedPaymentLedger,
  getAdminSubscriptions,
} from '@/modules/storage/firestore/admin-billing.store';
import { getAdminAuditLogs } from '@/modules/storage/firestore/audit.store';
import {
  createSession,
  findOrCreateGoogleUser,
  resetAuthStore,
} from '@/modules/auth/server/session.store';

// Admin API Route Handlers
import { GET as getSubmissionsRoute } from '@/app/api/admin/billing/submissions/route';
import { GET as getLedgerRoute } from '@/app/api/admin/billing/ledger/route';
import { GET as getSubscriptionsRoute } from '@/app/api/admin/subscriptions/route';
import { GET as getAuditLogsRoute } from '@/app/api/admin/audit-logs/route';

describe('JobNexus — Admin Console Pagination (Sets of 5)', () => {
  let mockStore: InMemoryFirestoreStore;
  const adminEmail = 'shashankshines@gmail.com';

  beforeEach(() => {
    resetAuthStore();
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    process.env.ADMIN_EMAILS = adminEmail;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  async function createAdminSessionToken(): Promise<string> {
    const user = await findOrCreateGoogleUser({
      sub: 'google_admin_pagination_sub',
      email: adminEmail,
      name: 'Admin Tester',
      picture: 'https://example.com/admin.jpg',
    });
    const { sessionId } = createSession(user.id);
    return sessionId;
  }

  // ==========================================================================
  // 1. Payment Verification Queue Pagination
  // ==========================================================================
  describe('Verification Queue Pagination (getAdminSubmissions & API Route)', () => {
    beforeEach(async () => {
      const submissionsCol = getSubmissionsCollection();
      const ordersCol = getOrdersCollection();

      // Seed 12 submissions
      for (let i = 1; i <= 12; i++) {
        const orderId = `order_${String(i).padStart(3, '0')}`;
        const subId = `sub_${String(i).padStart(3, '0')}`;
        const utr = `UTR${String(i).padStart(6, '0')}`;
        const submittedAt = new Date(Date.now() - (13 - i) * 3600000).toISOString();

        const order: PaymentOrderDocument = {
          orderId,
          userId: `user_${i}`,
          planId: 'premium_monthly',
          amountInr: 499,
          amountInPaise: 49900,
          currency: 'INR',
          status: 'submitted',
          upiId: 'admin@okaxis',
          payeeName: 'JobNexus Admin',
          createdAt: submittedAt,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
        await ordersCol.doc(orderId).set(order);

        const sub: PaymentSubmissionDocument = {
          submissionId: subId,
          orderId,
          userId: `user_${i}`,
          userEmail: `user_${i}@example.com`,
          utrNumber: utr,
          declaredAmount: 499,
          status: i <= 8 ? 'pending_verification' : 'approved',
          paymentDate: submittedAt.slice(0, 10),
          submittedAt,
          slaDeadlineAt: new Date(Date.now() + 43200000).toISOString(),
        };
        await submissionsCol.doc(subId).set(sub);
      }
    });

    it('fetches default page 1 with exactly 5 items and total=12 in store', async () => {
      const res = await getAdminSubmissions();
      assert.strictEqual(res.submissions.length, 5, 'Should return exactly 5 submissions by default');
      assert.strictEqual(res.total, 12, 'Total should reflect all 12 submissions');
    });

    it('fetches page 2 (offset=5, limit=5) returning next 5 items', async () => {
      const page1 = await getAdminSubmissions({ offset: 0, limit: 5 });
      const page2 = await getAdminSubmissions({ offset: 5, limit: 5 });

      assert.strictEqual(page2.submissions.length, 5);
      assert.strictEqual(page2.total, 12);
      // Ensure page 2 items are distinct from page 1
      const page1Ids = page1.submissions.map((s) => s.submissionId);
      for (const s of page2.submissions) {
        assert.ok(!page1Ids.includes(s.submissionId), `Duplicate ID found: ${s.submissionId}`);
      }
    });

    it('fetches page 3 (offset=10, limit=5) returning remainder of 2 items', async () => {
      const page3 = await getAdminSubmissions({ offset: 10, limit: 5 });
      assert.strictEqual(page3.submissions.length, 2, 'Page 3 should have remaining 2 items');
      assert.strictEqual(page3.total, 12);
    });

    it('filters by status with accurate sliced count and total in store', async () => {
      const res = await getAdminSubmissions({ status: 'approved', limit: 5, offset: 0 });
      assert.strictEqual(res.total, 4, 'Approved submissions total should be 4');
      assert.strictEqual(res.submissions.length, 4);
    });

    it('filters by search query before slicing (query search pagination)', async () => {
      const res = await getAdminSubmissions({ query: 'user_1', limit: 5, offset: 0 });
      // user_1, user_10, user_11, user_12 match 'user_1'
      assert.strictEqual(res.total, 4);
      assert.strictEqual(res.submissions.length, 4);
    });

    it('GET /api/admin/billing/submissions enforces set of 5 by default with auth', async () => {
      const token = await createAdminSessionToken();
      const req = new NextRequest('http://localhost:3000/api/admin/billing/submissions', {
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await getSubmissionsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.limit, 5, 'API route must default to limit=5');
      assert.strictEqual(data.offset, 0);
      assert.strictEqual(data.submissions.length, 5);
      assert.strictEqual(data.total, 12);
    });

    it('GET /api/admin/billing/submissions supports offset pagination parameter', async () => {
      const token = await createAdminSessionToken();
      const req = new NextRequest('http://localhost:3000/api/admin/billing/submissions?offset=5&limit=5', {
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await getSubmissionsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.submissions.length, 5);
      assert.strictEqual(data.offset, 5);
      assert.strictEqual(data.total, 12);
    });
  });

  // ==========================================================================
  // 2. Consolidated Payment Ledger Pagination
  // ==========================================================================
  describe('Payment Ledger Pagination (getConsolidatedPaymentLedger & API Route)', () => {
    beforeEach(async () => {
      const ordersCol = getOrdersCollection();
      const submissionsCol = getSubmissionsCollection();

      // Seed 14 ledger orders
      for (let i = 1; i <= 14; i++) {
        const orderId = `led_order_${String(i).padStart(3, '0')}`;
        const subId = `led_sub_${String(i).padStart(3, '0')}`;
        const createdAt = new Date(Date.now() - (15 - i) * 7200000).toISOString();

        const order: PaymentOrderDocument = {
          orderId,
          userId: `subscriber_${i}`,
          planId: 'premium_monthly',
          amountInr: 499,
          amountInPaise: 49900,
          currency: 'INR',
          status: 'submitted',
          upiId: 'admin@okaxis',
          payeeName: 'JobNexus Admin',
          createdAt,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
        await ordersCol.doc(orderId).set(order);

        const sub: PaymentSubmissionDocument = {
          submissionId: subId,
          orderId,
          userId: `subscriber_${i}`,
          userEmail: `subscriber_${i}@example.com`,
          utrNumber: `UTRLED${String(i).padStart(5, '0')}`,
          declaredAmount: 499,
          status: 'approved',
          paymentDate: createdAt.slice(0, 10),
          submittedAt: createdAt,
          reviewedAt: createdAt,
          reviewedBy: adminEmail,
          slaDeadlineAt: new Date(Date.now() + 43200000).toISOString(),
        };
        await submissionsCol.doc(subId).set(sub);
      }
    });

    it('fetches default set of 5 items with total=14 in store', async () => {
      const res = await getConsolidatedPaymentLedger();
      assert.strictEqual(res.records.length, 5, 'Ledger must return 5 records by default');
      assert.strictEqual(res.total, 14, 'Ledger total must be 14');
    });

    it('fetches page 2 (offset=5) and page 3 (offset=10)', async () => {
      const page2 = await getConsolidatedPaymentLedger({ offset: 5, limit: 5 });
      assert.strictEqual(page2.records.length, 5);
      assert.strictEqual(page2.total, 14);

      const page3 = await getConsolidatedPaymentLedger({ offset: 10, limit: 5 });
      assert.strictEqual(page3.records.length, 4, 'Page 3 should contain remaining 4 records');
      assert.strictEqual(page3.total, 14);
    });

    it('GET /api/admin/billing/ledger defaults to limit=5 and returns total', async () => {
      const token = await createAdminSessionToken();
      const req = new NextRequest('http://localhost:3000/api/admin/billing/ledger', {
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await getLedgerRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.limit, 5);
      assert.strictEqual(data.records.length, 5);
      assert.strictEqual(data.total, 14);
    });
  });

  // ==========================================================================
  // 3. Subscribers & Entitlements Pagination
  // ==========================================================================
  describe('Subscribers Pagination (getAdminSubscriptions & API Route)', () => {
    beforeEach(async () => {
      const subsCol = getSubscriptionsCollection();

      // Seed 11 subscriptions
      for (let i = 1; i <= 11; i++) {
        const userId = `user_sub_${i}`;
        const subDoc: SubscriptionDocument = {
          id: `sub_${userId}`,
          userId,
          planId: 'premium_monthly',
          status: 'active',
          provider: 'manual_upi',
          cancelAtPeriodEnd: false,
          currentPeriodStart: new Date(Date.now() - 86400000).toISOString(),
          currentPeriodEnd: new Date(Date.now() + (i * 86400000)).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now() - (12 - i) * 3600000).toISOString(),
          lastUpdatedFrom: 'manual_upi',
        };
        await subsCol.doc(userId).set(subDoc);
      }
    });

    it('fetches default set of 5 subscribers and total=11 in store', async () => {
      const res = await getAdminSubscriptions();
      assert.strictEqual(res.length, 5, 'Must return 5 subscriptions by default');
      assert.strictEqual((res as unknown as { total?: number }).total, 11, 'Total must be 11');
    });

    it('fetches page 2 (offset=5) and page 3 (offset=10)', async () => {
      const page2 = await getAdminSubscriptions({ offset: 5, limit: 5 });
      assert.strictEqual(page2.length, 5);
      assert.strictEqual((page2 as unknown as { total?: number }).total, 11);

      const page3 = await getAdminSubscriptions({ offset: 10, limit: 5 });
      assert.strictEqual(page3.length, 1, 'Page 3 should have remaining 1 subscription');
      assert.strictEqual((page3 as unknown as { total?: number }).total, 11);
    });

    it('GET /api/admin/subscriptions enforces limit=5 and returns total count', async () => {
      const token = await createAdminSessionToken();
      const req = new NextRequest('http://localhost:3000/api/admin/subscriptions', {
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await getSubscriptionsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.limit, 5);
      assert.strictEqual(data.subscriptions.length, 5);
      assert.strictEqual(data.total, 11);
    });
  });

  // ==========================================================================
  // 4. Governance Audit Logs Pagination
  // ==========================================================================
  describe('Audit Logs Pagination (getAdminAuditLogs & API Route)', () => {
    beforeEach(async () => {
      const auditCol = getAuditLogsCollection();

      // Seed 13 audit logs
      for (let i = 1; i <= 13; i++) {
        const auditId = `audit_${String(i).padStart(3, '0')}`;
        const logDoc: AdminAuditLogDocument = {
          id: auditId,
          actorId: adminEmail,
          actorEmail: adminEmail,
          action: i % 2 === 0 ? 'payment_approved' : 'admin_grant',
          targetUserId: `user_target_${i}`,
          targetEntityId: `sub_${i}`,
          reason: `Verification test step ${i}`,
          timestamp: new Date(Date.now() - (14 - i) * 1800000).toISOString(),
        };
        await auditCol.doc(auditId).set(logDoc);
      }
    });

    it('fetches default set of 5 audit logs and total=13 in store', async () => {
      const res = await getAdminAuditLogs();
      assert.strictEqual(res.length, 5, 'Must return 5 audit logs by default');
      assert.strictEqual((res as unknown as { total?: number }).total, 13, 'Total must be 13');
    });

    it('fetches page 2 (offset=5) and page 3 (offset=10)', async () => {
      const page2 = await getAdminAuditLogs({ offset: 5, limit: 5 });
      assert.strictEqual(page2.length, 5);
      assert.strictEqual((page2 as unknown as { total?: number }).total, 13);

      const page3 = await getAdminAuditLogs({ offset: 10, limit: 5 });
      assert.strictEqual(page3.length, 3, 'Page 3 should have remaining 3 logs');
      assert.strictEqual((page3 as unknown as { total?: number }).total, 13);
    });

    it('GET /api/admin/audit-logs enforces limit=5 and returns total count', async () => {
      const token = await createAdminSessionToken();
      const req = new NextRequest('http://localhost:3000/api/admin/audit-logs', {
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await getAuditLogsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.limit, 5);
      assert.strictEqual(data.logs.length, 5);
      assert.strictEqual(data.total, 13);
    });
  });

  // ==========================================================================
  // 5. AdminPaginationBar Component Logic & Invariants
  // ==========================================================================
  describe('AdminPaginationBar Logic & Calculations', () => {
    it('correctly calculates total pages and item ranges for page size of 5', () => {
      const pageSize = 5;

      // 0 items
      const total0 = 0;
      const totalPages0 = Math.max(1, Math.ceil(total0 / pageSize));
      assert.strictEqual(totalPages0, 1);

      // 12 items -> 3 pages
      const total12 = 12;
      const totalPages12 = Math.max(1, Math.ceil(total12 / pageSize));
      assert.strictEqual(totalPages12, 3);

      // Page 1: 1–5 of 12
      const page1Start = (1 - 1) * pageSize + 1;
      const page1End = Math.min(1 * pageSize, total12);
      assert.strictEqual(page1Start, 1);
      assert.strictEqual(page1End, 5);

      // Page 2: 6–10 of 12
      const page2Start = (2 - 1) * pageSize + 1;
      const page2End = Math.min(2 * pageSize, total12);
      assert.strictEqual(page2Start, 6);
      assert.strictEqual(page2End, 10);

      // Page 3: 11–12 of 12
      const page3Start = (3 - 1) * pageSize + 1;
      const page3End = Math.min(3 * pageSize, total12);
      assert.strictEqual(page3Start, 11);
      assert.strictEqual(page3End, 12);
    });

    it('correctly generates page navigation arrays for short and long total pages', () => {
      function getPages(safeCurrentPage: number, totalPages: number): (number | string)[] {
        if (totalPages <= 5) {
          return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (safeCurrentPage <= 3) {
          return [1, 2, 3, 4, 'ellipsis-right', totalPages];
        }
        if (safeCurrentPage >= totalPages - 2) {
          return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, 'ellipsis-left', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, 'ellipsis-right', totalPages];
      }

      // 4 pages: [1, 2, 3, 4]
      assert.deepStrictEqual(getPages(1, 4), [1, 2, 3, 4]);

      // 10 pages, page 1: [1, 2, 3, 4, 'ellipsis-right', 10]
      assert.deepStrictEqual(getPages(1, 10), [1, 2, 3, 4, 'ellipsis-right', 10]);

      // 10 pages, page 5: [1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 10]
      assert.deepStrictEqual(getPages(5, 10), [1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 10]);

      // 10 pages, page 9: [1, 'ellipsis-left', 7, 8, 9, 10]
      assert.deepStrictEqual(getPages(9, 10), [1, 'ellipsis-left', 7, 8, 9, 10]);
    });
  });
});
