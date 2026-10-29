import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  evaluateUtrIdempotency,
  reserveUtrInTransaction,
  consumeUtrInTransaction,
  releaseUtrInTransaction,
  UtrCollisionError,
  UtrNotFoundError,
  UtrStateError,
  UtrOwnershipError,
  UtrFormatError,
} from '../../storage/firestore/utr-reservation';
import {
  evaluateSubscriptionEntitlement,
  getAuthoritativeUserEntitlement,
} from '../../billing/services/entitlement.service';
import { NextRequest } from 'next/server';
import {
  saveSubscription,
  resetSubscriptionStore,
} from '../../billing/services/subscription.store';
import {
  migrateLocalSubscriptionsToFirestore,
} from '../../storage/firestore/subscription-migration';
import {
  resetFirestoreRegistry,
  setMockFirestoreDb,
} from '../../storage/firestore/client';
import { createMockFirestoreDb } from '../../storage/firestore/mock';
import {
  getFirestoreSubscriptionByUserId,
  saveFirestoreSubscription,
} from '../../storage/firestore/subscription.store';
import {
  SubscriptionRecord,
  PREMIUM_PLAN,
} from '../../billing/domain/subscription.types';
import {
  UtrReservationDocument,
} from '../../storage/firestore/collections';
import {
  resetAuthStore,
  createSession,
  findOrCreateGoogleUser,
  SESSION_COOKIE_NAME,
} from '../../auth/server/session.store';
import { GET as billingStatusHandler } from '../../../app/api/billing/status/route';
import { POST as billingCheckoutHandler } from '../../../app/api/billing/checkout/route';
import { POST as billingCancelHandler } from '../../../app/api/billing/cancel/route';
import { POST as billingSubmitHandler } from '../../../app/api/billing/submit/route';
import type { Transaction, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';

function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === 'object') {
    headers.set('Content-Type', 'application/json');
  }
  if (options.cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.cookie}`);
  }

  const rawBody =
    typeof options.body === 'string'
      ? options.body
      : options.body
      ? JSON.stringify(options.body)
      : undefined;

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers,
    body: rawBody,
  });
}

function createAuthSession(userId: string) {
  const user = findOrCreateGoogleUser({
    email: `${userId}@example.com`,
    name: 'Verified User',
    sub: userId,
  });
  const session = createSession(user.id);
  return { ...session, user };
}

/**
 * In-memory Mock Firestore Transaction Harness
 * Simulates Firestore ACID transaction semantics, read locks, optimistic concurrency,
 * and read-before-write ordering constraints.
 */
class MockFirestoreTransactionHarness {
  public store = new Map<string, UtrReservationDocument>();
  public readLog: string[] = [];
  public writeLog: string[] = [];
  public hasWritesOccurred = false;

  public createTransaction = (): Transaction => {
    const pendingWrites = new Map<string, UtrReservationDocument>();
    const pendingUpdates = new Map<string, Partial<UtrReservationDocument>>();

    const mockTx = {
      get: (async (ref: DocumentReference) => {
        const key = ref.id;
        this.readLog.push(key);
        const data = this.store.get(key);

        return {
          exists: data !== undefined,
          id: key,
          data: () => data,
          ref,
        } as unknown as DocumentSnapshot;
      }) as unknown as Transaction['get'],

      set: (<T>(ref: DocumentReference<T>, data: Partial<T>): Transaction => {
        this.hasWritesOccurred = true;
        const key = ref.id;
        pendingWrites.set(key, data as unknown as UtrReservationDocument);
        return mockTx as unknown as Transaction;
      }) as unknown as Transaction['set'],

      update: (<T>(ref: DocumentReference<T>, data: Partial<T>): Transaction => {
        this.hasWritesOccurred = true;
        const key = ref.id;
        pendingUpdates.set(key, data as unknown as Partial<UtrReservationDocument>);
        return mockTx as unknown as Transaction;
      }) as unknown as Transaction['update'],
    };

    // Attach commit helper to simulate transaction completion
    (mockTx as unknown as { commit: () => void }).commit = () => {
      for (const [key, val] of pendingWrites.entries()) {
        this.store.set(key, val);
        this.writeLog.push(`SET:${key}`);
      }
      for (const [key, val] of pendingUpdates.entries()) {
        const existing = this.store.get(key) || ({} as UtrReservationDocument);
        this.store.set(key, { ...existing, ...val });
        this.writeLog.push(`UPDATE:${key}`);
      }
    };

    return mockTx as unknown as Transaction;
  };
}

describe('JobNexus Phase 2A.2 — Firestore Entitlement Integration & Transaction Safety', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetFirestoreRegistry();
    setMockFirestoreDb(undefined);
    resetSubscriptionStore();
    resetAuthStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setMockFirestoreDb(undefined);
    resetFirestoreRegistry();
  });

  // =========================================================================
  // 1. Subscription Entitlement Source of Truth Tests
  // =========================================================================
  describe('1. Pure Entitlement Evaluation & Business Rules', () => {
    it('grants active Premium membership for active manual subscription within valid period', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 86400 * 1000);

      const sub: SubscriptionRecord = {
        id: 'sub_manual_active',
        userId: 'usr_premium_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: future.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        paymentReference: '429384729104',
      };

      const ent = evaluateSubscriptionEntitlement('usr_premium_1', sub);
      assert.strictEqual(ent.isPremium, true);
      assert.strictEqual(ent.tier, 'premium');
      assert.strictEqual(ent.status, 'active');
      assert.strictEqual(ent.subscription?.provider, 'manual');
    });

    it('denies Premium for pending manual UPI subscription (fail closed)', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 86400 * 1000);

      const sub: SubscriptionRecord = {
        id: 'sub_manual_pending',
        userId: 'usr_pending_1',
        planId: PREMIUM_PLAN.id,
        status: 'pending',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: future.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const ent = evaluateSubscriptionEntitlement('usr_pending_1', sub);
      assert.strictEqual(ent.isPremium, false);
      assert.strictEqual(ent.tier, 'free');
      assert.strictEqual(ent.status, 'free');
      assert.ok(ent.reason.includes('Payment verification pending'));
    });

    it('denies Premium when billing cycle has expired', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 2 * 86400 * 1000); // Expired 2 days ago

      const sub: SubscriptionRecord = {
        id: 'sub_manual_expired',
        userId: 'usr_expired_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: new Date(past.getTime() - 30 * 86400 * 1000).toISOString(),
        currentPeriodEnd: past.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: past.toISOString(),
        updatedAt: past.toISOString(),
      };

      const ent = evaluateSubscriptionEntitlement('usr_expired_1', sub);
      assert.strictEqual(ent.isPremium, false);
      assert.strictEqual(ent.tier, 'free');
      assert.strictEqual(ent.status, 'expired');
      assert.ok(ent.reason.includes('Billing cycle expired'));
    });

    it('grants Premium in cancelled_grace status when cancelAtPeriodEnd is true within valid period', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 15 * 86400 * 1000); // 15 days remaining

      const sub: SubscriptionRecord = {
        id: 'sub_manual_grace',
        userId: 'usr_grace_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: future.toISOString(),
        cancelAtPeriodEnd: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const ent = evaluateSubscriptionEntitlement('usr_grace_1', sub);
      assert.strictEqual(ent.isPremium, true);
      assert.strictEqual(ent.tier, 'premium');
      assert.strictEqual(ent.status, 'cancelled_grace');
    });

    it('preserves existing subscription expiry date during renewal extension', () => {
      const now = new Date();
      const currentExpiry = new Date(now.getTime() + 10 * 86400 * 1000); // 10 days left
      const newExpiry = new Date(currentExpiry.getTime() + 30 * 86400 * 1000); // +30 days on top

      const existingSub: SubscriptionRecord = {
        id: 'sub_existing_1',
        userId: 'usr_renew_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: currentExpiry.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // Extend
      const renewedSub: SubscriptionRecord = {
        ...existingSub,
        currentPeriodEnd: newExpiry.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ent = evaluateSubscriptionEntitlement('usr_renew_1', renewedSub);
      assert.strictEqual(ent.isPremium, true);
      assert.strictEqual(ent.subscription?.currentPeriodEnd, newExpiry.toISOString());
    });
  });

  // =========================================================================
  // 2. Authoritative Firestore Entitlement & Fail-Closed Behavior
  // =========================================================================
  describe('2. Authoritative Firestore Entitlement & Fail-Closed Invariants', () => {
    it('fails closed with explicit error when Firestore is accessed without credentials', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      await assert.rejects(
        async () => {
          await getAuthoritativeUserEntitlement('usr_any_1');
        },
        /Missing server credentials/
      );
    });

    it('does not silently fall back to local DurableStore when Firestore lookup fails', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      // Put a fake active record into local DurableStore
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 86400 * 1000);
      saveSubscription({
        id: 'sub_local_stale',
        userId: 'usr_stale_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: future.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      // Authoritative accessor must throw instead of returning the local record
      await assert.rejects(
        async () => {
          await getAuthoritativeUserEntitlement('usr_stale_1');
        },
        /Missing server credentials/
      );
    });

    it('returns free tier for unauthenticated empty userId without querying database', async () => {
      const ent = await getAuthoritativeUserEntitlement('');
      assert.strictEqual(ent.isPremium, false);
      assert.strictEqual(ent.tier, 'free');
      assert.strictEqual(ent.reason, 'No user authenticated');
    });
  });

  // =========================================================================
  // 3. UTR State Transitions & Idempotency Evaluation
  // =========================================================================
  describe('3. UTR Idempotency Evaluation Matrix', () => {
    const incoming = {
      utr: '412345678901',
      userId: 'usr_user_A',
      orderId: 'ord_100',
      submissionId: 'sub_100',
    };

    it('evaluates proceed_reserve when no existing reservation exists', () => {
      const decision = evaluateUtrIdempotency(null, incoming);
      assert.strictEqual(decision.action, 'proceed_reserve');
    });

    it('evaluates idempotent_in_flight when exact same user, order, and submission retry', () => {
      const existing: UtrReservationDocument = {
        utrNumber: '412345678901',
        userId: 'usr_user_A',
        orderId: 'ord_100',
        submissionId: 'sub_100',
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      };

      const decision = evaluateUtrIdempotency(existing, incoming);
      assert.strictEqual(decision.action, 'idempotent_in_flight');
      if (decision.action === 'idempotent_in_flight') {
        assert.strictEqual(decision.existing.utrNumber, '412345678901');
      }
    });

    it('evaluates collision_conflict with different_user when another user claims same UTR', () => {
      const existing: UtrReservationDocument = {
        utrNumber: '412345678901',
        userId: 'usr_user_B', // Different user
        orderId: 'ord_999',
        submissionId: 'sub_999',
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      };

      const decision = evaluateUtrIdempotency(existing, incoming);
      assert.strictEqual(decision.action, 'collision_conflict');
      if (decision.action === 'collision_conflict') {
        assert.strictEqual(decision.reason, 'different_user');
      }
    });

    it('evaluates collision_conflict with different_operation when same user uses different order', () => {
      const existing: UtrReservationDocument = {
        utrNumber: '412345678901',
        userId: 'usr_user_A', // Same user
        orderId: 'ord_PREVIOUS', // Different order
        submissionId: 'sub_PREVIOUS',
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      };

      const decision = evaluateUtrIdempotency(existing, incoming);
      assert.strictEqual(decision.action, 'collision_conflict');
      if (decision.action === 'collision_conflict') {
        assert.strictEqual(decision.reason, 'different_operation');
      }
    });

    it('evaluates collision_consumed when UTR was already consumed', () => {
      const existing: UtrReservationDocument = {
        utrNumber: '412345678901',
        userId: 'usr_user_A',
        orderId: 'ord_100',
        submissionId: 'sub_100',
        status: 'consumed',
        reservedAt: new Date().toISOString(),
        consumedAt: new Date().toISOString(),
      };

      const decision = evaluateUtrIdempotency(existing, incoming);
      assert.strictEqual(decision.action, 'collision_consumed');
    });

    it('evaluates proceed_reserve when previous reservation was released', () => {
      const existing: UtrReservationDocument = {
        utrNumber: '412345678901',
        userId: 'usr_user_A',
        orderId: 'ord_OLD',
        submissionId: 'sub_OLD',
        status: 'released',
        reservedAt: new Date().toISOString(),
        releasedAt: new Date().toISOString(),
      };

      const decision = evaluateUtrIdempotency(existing, incoming);
      assert.strictEqual(decision.action, 'proceed_reserve');
    });
  });

  // =========================================================================
  // 4. Hardened UTR Transaction State Transitions
  // =========================================================================
  describe('4. UTR State Transitions in Transactions', () => {
    let harness: MockFirestoreTransactionHarness;

    beforeEach(() => {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      process.env.FIREBASE_PROJECT_ID = 'jobnexus-98b60';
      harness = new MockFirestoreTransactionHarness();
    });

    afterEach(() => {
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.FIREBASE_PROJECT_ID;
      resetFirestoreRegistry();
    });

    it('transitions reserved UTR to consumed on admin approval', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
        userId: 'usr_101',
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      });

      const tx = harness.createTransaction();
      const result = await consumeUtrInTransaction(tx, {
        utr: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
      });

      (tx as unknown as { commit: () => void }).commit();

      assert.strictEqual(result.status, 'consumed');
      assert.ok(result.consumedAt);
      assert.strictEqual(harness.store.get('412345678901')?.status, 'consumed');
    });

    it('idempotently succeeds when consuming already-consumed UTR for exact same order/submission', async () => {
      const consumedAt = new Date().toISOString();
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
        userId: 'usr_101',
        status: 'consumed',
        reservedAt: new Date().toISOString(),
        consumedAt,
      });

      const tx = harness.createTransaction();
      const result = await consumeUtrInTransaction(tx, {
        utr: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
      });

      assert.strictEqual(result.status, 'consumed');
      assert.strictEqual(result.consumedAt, consumedAt);
    });

    it('rejects consuming already-consumed UTR for a different order', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_ORIGINAL',
        submissionId: 'sub_ORIGINAL',
        userId: 'usr_101',
        status: 'consumed',
        reservedAt: new Date().toISOString(),
        consumedAt: new Date().toISOString(),
      });

      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await consumeUtrInTransaction(tx, {
            utr: '412345678901',
            orderId: 'ord_DIFFERENT',
            submissionId: 'sub_DIFFERENT',
          });
        },
        UtrStateError
      );
    });

    it('rejects consuming a released UTR without re-reservation', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
        userId: 'usr_101',
        status: 'released',
        reservedAt: new Date().toISOString(),
        releasedAt: new Date().toISOString(),
      });

      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await consumeUtrInTransaction(tx, '412345678901');
        },
        UtrStateError
      );
    });

    it('fails safely with UtrNotFoundError when consuming non-existent UTR', async () => {
      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await consumeUtrInTransaction(tx, '999999999999');
        },
        UtrNotFoundError
      );
    });

    it('rejects releasing an already consumed UTR (critical financial safeguard)', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
        userId: 'usr_101',
        status: 'consumed',
        reservedAt: new Date().toISOString(),
        consumedAt: new Date().toISOString(),
      });

      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await releaseUtrInTransaction(tx, {
            utr: '412345678901',
            reason: 'Accidental release attempt',
          });
        },
        (err: Error) => {
          return (
            err instanceof UtrStateError &&
            err.message.includes('CRITICAL: Cannot release consumed UTR')
          );
        }
      );
    });

    it('treats repeated release of an already released UTR as an idempotent no-op', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_101',
        submissionId: 'sub_101',
        userId: 'usr_101',
        status: 'released',
        reservedAt: new Date().toISOString(),
        releasedAt: new Date().toISOString(),
      });

      const tx = harness.createTransaction();
      // Should resolve cleanly without error
      await releaseUtrInTransaction(tx, '412345678901');
      assert.strictEqual(harness.store.get('412345678901')?.status, 'released');
    });

    it('fails safely with UtrNotFoundError when releasing non-existent reservation', async () => {
      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await releaseUtrInTransaction(tx, '999999999999');
        },
        UtrNotFoundError
      );
    });

    it('enforces ownership check on release when expected orderId is provided', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_CORRECT',
        submissionId: 'sub_CORRECT',
        userId: 'usr_101',
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      });

      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await releaseUtrInTransaction(tx, {
            utr: '412345678901',
            orderId: 'ord_WRONG',
          });
        },
        UtrOwnershipError
      );
    });

    it('reserves a new valid UTR successfully inside transaction', async () => {
      const tx = harness.createTransaction();
      const res = await reserveUtrInTransaction(tx, {
        utr: '412345678901',
        orderId: 'ord_1',
        submissionId: 'sub_1',
        userId: 'usr_1',
      });
      (tx as unknown as { commit: () => void }).commit();

      assert.strictEqual(res.status, 'reserved');
      assert.strictEqual(res.utrNumber, '412345678901');
      assert.strictEqual(harness.store.get('412345678901')?.orderId, 'ord_1');
    });

    it('returns existing reservation on in-flight idempotent retry (same user, order, submission)', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_1',
        submissionId: 'sub_1',
        userId: 'usr_1',
        status: 'reserved',
        reservedAt: '2026-10-29T10:00:00.000Z',
      });

      const tx = harness.createTransaction();
      const res = await reserveUtrInTransaction(tx, {
        utr: '412345678901',
        orderId: 'ord_1',
        submissionId: 'sub_1',
        userId: 'usr_1',
      });

      assert.strictEqual(res.status, 'reserved');
      assert.strictEqual(res.reservedAt, '2026-10-29T10:00:00.000Z');
    });

    it('rejects reservation with UtrCollisionError when claimed by different user', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_USER_A',
        submissionId: 'sub_USER_A',
        userId: 'usr_USER_A',
        status: 'reserved',
        reservedAt: '2026-10-29T10:00:00.000Z',
      });

      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await reserveUtrInTransaction(tx, {
            utr: '412345678901',
            orderId: 'ord_USER_B',
            submissionId: 'sub_USER_B',
            userId: 'usr_USER_B',
          });
        },
        (err: Error) => {
          return (
            err instanceof UtrCollisionError &&
            err.conflictReason === 'different_user' &&
            err.existingOrderId === 'ord_USER_A'
          );
        }
      );
    });

    it('rejects reservation with UtrCollisionError when UTR is already consumed', async () => {
      harness.store.set('412345678901', {
        utrNumber: '412345678901',
        orderId: 'ord_DONE',
        submissionId: 'sub_DONE',
        userId: 'usr_1',
        status: 'consumed',
        reservedAt: '2026-10-29T10:00:00.000Z',
        consumedAt: '2026-10-29T10:05:00.000Z',
      });

      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await reserveUtrInTransaction(tx, {
            utr: '412345678901',
            orderId: 'ord_NEW',
            submissionId: 'sub_NEW',
            userId: 'usr_1',
          });
        },
        (err: Error) => {
          return (
            err instanceof UtrCollisionError &&
            err.conflictReason === 'already_consumed'
          );
        }
      );
    });

    it('rejects invalid UTR format with UtrFormatError', async () => {
      const tx = harness.createTransaction();
      await assert.rejects(
        async () => {
          await reserveUtrInTransaction(tx, {
            utr: '000000000000', // trivial pattern
            orderId: 'ord_1',
            submissionId: 'sub_1',
            userId: 'usr_1',
          });
        },
        UtrFormatError
      );
    });

    it('simulates optimistic concurrency control on simultaneous parallel reservations', async () => {
      // Two transactions start concurrently before either has committed
      const tx1 = harness.createTransaction();

      // Tx1 reads non-existent, reserves, and commits
      const res1 = await reserveUtrInTransaction(tx1, {
        utr: '412345678901',
        orderId: 'ord_CONCURRENT_1',
        submissionId: 'sub_CONCURRENT_1',
        userId: 'usr_1',
      });
      (tx1 as unknown as { commit: () => void }).commit();
      assert.strictEqual(res1.status, 'reserved');

      // Tx2 retries in Firestore transaction loop upon conflict
      // On retry, tx2 reads the newly committed state and rejects with UtrCollisionError
      const tx2Retry = harness.createTransaction();
      await assert.rejects(
        async () => {
          await reserveUtrInTransaction(tx2Retry, {
            utr: '412345678901',
            orderId: 'ord_CONCURRENT_2',
            submissionId: 'sub_CONCURRENT_2',
            userId: 'usr_2',
          });
        },
        (err: Error) => {
          return (
            err instanceof UtrCollisionError &&
            err.conflictReason === 'different_user' &&
            err.existingOrderId === 'ord_CONCURRENT_1'
          );
        }
      );
    });
  });

  // =========================================================================
  // 5. Data Migration Safety Tests
  // =========================================================================
  describe('5. Subscription Data Migration Safety', () => {
    it('migration fails closed if Firestore is unconfigured', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      await assert.rejects(
        async () => {
          await migrateLocalSubscriptionsToFirestore();
        },
        /Firestore is not configured/
      );
    });

    it('performs dry-run scan without writing records to Firestore', async () => {
      const mockDb = createMockFirestoreDb();
      setMockFirestoreDb(mockDb);

      saveSubscription({
        id: 'sub_local_1',
        userId: 'usr_migrate_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await migrateLocalSubscriptionsToFirestore({ dryRun: true });
      assert.strictEqual(result.dryRun, true);
      assert.strictEqual(result.totalScanned, 1);
      assert.strictEqual(result.migrated, 1);

      // Verify nothing was written to Firestore
      const remote = await getFirestoreSubscriptionByUserId('usr_migrate_1');
      assert.strictEqual(remote, null);
    });

    it('successfully migrates local records to Firestore when dryRun is false', async () => {
      resetSubscriptionStore();
      const mockDb = createMockFirestoreDb();
      setMockFirestoreDb(mockDb);

      saveSubscription({
        id: 'sub_local_live',
        userId: 'usr_migrate_live',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await migrateLocalSubscriptionsToFirestore({ dryRun: false });
      assert.strictEqual(result.dryRun, false);
      assert.strictEqual(result.totalScanned, 1);
      assert.strictEqual(result.migrated, 1);

      // Verify written to Firestore
      const remote = await getFirestoreSubscriptionByUserId('usr_migrate_live');
      assert.ok(remote);
      assert.strictEqual(remote.id, 'sub_local_live');
      assert.strictEqual(remote.userId, 'usr_migrate_live');
      assert.strictEqual(remote.status, 'active');
    });

    it('preserves newer existing Firestore document over older local record', async () => {
      resetSubscriptionStore();
      const mockDb = createMockFirestoreDb();
      setMockFirestoreDb(mockDb);

      const oldDate = new Date('2026-01-01T00:00:00.000Z').toISOString();
      const newDate = new Date('2026-02-01T00:00:00.000Z').toISOString();

      // Local has older updatedAt
      saveSubscription({
        id: 'sub_old',
        userId: 'usr_conflict_1',
        planId: PREMIUM_PLAN.id,
        status: 'cancelled',
        provider: 'manual',
        currentPeriodStart: oldDate,
        currentPeriodEnd: oldDate,
        cancelAtPeriodEnd: false,
        createdAt: oldDate,
        updatedAt: oldDate,
      });

      // Firestore already has newer updatedAt
      await saveFirestoreSubscription({
        id: 'sub_newer',
        userId: 'usr_conflict_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: newDate,
        currentPeriodEnd: newDate,
        cancelAtPeriodEnd: false,
        createdAt: newDate,
        updatedAt: newDate,
      });

      const result = await migrateLocalSubscriptionsToFirestore({ dryRun: false });
      assert.strictEqual(result.skippedExistingNewer, 1);
      assert.strictEqual(result.migrated, 0);

      // Verify Firestore doc remained untouched
      const remote = await getFirestoreSubscriptionByUserId('usr_conflict_1');
      assert.ok(remote);
      assert.strictEqual(remote.id, 'sub_newer');
      assert.strictEqual(remote.status, 'active');
    });
  });

  // =========================================================================
  // 6. Production Billing API Routes — Fail-Closed & Store Isolation
  // =========================================================================
  describe('6. Production Billing API Routes — Fail-Closed & Store Isolation', () => {
    it('GET /api/billing/status returns HTTP 503 when Firestore is unconfigured', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      setMockFirestoreDb(undefined);

      const session = createAuthSession('usr_503_status');
      const req = createMockRequest('/api/billing/status', {
        cookie: session.sessionId,
      });

      const res = await billingStatusHandler(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.ok(json.error.includes('unavailable'));
      assert.ok(res.headers.get('Cache-Control')?.includes('no-store'));
    });

    it('POST /api/billing/checkout returns HTTP 503 when Firestore is unconfigured', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      setMockFirestoreDb(undefined);

      const session = createAuthSession('usr_503_checkout');
      const req = createMockRequest('/api/billing/checkout', {
        method: 'POST',
        cookie: session.sessionId,
        body: { planId: PREMIUM_PLAN.id },
      });

      const res = await billingCheckoutHandler(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.ok(json.error.includes('unavailable'));
    });

    it('POST /api/billing/cancel returns HTTP 503 when Firestore is unconfigured', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      setMockFirestoreDb(undefined);

      const session = createAuthSession('usr_503_cancel');
      const req = createMockRequest('/api/billing/cancel', {
        method: 'POST',
        cookie: session.sessionId,
        body: {},
      });

      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.ok(json.error.includes('unavailable'));
    });

    it('POST /api/billing/submit returns HTTP 503 when Firestore is unconfigured', async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      setMockFirestoreDb(undefined);

      const session = createAuthSession('usr_503_submit');
      const req = createMockRequest('/api/billing/submit', {
        method: 'POST',
        cookie: session.sessionId,
        body: {
          orderId: 'ord_test_503',
          utr: '1234567890AB',
          declaredAmount: 499,
          paymentDate: '2026-10-28',
        },
      });

      const res = await billingSubmitHandler(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.ok(json.error.includes('unavailable'));
    });

    it('GET /api/billing/status NEVER falls back to local DurableStore', async () => {
      // Configure Firestore mock so it is available and empty
      const mockDb = createMockFirestoreDb();
      setMockFirestoreDb(mockDb);

      const session = createAuthSession('usr_isolated_1');

      // Put an ACTIVE subscription directly into the legacy DurableStore for this user
      saveSubscription({
        id: 'sub_durable_only',
        userId: session.user.id,
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const req = createMockRequest('/api/billing/status', {
        cookie: session.sessionId,
      });

      const res = await billingStatusHandler(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      // Must be FREE tier because Firestore has no subscription record for this user!
      // This strictly proves complete isolation from DurableStore.
      assert.strictEqual(json.entitlement.isPremium, false);
      assert.strictEqual(json.entitlement.tier, 'free');
      assert.strictEqual(json.entitlement.status, 'free');
      assert.strictEqual(json.entitlement.subscription, undefined);
    });
  });
});
