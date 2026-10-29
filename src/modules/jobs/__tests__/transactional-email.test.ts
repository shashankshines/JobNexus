import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  sendSubmissionAcknowledgement,
  sendPaymentApprovalNotification,
  sendPaymentRejectionNotification,
  retryNotificationById,
  getSimulationProvider,
  resetEmailServiceForTesting,
  setTestEmailProvider,
} from '@/modules/email/email.service';
import {
  getOutboxRecordByIdempotencyKey,
  getOutboxRecordById,
  getRecentOutboxRecords,
} from '@/modules/storage/firestore/outbox.store';
import { maskUtr, escapeHtml } from '@/modules/email/templates/base.template';
import { EmailProviderAdapter } from '@/modules/email/adapters/email-provider.interface';
import { EmailSendOptions, EmailSendResult } from '@/modules/email/email.types';
import { GET as getNotificationsRoute } from '@/app/api/admin/billing/notifications/route';
import { POST as retryNotificationRoute } from '@/app/api/admin/billing/notifications/retry/route';
import { createSession, resetAuthStore, findOrCreateGoogleUser, SESSION_COOKIE_NAME } from '@/modules/auth/server/session.store';

describe('JobNexus Transactional Payment Email Lifecycle (Phase 2B.4)', () => {
  let firestoreStore: InMemoryFirestoreStore;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'shashankshines@gmail.com';
    firestoreStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(firestoreStore));
    resetAuthStore();
    resetEmailServiceForTesting();
  });

  describe('Template Security & Formatting Helpers', () => {
    it('masks UTR cleanly preserving only prefix and suffix', () => {
      assert.strictEqual(maskUtr('123456789012'), '1234••••••••9012');
      assert.strictEqual(maskUtr('UPI987654321'), 'UPI9••••••••4321');
      assert.strictEqual(maskUtr('12345'), '12••••45'); // Preserves 2 prefix and 2 suffix
      assert.strictEqual(maskUtr(''), '••••••••');
    });

    it('escapes dangerous HTML characters to prevent injection', () => {
      const dangerous = '<script>alert("xss")</script> & "quotes" \'single\'';
      const escaped = escapeHtml(dangerous);
      assert.ok(!escaped.includes('<script>'));
      assert.ok(escaped.includes('&lt;script&gt;'));
      assert.ok(escaped.includes('&amp;'));
      assert.ok(escaped.includes('&quot;'));
      assert.ok(escaped.includes('&#039;'));
    });
  });

  describe('Event A: Payment Submission Acknowledgement', () => {
    it('dispatches submission acknowledgement email and persists outbox record', async () => {
      const subId = `sub_test_${Date.now()}`;
      const simProvider = getSimulationProvider();

      const result = await sendSubmissionAcknowledgement({
        userId: 'usr_test_alpha',
        orderId: 'ord_test_alpha',
        submissionId: subId,
        userEmail: 'applicant@example.com',
        utrNumber: '512398741234',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'sent');

      // Verify outbox persistence
      const outbox = await getOutboxRecordByIdempotencyKey(`payment_submitted:${subId}`);
      assert.ok(outbox);
      assert.strictEqual(outbox.userId, 'usr_test_alpha');
      assert.strictEqual(outbox.status, 'sent');
      assert.strictEqual(outbox.templateType, 'payment_submitted');

      // Verify sent email content via simulation provider
      const sent = simProvider.getSentEmails();
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'applicant@example.com');
      assert.ok(sent[0].subject.includes('Payment details received'));
      // Full UTR must NOT appear in body or subject
      assert.ok(!sent[0].subject.includes('512398741234'));
      assert.ok(sent[0].html.includes('5123••••••••1234'));
      assert.ok(sent[0].html.includes('12 hours'));
      assert.ok(sent[0].html.includes('is not activated merely because a UTR was submitted'));
    });

    it('enforces O(1) idempotency deduplication on repeated submissions', async () => {
      const subId = `sub_dup_${Date.now()}`;
      const simProvider = getSimulationProvider();

      const first = await sendSubmissionAcknowledgement({
        userId: 'usr_test_dup',
        orderId: 'ord_test_dup',
        submissionId: subId,
        userEmail: 'duplicate@example.com',
        utrNumber: '998877665544',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      assert.strictEqual(first.success, true);
      assert.strictEqual(simProvider.getSentEmails().length, 1);

      // Second identical call
      const second = await sendSubmissionAcknowledgement({
        userId: 'usr_test_dup',
        orderId: 'ord_test_dup',
        submissionId: subId,
        userEmail: 'duplicate@example.com',
        utrNumber: '998877665544',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      assert.strictEqual(second.success, true);
      assert.strictEqual(second.status, 'sent');
      // Email should NOT be re-dispatched to provider
      assert.strictEqual(simProvider.getSentEmails().length, 1);
    });

    it('safely handles users without an email address without throwing', async () => {
      const subId = `sub_no_email_${Date.now()}`;
      const result = await sendSubmissionAcknowledgement({
        userId: 'usr_ghost_user_no_email',
        orderId: 'ord_ghost',
        submissionId: subId,
        utrNumber: '112233445566',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      // Does not throw, safely returns skipped status
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'skipped_missing_email');
      assert.ok(result.error?.includes('No valid email address recorded'));
    });
  });

  describe('Event B: Payment Approval Notification', () => {
    it('dispatches payment approval notification with period dates and benefit guidance', async () => {
      const subId = `sub_app_${Date.now()}`;
      const simProvider = getSimulationProvider();

      const result = await sendPaymentApprovalNotification({
        userId: 'usr_approved_buyer',
        orderId: 'ord_app_123',
        submissionId: subId,
        userEmail: 'buyer@example.com',
        amountInr: 499,
        currentPeriodStart: '2026-10-29T12:00:00Z',
        currentPeriodEnd: '2026-11-28T12:00:00Z',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'sent');

      const outbox = await getOutboxRecordByIdempotencyKey(`payment_approved:${subId}`);
      assert.ok(outbox);
      assert.strictEqual(outbox.templateType, 'payment_approved');

      const sent = simProvider.getSentEmails();
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'buyer@example.com');
      assert.ok(sent[0].subject.includes('Payment Approved'));
      assert.ok(sent[0].subject.includes('Welcome to JobNexus Premium!'));
      assert.ok(sent[0].html.includes('₹499 INR'));
      assert.ok(sent[0].html.includes('ACTIVE (30 Days)'));
      assert.ok(sent[0].html.includes('Unmasked Application Links'));
    });
  });

  describe('Event C: Payment Rejection Notification', () => {
    it('dispatches rejection notification with reason and non-refund clarification', async () => {
      const subId = `sub_rej_${Date.now()}`;
      const simProvider = getSimulationProvider();

      const result = await sendPaymentRejectionNotification({
        userId: 'usr_rejected_buyer',
        orderId: 'ord_rej_123',
        submissionId: subId,
        userEmail: 'rejected@example.com',
        maskedUtr: '123456789099',
        rejectionReason: 'UTR reference not found in bank statement for transaction date 2026-10-29.',
        submittedAt: '2026-10-29T10:00:00Z',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'sent');

      const outbox = await getOutboxRecordByIdempotencyKey(`payment_rejected:${subId}`);
      assert.ok(outbox);
      assert.strictEqual(outbox.templateType, 'payment_rejected');

      const sent = simProvider.getSentEmails();
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'rejected@example.com');
      assert.ok(sent[0].subject.includes('Update on payment verification'));
      assert.ok(sent[0].html.includes('UTR reference not found in bank statement'));
      assert.ok(sent[0].html.includes('does not indicate that your bank transaction was reversed or refunded'));
      assert.ok(sent[0].html.includes('submit the corrected transaction reference'));
    });
  });

  describe('Delivery Reliability, Failures & Administrative Retry', () => {
    it('records retryable failure state when provider times out or fails transiently', async () => {
      const subId = `sub_transient_${Date.now()}`;

      // Mock a failing provider that simulates a network timeout
      const failingProvider: EmailProviderAdapter = {
        providerName: 'MockTransientFailure',
        isConfigured: true,
        async send(options: EmailSendOptions): Promise<EmailSendResult> {
          return {
            success: false,
            provider: 'MockTransientFailure',
            error: 'Connection timeout after 10000ms',
            retryable: true,
          };
        },
      };

      setTestEmailProvider(failingProvider);

      const result = await sendSubmissionAcknowledgement({
        userId: 'usr_retry_user',
        orderId: 'ord_retry_test',
        submissionId: subId,
        userEmail: 'retryuser@example.com',
        utrNumber: '998877112233',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'retryable_failure');

      const outbox = await getOutboxRecordByIdempotencyKey(`payment_submitted:${subId}`);
      assert.strictEqual(outbox?.status, 'retryable_failure');
      assert.strictEqual(outbox?.attempts, 1);
      assert.ok(outbox?.error?.includes('Connection timeout'));
    });

    it('allows administrative manual retry to succeed when provider recovers', async () => {
      const subId = `sub_recovery_${Date.now()}`;

      // First run: failing provider
      const failingProvider: EmailProviderAdapter = {
        providerName: 'MockFailing',
        isConfigured: true,
        async send(): Promise<EmailSendResult> {
          return {
            success: false,
            provider: 'MockFailing',
            error: 'Service Unavailable 503',
            retryable: true,
          };
        },
      };
      setTestEmailProvider(failingProvider);

      await sendSubmissionAcknowledgement({
        userId: 'usr_recovered_user',
        orderId: 'ord_rec_test',
        submissionId: subId,
        userEmail: 'recovered@example.com',
        utrNumber: '887766554433',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      const initialOutbox = await getOutboxRecordByIdempotencyKey(`payment_submitted:${subId}`);
      assert.strictEqual(initialOutbox?.status, 'retryable_failure');

      // Provider recovers: switch to simulation provider
      resetEmailServiceForTesting();
      const simProvider = getSimulationProvider();

      // Admin executes retry
      const retryResult = await retryNotificationById(initialOutbox!.id, 'shashankshines@gmail.com');
      assert.strictEqual(retryResult.success, true);
      assert.strictEqual(retryResult.status, 'sent');

      const updatedOutbox = await getOutboxRecordById(initialOutbox!.id);
      assert.strictEqual(updatedOutbox?.status, 'sent');
      assert.strictEqual(updatedOutbox?.attempts, 2);
      assert.ok(updatedOutbox?.sentAt);

      assert.strictEqual(simProvider.getSentEmails().length, 1);
      assert.strictEqual(simProvider.getSentEmails()[0].to, 'recovered@example.com');
    });
  });

  describe('Administrative Notification API Endpoints', () => {
    it('rejects unauthorized requests to notification endpoints', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/billing/notifications');
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it('returns notifications list for authorized administrator', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_admin_notif_sub',
        email: 'shashankshines@gmail.com',
        name: 'Admin Shashank',
      });
      const { sessionId } = createSession(adminUser.id);

      // Seed an outbox notification
      await sendSubmissionAcknowledgement({
        userId: 'usr_api_test',
        orderId: 'ord_api_test',
        submissionId: 'sub_api_test',
        userEmail: 'customer@example.com',
        utrNumber: '123456789012',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/admin/billing/notifications', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });

      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.notifications));
      assert.strictEqual(data.total, 1);
      assert.strictEqual(data.notifications[0].recipientEmail, 'customer@example.com');
    });

    it('retries a notification via admin retry endpoint', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_admin_retry_sub',
        email: 'shashankshines@gmail.com',
        name: 'Admin Shashank',
      });
      const { sessionId } = createSession(adminUser.id);

      // Mock failure first
      setTestEmailProvider({
        providerName: 'MockFail',
        isConfigured: true,
        async send() {
          return {
            success: false,
            provider: 'MockFail',
            error: 'Rate limit exceeded 429',
            retryable: true,
          };
        },
      });

      await sendSubmissionAcknowledgement({
        userId: 'usr_retry_api',
        orderId: 'ord_retry_api',
        submissionId: 'sub_retry_api',
        userEmail: 'applicant_retry@example.com',
        utrNumber: '999888777666',
        declaredAmount: 499,
        paymentDate: '2026-10-29',
        submittedAt: new Date().toISOString(),
      });

      const failedDoc = await getOutboxRecordByIdempotencyKey('payment_submitted:sub_retry_api');
      assert.ok(failedDoc);
      assert.strictEqual(failedDoc.status, 'retryable_failure');

      // Now restore working provider and trigger admin retry route
      resetEmailServiceForTesting();

      const req = new NextRequest('http://localhost:3000/api/admin/billing/notifications/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
        body: JSON.stringify({ notificationId: failedDoc.id }),
      });

      const res = await retryNotificationRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'sent');

      const rechecked = await getOutboxRecordById(failedDoc.id);
      assert.strictEqual(rechecked?.status, 'sent');
    });
  });
});
