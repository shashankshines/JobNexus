'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminNotificationDocument,
  AdminNotificationPreferences,
  AdminNotificationType,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPriority,
  isValidAdminActionUrl,
} from '@/modules/notifications/notification.types';

export interface ToastItem {
  id: string;
  notification: AdminNotificationDocument;
  timeoutId?: NodeJS.Timeout;
}

export function playNativeNotificationChime(volume: number = 0.8): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Pleasant rising chime: 587.33 Hz (D5) -> 880 Hz (A5)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    const targetGain = Math.min(Math.max(volume * 0.15, 0.01), 0.3);
    gain.gain.setValueAtTime(targetGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
    setTimeout(() => {
      void ctx.close();
    }, 350);
  } catch {
    // AudioContext permission or browser policy failure handled gracefully
  }
}

export function generateVoiceAnnouncement(
  notification: AdminNotificationDocument,
  verbosity: 'brief' | 'detailed'
): string {
  const isDetailed = verbosity === 'detailed';
  const userIdentifier = notification.userEmail ? `from ${notification.userEmail}` : '';

  switch (notification.type as AdminNotificationType) {
    case 'payment_submitted':
      return isDetailed && notification.userEmail
        ? `New payment submitted by ${notification.userEmail}. Verification is required.`
        : 'New payment submitted. Verification is required.';
    case 'duplicate_utr_detected':
      return 'Security warning. Duplicate UPI transaction reference detected. Investigation is required.';
    case 'subscription_cancel_requested':
      return isDetailed && notification.userEmail
        ? `Cancellation request received from ${notification.userEmail}. Review is required.`
        : 'New cancellation request received. Review is required.';
    case 'premium_order_created':
      return isDetailed && notification.userEmail
        ? `New Premium order created by ${notification.userEmail}.`
        : 'New Premium payment order created.';
    case 'payment_approved':
      return isDetailed ? `Payment approved for ${userIdentifier}.` : 'Payment approved.';
    case 'payment_rejected':
      return 'Payment submission rejected.';
    case 'subscription_expiring':
      return 'Subscription expiring soon. Review is recommended.';
    case 'account_suspended':
      return 'Security alert. User account suspended.';
    case 'account_reinstated':
      return 'User account reinstated.';
    case 'subscription_suspended':
      return 'Subscription suspended.';
    case 'subscription_reinstated':
      return 'Subscription reinstated.';
    default:
      return `${notification.title}.`;
  }
}

export interface VoiceQueueItem {
  id: string;
  text: string;
  priority: NotificationPriority;
  volume: number;
}

export class VoiceAnnouncementQueue {
  private queue: VoiceQueueItem[] = [];
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private announcedIds = new Set<string>();
  private readonly maxQueueSize = 10;

