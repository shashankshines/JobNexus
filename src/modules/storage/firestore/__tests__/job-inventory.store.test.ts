import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  JOB_INVENTORY_DOC_ID,
  MAX_INVENTORY_SNAPSHOT_AGE_MS,
  getFreshPersistedProviderCount,
  JobInventorySnapshot,
} from '../job-inventory.store';

describe('JobInventoryStore Unit Tests', () => {
  it('exposes expected document ID and max snapshot age', () => {
    assert.strictEqual(JOB_INVENTORY_DOC_ID, 'job_inventory_snapshot');
    assert.strictEqual(MAX_INVENTORY_SNAPSHOT_AGE_MS, 24 * 60 * 60 * 1000);
  });

  it('returns count when entry is fresh and non-zero', () => {
    const now = Date.now();
    const snapshot: JobInventorySnapshot = {
      providers: {
        greenhouse: {
          providerName: 'Greenhouse ATS',
          count: 3149,
          fetchedAt: new Date(now - 1000).toISOString(),
        },
      },
      updatedAt: new Date(now - 1000).toISOString(),
    };

    const count = getFreshPersistedProviderCount(snapshot, 'greenhouse', now);
    assert.strictEqual(count, 3149);
  });

  it('returns null when provider is missing from snapshot', () => {
    const snapshot: JobInventorySnapshot = {
      providers: {},
      updatedAt: new Date().toISOString(),
    };
    assert.strictEqual(getFreshPersistedProviderCount(snapshot, 'lever'), null);
  });

  it('returns null when provider entry is older than MAX_INVENTORY_SNAPSHOT_AGE_MS', () => {
    const now = Date.now();
    const staleTime = now - (MAX_INVENTORY_SNAPSHOT_AGE_MS + 60_000);
    const snapshot: JobInventorySnapshot = {
      providers: {
        ashby: {
          providerName: 'Ashby ATS',
          count: 1276,
          fetchedAt: new Date(staleTime).toISOString(),
        },
      },
      updatedAt: new Date(staleTime).toISOString(),
    };

    const count = getFreshPersistedProviderCount(snapshot, 'ashby', now);
    assert.strictEqual(count, null);
  });

  it('returns null when snapshot itself is null', () => {
    assert.strictEqual(getFreshPersistedProviderCount(null, 'greenhouse'), null);
  });
});

