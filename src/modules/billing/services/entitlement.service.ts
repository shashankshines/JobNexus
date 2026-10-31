import {
  UserEntitlement,
  SubscriptionRecord,
} from '../domain/subscription.types';
import { getSubscriptionByUserId } from './subscription.store';
import { getFirestoreSubscriptionByUserId } from '@/modules/storage/firestore/subscription.store';
import { getBillingSyncVersion } from '@/modules/storage/firestore/billing-sync.store';

/**
 * Pure entitlement evaluation engine.
 * Evaluates subscription status, validity window, grace periods, and payment state.
 *
 * Invariants:
 * 1. Fails closed to free access on null/undefined, unverified, or expired records.
 * 2. Pending or unverified checkouts/submissions strictly receive free tier.
 * 3. An active subscription with valid currentPeriodEnd receives Premium access.
 * 4. cancelAtPeriodEnd inside valid periodEnd receives Premium with status 'cancelled_grace'.
 * 5. Expired periods lapse to free tier with status 'expired'.
 */
export function evaluateSubscriptionEntitlement(
  userId: string,
  sub: SubscriptionRecord | null | undefined
): UserEntitlement {
  if (!userId) {
    return {
      userId: '',
      isPremium: false,
      tier: 'free',
      status: 'free',
      reason: 'No user authenticated',
    };
  }

  if (!sub) {
    return {
      userId,
      isPremium: false,
      tier: 'free',
      status: 'free',
      reason: 'No active membership record',
    };
  }

  const now = Date.now();
  const periodEndMs = new Date(sub.currentPeriodEnd).getTime();
  const isPeriodValid = !isNaN(periodEndMs) && periodEndMs > now;

  // 1. Pending or unverified checkout states: free access
  if (sub.status === 'created' || sub.status === 'pending' || sub.status === 'authenticated') {
    return {
      userId,
      isPremium: false,
      tier: 'free',
      status: 'free',
      subscription: {
        id: sub.id,
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        provider: sub.provider,
      },
      reason: 'Payment verification pending',
    };
  }

  // 2. Active subscription
  if (sub.status === 'active') {
    if (isPeriodValid) {
      if (sub.cancelAtPeriodEnd) {
        return {
          userId,
          isPremium: true,
          tier: 'premium',
          status: 'cancelled_grace',
          subscription: {
            id: sub.id,
            planId: sub.planId,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: true,
            provider: sub.provider,
          },
          reason: 'Active until scheduled cancellation period end',
        };
      }

      return {
        userId,
        isPremium: true,
        tier: 'premium',
        status: 'active',
        subscription: {
          id: sub.id,
          planId: sub.planId,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          provider: sub.provider,
        },
        reason: 'Active verified JobNexus Premium membership',
      };
    }

    // Period lapsed without confirmed renewal
    return {
      userId,
      isPremium: false,
      tier: 'free',
      status: 'expired',
      subscription: {
        id: sub.id,
        planId: sub.planId,
        status: 'expired',
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        provider: sub.provider,
      },
      reason: 'Billing cycle expired without confirmed renewal',
    };
  }

  // 3. Administrative Suspension ('halted'): NEVER receives grace period, immediately revoked
  if (sub.status === 'halted') {
    return {
      userId,
      isPremium: false,
      tier: 'free',
      status: 'expired',
      subscription: {
        id: sub.id,
        planId: sub.planId,
        status: 'halted',
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        provider: sub.provider,
      },
      reason: 'Subscription suspended by administrator',
    };
  }

  // 3b. Reversible Administrative Termination ('terminated'): NEVER receives grace period, immediately revoked
  // Subscription history preserved; eligible for reinstatement within original period.
  if (sub.status === 'terminated') {
    return {
      userId,
      isPremium: false,
      tier: 'free',
      status: 'expired',
      subscription: {
        id: sub.id,
        planId: sub.planId,
        status: 'terminated',
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        provider: sub.provider,
      },
      reason: 'Subscription terminated by administrator — reinstatement may be available',
    };
  }

  // 4. Cancelled subscription: check if still within paid-through cycle
  if (sub.status === 'cancelled') {
    if (sub.cancelAtPeriodEnd && isPeriodValid) {
      return {
        userId,
        isPremium: true,
        tier: 'premium',
        status: 'cancelled_grace',
        subscription: {
          id: sub.id,
          planId: sub.planId,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: true,
          provider: sub.provider,
        },
        reason: 'Retained Premium access through paid billing period',
      };
    }

    return {
      userId,
      isPremium: false,
      tier: 'free',
      status: 'expired',
      subscription: {
        id: sub.id,
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        provider: sub.provider,
      },
      reason: 'Membership cancelled and period ended',
    };
  }

  // 4. Default: fail safe to free tier
  return {
    userId,
    isPremium: false,
    tier: 'free',
    status: 'free',
    subscription: {
      id: sub.id,
      planId: sub.planId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      provider: sub.provider,
    },
    reason: 'Free tier standard discovery',
  };
}

