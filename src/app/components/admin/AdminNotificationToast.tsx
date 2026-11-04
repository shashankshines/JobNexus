'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Info,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ToastItem } from '@/app/hooks/useAdminNotifications';
import {
  AdminNotificationDocument,
  NotificationPriority,
} from '@/modules/notifications/notification.types';

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onAction: (notification: AdminNotificationDocument) => void;
  onOpenInbox: () => void;
}

function getPriorityBadge(priority: NotificationPriority) {
  switch (priority) {
    case 'critical':
      return {
        icon: ShieldAlert,
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.4)',
        label: 'CRITICAL',
      };
    case 'high':
      return {
        icon: AlertTriangle,
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.4)',
        label: 'ACTION REQUIRED',
      };
    case 'normal':
      return {
        icon: Info,
        color: '#6366f1',
        bg: 'rgba(99, 102, 241, 0.15)',
        border: 'rgba(99, 102, 241, 0.3)',
        label: 'NOTICE',
      };
    case 'low':
      return {
        icon: CheckCircle,
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.3)',
        label: 'INFO',
      };
  }
}

export function AdminNotificationToastContainer({
  toasts,
  onDismiss,
  onAction,
  onOpenInbox,
}: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Real-time Admin Notifications"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 440,
        width: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(({ id, notification }) => {
        const meta = getPriorityBadge(notification.priority);
        const Icon = meta.icon;

        return (
          <div
            key={id}
            role="alert"
            style={{
              pointerEvents: 'auto',
              background: 'var(--card-bg, #1e293b)',
              color: 'var(--text-primary, #f8fafc)',
              border: `1px solid ${meta.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animation: 'adminToastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Header: Priority Badge + Title + Close Button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    padding: '2px 7px',
                    borderRadius: 6,
                    background: meta.bg,
                    color: meta.color,
                    border: `1px solid ${meta.border}`,
                  }}
                >
                  <Icon size={12} strokeWidth={2.5} />
                  {meta.label}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                  {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(id)}
                aria-label="Dismiss toast"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary, #94a3b8)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Content: Title & Message */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35, marginBottom: 4 }}>
                {notification.title}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.79rem',
                  lineHeight: 1.45,
                  color: 'var(--text-secondary, #cbd5e1)',
                  wordBreak: 'break-word',
                }}
              >
                {notification.message}
              </p>
              {notification.userEmail && (
                <div style={{ fontSize: '0.72rem', color: '#818cf8', marginTop: 4, fontWeight: 500 }}>
                  User: {notification.userEmail}
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 2,
                paddingTop: 8,
                borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              }}
            >
              <button
                type="button"
                onClick={onOpenInbox}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary, #94a3b8)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 6,
                }}
              >
                View Inbox
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onDismiss(id)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                    color: 'var(--text-secondary, #cbd5e1)',
                    borderRadius: 8,
                    padding: '6px 11px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
                {notification.actionLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      onAction(notification);
                      onDismiss(id);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
                    }}
                  >
                    <span>{notification.actionLabel}</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

