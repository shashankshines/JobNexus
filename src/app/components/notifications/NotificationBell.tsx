'use client';

import React from 'react';
import { Bell } from 'lucide-react';

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  unreadCount,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`site-header-btn site-header-btn-ghost notification-bell-btn ${className}`}
      title={
        unreadCount > 0
          ? `${unreadCount} unread job notification${unreadCount === 1 ? '' : 's'}`
          : 'Job Notifications'
      }
      aria-label={
        unreadCount > 0
          ? `${unreadCount} unread job notifications`
          : 'Job Notifications'
      }
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.45rem 0.65rem',
        borderRadius: '10px',
        cursor: 'pointer',
      }}
    >
      <Bell
        size={16}
        className={unreadCount > 0 ? 'bell-icon-active' : ''}
        style={{
          color: unreadCount > 0 ? '#38bdf8' : 'var(--text-secondary)',
          transition: 'color 0.2s ease',
        }}
      />
      {unreadCount > 0 && (
        <span
          className="notification-badge-counter"
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            color: '#ffffff',
            fontSize: '0.68rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(56, 189, 248, 0.4)',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};
