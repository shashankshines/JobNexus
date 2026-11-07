'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import type { BillingFlowSnapshot } from '@/modules/billing/domain/billing-flow-state';
import {
  evaluateRenewalWindow,
  type RenewalWindowSnapshot,
} from '@/modules/billing/domain/renewal-window';

interface UpiPaymentFlowProps {
  onClose: () => void;
  onSubscriptionSuccess?: () => void;
  userId?: string;
  userEmail?: string;
  userName?: string;
  isAuthenticated?: boolean;
  isPremium?: boolean;
  billingFlow?: BillingFlowSnapshot | null;
  isBillingResolved?: boolean;
  onBillingFlowChange?: (
    updater:
      | BillingFlowSnapshot
      | ((prev: BillingFlowSnapshot | null) => BillingFlowSnapshot | null)
  ) => void;
  onRequireAuth?: () => void;
}

export function UpiPaymentFlow({
  onClose,
  onSubscriptionSuccess,
  isAuthenticated = false,
  isPremium = false,
  billingFlow,
  isBillingResolved,
  onBillingFlowChange,
  onRequireAuth,
}: UpiPaymentFlowProps) {
  const isContextResolved = !isAuthenticated || isBillingResolved === true;

  // Step state — initialized directly from authoritative billingFlow when resolved; never guesses 'plan_review' while unresolved
  const [isResolvingInitialState, setIsResolvingInitialState] = useState<boolean>(!isContextResolved);
  const [step, setStep] = useState<UpiPaymentStep>(() => {
    if (!isAuthenticated) return 'plan_review';
    if (billingFlow?.step) return billingFlow.step;
    return isPremium ? 'status_view' : 'plan_review';
  });

  // Authoritative server data
  const [order, setOrder] = useState<PaymentOrder | null>(() => billingFlow?.order ?? null);
  const [submission, setSubmission] = useState<PaymentSubmission | null>(
    () => billingFlow?.submission ?? null
  );

  // Loading & In-flight states
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(() =>
    billingFlow?.checkedAt ? new Date(billingFlow.checkedAt) : null
  );

  // Form input states
  const [utrInput, setUtrInput] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [verificationNotes, setVerificationNotes] = useState('');

  // UI feedback & Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ utr?: string; date?: string }>({});
  const [copySuccess, setCopySuccess] = useState(false);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<string | null>(null);
  const prevIsPremiumRef = useRef(isPremium);

  const commitBillingFlowUpdate = useCallback(
    (next: {
      step: UpiPaymentStep;
      order: PaymentOrder | null;
      submission: PaymentSubmission | null;
      checkedAt?: string;
      renewal?: RenewalWindowSnapshot;
    }) => {
      setStep(next.step);
      setOrder(next.order);
      setSubmission(next.submission);
      const checkedIso = next.checkedAt || new Date().toISOString();
      setLastCheckedAt(new Date(checkedIso));
      if (onBillingFlowChange) {
        const isPendingNow = next.submission?.status === 'pending_verification';
        onBillingFlowChange((prev) => {
          const baseRenewal =
            next.renewal ??
            prev?.renewal ??
            billingFlow?.renewal ??
            evaluateRenewalWindow({
              subscription: null,
              hasPendingVerification: isPendingNow,
            });
          const mergedRenewal: RenewalWindowSnapshot = isPendingNow
            ? {
                ...baseRenewal,
                hasPendingRenewalVerification: true,
                canRenewNow: false,
                emailMilestone: null,
              }
            : baseRenewal;

          return {
            step: next.step,
            order: next.order,
            submission: next.submission,
            hasPendingVerification: isPendingNow,
            hasRejectedSubmission: next.submission?.status === 'rejected' && !next.order,
            checkedAt: checkedIso,
            renewal: mergedRenewal,
          };
        });
      }
    },
    [onBillingFlowChange, billingFlow?.renewal]
  );

  // ---------------------------------------------------------------------------
  // Resolve Initial State ONLY if Modal Opened Before AuthContext Finished Sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isResolvingInitialState) return;

    // 1. If AuthContext just finished resolving billingFlow, hydrate once cleanly
    if (isBillingResolved === true) {
      const resolvedStep = billingFlow?.step ?? (isPremium ? 'status_view' : 'plan_review');
      setStep(resolvedStep);
      setOrder(billingFlow?.order ?? null);
      setSubmission(billingFlow?.submission ?? null);
      if (billingFlow?.checkedAt) {
        setLastCheckedAt(new Date(billingFlow.checkedAt));
      }
      setIsResolvingInitialState(false);
      return;
    }

    // 2. Standalone fallback ONLY when isBillingResolved prop is omitted entirely
    if (isBillingResolved === undefined && isAuthenticated) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/api/billing/status', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (!cancelled && res.ok) {
            const data = await res.json();
            if (data?.billingFlow) {
              commitBillingFlowUpdate({
                step: data.billingFlow.step,
                order: data.billingFlow.order ?? null,
                submission: data.billingFlow.submission ?? null,
                checkedAt: data.billingFlow.checkedAt,
                renewal: data.billingFlow.renewal,
              });
            }
          }
        } catch (err) {
          console.warn('[UpiPaymentFlow] Fallback billing status lookup warning:', err);
        } finally {
          if (!cancelled) {
            setIsResolvingInitialState(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [
    isResolvingInitialState,
    isBillingResolved,
    isAuthenticated,
    isPremium,
    billingFlow,
    commitBillingFlowUpdate,
  ]);

  // Synchronize external server-driven submission / entitlement changes (e.g. admin approval) without clobbering active renewal checkout
  useEffect(() => {
    const newlyBecamePremium = !prevIsPremiumRef.current && isPremium;
    prevIsPremiumRef.current = isPremium;

    if (isResolvingInitialState || !billingFlow) return;
    const incomingSub = billingFlow.submission;
    if (
      incomingSub &&
      (incomingSub.submissionId !== submission?.submissionId ||
        incomingSub.status !== submission?.status)
    ) {
      setSubmission(incomingSub);
      setStep(billingFlow.step);
      setOrder(billingFlow.order);
      setLastCheckedAt(new Date(billingFlow.checkedAt));
    } else if (newlyBecamePremium && step !== 'status_view') {
      setStep('status_view');
    }
  }, [isResolvingInitialState, billingFlow, isPremium, submission, step]);

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

    // Reuse preloaded unexpired order immediately if already in state at current plan price
    if (
      order &&
      order.status === 'created' &&
      order.amountInr === PREMIUM_PLAN.priceInr &&
      new Date(order.expiresAt).getTime() > Date.now()
    ) {
      commitBillingFlowUpdate({
        step: 'payment_instructions',
        order,
        submission: null,
      });
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
          setErrorMessage(
            errData.error || 'You already have an active JobNexus Premium membership.'
          );
          if (errData.alreadySubscribed && onSubscriptionSuccess) {
            onSubscriptionSuccess();
          }
          return;
        }
        throw new Error(errData.error || 'Failed to create payment order. Please try again.');
      }

      const data = await res.json();
      if (!data.order) {
        throw new Error('Server returned an invalid order payload.');
      }

      commitBillingFlowUpdate({
        step: 'payment_instructions',
        order: data.order,
        submission: null,
      });
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
      commitBillingFlowUpdate({
        step: 'payment_instructions',
        order: data.order,
        submission: null,
      });
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
        const resolvedEmailStatus =
          typeof data.emailStatus === 'string'
            ? data.emailStatus
            : data.emailStatus?.status;
        if (resolvedEmailStatus === 'sent') {
          setEmailDeliveryNotice(
            'A payment submission acknowledgement email has been dispatched to your registered address.'
          );
        } else if (
          resolvedEmailStatus === 'pending' ||
          resolvedEmailStatus === 'retryable_failure'
        ) {
          setEmailDeliveryNotice(
            'Payment reference recorded. Confirmation email delivery is queued.'
          );
        }
        commitBillingFlowUpdate({
          step: 'status_view',
          order: null,
          submission: data.submission,
        });
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
  // Step 3: Refresh Status on Demand (Strictly Read-Only Single Atomic Lookup)
  // ---------------------------------------------------------------------------
  const handleRefreshStatus = async () => {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    setErrorMessage(null);

    try {
      const statusRes = await fetch('/api/billing/status', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.billingFlow) {
          commitBillingFlowUpdate({
            step: statusData.billingFlow.step,
            order: statusData.billingFlow.order ?? null,
            submission: statusData.billingFlow.submission ?? submission,
            checkedAt: statusData.billingFlow.checkedAt,
            renewal: statusData.billingFlow.renewal,
          });
        } else {
          setLastCheckedAt(new Date());
        }
        if (statusData.entitlement?.isPremium) {
          if (onSubscriptionSuccess) onSubscriptionSuccess();
        }
      }
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
  // RENDER: INITIALIZING GUARD (Prevents Flashing Plan Review Before Resolution)
  // ---------------------------------------------------------------------------
  if (isResolvingInitialState) {
    return (
      <div
        style={{
          padding: '2.75rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '0.85rem',
          minHeight: 280,
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
        <div>
          <h2
            id="premium-offer-title"
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem 0',
            }}
          >
            Checking Membership &amp; Payment Status
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Loading your authoritative subscription state...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: STEP 1 — PLAN REVIEW
  // ---------------------------------------------------------------------------
  if (step === 'plan_review') {
    const isExpiredRenewal = billingFlow?.renewal?.stage === 'expired';
    const isAdminRestricted = Boolean(billingFlow?.renewal?.isAdminRestricted);

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
                background: isExpiredRenewal
                  ? 'rgba(245, 158, 11, 0.16)'
                  : 'rgba(99, 102, 241, 0.16)',
                color: isExpiredRenewal ? '#fbbf24' : 'var(--primary)',
                padding: '0.35rem 0.8rem',
                borderRadius: 999,
                border: isExpiredRenewal
                  ? '1px solid rgba(245, 158, 11, 0.35)'
                  : '1px solid rgba(99, 102, 241, 0.35)',
              }}
            >
              <Sparkles size={13} style={{ color: isExpiredRenewal ? '#fbbf24' : 'var(--primary)', flexShrink: 0 }} />
              <span>{isExpiredRenewal ? 'Membership Expired · Renew Access' : 'Membership Offer'}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoadingOrder}
              aria-label="Close modal"
              style={{
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #94a3b8)',
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
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              marginTop: '0.85rem',
              marginBottom: '0.35rem',
              lineHeight: 1.25,
            }}
          >
            {isExpiredRenewal
              ? 'Renew Your 30-Day JobNexus Premium'
              : 'Supercharge Your Job Search with Premium'}
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            {isExpiredRenewal
              ? billingFlow?.renewal?.message ||
                `Your previous 30-day cycle ended. Renew for ₹${PREMIUM_PLAN.priceInr} (regularly ₹${PREMIUM_PLAN.originalPriceInr}) to unlock unmasked employer identities and direct ATS links again — your saved jobs are safe.`
              : 'Bypass queues, reveal direct employer ATS application links, and organize target positions with dedicated tools.'}
          </p>
        </div>

        {/* Pricing Callout Box */}
        <div
          style={{
            margin: '0 2rem 1rem 2rem',
            padding: '1.1rem 1.35rem',
            borderRadius: 16,
            background: 'var(--surface-hover, rgba(79, 70, 229, 0.08))',
            border: '1px solid var(--border-card-hover, rgba(99, 102, 241, 0.3))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Authoritative Monthly Access
              </span>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#b45309',
                  background: 'rgba(245, 158, 11, 0.16)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  padding: '0.12rem 0.45rem',
                  borderRadius: 999,
                }}
              >
                {PREMIUM_PLAN.discountPercent}% OFF · Save ₹{PREMIUM_PLAN.savingsInr}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginTop: '0.25rem' }}>
              <s
                style={{
                  fontSize: '1.18rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textDecoration: 'line-through',
                }}
              >
                ₹{PREMIUM_PLAN.originalPriceInr}
              </s>
              <span style={{ fontSize: '2.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ₹{PREMIUM_PLAN.priceInr}
              </span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}>/ month</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--accent-emerald, #059669)',
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
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
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
              <Zap size={15} style={{ color: '#0284c7' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Direct Application Access:</strong> Get convenient access to available application links and move from job discovery to applying with fewer steps.
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
              <BookmarkCheck size={15} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Unlimited Saved Jobs:</strong> Organize and bookmark opportunities across all verified sources.
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
              <Eye size={15} style={{ color: '#7c3aed' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Clean Focus View:</strong> Distraction-free, zero-ad interface engineered for high-intent job seekers.
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
              <TrendingUp size={15} style={{ color: '#d97706' }} />
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Priority Feed Indexing:</strong> Early access to freshly indexed Indian tech and global remote roles.
            </div>
          </div>
        </div>

        {/* Administrative Restriction Notice */}
        {isAdminRestricted && (
          <div
            role="alert"
            style={{
              margin: '1rem 2rem 0 2rem',
              padding: '0.8rem 1rem',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--badge-crimson-text, #b91c1c)',
              fontSize: '0.82rem',
              lineHeight: 1.45,
            }}
          >
            Your membership is currently under administrative restriction and ineligible for self-service renewal. Please contact support if you need assistance.
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              margin: '1rem 2rem 0 2rem',
              padding: '0.75rem 1rem',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--badge-crimson-text, #b91c1c)',
              fontSize: '0.82rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Notice */}
        <div style={{ padding: '0.85rem 2rem 0.25rem 2rem' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, fontStyle: 'italic' }}>
            * Payment is processed manually via UPI. Upon payment, submit your 12-digit UTR reference. Premium access is granted only after an authorized administrator independently verifies your transaction with bank records and records approval (target review window within 12 hours). Refreshing or elapsed time does not grant access automatically.
          </p>
        </div>

        {/* Actions */}
        <div style={{ padding: '1rem 2rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isLoadingOrder || isAdminRestricted}
            style={{
              width: '100%',
              minHeight: 48,
              padding: '0.85rem 1.25rem',
              borderRadius: 12,
              background: isAdminRestricted
                ? 'rgba(100, 116, 139, 0.25)'
                : isLoadingOrder
                ? '#4338ca'
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: isAdminRestricted ? 'var(--text-muted)' : '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: 'none',
              cursor: isAdminRestricted ? 'not-allowed' : isLoadingOrder ? 'wait' : 'pointer',
              boxShadow: isAdminRestricted ? 'none' : '0 4px 18px rgba(79, 70, 229, 0.45)',
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
                <span>
                  {isExpiredRenewal ? (
                    <>
                      Renew via UPI (
                      <s style={{ opacity: 0.72, fontWeight: 500, marginRight: 5 }}>
                        ₹{PREMIUM_PLAN.originalPriceInr}
                      </s>
                      ₹{PREMIUM_PLAN.priceInr} / 30 Days)
                    </>
                  ) : (
                    <>
                      Proceed to UPI Payment (
                      <s style={{ opacity: 0.72, fontWeight: 500, marginRight: 5 }}>
                        ₹{PREMIUM_PLAN.originalPriceInr}
                      </s>
                      ₹{PREMIUM_PLAN.priceInr})
                    </>
                  )}
                </span>
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
              color: 'var(--text-secondary)',
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
                color: 'var(--accent-cyan, #0284c7)',
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
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #94a3b8)',
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
              color: 'var(--text-primary)',
              marginTop: '0.65rem',
              marginBottom: '0.25rem',
            }}
          >
            Pay{' '}
            {order.amountInr < PREMIUM_PLAN.originalPriceInr && (
              <s style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.05rem', marginRight: 6 }}>
                ₹{PREMIUM_PLAN.originalPriceInr}
              </s>
            )}
            ₹{order.amountInr} via UPI
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
            Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, Cred) or copy the UPI ID below.
          </p>
        </div>

        {/* QR Code and Payment Details Container */}
        <div
          style={{
            margin: '0 2rem 1rem 2rem',
            padding: '1.25rem',
            borderRadius: 18,
            background: 'var(--surface-hover, rgba(15, 23, 42, 0.85))',
            border: '1px solid var(--border)',
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
              background: 'var(--input-bg, rgba(0, 0, 0, 0.04))',
              border: '1px solid var(--input-border, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Business UPI ID ({order.payeeName})
              </span>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
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
                color: copySuccess ? '#059669' : 'var(--primary)',
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
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Order Ref: <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{order.orderId}</code>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Amount:{' '}
              {order.amountInr < PREMIUM_PLAN.originalPriceInr && (
                <s style={{ opacity: 0.7, marginRight: 4, color: 'var(--text-muted)' }}>₹{PREMIUM_PLAN.originalPriceInr}</s>
              )}
              <strong style={{ color: 'var(--accent-emerald, #059669)' }}>₹{order.amountInr}</strong>
            </span>
          </div>

          {/* Mobile Deep Link Button */}
          <a
            href={upiUri}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              borderRadius: 10,
              background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary)',
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
        <div style={{ margin: '0 2rem', padding: '0.7rem 0.95rem', borderRadius: 10, background: 'var(--badge-amber-bg, rgba(245, 158, 11, 0.1))', border: '1px solid var(--badge-amber-border, rgba(245, 158, 11, 0.25))', color: 'var(--badge-amber-text, #b45309)', fontSize: '0.78rem', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
          <AlertCircle size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Next Step Required:</strong> After transferring ₹{order.amountInr}, click below to submit your 12-digit UTR transaction reference so our team can verify and activate your Premium access.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '1.25rem 2rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() =>
              commitBillingFlowUpdate({
                step: 'submit_reference',
                order,
                submission: null,
              })
            }
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
            onClick={() =>
              commitBillingFlowUpdate({
                step: 'plan_review',
                order,
                submission: null,
              })
            }
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--text-secondary)',
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
                color: 'var(--accent-emerald, #059669)',
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
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #94a3b8)',
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
              color: 'var(--text-primary)',
              marginTop: '0.65rem',
              marginBottom: '0.25rem',
            }}
          >
            Confirm Your UPI Payment
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
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
                color: 'var(--text-primary)',
                marginBottom: '0.35rem',
              }}
            >
              UPI Transaction Reference (UTR) <span style={{ color: 'var(--badge-crimson-icon, #ef4444)' }}>*</span>
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
              className="upi-form-input"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                border: fieldErrors.utr ? '1px solid #ef4444' : '1px solid var(--input-border)',
                fontSize: '1rem',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                outline: 'none',
              }}
            />
            {fieldErrors.utr ? (
              <span id="utr-error" style={{ display: 'block', fontSize: '0.74rem', color: '#ef4444', marginTop: '0.3rem' }}>
                {fieldErrors.utr}
              </span>
            ) : (
              <span id="utr-help" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
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
                  color: 'var(--text-primary)',
                  marginBottom: '0.35rem',
                }}
              >
                Plan Amount{' '}
                {order.amountInr < PREMIUM_PLAN.originalPriceInr && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                    (<s style={{ opacity: 0.8 }}>₹{PREMIUM_PLAN.originalPriceInr}</s>)
                  </span>
                )}
              </label>
              <input
                id="amount-display"
                type="text"
                readOnly
                value={`₹${order.amountInr}`}
                className="upi-readonly-box"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
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
                  color: 'var(--text-primary)',
                  marginBottom: '0.35rem',
                }}
              >
                Payment Date <span style={{ color: 'var(--badge-crimson-icon, #ef4444)' }}>*</span>
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
                className="upi-form-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  border: fieldErrors.date ? '1px solid #ef4444' : '1px solid var(--input-border)',
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
                color: 'var(--text-primary)',
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
              className="upi-form-input"
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 10,
                border: '1px solid var(--input-border)',
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
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--badge-crimson-text, #b91c1c)',
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
            onClick={() =>
              commitBillingFlowUpdate({
                step: 'payment_instructions',
                order,
                submission: null,
              })
            }
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--text-secondary)',
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
  if (step === 'status_view' && (submission || isPremium)) {
    const isApproved = submission ? submission.status === 'approved' : isPremium;
    const isPending = submission?.status === 'pending_verification';
    const isRejected = submission?.status === 'rejected';

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
                color: isApproved ? 'var(--accent-emerald, #059669)' : isPending ? 'var(--accent-amber, #d97706)' : 'var(--badge-crimson-icon, #ef4444)',
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
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.05))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #94a3b8)',
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
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginTop: '0.85rem',
              marginBottom: '0.35rem',
            }}
          >
            {isApproved && 'Welcome to JobNexus Premium!'}
            {isPending && 'Payment Details Received'}
            {isRejected && 'Payment Verification Unsuccessful'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            {isApproved && 'Your payment has been verified. You now enjoy unmasked ATS links and priority alerts.'}
            {isPending && 'Our team is reviewing your UPI transaction reference against banking records.'}
            {isRejected && (submission?.decisionReason || 'We were unable to verify this transaction reference.')}
          </p>
        </div>

        {/* Error Banner inside Status View */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              margin: '0 2rem 1rem 2rem',
              padding: '0.75rem 1rem',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--badge-crimson-text, #b91c1c)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SLA Review Target Callout */}
        {isPending && (
          <div
            style={{
              margin: '0 2rem 1rem 2rem',
              padding: '1rem',
              borderRadius: 14,
              background: 'var(--badge-amber-bg, rgba(245, 158, 11, 0.1))',
              border: '1px solid var(--badge-amber-border, rgba(245, 158, 11, 0.25))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <Clock size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--badge-amber-text, #b45309)' }}>
                Review Target: Within 12 Hours
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
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
              color: 'var(--primary)',
            }}
          >
            <Mail size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>{emailDeliveryNotice}</span>
          </div>
        )}

        {/* Verification Summary Card */}
        {(submission || (isApproved && billingFlow?.renewal?.currentPeriodEnd)) && (
          <div
            style={{
              margin: '0 2rem 1rem 2rem',
              padding: '1.1rem 1.25rem',
              borderRadius: 14,
              background: 'var(--surface-hover, rgba(15, 23, 42, 0.8))',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              fontSize: '0.82rem',
            }}
          >
            {submission && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Submission ID:</span>
                  <code style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{submission.submissionId}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>UTR Reference:</span>
                  <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{submission.utrNumber}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Declared Amount:</span>
                  <span style={{ color: 'var(--accent-emerald, #059669)', fontWeight: 700 }}>₹{submission.declaredAmount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Payment Date:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{submission.paymentDate}</span>
                </div>
              </>
            )}
            {isApproved && billingFlow?.renewal?.currentPeriodEnd && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Access Valid Until:</span>
                <span style={{ color: 'var(--accent-amber, #d97706)', fontWeight: 700 }}>
                  {new Date(billingFlow.renewal.currentPeriodEnd).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Current Status:</span>
              <span style={{ color: isApproved ? 'var(--accent-emerald, #059669)' : isPending ? 'var(--accent-amber, #d97706)' : '#ef4444', fontWeight: 600 }}>
                {isApproved ? 'Approved' : isPending ? 'Pending Verification' : 'Rejected'}
              </span>
            </div>
          </div>
        )}

        {/* Early Renewal Window Callout (<= 5 Days Remaining or Cancelled Grace) */}
        {isApproved && billingFlow?.renewal?.canRenewNow && (
          <div
            style={{
              margin: '0 2rem 0.5rem 2rem',
              padding: '0.9rem 1rem',
              borderRadius: 12,
              background:
                billingFlow.renewal.stage === 'expiring_urgent'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'var(--badge-amber-bg, rgba(245, 158, 11, 0.1))',
              border:
                billingFlow.renewal.stage === 'expiring_urgent'
                  ? '1px solid rgba(239, 68, 68, 0.32)'
                  : '1px solid var(--badge-amber-border, rgba(245, 158, 11, 0.28))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.7rem',
            }}
          >
            <Clock
              size={18}
              style={{
                color:
                  billingFlow.renewal.stage === 'expiring_urgent' ? '#ef4444' : '#d97706',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color:
                    billingFlow.renewal.stage === 'expiring_urgent' ? 'var(--badge-crimson-text, #b91c1c)' : 'var(--badge-amber-text, #b45309)',
                }}
              >
                {billingFlow.renewal.headline}
              </div>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  margin: '0.2rem 0 0 0',
                  lineHeight: 1.45,
                }}
              >
                {billingFlow.renewal.message}
              </p>
            </div>
          </div>
        )}

        {/* Security Invariant Explanatory Banner */}
        {isPending && (
          <div style={{ margin: '0 2rem', padding: '0.65rem 0.85rem', borderRadius: 10, background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.45 }}>
            <ShieldCheck size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.35rem', color: 'var(--primary)' }} />
            <strong style={{ color: 'var(--text-primary)' }}>Security Invariant:</strong> Submitting a payment reference records your request for independent administrative verification. Refreshing the status is a read-only check for recorded approval and does not grant access or mutate records. Premium remains locked until approval is formally recorded.
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
                  background: isRefreshingStatus ? 'var(--surface)' : 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  color: isRefreshingStatus ? 'var(--text-muted)' : 'var(--text-primary)',
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
                <div style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  <span>Last checked:</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
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

          {isApproved && billingFlow?.renewal?.canRenewNow && (
            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={isLoadingOrder}
              style={{
                width: '100%',
                minHeight: 46,
                padding: '0.8rem 1rem',
                borderRadius: 12,
                background: isLoadingOrder
                  ? '#4338ca'
                  : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                border: 'none',
                cursor: isLoadingOrder ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(79, 70, 229, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
              }}
            >
              <span>
                {isLoadingOrder ? (
                  'Preparing Renewal Order...'
                ) : (
                  <>
                    Renew for +30 Days (
                    <s style={{ opacity: 0.72, fontWeight: 500, marginRight: 5 }}>
                      ₹{PREMIUM_PLAN.originalPriceInr}
                    </s>
                    ₹{PREMIUM_PLAN.priceInr})
                  </>
                )}
              </span>
              {!isLoadingOrder && <ArrowRight size={17} />}
            </button>
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
                background: billingFlow?.renewal?.canRenewNow
                  ? 'rgba(16, 185, 129, 0.14)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: billingFlow?.renewal?.canRenewNow ? 'var(--accent-emerald, #059669)' : '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                border: billingFlow?.renewal?.canRenewNow
                  ? '1px solid rgba(52, 211, 153, 0.35)'
                  : 'none',
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
              color: 'var(--text-secondary)',
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
