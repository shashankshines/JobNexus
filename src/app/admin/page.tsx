'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  ArrowDown,
  Sparkles,
  Users,
  AlertOctagon,
  FileText,
  Mail,
  X,
  Eye,
  DollarSign,
  BadgeCheck,
  AlertTriangle,
  Receipt,
  User,
  Activity,
  XCircle,
} from 'lucide-react';
import {
  SubmissionWithOrder,
  AdminOverviewMetrics,
  User360Dossier,
  PaymentLedgerItem,
  PaymentLedgerSummary,
} from '@/modules/storage/firestore/admin-billing.store';
import { SubscriptionDocument, AdminAuditLogDocument } from '@/modules/storage/firestore/collections';
import { PaymentSettingsView } from '@/app/components/admin/PaymentSettingsView';
import { AdminPaginationBar } from '@/app/components/admin/AdminPaginationBar';

const ADMIN_PAGE_SIZE = 5;

type AdminTab = 'overview' | 'verifications' | 'ledger' | 'subscriptions' | 'settings_preview' | 'audit_logs';
type AdminSubscriptionAction = 'grant' | 'extend' | 'suspend' | 'reinstate' | 'terminate' | 'revoke';

const ADMIN_SUBSCRIPTION_ACTIONS: Array<{
  value: AdminSubscriptionAction;
  label: string;
  description: string;
  explanation: string;
}> = [
  {
    value: 'grant',
    label: 'Grant Premium',
    description: 'Give 30 days of complimentary access.',
    explanation: 'The user receives a new complimentary 30-day Premium subscription. This is not recorded as payment revenue.',
  },
  {
    value: 'extend',
    label: 'Extend Premium',
    description: 'Add days to the existing subscription.',
    explanation: 'Additional days will be added to the subscription expiry date.',
  },
  {
    value: 'suspend',
    label: 'Temporarily Suspend',
    description: 'Block access while keeping remaining days.',
    explanation: 'Premium access stops immediately. The existing subscription expiry date is preserved.',
  },
  {
    value: 'reinstate',
    label: 'Reinstate Premium',
    description: 'Restore eligible suspended or terminated access.',
    explanation: 'Premium access will be restored if the original subscription period is still valid. No additional days will be granted.',
  },
  {
    value: 'terminate',
    label: 'Terminate Premium',
    description: 'Stop access now; allow restoration later.',
    explanation: 'Premium access stops immediately. Subscription and payment history remain intact, and an administrator can reinstate access before the original expiry.',
  },
  {
    value: 'revoke',
    label: 'Permanently Revoke',
    description: 'Stop access permanently; cannot be restored.',
    explanation: 'Premium access will be permanently disabled. This action cannot be reversed through the reinstatement workflow.',
  },
];

function getSubscriptionControlContext(
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    metadata?: Record<string, unknown>;
  } | null
): { status: string; currentPeriodEnd: string } | undefined {
  if (!subscription) return undefined;
  const preservedEnd = subscription.metadata?.revoked === true &&
    typeof subscription.metadata.preRevocationPeriodEnd === 'string'
    ? subscription.metadata.preRevocationPeriodEnd
    : subscription.currentPeriodEnd;
  return {
    status: getSubscriptionStatusLabel(subscription.status, subscription.metadata?.revoked === true),
    currentPeriodEnd: preservedEnd || '',
  };
}

