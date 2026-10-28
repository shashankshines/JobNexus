import { DurableStore } from '@/modules/storage/durable.store';
import {
  SubscriptionRecord,
  BillingEventRecord,
} from '../domain/subscription.types';

interface GlobalBillingRegistry {
  subscriptions: DurableStore<SubscriptionRecord>;
  subscriptionsByUser: DurableStore<{ id: string; subscriptionId: string }>;
  billingEvents: DurableStore<BillingEventRecord>;
}

const globalForBilling = globalThis as unknown as {
  __jobnexus_billing_registry?: GlobalBillingRegistry;
};

if (!globalForBilling.__jobnexus_billing_registry) {
  globalForBilling.__jobnexus_billing_registry = {
    subscriptions: new DurableStore<SubscriptionRecord>('billing_subscriptions'),
    subscriptionsByUser: new DurableStore<{ id: string; subscriptionId: string }>('billing_subs_by_user'),
    billingEvents: new DurableStore<BillingEventRecord>('billing_events'),
  };
}

const subscriptions = globalForBilling.__jobnexus_billing_registry.subscriptions;
const subscriptionsByUser = globalForBilling.__jobnexus_billing_registry.subscriptionsByUser;
const billingEvents = globalForBilling.__jobnexus_billing_registry.billingEvents;

/**
 * Returns the current subscription record for an authenticated user.
 */
export function getSubscriptionByUserId(userId: string): SubscriptionRecord | undefined {
  if (!userId) return undefined;
  const mapping = subscriptionsByUser.get(userId);
  if (mapping) {
    const sub = subscriptions.get(mapping.subscriptionId);
    if (sub) return sub;
  }
  // Fallback search by userId
  return subscriptions.find((s) => s.userId === userId);
}

/**
 * Returns a subscription record by internal ID or provider subscription ID.
 */
export function getSubscriptionById(idOrProviderId: string): SubscriptionRecord | undefined {
  if (!idOrProviderId) return undefined;
  const direct = subscriptions.get(idOrProviderId);
  if (direct) return direct;
  return subscriptions.find((s) => s.providerSubscriptionId === idOrProviderId || s.id === idOrProviderId);
}

/**
 * Persists or updates a subscription record with atomic user indexing.
 */
export function saveSubscription(sub: SubscriptionRecord): SubscriptionRecord {
  const updated: SubscriptionRecord = {
    ...sub,
    updatedAt: new Date().toISOString(),
  };
  subscriptions.set(updated.id, updated);
  subscriptionsByUser.set(updated.userId, { id: updated.userId, subscriptionId: updated.id });
  return updated;
}

/**
 * Atomically records an incoming webhook event.
 * Returns false if the event was already recorded and processed (idempotency guard).
 */
export function recordBillingEvent(event: BillingEventRecord): boolean {
  if (billingEvents.has(event.id)) {
    return false; // Already processed
  }
  billingEvents.set(event.id, event);
  return true;
}

/**
 * Checks if a provider event has already been recorded.
 */
export function isEventProcessed(eventId: string): boolean {
  return billingEvents.has(eventId);
}

/**
 * Cleanly clears billing stores for isolated test suites.
 */
export function resetSubscriptionStore(): void {
  subscriptions.clear();
  subscriptionsByUser.clear();
  billingEvents.clear();
}

