import { Transaction } from 'firebase-admin/firestore';
import { getSubscriptionsCollection, SubscriptionDocument } from './collections';
import { getFirestoreDb } from './client';
import type {
  SubscriptionRecord,
  BillingEventRecord,
} from '@/modules/billing/domain/subscription.types';

/**
 * Firestore-Backed Subscription Store
 * Provides authoritative persistence for JobNexus subscriptions.
 * Document ID is the userId for atomic 1:1 user mapping.
 */

export async function getFirestoreSubscriptionByUserId(
  userId: string
): Promise<SubscriptionRecord | null> {
  if (!userId) return null;
  const col = getSubscriptionsCollection();
  const docRef = col.doc(userId);
  const snap = await docRef.get();

  if (!snap.exists) {
    return null;
  }

  return snap.data() || null;
}

/**
 * Retrieves a subscription record by providerSubscriptionId or internal subscription id.
 */
export async function getFirestoreSubscriptionById(
  idOrProviderId: string
): Promise<SubscriptionRecord | null> {
  if (!idOrProviderId) return null;
  const col = getSubscriptionsCollection();

  // First query by providerSubscriptionId
  const providerSnap = await col
    .where('providerSubscriptionId', '==', idOrProviderId)
    .limit(1)
    .get();
  if (!providerSnap.empty) {
    return providerSnap.docs[0].data();
  }

  // Second query by internal subscription id
  const idSnap = await col.where('id', '==', idOrProviderId).limit(1).get();
  if (!idSnap.empty) {
    return idSnap.docs[0].data();
  }

  return null;
}

/**
 * Deletes a subscription document from Firestore by userId.
 * Used exclusively for test isolation and cleanup.
 */
export async function deleteFirestoreSubscription(userId: string): Promise<void> {
  if (!userId) return;
  const col = getSubscriptionsCollection();
  await col.doc(userId).delete();
}

export async function saveFirestoreSubscription(
  sub: SubscriptionRecord,
  meta?: { lastUpdatedFrom?: SubscriptionDocument['lastUpdatedFrom'] }
): Promise<SubscriptionRecord> {
  if (!sub.userId) {
    throw new Error('SubscriptionRecord must include a valid userId.');
  }

  const col = getSubscriptionsCollection();
  const docRef = col.doc(sub.userId);
  const updated: SubscriptionDocument = {
    ...sub,
    updatedAt: new Date().toISOString(),
    lastUpdatedFrom: meta?.lastUpdatedFrom || 'admin_manual',
  };

  await docRef.set(updated, { merge: true });
  return updated;
}

export function saveFirestoreSubscriptionInTransaction(
  transaction: Transaction,
  sub: SubscriptionRecord,
  meta?: { lastUpdatedFrom?: SubscriptionDocument['lastUpdatedFrom'] }
): SubscriptionRecord {
  if (!sub.userId) {
    throw new Error('SubscriptionRecord must include a valid userId.');
  }

  const col = getSubscriptionsCollection();
  const docRef = col.doc(sub.userId);
  const updated: SubscriptionDocument = {
    ...sub,
    updatedAt: new Date().toISOString(),
    lastUpdatedFrom: meta?.lastUpdatedFrom || 'admin_manual',
  };

  transaction.set(docRef, updated, { merge: true });
  return updated;
}

/**
 * Atomically records an incoming webhook billing event in Cloud Firestore.
 * Returns false if the event was already recorded and processed (idempotency guard).
 */
export async function recordFirestoreBillingEvent(event: BillingEventRecord): Promise<boolean> {
  const db = getFirestoreDb();
  const docRef = db.collection('billing_events').doc(event.id);
  const snap = await docRef.get();

  if (snap.exists) {
    return false; // Already processed
  }

  await docRef.set({
    ...event,
    recordedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Checks if a provider event has already been recorded in Cloud Firestore.
 */
export async function isFirestoreEventProcessed(eventId: string): Promise<boolean> {
  const db = getFirestoreDb();
  const docRef = db.collection('billing_events').doc(eventId);
  const snap = await docRef.get();
  return snap.exists;
}

