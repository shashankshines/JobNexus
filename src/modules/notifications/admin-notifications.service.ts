import crypto from 'node:crypto';
import { getFirestoreDb } from '@/modules/storage/firestore/client';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import {
  ADMIN_NOTIFICATION_EMAIL,
  ADMIN_NOTIFICATIONS_COLLECTION,
  ADMIN_NOTIFICATION_FAILURES_COLLECTION,
  AdminNotificationDocument,
  AdminNotificationFailureRecord,
  AdminNotificationPreferences,
  AdminNotificationType,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPriority,
  NotificationStatus,
  parseCompoundCursor,
  serializeCompoundCursor,
} from './notification.types';

export {
  ADMIN_NOTIFICATION_EMAIL,
  ADMIN_NOTIFICATIONS_COLLECTION,
  ADMIN_NOTIFICATION_FAILURES_COLLECTION,
  DEFAULT_NOTIFICATION_PREFERENCES,
};
export type {
  AdminNotificationDocument,
  AdminNotificationFailureRecord,
  AdminNotificationPreferences,
  AdminNotificationType,
  NotificationPriority,
  NotificationStatus,
};

const COLLECTION = ADMIN_NOTIFICATIONS_COLLECTION;
const PREFERENCES_COLLECTION = 'admin_preferences';
const PREFERENCES_DOC_ID = 'notifications';

/**
 * Computes a stable, collision-resistant document ID using SHA-256 of the event key.
 * Validates that eventKey is non-empty.
 */
export function generateNotificationId(eventKey: string): string {
  if (!eventKey || typeof eventKey !== 'string' || !eventKey.trim()) {
    throw new Error('Notification eventKey is required and cannot be empty.');
  }
  const normalized = eventKey.trim();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `notif_${hash.slice(0, 32)}`;
}

/**
 * Determines default priority based on event type if not explicitly supplied.
 */
export function getDefaultPriority(type: AdminNotificationType): NotificationPriority {
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
 * Durable admin inbox. Deterministic SHA-256 document IDs and atomic create-if-absent
 * guarantee that concurrent invocations produce exactly one notification.
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
  if (!input.eventKey || typeof input.eventKey !== 'string' || !input.eventKey.trim()) {
    throw new Error('Notification event key is required.');
  }

  const id = generateNotificationId(input.eventKey);
  const ref = getFirestoreDb().collection(COLLECTION).doc(id);

  const { eventKey, priority, status, ...data } = input;
  const now = new Date().toISOString();
  const doc: AdminNotificationDocument = {
    ...data,
    id,
    eventId: eventKey.trim(),
    eventKey: eventKey.trim(),
    recipientEmail: ADMIN_NOTIFICATION_EMAIL,
    priority: priority || getDefaultPriority(data.type),
    status: status || 'unread',
    createdAt: now,
    readAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  };

  try {
    // Atomic create in Firestore: throws ALREADY_EXISTS / code 6 if document exists
    await ref.create(doc);
    return doc;
  } catch (err: unknown) {
    const isAlreadyExists =
      (err as { code?: number | string })?.code === 6 ||
      (err as { code?: number | string })?.code === 'already-exists' ||
      (err as Error)?.message?.includes('ALREADY_EXISTS');

    if (isAlreadyExists) {
      const existing = await ref.get();
      if (existing.exists) {
        return existing.data() as AdminNotificationDocument;
      }
    }
    throw err;
  }
}

/**
 * Lightweight recovery wrapper for business operations:
 * - Retries transient failures with bounded exponential backoff.
 * - On exhaustion, persists failure record into `admin_notification_failures` for observability.
 * - NEVER rolls back or throws in a way that blocks the caller's business transaction.
 */