function getSubscriptionStatusLabel(status: string, isPermanentlyRevoked = false): string {
  if (status === 'active') return 'Active Premium';
  if (status === 'halted') return 'Suspended';
  if (status === 'terminated') return 'Terminated';
  if (status === 'cancelled' && isPermanentlyRevoked) return 'Permanently revoked';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const tabContentRef = useRef<HTMLDivElement>(null);
  const [isTabFocused, setIsTabFocused] = useState<boolean>(false);
  const tabFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTabSelect = useCallback((tabId: AdminTab) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState(null, '', url.toString());
    }

    setTimeout(() => {
      const panel = tabContentRef.current;
      if (panel) {
        const headerOffset = 85;
        const rect = panel.getBoundingClientRect();
        const targetTop = rect.top + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth',
        });

        try {
          panel.focus({ preventScroll: true });
        } catch {
          // Fallback
        }

        setIsTabFocused(true);
        if (tabFocusTimeoutRef.current) {
          clearTimeout(tabFocusTimeoutRef.current);
        }
        tabFocusTimeoutRef.current = setTimeout(() => {
          setIsTabFocused(false);
        }, 1800);
      }
    }, 40);
  }, []);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ statusCode: number; message: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Overview metrics
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);

  // Submissions state (Verification Queue)
  const [submissions, setSubmissions] = useState<SubmissionWithOrder[]>([]);
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'pending_verification' | 'approved' | 'rejected'>('pending_verification');
  const [verificationSearchQuery, setVerificationSearchQuery] = useState<string>('');
  const [submissionPage, setSubmissionPage] = useState<number>(1);
  const [submissionTotal, setSubmissionTotal] = useState<number>(0);
  const [submissionsLoading, setSubmissionsLoading] = useState<boolean>(false);

  // Action Modals state (Approve / Reject)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithOrder | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState<boolean>(false);
  const [approvalChecked, setApprovalChecked] = useState<boolean>(false);
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // User 360° Profile Modal state
  const [user360ModalOpen, setUser360ModalOpen] = useState<boolean>(false);
  const [user360TargetUserId, setUser360TargetUserId] = useState<string>('');
  const [user360Loading, setUser360Loading] = useState<boolean>(false);
  const [user360Dossier, setUser360Dossier] = useState<User360Dossier | null>(null);
  const [user360Error, setUser360Error] = useState<string | null>(null);
  const user360RequestIdRef = useRef(0);

  // Consolidated Payment Ledger state
  const [ledgerRecords, setLedgerRecords] = useState<PaymentLedgerItem[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<PaymentLedgerSummary | null>(null);
  const [ledgerTotal, setLedgerTotal] = useState<number>(0);
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'unsubmitted' | 'expired'>('all');
  const [ledgerQuery, setLedgerQuery] = useState<string>('');
  const [ledgerDateFrom] = useState<string>('');
  const [ledgerDateTo] = useState<string>('');

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Array<SubscriptionDocument & { entitlement?: { isPremium: boolean; status: string; reason?: string }; source?: string }>>([]);
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'active' | 'free' | 'expired' | 'suspended' | 'terminated' | 'cancelled'>('all');
  const [subSourceFilter, setSubSourceFilter] = useState<'all' | 'payment_backed' | 'manual_grant'>('all');
  const [subExpiringSoon, setSubExpiringSoon] = useState<boolean>(false);
  const [subSortBy, setSubSortBy] = useState<'currentPeriodEnd' | 'userId' | 'status' | 'updatedAt'>('currentPeriodEnd');
  const [subSortDir] = useState<'asc' | 'desc'>('desc');
  const [subPage, setSubPage] = useState<number>(1);
  const [subTotal, setSubTotal] = useState<number>(0);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState<boolean>(false);

  // Subscription Control Modal state
  const [controlModalOpen, setControlModalOpen] = useState<boolean>(false);
  const [controlAction, setControlAction] = useState<AdminSubscriptionAction>('grant');
  const [controlActionMenuOpen, setControlActionMenuOpen] = useState<boolean>(false);
  const [controlActionConfirmed, setControlActionConfirmed] = useState<boolean>(false);
  const [controlTargetUserId, setControlTargetUserId] = useState<string>('');
  const [controlTargetUserEmail, setControlTargetUserEmail] = useState<string>('');
  const [controlTargetSubscription, setControlTargetSubscription] = useState<{ status: string; currentPeriodEnd: string } | null>(null);
  const [controlDays, setControlDays] = useState<number>(30);
  const [controlReason, setControlReason] = useState<string>('');
  const controlActionButtonRef = useRef<HTMLButtonElement>(null);
  const controlActionOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const controlActionDropdownRef = useRef<HTMLDivElement>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDocument[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditEmailFilter, setAuditEmailFilter] = useState<string>('');
  const [auditUserFilter, setAuditUserFilter] = useState<string>('');
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  const openSubscriptionControl = (
    action: AdminSubscriptionAction,
    userId: string,
    email = '',
    subscription?: { status: string; currentPeriodEnd: string }
  ) => {
    setControlAction(action);
    setControlActionMenuOpen(false);
    setControlActionConfirmed(false);
    setControlTargetUserId(userId);
    setControlTargetUserEmail(email);
    setControlTargetSubscription(subscription || null);
    setControlDays(30);
    setControlReason('');
    setControlModalOpen(true);
  };

  const selectSubscriptionAction = (action: AdminSubscriptionAction) => {
    setControlAction(action);
    setControlActionConfirmed(false);
    setControlActionMenuOpen(false);
    controlActionButtonRef.current?.focus();
  };

  const handleSubscriptionActionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % ADMIN_SUBSCRIPTION_ACTIONS.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + ADMIN_SUBSCRIPTION_ACTIONS.length) % ADMIN_SUBSCRIPTION_ACTIONS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = ADMIN_SUBSCRIPTION_ACTIONS.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      controlActionOptionRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setControlActionMenuOpen(false);
      controlActionButtonRef.current?.focus();
    }
  };

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
  const fetchSubmissions = useCallback(async (options?: {
    status?: typeof submissionFilter;
    page?: number;
    query?: string;
  }) => {
    setSubmissionsLoading(true);
    try {
      const qStatus = options?.status !== undefined ? options.status : submissionFilter;
      const qPage = options?.page !== undefined ? options.page : submissionPage;
      const qText = options?.query !== undefined ? options.query : verificationSearchQuery;
      const offset = (qPage - 1) * ADMIN_PAGE_SIZE;

      const params = new URLSearchParams();
      params.set('status', qStatus);
      params.set('limit', String(ADMIN_PAGE_SIZE));
      params.set('offset', String(offset));
      if (qText.trim()) {
        params.set('query', qText.trim());
      }

      const res = await fetch(`/api/admin/billing/submissions?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions);
        setSubmissionTotal(typeof data.total === 'number' ? data.total : data.submissions.length);
      }
    } catch (err) {
      console.warn('[AdminConsole] Failed to fetch submissions:', err);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionFilter, submissionPage, verificationSearchQuery]);

  // Open User 360° Profile Dossier
  const openUser360 = async (userIdOrEmail: string) => {
    if (!userIdOrEmail) return;
    const requestId = ++user360RequestIdRef.current;
    setUser360TargetUserId(userIdOrEmail);
    setUser360ModalOpen(true);
    setUser360Loading(true);
    setUser360Error(null);
    setUser360Dossier(null);

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userIdOrEmail)}`);
      const data = await res.json();
      if (requestId !== user360RequestIdRef.current) return;
      if (res.ok && data.success && data.dossier) {
        setUser360Dossier(data.dossier);
      } else {
        setUser360Error(data.error || 'Failed to retrieve User 360 profile.');
      }
    } catch (err) {
      if (requestId === user360RequestIdRef.current) {
        setUser360Error(err instanceof Error ? err.message : 'Network error loading User 360 profile.');
      }
    } finally {
      if (requestId === user360RequestIdRef.current) setUser360Loading(false);
    }
  };

  const closeUser360 = () => {
    user360RequestIdRef.current += 1;
    setUser360ModalOpen(false);
    setUser360Loading(false);
  };

  // Load Consolidated Payment Ledger
  const fetchLedger = useCallback(async (filterParams?: {
    status?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
  }) => {
    setLedgerLoading(true);
    try {
      const qStatus = filterParams?.status || ledgerStatusFilter;
      const qText = filterParams?.query !== undefined ? filterParams.query : ledgerQuery;
      const qPage = filterParams?.page !== undefined ? filterParams.page : ledgerPage;
      const offset = (qPage - 1) * ADMIN_PAGE_SIZE;

      const params = new URLSearchParams();
      if (qStatus && qStatus !== 'all') params.set('status', qStatus);
      if (qText) params.set('query', qText);
      if (ledgerDateFrom) params.set('dateFrom', ledgerDateFrom);
      if (ledgerDateTo) params.set('dateTo', ledgerDateTo);
      params.set('limit', String(ADMIN_PAGE_SIZE));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/billing/ledger?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLedgerRecords(data.records || []);
        if (data.summary) setLedgerSummary(data.summary);
        setLedgerTotal(data.total || 0);
      }
    } catch (err) {
      console.warn('[AdminConsole] Failed to fetch payment ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerStatusFilter, ledgerQuery, ledgerDateFrom, ledgerDateTo, ledgerPage]);

  // Load Subscriptions with full filtering, sorting, and pagination
  const fetchSubscriptions = useCallback(async (filters?: {
    query?: string;
    status?: string;
    source?: string;
    expiringSoon?: boolean;
    sortBy?: string;
    sortDir?: string;
    page?: number;
  }) => {
    setSubscriptionsLoading(true);
    try {
      const params = new URLSearchParams();
      const q = filters?.query !== undefined ? filters.query : subSearchQuery;
      const st = filters?.status || subStatusFilter;
      const src = filters?.source || subSourceFilter;
      const exp = filters?.expiringSoon !== undefined ? filters.expiringSoon : subExpiringSoon;
      const sBy = filters?.sortBy || subSortBy;
      const sDir = filters?.sortDir || subSortDir;
      const qPage = filters?.page !== undefined ? filters.page : subPage;
      const offset = (qPage - 1) * ADMIN_PAGE_SIZE;

      if (q) params.set('query', q);
      if (st && st !== 'all') params.set('status', st);
      if (src && src !== 'all') params.set('source', src);
      if (exp) params.set('expiringSoon', 'true');
      if (sBy) params.set('sortBy', sBy);
      if (sDir) params.set('sortDir', sDir);
      params.set('limit', String(ADMIN_PAGE_SIZE));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.subscriptions)) {
        setSubscriptions(data.subscriptions);
        setSubTotal(typeof data.total === 'number' ? data.total : data.subscriptions.length);
      }
    } catch (err) {
      console.warn('[AdminConsole] Failed to fetch subscriptions:', err);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [subSearchQuery, subStatusFilter, subSourceFilter, subExpiringSoon, subSortBy, subSortDir, subPage]);

  // Load Audit Logs with action & user filters
  const fetchAuditLogs = useCallback(async (filters?: {
    action?: string;
    adminEmail?: string;
    targetUserId?: string;
    page?: number;
  }) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = new URLSearchParams();
      const act = filters?.action || auditActionFilter;
      const adm = filters?.adminEmail || auditEmailFilter;
      const usr = filters?.targetUserId || auditUserFilter;
      const qPage = filters?.page !== undefined ? filters.page : auditPage;
      const offset = (qPage - 1) * ADMIN_PAGE_SIZE;

      if (act && act !== 'all') params.set('action', act);
      if (adm) params.set('adminEmail', adm);
      if (usr) params.set('targetUserId', usr);
      params.set('limit', String(ADMIN_PAGE_SIZE));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
        setAuditTotal(typeof data.total === 'number' ? data.total : data.logs.length);
      } else {
        setAuditError(data.error || 'Failed to fetch audit logs.');
      }
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Network error loading audit trail.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditActionFilter, auditEmailFilter, auditUserFilter, auditPage]);

  useEffect(() => {
    fetchOverview();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['overview', 'verifications', 'ledger', 'subscriptions', 'settings_preview', 'audit_logs'].includes(tabParam)) {
        setActiveTab(tabParam as AdminTab);
        setTimeout(() => {
          if (tabContentRef.current) {
            tabContentRef.current.focus({ preventScroll: true });
          }
        }, 150);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'verifications') {
      fetchSubmissions({ status: submissionFilter, page: submissionPage, query: verificationSearchQuery });
    } else if (activeTab === 'ledger') {
      fetchLedger({ page: ledgerPage });
    } else if (activeTab === 'subscriptions') {
      fetchSubscriptions({ page: subPage });
    } else if (activeTab === 'audit_logs') {
      fetchAuditLogs({ page: auditPage });
    }
  }, [activeTab]);

  // Execute Approval
  const handleApprove = async () => {
    if (!selectedSubmission || actionInProgress) return;
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
        fetchSubmissions({ status: submissionFilter, page: submissionPage });
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
    if (!selectedSubmission || actionInProgress) return;
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
        fetchSubmissions({ status: submissionFilter, page: submissionPage });
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
    if (!controlTargetUserId.trim() || actionInProgress) {
      if (!controlTargetUserId.trim()) alert('Target User ID is required.');
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
        fetchSubscriptions({ query: subSearchQuery });
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
      <div className="admin-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="admin-modal-card" style={{ maxWidth: 520, width: '100%', border: '1.5px solid rgba(239, 68, 68, 0.4)', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#f87171' }}>
            <Lock size={32} />
          </div>
          <h2 className="admin-text-value" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            {authError.statusCode === 401 ? 'Sign-In Required' : 'Administrator Authorization Required'}
          </h2>
          <p className="admin-text-label" style={{ fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '1.5rem' }}>
            {authError.message}
          </p>
          <div className="admin-card-inner" style={{ padding: '0.85rem', borderRadius: 10, marginBottom: '1.75rem', fontSize: '0.8rem', textAlign: 'left' }}>
            <strong className="admin-text-value">Designated Administrator:</strong> <code className="admin-code-pill">shashankshines@gmail.com</code>
            <br />
            <span className="admin-text-label" style={{ fontSize: '0.74rem', marginTop: 4 }}>
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
    <div className="admin-shell">
      {/* Top Header (Fixed, non-scrolling) */}
      <header className="admin-header">
        <div style={{ width: '85%', maxWidth: '85vw', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 className="admin-header-title">JobNexus Admin Console</h1>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 6, background: 'rgba(99, 102, 241, 0.25)', border: '1.5px solid #818cf8', color: 'var(--primary-start, #a5b4fc)', fontWeight: 800 }}>
                  Phase 2B.3D
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #cbd5e1)', margin: '0.15rem 0 0 0' }}>
                User 360° Profile, Consolidated Ledger, Payment Verification Queue & Authoritative Entitlement Controls
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
            >
              Back to Job Search
            </Link>
            <button
              onClick={() => {
                fetchOverview();
                if (activeTab === 'verifications') fetchSubmissions({ status: submissionFilter, page: submissionPage, query: verificationSearchQuery });
                if (activeTab === 'ledger') fetchLedger({ page: ledgerPage });
                if (activeTab === 'subscriptions') fetchSubscriptions({ page: subPage });
                if (activeTab === 'audit_logs') fetchAuditLogs({ page: auditPage });
              }}
              aria-label="Refresh console data"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', color: 'var(--primary-start, #c7d2fe)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Fixed Header Spacer */}
      <div style={{ height: 72 }} aria-hidden="true" />

      {/* Main Container */}
      <main className="admin-main-container">
        {/* Notification Banner */}
        {notification && (
          <div className={notification.type === 'success' ? 'admin-success-banner' : 'admin-error-banner'} style={{ marginBottom: '1.5rem', justifyContent: 'space-between' }}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} aria-label="Dismiss notification" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* Unified Tab Navigation Rail (Non-wrapping Segmented Rail) */}
        <div className="admin-tab-nav-wrapper">
          <nav className="admin-tab-nav" role="tablist" aria-label="Admin Navigation Tabs">
            {[
              { id: 'overview', label: 'Overview', fullTitle: 'Overview & Metrics', icon: ShieldCheck, badge: metrics?.pendingCount },
              { id: 'verifications', label: 'Verification Queue', fullTitle: 'Payment Verification Queue', icon: CreditCard, badge: metrics?.pendingCount },
              { id: 'ledger', label: 'Payment Ledger', fullTitle: 'Consolidated Payment Ledger', icon: Receipt },
              { id: 'subscriptions', label: 'Subscribers', fullTitle: 'Subscribers & Entitlements', icon: Users, badge: metrics?.activeSubscribersCount },
              { id: 'settings_preview', label: 'Payment Settings', fullTitle: 'Manage UPI Payment Settings', icon: Settings },
              { id: 'audit_logs', label: 'Audit Trail', fullTitle: 'Authoritative Audit Trail', icon: History, badge: metrics?.totalAuditLogsCount },
            ].map((tab, tabIdx, tabArr) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`admin-tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="admin-tab-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabSelect(tab.id as AdminTab)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      const nextIdx = (tabIdx + 1) % tabArr.length;
                      handleTabSelect(tabArr[nextIdx].id as AdminTab);
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      const prevIdx = (tabIdx - 1 + tabArr.length) % tabArr.length;
                      handleTabSelect(tabArr[prevIdx].id as AdminTab);
                    }
                  }}
                  className={`admin-tab-btn ${isActive ? 'is-active' : ''}`}
                  title={tab.fullTitle}
                  aria-label={tab.fullTitle}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="admin-tab-badge">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Tab Panel Container with Direct Focus & Feedback */}
        <div
          ref={tabContentRef}
          id="admin-tab-panel"
          role="tabpanel"
          aria-labelledby={`admin-tab-${activeTab}`}
          tabIndex={-1}
          className={`admin-tab-content-panel ${isTabFocused ? 'admin-tab-panel-focused' : ''}`}
          style={{ outline: 'none', scrollMarginTop: '85px', position: 'relative' }}
        >
          {isTabFocused && (
            <div className="admin-focus-clue-badge" role="status" aria-live="polite">
              <ArrowDown size={11} strokeWidth={2.5} />
              <span>
                {activeTab === 'overview' && 'Overview & Metrics'}
                {activeTab === 'verifications' && 'Verification Queue'}
                {activeTab === 'ledger' && 'Payment Ledger'}
                {activeTab === 'subscriptions' && 'Subscribers & Entitlements'}
                {activeTab === 'settings_preview' && 'UPI Payment Settings'}
                {activeTab === 'audit_logs' && 'Authoritative Audit Trail'}
                {' in Focus'}
              </span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Expiring Soon Alert Banner if any */}
              {metrics && metrics.expiringSoonCount > 0 && (
                <div className="admin-warning-banner" style={{ marginBottom: '1.25rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <AlertTriangle size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <span>
                      <strong>{metrics.expiringSoonCount} subscriber{metrics.expiringSoonCount > 1 ? 's' : ''} expiring within the next 7 days.</strong> Review active entitlements in the Subscribers tab.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubExpiringSoon(true);
                      handleTabSelect('subscriptions');
                    }}
                    className="admin-btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    View Expiring
                  </button>
                </div>
              )}

            {/* Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {/* Verified Revenue KPI Card */}
              <div className="admin-kpi-card" style={{ border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Verified Payment Revenue</span>
                  <DollarSign size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                  ₹{(metrics?.verifiedRevenueInr ?? (metrics ? metrics.totalApprovedCount * 499 : 0)).toLocaleString('en-IN')}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {metrics?.totalApprovedCount ?? 0} confirmed ₹499 UPI payments
                </span>
              </div>

              {/* Pending Claims Value */}
              <div className="admin-kpi-card" style={{ border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f59e0b', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pending Claim Value</span>
                  <Clock size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
                  ₹{(metrics?.pendingClaimedRevenueInr ?? (metrics ? metrics.pendingCount * 499 : 0)).toLocaleString('en-IN')}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {metrics ? metrics.pendingCount : 0} claims awaiting bank credit check
                </span>
              </div>

              {/* Active Subscribers Split */}
              <div className="admin-kpi-card" style={{ border: '1px solid rgba(99, 102, 241, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6366f1', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active Subscribers</span>
                  <UserCheck size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>
                  {metrics ? metrics.activeSubscribersCount : '...'}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {metrics?.paymentBackedSubscribersCount ?? 0} paid • {metrics?.manualGrantSubscribersCount ?? 0} manual grants
                </span>
              </div>

              {/* SLA Breaches */}
              <div className="admin-kpi-card" style={{ border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ef4444', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>SLA Breaches (&gt;12h)</span>
                  <AlertOctagon size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>
                  {metrics ? metrics.slaBreachCount : '...'}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  Pending claims over 12h review target
                </span>
              </div>
            </div>

            {/* Invariant Highlights */}
            <div className="admin-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: '#818cf8' }} />
                Architectural Invariants & Governance Rules
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem', fontSize: '0.82rem' }}>
                <div className="admin-card-inner" style={{ padding: '1rem', borderRadius: 12 }}>
                  <strong className="admin-text-value" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    <Lock size={15} style={{ color: '#10b981' }} />
                    Exactly-Once Approval
                  </strong>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
                    Approvals execute atomically in Firestore transactions. Duplicate approval attempts are idempotent and will never consume a UTR twice or duplicate subscription extensions.
                  </span>
                </div>
                <div className="admin-card-inner" style={{ padding: '1rem', borderRadius: 12 }}>
                  <strong className="admin-text-value" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    <Clock size={15} style={{ color: '#818cf8' }} />
                    Authoritative Period Formula
                  </strong>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
                    Subscription extensions preserve remaining validity: <code>newPeriodEnd = max(now, currentPeriodEnd) + 30 days</code>. Users never lose paid days.
                  </span>
                </div>
                <div className="admin-card-inner" style={{ padding: '1rem', borderRadius: 12 }}>
                  <strong className="admin-text-value" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    <FileText size={15} style={{ color: '#f59e0b' }} />
                    Mandatory Decision Reasons
                  </strong>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
                    Every rejection, grant, extension, suspension, reinstatement, termination, or revocation requires a non-empty administrative reason, permanently audited in <code>admin_audit_logs</code>.
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSubmissionFilter('pending_verification');
                  handleTabSelect('verifications');
                }}
                style={{ padding: '0.85rem 1.25rem', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 700, fontSize: '0.88rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Review Pending Payments ({metrics?.pendingCount || 0})
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => openSubscriptionControl('grant', '')}
                className="admin-btn-secondary"
              >
                <UserCheck size={16} />
                Grant Premium
              </button>
              <Link
                href="/admin/billing/settings"
                className="admin-btn-secondary"
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
            {/* Operational SLA Notice Banner */}
            <div className="admin-notice-banner" style={{ marginBottom: '1.25rem' }}>
              <Clock size={18} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
              <div>
                <strong>Operational SLA Notice:</strong> 12-Hour SLA is an operational response target for administrative review, not a payment guarantee or automated approval trigger.
              </div>
            </div>

            {/* Filter buttons & Search Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                      setSubmissionPage(1);
                      fetchSubmissions({ status: f.id as typeof submissionFilter, page: 1 });
                    }}
                    className={`admin-filter-btn ${submissionFilter === f.id ? 'is-active' : ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 'min(100%, 220px)', maxWidth: 420, justifyContent: 'flex-end' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 280 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #64748b)' }} />
                  <input
                    type="text"
                    placeholder="Search UTR, Email, User ID..."
                    value={verificationSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVerificationSearchQuery(val);
                      setSubmissionPage(1);
                      fetchSubmissions({ query: val, page: 1 });
                    }}
                    className="admin-form-input"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem 0.45rem 2rem',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                    }}
                  />
                  {verificationSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationSearchQuery('');
                        setSubmissionPage(1);
                        fetchSubmissions({ query: '', page: 1 });
                      }}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {submissionTotal} total
                </span>
              </div>
            </div>

            {/* Submissions List */}
            {submissionsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="admin-empty-card">
                <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 0.75rem auto' }} />
                <p className="admin-text-value" style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>No submissions found for current filter.</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: '0.25rem 0 0 0' }}>All pending verifications are up to date.</p>
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
                        className="admin-card"
                        style={{
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          border: isSlaBreached
                            ? '1.5px solid rgba(239, 68, 68, 0.5)'
                            : isPending
                            ? '1.5px solid rgba(245, 158, 11, 0.4)'
                            : undefined,
                        }}
                      >
                        {/* Top Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                            <span className={
                              isApproved
                                ? 'admin-badge-approved'
                                : isRejected
                                ? 'admin-badge-rejected'
                                : isSlaBreached
                                ? 'admin-badge-breached'
                                : 'admin-badge-pending'
                            }>
                              {isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : isSlaBreached ? 'PENDING (SLA BREACH)' : 'PENDING REVIEW'}
                            </span>
                            <span className="admin-text-value" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                              UTR: <code className="admin-code-utr">{sub.utrNumber}</code>
                            </span>
                            <div className="admin-email-badge">
                              <Mail size={12} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                              <span>{sub.userEmail || 'Email not recorded'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openUser360(sub.userEmail || sub.userId)}
                              className="admin-action-btn-secondary"
                            >
                              <Eye size={12} />
                              View User 360°
                            </button>
                          </div>

                          <div className="admin-text-label" style={{ fontSize: '0.75rem' }}>
                            Submitted: {new Date(sub.submittedAt).toLocaleString('en-IN')}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="admin-card-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.75rem', padding: '0.85rem', borderRadius: 10, fontSize: '0.8rem' }}>
                          <div>
                            <span className="admin-text-label">Subscriber Email:</span>
                            <strong className="admin-text-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                              <Mail size={13} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openUser360(sub.userEmail || sub.userId)}>
                                {sub.userEmail || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 400 }}>Not recorded</span>}
                              </span>
                            </strong>
                          </div>
                          <div>
                            <span className="admin-text-label">User ID:</span>
                            <code
                              className="admin-code-pill"
                              style={{ cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => openUser360(sub.userId)}
                            >
                              {sub.userId}
                            </code>
                          </div>
                          <div>
                            <span className="admin-text-label">Declared Amount:</span>
                            <strong style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 800 }}>₹{sub.declaredAmount} INR</strong>
                          </div>
                          <div>
                            <span className="admin-text-label">Payment Date:</span>
                            <span className="admin-text-value" style={{ fontWeight: 600, fontStyle: sub.paymentDate ? 'normal' : 'italic', color: sub.paymentDate ? undefined : 'var(--text-secondary)' }}>
                              {sub.paymentDate || 'Not recorded'}
                            </span>
                          </div>
                          <div>
                            <span className="admin-text-label">Associated Order:</span>
                            {sub.order ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <code className="admin-code-order">
                                  {sub.orderId}
                                </code>
                                <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>({sub.order.upiId || 'snapshot n/a'})</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span className="admin-pill-orphan">
                                  Association unavailable
                                </span>
                                <code className="admin-text-label" style={{ fontSize: '0.72rem' }}>({sub.orderId})</code>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Review Metadata if decided */}
                        {sub.reviewedBy && (
                          <div className="admin-text-label" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                            Reviewed by <strong className="admin-text-value">{sub.reviewedBy}</strong> at {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleString('en-IN') : 'n/a'}
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
                              disabled={actionInProgress}
                              className="admin-btn-reject"
                              style={{ opacity: actionInProgress ? 0.6 : 1, cursor: actionInProgress ? 'not-allowed' : 'pointer' }}
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
                              disabled={actionInProgress}
                              className="admin-btn-approve"
                              style={{ opacity: actionInProgress ? 0.6 : 1, cursor: actionInProgress ? 'not-allowed' : 'pointer' }}
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

            {submissionTotal > 0 && (
              <AdminPaginationBar
                currentPage={submissionPage}
                totalItems={submissionTotal}
                pageSize={ADMIN_PAGE_SIZE}
                loading={submissionsLoading}
                itemName="submissions"
                onPageChange={(newPage) => {
                  setSubmissionPage(newPage);
                  fetchSubmissions({ page: newPage });
                }}
              />
            )}
          </div>
        )}

        {/* TAB 3: CONSOLIDATED PAYMENT & ORDER LEDGER */}
        {activeTab === 'ledger' && (
          <div>
            {/* Financial Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="admin-kpi-card" style={{ border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Verified Approved Payments</span>
                  <DollarSign size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                  ₹{(ledgerSummary?.verifiedPaymentAmountInr ?? ledgerSummary?.verifiedRevenueInr ?? 0).toLocaleString('en-IN')}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {ledgerSummary?.verifiedPaymentsCount || 0} distinct confirmed payments
                </span>
              </div>

              <div className="admin-kpi-card" style={{ border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f59e0b', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pending Claims Value</span>
                  <Clock size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
                  ₹{(ledgerSummary?.pendingClaimedAmountInr ?? ledgerSummary?.pendingClaimedRevenueInr ?? 0).toLocaleString('en-IN')}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {ledgerSummary?.pendingSubmissionsCount || 0} claims awaiting bank credit check
                </span>
              </div>

              <div className="admin-kpi-card" style={{ border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ef4444', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rejected Claims Value</span>
                  <XCircle size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>
                  ₹{(ledgerSummary?.rejectedClaimedAmountInr ?? 0).toLocaleString('en-IN')}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {ledgerSummary?.rejectedSubmissionsCount || 0} rejected claims (UTR released)
                </span>
              </div>

              <div className="admin-kpi-card" style={{ border: '1px solid rgba(99, 102, 241, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6366f1', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Order Conversions</span>
                  <Receipt size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>
                  {ledgerSummary?.totalOrdersCount || 0}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  {ledgerSummary?.verifiedPaymentsCount || 0} verified • {ledgerSummary?.unsubmittedOrdersCount || 0} unsubmitted • {ledgerSummary?.expiredOrdersCount || 0} expired
                </span>
              </div>

              <div className="admin-kpi-card" style={{ border: '1px solid rgba(168, 85, 247, 0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#a855f7', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Admin Grants (Excluded)</span>
                  <UserCheck size={18} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7' }}>
                  {ledgerSummary?.manualGrantsExcludedCount || 0}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  Non-payment entitlements excluded from ledger revenue
                </span>
              </div>
            </div>

            {/* Unresolved Records Audit Warning Banner if any */}
            {ledgerSummary?.unresolvedReviewCount && ledgerSummary.unresolvedReviewCount > 0 ? (
              <div className="admin-error-banner" style={{ marginBottom: '1.25rem' }}>
                <AlertOctagon size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                <div>
                  <strong>{ledgerSummary.unresolvedReviewCount} transaction(s) require administrative audit:</strong> Unassociated order references or duplicate UTR claims detected. Check individual ledger records below.
                </div>
              </div>
            ) : null}

            {/* Financial Integrity & Refund Notice */}
            <div className="admin-notice-banner" style={{ marginBottom: '1.5rem' }}>
              <Activity size={18} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
              <div>
                <strong>Financial Integrity Rule:</strong> {ledgerSummary?.refundPolicyNote || 'Refunds and payment reversals are not automated through this interface and must be audited manually against bank statements.'}
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Transactions' },
                  { id: 'verified', label: 'Verified Payments' },
                  { id: 'pending', label: 'Pending Claims' },
                  { id: 'rejected', label: 'Rejected Claims' },
                  { id: 'unsubmitted', label: 'Unsubmitted Checkouts' },
                  { id: 'expired', label: 'Expired Orders' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setLedgerStatusFilter(f.id as typeof ledgerStatusFilter);
                      setLedgerPage(1);
                      fetchLedger({ status: f.id, page: 1 });
                    }}
                    className={`admin-filter-btn ${ledgerStatusFilter === f.id ? 'is-active' : ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, maxWidth: 420, justifyContent: 'flex-end' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 280 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #64748b)' }} />
                  <input
                    type="text"
                    placeholder="Search UTR, Order ID, Email..."
                    value={ledgerQuery}
                    onChange={(e) => {
                      setLedgerQuery(e.target.value);
                      setLedgerPage(1);
                      fetchLedger({ query: e.target.value, page: 1 });
                    }}
                    className="admin-form-input"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem 0.45rem 2rem',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                    }}
                  />
                  {ledgerQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerQuery('');
                        setLedgerPage(1);
                        fetchLedger({ query: '', page: 1 });
                      }}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <span className="admin-text-label" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {ledgerTotal} records
                </span>
              </div>
            </div>

            {/* Ledger Table */}
            {ledgerLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading financial ledger records...</p>
              </div>
            ) : ledgerRecords.length === 0 ? (
              <div className="admin-empty-card">
                <Receipt size={32} style={{ color: '#6366f1', margin: '0 auto 0.75rem auto' }} />
                <p className="admin-text-value" style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>No ledger transactions match current filter.</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: '0.25rem 0 0 0' }}>Try clearing the search query or changing status filters.</p>
              </div>
            ) : (
              <>
                {/* Desktop Data Table (100% Width Fixed Layout, Zero Horizontal Scroll) */}
                <div className="admin-ledger-table-wrap">
                  <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <colgroup>
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '19%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr className="admin-table-head">
                        <th style={{ padding: '0.65rem 0.6rem' }}>Status</th>
                        <th style={{ padding: '0.65rem 0.6rem' }}>Order Ref</th>
                        <th style={{ padding: '0.65rem 0.6rem' }}>Subscriber Email & User ID</th>
                        <th style={{ padding: '0.65rem 0.6rem' }}>UTR Number</th>
                        <th style={{ padding: '0.65rem 0.6rem' }}>Amount</th>
                        <th style={{ padding: '0.65rem 0.6rem' }}>Dates</th>
                        <th style={{ padding: '0.65rem 0.6rem' }}>Decision / Reviewer</th>
                        <th style={{ padding: '0.65rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerRecords.map((item) => {
                        const isVerified = item.status === 'verified';
                        const isPending = item.status === 'pending';
                        const isRejected = item.status === 'rejected';
                        const isUnsub = item.status === 'unsubmitted';

                        return (
                          <tr
                            key={item.id}
                            className="admin-table-row"
                          >
                            <td style={{ padding: '0.65rem 0.6rem' }}>
                              <span className={
                                isVerified
                                  ? 'admin-badge-approved'
                                  : isPending
                                  ? 'admin-badge-pending'
                                  : isRejected
                                  ? 'admin-badge-rejected'
                                  : 'admin-badge-info'
                              }>
                                {item.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem', wordBreak: 'break-all' }}>
                              {item.isOrphan ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span className="admin-pill-orphan" style={{ display: 'inline-block' }}>
                                    Association unavailable
                                  </span>
                                  <code className="admin-text-label" style={{ fontSize: '0.7rem' }}>{item.orderId}</code>
                                </div>
                              ) : (
                                <>
                                  <code className="admin-code-order">
                                    {item.orderId}
                                  </code>
                                  {item.upiIdSnapshot && (
                                    <div className="admin-text-label" style={{ fontSize: '0.7rem', marginTop: 2, wordBreak: 'break-all' }}>
                                      {item.upiIdSnapshot}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                                <Mail size={12} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                                <strong
                                  className="admin-text-value"
                                  style={{ cursor: 'pointer', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.78rem' }}
                                  onClick={() => openUser360(item.userEmail || item.userId)}
                                >
                                  {item.userEmail || 'Email not recorded'}
                                </strong>
                              </div>
                              <code
                                className="admin-code-pill"
                                style={{ fontSize: '0.7rem', cursor: 'pointer', display: 'inline-block', marginTop: 2 }}
                                onClick={() => openUser360(item.userId)}
                              >
                                {item.userId}
                              </code>
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem' }}>
                              {item.utr ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <code className="admin-code-utr" style={{ wordBreak: 'break-all' }}>{item.utr}</code>
                                  {item.isDuplicateUtr && (
                                    <span className="admin-badge-rejected" style={{ fontSize: '0.65rem', padding: '0.08rem 0.35rem', width: 'fit-content' }}>
                                      DUPLICATE CLAIM
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-secondary, #64748b)', fontStyle: 'italic', fontSize: '0.75rem' }}>None</span>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem' }}>
                              <strong style={{ color: isVerified ? '#10b981' : 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 800 }}>
                                ₹{item.amount} {item.currency}
                              </strong>
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem', fontSize: '0.74rem' }}>
                              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Payment:</strong> {item.paymentDate ? <span className="admin-text-value" style={{ fontWeight: 600 }}>{item.paymentDate}</span> : <span style={{ color: 'var(--text-secondary, #64748b)', fontStyle: 'italic' }}>Not recorded</span>}</div>
                              {item.submittedAt && (
                                <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Submitted:</strong> <span className="admin-text-value">{new Date(item.submittedAt).toLocaleDateString('en-IN')}</span></div>
                              )}
                              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Order:</strong> <span className="admin-text-value">{new Date(item.orderCreatedAt).toLocaleDateString('en-IN')}</span></div>
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem', fontSize: '0.74rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                              {item.reviewedBy ? (
                                <div>
                                  <div>by <strong className="admin-text-value">{item.reviewedBy}</strong></div>
                                  {item.decisionReason && (
                                    <div style={{ color: isRejected ? '#ef4444' : '#10b981', fontStyle: 'italic', marginTop: 2 }}>
                                      &quot;{item.decisionReason}&quot;
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-secondary, #64748b)' }}>Pending Review</span>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => openUser360(item.userEmail || item.userId)}
                                className="admin-action-btn-secondary"
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                              >
                                <Eye size={12} />
                                View 360°
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Tablet & Mobile Transaction Cards (100% Horizontal-Scroll Free) */}
                <div className="admin-ledger-cards-wrap">
                  {ledgerRecords.map((item) => {
                    const isVerified = item.status === 'verified';
                    const isPending = item.status === 'pending';
                    const isRejected = item.status === 'rejected';
                    const isUnsub = item.status === 'unsubmitted';

                    return (
                      <div
                        key={item.id}
                        className="admin-card"
                        style={{
                          padding: '1.15rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                        }}
                      >
                        {/* Top Header Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className={
                              isVerified
                                ? 'admin-badge-approved'
                                : isPending
                                ? 'admin-badge-pending'
                                : isRejected
                                ? 'admin-badge-rejected'
                                : 'admin-badge-info'
                            }>
                              {item.status.toUpperCase()}
                            </span>
                            {item.utr ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>UTR:</span>
                                <code className="admin-code-utr">{item.utr}</code>
                                {item.isDuplicateUtr && (
                                  <span className="admin-badge-rejected" style={{ fontSize: '0.65rem', padding: '0.08rem 0.35rem' }}>
                                    DUPLICATE
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <strong style={{ color: isVerified ? '#10b981' : 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 800 }}>
                              ₹{item.amount} {item.currency}
                            </strong>
                            <button
                              type="button"
                              onClick={() => openUser360(item.userEmail || item.userId)}
                              className="admin-action-btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            >
                              <Eye size={12} />
                              View 360°
                            </button>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="admin-card-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem', padding: '0.85rem', borderRadius: 10, fontSize: '0.8rem' }}>
                          <div>
                            <span className="admin-text-label">Subscriber:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: 2 }}>
                              <Mail size={12} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                              <strong
                                className="admin-text-value"
                                style={{ cursor: 'pointer', textDecoration: 'underline', wordBreak: 'break-all' }}
                                onClick={() => openUser360(item.userEmail || item.userId)}
                              >
                                {item.userEmail || 'Email not recorded'}
                              </strong>
                            </div>
                            <code
                              className="admin-code-pill"
                              style={{ fontSize: '0.72rem', cursor: 'pointer', display: 'inline-block', marginTop: 4 }}
                              onClick={() => openUser360(item.userId)}
                            >
                              {item.userId}
                            </code>
                          </div>

                          <div>
                            <span className="admin-text-label">Order Reference:</span>
                            {item.isOrphan ? (
                              <div style={{ marginTop: 2 }}>
                                <span className="admin-pill-orphan">Association unavailable</span>
                                <div style={{ fontSize: '0.72rem', marginTop: 2 }}><code className="admin-text-label">{item.orderId}</code></div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 2 }}>
                                <code className="admin-code-order">{item.orderId}</code>
                                {item.upiIdSnapshot && (
                                  <div className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                                    ({item.upiIdSnapshot})
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <span className="admin-text-label">Recorded Dates:</span>
                            <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Payment:</strong> {item.paymentDate ? <span className="admin-text-value" style={{ fontWeight: 600 }}>{item.paymentDate}</span> : <span style={{ color: 'var(--text-secondary, #64748b)', fontStyle: 'italic' }}>Not recorded</span>}</div>
                              {item.submittedAt && (
                                <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Submitted:</strong> <span className="admin-text-value">{new Date(item.submittedAt).toLocaleDateString('en-IN')}</span></div>
                              )}
                              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Order:</strong> <span className="admin-text-value">{new Date(item.orderCreatedAt).toLocaleDateString('en-IN')}</span></div>
                            </div>
                          </div>

                          <div>
                            <span className="admin-text-label">Decision / Reviewer:</span>
                            <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                              {item.reviewedBy ? (
                                <div>
                                  <div>by <strong className="admin-text-value">{item.reviewedBy}</strong></div>
                                  {item.decisionReason && (
                                    <div style={{ color: isRejected ? '#ef4444' : '#10b981', fontStyle: 'italic', marginTop: 2 }}>
                                      &quot;{item.decisionReason}&quot;
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-secondary, #64748b)' }}>Pending Review</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {ledgerTotal > 0 && (
                  <AdminPaginationBar
                    currentPage={ledgerPage}
                    totalItems={ledgerTotal}
                    pageSize={ADMIN_PAGE_SIZE}
                    loading={ledgerLoading}
                    itemName="transactions"
                    onPageChange={(newPage) => {
                      setLedgerPage(newPage);
                      fetchLedger({ page: newPage });
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 4: SUBSCRIBERS & ENTITLEMENTS */}
        {activeTab === 'subscriptions' && (
          <div>
            {/* Filter toolbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { id: 'all', label: 'All Statuses' },
                    { id: 'active', label: 'Active Premium' },
                    { id: 'free', label: 'Free Tier' },
                    { id: 'expired', label: 'Expired' },
                    { id: 'suspended', label: 'Suspended' },
                    { id: 'terminated', label: 'Terminated' },
                    { id: 'cancelled', label: 'Cancelled' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSubStatusFilter(f.id as typeof subStatusFilter);
                        setSubPage(1);
                        fetchSubscriptions({ status: f.id, page: 1 });
                      }}
                      className={`admin-status-filter-btn ${subStatusFilter === f.id ? 'is-active' : ''}`}
                    >
                      {f.label}
                    </button>
                  ))}

                  {/* Expiring Soon Toggle */}
                  <button
                    onClick={() => {
                      const next = !subExpiringSoon;
                      setSubExpiringSoon(next);
                      setSubPage(1);
                      fetchSubscriptions({ expiringSoon: next, page: 1 });
                    }}
                    className={`admin-expiring-filter-btn ${subExpiringSoon ? 'is-active' : ''}`}
                  >
                    <Clock size={12} />
                    Expiring Soon (&le;7d)
                  </button>
                </div>

                <button
                  onClick={() => openSubscriptionControl('grant', subSearchQuery || '')}
                  style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <UserCheck size={15} />
                  Manage Premium Access
                </button>
              </div>

              {/* Search & Source filter row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 'min(100%, 220px)', maxWidth: 420 }}>
                  <input
                    type="text"
                    placeholder="Search by User ID or Normalized Email..."
                    value={subSearchQuery}
                    onChange={(e) => setSubSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSubPage(1);
                        fetchSubscriptions({ query: subSearchQuery, page: 1 });
                      }
                    }}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8, fontSize: '0.8rem' }}
                  />
                  <button
                    onClick={() => {
                      setSubPage(1);
                      fetchSubscriptions({ query: subSearchQuery, page: 1 });
                    }}
                    style={{ padding: '0.45rem 0.85rem', borderRadius: 8, background: '#6366f1', color: '#ffffff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    <Search size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="admin-text-label" style={{ fontSize: '0.76rem' }}>Source:</label>
                  <select
                    value={subSourceFilter}
                    onChange={(e) => {
                      const val = e.target.value as typeof subSourceFilter;
                      setSubSourceFilter(val);
                      setSubPage(1);
                      fetchSubscriptions({ source: val, page: 1 });
                    }}
                    className="admin-form-input"
                    style={{ padding: '0.4rem 0.65rem', borderRadius: 8, fontSize: '0.76rem' }}
                  >
                    <option value="all">All Sources</option>
                    <option value="payment_backed">Payment-Backed (UPI ₹499)</option>
                    <option value="manual_grant">Manual / Admin Grants</option>
                  </select>

                  <label className="admin-text-label" style={{ fontSize: '0.76rem', marginLeft: '0.5rem' }}>Sort:</label>
                  <select
                    value={subSortBy}
                    onChange={(e) => {
                      const val = e.target.value as typeof subSortBy;
                      setSubSortBy(val);
                      setSubPage(1);
                      fetchSubscriptions({ sortBy: val, page: 1 });
                    }}
                    className="admin-form-input"
                    style={{ padding: '0.4rem 0.65rem', borderRadius: 8, fontSize: '0.76rem' }}
                  >
                    <option value="currentPeriodEnd">Period End (Expiry)</option>
                    <option value="updatedAt">Recently Updated</option>
                    <option value="userId">User ID</option>
                    <option value="status">Status</option>
                  </select>
                </div>

                <span className="admin-text-label" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                  {subTotal} subscribers
                </span>
              </div>
            </div>

            {subscriptionsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading subscription records...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="admin-empty-card">
                <Users size={32} style={{ color: '#6366f1', margin: '0 auto 0.75rem auto' }} />
                <p className="admin-text-value" style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>No subscriptions found.</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: '0.25rem 0 0 0' }}>Search for another user or                 grant Premium access.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {subscriptions.map((sub) => {
                  const isPremiumActive = sub.entitlement?.isPremium && sub.status === 'active';
                  const endMs = new Date(sub.currentPeriodEnd).getTime();
                  const isExpired = isNaN(endMs) || endMs <= Date.now();
                  const isPayment = sub.source === 'payment_backed' || sub.lastUpdatedFrom === 'manual_upi' || sub.provider === 'manual_upi';

                  return (
                    <div
                      key={sub.userId}
                      className="admin-card"
                      style={{
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <span className={isPremiumActive ? 'admin-badge-approved' : 'admin-badge-rejected'}>
                            {getSubscriptionStatusLabel(sub.status, sub.metadata?.revoked === true)}
                          </span>
                          <span className={isPayment ? 'admin-badge-approved' : 'admin-badge-purple'}>
                            {isPayment ? 'PAYMENT-BACKED' : 'ADMIN GRANT'}
                          </span>
                          <div className="admin-email-badge">
                            <Mail size={12} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                            <span>{sub.userEmail || 'Email not recorded'}</span>
                          </div>
                          <span className="admin-text-label" style={{ fontSize: '0.8rem' }}>
                            User ID: <code className="admin-code-pill">{sub.userId}</code>
                          </span>
                          <button
                            type="button"
                            onClick={() => openUser360(sub.userEmail || sub.userId)}
                            className="admin-action-btn-secondary"
                          >
                            <Eye size={12} />
                            View 360°
                          </button>
                        </div>
                        <div className="admin-text-label" style={{ fontSize: '0.75rem' }}>
                          Provider: <code>{sub.provider}</code> | Updated: {new Date(sub.updatedAt).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="admin-card-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.75rem', padding: '0.85rem', borderRadius: 10, fontSize: '0.8rem' }}>
                        <div>
                          <span className="admin-text-label">Subscriber Email:</span>
                          <strong className="admin-text-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}>
                            <Mail size={13} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openUser360(sub.userEmail || sub.userId)}>
                              {sub.userEmail || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 400 }}>Not recorded</span>}
                            </span>
                          </strong>
                        </div>
                        <div>
                          <span className="admin-text-label">Current Period Start:</span>
                          <span className="admin-text-value" style={{ fontWeight: 500 }}>{new Date(sub.currentPeriodStart).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="admin-text-label">Current Period End:</span>
                          <strong style={{ color: isExpired ? '#ef4444' : '#10b981' }}>
                            {new Date(sub.currentPeriodEnd).toLocaleString('en-IN')} {isExpired ? '(EXPIRED)' : ''}
                          </strong>
                        </div>
                        <div>
                          <span className="admin-text-label">Payment Reference:</span>
                          <span className="admin-text-value" style={{ fontWeight: 500 }}>{sub.paymentReference || 'None (Manual grant)'}</span>
                        </div>
                        <div>
                          <span className="admin-text-label">Update Origin:</span>
                          <span className="admin-text-value"><code className="admin-code-pill">{sub.lastUpdatedFrom || 'n/a'}</code></span>
                        </div>
                      </div>

                      {/* Controls on this user */}
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => openUser360(sub.userEmail || sub.userId)}
                          className="admin-action-btn-secondary"
                        >
                          <Eye size={12} />
                          Full Dossier
                        </button>
                        <button
                          onClick={() => openSubscriptionControl('extend', sub.userId, sub.userEmail || '', getSubscriptionControlContext(sub))}
                          className="admin-action-btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Extend (+30d)
                        </button>
                        {sub.status === 'active' ? (
                          <button
                            onClick={() => openSubscriptionControl('suspend', sub.userId, sub.userEmail || '', getSubscriptionControlContext(sub))}
                            className="admin-btn-reject"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Suspend Access
                          </button>
                        ) : sub.status === 'halted' || sub.status === 'terminated' ? (
                          <button
                            onClick={() => openSubscriptionControl('reinstate', sub.userId, sub.userEmail || '', getSubscriptionControlContext(sub))}
                            className="admin-badge-approved"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Reinstate Premium
                          </button>
                        ) : null}
                        {(sub.status === 'active' || sub.status === 'halted') && (
                          <button
                            onClick={() => openSubscriptionControl('terminate', sub.userId, sub.userEmail || '', getSubscriptionControlContext(sub))}
                            className="admin-btn-reject"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Terminate Premium
                          </button>
                        )}
                        {sub.status !== 'cancelled' && (
                          <button
                            onClick={() => openSubscriptionControl('revoke', sub.userId, sub.userEmail || '', getSubscriptionControlContext(sub))}
                            className="admin-badge-rejected"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Permanently Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {subTotal > 0 && (
              <AdminPaginationBar
                currentPage={subPage}
                totalItems={subTotal}
                pageSize={ADMIN_PAGE_SIZE}
                loading={subscriptionsLoading}
                itemName="subscribers"
                onPageChange={(newPage) => {
                  setSubPage(newPage);
                  fetchSubscriptions({ page: newPage });
                }}
              />
            )}
          </div>
        )}

        {/* TAB 5: PAYMENT SETTINGS (PHASE 2B.3D UNIFIED CONSOLE) */}
        {activeTab === 'settings_preview' && (
          <PaymentSettingsView onRefreshParent={fetchOverview} />
        )}

        {/* TAB 6: AUDIT LOGS */}
        {activeTab === 'audit_logs' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  Append-Only Administrative Governance Audit Trail
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Showing {auditTotal} audit records
                </span>
              </div>

              {/* Filters toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                    fetchAuditLogs({ action: e.target.value, page: 1 });
                  }}
                  className="admin-form-input"
                  style={{ padding: '0.4rem 0.65rem', borderRadius: 8, fontSize: '0.76rem' }}
                >
                  <option value="all">All Actions</option>
                  <option value="payment_approved">payment_approved</option>
                  <option value="payment_rejected">payment_rejected</option>
                  <option value="admin_grant">admin_grant</option>
                  <option value="subscription_extended">subscription_extended</option>
                  <option value="subscription_suspended">subscription_suspended</option>
                  <option value="subscription_reinstated">subscription_reinstated</option>
                  <option value="subscription_terminated">subscription_terminated</option>
                  <option value="subscription_permanently_revoked">subscription_permanently_revoked</option>
                  <option value="subscription_revoked">subscription_revoked</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter by Admin Email..."
                  value={auditEmailFilter}
                  onChange={(e) => {
                    setAuditEmailFilter(e.target.value);
                    setAuditPage(1);
                    fetchAuditLogs({ adminEmail: e.target.value, page: 1 });
                  }}
                  className="admin-form-input"
                  style={{ padding: '0.4rem 0.65rem', borderRadius: 8, fontSize: '0.76rem', maxWidth: 180 }}
                />

                <input
                  type="text"
                  placeholder="Filter by Target User..."
                  value={auditUserFilter}
                  onChange={(e) => {
                    setAuditUserFilter(e.target.value);
                    setAuditPage(1);
                    fetchAuditLogs({ targetUserId: e.target.value, page: 1 });
                  }}
                  className="admin-form-input"
                  style={{ padding: '0.4rem 0.65rem', borderRadius: 8, fontSize: '0.76rem', maxWidth: 180 }}
                />
              </div>
            </div>

            {auditError && (
              <div style={{ padding: '0.85rem 1.25rem', borderRadius: 12, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.82rem' }}>
                <span>{auditError}</span>
                <button
                  type="button"
                  onClick={() => fetchAuditLogs()}
                  style={{ padding: '0.25rem 0.65rem', borderRadius: 6, background: '#ef4444', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            )}

            {auditLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0 }}>Loading audit logs...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="admin-empty-card">
                <History size={32} style={{ color: 'var(--text-secondary, #64748b)', margin: '0 auto 0.75rem auto' }} />
                <p className="admin-text-value" style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>No audit logs recorded for current filter.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="admin-card"
                    style={{
                      padding: '1rem',
                      borderRadius: 12,
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="admin-badge-info">
                          {log.action}
                        </span>
                        <div className="admin-email-badge">
                          <Mail size={11} style={{ color: 'var(--primary-start, #818cf8)', flexShrink: 0 }} />
                          <strong
                            style={{ fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => openUser360(log.targetUserEmail || log.targetUserId)}
                          >
                            {log.targetUserEmail || log.targetUserId}
                          </strong>
                          {log.targetUserEmail && (
                            <code
                              style={{ fontSize: '0.7rem', opacity: 0.8, cursor: 'pointer' }}
                              onClick={() => openUser360(log.targetUserId)}
                            >
                              ({log.targetUserId})
                            </code>
                          )}
                        </div>
                        <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>
                          Entity: <code className="admin-code-pill">{log.targetEntityId}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => openUser360(log.targetUserEmail || log.targetUserId)}
                          className="admin-action-btn-secondary"
                        >
                          <Eye size={11} />
                          View 360°
                        </button>
                      </div>
                      <span className="admin-text-label" style={{ fontSize: '0.73rem' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="admin-text-label" style={{ fontSize: '0.76rem' }}>
                      Actor: <strong className="admin-text-value">{log.actorEmail}</strong> | Reason: &quot;{log.reason || 'n/a'}&quot;
                    </div>
                  </div>
                ))}
              </div>
            )}

            {auditTotal > 0 && (
              <AdminPaginationBar
                currentPage={auditPage}
                totalItems={auditTotal}
                pageSize={ADMIN_PAGE_SIZE}
                loading={auditLoading}
                itemName="audit records"
                onPageChange={(newPage) => {
                  setAuditPage(newPage);
                  fetchAuditLogs({ page: newPage });
                }}
              />
            )}
          </div>
        )}
        </div>
      </main>

      {/* APPROVAL MODAL */}
      {approvalModalOpen && selectedSubmission && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="admin-modal-card" style={{ maxWidth: 500, width: '100%', border: '1.5px solid rgba(16, 185, 129, 0.4)', padding: '1.75rem' }}>
            <h3 className="admin-text-value" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Confirm Payment Verification & Premium Activation
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Approving this submission will activate 30 days of Premium access for subscriber{' '}
              <strong className="admin-text-value">{selectedSubmission.userEmail ? `${selectedSubmission.userEmail} (${selectedSubmission.userId})` : selectedSubmission.userId}</strong>.
            </p>

            <div className="admin-card-inner" style={{ padding: '0.85rem', borderRadius: 10, marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Mail size={13} style={{ color: 'var(--primary-start, #818cf8)' }} />
                <strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Subscriber Email:</strong> <span style={{ color: 'var(--primary-start, #818cf8)', fontWeight: 700 }}>{selectedSubmission.userEmail || 'Not recorded'}</span>
              </div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>User ID:</strong> <code className="admin-code-pill">{selectedSubmission.userId}</code></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>UTR:</strong> <code style={{ color: '#0284c7', fontWeight: 700 }}>{selectedSubmission.utrNumber}</code></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Declared Amount:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>₹{selectedSubmission.declaredAmount} INR</span></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Payment Date:</strong> <span className="admin-text-value" style={{ fontWeight: 600, fontStyle: selectedSubmission.paymentDate ? 'normal' : 'italic' }}>{selectedSubmission.paymentDate || 'Not recorded'}</span></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Submitted At:</strong> <span className="admin-text-value">{new Date(selectedSubmission.submittedAt).toLocaleString('en-IN')}</span></div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="admin-text-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Verification Notes (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Verified in ICICI Corporate net banking at 11:45 AM"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                className="admin-form-input"
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.78rem', color: '#10b981' }}>
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
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.82rem', cursor: 'pointer' }}
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
          <div className="admin-modal-card" style={{ maxWidth: 500, width: '100%', border: '1.5px solid rgba(239, 68, 68, 0.4)', padding: '1.75rem' }}>
            <h3 className="admin-text-value" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Reject Payment Submission
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Rejection releases the reserved UTR so the user can correct their input. It does not grant Premium access.
            </p>

            <div className="admin-card-inner" style={{ padding: '0.85rem', borderRadius: 10, marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Mail size={13} style={{ color: '#ef4444' }} />
                <strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Subscriber Email:</strong> <span style={{ color: '#ef4444', fontWeight: 700 }}>{selectedSubmission.userEmail || 'Not recorded'}</span>
              </div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>User ID:</strong> <code className="admin-code-pill">{selectedSubmission.userId}</code></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>UTR:</strong> <code style={{ color: '#0284c7', fontWeight: 700 }}>{selectedSubmission.utrNumber}</code></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Declared Amount:</strong> <span className="admin-text-value" style={{ fontWeight: 600 }}>₹{selectedSubmission.declaredAmount} INR</span></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Payment Date:</strong> <span className="admin-text-value" style={{ fontWeight: 600, fontStyle: selectedSubmission.paymentDate ? 'normal' : 'italic' }}>{selectedSubmission.paymentDate || 'Not recorded'}</span></div>
              <div><strong className="admin-text-label" style={{ display: 'inline', marginRight: 4 }}>Submitted At:</strong> <span className="admin-text-value">{new Date(selectedSubmission.submittedAt).toLocaleString('en-IN')}</span></div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="admin-text-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Rejection Reason (Mandatory):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. UTR not found in bank statement for the stated date. Please check your banking app transaction history."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="admin-form-input"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 10, fontSize: '0.82rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                disabled={actionInProgress}
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.82rem', cursor: 'pointer' }}
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
          <div className="admin-modal-card" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid rgba(99, 102, 241, 0.4)', padding: '1.75rem' }}>
            <h3 className="admin-text-value" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Manage Premium Access
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Every action requires an administrative reason and is recorded in the audit trail. Grants and extensions never create payment records.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label id="admin-action-type-label" className="admin-text-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Choose an action:
                </label>
                <div
                  ref={controlActionDropdownRef}
                  className="admin-action-select"
                  onBlur={(event) => {
                    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                      setControlActionMenuOpen(false);
                    }
                  }}
                >
                  <button
                    ref={controlActionButtonRef}
                    type="button"
                    className="admin-action-select-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={controlActionMenuOpen}
                    aria-controls="admin-action-options"
                    aria-labelledby="admin-action-type-label admin-action-selected-label"
                    onClick={() => {
                      const opening = !controlActionMenuOpen;
                      setControlActionMenuOpen(opening);
                      if (opening) {
                        const selectedIndex = ADMIN_SUBSCRIPTION_ACTIONS.findIndex((option) => option.value === controlAction);
                        requestAnimationFrame(() => controlActionOptionRefs.current[selectedIndex]?.focus());
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        const selectedIndex = ADMIN_SUBSCRIPTION_ACTIONS.findIndex((option) => option.value === controlAction);
                        const targetIndex = event.key === 'ArrowDown'
                          ? (selectedIndex + 1) % ADMIN_SUBSCRIPTION_ACTIONS.length
                          : (selectedIndex - 1 + ADMIN_SUBSCRIPTION_ACTIONS.length) % ADMIN_SUBSCRIPTION_ACTIONS.length;
                        setControlActionMenuOpen(true);
                        requestAnimationFrame(() => controlActionOptionRefs.current[targetIndex]?.focus());
                      } else if (event.key === 'Escape') {
                        setControlActionMenuOpen(false);
                      }
                    }}
                  >
                    <span id="admin-action-selected-label">{ADMIN_SUBSCRIPTION_ACTIONS.find((option) => option.value === controlAction)?.label}</span>
                    <span aria-hidden="true">{controlActionMenuOpen ? '▴' : '▾'}</span>
                  </button>
                  {controlActionMenuOpen && (
                    <div id="admin-action-options" className="admin-action-option-list" role="listbox" aria-labelledby="admin-action-type-label">
                      {ADMIN_SUBSCRIPTION_ACTIONS.map((option, index) => (
                        <button
                          key={option.value}
                          ref={(element) => { controlActionOptionRefs.current[index] = element; }}
                          type="button"
                          role="option"
                          aria-selected={controlAction === option.value}
                          tabIndex={controlAction === option.value ? 0 : -1}
                          className={`admin-action-option ${controlAction === option.value ? 'is-selected' : ''}`}
                          onClick={() => selectSubscriptionAction(option.value)}
                          onKeyDown={(event) => handleSubscriptionActionKeyDown(event, index)}
                        >
                          <span className="admin-action-option-title">{option.label}</span>
                          <span className="admin-action-option-description">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="admin-action-context" aria-live="polite">
                  {ADMIN_SUBSCRIPTION_ACTIONS.find((option) => option.value === controlAction)?.explanation}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="admin-text-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Target User ID or Email:
                  </label>
                  {controlTargetUserEmail && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--primary-start, #818cf8)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
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
                    setControlTargetSubscription(null);
                    if (!e.target.value.includes('@')) {
                      setControlTargetUserEmail('');
                    }
                  }}
                  className="admin-form-input"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, fontSize: '0.82rem' }}
                />
                {controlTargetSubscription && (
                  <div className="admin-action-target-summary" aria-live="polite">
                    <span><strong>Current status:</strong> {controlTargetSubscription.status}</span>
                    <span>
                      <strong>Subscription expiry:</strong>{' '}
                      {controlTargetSubscription.currentPeriodEnd
                        ? new Date(controlTargetSubscription.currentPeriodEnd).toLocaleString('en-IN')
                        : 'Not available'}
                    </span>
                  </div>
                )}
                {!controlTargetSubscription && controlTargetUserId.trim() && (
                  <p className="admin-action-context">
                    Current status and expiry are shown when this action is opened from a subscription record or User 360 dossier.
                  </p>
                )}
              </div>

              {(controlAction === 'grant' || controlAction === 'extend') && (
                <div>
                  <label className="admin-text-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Days Duration:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={controlDays}
                    onChange={(e) => setControlDays(parseInt(e.target.value, 10) || 30)}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, fontSize: '0.82rem' }}
                  />
                </div>
              )}

              {(controlAction === 'terminate' || controlAction === 'revoke') && (
                <label className="admin-action-confirmation">
                  <input
                    type="checkbox"
                    checked={controlActionConfirmed}
                    onChange={(event) => setControlActionConfirmed(event.target.checked)}
                  />
                  <span>
                    {controlAction === 'terminate'
                      ? 'I understand Premium access stops immediately, but may be restored before the original expiry.'
                      : 'I understand this permanently disables access and cannot be undone through reinstatement.'}
                  </span>
                </label>
              )}

              <div>
                <label className="admin-text-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Administrative Justification / Reason (Mandatory):
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. VIP test access granted or support dispute resolution"
                  value={controlReason}
                  onChange={(e) => setControlReason(e.target.value)}
                  className="admin-form-input"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setControlModalOpen(false);
                  setControlActionMenuOpen(false);
                }}
                disabled={actionInProgress}
                style={{ padding: '0.55rem 1rem', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleControlSubmit}
                disabled={!controlTargetUserId.trim() || !controlReason.trim() || actionInProgress || ((controlAction === 'terminate' || controlAction === 'revoke') && !controlActionConfirmed)}
                style={{ padding: '0.55rem 1.25rem', borderRadius: 10, background: !controlTargetUserId.trim() || !controlReason.trim() || actionInProgress ? 'rgba(99, 102, 241, 0.3)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: !controlTargetUserId.trim() || !controlReason.trim() || actionInProgress || ((controlAction === 'terminate' || controlAction === 'revoke') && !controlActionConfirmed) ? 'not-allowed' : 'pointer' }}
              >
                {actionInProgress
                  ? 'Executing...'
                  : controlAction === 'grant'
                    ? 'Grant Premium'
                    : controlAction === 'extend'
                      ? 'Extend Subscription'
                      : controlAction === 'suspend'
                        ? 'Suspend Access'
                        : controlAction === 'reinstate'
                          ? 'Reinstate Premium'
                          : controlAction === 'terminate'
                            ? 'Terminate Premium'
                            : 'Permanently Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER 360° PROFILE & ENTITLEMENT DOSSIER MODAL */}
      {user360ModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(10px)' }}>
          <div className="admin-modal-card" style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', border: '1.5px solid rgba(99, 102, 241, 0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <User size={20} />
                </div>
                <div>
                  <h3 className="admin-text-value" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                    User 360° Profile & Entitlement Dossier
                  </h3>
                  <span className="admin-text-label" style={{ fontSize: '0.76rem' }}>
                    Target Identifier: <code className="admin-code-pill">{user360TargetUserId}</code>
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => openUser360(user360TargetUserId)}
                  disabled={user360Loading}
                  className="admin-action-btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                >
                  <RefreshCw size={12} className={user360Loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={closeUser360}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', padding: '0.35rem' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {user360Loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#6366f1' }} />
                  <p className="admin-text-value" style={{ margin: 0, fontSize: '0.9rem' }}>Retrieving User 360° chronological dossier...</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>Cross-referencing Firestore identities, orders, claims, and audit logs.</p>
                </div>
              ) : user360Error ? (
                <div style={{ padding: '1.5rem', borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', textAlign: 'center' }}>
                  <AlertOctagon size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontWeight: 700, margin: 0 }}>Unable to load dossier</p>
                  <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: '0.35rem 0 1rem 0' }}>{user360Error}</p>
                  <button
                    type="button"
                    onClick={() => openUser360(user360TargetUserId)}
                    style={{ padding: '0.45rem 1rem', borderRadius: 8, background: '#ef4444', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Retry Query
                  </button>
                </div>
              ) : user360Dossier ? (
                <>
                  {/* Top Row: Identity & Entitlement Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
                    {/* Identity Card */}
                    <div className="admin-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8' }}>
                          User Identity
                        </span>
                        <span className="admin-badge-approved">
                          {user360Dossier.identity.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                          {(user360Dossier.identity.name || user360Dossier.identity.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 className="admin-text-value" style={{ fontSize: '1rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user360Dossier.identity.name || 'Unspecified Name'}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: 2 }}>
                            <Mail size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
                            <span className="admin-text-label" style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user360Dossier.identity.email || 'Email not recorded'}
                            </span>
                            {user360Dossier.identity.isEmailVerified ? (
                              <span title="Verified by Provider" style={{ display: 'inline-flex', alignItems: 'center', color: '#10b981' }}>
                                <BadgeCheck size={14} />
                              </span>
                            ) : (
                              <span title="Unverified" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>(unverified)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.76rem' }}>
                        <div>
                          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>Canonical User ID:</span>
                          <code className="admin-code-pill" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{user360Dossier.identity.userId}</code>
                        </div>
                        <div>
                          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>Auth Provider:</span>
                          <span className="admin-text-value" style={{ fontWeight: 600 }}>{user360Dossier.identity.provider || 'unknown'}</span>
                        </div>
                        <div>
                          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>Registered At:</span>
                          <span className="admin-text-value">
                            {user360Dossier.identity.createdAt ? new Date(user360Dossier.identity.createdAt).toLocaleDateString('en-IN') : 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>Total Orders Created:</span>
                          <span className="admin-text-value" style={{ fontWeight: 700 }}>{user360Dossier.orders.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Authoritative Entitlement Card */}
                    <div className="admin-card" style={{ padding: '1.25rem', border: `1.5px solid ${user360Dossier.subscription?.isPremium ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: user360Dossier.subscription?.isPremium ? '#10b981' : 'var(--text-secondary)' }}>
                          Authoritative Entitlement (entitlement.service.ts)
                        </span>
                        <span className={user360Dossier.subscription?.isPremium ? 'admin-badge-approved' : 'admin-badge-info'}>
                          {user360Dossier.subscription ? user360Dossier.subscription.entitlementStatus.toUpperCase() : 'FREE TIER'}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: user360Dossier.subscription?.isPremium ? '#10b981' : 'var(--text-secondary, #cbd5e1)' }}>
                          {user360Dossier.subscription?.isPremium ? 'Premium Active' : 'Free Access'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4 }}>
                          <span className={user360Dossier.subscription?.source === 'payment_backed' ? 'admin-badge-approved' : user360Dossier.subscription?.source === 'manual_grant' ? 'admin-badge-purple' : 'admin-badge-info'}>
                            {user360Dossier.subscription?.source === 'payment_backed' ? 'PAYMENT-BACKED (₹499 UPI)' : user360Dossier.subscription?.source === 'manual_grant' ? 'ADMINISTRATIVE GRANT' : 'NO PAID ENTITLEMENT'}
                          </span>
                          {user360Dossier.subscription && (
                            <span style={{ fontSize: '0.75rem', color: user360Dossier.subscription.remainingDays > 0 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                              {user360Dossier.subscription.remainingDays > 0
                                ? `${user360Dossier.subscription.remainingDays} days remaining`
                                : 'Expired'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.76rem' }}>
                        <div>
                          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>Period Start:</span>
                          <span className="admin-text-value">
                            {user360Dossier.subscription?.currentPeriodStart ? new Date(user360Dossier.subscription.currentPeriodStart).toLocaleString('en-IN') : 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>Period End:</span>
                          <span style={{ color: user360Dossier.subscription?.isPremium ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {user360Dossier.subscription?.currentPeriodEnd ? new Date(user360Dossier.subscription.currentPeriodEnd).toLocaleString('en-IN') : 'None'}
                          </span>
                        </div>
                      </div>

                      {user360Dossier.subscription?.terminatedAt && (
                        <div className="admin-card-inner" style={{ padding: '0.65rem 0.75rem', borderRadius: 9, fontSize: '0.74rem' }}>
                          <strong className="admin-text-value">Latest reversible termination</strong>
                          <div className="admin-text-label" style={{ marginTop: '0.2rem' }}>
                            {new Date(user360Dossier.subscription.terminatedAt).toLocaleString('en-IN')}
                            {user360Dossier.subscription.terminatedBy ? ` • by ${user360Dossier.subscription.terminatedBy}` : ''}
                          </div>
                          {user360Dossier.subscription.terminationReason && (
                            <div className="admin-text-label" style={{ marginTop: '0.2rem' }}>
                              Reason: {user360Dossier.subscription.terminationReason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Admin Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => openSubscriptionControl(
                            'extend',
                            user360Dossier.identity.userId,
                            user360Dossier.identity.email || '',
                            getSubscriptionControlContext(user360Dossier.subscription)
                          )}
                          className="admin-action-btn-secondary"
                        >
                          Extend (+30d)
                        </button>
                        {user360Dossier.subscription?.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => openSubscriptionControl(
                              'suspend',
                              user360Dossier.identity.userId,
                              user360Dossier.identity.email || '',
                              getSubscriptionControlContext(user360Dossier.subscription)
                            )}
                            style={{ padding: '0.35rem 0.65rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Suspend
                          </button>
                        ) : user360Dossier.subscription?.status === 'halted' || user360Dossier.subscription?.status === 'terminated' ? (
                          <button
                            type="button"
                            onClick={() => openSubscriptionControl(
                              'reinstate',
                              user360Dossier.identity.userId,
                              user360Dossier.identity.email || '',
                              getSubscriptionControlContext(user360Dossier.subscription)
                            )}
                            style={{ padding: '0.35rem 0.65rem', borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reinstate Premium
                          </button>
                        ) : null}
                        {(user360Dossier.subscription?.status === 'active' || user360Dossier.subscription?.status === 'halted') && (
                          <button
                            type="button"
                            onClick={() => openSubscriptionControl(
                              'terminate',
                              user360Dossier.identity.userId,
                              user360Dossier.identity.email || '',
                              getSubscriptionControlContext(user360Dossier.subscription)
                            )}
                            className="admin-btn-reject"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem' }}
                          >
                            Terminate Premium
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openSubscriptionControl(
                            'grant',
                            user360Dossier.identity.userId,
                            user360Dossier.identity.email || '',
                            user360Dossier.subscription
                              ? { status: user360Dossier.subscription.status, currentPeriodEnd: user360Dossier.subscription.currentPeriodEnd || '' }
                              : undefined
                          )}
                          style={{ padding: '0.35rem 0.65rem', borderRadius: 8, background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#a855f7', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Grant Premium
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chronological History Timeline */}
                  <div className="admin-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h4 className="admin-text-value" style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <History size={16} style={{ color: 'var(--primary-start, #818cf8)' }} />
                        Unified Chronological History ({user360Dossier.timeline.length} events)
                      </h4>
                      <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
                        Orders • Claims • Approvals • Rejections • Grants • Status Changes
                      </span>
                    </div>

                    {user360Dossier.timeline.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary, #64748b)', fontSize: '0.8rem' }}>
                        No history events recorded for this user.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {user360Dossier.timeline.map((evt) => {
                          return (
                            <div
                              key={evt.id}
                              className="admin-card-inner"
                              style={{
                                padding: '0.75rem 1rem',
                                borderRadius: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.3rem',
                                fontSize: '0.78rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span className={
                                    evt.badgeColor === 'emerald'
                                      ? 'admin-badge-approved'
                                      : evt.badgeColor === 'rose'
                                      ? 'admin-badge-rejected'
                                      : evt.badgeColor === 'amber'
                                      ? 'admin-badge-pending'
                                      : 'admin-badge-info'
                                  }>
                                    {evt.action.toUpperCase()}
                                  </span>
                                  <strong className="admin-text-value">{evt.summary}</strong>
                                </div>
                                <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
                                  {new Date(evt.timestamp).toLocaleString('en-IN')}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.73rem' }}>
                                <span>Actor: <strong className="admin-text-value">{evt.actor}</strong></span>
                                {evt.details && typeof evt.details === 'object' && Object.keys(evt.details).length > 0 && (
                                  <span style={{ color: 'var(--text-secondary, #64748b)' }}>
                                    {Object.entries(evt.details)
                                      .filter(([, v]) => v !== undefined && v !== null && v !== '')
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(' • ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Orders & Submissions Breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
                    {/* Orders List */}
                    <div className="admin-card" style={{ padding: '1.25rem' }}>
                      <h4 className="admin-text-value" style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Receipt size={14} style={{ color: 'var(--primary-start, #818cf8)' }} />
                        Orders ({user360Dossier.orders.length})
                      </h4>
                      {user360Dossier.orders.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.78rem', margin: 0 }}>No payment orders created.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 240, overflowY: 'auto' }}>
                          {user360Dossier.orders.map((o) => (
                            <div key={o.orderId} className="admin-card-inner" style={{ padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <code className="admin-code-pill">{o.orderId}</code>
                                <div className="admin-text-label" style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                  ₹{o.amountInr} • {new Date(o.createdAt).toLocaleDateString('en-IN')}
                                </div>
                              </div>
                              <span className={o.status === 'submitted' ? 'admin-badge-approved' : 'admin-badge-info'}>
                                {o.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submissions List */}
                    <div className="admin-card" style={{ padding: '1.25rem' }}>
                      <h4 className="admin-text-value" style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CreditCard size={14} style={{ color: '#10b981' }} />
                        Payment Claims ({user360Dossier.submissions.length})
                      </h4>
                      {user360Dossier.submissions.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.78rem', margin: 0 }}>No payment claims submitted.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 240, overflowY: 'auto' }}>
                          {user360Dossier.submissions.map((s) => (
                            <div key={s.submissionId || s.orderId} className="admin-card-inner" style={{ padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span className="admin-text-label">UTR:</span>
                                  <code className="admin-code-utr">{s.utrNumber}</code>
                                </div>
                                <div className="admin-text-label" style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                  ₹{s.declaredAmount} • Paid: <span style={{ color: s.paymentDate ? 'var(--text-primary)' : 'var(--text-secondary)', fontStyle: s.paymentDate ? 'normal' : 'italic' }}>{s.paymentDate || 'Not recorded'}</span> • Claimed: {new Date(s.submittedAt).toLocaleDateString('en-IN')}
                                </div>
                              </div>
                              <span className={s.status === 'approved' ? 'admin-badge-approved' : s.status === 'rejected' ? 'admin-badge-rejected' : 'admin-badge-pending'}>
                                {s.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeUser360}
                className="admin-btn-secondary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem' }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
