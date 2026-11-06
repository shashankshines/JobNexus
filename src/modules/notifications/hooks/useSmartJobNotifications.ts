'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SmartJobNotification } from '../domain/smart-notification.types';

const SESSION_STORAGE_SEEN_KEY = 'jobnexus_seen_notif_ids';
const POLLING_INTERVAL_MS = 30000; // 30s polling when active

export function useSmartJobNotifications(isAuthenticated: boolean) {
  const [notifications, setNotifications] = useState<SmartJobNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<SmartJobNotification[] | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDoneRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize seen IDs from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_SEEN_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            seenIdsRef.current = new Set(parsed);
          }
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const saveSeenIds = useCallback((newIds: string[]) => {
    if (typeof window === 'undefined') return;
    newIds.forEach((id) => seenIdsRef.current.add(id));
    try {
      const arr = Array.from(seenIdsRef.current).slice(-200);
      sessionStorage.setItem(SESSION_STORAGE_SEEN_KEY, JSON.stringify(arr));
    } catch {
      // Storage quota or disabled fallback
    }
  }, []);

  const fetchNotifications = useCallback(
    async (isBackground = false) => {
      if (!isAuthenticated) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (!isBackground) {
        setIsLoading(true);
      }

      try {
        const res = await fetch('/api/notifications?limit=25', {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (res.status === 401) {
          setNotifications([]);
          setUnreadCount(0);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          const items: SmartJobNotification[] = data.notifications || [];
          setNotifications(items);
          setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);

          // Detect genuinely new unread notifications that haven't been toasted this browser session
          const unreadNew = items.filter(
            (n) => n.readStatus === 'UNREAD' && !seenIdsRef.current.has(n.notificationId)
          );

          if (unreadNew.length > 0) {
            // Save as seen so we don't toast them again on subsequent polls or page refresh
            saveSeenIds(unreadNew.map((n) => n.notificationId));

            // Only trigger toast if it's not the initial cold start or if there are new alerts
            // Show up to 3 newest jobs in the grouped toast
            setActiveToast(unreadNew.slice(0, 3));
          }
        }
      } catch (err) {
        console.warn('[useSmartJobNotifications] Polling error:', err);
      } finally {
        if (!isBackground) {
          setIsLoading(false);
        }
        initialFetchDoneRef.current = true;
      }
    },
    [isAuthenticated, saveSeenIds]
  );

  // Set up 30s polling when document is visible
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchNotifications(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    timerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuthenticated, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, readStatus: 'READ' } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read' }),
      });
    } catch (err) {
      console.warn('[useSmartJobNotifications] Failed to mark read:', err);
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.notificationId !== notificationId));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
    } catch (err) {
      console.warn('[useSmartJobNotifications] Failed to dismiss:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: 'READ' })));
    setUnreadCount(0);

    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[useSmartJobNotifications] Failed to mark all read:', err);
    }
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    activeToast,
    dismissToast,
    markAsRead,
    dismissNotification,
    markAllAsRead,
    refresh: () => fetchNotifications(false),
  };
}
