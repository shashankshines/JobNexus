'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX,
  LogOut,
  Trash2,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

export type AccountActionType =
  | 'suspend'
  | 'reinstate'
  | 'deactivate'
  | 'reactivate'
  | 'revoke_sessions'
  | 'request_deletion'
  | 'cancel_deletion'
  | 'execute_deletion';

export interface AccountLifecycleModalProps {
  isOpen: boolean;
  action: AccountActionType;
  user: {
    id: string;
    email: string;
    name?: string;
    status?: string;
  } | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function AccountLifecycleModal({
  isOpen,
  action,
  user,
  onClose,
  onSuccess,
  onError,
}: AccountLifecycleModalProps) {
  const [reason, setReason] = useState<string>('');
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [confirmationChecked, setConfirmationChecked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen || !user) return null;

  const isDestructive =
    action === 'suspend' ||
    action === 'deactivate' ||
    action === 'request_deletion' ||
    action === 'execute_deletion';

  const getActionConfig = () => {
    switch (action) {
      case 'suspend':
        return {
          title: 'Suspend User Account',
          icon: <UserX size={20} style={{ color: '#ef4444' }} />,
          buttonLabel: 'Confirm Account Suspension',
          buttonStyle: { background: '#ef4444', color: '#ffffff' },
          badgeText: 'ACCESS RESTRICTION',
          badgeBg: 'rgba(239, 68, 68, 0.15)',
          badgeColor: '#ef4444',
          explanation:
            'Suspending this account immediately blocks login and API access and terminates all active sessions. Crucially, any active Premium subscription remains untouched and Authoritative entitlement is preserved.',
        };
      case 'reinstate':
        return {
          title: 'Reinstate User Account',
          icon: <UserCheck size={20} style={{ color: '#10b981' }} />,
          buttonLabel: 'Confirm Account Reinstatement',
          buttonStyle: { background: '#10b981', color: '#ffffff' },
          badgeText: 'ACCESS RESTORATION',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeColor: '#10b981',
          explanation:
            'Restores full login access to this account. The user will be able to sign in normally. Their Authoritative entitlement (entitlement.service.ts) will govern their access rights.',
        };
      case 'deactivate':
        return {
          title: 'Deactivate User Account',
          icon: <Lock size={20} style={{ color: '#f59e0b' }} />,
          buttonLabel: 'Confirm Account Deactivation',
          buttonStyle: { background: '#f59e0b', color: '#000000', fontWeight: 700 },
          badgeText: 'TEMPORARY DEACTIVATION',
          badgeBg: 'rgba(245, 158, 11, 0.15)',
          badgeColor: '#f59e0b',
          explanation:
            'Deactivates the account and revokes active sessions. An administrator can reactivate this account at any time.',
        };
      case 'reactivate':
        return {
          title: 'Reactivate User Account',
          icon: <RotateCcw size={20} style={{ color: '#10b981' }} />,
          buttonLabel: 'Confirm Reactivation',
          buttonStyle: { background: '#10b981', color: '#ffffff' },
          badgeText: 'ACCOUNT REACTIVATION',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeColor: '#10b981',
          explanation: 'Restores a deactivated account to active status.',
        };
      case 'revoke_sessions':
        return {
          title: 'Force Sign-Out (Revoke All Sessions)',
          icon: <LogOut size={20} style={{ color: '#818cf8' }} />,
          buttonLabel: 'Revoke All Sessions Now',
          buttonStyle: { background: '#6366f1', color: '#ffffff' },
          badgeText: 'SESSION INVALIDATION',
          badgeBg: 'rgba(99, 102, 241, 0.15)',
          badgeColor: '#818cf8',
          explanation:
            'Server-side invalidation of all active session tokens for this user. Any active browser cookies will immediately fail validation on next request. Unrelated users are not affected.',
        };
      case 'request_deletion':
        return {
          title: 'Initiate Controlled Account Deletion',
          icon: <Trash2 size={20} style={{ color: '#f43f5e' }} />,
          buttonLabel: 'Schedule Deletion Request',
          buttonStyle: { background: '#e11d48', color: '#ffffff' },
          badgeText: 'CONTROLLED WORKFLOW',
          badgeBg: 'rgba(225, 29, 72, 0.15)',
          badgeColor: '#f43f5e',
          explanation:
            'Puts the account into deletion_requested status and immediately terminates active sessions. A configurable retention window allows cancellation before irreversible purging.',
        };
      case 'cancel_deletion':
        return {
          title: 'Cancel Account Deletion Request',
          icon: <RotateCcw size={20} style={{ color: '#10b981' }} />,
          buttonLabel: 'Abort Deletion & Reinstate',
          buttonStyle: { background: '#10b981', color: '#ffffff' },
          badgeText: 'DELETION ABORTED',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeColor: '#10b981',
          explanation:
            'Cancels the scheduled deletion request and reinstates the account to active status.',
        };
      case 'execute_deletion':
        return {
          title: 'Execute Permanent Account Deletion',
          icon: <ShieldAlert size={20} style={{ color: '#ef4444' }} />,
          buttonLabel: 'Permanently Purge Account Records',
          buttonStyle: { background: '#b91c1c', color: '#ffffff' },
          badgeText: 'IRREVERSIBLE PURGE',
          badgeBg: 'rgba(185, 28, 28, 0.2)',
          badgeColor: '#f87171',
          explanation:
            'CRITICAL: Permanently purges user identity, credentials, password hashes, and active sessions. In accordance with financial compliance and immutable retention obligations, UPI orders, submissions, and audit logs are preserved.',
        };
    }
  };

  const config = getActionConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      onError('A mandatory administrative reason of at least 5 characters is required.');
      return;
    }

