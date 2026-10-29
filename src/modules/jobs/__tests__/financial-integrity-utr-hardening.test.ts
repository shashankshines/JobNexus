import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  getOrdersCollection,
  getSubmissionsCollection,
  getUtrReservationsCollection,
  getAuditLogsCollection,
  PaymentOrderDocument,
  PaymentSubmissionDocument,
  UtrReservationDocument,
} from '@/modules/storage/firestore/collections';
import {
  approvePaymentSubmissionInTransaction,
  rejectPaymentSubmissionInTransaction,
  adminSuspendSubscriptionInTransaction,
  adminReinstateSubscriptionInTransaction,
  adminRevokeSubscriptionInTransaction,
  adminManualGrantSubscriptionInTransaction,
} from '@/modules/storage/firestore/admin-billing.store';
import {
  reserveUtrInTransaction,
  UtrCollisionError,
} from '@/modules/storage/firestore/utr-reservation';
import { evaluateSubscriptionEntitlement } from '@/modules/billing/services/entitlement.service';
import {
  createSession,
  findOrCreateGoogleUser,
  resetAuthStore,
} from '@/modules/auth/server/session.store';

// API Routes
import { POST as controlRoute } from '@/app/api/admin/subscriptions/control/route';
import { POST as approveRoute } from '@/app/api/admin/billing/submissions/approve/route';
import { POST as rejectRoute } from '@/app/api/admin/billing/submissions/reject/route';

