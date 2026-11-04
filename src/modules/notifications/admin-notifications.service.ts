import { getFirestoreDb } from '@/modules/storage/firestore/client';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import {
  ADMIN_NOTIFICATION_EMAIL,
  ADMIN_NOTIFICATIONS_COLLECTION,
  AdminNotificationDocument,
  AdminNotificationPreferences,
  AdminNotificationType,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPriority,
  NotificationStatus,
} from './notification.types';

export {
  ADMIN_NOTIFICATION_EMAIL,
  ADMIN_NOTIFICATIONS_COLLECTION,
  DEFAULT_NOTIFICATION_PREFERENCES,
};
export type {
  AdminNotificationDocument,
  AdminNotificationPreferences,
  AdminNotificationType,
  NotificationPriority,
  NotificationStatus,
};

const COLLECTION = ADMIN_NOTIFICATIONS_COLLECTION;
const PREFERENCES_COLLECTION = 'admin_preferences';
const PREFERENCES_DOC_ID = 'notifications';

function safeIdempotencyId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}

/**
 * Determines default priority based on event type if not explicitly supplied.
 */
function getDefaultPriority(type: AdminNotificationType): NotificationPriority {
  switch (type) {
    case 'account_suspended':
    case 'subscription_revoked':
    case 'duplicate_utr_detected':
      return 'critical';
    case 'payment_submitted':
    case 'payment_verification_pending':
    case 'subscription_cancel_requested':
      return 'high';
    case 'premium_order_created':
    case 'payment_approved':
    case 'payment_rejected':
    case 'subscription_expiring':
    case 'subscription_suspended':
    case 'subscription_reinstated':
    case 'subscription_terminated':
    case 'account_reinstated':
      return 'normal';
    default:
      return 'normal';
  }
}

/**
 * Durable admin inbox. Deterministic IDs make event retries idempotent.
 * Notifications are addressed only to the explicitly designated admin account.
 */
export async function createAdminNotification(
  input: Omit<
    AdminNotificationDocument,
    'id' | 'recipientEmail' | 'createdAt' | 'readAt' | 'actionedAt' | 'status' | 'priority'
  > & {
    eventKey: string;
    priority?: NotificationPriority;
    status?: NotificationStatus;
  }
): Promise<AdminNotificationDocument> {
  const id = safeIdempotencyId(input.eventKey);
  const ref = getFirestoreDb().collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    return existing.data() as AdminNotificationDocument;
  }

  const { eventKey, priority, status, ...data } = input;
  if (!eventKey) throw new Error('Notification event key is required.');

  const now = new Date().toISOString();
  const doc: AdminNotificationDocument = {
    ...data,
    id,
    eventId: eventKey,
    recipientEmail: ADMIN_NOTIFICATION_EMAIL,
    priority: priority || getDefaultPriority(data.type),
    status: status || 'unread',
    createdAt: now,
    readAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  };

  await ref.set(doc);
  return doc;
}

export interface ListAdminNotificationOptions {
  limit?: number;
  unreadOnly?: boolean;
  status?: NotificationStatus | 'all';
  priority?: NotificationPriority | 'all';
  cursor?: string; // createdAt ISO timestamp for pagination
}

