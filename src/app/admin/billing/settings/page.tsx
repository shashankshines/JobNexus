'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  RefreshCw,
  Save,
  Info,
  History,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { UpiQrCode } from '@/app/components/billing/UpiQrCode';
import { buildUpiPaymentUri } from '@/app/components/billing/upi-payment-uri';

interface PaymentSettingsData {
  upiId: string;
  payeeName: string;
  paymentDescription: string;
  updatedAt: string | null;
  updatedBy: string;
  version: number;
  isConfiguredInFirestore: boolean;
}

export default function AdminPaymentSettingsPage() {
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

  // Field validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Fetch settings on mount
  const fetchSettings = async () => {
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
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error while fetching settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Real-time client format validation
  const validateInputs = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedUpi = upiId.trim();
    const trimmedName = payeeName.trim();
    const trimmedDesc = paymentDescription.trim();

    if (!trimmedUpi) {
      errors.upiId = 'UPI ID (VPA) is required.';
    } else if (!/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/.test(trimmedUpi)) {
      errors.upiId = 'Invalid UPI ID format. Must follow standard VPA format (e.g. username@bank).';
    }

    if (!trimmedName) {
      errors.payeeName = 'Payee name is required.';
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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasChanges = useMemo(() => {
    if (!currentSettings) return false;
    return (
      upiId.trim() !== currentSettings.upiId ||
      payeeName.trim() !== currentSettings.payeeName ||
      paymentDescription.trim() !== currentSettings.paymentDescription
    );
  }, [currentSettings, upiId, payeeName, paymentDescription]);

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

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;
    setShowConfirmModal(true);
  };

  const handleCommitSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/billing/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upiId: upiId.trim(),
          payeeName: payeeName.trim(),
          paymentDescription: paymentDescription.trim(),
          reason: changeReason.trim() || 'Administrator updated payment settings via Admin UI',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        }
        setNotification({
          type: 'error',
          message: data.error || 'Failed to update payment settings.',
        });
        setShowConfirmModal(false);
        setSaving(false);
        return;
      }

      if (data.success && data.settings) {
        setCurrentSettings({
          ...data.settings,
          isConfiguredInFirestore: true,
        });
        setChangeReason('');
        setShowConfirmModal(false);
        setFieldErrors({});
        setNotification({
          type: 'success',
          message: `Payment settings updated successfully to version ${data.settings.version}. Immutable audit log recorded.`,
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network failure saving settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Render Access Denied Screen
  if (authError) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            {authError.statusCode === 401 ? 'Authentication Required' : 'Access Restricted'}
          </h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {authError.message}
          </p>
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition text-sm shadow-lg shadow-blue-500/20"
            >
              Return to Homepage
            </Link>
            <p className="text-xs text-slate-500">
              Only authorized Google accounts listed in the server environment allowlist may access this console.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition text-xs font-semibold flex items-center gap-1.5"
              title="Return to Admin Console"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">JobNexus</span>
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSettings}
              disabled={loading || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title & Context */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Payment Settings & UPI Configuration
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-3xl">
            Manage the authoritative business Virtual Payment Address (VPA), payee display name, and payment description.
            Modifications take effect immediately for all subsequent payment orders and are immutably logged.
          </p>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-red-500/10 border-red-500/30 text-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">{notification.message}</div>
          </div>
        )}

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading authoritative payment configuration...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form & Warnings (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Configuration Status Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  Active Configuration Status
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Source</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        currentSettings?.isConfiguredInFirestore ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {currentSettings?.isConfiguredInFirestore ? 'Firestore (Live)' : 'Env Fallback'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Config Version</span>
                    <span className="font-mono font-bold text-white">
                      v{currentSettings?.version ?? 0}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 col-span-2 sm:col-span-2">
                    <span className="text-slate-400 block mb-1">Last Updated</span>
                    <span className="text-slate-200 truncate block" title={currentSettings?.updatedAt || 'N/A'}>
                      {currentSettings?.updatedAt
                        ? new Date(currentSettings.updatedAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Default / Environment'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <form
                onSubmit={handleOpenConfirm}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-base font-semibold text-white">Update UPI Parameters</h2>
                  <span className="text-xs text-slate-400">Fixed Tier: ₹499 INR / Month</span>
                </div>

                {/* Field 1: UPI ID */}
                <div>
                  <label htmlFor="upiId" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Merchant UPI ID (VPA) <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="upiId"
                    type="text"
                    value={upiId}
                    onChange={(e) => {
                      setUpiId(e.target.value);
                      if (fieldErrors.upiId) setFieldErrors((prev) => ({ ...prev, upiId: '' }));
                    }}
                    placeholder="e.g. jobnexus@icici"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border font-mono text-sm text-white placeholder-slate-600 focus:outline-none transition ${
                      fieldErrors.upiId
                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                  {fieldErrors.upiId ? (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.upiId}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs mt-1.5">
                      The destination Virtual Payment Address where user payments are received.
                    </p>
                  )}
                </div>

                {/* Field 2: Payee Name */}
                <div>
                  <label htmlFor="payeeName" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Payee Legal / Display Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="payeeName"
                    type="text"
                    value={payeeName}
                    onChange={(e) => {
                      setPayeeName(e.target.value);
                      if (fieldErrors.payeeName) setFieldErrors((prev) => ({ ...prev, payeeName: '' }));
                    }}
                    placeholder="e.g. JobNexus Technologies"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border text-sm text-white placeholder-slate-600 focus:outline-none transition ${
                      fieldErrors.payeeName
                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                  {fieldErrors.payeeName ? (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.payeeName}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs mt-1.5">
                      The official merchant or business name shown to candidates inside UPI banking apps.
                    </p>
                  )}
                </div>

                {/* Field 3: Payment Description */}
                <div>
                  <label htmlFor="paymentDesc" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Default Transaction Description / Note <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="paymentDesc"
                    type="text"
                    value={paymentDescription}
                    onChange={(e) => {
                      setPaymentDescription(e.target.value);
                      if (fieldErrors.paymentDescription)
                        setFieldErrors((prev) => ({ ...prev, paymentDescription: '' }));
                    }}
                    placeholder="e.g. JobNexus Premium Subscription"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border text-sm text-white placeholder-slate-600 focus:outline-none transition ${
                      fieldErrors.paymentDescription
                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                  {fieldErrors.paymentDescription ? (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.paymentDescription}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs mt-1.5">
                      Included in the UPI payment URI memo (<code className="text-slate-400">tn=</code> parameter).
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {hasChanges ? 'Unsaved modifications pending' : 'All parameters up to date'}
                  </span>
                  <button
                    type="submit"
                    disabled={!hasChanges || saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-sm transition shadow-lg shadow-blue-500/20 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    Review & Save Settings
                  </button>
                </div>
              </form>

              {/* Operational Invariants & Notice Cards */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs leading-relaxed flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-white">Order Snapshot Invariance:</strong> Updating these
                    settings immediately configures all future payment orders generated across JobNexus. Existing
                    active orders and pending verification submissions preserve their original immutable snapshot.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs leading-relaxed flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-white">Bank Account Ownership Verification:</strong> Syntax
                    validation guarantees that the entered UPI VPA conforms to official NPCI naming standards. It does
                    not verify bank account ownership. Always send a test micro-transaction to verify incoming credit
                    before deploying in production.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live QR Preview & UPI Deep Link (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-white">Real-Time QR & Link Preview</h2>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Sparkles className="w-3 h-3" />
                    Live Render
                  </span>
                </div>

                {previewUri ? (
                  <div className="flex flex-col items-center">
                    <div className="p-4 bg-white rounded-2xl shadow-xl mb-4">
                      <UpiQrCode
                        upiUri={previewUri}
                        size={180}
                        upiId={upiId.trim()}
                        altText="Live Preview QR Code"
                      />
                    </div>

                    <div className="w-full space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payee</span>
                        <span className="text-white font-medium">{payeeName.trim() || 'JobNexus'}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">UPI ID (VPA)</span>
                        <span className="text-blue-400 font-mono break-all">{upiId.trim()}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Generated Deep Link URI
                        </span>
                        <code className="text-slate-300 text-[11px] font-mono break-all block mt-0.5">
                          {previewUri}
                        </code>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Enter a valid UPI ID to generate live QR and payment preview.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Payment Settings Update</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This transaction will update the authoritative Firestore document and record an immutable audit log.
                </p>
              </div>
            </div>

            {/* Changes Diff Table */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3 text-xs">
              <div className="flex flex-col gap-1 border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Merchant UPI ID</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400 line-through">{currentSettings?.upiId || 'None'}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-emerald-400 font-bold">{upiId.trim()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Payee Display Name</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 line-through">{currentSettings?.payeeName || 'None'}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-emerald-400 font-bold">{payeeName.trim()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Payment Description</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 line-through truncate max-w-[150px]">
                    {currentSettings?.paymentDescription || 'None'}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="text-emerald-400 font-bold truncate max-w-[200px]">
                    {paymentDescription.trim()}
                  </span>
                </div>
              </div>
            </div>

            {/* Reason for Audit Log */}
            <div>
              <label htmlFor="auditReason" className="block text-xs font-medium text-slate-300 mb-1">
                Reason for change (recorded in security audit log):
              </label>
              <input
                id="auditReason"
                type="text"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="e.g. Updating receiving merchant account after corporate bank migration"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Invariant Reminder */}
            <p className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
              <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Reminder:</strong> Newly generated orders will reference Version {(currentSettings?.version ?? 0) + 1}. Existing orders will continue using their respective recorded snapshots.
              </span>
            </p>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold transition shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Committing to Firestore...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirm & Apply Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
