import crypto from 'node:crypto';
import { NormalizedJob } from '@/modules/jobs/domain/job.types';
import {
  getUserNotificationPreferencesCollection,
  getUserJobAlertsCollection,
  getUserNotificationsCollection,
  getSystemMetadataCollection,
} from '@/modules/storage/firestore/collections';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  SavedJobAlert,
  SmartJobNotification,
  SmartNotificationInboxSummary,
} from '../domain/smart-notification.types';
import {
  isWithinDeliveryWindow,
  calculateNextDeliveryWindow,
  isValidTimezone,
} from './notification-scheduler.service';
import { findMatchingAlertsForJob } from './job-alert-matcher.service';
import { fromCanonicalJob } from '@/modules/jobs/domain/canonical-job.types';
import {
  upsertCanonicalJobs,
  getPendingJobEvents,
  markJobEventProcessed,
} from '@/modules/jobs/services/canonical-job.store';

export const JOB_NOTIFICATION_CURSOR_DOC = 'job_notification_cursor';
export const MAX_SEEN_JOB_IDS_TRACKED = 20000;
export const CLAIM_LEASE_DURATION_MS = 60 * 1000; // 60s lease for atomic claims

export interface JobNotificationCursorDoc {
  seenJobIds: string[];
  lastRunAt: string;
  totalJobsProcessed: number;
}

// Memory fallback cache when Firestore is unavailable/mocked
const memoryPreferences = new Map<string, NotificationPreferences>();
const memoryAlerts = new Map<string, SavedJobAlert>();
const memoryNotifications = new Map<string, SmartJobNotification>();
let memorySeenJobIds = new Set<string>();

/**
 * Resets memory state (useful for hermetic unit tests)
 */
export function resetSmartNotificationMemoryStore(): void {
  memoryPreferences.clear();
  memoryAlerts.clear();
  memoryNotifications.clear();
  memorySeenJobIds.clear();
}

/**
 * Validates external application URLs against malicious schemes
 */
export function isValidJobApplicationUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('//')
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// 1. Notification Preferences & 24x7 Migration
// ============================================================================

/**
 * Idempotently migrates and normalizes user notification preferences to 24x7x365 defaults:
 * - Users with explicit enabled: false remain OFF.
 * - Users without explicit opt-out receive ON by default, 24x7x365 unrestricted delivery.
 * - Legacy default schedule (09:00-21:00, Mon-Sat) is safely migrated to unrestricted [1..7], 00:00-23:59.
 * - Explicit custom user schedules are preserved without overwrite.
 */
