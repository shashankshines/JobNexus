import {
  UserEntitlement,
  SubscriptionRecord,
} from '../domain/subscription.types';
import { getSubscriptionByUserId } from './subscription.store';

/**
 * Authoritative Single Source of Truth for JobNexus User Entitlement.
 * Evaluates durable subscription state, grace periods, and payment validity.
 * Always fails closed to free access on uncertainty or expired records.
 */
export function getUserEntitlement(userId: string): UserEntitlement {
  if (!userId) {
    return {
      userId: '',
      isPremium: false,
      tier: 'free',
      status: 'free',
      reason: 'No user authenticated',
    };
  }

  const sub: SubscriptionRecord | undefined = getSubscriptionByUserId(userId);
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
 * Convenience helper returning whether a given user currently has active Premium access.
 */
export function hasActivePremiumAccess(userId: string): boolean {
  return getUserEntitlement(userId).isPremium;
}
