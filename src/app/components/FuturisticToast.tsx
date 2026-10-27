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
  message: string;
}

interface FuturisticToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export default function FuturisticToast({ toast, onDismiss }: FuturisticToastProps) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  // Cybernetic Color Palette Tokens
  const config = isSuccess
    ? {
        badge: 'SYSTEM // VERIFIED',
        accent: '#10b981',
        accentGlow: 'rgba(16, 185, 129, 0.35)',
        accentSecondary: '#06b6d4',
        borderColor: 'rgba(16, 185, 129, 0.45)',
        iconBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 182, 212, 0.12) 100%)',
        boxShadow:
          '0 20px 48px -10px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        beaconClass: 'jn-beacon-success',
        Icon: CheckCircle2,
      }
    : isError
    ? {
        badge: 'SYSTEM // ALERT',
        accent: '#f43f5e',
        accentGlow: 'rgba(244, 63, 94, 0.38)',
        accentSecondary: '#fb7185',
        borderColor: 'rgba(244, 63, 94, 0.5)',
        iconBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25) 0%, rgba(225, 29, 72, 0.12) 100%)',
        boxShadow:
          '0 20px 48px -10px rgba(0, 0, 0, 0.7), 0 0 35px rgba(244, 63, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        beaconClass: 'jn-beacon-error',
        Icon: AlertTriangle,
      }
    : {
        badge: 'NEXUS // UPDATE',
        accent: '#6366f1',
        accentGlow: 'rgba(99, 102, 241, 0.35)',
        accentSecondary: '#38bdf8',
        borderColor: 'rgba(99, 102, 241, 0.45)',
        iconBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(56, 189, 248, 0.14) 100%)',
        boxShadow:
          '0 20px 48px -10px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        beaconClass: 'jn-beacon-info',
        Icon: Sparkles,
      };

  const { Icon } = config;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 520,
          padding: '0 1rem',
        }}
      >
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -36, scale: 0.9, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{
            opacity: 0,
            y: -22,
            scale: 0.94,
            filter: 'blur(8px)',
            transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
          }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 28,
            mass: 0.85,
          }}
          whileHover={{ scale: 1.015 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -20) onDismiss();
          }}
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            borderRadius: 18,
            background:
              'var(--toast-bg, linear-gradient(135deg, rgba(13, 18, 33, 0.94) 0%, rgba(9, 13, 24, 0.97) 100%))',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: `1px solid ${config.borderColor}`,
            boxShadow: config.boxShadow,
            display: 'flex',
            flexDirection: 'column',
            cursor: 'grab',
          }}
          role="status"
          aria-live="polite"
        >
          {/* Top Holographic Scanning Laser Beam */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2.5,
              background: `linear-gradient(90deg, transparent, ${config.accent}, ${config.accentSecondary}, transparent)`,
              animation: 'jn-laser-sweep 3s ease-in-out infinite',
              opacity: 0.9,
            }}
          />

          {/* Toast Body Layout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.9rem',
              padding: '0.9rem 1.15rem 0.85rem 1rem',
            }}
          >
            {/* Holographic Glowing Icon Pod */}
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 12,
                background: config.iconBg,
                border: `1px solid ${config.borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: config.accent,
                boxShadow: `0 0 16px ${config.accentGlow}`,
                marginTop: 2,
              }}
            >
              <Icon size={21} strokeWidth={2.4} />
            </div>

            {/* Content Section */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Futuristic Cyber Subhead with Pulsing Beacon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.25rem',
                }}
              >
                {/* Live Activity Radar Beacon */}
                <div
                  className={config.beaconClass}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: config.accent,
                    boxShadow: `0 0 8px ${config.accent}`,
                  }}
                />

                {/* Monospace System Badge */}
                <span
                  style={{
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: config.accent,
                    textTransform: 'uppercase',
                  }}
                >
                  {config.badge}
                </span>

                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontFamily: 'var(--font-mono), monospace',
                    marginLeft: 'auto',
                    letterSpacing: '0.05em',
                  }}
                >
                  TRANSMISSION ACTIVE
                </span>
              </div>

              {/* Message Payload */}
              <p
                style={{
                  margin: 0,
                  fontSize: '0.88rem',
                  fontWeight: 550,
                  lineHeight: 1.45,
                  color: 'var(--text-primary, #ffffff)',
                  wordBreak: 'break-word',
                  letterSpacing: '-0.01em',
                }}
              >
                {toast.message}
              </p>
            </div>

            {/* Futuristic Dismiss Button */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              style={{
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.65)',
                width: 26,
                height: 26,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                padding: 0,
                marginLeft: '0.2rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }}
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>

          {/* Depleting High-Energy Countdown Bar */}
          <div
            style={{
              width: '100%',
              height: 2.5,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              className="jn-toast-deplete-bar"
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, ${config.accent}, ${config.accentSecondary})`,
                boxShadow: `0 0 10px ${config.accent}`,
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
