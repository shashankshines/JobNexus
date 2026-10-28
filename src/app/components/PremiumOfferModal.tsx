'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';

interface PremiumOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionSuccess?: () => void;
  userEmail?: string;
  userName?: string;
}

export function PremiumOfferModal({
  isOpen,
  onClose,
  onSubscriptionSuccess,
  userEmail,
  userName,
}: PremiumOfferModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  const handleSubscribe = useCallback(async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Request server-enforced checkout session (₹499/mo)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: PREMIUM_PLAN.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setErrorMessage('You already have an active JobNexus Premium membership.');
          if (onSubscriptionSuccess) onSubscriptionSuccess();
          return;
        }
        throw new Error(errData.error || 'Failed to initialize subscription checkout.');
      }

      const data = await res.json();
      const checkout = data.checkout;

      // 2. Check if live Razorpay or Sandboxed mode
      if (checkout.isMock) {
        // Sandboxed development environment: simulate sandbox activation safely via webhook endpoint
        const mockWebhookRes = await fetch('/api/billing/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-razorpay-signature': 'mock_sandbox_sig', // Verified by test/sandbox logic
          },
          body: JSON.stringify({
            event: 'subscription.charged',
            event_id: `evt_mock_${Date.now()}`,
            payload: {
              subscription: {
                entity: {
                  id: checkout.subscriptionId,
                  status: 'active',
                  current_start: Math.floor(Date.now() / 1000),
                  current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
                  notes: {
                    product: 'JobNexus Premium',
                  },
                },
              },
              payment: {
                entity: {
                  id: `pay_mock_${Date.now()}`,
                  amount: PREMIUM_PLAN.amountInPaise,
                  currency: PREMIUM_PLAN.currency,
                  status: 'captured',
                },
              },
            },
          }),
        });

        if (mockWebhookRes.ok) {
          if (onSubscriptionSuccess) {
            onSubscriptionSuccess();
          }
          onClose();
          return;
        }
      }

      // 3. In Live Environment: Load Razorpay Checkout modal
      const loadScript = (): Promise<boolean> => {
        return new Promise((resolve) => {
          if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const loaded = await loadScript();
      if (!loaded) {
        throw new Error('Unable to load payment gateway SDK. Please check your connection.');
      }

      type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };
      const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

      const rzp = new Razorpay({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: 'JobNexus',
        description: 'JobNexus Premium — Monthly Membership (₹499/mo)',
        prefill: {
          name: userName || '',
          email: userEmail || '',
        },
        theme: {
          color: '#4f46e5',
        },
        handler: async () => {
          if (onSubscriptionSuccess) {
            onSubscriptionSuccess();
          }
          onClose();
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
      });

      rzp.open();
    } catch (err) {
      console.error('[PremiumOfferModal Error]:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [onClose, onSubscriptionSuccess, userEmail, userName]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-offer-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={() => !isProcessing && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#0d1321',
              borderRadius: 24,
              border: '1px solid rgba(99, 102, 241, 0.35)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75), 0 0 40px rgba(99, 102, 241, 0.15)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Top Accent Gradient Ribbon */}
            <div
              style={{
                height: 4,
                width: '100%',
                background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #10b981)',
              }}
            />

            {/* Header Content */}
            <div style={{ padding: '1.75rem 2rem 1.25rem 2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    padding: '0.3rem 0.75rem',
                    borderRadius: 999,
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  ⭐ Membership Offer
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  aria-label="Close offer modal"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ×
                </button>
              </div>

              <h2
                id="premium-offer-title"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#f8fafc',
                  letterSpacing: '-0.025em',
                  marginTop: '0.85rem',
                  marginBottom: '0.35rem',
                  lineHeight: 1.25,
                }}
              >
                Supercharge Your Job Search with Premium
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
                Bypass queues, reveal direct employer ATS application links, and organize your applications with dedicated tools.
              </p>
            </div>

            {/* Pricing Callout Box */}
            <div
              style={{
                margin: '0 2rem 1rem 2rem',
                padding: '1.1rem 1.35rem',
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Transparent Monthly Access
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>₹499</span>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>/ month</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#34d399',
                    fontWeight: 700,
                    background: 'rgba(52, 211, 153, 0.12)',
                    padding: '0.25rem 0.55rem',
                    borderRadius: 6,
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    display: 'inline-block',
                  }}
                >
                  All Taxes Included
                </span>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                  Cancel anytime in 1 click
                </div>
              </div>
            </div>

            {/* Benefits List */}
            <div style={{ padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#60a5fa', fontSize: '1rem', lineHeight: '1.3' }}>⚡</span>
                <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                  <strong style={{ color: '#ffffff' }}>Direct Application Access:</strong> Get convenient access to available application links and move from job discovery to applying with fewer steps.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#34d399', fontSize: '1rem', lineHeight: '1.3' }}>🔖</span>
                <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                  <strong style={{ color: '#ffffff' }}>Unlimited Saved Jobs:</strong> Organize and bookmark opportunities across all verified sources.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#a78bfa', fontSize: '1rem', lineHeight: '1.3' }}>🎯</span>
                <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                  <strong style={{ color: '#ffffff' }}>Clean Focus View:</strong> Distraction-free, zero-ad interface engineered for high-intent job seekers.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ color: '#f59e0b', fontSize: '1rem', lineHeight: '1.3' }}>🚀</span>
                <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                  <strong style={{ color: '#ffffff' }}>Priority Feed Indexing:</strong> Early access to freshly indexed Indian tech and global remote roles.
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div
                style={{
                  margin: '1rem 2rem 0 2rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '0.82rem',
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Billing Details & Legal Disclaimer */}
            <div style={{ padding: '1rem 2rem 0.5rem 2rem' }}>
              <p
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  lineHeight: 1.45,
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                * JobNexus is a career discovery and indexing platform. Membership provides productivity tools and direct application routing. It does not guarantee interviews, employment, or job offers. Auto-renews monthly at ₹499 until cancelled from your profile.
              </p>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                padding: '1rem 2rem 1.75rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 12,
                  background: isProcessing
                    ? '#4338ca'
                    : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: isProcessing ? 'wait' : 'pointer',
                  boxShadow: '0 4px 18px rgba(79, 70, 229, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.18s ease',
                }}
              >
                {isProcessing ? 'Processing Checkout...' : 'Unlock Premium — ₹499/Month'}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 10,
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                }}
              >
                Continue with Free Discovery
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

