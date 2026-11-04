import { getFirestoreDb } from '@/modules/storage/firestore/client';
import type { Query } from 'firebase-admin/firestore';

export const ADMIN_NOTIFICATION_EMAIL = 'shashankshines@gmail.com';
const COLLECTION = 'admin_notifications';

export type AdminNotificationType =
  | 'premium_order_created'
  | 'payment_submitted'
  | 'subscription_cancel_requested';

export interface AdminNotificationDocument {
  id: string;
  recipientEmail: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
  userId: string;
  userEmail?: string;
  orderId?: string;
  submissionId?: string;
  createdAt: string;
  readAt?: string;
  actionedAt?: string;
}

function safeIdempotencyId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}

/**
 * Durable admin inbox. Deterministic IDs make event retries idempotent.
 * Notifications are addressed only to the explicitly designated admin account.
 */
export async function createAdminNotification(
  input: Omit<AdminNotificationDocument, 'id' | 'recipientEmail' | 'createdAt' | 'readAt' | 'actionedAt'> & {
    eventKey: string;
  }
): Promise<void> {
  const id = safeIdempotencyId(input.eventKey);
  const ref = getFirestoreDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (existing.exists) return;

  const { eventKey, ...data } = input;
  if (!eventKey) throw new Error('Notification event key is required.');
  await ref.set({
    ...data,
    id,
    recipientEmail: ADMIN_NOTIFICATION_EMAIL,
    createdAt: new Date().toISOString(),
  });
}

export async function listAdminNotifications(options: { limit?: number; unreadOnly?: boolean } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  let query: Query = getFirestoreDb()
    .collection(COLLECTION)
    .where('recipientEmail', '==', ADMIN_NOTIFICATION_EMAIL)
    .orderBy('createdAt', 'desc');

  if (options.unreadOnly) query = query.where('readAt', '==', null);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => doc.data() as AdminNotificationDocument);
}

export async function markAdminNotification(
  id: string,
  action: 'read' | 'actioned'
): Promise<boolean> {
  const ref = getFirestoreDb().collection(COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.recipientEmail !== ADMIN_NOTIFICATION_EMAIL) return false;
  const now = new Date().toISOString();
  await ref.update(action === 'actioned' ? { readAt: now, actionedAt: now } : { readAt: now });
  return true;
}
