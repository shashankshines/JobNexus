import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  createAdminNotification,
  createAdminNotificationWithRecovery,
  reconcilePendingNotificationFailures,
  generateNotificationId,
  listAdminNotifications,
  markAdminNotification,
  markAllAdminNotificationsRead,
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
  getAdminUnreadNotificationCount,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@/modules/notifications/admin-notifications.service';
import {
  ADMIN_NOTIFICATION_EMAIL,
  ADMIN_NOTIFICATIONS_COLLECTION,
  ADMIN_NOTIFICATION_FAILURES_COLLECTION,
  AdminNotificationType,
  isValidAdminActionUrl,
  serializeCompoundCursor,
  parseCompoundCursor,
} from '@/modules/notifications/notification.types';
import {
  generateVoiceAnnouncement,
  VoiceAnnouncementQueue,
} from '@/app/hooks/useAdminNotifications';
import {
  GET as getNotificationsRoute,
  PATCH as patchNotificationsRoute,
} from '@/app/api/admin/notifications/route';
import {
  GET as getStreamRoute,
} from '@/app/api/admin/notifications/stream/route';
import {
  GET as getPreferencesRoute,
  POST as postPreferencesRoute,
} from '@/app/api/admin/notifications/preferences/route';
import {
  createSession,
  resetAuthStore,
  findOrCreateGoogleUser,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/server/session.store';

describe('JobNexus Real-Time Persistent Admin Notifications & Voice Alerts Suite', () => {
  let firestoreStore: InMemoryFirestoreStore;

  function createAuthorizedAdminRequest(
    path: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
  ): NextRequest {
    const adminUser = findOrCreateGoogleUser({
      email: ADMIN_NOTIFICATION_EMAIL,
      name: 'Designated Admin',
      sub: 'g_admin_super_1',
    });
    const session = createSession(adminUser.id);
    const url = `http://localhost:3000${path}`;
    const headers = new Headers();
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${session.sessionId}`);
    headers.set('Content-Type', 'application/json');

    return new NextRequest(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  }

  function createUnauthorizedUserRequest(path: string, options: { method?: string; body?: unknown } = {}): NextRequest {
    const regularUser = findOrCreateGoogleUser({
      email: 'regular.applicant@example.com',
      name: 'Regular Applicant',
      sub: 'g_user_applicant_1',
    });
    const session = createSession(regularUser.id);
    const url = `http://localhost:3000${path}`;
    const headers = new Headers();
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${session.sessionId}`);
    headers.set('Content-Type', 'application/json');

    return new NextRequest(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'shashankshines@gmail.com';
    firestoreStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(firestoreStore));
    resetAuthStore();
  });

  describe('1. Notification Event Generation & Idempotency Invariants', () => {
    it('creates an admin notification with authoritative deterministic event key and defaults', async () => {
      const notif = await createAdminNotification({
        eventKey: 'payment_submitted_subm_test_101',
        type: 'payment_submitted',
        title: 'Premium payment submitted',
        message: 'A candidate submitted a ₹349 payment reference for verification.',
        actionLabel: 'Verify Payment',
        actionUrl: '/admin?tab=verifications&submissionId=subm_test_101',
        userId: 'usr_candidate_1',
        userEmail: 'candidate@example.com',
        submissionId: 'subm_test_101',
      });

      assert.strictEqual(notif.eventKey, 'payment_submitted_subm_test_101');
      assert.strictEqual(notif.id, generateNotificationId('payment_submitted_subm_test_101'));
      assert.strictEqual(notif.recipientEmail, ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(notif.type, 'payment_submitted');
      assert.strictEqual(notif.priority, 'high'); // Default for payment_submitted
      assert.strictEqual(notif.status, 'unread');
      assert.strictEqual(notif.readAt, null);
      assert.strictEqual(notif.acknowledgedAt, null);
      assert.strictEqual(notif.resolvedAt, null);
      assert.ok(notif.createdAt);
    });

    it('enforces idempotency so re-emitting the same eventKey returns the original record without duplication', async () => {
      const first = await createAdminNotification({
        eventKey: 'order_created_ord_duplicate_check',
        type: 'premium_order_created',
        title: 'First Attempt',
        message: 'Original order message',
        actionLabel: 'Review Order',
        actionUrl: '/admin?tab=verifications',
        userId: 'usr_order_1',
      });

      const second = await createAdminNotification({
        eventKey: 'order_created_ord_duplicate_check',
        type: 'premium_order_created',
        title: 'Second Attempt With Modified Title',
        message: 'Should be ignored because eventKey already exists',
        actionLabel: 'Review Order',
        actionUrl: '/admin?tab=verifications',
        userId: 'usr_order_1',
      });

      assert.strictEqual(first.id, second.id);
      assert.strictEqual(second.title, 'First Attempt');
      assert.strictEqual(second.message, 'Original order message');

      const colData = firestoreStore.getCollectionData(ADMIN_NOTIFICATIONS_COLLECTION);
      assert.strictEqual(colData.size, 1);
    });

    it('assigns critical priority to duplicate UTR collisions and account suspensions', async () => {
      const collision = await createAdminNotification({
        eventKey: 'collision_utr_9999',
        type: 'duplicate_utr_detected',
        title: 'Duplicate UTR collision detected',
        message: 'Collision on UTR 9999',
        actionLabel: 'Investigate',
        actionUrl: '/admin?tab=verifications',
        userId: 'usr_1',
      });
      assert.strictEqual(collision.priority, 'critical');

      const suspension = await createAdminNotification({
        eventKey: 'account_suspended_usr_2',
        type: 'account_suspended',
        title: 'Account suspended',
        message: 'Suspended for abuse',
        actionLabel: 'View Account',
        actionUrl: '/admin?tab=users',
        userId: 'usr_2',
      });
      assert.strictEqual(suspension.priority, 'critical');
    });
  });

  describe('2. Notification Lifecycle Transitions (UNREAD -> READ -> ACKNOWLEDGED -> RESOLVED)', () => {
    it('accurately advances lifecycle through read, acknowledged, and resolved with timestamps', async () => {
      const notif = await createAdminNotification({
        eventKey: 'lifecycle_test_item',
        type: 'payment_submitted',
        title: 'Test Lifecycle',
        message: 'Testing state transitions',
        actionLabel: 'Review',
        actionUrl: '/admin',
        userId: 'usr_life',
      });

      assert.strictEqual(notif.status, 'unread');

      // 1. Mark Read
      const readResult = await markAdminNotification(notif.id, 'read');
      assert.ok(readResult);
      assert.strictEqual(readResult.status, 'read');
      assert.ok(readResult.readAt);
      assert.strictEqual(readResult.acknowledgedAt, null);
      assert.strictEqual(readResult.resolvedAt, null);

      // 2. Mark Acknowledged
      const ackResult = await markAdminNotification(notif.id, 'acknowledged');
      assert.ok(ackResult);
      assert.strictEqual(ackResult.status, 'acknowledged');
      assert.ok(ackResult.acknowledgedAt);
      assert.strictEqual(ackResult.resolvedAt, null);

      // 3. Mark Resolved
      const resolveResult = await markAdminNotification(notif.id, 'resolved', ADMIN_NOTIFICATION_EMAIL);
      assert.ok(resolveResult);
      assert.strictEqual(resolveResult.status, 'resolved');
      assert.ok(resolveResult.resolvedAt);
      assert.strictEqual(resolveResult.resolvedBy, ADMIN_NOTIFICATION_EMAIL);
    });

    it('supports bulk markAllAdminNotificationsRead for unread items', async () => {
      await createAdminNotification({
        eventKey: 'bulk_1',
        type: 'premium_order_created',
        title: 'Bulk 1',
        message: 'Msg 1',
        actionLabel: 'View',
        actionUrl: '/admin',
        userId: 'usr_1',
      });
      await createAdminNotification({
        eventKey: 'bulk_2',
        type: 'premium_order_created',
        title: 'Bulk 2',
        message: 'Msg 2',
        actionLabel: 'View',
        actionUrl: '/admin',
        userId: 'usr_2',
      });

      const updatedCount = await markAllAdminNotificationsRead(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(updatedCount, 2);

      const listing = await listAdminNotifications({ unreadOnly: true });
      assert.strictEqual(listing.totalUnread, 0);
      assert.strictEqual(listing.notifications.length, 0);
    });
  });

  describe('3. Filtering, Ordering, and Cursor Pagination', () => {
    it('filters by status and priority, and supports cursor pagination', async () => {
      // Create 3 items with distinct timestamps
      await createAdminNotification({
        eventKey: 'page_item_1',
        type: 'premium_order_created',
        priority: 'normal',
        title: 'Order 1',
        message: 'M1',
        actionLabel: 'A',
        actionUrl: '/',
        userId: 'u1',
      });
      await createAdminNotification({
        eventKey: 'page_item_2',
        type: 'payment_submitted',
        priority: 'high',
        title: 'Payment 2',
        message: 'M2',
        actionLabel: 'A',
        actionUrl: '/',
        userId: 'u2',
      });
      await createAdminNotification({
        eventKey: 'page_item_3',
        type: 'duplicate_utr_detected',
        priority: 'critical',
        title: 'Collision 3',
        message: 'M3',
        actionLabel: 'A',
        actionUrl: '/',
        userId: 'u3',
      });

      // Filter by priority
      const criticals = await listAdminNotifications({ priority: 'critical' });
      assert.strictEqual(criticals.notifications.length, 1);
      assert.strictEqual(criticals.notifications[0].id, generateNotificationId('page_item_3'));

      // Pagination with limit = 2
      const page1 = await listAdminNotifications({ limit: 2 });
      assert.strictEqual(page1.notifications.length, 2);
      assert.ok(page1.nextCursor);
    });
  });

  describe('4. Administrative API Route Security & Authorization Guards', () => {
    it('denies unauthenticated requests on GET /api/admin/notifications with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/notifications');
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it('denies non-admin authenticated users on GET /api/admin/notifications with 403', async () => {
      const req = createUnauthorizedUserRequest('/api/admin/notifications');
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 403);
    });

    it('authorizes allowlisted admin on GET /api/admin/notifications with 200 and unreadCount', async () => {
      await createAdminNotification({
        eventKey: 'api_test_item',
        type: 'payment_submitted',
        title: 'Test Via API',
        message: 'Testing API retrieval',
        actionLabel: 'Verify',
        actionUrl: '/admin',
        userId: 'u_api',
      });

      const req = createAuthorizedAdminRequest('/api/admin/notifications');
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.unreadCount, 1);
      assert.strictEqual(data.notifications.length, 1);
    });

    it('handles PATCH /api/admin/notifications for acknowledge and mark_all_read', async () => {
      const notif = await createAdminNotification({
        eventKey: 'patch_test_item',
        type: 'payment_submitted',
        title: 'Patch Test',
        message: 'Testing PATCH API',
        actionLabel: 'Verify',
        actionUrl: '/admin',
        userId: 'u_patch',
      });

      // Acknowledge
      const ackReq = createAuthorizedAdminRequest('/api/admin/notifications', {
        method: 'PATCH',
        body: { id: notif.id, action: 'acknowledged' },
      });
      const ackRes = await patchNotificationsRoute(ackReq);
      assert.strictEqual(ackRes.status, 200);
      const ackData = await ackRes.json();
      assert.strictEqual(ackData.success, true);
      assert.strictEqual(ackData.notification.status, 'acknowledged');

      // Mark all read
      const bulkReq = createAuthorizedAdminRequest('/api/admin/notifications', {
        method: 'PATCH',
        body: { action: 'mark_all_read' },
      });
      const bulkRes = await patchNotificationsRoute(bulkReq);
      assert.strictEqual(bulkRes.status, 200);
      const bulkData = await bulkRes.json();
      assert.strictEqual(bulkData.success, true);
    });
  });

  describe('5. Real-Time SSE Stream Route Security & Heartbeat', () => {
    it('denies unauthenticated requests on GET /api/admin/notifications/stream with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/notifications/stream');
      const res = await getStreamRoute(req);
      assert.strictEqual(res.status, 401);
    });

    it('denies non-admin users on GET /api/admin/notifications/stream with 403', async () => {
      const req = createUnauthorizedUserRequest('/api/admin/notifications/stream');
      const res = await getStreamRoute(req);
      assert.strictEqual(res.status, 403);
    });

    it('serves text/event-stream headers to authorized designated admin', async () => {
      const controller = new AbortController();
      const req = createAuthorizedAdminRequest('/api/admin/notifications/stream', { signal: controller.signal });
      const res = await getStreamRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');
      assert.strictEqual(res.headers.get('connection'), 'keep-alive');
      controller.abort();
      if (res.body) {
        await res.body.cancel();
      }
    });
  });

  describe('6. Admin Notification Preferences Management', () => {
    it('loads defaults and updates preferences safely in Firestore', async () => {
      const defaultPrefs = await getAdminNotificationPreferences(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(defaultPrefs.voiceEnabled, false);
      assert.strictEqual(defaultPrefs.voiceVerbosity, 'brief');
      assert.strictEqual(defaultPrefs.soundEnabled, true);

      const updated = await updateAdminNotificationPreferences(
        { voiceEnabled: true, voiceVerbosity: 'detailed', quietMode: true },
        ADMIN_NOTIFICATION_EMAIL
      );
      assert.strictEqual(updated.voiceEnabled, true);
      assert.strictEqual(updated.voiceVerbosity, 'detailed');
      assert.strictEqual(updated.quietMode, true);

      // Verify GET /api/admin/notifications/preferences
      const getReq = createAuthorizedAdminRequest('/api/admin/notifications/preferences');
      const getRes = await getPreferencesRoute(getReq);
      assert.strictEqual(getRes.status, 200);
      const getData = await getRes.json();
      assert.strictEqual(getData.preferences.voiceEnabled, true);
      assert.strictEqual(getData.preferences.voiceVerbosity, 'detailed');

      // Verify POST /api/admin/notifications/preferences
      const postReq = createAuthorizedAdminRequest('/api/admin/notifications/preferences', {
        method: 'POST',
        body: { quietMode: false, volume: 0.9 },
      });
      const postRes = await postPreferencesRoute(postReq);
      assert.strictEqual(postRes.status, 200);
      const postData = await postRes.json();
      assert.strictEqual(postData.preferences.quietMode, false);
      assert.strictEqual(postData.preferences.volume, 0.9);
    });
  });

  describe('7. Voice Announcement Text & Privacy Invariants', () => {
    it('generates concise, non-disruptive announcements without leaking internal secrets or IDs', () => {
      const samplePaymentNotif = {
        id: 'payment_submitted_subm_987654',
        recipientEmail: ADMIN_NOTIFICATION_EMAIL,
        type: 'payment_submitted' as AdminNotificationType,
        title: 'Premium payment submitted',
        message: 'A candidate submitted a ₹349 payment reference.',
        priority: 'high' as const,
        status: 'unread' as const,
        actionLabel: 'Verify Payment',
        actionUrl: '/admin?tab=verifications',
        userId: 'usr_sec_101',
        userEmail: 'alice@example.com',
        createdAt: new Date().toISOString(),
      };

      // Brief
      const briefVoice = generateVoiceAnnouncement(samplePaymentNotif, 'brief');
      assert.strictEqual(briefVoice, 'New payment submitted. Verification is required.');

      // Detailed
      const detailedVoice = generateVoiceAnnouncement(samplePaymentNotif, 'detailed');
      assert.strictEqual(
        detailedVoice,
        'New payment submitted by alice@example.com. Verification is required.'
      );

      // Ensure secret / internal IDs are never included in spoken announcement
      assert.ok(!briefVoice.includes('subm_987654'));
      assert.ok(!briefVoice.includes('usr_sec_101'));
      assert.ok(!detailedVoice.includes('subm_987654'));
      assert.ok(!detailedVoice.includes('usr_sec_101'));
    });

    it('generates security alert speech for account suspensions and UTR collisions', () => {
      const collisionNotif = {
        id: 'col_1',
        recipientEmail: ADMIN_NOTIFICATION_EMAIL,
        type: 'duplicate_utr_detected' as AdminNotificationType,
        title: 'Duplicate UTR collision detected',
        message: 'Collision details',
        priority: 'critical' as const,
        status: 'unread' as const,
        actionLabel: 'Investigate',
        actionUrl: '/admin',
        userId: 'u_1',
        createdAt: new Date().toISOString(),
      };
      const collisionSpeech = generateVoiceAnnouncement(collisionNotif, 'brief');
      assert.strictEqual(
        collisionSpeech,
        'Security warning. Duplicate UPI transaction reference detected. Investigation is required.'
      );

      const suspensionNotif = {
        id: 'susp_1',
        recipientEmail: ADMIN_NOTIFICATION_EMAIL,
        type: 'account_suspended' as AdminNotificationType,
        title: 'Account suspended',
        message: 'Suspended',
        priority: 'critical' as const,
        status: 'unread' as const,
        actionLabel: 'View Account',
        actionUrl: '/admin',
        userId: 'u_2',
        createdAt: new Date().toISOString(),
      };
      const suspensionSpeech = generateVoiceAnnouncement(suspensionNotif, 'brief');
      assert.strictEqual(suspensionSpeech, 'Security alert. User account suspended.');
    });
  });

  describe('8. Durable Notification Recovery & Sweep Reconciler', () => {
    it('creates notification and leaves no failure records upon successful creation', async () => {
      const doc = await createAdminNotificationWithRecovery({
        eventKey: 'recovery_success_test_1',
        type: 'payment_submitted',
        title: 'Recovery Success Test',
        message: 'Normal creation succeeds without failure record',
        actionLabel: 'Verify',
        actionUrl: '/admin?tab=verifications',
        userId: 'usr_rec_1',
      });

      assert.strictEqual(doc.success, true);
      assert.ok(doc.document);
      assert.strictEqual(doc.document.eventKey, 'recovery_success_test_1');

      const failureCol = firestoreStore.getCollectionData(ADMIN_NOTIFICATION_FAILURES_COLLECTION);
      assert.strictEqual(failureCol.size, 0);
    });

    it('sweeps and recovers pending or exhausted failures via reconcilePendingNotificationFailures', async () => {
      // Seed a failed notification record in admin_notification_failures
      const eventKey = 'failed_pending_event_123';
      const failureDocRef = firestoreStore.getCollectionData(ADMIN_NOTIFICATION_FAILURES_COLLECTION);
      failureDocRef.set(`fail_${eventKey}`, {
        id: `fail_${eventKey}`,
        eventKey,
        input: {
          eventKey,
          type: 'payment_submitted',
          title: 'Swept Payment Notification',
          message: 'Payment recovered via reconciler sweep',
          actionLabel: 'Verify Payment',
          actionUrl: '/admin?tab=verifications',
          userId: 'usr_swept_1',
        },
        attempts: 3,
        lastAttemptAt: new Date().toISOString(),
        lastError: 'Mock connection timeout',
        status: 'pending_recovery',
        createdAt: new Date().toISOString(),
      });

      // Execute sweep reconciliation
      const result = await reconcilePendingNotificationFailures();
      assert.strictEqual(result.reconciledCount, 1);
      assert.strictEqual(result.exhaustedCount, 0);

      // Verify the notification was durably created in admin_notifications
      const createdNotif = await listAdminNotifications({ limit: 10 });
      const found = createdNotif.notifications.find((n) => n.eventKey === eventKey);
      assert.ok(found);
      assert.strictEqual(found.title, 'Swept Payment Notification');

      // Verify the failure record is marked 'recovered'
      const updatedFailure = failureDocRef.get(`fail_${eventKey}`) as { status: string; recoveredAt: string };
      assert.strictEqual(updatedFailure.status, 'recovered');
      assert.ok(updatedFailure.recoveredAt);
    });
  });

  describe('9. Stable Compound Cursor Pagination Invariants', () => {
    it('serializes and parses compound cursors correctly', () => {
      const cursor = serializeCompoundCursor('2026-11-04T12:00:00.000Z', 'notif_abc123');
      assert.strictEqual(cursor, '2026-11-04T12:00:00.000Z__notif_abc123');

      const parsed = parseCompoundCursor(cursor);
      assert.ok(parsed);
      assert.strictEqual(parsed.createdAt, '2026-11-04T12:00:00.000Z');
      assert.strictEqual(parsed.id, 'notif_abc123');

      assert.strictEqual(parseCompoundCursor(null), null);
      assert.strictEqual(parseCompoundCursor(''), null);
      assert.strictEqual(parseCompoundCursor('invalid_cursor_without_separator'), null);
    });

    it('paginates deterministically without skipping or duplicating items with identical timestamps', async () => {
      const fixedTimestamp = '2026-11-04T10:00:00.000Z';
      const col = firestoreStore.getCollectionData(ADMIN_NOTIFICATIONS_COLLECTION);

      // Directly insert 4 items with the identical createdAt timestamp but distinct IDs
      for (const idx of [1, 2, 3, 4]) {
        const id = `notif_fixed_${idx}`;
        col.set(id, {
          id,
          eventKey: `event_fixed_${idx}`,
          recipientEmail: ADMIN_NOTIFICATION_EMAIL,
          type: 'payment_submitted',
          priority: 'normal',
          status: 'unread',
          title: `Fixed Item ${idx}`,
          message: `Testing compound pagination ${idx}`,
          actionLabel: 'Verify',
          actionUrl: '/admin?tab=verifications',
          createdAt: fixedTimestamp,
          readAt: null,
          acknowledgedAt: null,
          resolvedAt: null,
        });
      }

      // Page 1: limit = 2
      const page1 = await listAdminNotifications({ limit: 2 });
      assert.strictEqual(page1.notifications.length, 2);
      assert.ok(page1.nextCursor);

      // Page 2: query using page1.nextCursor
      const page2 = await listAdminNotifications({ limit: 2, cursor: page1.nextCursor });
      assert.strictEqual(page2.notifications.length, 2);

      // Ensure no intersection between page 1 and page 2 IDs
      const page1Ids = new Set(page1.notifications.map((n) => n.id));
      for (const n of page2.notifications) {
        assert.ok(!page1Ids.has(n.id), `ID ${n.id} was duplicated across pages`);
      }

      // Total distinct retrieved items must be 4
      const allIds = new Set([...page1.notifications.map((n) => n.id), ...page2.notifications.map((n) => n.id)]);
      assert.strictEqual(allIds.size, 4);
    });
  });

  describe('10. Strict Action URL Sanitization Guard', () => {
    it('accepts legitimate admin routes and query strings', () => {
      assert.strictEqual(isValidAdminActionUrl('/admin'), true);
      assert.strictEqual(isValidAdminActionUrl('/admin?tab=verifications'), true);
      assert.strictEqual(isValidAdminActionUrl('/admin?tab=subscriptions'), true);
      assert.strictEqual(isValidAdminActionUrl('/admin?tab=users'), true);
      assert.strictEqual(isValidAdminActionUrl('/admin?tab=ledger'), true);
      assert.strictEqual(isValidAdminActionUrl('/admin?tab=verifications&submissionId=sub_123'), true);
      assert.strictEqual(isValidAdminActionUrl('/admin?tab=users&userId=usr_abc_456'), true);
    });

    it('rejects untrusted protocols, external redirects, and malicious schemes', () => {
      assert.strictEqual(isValidAdminActionUrl(null), false);
      assert.strictEqual(isValidAdminActionUrl(undefined), false);
      assert.strictEqual(isValidAdminActionUrl(''), false);
      assert.strictEqual(isValidAdminActionUrl('javascript:alert(document.cookie)'), false);
      assert.strictEqual(isValidAdminActionUrl('https://evil-phishing-domain.com/login'), false);
      assert.strictEqual(isValidAdminActionUrl('//evil.com/admin'), false);
      assert.strictEqual(isValidAdminActionUrl('data:text/html,<script>alert(1)</script>'), false);
      assert.strictEqual(isValidAdminActionUrl('/malicious/external/path'), false);
    });
  });

  describe('11. In-Memory Voice Announcement Queue & Critical Preemption', () => {
    it('manages sequential announcements, deduplicates IDs, and preempts for critical alerts', () => {
      const queue = new VoiceAnnouncementQueue();

      // Deduplication check
      assert.strictEqual(queue.hasAnnounced('notif_100'), false);

      // In Node environment without window.speechSynthesis, enqueue gracefully bounds and tracks announced IDs
      // Set mock window with speech synthesis
      const originalWindow = (global as unknown as { window?: unknown }).window;
      const originalUtterance = (global as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
      let spokenCount = 0;
      let cancelledCount = 0;

      class MockSpeechSynthesisUtterance {
        text: string;
        volume: number = 1;
        rate: number = 1;
        pitch: number = 1;
        onend?: () => void;
        onerror?: () => void;
        constructor(text: string) {
          this.text = text;
        }
      }

      (global as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
      (global as unknown as { window: unknown }).window = {
        SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
        speechSynthesis: {
          speak: (utterance: { onend?: () => void }) => {
            spokenCount++;
            setTimeout(() => {
              if (utterance.onend) utterance.onend();
            }, 100);
          },
          cancel: () => {
            cancelledCount++;
          },
        },
      };

      try {
        queue.enqueue({
          id: 'notif_100',
          text: 'First normal announcement',
          priority: 'normal',
          volume: 0.8,
        });

        assert.strictEqual(queue.hasAnnounced('notif_100'), true);

        // Attempting to enqueue duplicate ID should be ignored
        queue.enqueue({
          id: 'notif_100',
          text: 'First normal announcement again',
          priority: 'normal',
          volume: 0.8,
        });

        // Enqueue high priority
        queue.enqueue({
          id: 'notif_200',
          text: 'High priority announcement',
          priority: 'high',
          volume: 0.8,
        });

        // Enqueue critical priority (triggers cancel of current speech to preempt immediately)
        queue.enqueue({
          id: 'notif_300',
          text: 'Critical priority announcement',
          priority: 'critical',
          volume: 1.0,
        });

        assert.ok(cancelledCount >= 1, 'Critical priority should cleanly preempt lower priority in-flight speech');
        assert.strictEqual(queue.hasAnnounced('notif_300'), true);

        // Clear queue
        queue.clear();
        assert.strictEqual(queue.getQueueLength(), 0);
      } finally {
        (global as unknown as { window?: unknown }).window = originalWindow;
        (global as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance;
      }
    });
  });

  describe('12. Preferences Validation & Authorization Invariants', () => {
    it('rejects invalid preference payloads with 400 status', async () => {
      const badReq = createAuthorizedAdminRequest('/api/admin/notifications/preferences', {
        method: 'POST',
        body: { volume: 'not-a-number' },
      });
      const res = await postPreferencesRoute(badReq);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('volume must be a number'));

      const badVerbosityReq = createAuthorizedAdminRequest('/api/admin/notifications/preferences', {
        method: 'POST',
        body: { voiceVerbosity: 'super-chatty' },
      });
      const verbRes = await postPreferencesRoute(badVerbosityReq);
      assert.strictEqual(verbRes.status, 400);
    });

    it('accepts and clamps valid volume within range [0, 1]', async () => {
      const req = createAuthorizedAdminRequest('/api/admin/notifications/preferences', {
        method: 'POST',
        body: { volume: 1.5 }, // Exceeds 1.0
      });
      const res = await postPreferencesRoute(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.preferences.volume, 1.0); // Clamped to 1.0
    });
  });

  describe('13. Authoritative Unread Count Invariants', () => {
    it('returns exact count of unread items and accurately decrements upon state changes', async () => {
      // Create 5 unread items
      const ids: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const notif = await createAdminNotification({
          eventKey: `unread_test_count_${i}`,
          type: 'payment_submitted',
          title: `Item ${i}`,
          message: `Msg ${i}`,
          actionLabel: 'Verify',
          actionUrl: '/admin',
          userId: `usr_${i}`,
        });
        ids.push(notif.id);
      }

      const initialCount = await getAdminUnreadNotificationCount(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(initialCount, 5);

      // Acknowledge 1 item -> unread status becomes 'acknowledged'
      await markAdminNotification(ids[0], 'acknowledged');
      const countAfterAck = await getAdminUnreadNotificationCount(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(countAfterAck, 4);

      // Resolve 1 item -> unread status becomes 'resolved'
      await markAdminNotification(ids[1], 'resolved');
      const countAfterResolve = await getAdminUnreadNotificationCount(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(countAfterResolve, 3);

      // Mark 1 item as read -> unread status becomes 'read'
      await markAdminNotification(ids[2], 'read');
      const countAfterRead = await getAdminUnreadNotificationCount(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(countAfterRead, 2);

      // Mark all read -> clears remaining 2
      await markAllAdminNotificationsRead(ADMIN_NOTIFICATION_EMAIL);
      const finalCount = await getAdminUnreadNotificationCount(ADMIN_NOTIFICATION_EMAIL);
      assert.strictEqual(finalCount, 0);
    });
  });
});