// In-memory request-scoped TTL cache for authoritative entitlements with cross-instance version sync
interface CachedEntitlementEntry {
  entitlement: UserEntitlement;
  timestamp: number;
  version: number;
}

const ENTITLEMENT_CACHE_TTL_MS = 15 * 1000; // 15 seconds component deduplication window
const entitlementCache = new Map<string, CachedEntitlementEntry>();

/**
 * Instantly invalidates the in-memory entitlement cache for a specific user,
 * or clears all cached entitlements if no userId is provided.
 * MUST be invoked on any administrative mutation or subscription status transition.
 */
export function invalidateUserEntitlementCache(userId?: string): void {
  if (userId) {
    entitlementCache.delete(userId);
  } else {
    entitlementCache.clear();
  }
}

/**
 * Authoritative Async Entitlement Accessor.
 * Queries Cloud Firestore as the single production source of truth.
 * Protects against cross-instance stale reads by validating cached snapshot version
 * against authoritative Firestore `billing_sync` version on every lookup.
 * Throws explicit error on Firestore operational failures (fail closed).
 */
export async function getAuthoritativeUserEntitlement(
  userId: string,
  options?: { bypassCache?: boolean; forceCache?: boolean }
): Promise<UserEntitlement> {
  if (!userId) {
    return evaluateSubscriptionEntitlement('', null);
  }

  const now = Date.now();
  const isTestEnv = process.env.NODE_ENV === 'test' && !options?.forceCache;
  const currentVersion = await getBillingSyncVersion();

  if (!isTestEnv && !options?.bypassCache) {
    const cached = entitlementCache.get(userId);
    if (
      cached &&
      cached.version === currentVersion &&
      now - cached.timestamp < ENTITLEMENT_CACHE_TTL_MS
    ) {
      return cached.entitlement;
    }
  }

  const sub = await getFirestoreSubscriptionByUserId(userId);
  const entitlement = evaluateSubscriptionEntitlement(userId, sub);
  entitlementCache.set(userId, { entitlement, timestamp: now, version: currentVersion });
  return entitlement;
}

/**
 * Authoritative async helper returning whether a given user currently has active Premium access.
 */
export async function hasAuthoritativePremiumAccess(userId: string): Promise<boolean> {
  const entitlement = await getAuthoritativeUserEntitlement(userId);
  return entitlement.isPremium;
}

/**
 * Security-critical entitlement verification for protected operations.
 * Unconditionally bypasses memory cache to query authoritative Firestore state.
 */
export async function verifyProtectedOperationEntitlement(userId: string): Promise<UserEntitlement> {
  return getAuthoritativeUserEntitlement(userId, { bypassCache: true });
}

/**
 * Alias for getAuthoritativeUserEntitlement.
 */
export const getUserEntitlementAsync = getAuthoritativeUserEntitlement;

/**
 * Synchronous legacy accessor reading from DurableStore.
 * Retained for synchronous test fixtures and backward-compatibility.
 * Production routes MUST use getAuthoritativeUserEntitlement.
 */
export function getUserEntitlement(userId: string): UserEntitlement {
  if (!userId) {
    return evaluateSubscriptionEntitlement('', null);
  }
  const sub = getSubscriptionByUserId(userId);
  return evaluateSubscriptionEntitlement(userId, sub);
}

/**
 * Synchronous legacy helper.
 */
export function hasActivePremiumAccess(userId: string): boolean {
  return getUserEntitlement(userId).isPremium;
}