export function migrateLegacyPreferences(
  data: Partial<NotificationPreferences> | undefined,
  userId: string
): NotificationPreferences {
  const now = new Date().toISOString();
  if (!data) {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId,
      createdAt: now,
      updatedAt: now,
    };
  }

  // 1. Explicit opt-out check: If user explicitly opted out (enabled === false), preserve OFF
  const enabled = data.enabled === false ? false : true;

  // 2. Schedule migration: If legacy default (Mon-Sat, 09:00-21:00) or missing schedule,
  // upgrade to unrestricted 24x7x365. Custom user schedules are left intact.
  const isLegacyDefaultSchedule =
    !data.activeDays ||
    (Array.isArray(data.activeDays) &&
      data.activeDays.length === 6 &&
      data.activeDays.every((d, i) => d === i + 1) &&
      (data.startTime === '09:00' || !data.startTime) &&
      (data.endTime === '21:00' || !data.endTime));

  const activeDays = isLegacyDefaultSchedule
    ? [1, 2, 3, 4, 5, 6, 7]
    : Array.isArray(data.activeDays) && data.activeDays.length > 0
    ? data.activeDays
    : [1, 2, 3, 4, 5, 6, 7];

  const startTime = isLegacyDefaultSchedule ? '00:00' : data.startTime || '00:00';
  const endTime = isLegacyDefaultSchedule ? '23:59' : data.endTime || '23:59';

  return {
    userId,
    enabled,
    mode: data.mode || 'instant',
    timezone: isValidTimezone(data.timezone || '') ? (data.timezone as string) : 'Asia/Kolkata',
    startTime,
    endTime,
    activeDays,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const docRef = getUserNotificationPreferencesCollection<NotificationPreferences>().doc(userId);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data) {
        return migrateLegacyPreferences(data, userId);
      }
    }
  } catch {
    // Fallback to memory
  }

  const cached = memoryPreferences.get(userId);
  if (cached) return migrateLegacyPreferences(cached, userId);

  const initial = migrateLegacyPreferences(undefined, userId);
  memoryPreferences.set(userId, initial);
  return initial;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const now = new Date().toISOString();

  // Validate timezone if provided
  let timezone = current.timezone;
  if (updates.timezone !== undefined) {
    if (isValidTimezone(updates.timezone)) {
      timezone = updates.timezone;
    }
  }

  // Validate active days
  let activeDays = current.activeDays;
  if (Array.isArray(updates.activeDays)) {
    const filteredDays = updates.activeDays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    if (filteredDays.length > 0) {
      activeDays = Array.from(new Set(filteredDays)).sort();
    }
  }

  const updated: NotificationPreferences = {
    ...current,
    ...updates,
    timezone,
    activeDays,
    userId,
    updatedAt: now,
  };

  try {
    const docRef = getUserNotificationPreferencesCollection<NotificationPreferences>().doc(userId);
    await docRef.set(updated, { merge: true });
  } catch {
    // Non-fatal fallback
  }

  memoryPreferences.set(userId, updated);

  // If master notifications were turned OFF, cancel pending notifications immediately
  if (updates.enabled === false) {
    await cancelPendingNotificationsForUser(userId);
  } else if (
    updates.startTime !== undefined ||
    updates.endTime !== undefined ||
    updates.activeDays !== undefined ||
    updates.timezone !== undefined
  ) {
    // If schedule changed, recalculate pending delivery times
    await recalculatePendingDeliveriesForUser(userId, updated);
  }

  return updated;
}

async function cancelPendingNotificationsForUser(userId: string): Promise<void> {
  try {
    const col = getUserNotificationsCollection<SmartJobNotification>();
    const snap = await col
      .where('userId', '==', userId)
      .where('deliveryStatus', '==', 'PENDING')
      .get();

    for (const doc of snap.docs) {
      await doc.ref.update({
        deliveryStatus: 'CANCELLED',
        failureReason: 'User disabled notifications',
      });
    }
  } catch {
    // Memory fallback
    for (const notif of memoryNotifications.values()) {
      if (notif.userId === userId && notif.deliveryStatus === 'PENDING') {
        notif.deliveryStatus = 'CANCELLED';
        notif.failureReason = 'User disabled notifications';
      }
    }
  }
}

async function recalculatePendingDeliveriesForUser(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  const now = new Date();
  try {
    const col = getUserNotificationsCollection<SmartJobNotification>();
    const snap = await col
      .where('userId', '==', userId)
      .where('deliveryStatus', '==', 'PENDING')
      .get();

    for (const doc of snap.docs) {
      const nextWindow = calculateNextDeliveryWindow(now, preferences);
      await doc.ref.update({
        scheduledAt: nextWindow.toISOString(),
      });
    }
  } catch {
    // Memory fallback
    for (const notif of memoryNotifications.values()) {
      if (notif.userId === userId && notif.deliveryStatus === 'PENDING') {
        const nextWindow = calculateNextDeliveryWindow(now, preferences);
        notif.scheduledAt = nextWindow.toISOString();
      }
    }
  }
}

// ============================================================================
// 2. Saved Job Alerts
// ============================================================================

export async function getAlertsForUser(userId: string): Promise<SavedJobAlert[]> {
  const alerts: SavedJobAlert[] = [];
  try {
    const col = getUserJobAlertsCollection<SavedJobAlert>();
    const snap = await col.where('userId', '==', userId).get();
    for (const doc of snap.docs) {
      alerts.push(doc.data());
    }
  } catch {
    // Memory fallback
  }

  if (alerts.length === 0) {
    for (const alert of memoryAlerts.values()) {
      if (alert.userId === userId) {
        alerts.push(alert);
      }
    }
  }

  return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAlertById(userId: string, alertId: string): Promise<SavedJobAlert | null> {
  try {
    const docRef = getUserJobAlertsCollection<SavedJobAlert>().doc(alertId);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data && data.userId === userId) {
        return data;
      }
    }
  } catch {
    // Memory fallback
  }

  const cached = memoryAlerts.get(alertId);
  if (cached && cached.userId === userId) {
    return cached;
  }
  return null;
}