    if (action === 'execute_deletion' && !confirmationChecked) {
      onError('You must explicitly check the confirmation box before permanent deletion.');
      return;
    }

    setLoading(true);
    try {
      if (
        action === 'suspend' ||
        action === 'reinstate' ||
        action === 'deactivate' ||
        action === 'reactivate'
      ) {
        const targetStatus =
          action === 'suspend'
            ? 'suspended'
            : action === 'deactivate'
            ? 'deactivated'
            : 'active';

        const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: targetStatus,
            reason: reason.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update account status.');
        }
        onSuccess(
          data.message ||
            `Account successfully ${action === 'suspend' ? 'suspended' : action === 'deactivate' ? 'deactivated' : 'reinstated'}.`
        );
        onClose();
      } else if (action === 'revoke_sessions') {
        const res = await fetch(
          `/api/admin/users/${encodeURIComponent(user.id)}/sessions/revoke`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: reason.trim(),
            }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to revoke sessions.');
        }
        onSuccess(data.message || `Successfully revoked all sessions for ${user.email}.`);
        onClose();
      } else if (
        action === 'request_deletion' ||
        action === 'cancel_deletion' ||
        action === 'execute_deletion'
      ) {
        const deletionAction =
          action === 'request_deletion'
            ? 'request'
            : action === 'cancel_deletion'
            ? 'cancel'
            : 'execute';

        const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/deletion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: deletionAction,
            reason: reason.trim(),
            retentionDays: action === 'request_deletion' ? retentionDays : undefined,
            confirmationChecked: action === 'execute_deletion' ? confirmationChecked : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to process deletion action.');
        }
        onSuccess(data.message || 'Account deletion action executed successfully.');
        onClose();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Action failed due to network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        background: 'var(--modal-backdrop, rgba(3, 7, 18, 0.85))',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="admin-modal-card"
        style={{
          maxWidth: 580,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: `1.5px solid ${isDestructive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: config.badgeBg,
                border: `1px solid ${config.badgeColor}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {config.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3
                  className="admin-text-value"
                  style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}
                >
                  {config.title}
                </h3>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: config.badgeColor,
                  textTransform: 'uppercase',
                }}
              >
                {config.badgeText}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Target User Summary Card */}
          <div
            className="admin-card"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Target Account:</span>
              <span className="admin-text-value" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                {user.email}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Canonical ID:</span>
              <code className="admin-code-pill" style={{ fontSize: '0.72rem' }}>{user.id}</code>
            </div>
            {user.status && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Current Status:</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: user.status === 'active' ? '#10b981' : '#ef4444',
                  }}
                >
                  {user.status}
                </span>
              </div>
            )}
          </div>

          {/* Explanation Alert */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 10,
              background: isDestructive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.08)',
              border: `1px solid ${isDestructive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              fontSize: '0.8rem',
              lineHeight: 1.45,
              color: 'var(--text-secondary, #cbd5e1)',
            }}
          >
            <AlertTriangle
              size={18}
              style={{
                color: isDestructive ? '#ef4444' : '#818cf8',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <span>{config.explanation}</span>
          </div>

          {/* Optional Retention Days for request_deletion */}
          {action === 'request_deletion' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  color: 'var(--text-primary)',
                }}
              >
                Retention Grace Period (Days)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Math.max(1, parseInt(e.target.value, 10) || 30))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
                Account will remain in deletion_requested status for this many days before final purging.
              </span>
            </div>
          )}

          {/* Mandatory Reason Field */}
          <div>
            <label
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '0.4rem',
                color: 'var(--text-primary)',
              }}
            >
              <span>Mandatory Administrative Reason: *</span>
              <span style={{ fontSize: '0.72rem', color: reason.trim().length >= 5 ? '#10b981' : '#f59e0b' }}>
                {reason.trim().length >= 5 ? '✓ Valid justification' : `${5 - reason.trim().length} chars needed`}
              </span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Terms of service violation, user requested self-exclusion, security breach containment..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <span className="admin-text-label" style={{ fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
              Recorded immutably in <code>admin_audit_logs</code> with operator ID and timestamp.
            </span>
          </div>

          {/* Explicit Confirmation Checkbox for Execute Deletion */}
          {action === 'execute_deletion' && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <input
                type="checkbox"
                id="deletion-confirm-check"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#ef4444', cursor: 'pointer' }}
              />
              <label
                htmlFor="deletion-confirm-check"
                style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}
              >
                I confirm the permanent purge of this user&apos;s authentication and credential records.
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="admin-action-btn-secondary"
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.82rem',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                reason.trim().length < 5 ||
                (action === 'execute_deletion' && !confirmationChecked)
              }
              style={{
                ...config.buttonStyle,
                padding: '0.65rem 1.35rem',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: loading || reason.trim().length < 5 ? 'not-allowed' : 'pointer',
                opacity: loading || reason.trim().length < 5 ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                minHeight: '44px',
              }}
            >
              {loading && <RefreshCw size={14} className="animate-spin" />}
              <span>{config.buttonLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
