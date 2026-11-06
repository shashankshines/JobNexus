'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, X, ExternalLink, ArrowRight, Briefcase, MapPin } from 'lucide-react';
import { SmartJobNotification } from '@/modules/notifications/domain/smart-notification.types';

interface GroupedJobToastProps {
  notifications: SmartJobNotification[] | null;
  onDismiss: () => void;
  onOpenNotificationCenter: () => void;
  onSelectJob?: (jobId: string) => void;
}

export const GroupedJobToast: React.FC<GroupedJobToastProps> = ({
  notifications,
  onDismiss,
  onOpenNotificationCenter,
  onSelectJob,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    if (!isHovered) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 12000); // 12 seconds auto-dismiss
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [notifications, isHovered, onDismiss]);

  if (!notifications || notifications.length === 0) return null;

  const count = notifications.length;

  return (
    <div
      role="region"
      aria-label="Smart Job Match Alerts"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        maxWidth: '420px',
        width: 'calc(100vw - 3rem)',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15)',
        color: '#f8fafc',
        padding: '1rem',
        animation: 'slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
              New Job Match{count > 1 ? 'es' : ''} Found
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Matched your saved job alert preferences
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Dismiss toast"
        >
          <X size={16} />
        </button>
      </div>

      {/* Matched Jobs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {notifications.map((notif) => (
          <div
            key={notif.notificationId}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={notif.jobTitle}
                >
                  {notif.jobTitle}
                </h4>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginTop: '2px',
                  }}
                >
                  <Briefcase size={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notif.jobCompany}
                  </span>
                </div>
              </div>

              {notif.matchingAlertNames && notif.matchingAlertNames.length > 0 && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#7dd3fc',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {notif.matchingAlertNames[0]}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '4px',
                fontSize: '0.72rem',
                color: '#94a3b8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                <MapPin size={11} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {notif.jobLocation}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {onSelectJob && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectJob(notif.canonicalJobId);
                      onDismiss();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    View Job
                  </button>
                )}
                {notif.jobUrl && (
                  <a
                    href={notif.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: 'rgba(56, 189, 248, 0.18)',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 7px',
                      borderRadius: '5px',
                      textDecoration: 'none',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    <span>Apply</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Auto-dismissing {isHovered ? '(Paused)' : 'in 12s'}
        </span>
        <button
          type="button"
          onClick={() => {
            onOpenNotificationCenter();
            onDismiss();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: 0,
          }}
        >
          <span>View All in Center</span>
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};
