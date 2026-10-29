'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  Info,
  History,
  QrCode,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { UpiQrCode } from '@/app/components/billing/UpiQrCode';
import { buildUpiPaymentUri } from '@/app/components/billing/upi-payment-uri';

export interface PaymentSettingsData {
  upiId: string;
  payeeName: string;
  paymentDescription: string;
  updatedAt: string | null;
  updatedBy: string;
  version: number;
  isConfiguredInFirestore: boolean;
}

interface PaymentSettingsViewProps {
  onRefreshParent?: () => void;
}

export function PaymentSettingsView({ onRefreshParent }: PaymentSettingsViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [authError, setAuthError] = useState<{ statusCode: number; message: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Authoritative server settings
  const [currentSettings, setCurrentSettings] = useState<PaymentSettingsData | null>(null);

  // Form input state
  const [upiId, setUpiId] = useState<string>('');
  const [payeeName, setPayeeName] = useState<string>('');
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');

  // Confirmation modal & copy states
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [copiedUpiId, setCopiedUpiId] = useState<boolean>(false);
  const [copiedUri, setCopiedUri] = useState<boolean>(false);

  // Fetch settings from authoritative API
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/billing/settings');
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setAuthError({
            statusCode: res.status,
            message: data.error || 'Access denied. You do not have administrator permissions.',
          });
        } else {
          setNotification({
            type: 'error',
            message: data.error || 'Failed to fetch payment settings.',
          });
        }
        setLoading(false);
        return;
      }

      if (data.success && data.settings) {
        setCurrentSettings(data.settings);
        setUpiId(data.settings.upiId || '');
        setPayeeName(data.settings.payeeName || '');
        setPaymentDescription(data.settings.paymentDescription || 'JobNexus Premium Subscription');
        setChangeReason('');
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error while fetching settings.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: { upiId?: string; payeeName?: string; paymentDescription?: string; changeReason?: string } = {};
    const trimmedUpi = upiId.trim();
    const trimmedName = payeeName.trim();
    const trimmedDesc = paymentDescription.trim();

    if (!trimmedUpi) {
      errors.upiId = 'Merchant UPI ID (VPA) is required.';
    } else if (!/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/.test(trimmedUpi)) {
      errors.upiId = 'Invalid format. Must follow standard username@bank VPA format.';
    }

    if (!trimmedName) {
      errors.payeeName = 'Payee display name is required.';
    } else if (trimmedName.length < 2 || trimmedName.length > 100) {
      errors.payeeName = 'Payee name must be between 2 and 100 characters.';
    } else if (/[<>]/.test(trimmedName)) {
      errors.payeeName = 'Payee name cannot contain angle brackets or HTML tags.';
    }

    if (!trimmedDesc) {
      errors.paymentDescription = 'Payment description is required.';
    } else if (trimmedDesc.length < 1 || trimmedDesc.length > 120) {
      errors.paymentDescription = 'Payment description must be between 1 and 120 characters.';
    } else if (/[\r\n<>]/.test(trimmedDesc)) {
      errors.paymentDescription = 'Payment description cannot contain line breaks or HTML tags.';
    }

    return errors;
  }, [upiId, payeeName, paymentDescription]);

  const isValid = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors]);

  const hasChanges = useMemo(() => {
    if (!currentSettings) return false;
    return (
      upiId.trim() !== currentSettings.upiId ||
      payeeName.trim() !== currentSettings.payeeName ||
      paymentDescription.trim() !== currentSettings.paymentDescription
    );
  }, [currentSettings, upiId, payeeName, paymentDescription]);

  // Discard changes
  const handleDiscardChanges = () => {
    if (!currentSettings) return;
    setUpiId(currentSettings.upiId || '');
    setPayeeName(currentSettings.payeeName || '');
    setPaymentDescription(currentSettings.paymentDescription || 'JobNexus Premium Subscription');
    setChangeReason('');
    setNotification(null);
  };

  // Prevent accidental navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Preview URI
  const previewUri = useMemo(() => {
    try {
      if (!upiId.trim()) return '';
      return buildUpiPaymentUri({
        upiId: upiId.trim(),
        payeeName: payeeName.trim() || 'JobNexus',
        amountInr: 499,
        note: paymentDescription.trim() || 'JobNexus Premium Subscription',
      });
    } catch {
      return '';
    }
  }, [upiId, payeeName, paymentDescription]);

  // Copy handlers
  const handleCopyUpiId = async () => {
    if (!upiId.trim()) return;
    try {
      await navigator.clipboard.writeText(upiId.trim());
      setCopiedUpiId(true);
      setTimeout(() => setCopiedUpiId(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyUri = async () => {
    if (!previewUri) return;
    try {
      await navigator.clipboard.writeText(previewUri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Execute update
  const handleCommitSave = async () => {
    if (!isValid || !hasChanges || saving) return;

    if (!changeReason.trim() || changeReason.trim().length < 3) {
      setNotification({
        type: 'error',
        message: 'A brief change reason (at least 3 characters) is required for the immutable audit trail.',
      });
      return;
    }

    setSaving(true);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId: upiId.trim(),
          payeeName: payeeName.trim(),
          paymentDescription: paymentDescription.trim(),
          reason: changeReason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setNotification({
          type: 'error',
          message: data.error || (data.fieldErrors ? Object.values(data.fieldErrors).join(', ') : 'Update rejected by server.'),
        });
        setShowConfirmModal(false);
        setSaving(false);
        return;
      }

      setCurrentSettings(data.settings);
      setUpiId(data.settings.upiId);
      setPayeeName(data.settings.payeeName);
      setPaymentDescription(data.settings.paymentDescription);
      setChangeReason('');
      setShowConfirmModal(false);

      setNotification({
        type: 'success',
        message: `Payment configuration updated successfully (v${data.settings.version}). All future orders will use these receiving parameters.`,
      });

      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error during save.',
      });
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  };

  // Auth Error View
  if (authError) {
    return (
      <div className="admin-card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 640, margin: '2rem auto' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', color: '#f87171' }}>
          <Lock size={28} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          {authError.statusCode === 401 ? 'Authentication Required' : 'Unauthorized Access'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {authError.message}
        </p>
        <button
          onClick={fetchSettings}
          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: 'var(--primary)', color: '#ffffff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Retry Authentication
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Notifications */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: 12,
            background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            color: notification.type === 'success' ? 'var(--badge-emerald-text, #10b981)' : '#ef4444',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2, color: '#10b981' }} />
          ) : (
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#ef4444' }} />
          )}
          <div style={{ flex: 1, fontWeight: 500 }}>{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            aria-label="Dismiss banner"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.1rem', opacity: 0.8 }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Loading authoritative payment configuration and operational status...
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Configuration Status Card */}
          <div className="admin-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={16} style={{ color: 'var(--primary-start)' }} />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                  Active Operational Configuration Status
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasChanges ? (
                  <span className="admin-badge-pending">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.5s infinite' }} />
                    Unsaved Edits Pending
                  </span>
                ) : (
                  <span className="admin-badge-approved">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                    Authoritative & Active
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Source */}
              <div className="admin-card-inner" style={{ padding: '0.85rem 1rem', borderRadius: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Configuration Source
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {currentSettings?.isConfiguredInFirestore ? (
                    <>
                      <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                      <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>Firestore Document (Live)</strong>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <strong style={{ fontSize: '0.85rem', color: '#f59e0b' }}>Environment Fallback</strong>
                    </>
                  )}
                </div>
              </div>

              {/* Version */}
              <div className="admin-card-inner" style={{ padding: '0.85rem 1rem', borderRadius: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Configuration Version
                </span>
                <code style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary-start)' }}>
                  v{currentSettings?.version ?? 0}
                </code>
              </div>

              {/* Last Updated */}
              <div className="admin-card-inner" style={{ padding: '0.85rem 1rem', borderRadius: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Last Modification
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentSettings?.updatedAt
                    ? new Date(currentSettings.updatedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'System Default / Initial'}
                </span>
              </div>

              {/* Actor */}
              <div className="admin-card-inner" style={{ padding: '0.85rem 1rem', borderRadius: 10 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Updated By
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {currentSettings?.updatedBy || 'System Fallback'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Content Grid: Form (Left) & Live Preview (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left Column: Form Controls */}
            <div className="admin-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                  Receiving UPI Parameters
                </h3>
                {hasChanges && (
                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={12} />
                    Discard Edits
                  </button>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isValid && hasChanges) setShowConfirmModal(true);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                {/* Field 1: UPI ID */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label htmlFor="admin-upi-id" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Merchant UPI ID / VPA <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Standard Virtual Payment Address</span>
                  </div>
                  <input
                    id="admin-upi-id"
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. jobnexus@okhdfcbank"
                    className="admin-form-input"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-mono)',
                      borderColor: validationErrors.upiId ? '#ef4444' : undefined,
                    }}
                  />
                  {validationErrors.upiId ? (
                    <span style={{ display: 'block', color: '#ef4444', fontSize: '0.72rem', marginTop: '0.35rem', fontWeight: 600 }}>
                      {validationErrors.upiId}
                    </span>
                  ) : (
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                      Receives user UPI transactions. Must be an active, verified merchant/business account.
                    </span>
                  )}
                </div>

                {/* Field 2: Payee Display Name */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label htmlFor="admin-payee-name" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Payee Display Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>2-100 characters</span>
                  </div>
                  <input
                    id="admin-payee-name"
                    type="text"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="e.g. JobNexus Careers"
                    className="admin-form-input"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      fontSize: '0.88rem',
                      borderColor: validationErrors.payeeName ? '#ef4444' : undefined,
                    }}
                  />
                  {validationErrors.payeeName ? (
                    <span style={{ display: 'block', color: '#ef4444', fontSize: '0.72rem', marginTop: '0.35rem', fontWeight: 600 }}>
                      {validationErrors.payeeName}
                    </span>
                  ) : (
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                      Name shown to candidates inside Google Pay, PhonePe, Paytm, or BHIM.
                    </span>
                  )}
                </div>

                {/* Field 3: Payment Description */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label htmlFor="admin-payment-desc" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Payment Description / Transaction Note <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>1-120 characters</span>
                  </div>
                  <input
                    id="admin-payment-desc"
                    type="text"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    placeholder="e.g. JobNexus Premium Subscription"
                    className="admin-form-input"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      fontSize: '0.88rem',
                      borderColor: validationErrors.paymentDescription ? '#ef4444' : undefined,
                    }}
                  />
                  {validationErrors.paymentDescription ? (
                    <span style={{ display: 'block', color: '#ef4444', fontSize: '0.72rem', marginTop: '0.35rem', fontWeight: 600 }}>
                      {validationErrors.paymentDescription}
                    </span>
                  ) : (
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                      Pre-populated purpose of payment. Visible on candidate transaction histories.
                    </span>
                  )}
                </div>

                {/* Field 4: Fixed Plan Pricing (Server-Authoritative Invariant) */}
                <div className="admin-card-inner" style={{ padding: '0.85rem 1rem', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Lock size={12} style={{ color: 'var(--primary)' }} />
                      Plan Pricing Invariant
                    </label>
                    <span className="admin-badge-info">
                      Server-Authoritative
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>₹499 INR</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>/ 30-day Premium membership</span>
                  </div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                    Fixed system pricing invariant. Modifications are strictly restricted to codebase constants to maintain billing integrity.
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={fetchSettings}
                    disabled={loading || saving}
                    className="admin-btn-secondary"
                    style={{
                      padding: '0.65rem 1rem',
                      fontSize: '0.82rem',
                      cursor: loading || saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Refresh
                  </button>
                  <button
                    type="submit"
                    disabled={!hasChanges || !isValid || saving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.25rem',
                      borderRadius: 8,
                      background: hasChanges && isValid ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(255, 255, 255, 0.05)',
                      border: hasChanges && isValid ? '1px solid #818cf8' : '1px solid var(--border)',
                      color: hasChanges && isValid ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: hasChanges && isValid && !saving ? 'pointer' : 'not-allowed',
                      boxShadow: hasChanges && isValid ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                    }}
                  >
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Review & Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Live Interactive Preview */}
            <div className="admin-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <QrCode size={18} style={{ color: 'var(--primary)' }} />
                  Live Operational QR & Deep-Link Preview
                </h3>
                <span className="admin-badge-info">
                  Dynamic
                </span>
              </div>

              {/* QR Container */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', borderRadius: 14, background: 'var(--surface-secondary, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                {previewUri ? (
                  <UpiQrCode upiUri={previewUri} size={200} upiId={upiId.trim()} />
                ) : (
                  <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enter valid UPI ID to preview QR</span>
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {payeeName.trim() || 'JobNexus'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {upiId.trim() || 'handle@bank'}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                    ₹499 INR Fixed
                  </div>
                </div>
              </div>

              {/* Generated Deep-Link URI & Copy Controls */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Generated UPI Deep-Link URI
                </span>
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    background: 'var(--surface-secondary, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: previewUri ? 'var(--text-primary)' : 'var(--text-muted)',
                    wordBreak: 'break-all',
                    lineHeight: 1.45,
                    userSelect: 'all',
                  }}
                >
                  {previewUri || 'upi://pay?pa=...'}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleCopyUpiId}
                  disabled={!upiId.trim()}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 8,
                    background: copiedUpiId ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.12)',
                    border: copiedUpiId ? '1px solid #10b981' : '1px solid rgba(99, 102, 241, 0.3)',
                    color: copiedUpiId ? '#10b981' : 'var(--primary-start)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: upiId.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copiedUpiId ? <Check size={14} /> : <Copy size={14} />}
                  {copiedUpiId ? 'UPI ID Copied!' : 'Copy UPI ID'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyUri}
                  disabled={!previewUri}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 8,
                    background: copiedUri ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: copiedUri ? '1px solid #10b981' : '1px solid var(--border)',
                    color: copiedUri ? '#10b981' : 'var(--text-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: previewUri ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copiedUri ? <Check size={14} /> : <ExternalLink size={14} />}
                  {copiedUri ? 'URI Copied!' : 'Copy Payment URI'}
                </button>
              </div>

              {/* Operational Verification Disclaimer */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <Info size={14} />
                  Operational Verification Notice
                </div>
                Syntactic validation confirms URI formatting only; credit receipt must be independently verified in the bank or merchant collection account before approving payment claims in the Verification Queue.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            className="admin-card"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: '1.75rem',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 id="confirm-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Confirm Payment Configuration Update
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Immutable Audit Trail Commit
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              You are about to modify the authoritative receiving payment configuration. All subsequent order generations will reflect these updated details. Existing orders will retain their original snapshot.
            </p>

            <div className="admin-card-inner" style={{ padding: '0.85rem 1rem', borderRadius: 10, marginBottom: '1.25rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Target VPA:</span>{' '}
                <code className="admin-code-utr">{upiId.trim()}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Target Payee:</span>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{payeeName.trim()}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Target Description:</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>{paymentDescription.trim()}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="audit-change-reason" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Operational Rationale (Required for Audit Log) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                id="audit-change-reason"
                rows={2}
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="e.g. Migrated receiving handle to primary HDFC corporate account"
                className="admin-form-input"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.82rem',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="admin-btn-secondary"
                style={{
                  padding: '0.6rem 1.15rem',
                  fontSize: '0.82rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitSave}
                disabled={saving || !changeReason.trim() || changeReason.trim().length < 3}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: '1px solid #34d399',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: saving || !changeReason.trim() || changeReason.trim().length < 3 ? 'not-allowed' : 'pointer',
                  opacity: saving || !changeReason.trim() || changeReason.trim().length < 3 ? 0.6 : 1,
                }}
              >
                {saving ? 'Committing...' : 'Commit Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
