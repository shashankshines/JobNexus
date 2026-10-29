'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  UserCheck,
  CreditCard,
  Settings,
  History,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
  AlertOctagon,
  FileText,
  Mail,
  X,
} from 'lucide-react';
import { SubmissionWithOrder, AdminOverviewMetrics } from '@/modules/storage/firestore/admin-billing.store';
import { SubscriptionDocument, AdminAuditLogDocument } from '@/modules/storage/firestore/collections';

type AdminTab = 'overview' | 'verifications' | 'subscriptions' | 'settings_preview' | 'audit_logs';

export default function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ statusCode: number; message: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Overview metrics
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);

  // Submissions state
  const [submissions, setSubmissions] = useState<SubmissionWithOrder[]>([]);
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'pending_verification' | 'approved' | 'rejected'>('pending_verification');
  const [submissionsLoading, setSubmissionsLoading] = useState<boolean>(false);

  // Action Modals state
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithOrder | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState<boolean>(false);
  const [approvalChecked, setApprovalChecked] = useState<boolean>(false);
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Array<SubscriptionDocument & { entitlement?: { isPremium: boolean; status: string } }>>([]);
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');
  const [subscriptionsLoading, setSubscriptionsLoading] = useState<boolean>(false);

  // Subscription Control Modal state
  const [controlModalOpen, setControlModalOpen] = useState<boolean>(false);
  const [controlAction, setControlAction] = useState<'grant' | 'extend' | 'suspend' | 'reinstate' | 'revoke'>('grant');
  const [controlTargetUserId, setControlTargetUserId] = useState<string>('');
  const [controlTargetUserEmail, setControlTargetUserEmail] = useState<string>('');
  const [controlDays, setControlDays] = useState<number>(30);
  const [controlReason, setControlReason] = useState<string>('');

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDocument[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  // Load Overview Data
  const fetchOverview = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setAuthError({
            statusCode: res.status,
            message: data.error || 'Access denied. Administrator privileges required.',
          });
        }
        return;
      }
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network failure loading overview.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load Submissions
  const fetchSubmissions = useCallback(async (status = submissionFilter) => {
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/submissions?status=${status}&limit=50`);
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.warn('[AdminConsole] Failed to fetch submissions:', err);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionFilter]);

  // Load Subscriptions
  const fetchSubscriptions = useCallback(async (userIdQuery?: string) => {
    setSubscriptionsLoading(true);
    try {
      const url = userIdQuery
        ? `/api/admin/subscriptions?userId=${encodeURIComponent(userIdQuery)}`
        : '/api/admin/subscriptions?limit=50';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.subscriptions)) {
        setSubscriptions(data.subscriptions);
      }
    } catch (err) {
      console.warn('[AdminConsole] Failed to fetch subscriptions:', err);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, []);

  // Load Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs?limit=50');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.warn('[AdminConsole] Failed to fetch audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'verifications') {
      fetchSubmissions(submissionFilter);
    } else if (activeTab === 'subscriptions') {
      fetchSubscriptions(subSearchQuery);
    } else if (activeTab === 'audit_logs') {
      fetchAuditLogs();
    }
  }, [activeTab, submissionFilter, subSearchQuery, fetchSubmissions, fetchSubscriptions, fetchAuditLogs]);

  // Execute Approval
  const handleApprove = async () => {
    if (!selectedSubmission) return;
    if (!approvalChecked) {
      alert('You must confirm that credit was verified in the bank statement.');
      return;
    }

    setActionInProgress(true);
    try {
      const res = await fetch('/api/admin/billing/submissions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedSubmission.submissionId,
          confirmationChecked: true,
          verificationNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: `Submission ${selectedSubmission.submissionId} approved. Premium access activated for user ${selectedSubmission.userId}.`,
        });
        setApprovalModalOpen(false);
        setSelectedSubmission(null);
        setApprovalChecked(false);
        setVerificationNotes('');
        fetchSubmissions(submissionFilter);
        fetchOverview();
      } else {
        alert(data.error || 'Failed to approve submission.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error during approval.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Execute Rejection
  const handleReject = async () => {
    if (!selectedSubmission) return;
    if (!rejectionReason.trim()) {
      alert('A mandatory rejection reason is required.');
      return;
    }

    setActionInProgress(true);
    try {
      const res = await fetch('/api/admin/billing/submissions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedSubmission.submissionId,
          reason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: `Submission ${selectedSubmission.submissionId} rejected. UTR released.`,
        });
        setRejectionModalOpen(false);
        setSelectedSubmission(null);
        setRejectionReason('');
        fetchSubmissions(submissionFilter);
        fetchOverview();
      } else {
        alert(data.error || 'Failed to reject submission.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error during rejection.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Execute Subscription Control Action
  const handleControlSubmit = async () => {
    if (!controlTargetUserId.trim()) {
      alert('Target User ID is required.');
      return;
    }
    if (!controlReason.trim()) {
      alert('A mandatory administrative reason is required.');
      return;
    }

    setActionInProgress(true);
    try {
      const res = await fetch('/api/admin/subscriptions/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: controlAction,
          targetUserId: controlTargetUserId.trim(),
          reason: controlReason.trim(),
          days: controlDays,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: data.message || `Action ${controlAction} applied to ${controlTargetUserId}.`,
        });
        setControlModalOpen(false);
        setControlReason('');
        fetchSubscriptions(subSearchQuery);
        fetchOverview();
      } else {
        alert(data.error || `Failed to execute ${controlAction}.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error during subscription update.');
    } finally {
      setActionInProgress(false);
    }
  };

  // ==========================================================================
  // Render: Authentication or Authorization Error State
  // ==========================================================================
  if (authError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: 520, width: '100%', background: '#0d1321', borderRadius: 20, border: '1px solid rgba(239, 68, 68, 0.35)', padding: '2.5rem', textAlign: 'center', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#f87171' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem' }}>
            {authError.statusCode === 401 ? 'Sign-In Required' : 'Administrator Authorization Required'}
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.55, marginBottom: '1.5rem' }}>
            {authError.message}
          </p>
          <div style={{ padding: '0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.75rem', fontSize: '0.8rem', color: '#cbd5e1', textAlign: 'left' }}>
            <strong>Designated Administrator:</strong> <code>shashankshines@gmail.com</code>
            <br />
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Requires active Google OAuth authentication. Credentials accounts and non-allowlisted emails are denied by design.
            </span>
          </div>
          <Link
            href="/api/auth/google"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.85rem', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 700, fontSize: '0.92rem', textDecoration: 'none' }}
          >
            Authenticate with Google
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Render: Main Admin Console
  // ==========================================================================
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background, #080c14)', color: 'var(--text-primary, #f8fafc)', paddingBottom: '4rem' }}>
      {/* Top Header */}
      <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(13, 20, 36, 0.75)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>JobNexus Admin Console</h1>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: 6, background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe', fontWeight: 700 }}>
                  Phase 2B.3B
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                Forensic Audit, Payment Verification Queue & Authoritative Entitlement Controls
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
            >
              Back to Job Search
            </Link>
            <button
              onClick={() => {
                fetchOverview();
                if (activeTab === 'verifications') fetchSubmissions();
                if (activeTab === 'subscriptions') fetchSubscriptions(subSearchQuery);
                if (activeTab === 'audit_logs') fetchAuditLogs();
              }}
              aria-label="Refresh console data"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1280, margin: '1.5rem auto 0 auto', padding: '0 1.5rem' }}>
        {/* Notification Banner */}
        {notification && (
          <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1.25rem', borderRadius: 12, background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, color: notification.type === 'success' ? '#a7f3d0' : '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} aria-label="Dismiss notification" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
          {[
            { id: 'overview', label: 'Overview & Reviews', icon: ShieldCheck, badge: metrics?.pendingCount },
            { id: 'verifications', label: 'Payment Verification Queue', icon: CreditCard, badge: metrics?.pendingCount },
            { id: 'subscriptions', label: 'Subscriptions & Entitlements', icon: Users, badge: metrics?.activeSubscribersCount },
            { id: 'settings_preview', label: 'Payment Settings', icon: Settings },
            { id: 'audit_logs', label: 'Audit Trail', icon: History, badge: metrics?.totalAuditLogsCount },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  borderRadius: 10,
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} style={{ color: isActive ? '#818cf8' : '#64748b' }} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: 999, background: isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.1)', color: '#ffffff', fontWeight: 700 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {/* Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: 16, background: '#0d1321', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fbbf24', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pending Verification</span>
                  <Clock size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fde68a' }}>
                  {metrics ? metrics.pendingCount : '...'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Awaiting manual bank credit check</span>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: 16, background: '#0d1321', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f87171', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>SLA Breaches (&gt;12h)</span>
                  <AlertOctagon size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fecaca' }}>
                  {metrics ? metrics.slaBreachCount : '...'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Over target review window</span>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: 16, background: '#0d1321', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#34d399', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active Subscribers</span>
                  <UserCheck size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a7f3d0' }}>
                  {metrics ? metrics.activeSubscribersCount : '...'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Verified Premium memberships</span>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: 16, background: '#0d1321', border: '1px solid rgba(99, 102, 241, 0.3)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#818cf8', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Audit Records</span>
                  <History size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c7d2fe' }}>
                  {metrics ? metrics.totalAuditLogsCount : '...'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Immutable governance events</span>
              </div>
            </div>

            {/* Invariant Highlights */}
            <div style={{ padding: '1.5rem', borderRadius: 18, background: '#0d1321', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: '#818cf8' }} />
                Architectural Invariants & Governance Rules
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <div style={{ padding: '1rem', borderRadius: 12, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <strong style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    <Lock size={15} style={{ color: '#10b981' }} />
                    Exactly-Once Approval
                  </strong>
                  Approvals execute atomically in Firestore transactions. Duplicate approval attempts are idempotent and will never consume a UTR twice or duplicate subscription extensions.
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <strong style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    <Clock size={15} style={{ color: '#818cf8' }} />
                    Authoritative Period Formula
                  </strong>
                  Subscription extensions preserve remaining validity: <code>newPeriodEnd = max(now, currentPeriodEnd) + 30 days</code>. Users never lose paid days.
                </div>
                <div style={{ padding: '1rem', borderRadius: 12, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <strong style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    <FileText size={15} style={{ color: '#f59e0b' }} />
                    Mandatory Decision Reasons
                  </strong>
                  Every rejection, manual grant, extension, suspension, or reinstatement requires a non-empty administrative reason, permanently audited in <code>admin_audit_logs</code>.
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSubmissionFilter('pending_verification');
                  setActiveTab('verifications');
                }}
                style={{ padding: '0.85rem 1.25rem', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 700, fontSize: '0.88rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Review Pending Payments ({metrics?.pendingCount || 0})
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => {
                  setControlAction('grant');
                  setControlTargetUserId('');
                  setControlDays(30);
                  setControlReason('');
                  setControlModalOpen(true);
                }}
                style={{ padding: '0.85rem 1.25rem', borderRadius: 12, background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <UserCheck size={16} />
                Manual Premium Grant
              </button>
              <Link
                href="/admin/billing/settings"
                style={{ padding: '0.85rem 1.25rem', borderRadius: 12, background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff', fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Settings size={16} />
                Manage UPI Payment Settings
              </Link>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENT VERIFICATION QUEUE */}
        {activeTab === 'verifications' && (
          <div>
            {/* Filter buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { id: 'pending_verification', label: 'Pending Verification' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                  { id: 'all', label: 'All Submissions' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSubmissionFilter(f.id as typeof submissionFilter);
                      fetchSubmissions(f.id as typeof submissionFilter);
                    }}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: submissionFilter === f.id ? 700 : 500,
                      background: submissionFilter === f.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      border: submissionFilter === f.id ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: submissionFilter === f.id ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Showing {submissions.length} submissions
              </span>
            </div>

            {/* Submissions List */}
            {submissionsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#0d1321', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>No submissions found for current filter.</p>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>All pending verifications are up to date.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {submissions.map((sub) => {
                  const isPending = sub.status === 'pending_verification';
                  const isApproved = sub.status === 'approved';
                  const isRejected = sub.status === 'rejected';
                  const isSlaBreached = isPending && new Date(sub.slaDeadlineAt).getTime() < Date.now();

                  return (
                    <div
                      key={sub.submissionId}
                      style={{
                        padding: '1.25rem',
                        borderRadius: 16,
                        background: '#0d1321',
                        border: isSlaBreached
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : isPending
                          ? '1px solid rgba(245, 158, 11, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                      }}
                    >
                      {/* Top Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 6, background: isApproved ? 'rgba(16, 185, 129, 0.15)' : isRejected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: isApproved ? '#a7f3d0' : isRejected ? '#fecaca' : '#fde68a', border: `1px solid ${isApproved ? 'rgba(16, 185, 129, 0.3)' : isRejected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}` }}>
                            {isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : isSlaBreached ? 'PENDING (SLA BREACH)' : 'PENDING REVIEW'}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                            UTR: <code>{sub.utrNumber}</code>
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.6rem', borderRadius: 999, background: 'rgba(99, 102, 241, 0.14)', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.76rem', color: '#c7d2fe', fontWeight: 600 }}>
                            <Mail size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
                            <span>{sub.userEmail || 'Email not recorded'}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Submitted: {new Date(sub.submittedAt).toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', padding: '0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Subscriber Email:</span>
                          <strong style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                            <Mail size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
                            {sub.userEmail || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Not recorded</span>}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>User ID:</span>
                          <code style={{ color: '#c7d2fe' }}>{sub.userId}</code>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Declared Amount:</span>
                          <strong style={{ color: '#10b981' }}>₹{sub.declaredAmount} INR</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Payment Date:</span>
                          <span>{sub.paymentDate}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Associated Order:</span>
                          <span><code>{sub.orderId}</code> ({sub.order?.upiId || 'snapshot n/a'})</span>
                        </div>
                      </div>

                      {/* Review Metadata if decided */}
                      {sub.reviewedBy && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Reviewed by <strong>{sub.reviewedBy}</strong> at {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleString('en-IN') : 'n/a'}
                          {sub.decisionReason && <> — Reason: &quot;{sub.decisionReason}&quot;</>}
                          {sub.verificationNotes && <> — Notes: &quot;{sub.verificationNotes}&quot;</>}
                        </div>
                      )}

                      {/* Actions for Pending */}
                      {isPending && (
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.35rem' }}>
                          <button
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setRejectionReason('');
                              setRejectionModalOpen(true);
                            }}
                            style={{ padding: '0.45rem 0.85rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reject Payment
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setApprovalChecked(false);
                              setVerificationNotes('');
                              setApprovalModalOpen(true);
                            }}
                            style={{ padding: '0.45rem 1rem', borderRadius: 8, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <CheckCircle2 size={14} />
                            Verify & Approve (₹499)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SUBSCRIPTIONS & ENTITLEMENTS */}
        {activeTab === 'subscriptions' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: 420 }}>
                <input
                  type="text"
                  placeholder="Filter by Subscriber Email or User ID (e.g. user@gmail.com or usr_...)"
                  value={subSearchQuery}
                  onChange={(e) => setSubSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '0.85rem' }}
                />
                <button
                  onClick={() => fetchSubscriptions(subSearchQuery)}
                  style={{ padding: '0.55rem 0.85rem', borderRadius: 10, background: '#6366f1', color: '#ffffff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  <Search size={15} />
                </button>
              </div>

              <button
                onClick={() => {
                  setControlAction('grant');
                  setControlTargetUserId(subSearchQuery || '');
                  setControlDays(30);
                  setControlReason('');
                  setControlModalOpen(true);
                }}
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <UserCheck size={15} />
                Manual Entitlement Action
              </button>
            </div>

            {subscriptionsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading subscription records...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#0d1321', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <Users size={32} style={{ color: '#6366f1', margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>No subscriptions found.</p>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Search for another user or grant manual Premium access.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {subscriptions.map((sub) => {
                  const isPremiumActive = sub.entitlement?.isPremium && sub.status === 'active';
                  const endMs = new Date(sub.currentPeriodEnd).getTime();
                  const isExpired = isNaN(endMs) || endMs <= Date.now();

                  return (
                    <div
                      key={sub.userId}
                      style={{
                        padding: '1.25rem',
                        borderRadius: 16,
                        background: '#0d1321',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 6, background: isPremiumActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isPremiumActive ? '#a7f3d0' : '#fecaca', border: `1px solid ${isPremiumActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                            {sub.status.toUpperCase()}
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.6rem', borderRadius: 999, background: 'rgba(99, 102, 241, 0.14)', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.76rem', color: '#c7d2fe', fontWeight: 600 }}>
                            <Mail size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
                            <span>{sub.userEmail || 'Email not recorded'}</span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            User ID: <code>{sub.userId}</code>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Provider: <code>{sub.provider}</code> | Updated: {new Date(sub.updatedAt).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Subscriber Email:</span>
                          <strong style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                            <Mail size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
                            {sub.userEmail || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Not recorded</span>}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Current Period Start:</span>
                          <span>{new Date(sub.currentPeriodStart).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Current Period End:</span>
                          <strong style={{ color: isExpired ? '#f87171' : '#a7f3d0' }}>
                            {new Date(sub.currentPeriodEnd).toLocaleString('en-IN')} {isExpired ? '(EXPIRED)' : ''}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Payment Reference:</span>
                          <span>{sub.paymentReference || 'None (Manual grant)'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Update Origin:</span>
                          <span><code>{sub.lastUpdatedFrom || 'n/a'}</code></span>
                        </div>
                      </div>

                      {/* Controls on this user */}
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                        <button
                          onClick={() => {
                            setControlAction('extend');
                            setControlTargetUserId(sub.userId);
                            setControlTargetUserEmail(sub.userEmail || '');
                            setControlDays(30);
                            setControlReason('');
                            setControlModalOpen(true);
                          }}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Extend (+30d)
                        </button>
                        {sub.status === 'active' ? (
                          <button
                            onClick={() => {
                              setControlAction('suspend');
                              setControlTargetUserId(sub.userId);
                              setControlTargetUserEmail(sub.userEmail || '');
                              setControlReason('');
                              setControlModalOpen(true);
                            }}
                            style={{ padding: '0.35rem 0.75rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Suspend Access
                          </button>
                        ) : sub.status === 'halted' ? (
                          <button
                            onClick={() => {
                              setControlAction('reinstate');
                              setControlTargetUserId(sub.userId);
                              setControlTargetUserEmail(sub.userEmail || '');
                              setControlReason('');
                              setControlModalOpen(true);
                            }}
                            style={{ padding: '0.35rem 0.75rem', borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#a7f3d0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reinstate Access
                          </button>
                        ) : null}
                        {sub.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setControlAction('revoke');
                              setControlTargetUserId(sub.userId);
                              setControlTargetUserEmail(sub.userEmail || '');
                              setControlReason('');
                              setControlModalOpen(true);
                            }}
                            style={{ padding: '0.35rem 0.75rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Revoke Permanently
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SETTINGS PREVIEW & LINK */}
        {activeTab === 'settings_preview' && (
          <div style={{ padding: '2rem', borderRadius: 20, background: '#0d1321', border: '1px solid rgba(99, 102, 241, 0.3)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#818cf8' }}>
              <Settings size={32} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Phase 2B.3A Payment Settings</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 480, margin: '0 auto 1.5rem auto' }}>
              Update the business receiving UPI ID, Payee Name, and Payment Description. Changes are versioned, audited, and strictly apply to new orders only. Existing orders retain immutable snapshots.
            </p>
            <Link
              href="/admin/billing/settings"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}
            >
              Open Payment Settings Console
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'audit_logs' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                Append-Only Administrative Governance Audit Trail
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Showing {auditLogs.length} recent audit records
              </span>
            </div>

            {auditLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading audit logs...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#0d1321', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <History size={32} style={{ color: '#64748b', margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>No audit logs recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '1rem',
                      borderRadius: 12,
                      background: '#0d1321',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 6, background: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                          {log.action}
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.5rem', borderRadius: 6, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <Mail size={11} style={{ color: '#818cf8', flexShrink: 0 }} />
                          <strong style={{ color: '#f8fafc', fontSize: '0.78rem' }}>
                            {log.targetUserEmail || log.targetUserId}
                          </strong>
                          {log.targetUserEmail && (
                            <code style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({log.targetUserId})</code>
                          )}
                        </div>
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Entity: <code>{log.targetEntityId}</code>
                        </span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: '0.73rem' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                      Actor: <strong>{log.actorEmail}</strong> | Reason: &quot;{log.reason || 'n/a'}&quot;
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* APPROVAL MODAL */}
      {approvalModalOpen && selectedSubmission && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 500, width: '100%', background: '#0d1321', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.35)', padding: '1.75rem', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Confirm Payment Verification & Premium Activation
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.45 }}>
              Approving this submission will activate 30 days of Premium access for subscriber{' '}
              <strong style={{ color: '#f8fafc' }}>{selectedSubmission.userEmail ? `${selectedSubmission.userEmail} (${selectedSubmission.userId})` : selectedSubmission.userId}</strong>.
            </p>

            <div style={{ padding: '0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Mail size={13} style={{ color: '#818cf8' }} />
                <strong>Subscriber Email:</strong> <span style={{ color: '#818cf8', fontWeight: 700 }}>{selectedSubmission.userEmail || 'Not recorded'}</span>
              </div>
              <div><strong>User ID:</strong> <code style={{ color: '#94a3b8' }}>{selectedSubmission.userId}</code></div>
              <div><strong>UTR:</strong> <code style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedSubmission.utrNumber}</code></div>
              <div><strong>Declared Amount:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>₹{selectedSubmission.declaredAmount} INR</span></div>
              <div><strong>Payment Date:</strong> {selectedSubmission.paymentDate}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Verification Notes (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Verified in ICICI Corporate net banking at 11:45 AM"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.78rem', color: '#a7f3d0' }}>
                <input
                  type="checkbox"
                  checked={approvalChecked}
                  onChange={(e) => setApprovalChecked(e.target.checked)}
                  style={{ marginTop: '0.2rem' }}
                />
                <span>
                  <strong>Mandatory Confirmation:</strong> I certify that I have independently verified receipt of the ₹499 credit in the business bank account or official UPI merchant statement.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                disabled={actionInProgress}
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!approvalChecked || actionInProgress}
                style={{ padding: '0.55rem 1.25rem', borderRadius: 10, background: !approvalChecked || actionInProgress ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: !approvalChecked || actionInProgress ? 'not-allowed' : 'pointer' }}
              >
                {actionInProgress ? 'Approving...' : 'Confirm & Activate Premium'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectionModalOpen && selectedSubmission && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 500, width: '100%', background: '#0d1321', borderRadius: 20, border: '1px solid rgba(239, 68, 68, 0.35)', padding: '1.75rem', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Reject Payment Submission
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.45 }}>
              Rejection releases the reserved UTR so the user can correct their input. It does not grant Premium access.
            </p>

            <div style={{ padding: '0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Mail size={13} style={{ color: '#f87171' }} />
                <strong>Subscriber Email:</strong> <span style={{ color: '#f87171', fontWeight: 700 }}>{selectedSubmission.userEmail || 'Not recorded'}</span>
              </div>
              <div><strong>User ID:</strong> <code style={{ color: '#94a3b8' }}>{selectedSubmission.userId}</code></div>
              <div><strong>UTR:</strong> <code style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedSubmission.utrNumber}</code></div>
              <div><strong>Declared Amount:</strong> ₹{selectedSubmission.declaredAmount} INR</div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Rejection Reason (Mandatory):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. UTR not found in bank statement for the stated date. Please check your banking app transaction history."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '0.82rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                disabled={actionInProgress}
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || actionInProgress}
                style={{ padding: '0.55rem 1.25rem', borderRadius: 10, background: !rejectionReason.trim() || actionInProgress ? 'rgba(239, 68, 68, 0.3)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: !rejectionReason.trim() || actionInProgress ? 'not-allowed' : 'pointer' }}
              >
                {actionInProgress ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION CONTROL MODAL */}
      {controlModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 500, width: '100%', background: '#0d1321', borderRadius: 20, border: '1px solid rgba(99, 102, 241, 0.35)', padding: '1.75rem', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Administrative Entitlement Action
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.45 }}>
              Manual grants and extensions are tracked in the audit trail. They never fabricate payment records.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Action Type:
                </label>
                <select
                  value={controlAction}
                  onChange={(e) => setControlAction(e.target.value as typeof controlAction)}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, background: '#111827', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', fontSize: '0.82rem' }}
                >
                  <option value="grant">Manual Grant (New 30-day Premium access)</option>
                  <option value="extend">Extend Subscription (Add days to existing)</option>
                  <option value="suspend">Suspend Access (Temporary cutoff, preserves paid period)</option>
                  <option value="reinstate">Reinstate Access (Restore halted status)</option>
                  <option value="revoke">Revoke Access (Permanent cutoff, cannot reinstate)</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1' }}>
                    Target User ID or Email:
                  </label>
                  {controlTargetUserEmail && (
                    <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Mail size={11} /> {controlTargetUserEmail}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. subscriber@jobnexus.dev or usr_12345"
                  value={controlTargetUserId}
                  onChange={(e) => {
                    setControlTargetUserId(e.target.value);
                    if (!e.target.value.includes('@')) {
                      setControlTargetUserEmail('');
                    }
                  }}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '0.82rem' }}
                />
              </div>

              {(controlAction === 'grant' || controlAction === 'extend') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Days Duration:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={controlDays}
                    onChange={(e) => setControlDays(parseInt(e.target.value, 10) || 30)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '0.82rem' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Administrative Justification / Reason (Mandatory):
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. VIP test access granted or support dispute resolution"
                  value={controlReason}
                  onChange={(e) => setControlReason(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', fontSize: '0.82rem', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setControlModalOpen(false)}
                disabled={actionInProgress}
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleControlSubmit}
                disabled={!controlTargetUserId.trim() || !controlReason.trim() || actionInProgress}
                style={{ padding: '0.55rem 1.25rem', borderRadius: 10, background: !controlTargetUserId.trim() || !controlReason.trim() || actionInProgress ? 'rgba(99, 102, 241, 0.3)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: !controlTargetUserId.trim() || !controlReason.trim() || actionInProgress ? 'not-allowed' : 'pointer' }}
              >
                {actionInProgress ? 'Executing...' : 'Execute Entitlement Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