export async function createAdminNotificationWithRecovery(
  input: Parameters<typeof createAdminNotification>[0],
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<{ success: boolean; document?: AdminNotificationDocument; error?: string }> {
  const maxRetries = options.maxRetries ?? 3;
  let delay = options.retryDelayMs ?? 40;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const doc = await createAdminNotification(input);
      return { success: true, document: doc };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (attempt === maxRetries) {
        console.warn(`[AdminNotification Recovery] Exhausted ${maxRetries} attempts for event "${input.eventKey}": ${errorMsg}`);
        try {
          const failureId = `fail_${generateNotificationId(input.eventKey).slice(6)}`;
          const failureDoc: AdminNotificationFailureRecord = {
            id: failureId,
            eventKey: input.eventKey,
            input: input as unknown as Record<string, unknown>,
            attempts: maxRetries,
            lastAttemptAt: new Date().toISOString(),
            lastError: errorMsg,
            status: 'pending_recovery',
            createdAt: new Date().toISOString(),
          };
          await getFirestoreDb().collection(ADMIN_NOTIFICATION_FAILURES_COLLECTION).doc(failureId).set(failureDoc);
        } catch (failStoreErr) {
          console.error('[AdminNotification Recovery] Failed to persist dead-letter record:', failStoreErr);
        }
        return { success: false, error: errorMsg };
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  return { success: false, error: 'Retry attempts exhausted.' };
}

/**
 * Reconciles pending failed notifications from the recovery collection.
 */
export async function reconcilePendingNotificationFailures(): Promise<{
  reconciledCount: number;
  exhaustedCount: number;
}> {
  const db = getFirestoreDb();
  const snap = await db
    .collection(ADMIN_NOTIFICATION_FAILURES_COLLECTION)
    .where('status', '==', 'pending_recovery')
    .limit(20)
    .get();

  let reconciledCount = 0;
  let exhaustedCount = 0;

  for (const doc of snap.docs) {
    const failure = doc.data() as AdminNotificationFailureRecord;
    try {
      await createAdminNotification(failure.input as Parameters<typeof createAdminNotification>[0]);
      await doc.ref.update({
        status: 'recovered',
        recoveredAt: new Date().toISOString(),
      });
      reconciledCount++;
    } catch (err: unknown) {
      const newAttempts = failure.attempts + 1;
      const status = newAttempts >= 5 ? 'exhausted' : 'pending_recovery';
      if (status === 'exhausted') exhaustedCount++;
      await doc.ref.update({
        attempts: newAttempts,
        lastAttemptAt: new Date().toISOString(),
        lastError: err instanceof Error ? err.message : String(err),
        status,
      });
    }
  }

  return { reconciledCount, exhaustedCount };
}

export interface ListAdminNotificationOptions {
  limit?: number;
  unreadOnly?: boolean;
  status?: NotificationStatus | 'all';
  priority?: NotificationPriority | 'all';
  cursor?: string; // Compound cursor `${createdAt}__${id}` or legacy timestamp
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
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc');

  if (options.status && options.status !== 'all') {
    query = query.where('status', '==', options.status);
  } else if (options.unreadOnly) {
    query = query.where('status', '==', 'unread');
  }

  if (options.priority && options.priority !== 'all') {
    query = query.where('priority', '==', options.priority);
  }

  if (options.cursor) {
    const compound = parseCompoundCursor(options.cursor);
    if (compound) {
      query = query.startAfter(compound.createdAt, compound.id);
    } else {
      query = query.startAfter(options.cursor);
    }
  }

  const snapshot = await query.limit(limit + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const resultDocs = hasMore ? docs.slice(0, limit) : docs;

  const notifications = resultDocs.map((doc) => {
    const data = doc.data() as DocumentData;
    const status: NotificationStatus =
      data.status || (data.readAt ? (data.actionedAt ? 'resolved' : 'read') : 'unread');
    return {
      ...data,
      id: doc.id,
      eventKey: data.eventKey || data.eventId || doc.id,
      status,
      priority: data.priority || getDefaultPriority(data.type),
    } as AdminNotificationDocument;
  });

  const nextCursor =
    hasMore && resultDocs.length > 0
      ? serializeCompoundCursor(
          resultDocs[resultDocs.length - 1].data().createdAt,
          resultDocs[resultDocs.length - 1].id
        )
      : null;

  // Authoritative server-side unread count
  const totalUnread = await getAdminUnreadNotificationCount(ADMIN_NOTIFICATION_EMAIL);

  return {
    notifications,
    nextCursor,
    totalUnread,
  };
}

export async function getAdminUnreadNotificationCount(
  adminEmail: string = ADMIN_NOTIFICATION_EMAIL
): Promise<number> {
  const db = getFirestoreDb();
  try {
    const query = db
      .collection(COLLECTION)
      .where('recipientEmail', '==', adminEmail)
      .where('status', '==', 'unread');

    if (
      typeof (
        query as unknown as {
          count?: () => { get: () => Promise<{ data: () => { count: number } }> };
        }
      ).count === 'function'
    ) {
      const snap = await (
        query as unknown as {
          count: () => { get: () => Promise<{ data: () => { count: number } }> };
        }
      )
        .count()
        .get();
      return snap.data().count;
    }
    const snap = await query.get();
    return snap.size;
  } catch {
    return 0;
  }
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

export function validateNotificationPreferences(
  input: Partial<AdminNotificationPreferences>
): { valid: boolean; error?: string; validated?: Partial<AdminNotificationPreferences> } {
  const validated: Partial<AdminNotificationPreferences> = {};

  if (input.voiceEnabled !== undefined) {
    if (typeof input.voiceEnabled !== 'boolean') return { valid: false, error: 'voiceEnabled must be a boolean.' };
    validated.voiceEnabled = input.voiceEnabled;
  }
  if (input.soundEnabled !== undefined) {
    if (typeof input.soundEnabled !== 'boolean') return { valid: false, error: 'soundEnabled must be a boolean.' };
    validated.soundEnabled = input.soundEnabled;
  }
  if (input.quietMode !== undefined) {
    if (typeof input.quietMode !== 'boolean') return { valid: false, error: 'quietMode must be a boolean.' };
    validated.quietMode = input.quietMode;
  }
  if (input.priorityOnly !== undefined) {
    if (typeof input.priorityOnly !== 'boolean') return { valid: false, error: 'priorityOnly must be a boolean.' };
    validated.priorityOnly = input.priorityOnly;
  }
  if (input.voiceVerbosity !== undefined) {
    if (input.voiceVerbosity !== 'brief' && input.voiceVerbosity !== 'detailed') {
      return { valid: false, error: 'voiceVerbosity must be either "brief" or "detailed".' };
    }
    validated.voiceVerbosity = input.voiceVerbosity;
  }
  if (input.volume !== undefined) {
    if (typeof input.volume !== 'number' || isNaN(input.volume)) {
      return { valid: false, error: 'volume must be a number.' };
    }
    validated.volume = Math.max(0, Math.min(1, input.volume));
  }

  return { valid: true, validated };
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
  const check = validateNotificationPreferences(prefs);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid notification preferences.');
  }

  const ref = getFirestoreDb().collection(PREFERENCES_COLLECTION).doc(PREFERENCES_DOC_ID);
  const current = await getAdminNotificationPreferences(adminEmail);
  const updated: AdminNotificationPreferences = {
    ...current,
    ...check.validated,
    updatedAt: new Date().toISOString(),
  };

  await ref.set(updated, { merge: true });
  return updated;
}
