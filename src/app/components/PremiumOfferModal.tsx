'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UpiPaymentFlow } from './billing/UpiPaymentFlow';
import type { BillingFlowSnapshot } from '@/modules/billing/domain/billing-flow-state';

interface PremiumOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionSuccess?: () => void;
  userId?: string;
  userEmail?: string;
  userName?: string;
  isPremium?: boolean;
  billingFlow?: BillingFlowSnapshot | null;
  isBillingResolved?: boolean;
  onBillingFlowChange?: (
    updater:
      | BillingFlowSnapshot
      | ((prev: BillingFlowSnapshot | null) => BillingFlowSnapshot | null)
  ) => void;
}

export function PremiumOfferModal({
  isOpen,
  onClose,
  onSubscriptionSuccess,
  userId,
  userEmail,
  userName,
  isPremium = false,
  billingFlow,
  isBillingResolved,
  onBillingFlowChange,
}: PremiumOfferModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isAuthenticated = Boolean(userId || userEmail);
  const accountKey = userId || userEmail || 'anonymous';

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          key="premium-modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-offer-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            isolation: 'isolate',
          }}
        >
          {/* Hardware-Accelerated Isolated Backdrop Overlay */}
          <motion.div
            key="premium-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--modal-backdrop, rgba(3, 7, 18, 0.78))',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              transform: 'translateZ(0)',
              willChange: 'opacity',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          />

          {/* Modal Content Card (Sibling to Backdrop to prevent GPU compositor blur recursion) */}
          <motion.div
            key="premium-modal-card"
            className="premium-offer-modal-card"
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              maxWidth: 520,
              maxHeight: '92vh',
              background: 'var(--modal-bg, #0d1321)',
              borderRadius: 24,
              border: '1px solid var(--modal-border, rgba(99, 102, 241, 0.35))',
              boxShadow: 'var(--shadow-lg), 0 0 40px rgba(99, 102, 241, 0.15)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Accent Gradient Ribbon */}
            <div
              style={{
                height: 4,
                width: '100%',
                background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #10b981)',
                flexShrink: 0,
              }}
            />

            <UpiPaymentFlow
              key={accountKey}
              onClose={onClose}
              onSubscriptionSuccess={onSubscriptionSuccess}
              userId={userId}
              userEmail={userEmail}
              userName={userName}
              isAuthenticated={isAuthenticated}
              isPremium={isPremium}
              billingFlow={billingFlow}
              isBillingResolved={isBillingResolved}
              onBillingFlowChange={onBillingFlowChange}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
