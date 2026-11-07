'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  Mic,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Volume2,
  X,
} from 'lucide-react';
import {
  AdminNotificationDocument,
  AdminNotificationPreferences,
  NotificationPriority,
  NotificationStatus,
} from '@/modules/notifications/notification.types';

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: AdminNotificationDocument[];
  unreadCount: number;
  loading: boolean;
  preferences: AdminNotificationPreferences;
  onUpdatePreferences: (partial: Partial<AdminNotificationPreferences>) => void;
  onMarkAsRead: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onMarkAllAsRead: () => void;
  onAction: (notification: AdminNotificationDocument) => void;
  onTestVoice: () => void;
  onTestSound: () => void;
  onRefresh: () => void;
}

type FilterTab = 'all' | 'unread' | 'action_required' | 'acknowledged' | 'resolved' | 'settings';

export function AdminNotificationInboxModal({
  isOpen,
  onClose,
  items,
  unreadCount,
  loading,
  preferences,
  onUpdatePreferences,
  onMarkAsRead,
  onAcknowledge,
  onResolve,
  onMarkAllAsRead,
  onAction,
  onTestVoice,
  onTestSound,
  onRefresh,
}: InboxModalProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter items
  const filteredItems = items.filter((item) => {
    // Tab filter
    if (activeTab === 'unread' && item.status !== 'unread') return false;
    if (
      activeTab === 'action_required' &&
      (item.status === 'resolved' || (item.priority !== 'high' && item.priority !== 'critical'))
    )
      return false;
    if (activeTab === 'acknowledged' && item.status !== 'acknowledged') return false;
    if (activeTab === 'resolved' && item.status !== 'resolved') return false;

    // Priority filter
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      const matchEmail = item.userEmail?.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q) || item.userId?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchEmail && !matchId) return false;
    }

    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbox-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'var(--modal-backdrop, rgba(0, 0, 0, 0.7))',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="admin-modal-card"
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          background: 'var(--modal-bg, var(--card-bg, #0f172a))',
          border: '1px solid var(--modal-border, var(--border))',
          borderRadius: 20,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'adminModalZoom 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Bell size={20} />
            </div>
            <div>
              <h2 id="inbox-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Admin Notification Center
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Persistent business events, real-time alerts & voice configuration
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh inbox"
              style={{
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 10px',
                color: 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 10px',
                color: 'var(--text-secondary, #cbd5e1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div
          style={{
            padding: '10px 24px 0',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'all', label: 'All', badge: items.length },
              { id: 'unread', label: 'Unread', badge: unreadCount },
              {
                id: 'action_required',
                label: 'Action Required',
                badge: items.filter((i) => i.status !== 'resolved' && (i.priority === 'high' || i.priority === 'critical')).length,
              },
              {
                id: 'acknowledged',
                label: 'Acknowledged',
                badge: items.filter((i) => i.status === 'acknowledged').length,
              },
              {
                id: 'resolved',
                label: 'Resolved',
                badge: items.filter((i) => i.status === 'resolved').length,
              },
              { id: 'settings', label: 'Voice & Sound Settings', icon: Settings },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as FilterTab)}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #818cf8' : '2px solid transparent',
                    background: 'transparent',
                    color: isActive ? '#818cf8' : 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.icon && <tab.icon size={13} />}
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                        color: isActive ? '#c7d2fe' : 'var(--text-tertiary, #94a3b8)',
                        fontWeight: 700,
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab !== 'settings' && unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 0',
                whiteSpace: 'nowrap',
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Body Content */}
        {activeTab === 'settings' ? (
          /* PREFERENCES SETTINGS PANEL */
          <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>
                Voice & Sound Notification Controls
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Configure browser-synthesized voice alerts and audio chimes for real-time administrative operations.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              {/* Voice Switch */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mic size={16} color={preferences.voiceEnabled ? '#818cf8' : '#94a3b8'} />
                    <span>Voice Announcements</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    Uses the browser SpeechSynthesis API to speak incoming administrative alerts aloud.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ voiceEnabled: !preferences.voiceEnabled })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: preferences.voiceEnabled ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {preferences.voiceEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Speech Verbosity */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Announcement Verbosity</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    Choose between concise headlines or expanded user context.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ voiceVerbosity: 'brief' })}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: preferences.voiceVerbosity === 'brief' ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    Brief
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences({ voiceVerbosity: 'detailed' })}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: preferences.voiceVerbosity === 'detailed' ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    Detailed
                  </button>
                </div>
              </div>

              {/* Sound Chime Switch */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Volume2 size={16} color={preferences.soundEnabled ? '#10b981' : '#94a3b8'} />
                    <span>Audio Chime</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    Plays a gentle synthesized two-tone chime when an alert arrives.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ soundEnabled: !preferences.soundEnabled })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: preferences.soundEnabled ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {preferences.soundEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Quiet Mode Switch */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Quiet Mode (Do Not Disturb)</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    Suppresses all voice alerts and audio chimes while keeping persistent notifications active in inbox.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ quietMode: !preferences.quietMode })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: preferences.quietMode ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {preferences.quietMode ? 'Quiet Mode ON' : 'Off'}
                </button>
              </div>

              {/* Priority-Only Alerts */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Priority-Only Alerts</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    Only trigger toasts, sound and voice for High and Critical events (e.g. pending UPI claims and collisions).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ priorityOnly: !preferences.priorityOnly })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: preferences.priorityOnly ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {preferences.priorityOnly ? 'Active' : 'Off'}
                </button>
              </div>

              {/* Test Audio & Speech Controls */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={onTestVoice}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    color: '#a5b4fc',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Mic size={15} />
                  Test Voice Speech
                </button>
                <button
                  type="button"
                  onClick={onTestSound}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#6ee7b7',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Volume2 size={15} />
                  Test Audio Chime
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* NOTIFICATION LIST VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Search & Priority Controls */}
            <div
              style={{
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                background: 'rgba(255, 255, 255, 0.01)',
                borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-tertiary, #94a3b8)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title, user email, ID..."
                  className="admin-form-input"
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={13} style={{ color: 'var(--text-tertiary, #94a3b8)' }} />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="admin-form-input"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: '0.78rem',
                  }}
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">Action Required (High)</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredItems.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary, #94a3b8)', fontSize: '0.85rem' }}>
                  No matching notifications found.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isUnread = item.status === 'unread';
                  const isCritical = item.priority === 'critical';
                  const isHigh = item.priority === 'high';

                  return (
                    <article
                      key={item.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        background: isUnread
                          ? 'rgba(99, 102, 241, 0.06)'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isCritical
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : isHigh
                          ? '1px solid rgba(245, 158, 11, 0.35)'
                          : isUnread
                          ? '1px solid rgba(99, 102, 241, 0.25)'
                          : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)' }}>
                              {item.title}
                            </strong>
                            {isUnread && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: '#6366f1',
                                  color: '#fff',
                                  fontWeight: 800,
                                }}
                              >
                                NEW
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                background:
                                  item.status === 'resolved'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : item.status === 'acknowledged'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(99, 102, 241, 0.15)',
                                color:
                                  item.status === 'resolved'
                                    ? '#10b981'
                                    : item.status === 'acknowledged'
                                    ? '#f59e0b'
                                    : '#818cf8',
                              }}
                            >
                              {item.status}
                            </span>
                          </div>

                          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.45 }}>
                            {item.message}
                          </p>

                          {item.userEmail && (
                            <div style={{ fontSize: '0.73rem', color: '#818cf8', marginTop: 4 }}>
                              User: {item.userEmail}
                            </div>
                          )}

                          <time style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-tertiary, #94a3b8)', marginTop: 4 }}>
                            {new Date(item.createdAt).toLocaleString()}
                          </time>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {item.actionLabel && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onAction(item);
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: '#fff',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span>{item.actionLabel}</span>
                              <ExternalLink size={12} />
                            </button>
                          )}

                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => onMarkAsRead(item.id)}
                              title="Mark as read"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 8,
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                                color: 'var(--text-secondary, #cbd5e1)',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Check size={12} />
                              Read
                            </button>
                          )}

                          {item.status !== 'acknowledged' && item.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => onAcknowledge(item.id)}
                              title="Acknowledge"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 8,
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                color: '#f59e0b',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Acknowledge
                            </button>
                          )}

                          {item.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => onResolve(item.id)}
                              title="Resolve"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 8,
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: '#10b981',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

