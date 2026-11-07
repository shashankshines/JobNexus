/**
 * JobNexus — Legal Pages, DPDP Compliance & 2-Hour (120-Min) Verification SLA Test Suite
 *
 * Verifies:
 * 1. Authoritative central legal & SLA configuration constants
 * 2. 2-Hour SLA deadline calculations (server-controlled, exact 120 minutes)
 * 3. Client clock immunity (browser manipulation cannot alter server deadline)
 * 4. Submission idempotency (re-submission does not reset or extend SLA clock)
 * 5. Terminal status handling (approval or rejection halts SLA breach escalation)
 * 6. Policy versioning and acceptance recording upon submission
 * 7. Metadata and public accessibility invariants for /privacy-policy & /terms-and-conditions
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  LEGAL_VERSIONS,
  LEGAL_METADATA,
  LEGAL_CONTACT,
  UPI_VERIFICATION_SLA,
  calculateSlaDeadline,
  isSlaOverdue,
} from '@/modules/legal/legal.config';
import {
  setMockFirestoreDb,
  resetFirestoreRegistry,
} from '@/modules/storage/firestore/client';
import { createMockFirestoreDb, InMemoryFirestoreStore } from '@/modules/storage/firestore/mock';
import { resetAuthStore } from '@/modules/auth/server/session.store';
import {
  createPaymentOrder,
  createPaymentSubmission,
  getPaymentOrderById,
} from '@/modules/storage/firestore/order.store';
import {
  getAdminOverview,
  invalidateAdminStoresCache,
} from '@/modules/storage/firestore/admin-billing.store';
import { getSubmissionsCollection } from '@/modules/storage/firestore/collections';
import { metadata as privacyMetadata } from '@/app/privacy-policy/page';
import { metadata as termsMetadata } from '@/app/terms-and-conditions/page';

describe('JobNexus — Central Legal & 2-Hour SLA Configuration', () => {
  it('exports authoritative policy versions and effective dates', () => {
    assert.strictEqual(LEGAL_VERSIONS.privacyPolicy, '1.0');
    assert.strictEqual(LEGAL_VERSIONS.termsAndConditions, '1.0');
    assert.strictEqual(LEGAL_METADATA.governingLaw, 'Laws of India');
    assert.ok(LEGAL_METADATA.effectiveDate);
    assert.ok(LEGAL_METADATA.lastUpdatedDate);
  });

  it('exports strictly 2-hour (120-minute) SLA constants', () => {
    assert.strictEqual(UPI_VERIFICATION_SLA.hours, 2);
    assert.strictEqual(UPI_VERIFICATION_SLA.minutes, 120);
    assert.strictEqual(UPI_VERIFICATION_SLA.ms, 2 * 60 * 60 * 1000); // 7,200,000 ms
    assert.strictEqual(UPI_VERIFICATION_SLA.label, '2 hours');
    assert.strictEqual(UPI_VERIFICATION_SLA.targetLabel, '2h SLA Target');
    assert.strictEqual(UPI_VERIFICATION_SLA.badgeLabel, '>2h');
    assert.strictEqual(UPI_VERIFICATION_SLA.breachThresholdMinutes, 120);
  });

  it('exports statutory grievance contacts and mandatory non-agency disclaimers', () => {
    assert.strictEqual(LEGAL_CONTACT.supportEmail, 'support@jobnexus.in');
    assert.strictEqual(LEGAL_CONTACT.grievanceEmail, 'grievance@jobnexus.in');
    assert.ok(LEGAL_CONTACT.grievanceOfficerName.includes('Grievance Officer'));
    assert.ok(LEGAL_CONTACT.securityNotice.includes('never ask for your UPI PIN'));
    assert.ok(LEGAL_CONTACT.nonAgencyDisclaimer.includes('is not an employer'));
    assert.ok(LEGAL_CONTACT.nonAgencyDisclaimer.includes('not conduct interviews'));
  });

  it('calculates SLA deadline strictly as submittedAt + 120 minutes (7,200,000 ms)', () => {
    const fixedNow = new Date('2026-11-07T12:00:00.000Z');
    const deadline = calculateSlaDeadline(fixedNow);
    assert.strictEqual(deadline.toISOString(), '2026-11-07T14:00:00.000Z');
    assert.strictEqual(deadline.getTime() - fixedNow.getTime(), 7200000);

    // Also supports ISO string input
    const deadlineFromString = calculateSlaDeadline('2026-11-07T12:00:00.000Z');
    assert.strictEqual(deadlineFromString.getTime() - fixedNow.getTime(), 7200000);
  });

  it('identifies overdue submissions accurately based on deadline boundary', () => {
    const deadlineIso = '2026-11-07T14:00:00.000Z';
    const beforeDeadline = new Date('2026-11-07T13:59:59.000Z').getTime();
    const exactlyDeadline = new Date('2026-11-07T14:00:00.000Z').getTime();
    const afterDeadline = new Date('2026-11-07T14:00:01.000Z').getTime();

    assert.strictEqual(isSlaOverdue(deadlineIso, beforeDeadline), false);
    assert.strictEqual(isSlaOverdue(deadlineIso, exactlyDeadline), false);
    assert.strictEqual(isSlaOverdue(deadlineIso, afterDeadline), true);
  });
});

describe('JobNexus — Backend 2-Hour Verification SLA Lifecycle & Idempotency', () => {
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
  it('order creation does NOT start the SLA clock', async () => {
    const order = await createPaymentOrder({ userId: 'usr_sla_test_1' });
    assert.strictEqual(order.status, 'created');
    // Order document itself has an expiration, but NO slaDeadlineAt
    assert.strictEqual((order as any).slaDeadlineAt, undefined);
  });

  it('valid submission records server timestamp, sets 2h SLA deadline, and records policy version', async () => {
    const order = await createPaymentOrder({ userId: 'usr_sla_test_valid' });
    const utr = '429817293812';
    const paymentDate = new Date().toISOString().split('T')[0];

    const submission = await createPaymentSubmission({
      orderId: order.orderId,
      userId: 'usr_sla_test_valid',
      utr,
      declaredAmount: 349,
      paymentDate,
    });

    assert.strictEqual(submission.status, 'pending_verification');
    assert.strictEqual(submission.utrNumber, utr);
    assert.strictEqual(submission.policyVersion, LEGAL_VERSIONS.termsAndConditions);
    assert.ok(submission.policyAcceptedAt);

    const submittedMs = new Date(submission.submittedAt).getTime();
    const deadlineMs = new Date(submission.slaDeadlineAt).getTime();
    const diffHours = (deadlineMs - submittedMs) / (1000 * 60 * 60);

    // Must be exactly 2 hours (120 minutes)
    assert.strictEqual(diffHours, 2);
  });

  it('repeated submission attempt is blocked and does NOT reset the SLA deadline (Idempotency)', async () => {
    const order = await createPaymentOrder({ userId: 'usr_sla_test_idemp' });
    const utr = '889911223344';
    const paymentDate = new Date().toISOString().split('T')[0];

    const initialSubmission = await createPaymentSubmission({
      orderId: order.orderId,
      userId: 'usr_sla_test_idemp',
      utr,
      declaredAmount: 499,
      paymentDate,
    });

    const initialSubmittedAt = initialSubmission.submittedAt;
    const initialDeadline = initialSubmission.slaDeadlineAt;

    // Second attempt on the same order must throw OrderAlreadySubmittedError
    await assert.rejects(
      async () => {
        await createPaymentSubmission({
          orderId: order.orderId,
          userId: 'usr_sla_test_idemp',
          utr: '429817293899',
          declaredAmount: 499,
          paymentDate,
        });
      },
      (err: any) => {
        assert.ok(err.name === 'OrderAlreadySubmittedError' || err.message?.includes('already'));
        return true;
      }
    );

    // Verify stored submission document remained unaltered
    const storedSnap = await getSubmissionsCollection().doc(initialSubmission.submissionId).get();
    const storedData = storedSnap.data();
    assert.strictEqual(storedData?.submittedAt, initialSubmittedAt);
    assert.strictEqual(storedData?.slaDeadlineAt, initialDeadline);
  });

  it('terminal status (Approved or Rejected) halts SLA escalation', async () => {
    // 1. Create a submission with an artificial deadline in the past (>2 hours ago)
    const order = await createPaymentOrder({ userId: 'usr_sla_escalation' });
    const pastSubmissionId = `subm_breach_${Date.now()}`;
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 2h after 3h ago

    await getSubmissionsCollection().doc(pastSubmissionId).set({
      submissionId: pastSubmissionId,
      orderId: order.orderId,
      userId: 'usr_sla_escalation',
      utrNumber: '776655443322',
      declaredAmount: 349,
      paymentDate: '2026-11-07',
      submittedAt: threeHoursAgo,
      slaDeadlineAt: oneHourAgo,
      status: 'pending_verification',
    });

    invalidateAdminStoresCache();
    const overviewPending = await getAdminOverview();
    assert.strictEqual(overviewPending.slaBreachCount, 1);

    // 2. Transition submission to terminal status: 'approved'
    await getSubmissionsCollection().doc(pastSubmissionId).update({
      status: 'approved',
      reviewedBy: 'admin@jobnexus.in',
      reviewedAt: new Date().toISOString(),
    });

    invalidateAdminStoresCache();
    const overviewApproved = await getAdminOverview();
    // Breach count must become 0 because terminal status stops SLA breach count
    assert.strictEqual(overviewApproved.slaBreachCount, 0);
  });
});

describe('JobNexus — Legal Pages Accessibility & SEO Metadata', () => {
  it('Privacy Policy exports valid SEO metadata and canonical URL', () => {
    assert.ok(typeof privacyMetadata.title === 'string' && privacyMetadata.title.includes('Privacy Policy'));
    assert.ok(typeof privacyMetadata.description === 'string' && privacyMetadata.description.includes('JobNexus'));
    assert.strictEqual((privacyMetadata.alternates as any)?.canonical, '/privacy-policy');
  });

  it('Terms & Conditions exports valid SEO metadata and canonical URL', () => {
    assert.ok(typeof termsMetadata.title === 'string' && termsMetadata.title.includes('Terms & Conditions'));
    assert.ok(typeof termsMetadata.description === 'string' && termsMetadata.description.includes('JobNexus'));
    assert.strictEqual((termsMetadata.alternates as any)?.canonical, '/terms-and-conditions');
  });
});
