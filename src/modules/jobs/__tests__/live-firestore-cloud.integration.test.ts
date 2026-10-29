import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getFirestoreDb, isFirestoreConfigured } from '../../storage/firestore/client';

// If credentials are not in process.env, load from .env.local
if (!process.env.FIREBASE_PRIVATE_KEY) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          try {
            val = JSON.parse(val);
          } catch {
            val = val.slice(1, -1);
          }
        }
        process.env[key] = val;
      }
    }
  }
}

const isLiveConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

describe('JobNexus Phase 2A.4 — Live Google Cloud Firestore Integration Tests (Layer B)', { skip: !isLiveConfigured }, () => {
  it('authenticates to real Google Cloud Firestore using provisioned service account', () => {
    assert.strictEqual(
      isFirestoreConfigured(),
      true,
      'Firestore must be configured via environment variables'
    );
    assert.strictEqual(
      process.env.FIREBASE_PROJECT_ID,
      'jobnexus-98b60',
      'Target project must be jobnexus-98b60'
    );
  });

  it('performs non-destructive read-only check on test collection', async () => {
    const db = getFirestoreDb();
    const testCol = db.collection('_jobnexus_integration_tests');
    const snapshot = await testCol.limit(5).get();
    assert.ok(snapshot.docs !== undefined, 'Query snapshot must return docs array');
  });

  it('performs full CRUD and transaction cycle in isolated test collection and cleans up', async () => {
    const db = getFirestoreDb();
    const testId = `live_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const testDocRef = db.collection('_jobnexus_integration_tests').doc(testId);

    try {
      // 1. Write synthetic test document
      const writePayload = {
        testId,
        purpose: 'cloud_firestore_end_to_end_verification',
        environment: 'integration_test_live',
        createdAt: new Date().toISOString(),
        counter: 1,
        status: 'initialized',
      };
      await testDocRef.set(writePayload);

      // 2. Read it back and verify fields
      const snap1 = await testDocRef.get();
      assert.strictEqual(snap1.exists, true, 'Test document must exist in Firestore');
      const data1 = snap1.data();
      assert.strictEqual(data1?.testId, testId);
      assert.strictEqual(data1?.status, 'initialized');
      assert.strictEqual(data1?.counter, 1);

      // 3. Update document
      await testDocRef.update({
        status: 'updated',
        updatedAt: new Date().toISOString(),
      });

      // 4. Verify updated values
      const snap2 = await testDocRef.get();
      assert.strictEqual(snap2.data()?.status, 'updated');

      // 5. Test real Firestore ACID transaction
      await db.runTransaction(async (transaction) => {
        const txDoc = await transaction.get(testDocRef);
        if (!txDoc.exists) {
          throw new Error('Test document disappeared during transaction');
        }
        const currentCounter = txDoc.data()?.counter || 0;
        transaction.update(testDocRef, {
          counter: currentCounter + 1,
          transactionCommittedAt: new Date().toISOString(),
        });
      });

      // 6. Verify transaction result
      const snap3 = await testDocRef.get();
      assert.strictEqual(snap3.data()?.counter, 2);

    } finally {
      // 7. Clean up: Delete only the test document created in this run
      await testDocRef.delete();

      // 8. Verify deletion
      const snapFinal = await testDocRef.get();
      assert.strictEqual(snapFinal.exists, false, 'Test document must be deleted after verification');
    }
  });

  it('verifies production collections remain strictly untouched and unpolluted', async () => {
    const db = getFirestoreDb();

    // Verify billing_subscriptions collection
    const subCol = db.collection('billing_subscriptions');
    const subSnap = await subCol.limit(10).get();

    // Verify upi_utr_reservations collection
    const utrCol = db.collection('upi_utr_reservations');
    const utrSnap = await utrCol.limit(10).get();

    // Verify upi_orders collection
    const ordersCol = db.collection('upi_orders');
    const ordersSnap = await ordersCol.limit(10).get();

    // No synthetic integration test documents must exist in any production collection
    for (const doc of subSnap.docs) {
      assert.ok(!doc.id.startsWith('live_test_'), 'No test documents in billing_subscriptions');
    }
    for (const doc of utrSnap.docs) {
      assert.ok(!doc.id.startsWith('live_test_'), 'No test documents in upi_utr_reservations');
    }
    for (const doc of ordersSnap.docs) {
      assert.ok(!doc.id.startsWith('live_test_'), 'No test documents in upi_orders');
    }
  });
});
