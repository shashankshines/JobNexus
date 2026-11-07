'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAdminNotificationContext } from '@/modules/notifications/AdminNotificationContext';
import {
  AdminNotificationDocument,
  AdminNotificationPreferences,
} from '@/modules/notifications/notification.types';

interface BellProps {
  unreadCount?: number;
  items?: AdminNotificationDocument[];
  connected?: boolean;
  preferences?: AdminNotificationPreferences;
  onUpdatePreferences?: (partial: Partial<AdminNotificationPreferences>) => void;
  onOpenInbox?: () => void;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onAction?: (notification: AdminNotificationDocument) => void;
}

export function AdminNotificationBell(props: BellProps) {
  const context = useAdminNotificationContext();

  const unreadCount = props.unreadCount ?? context.unreadCount;
  const items = props.items ?? context.items;
  const connected = props.connected ?? context.connected;
  const preferences = props.preferences ?? context.preferences;
  const onUpdatePreferences = props.onUpdatePreferences ?? context.updatePreferences;
  const onOpenInbox = props.onOpenInbox ?? (() => context.setIsInboxOpen(true));
  const onMarkAsRead = props.onMarkAsRead ?? context.markAsRead;
  const onMarkAllAsRead = props.onMarkAllAsRead ?? context.markAllAsRead;
  const onAction = props.onAction ?? context.executeAction;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const recentItems = items.slice(0, 5);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Admin notifications, ${unreadCount} unread`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 10,
          background: isOpen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          color: unreadCount > 0 ? '#818cf8' : 'var(--text-secondary, #cbd5e1)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--header-bg, #0f172a)',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
              animation: 'adminBadgePulse 2s infinite ease-in-out',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notification quick panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--dropdown-bg, var(--surface-solid, #1e293b))',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'adminDropdownSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: '0.88rem' }}>Notifications</strong>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: unreadCount > 0 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: unreadCount > 0 ? '#a5b4fc' : 'var(--text-tertiary, #94a3b8)',
                  fontWeight: 700,
                }}
              >
                {unreadCount} unread
              </span>
            </div>

            {/* Quick Controls: Voice & Quiet Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ voiceEnabled: !preferences.voiceEnabled })}
                title={preferences.voiceEnabled ? 'Voice announcements enabled (click to disable)' : 'Voice announcements disabled (click to enable)'}
                aria-label="Toggle voice notifications"
                style={{
                  background: preferences.voiceEnabled ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  borderRadius: 6,
                  padding: '4px 6px',
                  color: preferences.voiceEnabled ? '#818cf8' : 'var(--text-tertiary, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {preferences.voiceEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ quietMode: !preferences.quietMode })}
                title={preferences.quietMode ? 'Quiet Mode ON (click to un-mute)' : 'Quiet Mode OFF (click to mute)'}
                aria-label="Toggle quiet mode"
                style={{
                  background: preferences.quietMode ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  borderRadius: 6,
                  padding: '4px 6px',
                  color: preferences.quietMode ? '#ef4444' : 'var(--text-tertiary, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {preferences.quietMode ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>

          {/* Connection Banner */}
          <div
            style={{
              padding: '6px 14px',
              fontSize: '0.68rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: connected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              color: connected ? '#10b981' : '#f59e0b',
              borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? 'Real-Time Stream Active' : 'Fallback Polling Active'}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary, #94a3b8)',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Quick List */}
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {recentItems.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary, #94a3b8)', fontSize: '0.8rem' }}>
                No notifications in inbox.
              </div>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))',
                    background: item.status === 'unread' ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {item.status === 'unread' && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#818cf8',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: item.status === 'unread' ? 700 : 500,
                          color: 'var(--text-primary, #f8fafc)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary, #94a3b8)', flexShrink: 0 }}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.74rem',
                      color: 'var(--text-secondary, #cbd5e1)',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.message}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    {item.status === 'unread' && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-tertiary, #94a3b8)',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        Mark read
                      </button>
                    )}
                    {item.actionLabel && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onAction(item);
                        }}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: 6,
                          padding: '3px 8px',
                          color: '#a5b4fc',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{item.actionLabel}</span>
                        <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              background: 'rgba(255, 255, 255, 0.02)',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenInbox();
              }}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open Full Notification Center
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