export async function listAdminNotifications(
  options: ListAdminNotificationOptions = {}
): Promise<{
  notifications: AdminNotificationDocument[];
  nextCursor: string | null;
  totalUnread: number;
}> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const db = getFirestoreDb();

  let query: Query = db
    .collection(COLLECTION)
    .where('recipientEmail', '==', ADMIN_NOTIFICATION_EMAIL)
    .orderBy('createdAt', 'desc');

  if (options.status && options.status !== 'all') {
    query = query.where('status', '==', options.status);
  } else if (options.unreadOnly) {
    query = query.where('status', '==', 'unread');
  }

  if (options.priority && options.priority !== 'all') {
    query = query.where('priority', '==', options.priority);
  }

  if (options.cursor) {
    query = query.startAfter(options.cursor);
  }

  const snapshot = await query.limit(limit + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const resultDocs = hasMore ? docs.slice(0, limit) : docs;

  const notifications = resultDocs.map((doc) => {
    const data = doc.data() as DocumentData;
    // Normalize status for backward compatibility with documents created before status enum
    const status: NotificationStatus = data.status || (data.readAt ? (data.actionedAt ? 'resolved' : 'read') : 'unread');
    return {
      ...data,
      id: doc.id,
      status,
      priority: data.priority || getDefaultPriority(data.type),
    } as AdminNotificationDocument;
  });

  const nextCursor = hasMore && resultDocs.length > 0
    ? resultDocs[resultDocs.length - 1].data().createdAt
    : null;

  // Unread count
  let totalUnread = 0;
  try {
    const unreadSnap = await db
      .collection(COLLECTION)
      .where('recipientEmail', '==', ADMIN_NOTIFICATION_EMAIL)
      .where('status', '==', 'unread')
      .count()
      .get();
    totalUnread = unreadSnap.data().count;
  } catch {
    totalUnread = notifications.filter((n) => n.status === 'unread').length;
  }

  return {
    notifications,
    nextCursor,
    totalUnread,
  };
}

export async function markAdminNotification(
  id: string,
  action: 'read' | 'actioned' | 'acknowledged' | 'resolved',
  adminEmail: string = ADMIN_NOTIFICATION_EMAIL
): Promise<AdminNotificationDocument | null> {
  const ref = getFirestoreDb().collection(COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.recipientEmail !== ADMIN_NOTIFICATION_EMAIL) {
    return null;
  }

  const existing = snapshot.data() as AdminNotificationDocument;
  const now = new Date().toISOString();
  let updates: Partial<AdminNotificationDocument> = {};

  switch (action) {
    case 'read':
      updates = {
        readAt: existing.readAt || now,
        status: existing.status === 'unread' ? 'read' : existing.status,
      };
      break;
    case 'acknowledged':
      updates = {
        readAt: existing.readAt || now,
        acknowledgedAt: now,
        status: 'acknowledged',
      };
      break;
    case 'resolved':
    case 'actioned':
      updates = {
        readAt: existing.readAt || now,
        resolvedAt: now,
        resolvedBy: adminEmail,
        status: 'resolved',
      };
      break;
  }

  await ref.update(updates);
  return { ...existing, ...updates };
}

export async function markAllAdminNotificationsRead(
  adminEmail: string = ADMIN_NOTIFICATION_EMAIL
): Promise<number> {
  const db = getFirestoreDb();
  const unreadSnap = await db
    .collection(COLLECTION)
    .where('recipientEmail', '==', adminEmail)
    .where('status', '==', 'unread')
    .limit(100)
    .get();

  if (unreadSnap.empty) return 0;

  const batch = db.batch();
  const now = new Date().toISOString();
  for (const doc of unreadSnap.docs) {
    batch.update(doc.ref, {
      readAt: now,
      status: 'read',
    });
  }

  await batch.commit();
  return unreadSnap.docs.length;
}

export async function getAdminNotificationPreferences(
  adminEmail: string = ADMIN_NOTIFICATION_EMAIL
): Promise<AdminNotificationPreferences> {
  try {
    const ref = getFirestoreDb().collection(PREFERENCES_COLLECTION).doc(PREFERENCES_DOC_ID);
    const snap = await ref.get();
    if (snap.exists) {
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(snap.data() as Partial<AdminNotificationPreferences>),
      };
    }
  } catch (err) {
    console.error('[Admin Notifications] Preferences fetch failed:', err);
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function updateAdminNotificationPreferences(
  prefs: Partial<AdminNotificationPreferences>,
  adminEmail: string = ADMIN_NOTIFICATION_EMAIL
): Promise<AdminNotificationPreferences> {
  const ref = getFirestoreDb().collection(PREFERENCES_COLLECTION).doc(PREFERENCES_DOC_ID);
  const current = await getAdminNotificationPreferences(adminEmail);
  const updated: AdminNotificationPreferences = {
    ...current,
    ...prefs,
    updatedAt: new Date().toISOString(),
  };

  await ref.set(updated, { merge: true });
  return updated;
}
