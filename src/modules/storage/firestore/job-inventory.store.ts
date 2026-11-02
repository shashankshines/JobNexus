/**
 * JobNexus Cross-Instance Job Inventory Snapshot
 *
 * Persists the last known-good per-provider job counts in a single metadata document
 * (`system_metadata/job_inventory_snapshot`) so that every serverless instance — including
 * cold starts where slow providers time out — can report the true total of jobs available
 * across all API integrations instead of a temporarily reduced partial count.
 *
 * Invariants:
 * - Strictly best-effort: every read/write is time-boxed and never throws to callers.
 * - Only successful (fulfilled) provider fetches are ever persisted.
 * - Entries older than MAX_INVENTORY_SNAPSHOT_AGE_MS are ignored by consumers.
 */

import { isFirestoreConfigured } from './client';
import { getSystemMetadataCollection } from './collections';

export const JOB_INVENTORY_DOC_ID = 'job_inventory_snapshot';
export const MAX_INVENTORY_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const FIRESTORE_OP_TIMEOUT_MS = 800;

export interface ProviderInventoryEntry {
  providerName: string;
  count: number;
  fetchedAt: string; // ISO
}

export interface JobInventorySnapshot {
  providers: Record<string, ProviderInventoryEntry>;
  updatedAt: string; // ISO
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

function isPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test' && isFirestoreConfigured();
}

/**
 * Reads the persisted inventory snapshot. Returns null when unavailable, unconfigured,
 * malformed, or when Firestore does not respond within the time budget.
 */
export async function readJobInventorySnapshot(): Promise<JobInventorySnapshot | null> {
  if (!isPersistenceEnabled()) return null;
  try {
    const snap = await withTimeout(
      getSystemMetadataCollection().doc(JOB_INVENTORY_DOC_ID).get(),
      FIRESTORE_OP_TIMEOUT_MS
    );
    if (!snap || !snap.exists) return null;
    const data = snap.data() as Partial<JobInventorySnapshot> | undefined;
    if (!data || typeof data.providers !== 'object' || data.providers === null) return null;
    return {
      providers: data.providers as Record<string, ProviderInventoryEntry>,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Merges freshly fulfilled provider counts into the persisted snapshot.
 * Providers that failed in this run keep their previous persisted entry untouched.
 */
export async function writeJobInventorySnapshot(
  freshEntries: Record<string, ProviderInventoryEntry>,
  previous: JobInventorySnapshot | null
): Promise<void> {
  if (!isPersistenceEnabled()) return;
  if (Object.keys(freshEntries).length === 0) return;
  try {
    const merged: JobInventorySnapshot = {
      providers: { ...(previous?.providers || {}), ...freshEntries },
      updatedAt: new Date().toISOString(),
    };
    await withTimeout(
      getSystemMetadataCollection().doc(JOB_INVENTORY_DOC_ID).set(merged),
      FIRESTORE_OP_TIMEOUT_MS
    );
  } catch {
    // Best-effort persistence only
  }
}

/**
 * Returns a usable persisted count for a provider, or null if missing or stale.
 */
export function getFreshPersistedProviderCount(
  snapshot: JobInventorySnapshot | null,
  providerId: string,
  nowMs: number = Date.now()
): number | null {
  const entry = snapshot?.providers?.[providerId];
  if (!entry || typeof entry.count !== 'number' || entry.count <= 0) return null;
  const fetchedAtMs = new Date(entry.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs) || nowMs - fetchedAtMs > MAX_INVENTORY_SNAPSHOT_AGE_MS) {
    return null;
  }
  return entry.count;
}

