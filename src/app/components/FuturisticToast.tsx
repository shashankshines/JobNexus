'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
} from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface FuturisticToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

function resolveToastMeta(toast: ToastMessage) {
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const text = (toast.message || '').toLowerCase();

  let title = toast.title;
  let badge = 'UPDATE';

  if (!title) {
    if (isSuccess) {
      if (text.includes('saved')) {
        title = 'Job Saved';
        badge = 'SAVED';
      } else if (text.includes('welcome') || text.includes('signed in')) {
        title = 'Welcome Back';
        badge = 'AUTHENTICATED';
      } else if (text.includes('account created')) {
        title = 'Account Created';
        badge = 'VERIFIED';
      } else if (text.includes('copied')) {
        title = 'Link Copied';
        badge = 'CLIPBOARD';
      } else if (text.includes('resum')) {
        title = 'Application Resumed';
        badge = 'DIRECT ATS';
      } else {
        title = 'Success';
        badge = 'COMPLETED';
      }
    } else if (isError) {
      if (text.includes('auth') || text.includes('credential')) {
        title = 'Authentication Notice';
        badge = 'ALERT';
      } else if (text.includes('save')) {
        title = 'Save Failed';
        badge = 'ERROR';
      } else {
        title = 'Attention Needed';
        badge = 'NOTICE';
      }
    } else {
      // info
      if (text.includes('signed out') || text.includes('logged out') || text.includes('guest')) {
        title = 'Signed Out';
        badge = 'GUEST BROWSING';
      } else if (text.includes('removed')) {
        title = 'Job Removed';
        badge = 'COLLECTION';
      } else if (text.includes('opening') || text.includes('portal')) {
        title = 'Opening Career Portal';
        badge = 'DIRECT ATS';
      } else {
        title = 'Notification';
        badge = 'NOTICE';
      }
    }
  }

  const config = isSuccess
    ? {
        accent: '#10b981',
        accentBg: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        iconGlow: 'rgba(16, 185, 129, 0.25)',
        badgeColor: '#10b981',
        beaconClass: 'jn-beacon-success',
        Icon: CheckCircle2,
      }
    : isError
    ? {
        accent: '#f43f5e',
        accentBg: 'rgba(244, 63, 94, 0.12)',
        borderColor: 'rgba(244, 63, 94, 0.35)',
        iconGlow: 'rgba(244, 63, 94, 0.25)',
        badgeColor: '#f43f5e',
        beaconClass: 'jn-beacon-error',
        Icon: AlertTriangle,
      }
    : {
        accent: '#6366f1',
        accentBg: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.35)',
        iconGlow: 'rgba(99, 102, 241, 0.25)',
        badgeColor: '#6366f1',
        beaconClass: 'jn-beacon-info',
        Icon: Sparkles,
      };

  return { title, badge, ...config };
}

export default function FuturisticToast({ toast, onDismiss }: FuturisticToastProps) {
  if (!toast) return null;

  const { title, badge, accent, accentBg, borderColor, Icon, beaconClass } =
    resolveToastMeta(toast);

  return (
    <AnimatePresence>
      <div className="jn-toast-container">
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: 16,
            scale: 0.96,
            transition: { duration: 0.18, ease: 'easeOut' },
          }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 28,
            mass: 0.8,
          }}
          whileHover={{ scale: 1.01 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 20 || info.offset.y < -20) onDismiss();
          }}
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            borderRadius: 14,
            background: 'var(--toast-bg)',
            border: '1px solid var(--toast-border)',
            boxShadow: 'var(--toast-shadow)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'grab',
          }}
          role="status"
          aria-live="polite"
        >
          {/* Subtle Top Accent Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2.5,
              background: `linear-gradient(90deg, ${accent}, rgba(99, 102, 241, 0.4), transparent)`,
              opacity: 0.95,
            }}
          />

          {/* Toast Content Layout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem',
              padding: '0.85rem 1rem 0.8rem 0.95rem',
            }}
          >
            {/* Status Icon Pod */}
            <div
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 10,
                background: accentBg,
                border: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent,
                marginTop: 2,
              }}
            >
              <Icon size={18} strokeWidth={2.4} />
            </div>

            {/* Contextual Text Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Header Meta: Dot + Badge + Title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.2rem',
                }}
              >
                <div
                  className={beaconClass}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: accent,
                  }}
                />
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: accent,
                    textTransform: 'uppercase',
                  }}
                >
                  {badge}
                </span>
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 650,
                    color: 'var(--toast-title, var(--text-primary))',
                    letterSpacing: '-0.01em',
                    marginLeft: '0.25rem',
                  }}
                >
                  {title}
                </span>
              </div>

              {/* Informative Body Text */}
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  fontWeight: 450,
                  lineHeight: 1.45,
                  color: 'var(--toast-body, var(--text-secondary))',
                  wordBreak: 'break-word',
                }}
              >
                {toast.message}
              </p>
            </div>

            {/* Minimalist Close Button */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              style={{
                flexShrink: 0,
                background: 'var(--toast-close-bg)',
                border: '1px solid transparent',
                color: 'var(--toast-close)',
                width: 24,
                height: 24,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: 0,
                marginLeft: '0.15rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--toast-close-hover)';
                e.currentTarget.style.borderColor = 'var(--toast-border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--toast-close)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          </div>

          {/* Clean Progress Deplete Bar */}
          <div
            style={{
              width: '100%',
              height: 2,
              background: 'rgba(125, 125, 125, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              className="jn-toast-deplete-bar"
              style={{
                width: '100%',
                height: '100%',
                background: accent,
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
