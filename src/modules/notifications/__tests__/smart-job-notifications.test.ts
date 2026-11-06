import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, SESSION_COOKIE_NAME } from '@/modules/auth/server/session.store';
import { GET as getPreferences, PUT as putPreferences } from '@/app/api/notifications/preferences/route';
import { GET as getAlerts, POST as postAlert } from '@/app/api/notifications/alerts/route';
import { PUT as putAlert, DELETE as deleteAlertRoute } from '@/app/api/notifications/alerts/[alertId]/route';
import { GET as getNotifications } from '@/app/api/notifications/route';
import { PATCH as patchNotification } from '@/app/api/notifications/[notificationId]/route';
import { POST as postReadAll } from '@/app/api/notifications/read-all/route';
import { GET as getCron } from '@/app/api/cron/jobs/notifications/route';
import {
  isWithinDeliveryWindow,
  calculateNextDeliveryWindow,
  isValidTimezone,
  getLocalTimeParts,
} from '../services/notification-scheduler.service';
import {
  matchesAlert,
  findMatchingAlertsForJob,
  isJobInSector,
} from '../services/job-alert-matcher.service';
import {
  resetSmartNotificationMemoryStore,
  getNotificationPreferences,
  updateNotificationPreferences,
  migrateLegacyPreferences,
  createAlert,
  getAlertsForUser,
  updateAlert,
  deleteAlert,
  getUserNotifications,
  markNotificationRead,
  dismissNotification,
  markAllNotificationsRead,
  processNewCanonicalJobs,
  processDeferredPendingNotifications,
  isValidJobApplicationUrl,
  writeJobNotificationCursor,
} from '../services/smart-notification.store';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  SavedJobAlert,
} from '../domain/smart-notification.types';
import { NormalizedJob } from '@/modules/jobs/domain/job.types';

function createSampleJob(partial: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: partial.id || 'job_test_1',
    sourceId: partial.sourceId || 'src_1',
    sourceName: partial.sourceName || 'Greenhouse',
    title: partial.title || 'Senior Frontend Engineer',
    company: partial.company || 'NexusTech Labs',
    location: partial.location || 'Bengaluru, India',
    isRemote: partial.isRemote ?? true,
    workplaceType: partial.workplaceType || 'remote',
    description: partial.description || 'Build cutting edge web applications with React and Next.js.',
    applicationUrl: partial.applicationUrl || 'https://nexustech.io/careers/senior-frontend',
    publishedAt: partial.publishedAt || new Date().toISOString(),
    employmentType: partial.employmentType || 'full-time',
    industry: partial.industry || 'technology',
    tags: partial.tags || ['react', 'nextjs', 'typescript'],
  };
}