export async function createAlert(
  userId: string,
  input: Omit<SavedJobAlert, 'alertId' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<SavedJobAlert> {
  const alertId = `alert_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();

  const alert: SavedJobAlert = {
    ...input,
    alertId,
    userId,
    alertName: input.alertName?.trim() || 'Custom Job Alert',
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = getUserJobAlertsCollection<SavedJobAlert>().doc(alertId);
    await docRef.set(alert);
  } catch {
    // Memory fallback
  }

  memoryAlerts.set(alertId, alert);
  return alert;
}

export async function updateAlert(
  userId: string,
  alertId: string,
  updates: Partial<Omit<SavedJobAlert, 'alertId' | 'userId' | 'createdAt'>>
): Promise<SavedJobAlert | null> {
  const existing = await getAlertById(userId, alertId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: SavedJobAlert = {
    ...existing,
    ...updates,
    alertId,
    userId,
    updatedAt: now,
  };

  try {
    const docRef = getUserJobAlertsCollection<SavedJobAlert>().doc(alertId);
    await docRef.set(updated, { merge: true });
  } catch {
    // Memory fallback
  }

  memoryAlerts.set(alertId, updated);
  return updated;
}

export async function deleteAlert(userId: string, alertId: string): Promise<boolean> {
  const existing = await getAlertById(userId, alertId);
  if (!existing) return false;

  try {
    const docRef = getUserJobAlertsCollection<SavedJobAlert>().doc(alertId);
    await docRef.delete();
  } catch {
    // Memory fallback
  }

  memoryAlerts.delete(alertId);
  return true;
}

export async function getAllActiveAlerts(): Promise<SavedJobAlert[]> {
  const alerts: SavedJobAlert[] = [];
  try {
    const col = getUserJobAlertsCollection<SavedJobAlert>();
    const snap = await col.where('enabled', '==', true).get();
    for (const doc of snap.docs) {
      alerts.push(doc.data());
    }
  } catch {
    // Memory fallback
  }

  if (alerts.length === 0) {
    for (const alert of memoryAlerts.values()) {
      if (alert.enabled) {
        alerts.push(alert);
      }
    }
  }

  return alerts;
}

// ============================================================================
// 3. User Notifications Ingestion & Lifecycle
// ============================================================================

export async function getUserNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number; cursor?: string } = {}
): Promise<SmartNotificationInboxSummary> {
  const limitCount = Math.max(1, Math.min(50, options.limit || 20));
  let items: SmartJobNotification[] = [];

  try {
    const col = getUserNotificationsCollection<SmartJobNotification>();
    let query = col
      .where('userId', '==', userId)
      .where('deliveryStatus', '==', 'DELIVERED');

    if (options.unreadOnly) {
      query = query.where('readStatus', '==', 'UNREAD');
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(limitCount + 1).get();
    for (const doc of snap.docs) {
      items.push(doc.data());
    }
  } catch {
    // Memory fallback
  }

  if (items.length === 0) {
    for (const notif of memoryNotifications.values()) {
      if (notif.userId === userId && notif.deliveryStatus === 'DELIVERED') {
        if (!options.unreadOnly || notif.readStatus === 'UNREAD') {
          items.push(notif);
        }
      }
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const hasMore = items.length > limitCount;
  const returnedNotifications = items.slice(0, limitCount);

  // Count total unread
  let unreadCount = 0;
  for (const n of items) {
    if (n.readStatus === 'UNREAD') unreadCount++;
  }

  return {
    notifications: returnedNotifications,
    unreadCount,
    totalCount: items.length,
    hasMore,
  };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  try {
    const docRef = getUserNotificationsCollection<SmartJobNotification>().doc(notificationId);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.userId === userId) {
      await docRef.update({ readStatus: 'READ' });
      return true;
    }
  } catch {
    // Memory fallback
  }

  let notif = memoryNotifications.get(notificationId);
  if (!notif) {
    for (const item of memoryNotifications.values()) {
      if ((item.notificationId === notificationId || item.dedupeKey === notificationId) && item.userId === userId) {
        notif = item;
        break;
      }
    }
  }
  if (notif && notif.userId === userId) {
    notif.readStatus = 'READ';
    return true;
  }
  return false;
}

export async function dismissNotification(userId: string, notificationId: string): Promise<boolean> {
  try {
    const docRef = getUserNotificationsCollection<SmartJobNotification>().doc(notificationId);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.userId === userId) {
      await docRef.update({ readStatus: 'DISMISSED' });
      return true;
    }
  } catch {
    // Memory fallback
  }

  let notif = memoryNotifications.get(notificationId);
  if (!notif) {
    for (const item of memoryNotifications.values()) {
      if ((item.notificationId === notificationId || item.dedupeKey === notificationId) && item.userId === userId) {
        notif = item;
        break;
      }
    }
  }
  if (notif && notif.userId === userId) {
    notif.readStatus = 'DISMISSED';
    return true;
  }
  return false;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  let updatedCount = 0;
  try {
    const col = getUserNotificationsCollection<SmartJobNotification>();
    const snap = await col
      .where('userId', '==', userId)
      .where('readStatus', '==', 'UNREAD')
      .get();

    for (const doc of snap.docs) {
      await doc.ref.update({ readStatus: 'READ' });
      updatedCount++;
    }
  } catch {
    // Memory fallback
  }

  for (const notif of memoryNotifications.values()) {
    if (notif.userId === userId && notif.readStatus === 'UNREAD') {
      notif.readStatus = 'READ';
      updatedCount++;
    }
  }

  return updatedCount;
}

// ============================================================================
// 4. Ingestion & Matching Pipeline
// ============================================================================

export async function readJobNotificationCursor(): Promise<JobNotificationCursorDoc> {
  try {
    const snap = await getSystemMetadataCollection().doc(JOB_NOTIFICATION_CURSOR_DOC).get();
    if (snap.exists) {
      const data = snap.data() as JobNotificationCursorDoc;
      if (data && Array.isArray(data.seenJobIds)) {
        return data;
      }
    }
  } catch {
    // Memory fallback
  }

  return {
    seenJobIds: Array.from(memorySeenJobIds),
    lastRunAt: new Date(0).toISOString(),
    totalJobsProcessed: 0,
  };
}

export async function writeJobNotificationCursor(cursor: JobNotificationCursorDoc): Promise<void> {
  try {
    await getSystemMetadataCollection().doc(JOB_NOTIFICATION_CURSOR_DOC).set(cursor);
  } catch {
    // Memory fallback
  }
  memorySeenJobIds = new Set(cursor.seenJobIds);
}

/**
 * Processes durable JOB_CREATED events from the outbox.
 * Idempotently evaluates active user alerts and creates deliverable notifications.
 */
export async function processPendingJobEvents(
  batchLimit = 50
): Promise<{
  eventsProcessed: number;
  notificationsCreated: number;
  delivered: number;
  queued: number;
}> {
  const pendingEvents = await getPendingJobEvents(batchLimit);
  if (pendingEvents.length === 0) {
    return { eventsProcessed: 0, notificationsCreated: 0, delivered: 0, queued: 0 };
  }

  const activeAlerts = await getAllActiveAlerts();
  if (activeAlerts.length === 0) {
    for (const evt of pendingEvents) {
      await markJobEventProcessed(evt.eventId);
    }
    return { eventsProcessed: pendingEvents.length, notificationsCreated: 0, delivered: 0, queued: 0 };
  }

  // Group alerts by user
  const alertsByUser = new Map<string, SavedJobAlert[]>();
  for (const alert of activeAlerts) {
    if (!alertsByUser.has(alert.userId)) {
      alertsByUser.set(alert.userId, []);
    }
    alertsByUser.get(alert.userId)!.push(alert);
  }

  const now = new Date();
  let notificationsCreated = 0;
  let delivered = 0;
  let queued = 0;

  for (const event of pendingEvents) {
    const job = fromCanonicalJob(event.job);

    // Skip invalid jobs
    if (!job.title || !job.company || !isValidJobApplicationUrl(job.applicationUrl)) {
      await markJobEventProcessed(event.eventId);
      continue;
    }

    for (const [userId, userAlerts] of alertsByUser.entries()) {
      const preferences = await getNotificationPreferences(userId);
      if (!preferences.enabled) {
        continue;
      }

      const matchingAlerts = findMatchingAlertsForJob(job, userAlerts);
      if (matchingAlerts.length === 0) {
        continue;
      }

      // 1 user + 1 canonical job = 1 notification
      const dedupeKey = `${userId}__${job.id}`;
      const notificationId = `notif_${crypto.createHash('sha256').update(dedupeKey).digest('hex').slice(0, 16)}`;

      // Check delivery window (24x7x365 active by default)
      const inWindow = isWithinDeliveryWindow(now, preferences);
      const deliveryStatus = inWindow ? 'DELIVERED' : 'PENDING';
      const deliveredAt = inWindow ? now.toISOString() : null;
      const scheduledAt = inWindow
        ? now.toISOString()
        : calculateNextDeliveryWindow(now, preferences).toISOString();

      const notif: SmartJobNotification = {
        notificationId,
        userId,
        canonicalJobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        jobLocation: job.location || (job.isRemote ? 'Remote' : 'Unspecified'),
        jobWorkplaceType: job.workplaceType || (job.isRemote ? 'remote' : 'onsite'),
        jobEmploymentType: job.employmentType || 'full-time',
        jobUrl: job.applicationUrl,
        jobIndustry: job.industry,
        matchingAlertIds: matchingAlerts.map((a) => a.alertId),
        matchingAlertNames: matchingAlerts.map((a) => a.alertName),
        notificationType: 'new_job_match',
        readStatus: 'UNREAD',
        deliveryStatus,
        scheduledAt,
        deliveredAt,
        createdAt: now.toISOString(),
        dedupeKey,
      };

      try {
        const col = getUserNotificationsCollection<SmartJobNotification>();
        const docRef = col.doc(notificationId);
        const existing = await docRef.get();
        if (!existing.exists) {
          await docRef.set(notif);
          notificationsCreated++;
          if (inWindow) delivered++;
          else queued++;
        }
      } catch {
        // Memory fallback
        if (!memoryNotifications.has(notificationId)) {
          memoryNotifications.set(notificationId, notif);
          notificationsCreated++;
          if (inWindow) delivered++;
          else queued++;
        }
      }
    }

    await markJobEventProcessed(event.eventId);
  }

  return {
    eventsProcessed: pendingEvents.length,
    notificationsCreated,
    delivered,
    queued,
  };
}

/**
 * Consumes canonical normalized jobs, identifies genuinely new candidates,
 * evaluates active alerts for each user, and creates idempotent notifications.
 */
export async function processNewCanonicalJobs(
  jobs: NormalizedJob[]
): Promise<{
  created: number;
  delivered: number;
  queued: number;
  newJobsDetected: number;
}> {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { created: 0, delivered: 0, queued: 0, newJobsDetected: 0 };
  }

  const cursor = await readJobNotificationCursor();
  const seenSet = new Set<string>(cursor.seenJobIds);

  // If this is the very first time running, seed the cursor with existing jobs
  // to avoid notifying users of historical backlog
  if (seenSet.size === 0 && cursor.lastRunAt === new Date(0).toISOString()) {
    for (const j of jobs) {
      if (j.id) seenSet.add(j.id);
    }
    await writeJobNotificationCursor({
      seenJobIds: Array.from(seenSet).slice(-MAX_SEEN_JOB_IDS_TRACKED),
      lastRunAt: new Date().toISOString(),
      totalJobsProcessed: jobs.length,
    });
    return { created: 0, delivered: 0, queued: 0, newJobsDetected: 0 };
  }

  // Filter for genuinely new canonical jobs
  const newJobs = jobs.filter((j) => Boolean(j.id && !seenSet.has(j.id)));
  if (newJobs.length === 0) {
    return { created: 0, delivered: 0, queued: 0, newJobsDetected: 0 };
  }

  // Load all active alerts
  const activeAlerts = await getAllActiveAlerts();
  if (activeAlerts.length === 0) {
    // Update seen cursor so we don't re-scan these jobs next time
    for (const j of newJobs) {
      seenSet.add(j.id);
    }
    await writeJobNotificationCursor({
      seenJobIds: Array.from(seenSet).slice(-MAX_SEEN_JOB_IDS_TRACKED),
      lastRunAt: new Date().toISOString(),
      totalJobsProcessed: cursor.totalJobsProcessed + newJobs.length,
    });
    return { created: 0, delivered: 0, queued: 0, newJobsDetected: newJobs.length };
  }

  // Group alerts by user
  const alertsByUser = new Map<string, SavedJobAlert[]>();
  for (const alert of activeAlerts) {
    if (!alertsByUser.has(alert.userId)) {
      alertsByUser.set(alert.userId, []);
    }
    alertsByUser.get(alert.userId)!.push(alert);
  }

  const now = new Date();
  let created = 0;
  let delivered = 0;
  let queued = 0;

  for (const job of newJobs) {
    seenSet.add(job.id);

    // Skip invalid jobs
    if (!job.title || !job.company || !isValidJobApplicationUrl(job.applicationUrl)) {
      continue;
    }

    for (const [userId, userAlerts] of alertsByUser.entries()) {
      const preferences = await getNotificationPreferences(userId);
      if (!preferences.enabled) {
        continue;
      }

      const matchingAlerts = findMatchingAlertsForJob(job, userAlerts);
      if (matchingAlerts.length === 0) {
        continue;
      }

      // 1 user + 1 canonical job = 1 notification
      const dedupeKey = `${userId}__${job.id}`;
      const notificationId = `notif_${crypto.createHash('sha256').update(dedupeKey).digest('hex').slice(0, 16)}`;

      // Check delivery window
      const inWindow = isWithinDeliveryWindow(now, preferences);
      const deliveryStatus = inWindow ? 'DELIVERED' : 'PENDING';
      const deliveredAt = inWindow ? now.toISOString() : null;
      const scheduledAt = inWindow
        ? now.toISOString()
        : calculateNextDeliveryWindow(now, preferences).toISOString();

      const notif: SmartJobNotification = {
        notificationId,
        userId,
        canonicalJobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        jobLocation: job.location || (job.isRemote ? 'Remote' : 'Unspecified'),
        jobWorkplaceType: job.workplaceType || (job.isRemote ? 'remote' : 'onsite'),
        jobEmploymentType: job.employmentType || 'full-time',
        jobUrl: job.applicationUrl,
        jobIndustry: job.industry,
        matchingAlertIds: matchingAlerts.map((a) => a.alertId),
        matchingAlertNames: matchingAlerts.map((a) => a.alertName),
        notificationType: 'new_job_match',
        readStatus: 'UNREAD',
        deliveryStatus,
        scheduledAt,
        deliveredAt,
        createdAt: now.toISOString(),
        dedupeKey,
      };

      try {
        const col = getUserNotificationsCollection<SmartJobNotification>();
        // Idempotent insertion using deterministic notificationId as doc ID
        const docRef = col.doc(notificationId);
        const existing = await docRef.get();
        if (!existing.exists) {
          await docRef.set(notif);
          created++;
          if (inWindow) delivered++;
          else queued++;
        }
      } catch {
        // Memory fallback
        if (!memoryNotifications.has(notificationId)) {
          memoryNotifications.set(notificationId, notif);
          created++;
          if (inWindow) delivered++;
          else queued++;
        }
      }
    }
  }

  // Update cursor with bounded history
  await writeJobNotificationCursor({
    seenJobIds: Array.from(seenSet).slice(-MAX_SEEN_JOB_IDS_TRACKED),
    lastRunAt: now.toISOString(),
    totalJobsProcessed: cursor.totalJobsProcessed + newJobs.length,
  });

  return { created, delivered, queued, newJobsDetected: newJobs.length };
}

// ============================================================================
// 5. Deferred Notification Delivery Worker
// ============================================================================

export async function processDeferredPendingNotifications(
  batchLimit = 50
): Promise<{
  processed: number;
  delivered: number;
  cancelled: number;
  failed: number;
}> {
  const now = new Date();
  const nowIso = now.toISOString();
  let processed = 0;
  let delivered = 0;
  let cancelled = 0;
  let failed = 0;

  const candidates: SmartJobNotification[] = [];

  try {
    const col = getUserNotificationsCollection<SmartJobNotification>();
    const snap = await col
      .where('deliveryStatus', '==', 'PENDING')
      .where('scheduledAt', '<=', nowIso)
      .limit(batchLimit)
      .get();

    for (const doc of snap.docs) {
      candidates.push({ ...doc.data(), notificationId: doc.id });
    }
  } catch {
    // Memory fallback
  }

  if (candidates.length === 0) {
    for (const notif of memoryNotifications.values()) {
      if (notif.deliveryStatus === 'PENDING' && notif.scheduledAt <= nowIso) {
        candidates.push(notif);
        if (candidates.length >= batchLimit) break;
      }
    }
  }

  for (const notif of candidates) {
    processed++;
    const leaseExpiresAt = new Date(Date.now() + CLAIM_LEASE_DURATION_MS).toISOString();

    // 1. Atomic claim
    try {
      const col = getUserNotificationsCollection<SmartJobNotification>();
      const docRef = col.doc(notif.notificationId);
      await docRef.update({
        deliveryStatus: 'CLAIMED',
        leaseExpiresAt,
      });
    } catch {
      // Memory claim
      notif.deliveryStatus = 'CLAIMED';
      notif.leaseExpiresAt = leaseExpiresAt;
    }

    // 2. Re-verify user preferences
    const prefs = await getNotificationPreferences(notif.userId);
    if (!prefs.enabled) {
      try {
        const col = getUserNotificationsCollection<SmartJobNotification>();
        await col.doc(notif.notificationId).update({
          deliveryStatus: 'CANCELLED',
          failureReason: 'User disabled notifications during deferral',
        });
      } catch {
        notif.deliveryStatus = 'CANCELLED';
        notif.failureReason = 'User disabled notifications during deferral';
      }
      cancelled++;
      continue;
    }

    // 3. Verify user is in their current delivery window
    const inWindowNow = isWithinDeliveryWindow(now, prefs);
    if (!inWindowNow) {
      // Reschedule to next valid window
      const nextWindow = calculateNextDeliveryWindow(now, prefs);
      try {
        const col = getUserNotificationsCollection<SmartJobNotification>();
        await col.doc(notif.notificationId).update({
          deliveryStatus: 'PENDING',
          scheduledAt: nextWindow.toISOString(),
          leaseExpiresAt: null,
        });
      } catch {
        notif.deliveryStatus = 'PENDING';
        notif.scheduledAt = nextWindow.toISOString();
        notif.leaseExpiresAt = null;
      }
      continue;
    }

    // 4. Verify job application URL
    if (!isValidJobApplicationUrl(notif.jobUrl)) {
      try {
        const col = getUserNotificationsCollection<SmartJobNotification>();
        await col.doc(notif.notificationId).update({
          deliveryStatus: 'EXPIRED',
          failureReason: 'Invalid or obsolete application URL',
          leaseExpiresAt: null,
        });
      } catch {
        notif.deliveryStatus = 'EXPIRED';
        notif.failureReason = 'Invalid or obsolete application URL';
        notif.leaseExpiresAt = null;
      }
      failed++;
      continue;
    }

    // 5. Finalize delivery
    try {
      const col = getUserNotificationsCollection<SmartJobNotification>();
      await col.doc(notif.notificationId).update({
        deliveryStatus: 'DELIVERED',
        deliveredAt: nowIso,
        leaseExpiresAt: null,
      });
      delivered++;
    } catch {
      notif.deliveryStatus = 'DELIVERED';
      notif.deliveredAt = nowIso;
      notif.leaseExpiresAt = null;
      delivered++;
    }
  }

  return { processed, delivered, cancelled, failed };
}
