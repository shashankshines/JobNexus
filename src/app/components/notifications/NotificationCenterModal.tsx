'use client';

import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Sliders,
  ExternalLink,
  Briefcase,
  MapPin,
  Clock,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { SmartJobNotification } from '@/modules/notifications/domain/smart-notification.types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SmartJobNotification[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onDismissNotification: (notificationId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onOpenSettings: () => void;
  onSelectJob?: (jobId: string) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onDismissNotification,
  onMarkAllAsRead,
  onOpenSettings,
  onSelectJob,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return n.readStatus === 'UNREAD';
    return true;
  });

  const formatTimestamp = (iso: string) => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notification Center"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--modal-backdrop, rgba(0, 0, 0, 0.72))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel notification-modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--hero-badge-bg)',
                border: '1px solid var(--hero-badge-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Job Match Notifications
                </h3>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: 'var(--badge-sky-bg)',
                      color: 'var(--badge-sky-text)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: '1px solid var(--badge-sky-border)',
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Direct ATS alerts matching your personalized saved criteria
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onOpenSettings}
              title="Alert Preferences & Schedule"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <Sliders size={14} color="var(--primary)" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
              }}
              aria-label="Close Notification Center"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter & Bulk Actions Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.8rem',
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                background: filter === 'all' ? 'var(--hero-badge-bg)' : 'transparent',
                border: filter === 'all' ? '1px solid var(--hero-badge-border)' : '1px solid transparent',
                color: filter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.78rem',
              }}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              style={{
                background: filter === 'unread' ? 'var(--hero-badge-bg)' : 'transparent',
                border: filter === 'unread' ? '1px solid var(--hero-badge-border)' : '1px solid transparent',
                color: filter === 'unread' ? 'var(--primary)' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.78rem',
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 500,
              }}
            >
              <CheckCheck size={14} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* Notifications Scrollable List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={22} color="var(--text-secondary)" />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {filter === 'unread' ? 'No unread notifications' : 'No job matches yet'}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', maxWidth: '320px', lineHeight: 1.5 }}>
                {filter === 'unread'
                  ? 'You are all caught up! Switch to All to see past notifications.'
                  : 'Genuinely new opportunities matching your saved alert preferences will appear here as soon as employers publish them.'}
              </p>
              {filter !== 'unread' && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  style={{
                    marginTop: '0.5rem',
                    background: 'linear-gradient(135deg, var(--primary-start), var(--primary-end))',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Configure Job Alerts
                </button>
              )}
            </div>
          ) : (
            filtered.map((item) => {
              const isUnread = item.readStatus === 'UNREAD';
              return (
                <div
                  key={item.notificationId}
                  className={`notification-item-card ${isUnread ? 'is-unread' : ''}`}
                  style={{
                    background: isUnread ? 'var(--surface-hover)' : 'var(--surface)',
                    border: isUnread
                      ? '1px solid var(--border-focus)'
                      : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Top: Title & Tags */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '2px' }}>
                        {isUnread && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: 'var(--primary)',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                            title="Unread"
                          />
                        )}
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={item.jobTitle}
                        >
                          {item.jobTitle}
                        </h4>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          fontSize: '0.8rem',
                          color: 'var(--primary)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                          <Briefcase size={13} />
                          {item.jobCompany}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                          <MapPin size={13} />
                          {item.jobLocation}
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <Clock size={11} />
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>

                  {/* Matching Alert Tags */}
                  {item.matchingAlertNames && item.matchingAlertNames.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '2px' }}>
                      {item.matchingAlertNames.map((name, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'var(--hero-badge-bg)',
                            color: 'var(--hero-badge-text)',
                            border: '1px solid var(--hero-badge-border)',
                          }}
                        >
                          Matched: {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '0.35rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {item.jobUrl && (
                        <a
                          href={item.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (isUnread) onMarkAsRead(item.notificationId);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'linear-gradient(135deg, var(--primary-start), var(--primary-end))',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                          }}
                        >
                          <span>Apply Directly</span>
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {onSelectJob && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isUnread) onMarkAsRead(item.notificationId);
                            onSelectJob(item.canonicalJobId);
                            onClose();
                          }}
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            padding: '4px 9px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          View in Nexus
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => onMarkAsRead(item.notificationId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Mark as read"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDismissNotification(item.notificationId)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Dismiss notification"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