  public enqueue(item: VoiceQueueItem): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.announcedIds.has(item.id)) return;
    this.announcedIds.add(item.id);

    // Keep bounded set of announced ids
    if (this.announcedIds.size > 200) {
      const arr = Array.from(this.announcedIds);
      this.announcedIds = new Set(arr.slice(arr.length - 100));
    }

    if (item.priority === 'critical') {
      // Preempt in-flight speech cleanly for critical alerts
      if (this.isSpeaking && this.currentUtterance) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        this.isSpeaking = false;
        this.currentUtterance = null;
      }
      this.queue.unshift(item);
    } else if (item.priority === 'high') {
      const insertIdx = this.queue.findIndex(
        (q) => q.priority === 'normal' || q.priority === 'low'
      );
      if (insertIdx !== -1) {
        this.queue.splice(insertIdx, 0, item);
      } else {
        this.queue.push(item);
      }
    } else {
      this.queue.push(item);
    }

    // Drop oldest non-critical if queue exceeds limit
    while (this.queue.length > this.maxQueueSize) {
      const dropIndex =
        this.queue.map((q) => q.priority).lastIndexOf('low') !== -1
          ? this.queue.map((q) => q.priority).lastIndexOf('low')
          : this.queue.map((q) => q.priority).lastIndexOf('normal');
      if (dropIndex !== -1) {
        this.queue.splice(dropIndex, 1);
      } else {
        break;
      }
    }

    this.processNext();
  }

  private processNext(): void {
    if (this.isSpeaking || this.queue.length === 0) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const nextItem = this.queue.shift();
    if (!nextItem) return;

    this.isSpeaking = true;
    try {
      const UtteranceCtor =
        typeof SpeechSynthesisUtterance !== 'undefined'
          ? SpeechSynthesisUtterance
          : (typeof window !== 'undefined' &&
              (window as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance })
                ?.SpeechSynthesisUtterance);

      if (!UtteranceCtor) {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.processNext();
        return;
      }

      const utterance = new UtteranceCtor(nextItem.text);
      utterance.volume = Math.max(0, Math.min(1, nextItem.volume ?? 0.8));
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      this.currentUtterance = utterance;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.processNext();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.processNext();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.processNext();
    }
  }

  public clear(): void {
    this.queue = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  public hasAnnounced(id: string): boolean {
    return this.announcedIds.has(id);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const voiceAnnouncementQueue = new VoiceAnnouncementQueue();

export function speakNotificationText(
  text: string,
  options: { volume?: number; priority?: NotificationPriority; id?: string } = {}
): void {
  voiceAnnouncementQueue.enqueue({
    id: options.id || `adhoc_${Date.now()}_${Math.random()}`,
    text,
    priority: options.priority || 'normal',
    volume: options.volume ?? 0.8,
  });
}

export function useAdminNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotificationDocument[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AdminNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);

  // References to keep callbacks and listeners stable
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;
  const initialLoadCompletedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Load preferences
  useEffect(() => {
    let isMounted = true;
    async function fetchPrefs() {
      try {
        const res = await fetch('/api/admin/notifications/preferences');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.preferences && isMounted) {
            setPreferences(data.preferences);
          }
        }
      } catch {
        // Fallback to localStorage if offline
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('jobnexus_admin_notif_prefs');
          if (stored && isMounted) {
            try {
              setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) });
            } catch {
              // ignore parse failure
            }
          }
        }
      }
    }
    void fetchPrefs();
    return () => {
      isMounted = false;
    };
  }, []);

  const updatePreferences = useCallback(
    async (partial: Partial<AdminNotificationPreferences>) => {
      const next = { ...prefsRef.current, ...partial };
      setPreferences(next);
      if (partial.quietMode === true || partial.voiceEnabled === false) {
        voiceAnnouncementQueue.clear();
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('jobnexus_admin_notif_prefs', JSON.stringify(next));
      }
      try {
        await fetch('/api/admin/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        });
      } catch (err) {
        console.error('[Admin Notifications] Preferences save failed:', err);
      }
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // Trigger alert effects (sound, toast, voice) for newly arrived items
  const handleNewNotification = useCallback(
    (notification: AdminNotificationDocument) => {
      const prefs = prefsRef.current;
      const isPriorityAlert =
        notification.priority === 'critical' || notification.priority === 'high';

      // If priority-only mode is active and this is normal/low priority, skip loud toast & sound
      if (prefs.priorityOnly && !isPriorityAlert) {
        return;
      }

      // Add to toast queue (at most 3 visible)
      const toastId = `${notification.id}_${Date.now()}`;
      const timeoutId = setTimeout(() => {
        dismissToast(toastId);
      }, 9_000);

      setActiveToasts((prev) => [
        { id: toastId, notification, timeoutId },
        ...prev.slice(0, 2),
      ]);

      // Sound Alert
      if (prefs.soundEnabled && !prefs.quietMode) {
        playNativeNotificationChime(prefs.volume);
      }

      // Voice Alert via sequential in-memory queue
      if (prefs.voiceEnabled && !prefs.quietMode) {
        const text = generateVoiceAnnouncement(notification, prefs.voiceVerbosity);
        voiceAnnouncementQueue.enqueue({
          id: notification.id,
          text,
          priority: notification.priority || 'normal',
          volume: prefs.volume,
        });
      }
    },
    [dismissToast]
  );

  // Poll fallback function
  const pollFallback = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=50', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setItems(data.notifications);
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        } else {
          setUnreadCount(data.notifications.filter((n: AdminNotificationDocument) => n.status === 'unread').length);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Setup Real-time SSE Stream
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      try {
        eventSource = new EventSource('/api/admin/notifications/stream');

        eventSource.onopen = () => {
          if (isCancelled) return;
          setConnected(true);
          setLoading(false);
          setError(null);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        // Initial snapshot
        eventSource.addEventListener('init', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            const list: AdminNotificationDocument[] = Array.isArray(data.items) ? data.items : [];
            setItems(list);
            if (typeof data.unreadCount === 'number') {
              setUnreadCount(data.unreadCount);
            } else {
              setUnreadCount(list.filter((i) => i.status === 'unread').length);
            }
            list.forEach((i) => seenIdsRef.current.add(i.id));
            initialLoadCompletedRef.current = true;
          } catch (parseErr) {
            console.error('[SSE init error]:', parseErr);
          }
        });

        // Sync updates
        eventSource.addEventListener('sync', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            const list: AdminNotificationDocument[] = Array.isArray(data.items) ? data.items : [];
            setItems(list);
            if (typeof data.unreadCount === 'number') {
              setUnreadCount(data.unreadCount);
            } else {
              setUnreadCount(list.filter((i) => i.status === 'unread').length);
            }

            // Announce newly added documents that haven't been seen yet
            const newItems: AdminNotificationDocument[] = Array.isArray(data.newItems)
              ? data.newItems
              : [];
            for (const item of newItems) {
              if (!seenIdsRef.current.has(item.id)) {
                seenIdsRef.current.add(item.id);
                if (initialLoadCompletedRef.current) {
                  handleNewNotification(item);
                }
              }
            }
          } catch (parseErr) {
            console.error('[SSE sync error]:', parseErr);
          }
        });

        // Structured error event handling
        eventSource.addEventListener('error', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            if (e.data) {
              const errData = JSON.parse(e.data);
              if (errData.code === 'SESSION_EXPIRED') {
                setError('Admin session expired. Please sign in again.');
                if (eventSource) {
                  eventSource.close();
                  eventSource = null;
                }
                setConnected(false);
                return;
              }
            }
          } catch {
            // ignore JSON parse
          }
        });

        eventSource.onerror = () => {
          if (isCancelled) return;
          setConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Start fallback polling while reconnecting
          if (!pollInterval) {
            void pollFallback();
            pollInterval = setInterval(() => {
              void pollFallback();
            }, 15_000);
          }
          // Exponential reconnect
          reconnectTimeout = setTimeout(connect, 5_000);
        };
      } catch {
        // SSE unavailable in this environment
        setConnected(false);
        void pollFallback();
        pollInterval = setInterval(() => {
          void pollFallback();
        }, 20_000);
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      voiceAnnouncementQueue.clear();
    };
  }, [handleNewNotification, pollFallback]);

  // Actions
  const markAsRead = useCallback(async (id: string) => {
    try {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'read', readAt: item.readAt || new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((c) => Math.max(c - 1, 0));
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'read' }),
      });
    } catch (err) {
      console.error('[Admin Notifications] markAsRead failed:', err);
    }
  }, []);

  const acknowledge = useCallback(async (id: string) => {
    try {
      const now = new Date().toISOString();
      let wasUnread = false;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            if (item.status === 'unread') wasUnread = true;
            return { ...item, status: 'acknowledged', acknowledgedAt: now, readAt: item.readAt || now };
          }
          return item;
        })
      );
      if (wasUnread) {
        setUnreadCount((c) => Math.max(c - 1, 0));
      }
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'acknowledged' }),
      });
    } catch (err) {
      console.error('[Admin Notifications] acknowledge failed:', err);
    }
  }, []);

  const resolve = useCallback(async (id: string) => {
    try {
      const now = new Date().toISOString();
      let wasUnread = false;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            if (item.status === 'unread') wasUnread = true;
            return {
              ...item,
              status: 'resolved',
              resolvedAt: now,
              readAt: item.readAt || now,
              actionedAt: now,
            };
          }
          return item;
        })
      );
      if (wasUnread) {
        setUnreadCount((c) => Math.max(c - 1, 0));
      }
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'resolved' }),
      });
    } catch (err) {
      console.error('[Admin Notifications] resolve failed:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((item) =>
          item.status === 'unread'
            ? { ...item, status: 'read', readAt: item.readAt || now }
            : item
        )
      );
      setUnreadCount(0);
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
    } catch (err) {
      console.error('[Admin Notifications] markAllAsRead failed:', err);
    }
  }, []);

  const executeAction = useCallback(
    async (notification: AdminNotificationDocument) => {
      void markAsRead(notification.id);
      if (notification.actionUrl && isValidAdminActionUrl(notification.actionUrl)) {
        router.push(notification.actionUrl);
      }
    },
    [markAsRead, router]
  );

  const testVoice = useCallback(() => {
    const text = 'This is a voice alert verification test for JobNexus Admin.';
    speakNotificationText(text, { volume: prefsRef.current.volume });
  }, []);

  const testSound = useCallback(() => {
    playNativeNotificationChime(prefsRef.current.volume);
  }, []);

  return {
    items,
    unreadCount,
    actionRequiredCount: items.filter(
      (i) => (i.status === 'unread' || i.status === 'acknowledged') && (i.priority === 'high' || i.priority === 'critical')
    ).length,
    loading,
    connected,
    error,
    preferences,
    updatePreferences,
    activeToasts,
    dismissToast,
    isInboxOpen,
    setIsInboxOpen,
    markAsRead,
    acknowledge,
    resolve,
    markAllAsRead,
    executeAction,
    testVoice,
    testSound,
    refresh: pollFallback,
  };
}