describe('JobNexus — Financial Integrity, UTR Protection & Admin Authorization Hardening (Phase 2B.3B.1)', () => {
  let mockStore: InMemoryFirestoreStore;
  const designatedAdminEmail = 'shashankshines@gmail.com';
  const testUserId = 'usr_hardened_customer_1';
  const testOrderId = 'ord_hardened_101';
  const testSubmissionId = 'subm_hardened_202';
  const testUtr = '402918273645';

  beforeEach(() => {
    resetAuthStore();
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    process.env.ADMIN_EMAILS = designatedAdminEmail;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  async function seedTestOrderAndSubmission(overrides?: {
    utr?: string;
    orderId?: string;
    submissionId?: string;
    userId?: string;
  }) {
    const utr = overrides?.utr || testUtr;
    const orderId = overrides?.orderId || testOrderId;
    const submissionId = overrides?.submissionId || testSubmissionId;
    const userId = overrides?.userId || testUserId;
    const nowIso = new Date().toISOString();

    const orderDoc: PaymentOrderDocument = {
      orderId,
      userId,
      planId: 'premium_monthly',
      amountInr: 499,
      amountInPaise: 49900,
      currency: 'INR',
      status: 'created',
      upiId: 'jobnexus@icici',
      payeeName: 'JobNexus Technologies',
      paymentDescription: 'JobNexus Premium Monthly',
      createdAt: nowIso,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    await getOrdersCollection().doc(orderId).set(orderDoc);

    const reservationDoc: UtrReservationDocument = {
      utrNumber: utr,
      orderId,
      submissionId,
      userId,
      status: 'reserved',
      reservedAt: nowIso,
    };
    await getUtrReservationsCollection().doc(utr).set(reservationDoc);

    const submissionDoc: PaymentSubmissionDocument = {
      submissionId,
      orderId,
      userId,
      utrNumber: utr,
      declaredAmount: 499,
      paymentDate: nowIso.split('T')[0],
      status: 'pending_verification',
      submittedAt: nowIso,
      slaDeadlineAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };
    await getSubmissionsCollection().doc(submissionId).set(submissionDoc);

    return { orderDoc, reservationDoc, submissionDoc };
  }

  // ==========================================================================
  // Section 1: UTR Lifecycle, Protection & History Tracking
  // ==========================================================================
  describe('1. UTR Lifecycle, History Tracking & Collision Protection', () => {
    it('releases reserved UTR on rejection with release reason', async () => {
      await seedTestOrderAndSubmission();

      const result = await rejectPaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Bank statement mismatch on stated date',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.submission.status, 'rejected');

      const reservationSnap = await getUtrReservationsCollection().doc(testUtr).get();
      const reservation = reservationSnap.data() as UtrReservationDocument;
      assert.strictEqual(reservation.status, 'released');
      assert.strictEqual(reservation.releaseReason, 'Bank statement mismatch on stated date');
      assert.ok(reservation.releasedAt);
    });

    it('preserves released reservation history when UTR is re-reserved by user after rejection', async () => {
      await seedTestOrderAndSubmission();

      // Step 1: Reject first submission
      await rejectPaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Temporary hold or user corrected mistake',
      });

      // Step 2: User corrects and re-submits same UTR under new submission
      const newSubmissionId = 'subm_corrected_303';
      const db = createMockFirestoreDb(mockStore);

      const reReserved = await db.runTransaction(async (transaction) => {
        return reserveUtrInTransaction(transaction, {
          utr: testUtr,
          orderId: testOrderId,
          submissionId: newSubmissionId,
          userId: testUserId,
        });
      });

      assert.strictEqual(reReserved.status, 'reserved');
      assert.strictEqual(reReserved.submissionId, newSubmissionId);
      assert.ok(reReserved.history && reReserved.history.length === 1);
      assert.strictEqual(reReserved.history[0].submissionId, testSubmissionId);
      assert.strictEqual(reReserved.history[0].releaseReason, 'Temporary hold or user corrected mistake');
    });

    it('prevents consuming an already consumed UTR by a different order or submission', async () => {
      await seedTestOrderAndSubmission();

      // Step 1: Approve first payment -> consumes UTR
      await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        verificationNotes: 'Bank credit confirmed',
      });

      const resSnap = await getUtrReservationsCollection().doc(testUtr).get();
      assert.strictEqual((resSnap.data() as UtrReservationDocument).status, 'consumed');

      // Step 2: Attempting to reserve this consumed UTR must throw UtrCollisionError
      const db = createMockFirestoreDb(mockStore);
      await assert.rejects(
        async () => {
          await db.runTransaction(async (transaction) => {
            return reserveUtrInTransaction(transaction, {
              utr: testUtr,
              orderId: 'ord_fraud_999',
              submissionId: 'subm_fraud_999',
              userId: 'usr_fraud_999',
            });
          });
        },
        (err: unknown) => {
          assert(err instanceof UtrCollisionError);
          assert.strictEqual(err.conflictReason, 'already_consumed');
          return true;
        }
      );
    });

    it('blocks payment approval if UTR reservation is in released status', async () => {
      await seedTestOrderAndSubmission();

      // Mark reservation as released
      await getUtrReservationsCollection().doc(testUtr).update({
        status: 'released',
        releasedAt: new Date().toISOString(),
        releaseReason: 'Released earlier',
      });

      await assert.rejects(
        async () => {
          await approvePaymentSubmissionInTransaction({
            submissionId: testSubmissionId,
            adminEmail: designatedAdminEmail,
            adminUserId: 'admin_1',
          });
        },
        /Cannot approve payment: UTR reservation for ".*" was released/
      );
    });

    it('blocks payment rejection if UTR is already consumed by an approved payment', async () => {
      await seedTestOrderAndSubmission();

      // Approve first
      await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
      });

      // Force submission status back to pending_verification to test race condition where
      // rejection is attempted after approval has already consumed the UTR
      await getSubmissionsCollection().doc(testSubmissionId).update({
        status: 'pending_verification',
      });

      await assert.rejects(
        async () => {
          await rejectPaymentSubmissionInTransaction({
            submissionId: testSubmissionId,
            adminEmail: designatedAdminEmail,
            adminUserId: 'admin_1',
            reason: 'Late dispute attempt',
          });
        },
        /CRITICAL: Cannot reject submission: UTR ".*" is already consumed/
      );
    });
  });

  // ==========================================================================
  // Section 2: Firestore Transaction Read-Before-Write Ordering & Deterministic Audits
  // ==========================================================================
  describe('2. Firestore Read-Before-Write Ordering & Deterministic Audits', () => {
    it('executes all reads before writes during rejection (strict mock verification)', async () => {
      await seedTestOrderAndSubmission();

      // Mock DB enforces that any .get() after .update()/.set() throws FirebaseError.
      // Calling rejectPaymentSubmissionInTransaction will pass only if reads precede writes.
      const result = await rejectPaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Clean read-before-write test',
      });

      assert.strictEqual(result.success, true);
    });

    it('uses deterministic audit document IDs to prevent duplicate audit records on retries', async () => {
      await seedTestOrderAndSubmission();

      // Approval deterministic ID: audit_app_${submissionId}
      await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        verificationNotes: 'First attempt',
      });

      // Retry approval (simulates network retry or duplicate button click)
      const retryResult = await approvePaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        verificationNotes: 'Second attempt',
      });

      assert.strictEqual(retryResult.idempotent, true);

      // Audit logs collection should contain exactly 1 entry for this approval
      const auditDocs = await getAuditLogsCollection().get();
      const appAudits = auditDocs.docs.filter((d) => d.id === `audit_app_${testSubmissionId}`);
      assert.strictEqual(appAudits.length, 1);
    });

    it('rejection uses deterministic audit document IDs (audit_rej_${submissionId})', async () => {
      await seedTestOrderAndSubmission();

      await rejectPaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Audit determinism test',
      });

      // Retry rejection
      const retryResult = await rejectPaymentSubmissionInTransaction({
        submissionId: testSubmissionId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Duplicate rejection attempt',
      });

      assert.strictEqual(retryResult.idempotent, true);

      const auditDocs = await getAuditLogsCollection().get();
      const rejAudits = auditDocs.docs.filter((d) => d.id === `audit_rej_${testSubmissionId}`);
      assert.strictEqual(rejAudits.length, 1);
    });
  });

  // ==========================================================================
  // Section 3: Subscription Suspension, Revocation & Reinstatement Semantics
  // ==========================================================================
  describe('3. Subscription Suspension, Revocation & Reinstatement Semantics', () => {
    it('suspension immediately halts Premium access while strictly PRESERVING currentPeriodEnd', async () => {
      // 1. Grant 30 days
      const initialSub = await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        days: 30,
        reason: 'Paid subscriber setup',
      });

      const initialPeriodEnd = initialSub.currentPeriodEnd;
      assert.ok(new Date(initialPeriodEnd).getTime() > Date.now());

      // 2. Suspend subscription
      const suspendedSub = await adminSuspendSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Fraud investigation',
      });

      assert.strictEqual(suspendedSub.status, 'halted');
      assert.strictEqual(suspendedSub.cancelAtPeriodEnd, false);
      // Invariant: currentPeriodEnd must NOT be overwritten with nowIso
      assert.strictEqual(suspendedSub.currentPeriodEnd, initialPeriodEnd);

      // 3. Authoritative entitlement service evaluation: MUST BE EXPIRED / NO PREMIUM
      const entitlement = evaluateSubscriptionEntitlement(testUserId, suspendedSub);
      assert.strictEqual(entitlement.isPremium, false);
      assert.strictEqual(entitlement.status, 'expired');
    });

    it('reinstatement restores active access preserving currentPeriodEnd without free +30 days', async () => {
      // 1. Grant 30 days
      const initialSub = await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        days: 30,
        reason: 'Initial valid grant',
      });
      const initialPeriodEnd = initialSub.currentPeriodEnd;

      // 2. Suspend
      await adminSuspendSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Temporary suspension',
      });

      // 3. Reinstate without extendDays
      const reinstated = await adminReinstateSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Investigation cleared customer',
      });

      assert.strictEqual(reinstated.status, 'active');
      // Financial Integrity Invariant: Must retain preserved currentPeriodEnd exactly
      assert.strictEqual(reinstated.currentPeriodEnd, initialPeriodEnd);

      // Entitlement is active
      const entitlement = evaluateSubscriptionEntitlement(testUserId, reinstated);
      assert.strictEqual(entitlement.isPremium, true);
      assert.strictEqual(entitlement.status, 'active');
    });

    it('reinstatement can add explicitly authorized extra days when extendDays is provided', async () => {
      const initialSub = await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        days: 30,
        reason: 'Initial grant',
      });
      const initialPeriodEndMs = new Date(initialSub.currentPeriodEnd).getTime();

      await adminSuspendSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Temporary suspension',
      });

      // Reinstate with explicit +7 days compensation
      const reinstated = await adminReinstateSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Compensation for downtime during verification',
        extendDays: 7,
      });

      const newPeriodEndMs = new Date(reinstated.currentPeriodEnd).getTime();
      const expectedEndMs = initialPeriodEndMs + 7 * 24 * 60 * 60 * 1000;
      assert.strictEqual(Math.abs(newPeriodEndMs - expectedEndMs) < 1000, true);
    });

    it('revoking permanently terminates validity and CANNOT be reinstated', async () => {
      // 1. Initial active subscription
      await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        days: 30,
        reason: 'Initial setup',
      });

      // 2. Revoke permanently
      const revoked = await adminRevokeSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        reason: 'Chargeback confirmed, permanent ban',
      });

      assert.strictEqual(revoked.status, 'cancelled');
      assert.strictEqual(revoked.metadata?.revoked, true);

      // Entitlement must be completely expired
      const entitlement = evaluateSubscriptionEntitlement(testUserId, revoked);
      assert.strictEqual(entitlement.isPremium, false);
      assert.strictEqual(entitlement.status, 'expired');

      // 3. Attempting to reinstate a revoked subscription MUST throw an error
      await assert.rejects(
        async () => {
          await adminReinstateSubscriptionInTransaction({
            targetUserId: testUserId,
            adminEmail: designatedAdminEmail,
            adminUserId: 'admin_1',
            reason: 'Attempted reinstatement of revoked user',
          });
        },
        /Cannot reinstate revoked subscription/
      );
    });
  });

  // ==========================================================================
  // Section 4: Unified Subscription Control API Route Enforcements
  // ==========================================================================
  describe('4. Unified Subscription Control API Route Enforcements', () => {
    it('executes revoke action via /api/admin/subscriptions/control', async () => {
      // Seed subscription
      await adminManualGrantSubscriptionInTransaction({
        targetUserId: testUserId,
        adminEmail: designatedAdminEmail,
        adminUserId: 'admin_1',
        days: 30,
        reason: 'Seed subscription',
      });

      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_rev_check',
        email: designatedAdminEmail,
        name: 'Admin User',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/subscriptions/control', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke',
          targetUserId: testUserId,
          reason: 'Permanent administrative cancellation',
        }),
      });

      const res = await controlRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.subscription.status, 'cancelled');
      assert.strictEqual(data.subscription.metadata?.revoked, true);
    });

    it('rejects subscription control requests without mandatory reason', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_no_reason',
        email: designatedAdminEmail,
        name: 'Admin User',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/subscriptions/control', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend',
          targetUserId: testUserId,
          reason: '   ', // whitespace only
        }),
      });

      const res = await controlRoute(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /mandatory administrative reason/i);
    });

    it('rejects approval via API if confirmation checkbox is not checked', async () => {
      await seedTestOrderAndSubmission();

      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_app_check',
        email: designatedAdminEmail,
        name: 'Admin User',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/billing/submissions/approve', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          confirmationChecked: false,
        }),
      });

      const res = await approveRoute(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /independent verification confirmation/i);
    });

    it('rejects rejection via API if reason is empty', async () => {
      await seedTestOrderAndSubmission();

      const adminUser = findOrCreateGoogleUser({
        sub: 'google_adm_rej_check',
        email: designatedAdminEmail,
        name: 'Admin User',
        email_verified: true,
      });
      const { sessionId } = createSession(adminUser.id);

      const req = new NextRequest('http://localhost:3000/api/admin/billing/submissions/reject', {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: testSubmissionId,
          reason: '',
        }),
      });

      const res = await rejectRoute(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /mandatory rejection reason/i);
    });
  });
});
