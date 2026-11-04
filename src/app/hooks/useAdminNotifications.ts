'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminNotificationDocument,
  AdminNotificationPreferences,
  AdminNotificationType,
  DEFAULT_NOTIFICATION_PREFERENCES,
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

export function speakNotificationText(
  text: string,
  options: { volume?: number } = {}
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = options.volume ?? 0.8;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis error ignored
  }
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

      // Voice Alert
      if (prefs.voiceEnabled && !prefs.quietMode) {
        const text = generateVoiceAnnouncement(notification, prefs.voiceVerbosity);
        speakNotificationText(text, { volume: prefs.volume });
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
        setUnreadCount(data.unreadCount ?? data.notifications.filter((n: AdminNotificationDocument) => n.status === 'unread').length);
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
            setUnreadCount(list.filter((i) => i.status === 'unread').length);
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
            setUnreadCount(list.filter((i) => i.status === 'unread').length);

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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'acknowledged', acknowledgedAt: now, readAt: item.readAt || now }
            : item
        )
      );
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'resolved',
                resolvedAt: now,
                readAt: item.readAt || now,
                actionedAt: now,
              }
            : item
        )
      );
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
      if (notification.actionUrl) {
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
