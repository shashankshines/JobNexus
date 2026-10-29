import {
  UserEntitlement,
  SubscriptionRecord,
} from '../domain/subscription.types';
import { getSubscriptionByUserId } from './subscription.store';
import { getFirestoreSubscriptionByUserId } from '@/modules/storage/firestore/subscription.store';

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

  // 3. Cancelled or Halted subscription: check if still within paid-through cycle
  if (sub.status === 'cancelled' || sub.status === 'halted') {
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
      reason: 'Membership cancelled or halted',
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

/**
 * Authoritative Async Entitlement Accessor.
 * Queries Cloud Firestore as the single production source of truth.
 * Throws explicit error on Firestore operational failures (fail closed).
 */
export async function getAuthoritativeUserEntitlement(userId: string): Promise<UserEntitlement> {
  if (!userId) {
    return evaluateSubscriptionEntitlement('', null);
  }

  const sub = await getFirestoreSubscriptionByUserId(userId);
  return evaluateSubscriptionEntitlement(userId, sub);
}

/**
 * Authoritative async helper returning whether a given user currently has active Premium access.
 */
export async function hasAuthoritativePremiumAccess(userId: string): Promise<boolean> {
  const entitlement = await getAuthoritativeUserEntitlement(userId);
  return entitlement.isPremium;
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
