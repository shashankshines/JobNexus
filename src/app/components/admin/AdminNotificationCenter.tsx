'use client';

import React from 'react';
import {
  Bell,
  Check,
  ExternalLink,
  Mic,
  MicOff,
  RefreshCw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAdminNotificationContext } from '@/modules/notifications/AdminNotificationContext';

export function AdminNotificationCenter() {
  const {
    items,
    unreadCount,
    actionRequiredCount,
    loading,
    connected,
    error,
    preferences,
    updatePreferences,
    setIsInboxOpen,
    markAsRead,
    executeAction,
    refresh,
  } = useAdminNotificationContext();

  const displayItems = items.slice(0, 5);

  return (
    <section
      aria-labelledby="admin-notifications-title"
      style={{
        marginBottom: '1.5rem',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
        borderRadius: 16,
        padding: '1.2rem',
        background: 'var(--card-bg, #1e293b)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Bell size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 id="admin-notifications-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                Admin Notification Command Center
              </h2>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 7px',
                  borderRadius: 99,
                  background: connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: connected ? '#10b981' : '#f59e0b',
                  fontWeight: 700,
                }}
              >
                {connected ? 'REAL-TIME' : 'POLLING'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: 'var(--text-secondary, #94a3b8)', fontSize: '.78rem' }}>
              {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}
              {actionRequiredCount > 0 && ` · ${actionRequiredCount} requiring action`}
              {preferences.voiceEnabled && ' · Voice Alerts ON'}
              {preferences.quietMode && ' · (Quiet Mode)'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => updatePreferences({ voiceEnabled: !preferences.voiceEnabled })}
            title={preferences.voiceEnabled ? 'Disable Voice Alerts' : 'Enable Voice Alerts'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: 8,
              padding: '6px 10px',
              background: preferences.voiceEnabled ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: preferences.voiceEnabled ? '#818cf8' : 'var(--text-secondary, #cbd5e1)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            {preferences.voiceEnabled ? <Mic size={14} /> : <MicOff size={14} />}
            Voice {preferences.voiceEnabled ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            onClick={() => updatePreferences({ quietMode: !preferences.quietMode })}
            title={preferences.quietMode ? 'Turn Quiet Mode Off' : 'Turn Quiet Mode On'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: 8,
              padding: '6px 10px',
              background: preferences.quietMode ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: preferences.quietMode ? '#ef4444' : 'var(--text-secondary, #cbd5e1)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            {preferences.quietMode ? <VolumeX size={14} /> : <Volume2 size={14} />}
            Quiet {preferences.quietMode ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            onClick={() => setIsInboxOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 8,
              padding: '6px 12px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              fontSize: '0.78rem',
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            <Settings size={14} /> View All & Settings
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh notifications"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: 8,
              padding: '6px 10px',
              background: 'transparent',
              color: 'var(--text-primary, #f8fafc)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" style={{ color: 'var(--danger, #dc2626)', fontSize: '.85rem', marginTop: 10 }}>
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '.85rem', marginTop: 12 }}>
          Connecting to real-time notification stream…
        </p>
      ) : displayItems.length === 0 ? (
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '.85rem', margin: '12px 0 0' }}>
          No administrative notifications yet. System is actively listening for incoming events.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {displayItems.map((item) => (
            <article
              key={item.id}
              style={{
                border: item.status === 'unread'
                  ? '1px solid rgba(99, 102, 241, 0.3)'
                  : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: 12,
                padding: 12,
                background: item.status === 'unread'
                  ? 'rgba(99, 102, 241, 0.05)'
                  : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '.9rem' }}>{item.title}</strong>
                    {item.status === 'unread' && (
                      <span
                        style={{
                          fontSize: '.65rem',
                          borderRadius: 4,
                          padding: '1px 6px',
                          background: '#6366f1',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        NEW
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '.65rem',
                        borderRadius: 4,
                        padding: '1px 6px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        background:
                          item.status === 'resolved'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(255, 255, 255, 0.06)',
                        color:
                          item.status === 'resolved'
                            ? '#10b981'
                            : 'var(--text-tertiary, #94a3b8)',
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p style={{ margin: '5px 0', color: 'var(--text-secondary, #cbd5e1)', fontSize: '.82rem' }}>
                    {item.message}
                  </p>
                  {item.userEmail && (
                    <p style={{ margin: 0, fontSize: '.75rem', color: '#818cf8' }}>
                      User: {item.userEmail}
                    </p>
                  )}
                  <time
                    dateTime={item.createdAt}
                    style={{
                      display: 'block',
                      marginTop: 5,
                      fontSize: '.7rem',
                      color: 'var(--text-tertiary, #94a3b8)',
                    }}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {item.actionLabel && (
                    <button
                      type="button"
                      onClick={() => void executeAction(item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 8,
                        padding: '7px 11px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: '#fff',
                        border: 0,
                        fontSize: '.78rem',
                        fontWeight: 650,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {item.actionLabel} <ExternalLink size={13} />
                    </button>
                  )}
                  {item.status === 'unread' && (
                    <button
                      type="button"
                      onClick={() => void markAsRead(item.id)}
                      aria-label="Mark notification as read"
                      title="Mark as read"
                      style={{
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                        borderRadius: 8,
                        padding: '7px',
                        background: 'transparent',
                        color: 'var(--text-primary, #f8fafc)',
                        cursor: 'pointer',
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
