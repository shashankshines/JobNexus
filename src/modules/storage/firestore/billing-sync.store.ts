/**
 * JobNexus Cross-Instance Synchronization Engine (Phase 2B.5.1)
 *
 * Provides ultra-lightweight, zero-cost cross-instance synchronization using a single
 * authoritative metadata document (`system_metadata/billing_sync`) in Cloud Firestore.
 *
 * In a multi-instance production environment (e.g. serverless functions, container pods):
 * 1. Whenever any instance commits a mutation (payment approval/rejection, grant, extension,
 *    suspension, revocation, or new submission), it atomically increments `billing_sync.version`.
 * 2. Any other instance inspecting cached snapshots verifies its local snapshot version against
 *    `billing_sync.version`.
 * 3. If a version mismatch is detected, the local instance immediately purges its in-memory
 *    caches and loads fresh authoritative data from Firestore.
 *
 * This provides immediate cross-instance data consistency with zero Redis, zero message queues,
 * and zero paid third-party infrastructure.
 */

import { getFirestoreDb } from './client';
import { getSystemMetadataCollection } from './collections';

export interface BillingSyncMetadata {
  version: number;
  lastMutationAt: string;
  mutationType?: string;
  targetUserId?: string;
  targetEntityId?: string;
}

const SYNC_DOC_ID = 'billing_sync';

/**
 * Retrieves the authoritative billing sync metadata from Cloud Firestore.
 */
export async function getBillingSyncMetadata(): Promise<BillingSyncMetadata> {
  try {
    const col = getSystemMetadataCollection();
    const docSnap = await col.doc(SYNC_DOC_ID).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        version: typeof data?.version === 'number' ? data.version : 1,
        lastMutationAt: data?.lastMutationAt || new Date(0).toISOString(),
        mutationType: data?.mutationType,
        targetUserId: data?.targetUserId,
        targetEntityId: data?.targetEntityId,
      };
    }
  } catch (err) {
    console.warn('[BillingSync] Failed to read billing sync metadata:', err);
  }

  return {
    version: 1,
    lastMutationAt: new Date(0).toISOString(),
  };
}

/**
 * Fast accessor returning the authoritative version counter.
 */
export async function getBillingSyncVersion(): Promise<number> {
  const meta = await getBillingSyncMetadata();
  return meta.version;
}

/**
 * Atomically increments the billing sync version counter in Cloud Firestore.
 * MUST be invoked on any administrative mutation, payment submission, or status transition.
 */
export async function bumpBillingSyncVersion(meta?: {
  mutationType?: string;
  targetUserId?: string;
  targetEntityId?: string;
}): Promise<number> {
  const db = getFirestoreDb();
  const col = getSystemMetadataCollection();
  const syncRef = col.doc(SYNC_DOC_ID);
  const nowIso = new Date().toISOString();

  try {
    const nextVersion = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(syncRef);
      const currentVersion = snap.exists && typeof snap.data()?.version === 'number'
        ? (snap.data()!.version as number)
        : 1;
      const next = currentVersion + 1;

      const payload: BillingSyncMetadata = {
        version: next,
        lastMutationAt: nowIso,
        ...(meta?.mutationType ? { mutationType: meta.mutationType } : {}),
        ...(meta?.targetUserId ? { targetUserId: meta.targetUserId } : {}),
        ...(meta?.targetEntityId ? { targetEntityId: meta.targetEntityId } : {}),
      };

      transaction.set(syncRef, payload, { merge: true });
      return next;
    });

    return nextVersion;
  } catch (err) {
    console.error('[BillingSync] Failed to atomically bump sync version:', err);
    // Fallback best-effort direct write
    const fallbackVersion = Date.now();
    await syncRef.set(
      {
        version: fallbackVersion,
        lastMutationAt: nowIso,
        ...meta,
      },
      { merge: true }
    );
    return fallbackVersion;
  }
}

