import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  sendAdminSubmissionAlert,
  retryNotificationById,
  getSimulationProvider,
  resetEmailServiceForTesting,
  setTestEmailProvider,
} from '@/modules/email/email.service';
import {
  getOutboxRecordByIdempotencyKey,
  getOutboxRecordById,
} from '@/modules/storage/firestore/outbox.store';
import { createPaymentOrder, createPaymentSubmission } from '@/modules/storage/firestore/order.store';
import {
  getAdminOverview,
  getAdminSubmissions,
  invalidateAdminStoresCache,
} from '@/modules/storage/firestore/admin-billing.store';
import { POST as submitBillingRoute } from '@/app/api/billing/submit/route';
import {
  createSession,
  resetAuthStore,
  findOrCreateGoogleUser,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/server/session.store';
import { EmailProviderAdapter } from '@/modules/email/adapters/email-provider.interface';
import { EmailSendOptions, EmailSendResult } from '@/modules/email/email.types';

describe('Admin Payment Approval Notifications & Verification Queue Resilience', () => {
  let firestoreStore: InMemoryFirestoreStore;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'shashankshines@gmail.com';
    firestoreStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(firestoreStore));
    invalidateAdminStoresCache();
    resetAuthStore();
    resetEmailServiceForTesting();
  });

  describe('1. Admin Email Notification (sendAdminSubmissionAlert)', () => {
    it('dispatches branded admin_payment_review email to ADMIN_EMAILS with masked UTR and verification queue link', async () => {
      const simProvider = getSimulationProvider();
      const submissionId = 'subm_fec128c285a45720';

      const result = await sendAdminSubmissionAlert({
        userId: 'usr_google_104927594380678802695',
        orderId: 'ord_a9bfd4e16fd4f64c',
        submissionId,
        userEmail: 'sweekarshines@gmail.com',
        utrNumber: '429183746512',
        declaredAmount: 499,
        currency: 'INR',
        paymentDate: '2026-11-02',
        submittedAt: '2026-11-02T07:50:43.731Z',
        slaDeadlineAt: '2026-11-02T19:50:43.731Z',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'sent');

      const outbox = await getOutboxRecordByIdempotencyKey(
        `admin_payment_review:${submissionId}:shashankshines@gmail.com`
      );
      assert.ok(outbox, 'Outbox record must be persisted for admin payment alert');
      assert.strictEqual(outbox.templateType, 'admin_payment_review');
      assert.strictEqual(outbox.recipientEmail, 'shashankshines@gmail.com');
      assert.strictEqual(outbox.status, 'sent');

      const sent = simProvider.getSentEmails();
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'shashankshines@gmail.com');
      assert.ok(sent[0].subject.includes('Approval Required'));
      assert.ok(sent[0].subject.includes('sweekarshines@gmail.com'));
      assert.ok(!sent[0].subject.includes('429183746512'), 'Raw UTR must not leak in subject');
      assert.ok(!sent[0].html.includes('429183746512'), 'Raw UTR must be masked in email HTML');
      assert.ok(sent[0].html.includes('4291••••••••6512'), 'Masked UTR must appear in email HTML');
      assert.ok(sent[0].html.includes('/admin?tab=verifications'), 'Direct Verification Queue CTA link required');
    });

    it('enforces idempotency so duplicate triggers do not re-email the administrator', async () => {
      const simProvider = getSimulationProvider();
      const params = {
        userId: 'usr_dup_admin_alert',
        orderId: 'ord_dup_1',
        submissionId: 'subm_dup_1',
        userEmail: 'subscriber@example.com',
        utrNumber: '918273645511',
        declaredAmount: 499,
        paymentDate: '2026-11-02',
        submittedAt: new Date().toISOString(),
      };

      const first = await sendAdminSubmissionAlert(params);
      const second = await sendAdminSubmissionAlert(params);

      assert.strictEqual(first.success, true);
      assert.strictEqual(second.success, true);
      assert.strictEqual(simProvider.getSentEmails().length, 1);
    });

    it('gracefully skips without throwing when ADMIN_EMAILS is unset or empty', async () => {
      process.env.ADMIN_EMAILS = '   ';
      const simProvider = getSimulationProvider();

      const result = await sendAdminSubmissionAlert({
        userId: 'usr_no_admin',
        orderId: 'ord_no_admin',
        submissionId: 'subm_no_admin',
        userEmail: 'subscriber@example.com',
        utrNumber: '112233445566',
        declaredAmount: 499,
        paymentDate: '2026-11-02',
        submittedAt: new Date().toISOString(),
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'skipped_missing_email');
      assert.strictEqual(simProvider.getSentEmails().length, 0);
    });

    it('supports manual retry via retryNotificationById for failed admin_payment_review alerts', async () => {
      let shouldFail = true;
      const flakyAdapter: EmailProviderAdapter = {
        providerName: 'flaky-smtp',
        isConfigured: true,
        async send(opts: EmailSendOptions): Promise<EmailSendResult> {
          if (shouldFail) {
            return {
              success: false,
              provider: 'flaky-smtp',
              error: 'Temporary SMTP timeout',
              retryable: true,
            };
          }
          return {
            success: true,
            provider: 'flaky-smtp',
            providerMessageId: `msg_recovered_${opts.to}`,
          };
        },
      };
      setTestEmailProvider(flakyAdapter);

      const initial = await sendAdminSubmissionAlert({
        userId: 'usr_retry_admin',
        orderId: 'ord_retry_admin',
        submissionId: 'subm_retry_admin',
        userEmail: 'sweekarshines@gmail.com',
        utrNumber: '778899001122',
        declaredAmount: 499,
        paymentDate: '2026-11-02',
        submittedAt: new Date().toISOString(),
      });

      assert.strictEqual(initial.success, false);
      assert.strictEqual(initial.outboxIds.length, 1);
      const outboxId = initial.outboxIds[0];

      shouldFail = false;
      const retried = await retryNotificationById(outboxId, 'shashankshines@gmail.com');
      assert.strictEqual(retried.success, true);
      assert.strictEqual(retried.status, 'sent');

      const record = await getOutboxRecordById(outboxId);
      assert.strictEqual(record?.status, 'sent');
    });
  });

  describe('2. POST /api/billing/submit Dual Notification Dispatch', () => {
    it('dispatches both subscriber acknowledgement and administrator approval email on submission', async () => {
      const simProvider = getSimulationProvider();
      const subscriber = findOrCreateGoogleUser({
        sub: '104927594380678802695',
        email: 'sweekarshines@gmail.com',
        name: 'Sweekar',
      });
      const session = createSession(subscriber.id);
      const order = await createPaymentOrder({
        userId: subscriber.id,
        userEmail: subscriber.email,
      });
      const today = new Date().toISOString().slice(0, 10);

      const req = new NextRequest('http://localhost:3000/api/billing/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${session.sessionId}`,
        },
        body: JSON.stringify({
          orderId: order.orderId,
          utr: '556677889900',
          declaredAmount: 499,
          paymentDate: today,
        }),
      });

      const res = await submitBillingRoute(req);
      assert.strictEqual(res.status, 201);
      const payload = await res.json();
      assert.strictEqual(payload.success, true);
      assert.strictEqual(payload.emailStatus, 'sent');
      assert.strictEqual(payload.adminAlertStatus, 'sent');

      const sent = simProvider.getSentEmails();
      assert.strictEqual(sent.length, 2, 'Must dispatch 1 customer email + 1 admin alert email');
      const recipients = sent.map((m) => m.to).sort();
      assert.deepStrictEqual(recipients, ['shashankshines@gmail.com', 'sweekarshines@gmail.com']);
    });
  });

  describe('3. Admin Overview Preview & Firestore Index Fallback Resilience', () => {
    it('populates pendingSubmissionsPreview in getAdminOverview sorted newest-first', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const o1 = await createPaymentOrder({ userId: 'usr_1', userEmail: 'older@example.com' });
      await createPaymentSubmission({
        orderId: o1.orderId,
        userId: 'usr_1',
        userEmail: 'older@example.com',
        utr: '111122223333',
        declaredAmount: 499,
        paymentDate: today,
      });

      await new Promise((r) => setTimeout(r, 10));

      const o2 = await createPaymentOrder({ userId: 'usr_2', userEmail: 'sweekarshines@gmail.com' });
      const sub2 = await createPaymentSubmission({
        orderId: o2.orderId,
        userId: 'usr_2',
        userEmail: 'sweekarshines@gmail.com',
        utr: '444455556666',
        declaredAmount: 499,
        paymentDate: today,
      });

      const metrics = await getAdminOverview();
      assert.strictEqual(metrics.pendingCount, 2);
      assert.ok(Array.isArray(metrics.pendingSubmissionsPreview));
      assert.strictEqual(metrics.pendingSubmissionsPreview.length, 2);
      assert.strictEqual(metrics.pendingSubmissionsPreview[0].submissionId, sub2.submissionId);
      assert.strictEqual(metrics.pendingSubmissionsPreview[0].userEmail, 'sweekarshines@gmail.com');
    });

    it('gracefully falls back to deterministic in-memory sorting when Firestore throws FAILED_PRECONDITION index error', async () => {
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 1; i <= 3; i++) {
        const order = await createPaymentOrder({
          userId: `usr_idx_${i}`,
          userEmail: `user${i}@example.com`,
        });
        await createPaymentSubmission({
          orderId: order.orderId,
          userId: `usr_idx_${i}`,
          userEmail: `user${i}@example.com`,
          utr: `80000000000${i}`,
          declaredAmount: 499,
          paymentDate: today,
        });
        await new Promise((r) => setTimeout(r, 5));
      }

      // Wrap mock Firestore upi_submissions collection so compound orderBy throws code 9 FAILED_PRECONDITION
      const baseDb = createMockFirestoreDb(firestoreStore);
      const originalCollection = baseDb.collection.bind(baseDb);
      const indexFailDb = Object.create(baseDb);
      indexFailDb.collection = (name: string) => {
        const col = originalCollection(name);
        if (name !== 'upi_submissions') return col;

        const wrapWithIndexFailure = (queryObj: Record<string, unknown>) => {
          const proxy = Object.create(queryObj);
          proxy.where = (...args: unknown[]) =>
            wrapWithIndexFailure((queryObj.where as (...a: unknown[]) => Record<string, unknown>)(...args));
          proxy.orderBy = () => {
            const failingQuery = Object.create(queryObj);
            failingQuery.orderBy = () => failingQuery;
            failingQuery.startAfter = () => failingQuery;
            failingQuery.offset = () => failingQuery;
            failingQuery.limit = () => failingQuery;
            failingQuery.get = async () => {
              const err = new Error('9 FAILED_PRECONDITION: The query requires an index.') as Error & {
                code: number;
              };
              err.code = 9;
              throw err;
            };
            return failingQuery;
          };
          return proxy;
        };

        return wrapWithIndexFailure(col as unknown as Record<string, unknown>);
      };

      setMockFirestoreDb(indexFailDb);
      invalidateAdminStoresCache();

      const page1 = await getAdminSubmissions({ status: 'pending_verification', limit: 2, offset: 0 });
      assert.strictEqual(page1.total, 3);
      assert.strictEqual(page1.submissions.length, 2);
      assert.strictEqual(page1.hasMore, true);
      assert.strictEqual(page1.submissions[0].userEmail, 'user3@example.com');
      assert.strictEqual(page1.submissions[1].userEmail, 'user2@example.com');
      assert.ok(page1.nextCursor);

      const page2 = await getAdminSubmissions({
        status: 'pending_verification',
        limit: 2,
        cursor: page1.nextCursor || undefined,
      });
      assert.strictEqual(page2.submissions.length, 1);
      assert.strictEqual(page2.hasMore, false);
      assert.strictEqual(page2.submissions[0].userEmail, 'user1@example.com');
    });
  });

  describe('4. UI Notification Gating & Firestore Index Configuration Invariants', () => {
    it('strictly gates in-app admin approval polling and banner in page.tsx to isDesignatedAdmin', () => {
      const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');

      assert.ok(
        content.includes('if (!isDesignatedAdmin) {\n      setAdminPendingCount(0);'),
        'Admin approval polling effect must exit immediately for non-admin users'
      );
      assert.ok(
        content.includes('{isDesignatedAdmin &&\n          adminPendingCount > 0 &&'),
        'In-app admin approval banner must be strictly guarded by isDesignatedAdmin'
      );
      assert.ok(
        content.includes('href="/admin?tab=verifications"'),
        'In-app admin approval banner must link directly to /admin?tab=verifications'
      );
    });

    it('surfaces verification queue fetch errors and pending approval alert banner in admin/page.tsx', () => {
      const adminPagePath = path.resolve(process.cwd(), 'src/app/admin/page.tsx');
      const adminContent = fs.readFileSync(adminPagePath, 'utf8');

      assert.ok(
        adminContent.includes('Unable to load verification queue:'),
        'Admin verification queue must render explicit error state instead of silent empty state'
      );
      assert.ok(
        adminContent.includes('Pending payment approvals alert'),
        'Admin console must render prominent pending payment approvals banner across tabs'
      );
    });

    it('tracks required upi_submissions composite indexes in firestore.indexes.json', () => {
      const indexesPath = path.resolve(process.cwd(), 'firestore.indexes.json');
      assert.ok(fs.existsSync(indexesPath), 'firestore.indexes.json must exist in repository root');
      const parsed = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));
      assert.ok(Array.isArray(parsed.indexes) && parsed.indexes.length >= 2);
      const collectionGroups = parsed.indexes.map((idx: { collectionGroup: string }) => idx.collectionGroup);
      assert.ok(collectionGroups.every((cg: string) => cg === 'upi_submissions'));
    });
  });
});
