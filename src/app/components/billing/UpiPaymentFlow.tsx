'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Clock,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  BookmarkCheck,
  Eye,
  TrendingUp,
  AlertCircle,
  AlertOctagon,
  X,
  Mail,
} from 'lucide-react';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';
import { buildUpiPaymentUri } from './upi-payment-uri';
import { UpiQrCode } from './UpiQrCode';
import type { PaymentOrder, PaymentSubmission, UpiPaymentStep } from './types';

interface UpiPaymentFlowProps {
  onClose: () => void;
  onSubscriptionSuccess?: () => void;
  userEmail?: string;
  userName?: string;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

export function UpiPaymentFlow({
  onClose,
  onSubscriptionSuccess,
  isAuthenticated = false,
  onRequireAuth,
}: UpiPaymentFlowProps) {
  // Step state
  const [step, setStep] = useState<UpiPaymentStep>('plan_review');

  // Authoritative server data
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [submission, setSubmission] = useState<PaymentSubmission | null>(null);

  // Loading & In-flight states
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  // Form input states
  const [utrInput, setUtrInput] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [verificationNotes, setVerificationNotes] = useState('');

  // UI feedback & Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ utr?: string; date?: string }>({});
  const [copySuccess, setCopySuccess] = useState(false);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Check Existing Status on Mount / Open
  // ---------------------------------------------------------------------------
  const checkInitialStatus = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // 1. Check if user already has an active or pending submission
      const subRes = await fetch('/api/billing/submit');
      if (subRes.ok) {
        const subData = await subRes.json();
        const submissions: PaymentSubmission[] = subData.submissions || [];
        const pending = submissions.find((s) => s.status === 'pending_verification');

        if (pending) {
          setSubmission(pending);
          setStep('status_view');
          setLastCheckedAt(new Date());
          return;
        }

        const approved = submissions.find((s) => s.status === 'approved');
        if (approved) {
          setSubmission(approved);
          setStep('status_view');
          setLastCheckedAt(new Date());
          return;
        }
      }

      // 2. Check if user has an active, unexpired order
      const orderRes = await fetch('/api/billing/order');
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        if (orderData.order && orderData.order.status === 'created') {
          setOrder(orderData.order);
        }
      }
    } catch (err) {
      console.warn('[UpiPaymentFlow] Initial status check warning:', err);
    }
  }, [isAuthenticated]);

  const hasCheckedInitialStatusRef = React.useRef(false);
  useEffect(() => {
    if (!hasCheckedInitialStatusRef.current && isAuthenticated) {
      hasCheckedInitialStatusRef.current = true;
      checkInitialStatus();
    }
  }, [isAuthenticated, checkInitialStatus]);

  // ---------------------------------------------------------------------------
  // Step 1: Proceed to Order Generation
  // ---------------------------------------------------------------------------
  const handleProceedToPayment = async () => {
    if (!isAuthenticated) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        setErrorMessage('Please sign in to upgrade to JobNexus Premium.');
      }
      return;
    }

    setIsLoadingOrder(true);
    setErrorMessage(null);

    try {
      // Create or reuse server order
      const res = await fetch('/api/billing/order', {
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
        throw new Error(errData.error || 'Failed to create payment order. Please try again.');
      }

      const data = await res.json();
      if (!data.order) {
        throw new Error('Server returned an invalid order payload.');
      }

      setOrder(data.order);
      setStep('payment_instructions');
    } catch (err) {
      console.error('[UpiPaymentFlow] Order creation error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to initialize payment order.');
    } finally {
      setIsLoadingOrder(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helper: Create Fresh Order (Recovery from Expiry)
  // ---------------------------------------------------------------------------
  const handleCreateFreshOrder = async () => {
    setIsLoadingOrder(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/billing/order?new=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: PREMIUM_PLAN.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create a new order.');
      }

      const data = await res.json();
      setOrder(data.order);
      setSubmission(null);
      setStep('payment_instructions');
    } catch (err) {
      console.error('[UpiPaymentFlow] Fresh order error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to create fresh order.');
    } finally {
      setIsLoadingOrder(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Copy UPI ID to Clipboard
  // ---------------------------------------------------------------------------
  const handleCopyUpiId = async () => {
    const upiId = order?.upiId || 'jobnexus@icici';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(upiId);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = upiId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.warn('[UpiPaymentFlow] Clipboard copy failed:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2: Form Validation & Submission
  // ---------------------------------------------------------------------------
  const validateForm = (): boolean => {
    const errors: { utr?: string; date?: string } = {};
    const cleaned = utrInput.trim().toUpperCase().replace(/[\s\-_#/]/g, '');

    if (!cleaned) {
      errors.utr = 'Please enter the UPI Reference / UTR Number from your receipt.';
    } else if (cleaned.length < 10 || cleaned.length > 22 || !/^[A-Z0-9]+$/.test(cleaned)) {
      errors.utr = 'UTR must be 10–22 alphanumeric characters (e.g. 429817293812).';
    } else if (/^0+$/.test(cleaned) || /^1+$/.test(cleaned)) {
      errors.utr = 'Please enter a genuine transaction reference from your bank receipt.';
    }

    if (!paymentDate) {
      errors.date = 'Please select the date on which you completed the payment.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) {
      setErrorMessage('Payment order reference missing. Please restart checkout.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const cleanedUtr = utrInput.trim().toUpperCase().replace(/[\s\-_#/]/g, '');

    try {
      const res = await fetch('/api/billing/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          utr: cleanedUtr,
          declaredAmount: order.amountInr, // Server-enforced price
          paymentDate,
          verificationNotes: verificationNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          if (data.code === 'UTR_COLLISION') {
            setErrorMessage('This UPI transaction reference has already been submitted or verified. Please check your bank receipt.');
          } else if (data.code === 'ORDER_ALREADY_SUBMITTED') {
            setErrorMessage('A payment reference has already been submitted for this order.');
          } else {
            setErrorMessage(data.error || 'Payment reference collision detected.');
          }
          return;
        }

        if (res.status === 400 && data.code === 'ORDER_EXPIRED') {
          setErrorMessage('This payment order has expired. Please create a new order.');
          return;
        }

        throw new Error(data.error || 'Failed to submit payment reference.');
      }

      if (data.submission) {
        setSubmission(data.submission);
        if (data.emailStatus?.status === 'sent') {
          setEmailDeliveryNotice('A payment submission acknowledgement email has been dispatched to your registered address.');
        } else if (data.emailStatus?.status === 'pending' || data.emailStatus?.status === 'retryable_failure') {
          setEmailDeliveryNotice('Payment reference recorded. Confirmation email delivery is queued.');
        }
        setStep('status_view');
      } else {
        throw new Error('Invalid response from submission service.');
      }
    } catch (err) {
      console.error('[UpiPaymentFlow] Submission error:', err);
      // Preserves input for retry
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to submit reference. Please verify your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3: Refresh Status on Demand (Strictly Read-Only Operation)
  // ---------------------------------------------------------------------------
  const handleRefreshStatus = async () => {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    setErrorMessage(null);

    try {
      // 1. Strictly read-only: Fetch user's own authoritative submission records from Firestore
      const res = await fetch('/api/billing/submit');
      if (res.ok) {
        const data = await res.json();
        const submissions: PaymentSubmission[] = data.submissions || [];
        if (submissions.length > 0) {
          const activeSub =
            submissions.find(
              (s) => s.status === 'approved' || s.status === 'pending_verification' || s.status === 'rejected'
            ) || submissions[0];
          setSubmission(activeSub);
        }
      }

      // 2. Strictly read-only: Fetch user's authoritative billing entitlement from Firestore
      const statusRes = await fetch('/api/billing/status', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.entitlement?.isPremium) {
          if (onSubscriptionSuccess) onSubscriptionSuccess();
        }
      }

      // 3. Update last checked timestamp upon successful read
      setLastCheckedAt(new Date());
    } catch (err) {
      console.warn('[UpiPaymentFlow] Status refresh warning:', err);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  // Safe UPI Payment URI Construction
  const upiUri = order?.upiId
    ? buildUpiPaymentUri({
        upiId: order.upiId,
        payeeName: order.payeeName,
        amountInr: order.amountInr,
        orderId: order.orderId,
      })
    : '';

  // ---------------------------------------------------------------------------
  // RENDER: STEP 1 — PLAN REVIEW
  // ---------------------------------------------------------------------------
  if (step === 'plan_review') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.75rem 2rem 1.25rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'rgba(99, 102, 241, 0.16)',
                color: '#a5b4fc',
                padding: '0.35rem 0.8rem',
                borderRadius: 999,
                border: '1px solid rgba(99, 102, 241, 0.35)',
              }}
            >
              <Sparkles size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
              <span>Membership Offer</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoadingOrder}
              aria-label="Close modal"
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
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <h2
            id="premium-offer-title"
            style={{
              fontSize: '1.45rem',
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
          <p style={{ fontSize: '0.86rem', color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
            Bypass queues, reveal direct employer ATS application links, and organize target positions with dedicated tools.
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
            <span
              style={{
                fontSize: '0.75rem',
                color: '#cbd5e1',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Authoritative Monthly Access
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>₹{PREMIUM_PLAN.priceInr}</span>
              <span style={{ fontSize: '0.88rem', color: '#94a3b8', fontWeight: 500 }}>/ month</span>
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
        <div style={{ padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Zap size={15} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              <strong style={{ color: '#ffffff', fontWeight: 600 }}>Direct Application Access:</strong> Get convenient access to available application links and move from job discovery to applying with fewer steps.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <BookmarkCheck size={15} style={{ color: '#34d399' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              <strong style={{ color: '#ffffff', fontWeight: 600 }}>Unlimited Saved Jobs:</strong> Organize and bookmark opportunities across all verified sources.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Eye size={15} style={{ color: '#c084fc' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              <strong style={{ color: '#ffffff', fontWeight: 600 }}>Clean Focus View:</strong> Distraction-free, zero-ad interface engineered for high-intent job seekers.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <TrendingUp size={15} style={{ color: '#fbbf24' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              <strong style={{ color: '#ffffff', fontWeight: 600 }}>Priority Feed Indexing:</strong> Early access to freshly indexed Indian tech and global remote roles.
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
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

        {/* Notice */}
        <div style={{ padding: '0.85rem 2rem 0.25rem 2rem' }}>
          <p style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45, margin: 0, fontStyle: 'italic' }}>
            * Payment is processed manually via UPI. Upon payment, submit your 12-digit UTR reference. Premium access is granted only after an authorized administrator independently verifies your transaction with bank records and records approval (target review window within 12 hours). Refreshing or elapsed time does not grant access automatically.
          </p>
        </div>

        {/* Actions */}
        <div style={{ padding: '1rem 2rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isLoadingOrder}
            style={{
              width: '100%',
              minHeight: 48,
              padding: '0.85rem 1.25rem',
              borderRadius: 12,
              background: isLoadingOrder
                ? '#4338ca'
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: 'none',
              cursor: isLoadingOrder ? 'wait' : 'pointer',
              boxShadow: '0 4px 18px rgba(79, 70, 229, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {isLoadingOrder ? (
              <span>Preparing UPI Order...</span>
            ) : (
              <>
                <span>Proceed to UPI Payment (₹499)</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoadingOrder}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: 10,
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Continue with Free Discovery
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: STEP 2 — PAYMENT INSTRUCTIONS & QR CODE
  // ---------------------------------------------------------------------------
  if (step === 'payment_instructions' && order) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem 1rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                padding: '0.25rem 0.65rem',
                borderRadius: 999,
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              Step 1 of 2: Scan & Pay
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
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
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#f8fafc',
              marginTop: '0.65rem',
              marginBottom: '0.25rem',
            }}
          >
            Pay ₹{order.amountInr} via UPI
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
            Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, Cred) or copy the UPI ID below.
          </p>
        </div>

        {/* QR Code and Payment Details Container */}
        <div
          style={{
            margin: '0 2rem 1rem 2rem',
            padding: '1.25rem',
            borderRadius: 18,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {/* QR Code */}
          <UpiQrCode upiUri={upiUri} upiId={order.upiId} size={190} />

          {/* Copyable UPI ID Box */}
          <div
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Business UPI ID ({order.payeeName})
              </span>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {order.upiId}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyUpiId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 8,
                background: copySuccess ? 'rgba(52, 211, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: copySuccess ? '#34d399' : '#a5b4fc',
                border: copySuccess ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {copySuccess ? (
                <>
                  <Check size={14} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>

          {/* Screen reader live announcement for copy */}
          <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
            {copySuccess ? 'UPI ID copied to clipboard' : ''}
          </div>

          {/* Order Reference Notice */}
          <div
            style={{
              width: '100%',
              fontSize: '0.76rem',
              color: '#cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Order Ref: <code style={{ color: '#818cf8', fontWeight: 600 }}>{order.orderId}</code>
            </span>
            <span style={{ color: '#94a3b8' }}>Amount: ₹{order.amountInr}</span>
          </div>

          {/* Mobile Deep Link Button */}
          <a
            href={upiUri}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#e2e8f0',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            <span>Open in UPI App (Mobile)</span>
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Safety Invariant Notice */}
        <div style={{ margin: '0 2rem', padding: '0.7rem 0.95rem', borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fde68a', fontSize: '0.78rem', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
          <AlertCircle size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: '#fef3c7' }}>Next Step Required:</strong> After transferring ₹{order.amountInr}, click below to submit your 12-digit UTR transaction reference so our team can verify and activate your Premium access.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '1.25rem 2rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setStep('submit_reference')}
            style={{
              width: '100%',
              minHeight: 48,
              padding: '0.85rem 1.25rem',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>I Have Paid → Enter UTR Reference</span>
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            onClick={() => setStep('plan_review')}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: 10,
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Plan Details</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: STEP 3 — PAYMENT SUBMISSION FORM
  // ---------------------------------------------------------------------------
  if (step === 'submit_reference' && order) {
    return (
      <form onSubmit={handleSubmitReference} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem 1rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#34d399',
                padding: '0.25rem 0.65rem',
                borderRadius: 999,
                border: '1px solid rgba(52, 211, 153, 0.25)',
              }}
            >
              Step 2 of 2: Submit Reference
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              disabled={isSubmitting}
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
                cursor: 'pointer',
                fontSize: '1.1rem',
              }}
            >
              ×
            </button>
          </div>

          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#f8fafc',
              marginTop: '0.65rem',
              marginBottom: '0.25rem',
            }}
          >
            Confirm Your UPI Payment
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
            Enter the 12-digit UPI Reference / UTR Number from your banking or UPI app receipt.
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* UTR Input Field */}
          <div>
            <label
              htmlFor="utr-input"
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '0.35rem',
              }}
            >
              UPI Transaction Reference (UTR) <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              id="utr-input"
              type="text"
              required
              disabled={isSubmitting}
              placeholder="e.g. 429817293812"
              value={utrInput}
              onChange={(e) => {
                setUtrInput(e.target.value.toUpperCase());
                if (fieldErrors.utr) setFieldErrors((prev) => ({ ...prev, utr: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.utr)}
              aria-describedby={fieldErrors.utr ? 'utr-error' : 'utr-help'}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: 'rgba(8, 12, 22, 0.85)',
                border: fieldErrors.utr ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '1rem',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                outline: 'none',
              }}
            />
            {fieldErrors.utr ? (
              <span id="utr-error" style={{ display: 'block', fontSize: '0.74rem', color: '#f87171', marginTop: '0.3rem' }}>
                {fieldErrors.utr}
              </span>
            ) : (
              <span id="utr-help" style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
                Found in your payment app under &quot;UPI Ref No.&quot;, &quot;UTR&quot;, or &quot;Transaction ID&quot;.
              </span>
            )}
          </div>

          {/* Amount Paid (Authoritative Display) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="amount-display"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  marginBottom: '0.35rem',
                }}
              >
                Plan Amount
              </label>
              <input
                id="amount-display"
                type="text"
                readOnly
                value={`₹${order.amountInr}`}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#34d399',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            {/* Payment Date */}
            <div>
              <label
                htmlFor="date-input"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  marginBottom: '0.35rem',
                }}
              >
                Payment Date <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                id="date-input"
                type="date"
                required
                disabled={isSubmitting}
                value={paymentDate}
                onChange={(e) => {
                  setPaymentDate(e.target.value);
                  if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.date)}
                aria-describedby={fieldErrors.date ? 'date-error' : undefined}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  background: 'rgba(8, 12, 22, 0.85)',
                  border: fieldErrors.date ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Payment App / Notes (Optional) */}
          <div>
            <label
              htmlFor="notes-input"
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '0.35rem',
              }}
            >
              Payment App or Bank (Optional)
            </label>
            <input
              id="notes-input"
              type="text"
              disabled={isSubmitting}
              placeholder="e.g. Google Pay / HDFC Bank"
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 10,
                background: 'rgba(8, 12, 22, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Top-Level Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div>{errorMessage}</div>
              {errorMessage.includes('expired') && (
                <button
                  type="button"
                  onClick={handleCreateFreshOrder}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 6,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Generate New Order
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '1.25rem 2rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              minHeight: 48,
              padding: '0.85rem 1.25rem',
              borderRadius: 12,
              background: isSubmitting
                ? '#4338ca'
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: 'none',
              cursor: isSubmitting ? 'wait' : 'pointer',
              boxShadow: '0 4px 18px rgba(79, 70, 229, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {isSubmitting ? (
              <span>Verifying & Submitting Reference...</span>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Submit for Verification</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStep('payment_instructions')}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: 10,
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Payment Details & QR</span>
          </button>
        </div>
      </form>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: STEP 4 — STATUS & CONFIRMATION VIEW
  // ---------------------------------------------------------------------------
  if (step === 'status_view' && submission) {
    const isApproved = submission.status === 'approved';
    const isPending = submission.status === 'pending_verification';
    const isRejected = submission.status === 'rejected';

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.75rem 2rem 1rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: isApproved
                  ? 'rgba(52, 211, 153, 0.15)'
                  : isPending
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                color: isApproved ? '#34d399' : isPending ? '#fbbf24' : '#f87171',
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                border: isApproved
                  ? '1px solid rgba(52, 211, 153, 0.3)'
                  : isPending
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {isApproved && (
                <>
                  <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                  <span>Active Premium</span>
                </>
              )}
              {isPending && (
                <>
                  <Clock size={13} style={{ flexShrink: 0 }} />
                  <span>Verification in Progress</span>
                </>
              )}
              {isRejected && (
                <>
                  <AlertOctagon size={13} style={{ flexShrink: 0 }} />
                  <span>Payment Rejected</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
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
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#f8fafc',
              marginTop: '0.85rem',
              marginBottom: '0.35rem',
            }}
          >
            {isApproved && 'Welcome to JobNexus Premium!'}
            {isPending && 'Payment Details Received'}
            {isRejected && 'Payment Verification Unsuccessful'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
            {isApproved && 'Your payment has been verified. You now enjoy unmasked ATS links and priority alerts.'}
            {isPending && 'Our team is reviewing your UPI transaction reference against banking records.'}
            {isRejected && (submission.decisionReason || 'We were unable to verify this transaction reference.')}
          </p>
        </div>

        {/* SLA Review Target Callout */}
        {isPending && (
          <div
            style={{
              margin: '0 2rem 1rem 2rem',
              padding: '1rem',
              borderRadius: 14,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <Clock size={22} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fde68a' }}>
                Review Target: Within 12 Hours
              </span>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                This is an estimated administrative review target window, not an automatic timer. Premium access activates in the system only after an authorized billing administrator independently verifies bank records and records approval. Refreshing or waiting does not trigger automatic activation.
              </p>
            </div>
          </div>
        )}

        {/* Email Delivery Acknowledgement Callout */}
        {emailDeliveryNotice && (
          <div
            style={{
              margin: '0 2rem 1rem 2rem',
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.78rem',
              color: '#c7d2fe',
            }}
          >
            <Mail size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span>{emailDeliveryNotice}</span>
          </div>
        )}

        {/* Verification Summary Card */}
        <div
          style={{
            margin: '0 2rem 1rem 2rem',
            padding: '1.1rem 1.25rem',
            borderRadius: 14,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Submission ID:</span>
            <code style={{ color: '#e2e8f0', fontWeight: 600 }}>{submission.submissionId}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>UTR Reference:</span>
            <code style={{ color: '#818cf8', fontWeight: 700 }}>{submission.utrNumber}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Declared Amount:</span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>₹{submission.declaredAmount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Payment Date:</span>
            <span style={{ color: '#e2e8f0' }}>{submission.paymentDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Current Status:</span>
            <span style={{ color: isApproved ? '#34d399' : isPending ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
              {isApproved ? 'Approved' : isPending ? 'Pending Verification' : 'Rejected'}
            </span>
          </div>
        </div>

        {/* Security Invariant Explanatory Banner */}
        {isPending && (
          <div style={{ margin: '0 2rem', padding: '0.65rem 0.85rem', borderRadius: 10, background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#c7d2fe', fontSize: '0.74rem', lineHeight: 1.45 }}>
            <ShieldCheck size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.35rem', color: '#818cf8' }} />
            <strong>Security Invariant:</strong> Submitting a payment reference records your request for independent administrative verification. Refreshing the status is a read-only check for recorded approval and does not grant access or mutate records. Premium remains locked until approval is formally recorded.
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '1.25rem 2rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {isPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={isRefreshingStatus}
                aria-label="Refresh payment status"
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  background: isRefreshingStatus ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: isRefreshingStatus ? '#94a3b8' : '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: isRefreshingStatus ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.18s ease',
                  opacity: isRefreshingStatus ? 0.75 : 1,
                }}
              >
                <RefreshCw size={15} className={isRefreshingStatus ? 'animate-spin' : ''} />
                <span>{isRefreshingStatus ? 'Refreshing...' : 'Refresh Status'}</span>
              </button>

              {lastCheckedAt && (
                <div style={{ textAlign: 'center', fontSize: '0.73rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  <span>Last checked:</span>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                    {lastCheckedAt.toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {isApproved && (
            <button
              type="button"
              onClick={() => {
                if (onSubscriptionSuccess) onSubscriptionSuccess();
                onClose();
              }}
              style={{
                width: '100%',
                minHeight: 46,
                padding: '0.75rem 1rem',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Explore Premium Features
            </button>
          )}

          {isRejected && (
            <button
              type="button"
              onClick={handleCreateFreshOrder}
              disabled={isLoadingOrder}
              style={{
                width: '100%',
                minHeight: 46,
                padding: '0.75rem 1rem',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Start New Payment Order
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: 10,
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Close & Return to Jobs
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