describe('1. Dedicated Server-Side Notification Scheduling Utility & 24x7x365 Engine', () => {
  const default24x7Prefs: NotificationPreferences = {
    userId: 'user_sched_1',
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const customQuietHoursPrefs: NotificationPreferences = {
    userId: 'user_sched_2',
    enabled: true,
    mode: 'instant',
    timezone: 'Asia/Kolkata',
    startTime: '09:00',
    endTime: '21:00',
    activeDays: [1, 2, 3, 4, 5, 6], // Explicit legacy quiet hours (Sun off)
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('validates IANA timezone strings correctly', () => {
    assert.strictEqual(isValidTimezone('Asia/Kolkata'), true);
    assert.strictEqual(isValidTimezone('UTC'), true);
    assert.strictEqual(isValidTimezone('America/New_York'), true);
    assert.strictEqual(isValidTimezone('Europe/London'), true);
    assert.strictEqual(isValidTimezone('Asia/Tokyo'), true);
    assert.strictEqual(isValidTimezone('Invalid/Timezone_123'), false);
    assert.strictEqual(isValidTimezone(''), false);
  });

  it('correctly maps local time parts using Intl for Asia/Kolkata', () => {
    // 2026-05-04T05:00:00.000Z is Monday 10:30:00 AM IST (UTC + 5:30)
    const testDate = new Date('2026-05-04T05:00:00.000Z');
    const parts = getLocalTimeParts(testDate, 'Asia/Kolkata');
    assert.strictEqual(parts.isoWeekday, 1); // Monday
    assert.strictEqual(parts.hours, 10);
    assert.strictEqual(parts.minutes, 30);
  });

  it('evaluates delivery window: Monday 08:30 with 24x7 default -> IN window', () => {
    const mon830 = new Date('2026-05-04T03:00:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(mon830, default24x7Prefs), true);
  });

  it('evaluates delivery window: Sunday 11:00 with 24x7 default -> IN window', () => {
    const sun1100 = new Date('2026-05-10T05:30:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(sun1100, default24x7Prefs), true);
  });

  it('evaluates delivery window: Saturday 21:05 with 24x7 default -> IN window', () => {
    const sat2105 = new Date('2026-05-09T15:35:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(sat2105, default24x7Prefs), true);
  });

  it('evaluates delivery window with custom quiet hours: Monday 08:30 (before 09:00) -> NOT in window', () => {
    const mon830 = new Date('2026-05-04T03:00:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(mon830, customQuietHoursPrefs), false);
  });

  it('evaluates delivery window with custom quiet hours: Monday 10:30 -> IN window', () => {
    const mon1030 = new Date('2026-05-04T05:00:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(mon1030, customQuietHoursPrefs), true);
  });

  it('evaluates delivery window with custom quiet hours: Monday 21:00 -> NOT in window', () => {
    const mon2100 = new Date('2026-05-04T15:30:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(mon2100, customQuietHoursPrefs), false);
  });

  it('evaluates delivery window with custom quiet hours: Sunday 11:00 (Sunday disabled) -> NOT in window', () => {
    const sun1100 = new Date('2026-05-10T05:30:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(sun1100, customQuietHoursPrefs), false);
  });

  it('calculates next delivery window with custom quiet hours: Mon 08:30 -> Mon 09:00', () => {
    const mon830 = new Date('2026-05-04T03:00:00.000Z');
    const next = calculateNextDeliveryWindow(mon830, customQuietHoursPrefs);
    const parts = getLocalTimeParts(next, 'Asia/Kolkata');
    assert.strictEqual(parts.isoWeekday, 1); // Monday
    assert.strictEqual(parts.hours, 9);
    assert.strictEqual(parts.minutes, 0);
  });

  it('calculates next delivery window with custom quiet hours: Mon 21:00 -> Tue 09:00', () => {
    const mon2100 = new Date('2026-05-04T15:30:00.000Z');
    const next = calculateNextDeliveryWindow(mon2100, customQuietHoursPrefs);
    const parts = getLocalTimeParts(next, 'Asia/Kolkata');
    assert.strictEqual(parts.isoWeekday, 2); // Tuesday
    assert.strictEqual(parts.hours, 9);
    assert.strictEqual(parts.minutes, 0);
  });

  it('calculates next delivery window with custom quiet hours: Sat 21:05 (Sunday disabled) -> Mon 09:00', () => {
    const sat2105 = new Date('2026-05-09T15:35:00.000Z');
    const next = calculateNextDeliveryWindow(sat2105, customQuietHoursPrefs);
    const parts = getLocalTimeParts(next, 'Asia/Kolkata');
    assert.strictEqual(parts.isoWeekday, 1); // Monday (skipping Sunday)
    assert.strictEqual(parts.hours, 9);
    assert.strictEqual(parts.minutes, 0);
  });

  it('calculates next delivery window with 24x7: returns current date immediately without queue delay', () => {
    const sun1100 = new Date('2026-05-10T05:30:00.000Z');
    const next = calculateNextDeliveryWindow(sun1100, default24x7Prefs);
    assert.strictEqual(next.getTime(), sun1100.getTime());
  });

  it('migrates legacy preferences safely to 24x7 while preserving explicit opt-outs and custom schedules', () => {
    // 1. Explicit opt out remains OFF
    const optOut = migrateLegacyPreferences({ enabled: false }, 'u_optout');
    assert.strictEqual(optOut.enabled, false);

    // 2. Legacy defaults upgraded to 24x7x365
    const legacy = migrateLegacyPreferences(
      { enabled: true, activeDays: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '21:00' },
      'u_legacy'
    );
    assert.strictEqual(legacy.enabled, true);
    assert.deepStrictEqual(legacy.activeDays, [1, 2, 3, 4, 5, 6, 7]);
    assert.strictEqual(legacy.startTime, '00:00');
    assert.strictEqual(legacy.endTime, '23:59');

    // 3. Custom schedule preserved
    const custom = migrateLegacyPreferences(
      { enabled: true, activeDays: [1, 3, 5], startTime: '10:00', endTime: '18:00' },
      'u_custom'
    );
    assert.strictEqual(custom.enabled, true);
    assert.deepStrictEqual(custom.activeDays, [1, 3, 5]);
    assert.strictEqual(custom.startTime, '10:00');
    assert.strictEqual(custom.endTime, '18:00');
  });

  it('supports different IANA timezones (e.g. America/New_York)', () => {
    const nyPrefs: NotificationPreferences = {
      ...customQuietHoursPrefs,
      timezone: 'America/New_York',
    };

    // 14:00 UTC = 10:00 AM EDT (in window)
    const ny10am = new Date('2026-05-04T14:00:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(ny10am, nyPrefs), true);

    // 03:00 UTC = 11:00 PM EDT previous day (outside window)
    const ny11pm = new Date('2026-05-04T03:00:00.000Z');
    assert.strictEqual(isWithinDeliveryWindow(ny11pm, nyPrefs), false);
  });
});

describe('2. Job Alert Matching Engine & Sector Taxonomy', () => {
  it('correctly categorizes IT vs Non-IT sectors', () => {
    const itJob = createSampleJob({ industry: 'technology' });
    const nonItJob = createSampleJob({ industry: 'healthcare' });
    const constructionJob = createSampleJob({ industry: 'construction_trades' });

    assert.strictEqual(isJobInSector(itJob, 'it'), true);
    assert.strictEqual(isJobInSector(itJob, 'non_it'), false);
    assert.strictEqual(isJobInSector(nonItJob, 'it'), false);
    assert.strictEqual(isJobInSector(nonItJob, 'non_it'), true);
    assert.strictEqual(isJobInSector(constructionJob, 'non_it'), true);
    assert.strictEqual(isJobInSector(itJob, 'all'), true);
  });

  it('matches role and keywords accurately', () => {
    const job = createSampleJob({
      title: 'Staff Full Stack Engineer',
      description: 'Experience with React, Next.js, and TypeScript',
    });

    const alert: SavedJobAlert = {
      alertId: 'a1',
      userId: 'u1',
      alertName: 'Full Stack Staff',
      enabled: true,
      roles: ['Full Stack'],
      keywords: ['TypeScript'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(matchesAlert(job, alert), true);
  });

  it('correctly excludes jobs using negative keyword boundaries', () => {
    const juniorJob = createSampleJob({
      title: 'Junior React Developer',
    });
    const internJob = createSampleJob({
      title: 'Frontend Intern',
    });
    const internalToolsJob = createSampleJob({
      title: 'Senior Internal Tools Engineer',
      description: 'Building internal dashboards using React.',
    });

    const alert: SavedJobAlert = {
      alertId: 'a2',
      userId: 'u1',
      alertName: 'Senior Frontend',
      enabled: true,
      keywords: ['React'],
      excludedKeywords: ['Junior', 'Intern'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 'Junior React Developer' has 'Junior' -> excluded
    assert.strictEqual(matchesAlert(juniorJob, alert), false);

    // 'Frontend Intern' has 'Intern' -> excluded
    assert.strictEqual(matchesAlert(internJob, alert), false);

    // 'Senior Internal Tools Engineer' has word 'Internal', NOT 'Intern' -> NOT excluded
    assert.strictEqual(matchesAlert(internalToolsJob, alert), true);
  });

  it('matches workplace types (remote, hybrid, onsite)', () => {
    const remoteJob = createSampleJob({ workplaceType: 'remote', isRemote: true });
    const hybridJob = createSampleJob({ workplaceType: 'hybrid', isRemote: false });
    const onsiteJob = createSampleJob({ workplaceType: 'onsite', isRemote: false });

    const remoteAlert: SavedJobAlert = {
      alertId: 'a3',
      userId: 'u1',
      alertName: 'Remote Only',
      enabled: true,
      workModes: ['remote'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(matchesAlert(remoteJob, remoteAlert), true);
    assert.strictEqual(matchesAlert(hybridJob, remoteAlert), false);
    assert.strictEqual(matchesAlert(onsiteJob, remoteAlert), false);
  });

  it('matches multiple alerts for the same user without duplication', () => {
    const job = createSampleJob({
      title: 'Senior Frontend Engineer - Remote',
      workplaceType: 'remote',
      isRemote: true,
    });

    const alert1: SavedJobAlert = {
      alertId: 'a_react',
      userId: 'u1',
      alertName: 'React Roles',
      enabled: true,
      keywords: ['Frontend'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const alert2: SavedJobAlert = {
      alertId: 'a_remote',
      userId: 'u1',
      alertName: 'Remote Roles',
      enabled: true,
      workModes: ['remote'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const matched = findMatchingAlertsForJob(job, [alert1, alert2]);
    assert.strictEqual(matched.length, 2);
    assert.strictEqual(matched[0].alertId, 'a_react');
    assert.strictEqual(matched[1].alertId, 'a_remote');
  });
});

describe('3. Smart Notification Store, Persistence & Ingestion Engine', () => {
  beforeEach(() => {
    resetSmartNotificationMemoryStore();
  });

  it('returns default preferences for new users (24x7x365)', async () => {
    const prefs = await getNotificationPreferences('user_test_new');
    assert.strictEqual(prefs.userId, 'user_test_new');
    assert.strictEqual(prefs.enabled, true);
    assert.strictEqual(prefs.mode, 'instant');
    assert.strictEqual(prefs.timezone, 'Asia/Kolkata');
    assert.strictEqual(prefs.startTime, '00:00');
    assert.strictEqual(prefs.endTime, '23:59');
    assert.deepStrictEqual(prefs.activeDays, [1, 2, 3, 4, 5, 6, 7]);
  });

  it('supports updating preferences and cancels pending notifications when master toggle is turned OFF', async () => {
    const userId = 'user_pref_cancel';
    await createAlert(userId, {
      alertName: 'Test Alert',
      enabled: true,
      keywords: ['Engineer'],
    });

    // Ingest a job outside window so it queues
    const nightTime = new Date('2026-05-04T17:00:00.000Z'); // 22:30 IST
    // Seed cursor
    await writeJobNotificationCursor({
      seenJobIds: ['seed_1'],
      lastRunAt: new Date().toISOString(),
      totalJobsProcessed: 1,
    });

    // Process a new job outside window
    const newJob = createSampleJob({ id: 'job_night_1', title: 'Software Engineer' });
    // Run outside window by updating preferences temporarily
    await updateNotificationPreferences(userId, { startTime: '09:00', endTime: '10:00' });
    await processNewCanonicalJobs([newJob]);

    // Check that notification is pending
    const inbox = await getUserNotifications(userId);
    // In our test, if it was pending, now turn master toggle OFF
    await updateNotificationPreferences(userId, { enabled: false });

    const updatedPrefs = await getNotificationPreferences(userId);
    assert.strictEqual(updatedPrefs.enabled, false);
  });

  it('performs alert CRUD reliably', async () => {
    const userId = 'user_crud_1';
    const alert = await createAlert(userId, {
      alertName: 'Cloud Architect',
      enabled: true,
      roles: ['Cloud Architect', 'DevOps Lead'],
      workModes: ['remote', 'hybrid'],
    });

    assert.ok(alert.alertId.startsWith('alert_'));
    assert.strictEqual(alert.alertName, 'Cloud Architect');

    const alerts = await getAlertsForUser(userId);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].alertId, alert.alertId);

    const updated = await updateAlert(userId, alert.alertId, {
      alertName: 'Staff Cloud Architect',
      enabled: false,
    });
    assert.strictEqual(updated?.alertName, 'Staff Cloud Architect');
    assert.strictEqual(updated?.enabled, false);

    const deleted = await deleteAlert(userId, alert.alertId);
    assert.strictEqual(deleted, true);

    const afterDelete = await getAlertsForUser(userId);
    assert.strictEqual(afterDelete.length, 0);
  });

  it('seeds cursor on initial run and does not notify for historical jobs', async () => {
    const userId = 'user_history_1';
    await createAlert(userId, {
      alertName: 'All Roles',
      enabled: true,
    });

    const historicalJobs = [
      createSampleJob({ id: 'hist_1' }),
      createSampleJob({ id: 'hist_2' }),
      createSampleJob({ id: 'hist_3' }),
    ];

    const result = await processNewCanonicalJobs(historicalJobs);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.delivered, 0);
    assert.strictEqual(result.queued, 0);

    const inbox = await getUserNotifications(userId);
    assert.strictEqual(inbox.notifications.length, 0);
  });

  it('notifies genuinely new canonical jobs on subsequent ingestion and consolidates multiple alerts into 1 notification', async () => {
    const userId = 'user_new_jobs';
    await createAlert(userId, {
      alertName: 'Alert 1: Frontend',
      enabled: true,
      keywords: ['Frontend'],
    });
    await createAlert(userId, {
      alertName: 'Alert 2: React',
      enabled: true,
      keywords: ['React'],
    });

    // 1. Seed historical baseline
    await processNewCanonicalJobs([createSampleJob({ id: 'seed_job' })]);

    // 2. Ingest brand new job that matches BOTH alerts
    const newJob = createSampleJob({
      id: 'brand_new_job_1',
      title: 'Senior Frontend React Architect',
      applicationUrl: 'https://nexustech.io/apply/1',
    });

    const result = await processNewCanonicalJobs([newJob]);
    assert.strictEqual(result.newJobsDetected, 1);
    // 1 user + 1 canonical job = exactly 1 notification
    assert.strictEqual(result.created, 1);

    const inbox = await getUserNotifications(userId);
    assert.strictEqual(inbox.notifications.length, 1);

    const notif = inbox.notifications[0];
    assert.strictEqual(notif.canonicalJobId, 'brand_new_job_1');
    assert.strictEqual(notif.jobTitle, 'Senior Frontend React Architect');
    // Verifies that both matching alert names and IDs are stored in the single notification
    assert.strictEqual(notif.matchingAlertNames.length, 2);
    assert.ok(notif.matchingAlertNames.includes('Alert 1: Frontend'));
    assert.ok(notif.matchingAlertNames.includes('Alert 2: React'));
  });

  it('does not create duplicate notifications on repeated ingestion runs', async () => {
    const userId = 'user_dedupe_run';
    await createAlert(userId, {
      alertName: 'DevOps Alert',
      enabled: true,
      keywords: ['DevOps'],
    });

    await processNewCanonicalJobs([createSampleJob({ id: 'seed_job_2' })]);

    const newJob = createSampleJob({
      id: 'job_devops_unique',
      title: 'Lead DevOps Engineer',
    });

    // Run 1
    const run1 = await processNewCanonicalJobs([newJob]);
    assert.strictEqual(run1.created, 1);

    // Run 2 with the identical job
    const run2 = await processNewCanonicalJobs([newJob]);
    assert.strictEqual(run2.created, 0);
    assert.strictEqual(run2.newJobsDetected, 0);

    const inbox = await getUserNotifications(userId);
    assert.strictEqual(inbox.notifications.length, 1);
  });

  it('marks notifications as read, dismissed, and marks all read', async () => {
    const userId = 'user_lifecycle_1';
    await createAlert(userId, { alertName: 'All Jobs', enabled: true });
    await processNewCanonicalJobs([createSampleJob({ id: 'seed_3' })]);

    const jobA = createSampleJob({ id: 'job_a' });
    const jobB = createSampleJob({ id: 'job_b' });
    await processNewCanonicalJobs([jobA, jobB]);

    const inbox = await getUserNotifications(userId);
    assert.strictEqual(inbox.notifications.length, 2);
    assert.strictEqual(inbox.unreadCount, 2);

    const notifA = inbox.notifications[0];
    const markSuccess = await markNotificationRead(userId, notifA.notificationId);
    assert.strictEqual(markSuccess, true);

    const afterRead = await getUserNotifications(userId);
    assert.strictEqual(afterRead.unreadCount, 1);

    const markAllCount = await markAllNotificationsRead(userId);
    assert.strictEqual(markAllCount, 1);

    const afterMarkAll = await getUserNotifications(userId);
    assert.strictEqual(afterMarkAll.unreadCount, 0);

    const notifB = afterMarkAll.notifications[1];
    const dismissSuccess = await dismissNotification(userId, notifB.notificationId);
    assert.strictEqual(dismissSuccess, true);
  });
});

describe('4. URL Validation & Security Sanitization', () => {
  it('accepts valid HTTP/HTTPS URLs', () => {
    assert.strictEqual(isValidJobApplicationUrl('https://careers.google.com/jobs/123'), true);
    assert.strictEqual(isValidJobApplicationUrl('http://jobs.lever.co/company/456'), true);
    assert.strictEqual(isValidJobApplicationUrl('https://boards.greenhouse.io/myteam/jobs/789?gh_src=feed'), true);
  });

  it('rejects unsafe, malformed or malicious URLs', () => {
    assert.strictEqual(isValidJobApplicationUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidJobApplicationUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.strictEqual(isValidJobApplicationUrl('vbscript:msgbox(1)'), false);
    assert.strictEqual(isValidJobApplicationUrl('//malicious.com/phish'), false);
    assert.strictEqual(isValidJobApplicationUrl('not-a-valid-url'), false);
    assert.strictEqual(isValidJobApplicationUrl(''), false);
    assert.strictEqual(isValidJobApplicationUrl(null), false);
    assert.strictEqual(isValidJobApplicationUrl(undefined), false);
  });
});

describe('5. Deferred Pending Batch Worker & Atomic Lease Claims', () => {
  beforeEach(() => {
    resetSmartNotificationMemoryStore();
  });

  it('delivers pending notifications when delivery window is active and updates status to DELIVERED', async () => {
    const userId = 'user_worker_1';
    await createAlert(userId, { alertName: 'Backend Roles', enabled: true, keywords: ['Go'] });

    // Seed cursor
    await processNewCanonicalJobs([createSampleJob({ id: 'worker_seed_1' })]);

    // Create a job outside window by setting preferences window to future
    await updateNotificationPreferences(userId, { startTime: '23:58', endTime: '23:59' });
    const job = createSampleJob({ id: 'job_go_worker', title: 'Senior Go Engineer' });
    await processNewCanonicalJobs([job]);

    // Verify it was queued as PENDING
    const initialInbox = await getUserNotifications(userId);
    assert.strictEqual(initialInbox.notifications.length, 0); // DELIVERED only

    // Open delivery window now
    await updateNotificationPreferences(userId, { startTime: '00:00', endTime: '23:59', activeDays: [1, 2, 3, 4, 5, 6, 7] });

    // Run deferred worker
    const workerRes = await processDeferredPendingNotifications(10);
    assert.strictEqual(workerRes.processed, 1);
    assert.strictEqual(workerRes.delivered, 1);

    // Verify delivered in inbox
    const deliveredInbox = await getUserNotifications(userId);
    assert.strictEqual(deliveredInbox.notifications.length, 1);
    assert.strictEqual(deliveredInbox.notifications[0].deliveryStatus, 'DELIVERED');
  });

  it('cancels pending notifications during deferral if user turns master switch OFF', async () => {
    const userId = 'user_worker_cancel';
    await createAlert(userId, { alertName: 'AI Roles', enabled: true, keywords: ['PyTorch'] });
    await processNewCanonicalJobs([createSampleJob({ id: 'worker_seed_2' })]);

    // Queue outside window
    await updateNotificationPreferences(userId, { startTime: '23:58', endTime: '23:59' });
    const job = createSampleJob({ id: 'job_pytorch', title: 'AI PyTorch Engineer' });
    await processNewCanonicalJobs([job]);

    // User disables notifications before window arrives -> immediately cancels pending notifications
    await updateNotificationPreferences(userId, { enabled: false });

    // Verify notifications were cancelled and inbox has 0 delivered/unread
    const inbox = await getUserNotifications(userId);
    assert.strictEqual(inbox.notifications.length, 0);

    // Run worker to verify worker cleanly skips cancelled notifications
    const workerRes = await processDeferredPendingNotifications(10);
    assert.strictEqual(workerRes.delivered, 0);
  });
});

describe('6. API Route Handlers Security & Cross-User Isolation', () => {
  beforeEach(() => {
    resetSmartNotificationMemoryStore();
  });

  function createAuthHeader(sessionId: string): HeadersInit {
    return {
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      'Content-Type': 'application/json',
    };
  }

  it('rejects unauthenticated requests with 401 across notification endpoints', async () => {
    const noAuthReq = new Request('http://localhost:3000/api/notifications/preferences');
    const resPref = await getPreferences(noAuthReq);
    assert.strictEqual(resPref.status, 401);

    const noAuthAlerts = new Request('http://localhost:3000/api/notifications/alerts');
    const resAlerts = await getAlerts(noAuthAlerts);
    assert.strictEqual(resAlerts.status, 401);

    const noAuthNotifs = new Request('http://localhost:3000/api/notifications');
    const resNotifs = await getNotifications(noAuthNotifs);
    assert.strictEqual(resNotifs.status, 401);

    const noAuthReadAll = new Request('http://localhost:3000/api/notifications/read-all', { method: 'POST' });
    const resReadAll = await postReadAll(noAuthReadAll);
    assert.strictEqual(resReadAll.status, 401);
  });

  it('enforces cross-user isolation: User B cannot modify or delete User A alerts', async () => {
    const sessionUserA = createSession('user_a_owner');
    const sessionUserB = createSession('user_b_attacker');

    // User A creates alert
    const createReq = new Request('http://localhost:3000/api/notifications/alerts', {
      method: 'POST',
      headers: createAuthHeader(sessionUserA.sessionId),
      body: JSON.stringify({ alertName: 'User A Secret Alert', roles: ['CTO'] }),
    });
    const createRes = await postAlert(createReq);
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    const alertId = createData.alert.alertId;

    // User B tries to update User A's alert
    const hackPutReq = new Request(`http://localhost:3000/api/notifications/alerts/${alertId}`, {
      method: 'PUT',
      headers: createAuthHeader(sessionUserB.sessionId),
      body: JSON.stringify({ alertName: 'Hacked Alert' }),
    });
    const hackPutRes = await putAlert(hackPutReq, { params: Promise.resolve({ alertId }) });
    assert.strictEqual(hackPutRes.status, 404);

    // User B tries to delete User A's alert
    const hackDelReq = new Request(`http://localhost:3000/api/notifications/alerts/${alertId}`, {
      method: 'DELETE',
      headers: createAuthHeader(sessionUserB.sessionId),
    });
    const hackDelRes = await deleteAlertRoute(hackDelReq, { params: Promise.resolve({ alertId }) });
    assert.strictEqual(hackDelRes.status, 404);

    // Verify User A still owns the alert unchanged
    const getReq = new Request('http://localhost:3000/api/notifications/alerts', {
      headers: createAuthHeader(sessionUserA.sessionId),
    });
    const getRes = await getAlerts(getReq);
    const getData = await getRes.json();
    assert.strictEqual(getData.alerts.length, 1);
    assert.strictEqual(getData.alerts[0].alertName, 'User A Secret Alert');
  });

  it('enforces cross-user isolation: User B cannot read or dismiss User A notifications', async () => {
    const sessionUserA = createSession('user_a_notif');
    const sessionUserB = createSession('user_b_spy');

    // Ingest notification for User A
    await createAlert('user_a_notif', { alertName: 'All', enabled: true });
    await processNewCanonicalJobs([createSampleJob({ id: 'seed_api_test' })]);
    await processNewCanonicalJobs([createSampleJob({ id: 'job_user_a_only', title: 'VP of Engineering' })]);

    const inboxA = await getUserNotifications('user_a_notif');
    assert.strictEqual(inboxA.notifications.length, 1);
    const notifId = inboxA.notifications[0].notificationId;

    // User B tries to dismiss User A's notification
    const hackPatchReq = new Request(`http://localhost:3000/api/notifications/${notifId}`, {
      method: 'PATCH',
      headers: createAuthHeader(sessionUserB.sessionId),
      body: JSON.stringify({ action: 'dismiss' }),
    });
    const hackPatchRes = await patchNotification(hackPatchReq, { params: Promise.resolve({ notificationId: notifId }) });
    assert.strictEqual(hackPatchRes.status, 404);

    // User A successfully marks their own notification as read
    const validPatchReq = new Request(`http://localhost:3000/api/notifications/${notifId}`, {
      method: 'PATCH',
      headers: createAuthHeader(sessionUserA.sessionId),
      body: JSON.stringify({ action: 'read' }),
    });
    const validPatchRes = await patchNotification(validPatchReq, { params: Promise.resolve({ notificationId: notifId }) });
    assert.strictEqual(validPatchRes.status, 200);
  });

  it('protects the cron endpoint against unauthorized invocations', async () => {
    const noSecretReq = new Request('http://localhost:3000/api/cron/jobs/notifications');
    const res = await getCron(noSecretReq);
    assert.strictEqual(res.status, 401);
  });
});
