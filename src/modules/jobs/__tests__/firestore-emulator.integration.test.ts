import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { getFirestoreDb, resetFirestoreRegistry } from '../../storage/firestore/client';
import {
  reserveUtrInTransaction,
  consumeUtrInTransaction,
  UtrCollisionError,
} from '../../storage/firestore/utr-reservation';
import {
  saveFirestoreSubscription,
  getFirestoreSubscriptionByUserId,
} from '../../storage/firestore/subscription.store';
import {
  getAuthoritativeUserEntitlement,
} from '../../billing/services/entitlement.service';
import { PREMIUM_PLAN } from '../../billing/domain/subscription.types';

const isEmulatorActive = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe('JobNexus Phase 2A.4 — Firestore Emulator Integration Suite (Layer A)', { skip: !isEmulatorActive }, () => {
  before(() => {
    if (!process.env.FIREBASE_PROJECT_ID) {
      process.env.FIREBASE_PROJECT_ID = 'jobnexus-98b60';
    }
    resetFirestoreRegistry();
  });

  after(() => {
    resetFirestoreRegistry();
  });

  it('connects to real running Firestore Emulator and verifies emulator host', () => {
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST must be set');
    const db = getFirestoreDb();
    assert.ok(db, 'Firestore instance must be initialized');
  });

  it('performs live document writes, reads, and deletes against Firestore Emulator', async () => {
    const db = getFirestoreDb();
    const docRef = db.collection('_emulator_tests').doc('doc_1');

    await docRef.set({ testKey: 'hello_emulator', timestamp: new Date().toISOString() });
    const snap = await docRef.get();
    assert.strictEqual(snap.exists, true);
    assert.strictEqual(snap.data()?.testKey, 'hello_emulator');

    await docRef.update({ testKey: 'updated_emulator' });
    const snap2 = await docRef.get();
    assert.strictEqual(snap2.data()?.testKey, 'updated_emulator');

    await docRef.delete();
    const snap3 = await docRef.get();
    assert.strictEqual(snap3.exists, false);
  });

  it('executes real ACID transaction and atomic locking for UTR reservation on emulator', async () => {
    const db = getFirestoreDb();
    const utr = '987654321098';

    // 1. Reserve in real transaction
    await db.runTransaction(async (tx) => {
      await reserveUtrInTransaction(tx, {
        utr,
        orderId: 'ord_emu_1',
        submissionId: 'sub_emu_1',
        userId: 'usr_emu_1',
      });
    });

    // 2. Verify collision detection on conflicting user in real transaction
    await assert.rejects(
      async () => {
        await db.runTransaction(async (tx) => {
          await reserveUtrInTransaction(tx, {
            utr,
            orderId: 'ord_emu_2',
            submissionId: 'sub_emu_2',
            userId: 'usr_emu_2',
          });
        });
      },
      UtrCollisionError
    );

    // 3. Consume in real transaction on admin approval
    await db.runTransaction(async (tx) => {
      await consumeUtrInTransaction(tx, {
        utr,
        orderId: 'ord_emu_1',
        submissionId: 'sub_emu_1',
      });
    });

    // 4. Clean up emulator reservation document
    await db.collection('upi_utr_reservations').doc(utr).delete();
  });

  it('persists subscription and evaluates authoritative entitlement against emulator', async () => {
    const userId = 'usr_emu_premium_1';
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 86400 * 1000);

    await saveFirestoreSubscription({
      id: 'sub_emu_1',
      userId,
      planId: PREMIUM_PLAN.id,
      status: 'active',
      provider: 'manual',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: future.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // Retrieve via authoritative repository
    const stored = await getFirestoreSubscriptionByUserId(userId);
    assert.ok(stored);
    assert.strictEqual(stored.userId, userId);
    assert.strictEqual(stored.status, 'active');

    // Authoritative entitlement evaluation
    const ent = await getAuthoritativeUserEntitlement(userId);
    assert.strictEqual(ent.isPremium, true);
    assert.strictEqual(ent.tier, 'premium');
    assert.strictEqual(ent.status, 'active');

    // Clean up
    const db = getFirestoreDb();
    await db.collection('billing_subscriptions').doc(userId).delete();
  });
});
