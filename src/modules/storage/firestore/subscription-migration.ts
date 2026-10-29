import { DurableStore } from '@/modules/storage/durable.store';
import { isFirestoreConfigured } from './client';
import {
  getFirestoreSubscriptionByUserId,
  saveFirestoreSubscription,
} from './subscription.store';
import type { SubscriptionRecord } from '@/modules/billing/domain/subscription.types';

export interface MigrationResult {
  totalScanned: number;
  migrated: number;
  skippedExistingNewer: number;
  skippedIdentical: number;
  errors: Array<{ userId: string; error: string }>;
  dryRun: boolean;
  timestamp: string;
}

/**
 * JobNexus Subscription Migration Utility
 *
 * Safely copies historical subscription records from local DurableStore
 * into Cloud Firestore.
 *
 * Invariants:
 * 1. Safe by default: runs in dryRun mode unless explicitly set to false.
 * 2. Never overwrites a newer or identical Firestore record with an older local record.
 * 3. Never deletes local or remote billing records.
 * 4. Fails closed if Firestore is unconfigured.
 */
export async function migrateLocalSubscriptionsToFirestore(options: {
  dryRun?: boolean;
  localStorePath?: string;
} = {}): Promise<MigrationResult> {
  const dryRun = options.dryRun ?? true;

  if (!isFirestoreConfigured()) {
    throw new Error(
      '[Subscription Migration] Firestore is not configured. Cannot perform migration.'
    );
  }

  const localStore = new DurableStore<SubscriptionRecord>('billing_subscriptions');
  const localRecords = localStore.values();

  const result: MigrationResult = {
    totalScanned: localRecords.length,
    migrated: 0,
    skippedExistingNewer: 0,
    skippedIdentical: 0,
    errors: [],
    dryRun,
    timestamp: new Date().toISOString(),
  };

  for (const localSub of localRecords) {
    if (!localSub.userId) {
      continue;
    }

    try {
      const remoteSub = await getFirestoreSubscriptionByUserId(localSub.userId);

      if (remoteSub) {
        const remoteUpdated = new Date(remoteSub.updatedAt || 0).getTime();
        const localUpdated = new Date(localSub.updatedAt || 0).getTime();

        // If remote is already newer or equal, do not overwrite
        if (remoteUpdated >= localUpdated) {
          result.skippedExistingNewer++;
          continue;
        }
      }

      if (!dryRun) {
        await saveFirestoreSubscription(localSub, { lastUpdatedFrom: 'migration' });
      }

      result.migrated++;
    } catch (err) {
      result.errors.push({
        userId: localSub.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

