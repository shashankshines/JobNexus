'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Lock,
  LogOut,
  Trash2,
  Download,
  Users,
  Shield,
  CreditCard,
  Bookmark,
  Calendar,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  AdminUserDirectoryRecord,
  AdminUsersDirectoryResponse,
} from '@/modules/storage/firestore/admin-billing.store';
import { AdminPaginationBar } from './AdminPaginationBar';
import { AccountActionType } from './AccountLifecycleModal';

export interface UsersDirectoryViewProps {
  users: AdminUserDirectoryRecord[];
  summary: AdminUsersDirectoryResponse['summary'] | null;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: string;
  providerFilter: string;
  premiumFilter: string;
  sortBy: string;
  sortOrder: string;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onProviderFilterChange: (provider: string) => void;
  onPremiumFilterChange: (premium: string) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onRefresh: () => void;
  onOpenUser360: (userId: string) => void;
  onOpenAccountAction: (
    action: AccountActionType,
    user: { id: string; email: string; name?: string; status?: string }
  ) => void;
}

interface ActionMenuState {
  user: AdminUserDirectoryRecord;
  top?: number;
  bottom?: number;
  right: number;
  placement: 'top' | 'bottom';
  maxHeight?: number;
}

export function UsersDirectoryView({
  users,
  summary,
  total,
  page,
  pageSize,
  loading,
  error,
  searchQuery,
  statusFilter,
  providerFilter,
  premiumFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onStatusFilterChange,
  onProviderFilterChange,
  onPremiumFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onOpenUser360,
  onOpenAccountAction,
}: UsersDirectoryViewProps) {
  // Desktop 3-dots action menu state (smart placement anchored top or bottom)
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);

  // Close floating desktop menu on scroll or resize so it stays anchored cleanly
  useEffect(() => {
    if (!actionMenu) return;
    const handleDismiss = () => setActionMenu(null);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [actionMenu]);

  const handleToggleActionMenu = (
    userRecord: AdminUserDirectoryRecord,
    e: React.MouseEvent<HTMLButtonElement>,
    index: number
  ) => {
    e.stopPropagation();
    if (actionMenu?.user.id === userRecord.id) {
      setActionMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening upward if the row is near the bottom of the table or space below is tight,
    // as long as there is reasonable room above.
    const isNearBottom = users.length >= 2 ? index >= users.length - 2 : false;
    const shouldOpenUp =
      (isNearBottom || spaceBelow < menuHeight + 20) &&
      (spaceAbove >= 120 || spaceAbove > spaceBelow);

    const right = Math.max(12, window.innerWidth - rect.right);

    if (shouldOpenUp) {
      setActionMenu({
        user: userRecord,
        bottom: window.innerHeight - rect.top + 6,
        right,
        placement: 'top',
        maxHeight: Math.min(320, Math.max(140, spaceAbove - 16)),
      });
    } else {
      setActionMenu({
        user: userRecord,
        top: rect.bottom + 6,
        right,
        placement: 'bottom',
        maxHeight: Math.min(320, Math.max(140, spaceBelow - 16)),
      });
    }
  };
  
  // Mobile / Touch action sheet drawer state
  const [mobileActionUser, setMobileActionUser] = useState<AdminUserDirectoryRecord | null>(null);

  const handleExportUser = async (userId: string, format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/export?format=${format}`);
      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_export_${userId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* SECTION 1: DIRECTORY SUMMARY METRICS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
          gap: '0.85rem',
        }}
      >
        {/* Total Users */}
        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            borderLeft: '4px solid #6366f1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Registered
            </span>
            <Users size={16} style={{ color: '#818cf8' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary?.totalUsers ?? total}
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>
            Across all auth providers
          </span>
        </div>

        {/* Active Accounts */}
        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            borderLeft: '4px solid #10b981',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Active Accounts
            </span>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>
            {summary?.activeUsers ?? 0}
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>
            Unrestricted access
          </span>
        </div>

        {/* Suspended & Restricted */}
        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            borderLeft: '4px solid #ef4444',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Suspended Accounts
            </span>
            <UserX size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>
            {summary?.suspendedUsers ?? 0}
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>
            {(summary?.deactivatedUsers ?? 0) > 0 ? `+ ${summary?.deactivatedUsers} deactivated` : 'Login blocked server-side'}
          </span>
        </div>

        {/* Authentication Split */}
        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            borderLeft: '4px solid #f59e0b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Auth Methods
            </span>
            <Shield size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#60a5fa' }}>
              {summary?.googleUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>Google</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#a78bfa' }}>
              {summary?.credentialsUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>Password</span>
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>
            Verified Google vs Local
          </span>
        </div>

        {/* Premium vs Free */}
        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            borderLeft: '4px solid #a855f7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Subscription Tier
            </span>
            <CreditCard size={16} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>
              {summary?.premiumUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>Premium</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              {summary?.freeUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>Free</span>
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.7rem' }}>
            Authoritative entitlement state
          </span>
        </div>
      </div>

      {/* SECTION 2: SEARCH & FILTER TOOLBAR */}
      <div
        className="admin-card"
        style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 260px',
              maxWidth: '100%',
            }}
          >
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary, #94a3b8)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search user by name, email, or user ID..."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                minHeight: '42px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter Dropdowns & Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            {/* Account Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                minHeight: '40px',
                flex: '1 1 140px',
              }}
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="suspended">Suspended Accounts</option>
              <option value="deactivated">Deactivated Accounts</option>
              <option value="deletion_requested">Deletion Requested</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => onProviderFilterChange(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                minHeight: '40px',
                flex: '1 1 130px',
              }}
            >
              <option value="all">All Auth Providers</option>
              <option value="google">Google Auth</option>
              <option value="credentials">Credentials / Password</option>
            </select>

            {/* Premium Status Filter */}
            <select
              value={premiumFilter}
              onChange={(e) => onPremiumFilterChange(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                minHeight: '40px',
                flex: '1 1 130px',
              }}
            >
              <option value="all">All Subscriptions</option>
              <option value="active">Premium Active</option>
              <option value="free">Free Tier</option>
              <option value="expired">Expired Premium</option>
              <option value="suspended">Suspended Premium</option>
            </select>

            {/* Sort Selector */}
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':');
                onSortChange(sb, so);
              }}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                minHeight: '40px',
                flex: '1 1 150px',
              }}
            >
              <option value="createdAt:desc">Newest Registered</option>
              <option value="createdAt:asc">Oldest Registered</option>
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
              <option value="email:asc">Email (A-Z)</option>
              <option value="lastActiveAt:desc">Recently Active</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="admin-action-btn-secondary"
              style={{
                padding: '0.55rem 0.85rem',
                fontSize: '0.82rem',
                minHeight: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Refresh Directory"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {(searchQuery || statusFilter !== 'all' || providerFilter !== 'all' || premiumFilter !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
            <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>Active Filters:</span>
            {searchQuery && (
              <span className="admin-code-pill" style={{ fontSize: '0.72rem' }}>
                Search: &quot;{searchQuery}&quot;
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="admin-code-pill" style={{ fontSize: '0.72rem' }}>
                Status: {statusFilter}
              </span>
            )}
            {providerFilter !== 'all' && (
              <span className="admin-code-pill" style={{ fontSize: '0.72rem' }}>
                Provider: {providerFilter}
              </span>
            )}
            {premiumFilter !== 'all' && (
              <span className="admin-code-pill" style={{ fontSize: '0.72rem' }}>
                Premium: {premiumFilter}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onStatusFilterChange('all');
                onProviderFilterChange('all');
                onPremiumFilterChange('all');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.25rem',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* SECTION 3: EMPTY, ERROR OR DATA CONTAINER */}
      {error ? (
        <div className="admin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem auto' }} />
          <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Error Loading Directory</h4>
          <p className="admin-text-label" style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{error}</p>
          <button type="button" onClick={onRefresh} className="admin-btn-secondary">
            Try Again
          </button>
        </div>
      ) : loading && users.length === 0 ? (
        <div className="admin-card" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#6366f1' }} />
          <p className="admin-text-value" style={{ margin: 0, fontSize: '0.85rem' }}>
            Querying registered accounts directory...
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="admin-card" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Users size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <h4 className="admin-text-value" style={{ margin: '0 0 0.35rem 0' }}>No users found</h4>
          <p className="admin-text-label" style={{ fontSize: '0.82rem', margin: 0 }}>
            No registered user accounts match the current filters.
          </p>
        </div>
      ) : (
        <>
          {/* 3A. DESKTOP VIEW: FULL TABLE (Hidden on tablet/mobile via CSS) */}
          <div className="admin-users-table-wrap">
            <div style={{ overflowX: 'auto' }}>
              <table
                className="admin-table"
                style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}
              >
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>User Identity</th>
                  <th style={{ padding: '0.85rem 1rem' }}>User ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Provider</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Registered</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Account Status</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Premium Status</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Saved Jobs</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Last Active</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => {
                  const status = u.accountStatus || 'active';
                  const isSuspended = status === 'suspended';
                  const isDeactivated = status === 'deactivated';
                  const isDeletionRequested = status === 'deletion_requested';

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* User Avatar + Name + Email */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              flexShrink: 0,
                            }}
                          >
                            {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, maxWidth: 220 }}>
                            <div
                              className="admin-text-value"
                              style={{
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {u.name || 'Unspecified'}
                            </div>
                            <div
                              className="admin-text-label"
                              style={{
                                fontSize: '0.75rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* User ID */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <code
                          className="admin-code-pill"
                          style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                          title="Click to inspect in User 360"
                          onClick={() => onOpenUser360(u.id)}
                        >
                          {u.id.length > 14 ? `${u.id.slice(0, 14)}...` : u.id}
                        </code>
                      </td>

                      {/* Provider */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: u.provider === 'google' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(167, 139, 250, 0.12)',
                            color: u.provider === 'google' ? '#60a5fa' : '#a78bfa',
                            border: `1px solid ${u.provider === 'google' ? 'rgba(96, 165, 250, 0.25)' : 'rgba(167, 139, 250, 0.25)'}`,
                          }}
                        >
                          {u.provider || 'unknown'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                          <Calendar size={13} />
                          <span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A'}</span>
                        </div>
                      </td>

                      {/* Account Status Badge */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isSuspended ? (
                          <span
                            className="admin-badge-rejected"
                            title={u.accountStatusReason ? `Reason: ${u.accountStatusReason}` : 'Account suspended'}
                          >
                            SUSPENDED
                          </span>
                        ) : isDeactivated ? (
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: 6,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                            }}
                          >
                            DEACTIVATED
                          </span>
                        ) : isDeletionRequested ? (
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: 6,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(225, 29, 72, 0.15)',
                              color: '#f43f5e',
                              border: '1px solid rgba(225, 29, 72, 0.3)',
                            }}
                            title={`Purge scheduled: ${u.deletionScheduledFor || 'pending'}`}
                          >
                            DELETION PENDING
                          </span>
                        ) : (
                          <span className="admin-badge-approved">
                            ACTIVE
                          </span>
                        )}
                      </td>

                      {/* Premium Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {u.subscription.isPremium ? (
                          <div>
                            <span className="admin-badge-approved" style={{ fontSize: '0.7rem' }}>
                              PREMIUM ACTIVE
                            </span>
                            {u.subscription.currentPeriodEnd && (
                              <div className="admin-text-label" style={{ fontSize: '0.68rem', marginTop: 2 }}>
                                exp {new Date(u.subscription.currentPeriodEnd).toLocaleDateString('en-IN')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              padding: '0.2rem 0.45rem',
                              borderRadius: 6,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: 'rgba(148, 163, 184, 0.1)',
                              color: '#94a3b8',
                              border: '1px solid rgba(148, 163, 184, 0.2)',
                            }}
                          >
                            FREE TIER
                          </span>
                        )}
                      </td>

                      {/* Saved Jobs */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Bookmark size={13} style={{ color: '#818cf8' }} />
                          <span className="admin-text-value" style={{ fontWeight: 600 }}>
                            {u.savedJobsCount}
                          </span>
                        </div>
                      </td>

                      {/* Last Active */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>
                          {u.lastActiveAt
                            ? new Date(u.lastActiveAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Never'}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            position: 'relative',
                          }}
                        >
                          {/* View 360 */}
                          <button
                            type="button"
                            onClick={() => onOpenUser360(u.id)}
                            className="admin-action-btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            title="Open comprehensive User 360° Dossier"
                          >
                            <span>User 360°</span>
                          </button>

                          {/* Quick Actions Dropdown Toggle */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleActionMenu(u, e, index)}
                            className="admin-action-btn-secondary"
                            style={{
                              padding: '0.35rem 0.45rem',
                              fontSize: '0.75rem',
                              background: actionMenu?.user.id === u.id ? 'var(--bg-secondary, rgba(255, 255, 255, 0.1))' : undefined,
                            }}
                            title="Account actions"
                            aria-haspopup="true"
                            aria-expanded={actionMenu?.user.id === u.id}
                          >
                            <MoreVertical size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Seamlessly Integrated Connected Table Footer */}
          {total > 0 && (
            <AdminPaginationBar
              currentPage={page}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              pageSizeOptions={[10, 20, 50, 100]}
              variant="integrated"
              itemName="users"
              loading={loading}
            />
          )}
        </div>

          {/* 3B. TABLET & MOBILE VIEW: RESPONSIVE TOUCH CARDS (Hidden on desktop via CSS) */}
          <div className="admin-users-cards-wrap">
            {users.map((u) => {
              const status = u.accountStatus || 'active';
              const isSuspended = status === 'suspended';
              const isDeactivated = status === 'deactivated';
              const isDeletionRequested = status === 'deletion_requested';

              return (
                <div
                  key={u.id}
                  className="admin-card"
                  style={{
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Top: User Avatar + Name + Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '1.05rem',
                          flexShrink: 0,
                        }}
                      >
                        {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="admin-text-value"
                          style={{
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {u.name || 'Unspecified'}
                        </div>
                        <div
                          className="admin-text-label"
                          style={{
                            fontSize: '0.78rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {u.email}
                        </div>
                      </div>
                    </div>

                    {/* Account Status Badge */}
                    <div style={{ flexShrink: 0 }}>
                      {isSuspended ? (
                        <span className="admin-badge-rejected">SUSPENDED</span>
                      ) : isDeactivated ? (
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 6,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          DEACTIVATED
                        </span>
                      ) : isDeletionRequested ? (
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 6,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: 'rgba(225, 29, 72, 0.15)',
                            color: '#f43f5e',
                            border: '1px solid rgba(225, 29, 72, 0.3)',
                          }}
                        >
                          DELETION PENDING
                        </span>
                      ) : (
                        <span className="admin-badge-approved">ACTIVE</span>
                      )}
                    </div>
                  </div>

                  {/* ID + Auth Provider Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <code
                      className="admin-code-pill"
                      style={{ fontSize: '0.72rem', cursor: 'pointer' }}
                      title="Tap to inspect User 360"
                      onClick={() => onOpenUser360(u.id)}
                    >
                      ID: {u.id.length > 18 ? `${u.id.slice(0, 18)}...` : u.id}
                    </code>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: 6,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: u.provider === 'google' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(167, 139, 250, 0.12)',
                        color: u.provider === 'google' ? '#60a5fa' : '#a78bfa',
                        border: `1px solid ${u.provider === 'google' ? 'rgba(96, 165, 250, 0.25)' : 'rgba(167, 139, 250, 0.25)'}`,
                      }}
                    >
                      {u.provider || 'unknown'}
                    </span>
                  </div>

                  {/* 2-Column Details Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.65rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 10,
                      background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div>
                      <div className="admin-text-label" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={12} />
                        <span>Registered</span>
                      </div>
                      <div className="admin-text-value" style={{ fontWeight: 600, marginTop: 2 }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                      </div>
                    </div>

                    <div>
                      <div className="admin-text-label" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CreditCard size={12} />
                        <span>Subscription</span>
                      </div>
                      <div style={{ marginTop: 2 }}>
                        {u.subscription.isPremium ? (
                          <span style={{ color: '#10b981', fontWeight: 700 }}>
                            PREMIUM {u.subscription.currentPeriodEnd ? `(exp ${new Date(u.subscription.currentPeriodEnd).toLocaleDateString('en-IN')})` : ''}
                          </span>
                        ) : (
                          <span className="admin-text-label" style={{ color: '#94a3b8' }}>Free Tier</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="admin-text-label" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Bookmark size={12} />
                        <span>Saved Jobs</span>
                      </div>
                      <div className="admin-text-value" style={{ fontWeight: 700, marginTop: 2 }}>
                        {u.savedJobsCount}
                      </div>
                    </div>

                    <div>
                      <div className="admin-text-label" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} />
                        <span>Last Active</span>
                      </div>
                      <div className="admin-text-value" style={{ marginTop: 2 }}>
                        {u.lastActiveAt
                          ? new Date(u.lastActiveAt).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Never'}
                      </div>
                    </div>
                  </div>

                  {/* Suspension or Deletion Notice if applicable */}
                  {u.accountStatusReason && (
                    <div
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        fontSize: '0.72rem',
                        color: '#ef4444',
                      }}
                    >
                      <strong>Reason:</strong> {u.accountStatusReason}
                    </div>
                  )}

                  {/* Mobile Actions Button Group (Touch-first: min-height 42px) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={() => onOpenUser360(u.id)}
                      className="admin-action-btn-secondary"
                      style={{
                        padding: '0.55rem',
                        fontSize: '0.8rem',
                        minHeight: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={14} style={{ color: '#818cf8' }} />
                      <span>User 360°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMobileActionUser(u)}
                      className="admin-action-btn-secondary"
                      style={{
                        padding: '0.55rem',
                        fontSize: '0.8rem',
                        minHeight: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <SlidersHorizontal size={14} />
                      <span>Actions...</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Mobile Connected Pagination Card */}
            {total > 0 && (
              <AdminPaginationBar
                currentPage={page}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                pageSizeOptions={[10, 20, 50, 100]}
                variant="standalone"
                itemName="users"
                loading={loading}
              />
            )}
          </div>

          {/* MOBILE ACTION SHEET MODAL */}
          {mobileActionUser && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                background: 'var(--modal-backdrop, rgba(3, 7, 18, 0.75))',
                backdropFilter: 'blur(6px)',
              }}
              onClick={() => setMobileActionUser(null)}
            >
              <div
                className="admin-modal-card"
                style={{
                  width: '100%',
                  maxWidth: 520,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="admin-text-value" style={{ fontWeight: 800, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mobileActionUser.name || 'User Account Actions'}
                    </div>
                    <div className="admin-text-label" style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mobileActionUser.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileActionUser(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '0.4rem', cursor: 'pointer' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Actions List (Large tap targets >= 44px) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {/* View 360 Full Dossier */}
                  <button
                    type="button"
                    onClick={() => {
                      const uid = mobileActionUser.id;
                      setMobileActionUser(null);
                      onOpenUser360(uid);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                      background: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      color: '#818cf8',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                      textAlign: 'left',
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Open User 360° Profile & Dossier</span>
                  </button>

                  {/* Suspend or Reinstate */}
                  {mobileActionUser.accountStatus === 'suspended' || mobileActionUser.accountStatus === 'deactivated' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = {
                          id: mobileActionUser.id,
                          email: mobileActionUser.email,
                          name: mobileActionUser.name,
                          status: mobileActionUser.accountStatus,
                        };
                        setMobileActionUser(null);
                        onOpenAccountAction('reinstate', target);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 10,
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#10b981',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        minHeight: '44px',
                        textAlign: 'left',
                      }}
                    >
                      <UserCheck size={16} />
                      <span>Reinstate Account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const target = {
                          id: mobileActionUser.id,
                          email: mobileActionUser.email,
                          name: mobileActionUser.name,
                          status: mobileActionUser.accountStatus,
                        };
                        setMobileActionUser(null);
                        onOpenAccountAction('suspend', target);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 10,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        minHeight: '44px',
                        textAlign: 'left',
                      }}
                    >
                      <UserX size={16} />
                      <span>Suspend Account (Revoke Access)</span>
                    </button>
                  )}

                  {/* Force Sign-Out (All Sessions) */}
                  <button
                    type="button"
                    onClick={() => {
                      const target = {
                        id: mobileActionUser.id,
                        email: mobileActionUser.email,
                        name: mobileActionUser.name,
                      };
                      setMobileActionUser(null);
                      onOpenAccountAction('revoke_sessions', target);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                      background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                      textAlign: 'left',
                    }}
                  >
                    <LogOut size={16} style={{ color: '#818cf8' }} />
                    <span>Force Sign-Out (All Sessions)</span>
                  </button>

                  {/* Deactivate / Reactivate */}
                  {mobileActionUser.accountStatus === 'deactivated' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = {
                          id: mobileActionUser.id,
                          email: mobileActionUser.email,
                          name: mobileActionUser.name,
                        };
                        setMobileActionUser(null);
                        onOpenAccountAction('reactivate', target);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 10,
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#10b981',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        minHeight: '44px',
                        textAlign: 'left',
                      }}
                    >
                      <UserCheck size={16} />
                      <span>Reactivate Account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const target = {
                          id: mobileActionUser.id,
                          email: mobileActionUser.email,
                          name: mobileActionUser.name,
                        };
                        setMobileActionUser(null);
                        onOpenAccountAction('deactivate', target);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 10,
                        background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                        border: '1px solid var(--border)',
                        color: '#f59e0b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        minHeight: '44px',
                        textAlign: 'left',
                      }}
                    >
                      <Lock size={16} />
                      <span>Deactivate Account</span>
                    </button>
                  )}

                  {/* Export JSON */}
                  <button
                    type="button"
                    onClick={() => {
                      const uid = mobileActionUser.id;
                      setMobileActionUser(null);
                      void handleExportUser(uid, 'json');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                      background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                      textAlign: 'left',
                    }}
                  >
                    <Download size={16} />
                    <span>Export User Data (JSON)</span>
                  </button>

                  {/* Export CSV */}
                  <button
                    type="button"
                    onClick={() => {
                      const uid = mobileActionUser.id;
                      setMobileActionUser(null);
                      void handleExportUser(uid, 'csv');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                      background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                      textAlign: 'left',
                    }}
                  >
                    <FileSpreadsheet size={16} />
                    <span>Export User Data (CSV)</span>
                  </button>

                  {/* Deletion Workflow */}
                  {mobileActionUser.accountStatus === 'deletion_requested' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const target = {
                            id: mobileActionUser.id,
                            email: mobileActionUser.email,
                            name: mobileActionUser.name,
                          };
                          setMobileActionUser(null);
                          onOpenAccountAction('cancel_deletion', target);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: 10,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          color: '#10b981',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          cursor: 'pointer',
                          minHeight: '44px',
                          textAlign: 'left',
                        }}
                      >
                        <UserCheck size={16} />
                        <span>Cancel Deletion</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = {
                            id: mobileActionUser.id,
                            email: mobileActionUser.email,
                            name: mobileActionUser.name,
                          };
                          setMobileActionUser(null);
                          onOpenAccountAction('execute_deletion', target);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: 10,
                          background: '#ef4444',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          cursor: 'pointer',
                          minHeight: '44px',
                          textAlign: 'left',
                        }}
                      >
                        <Trash2 size={16} />
                        <span>Execute Permanent Purge</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const target = {
                          id: mobileActionUser.id,
                          email: mobileActionUser.email,
                          name: mobileActionUser.name,
                        };
                        setMobileActionUser(null);
                        onOpenAccountAction('request_deletion', target);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 10,
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        color: '#f43f5e',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        cursor: 'pointer',
                        minHeight: '44px',
                        textAlign: 'left',
                      }}
                    >
                      <Trash2 size={16} />
                      <span>Request Deletion Workflow</span>
                    </button>
                  )}
                </div>

                {/* Close Bottom Button */}
                <button
                  type="button"
                  onClick={() => setMobileActionUser(null)}
                  className="admin-btn-secondary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    minHeight: '44px',
                    fontSize: '0.85rem',
                    marginTop: '0.5rem',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* FLOATING DESKTOP ACTION MENU (Viewport-aware, opens top or bottom without clipping or distortion) */}
      {actionMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
            onClick={() => setActionMenu(null)}
          />
          <div
            className={`admin-dropdown-menu is-floating ${actionMenu.placement === 'top' ? 'open-up' : ''}`}
            style={{
              position: 'fixed',
              top: actionMenu.top !== undefined ? `${actionMenu.top}px` : 'auto',
              bottom: actionMenu.bottom !== undefined ? `${actionMenu.bottom}px` : 'auto',
              right: `${actionMenu.right}px`,
              maxHeight: actionMenu.maxHeight ? `${actionMenu.maxHeight}px` : 'calc(100vh - 24px)',
              overflowY: 'auto',
              zIndex: 9999,
              margin: 0,
            }}
          >
            {/* Suspend or Reinstate */}
            {actionMenu.user.accountStatus === 'suspended' || actionMenu.user.accountStatus === 'deactivated' ? (
              <button
                type="button"
                onClick={() => {
                  const targetUser = actionMenu.user;
                  setActionMenu(null);
                  onOpenAccountAction('reinstate', {
                    id: targetUser.id,
                    email: targetUser.email,
                    name: targetUser.name,
                    status: targetUser.accountStatus,
                  });
                }}
                className="admin-dropdown-item action-reinstate"
              >
                <UserCheck size={14} />
                <span>Reinstate Account</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const targetUser = actionMenu.user;
                  setActionMenu(null);
                  onOpenAccountAction('suspend', {
                    id: targetUser.id,
                    email: targetUser.email,
                    name: targetUser.name,
                    status: targetUser.accountStatus,
                  });
                }}
                className="admin-dropdown-item action-suspend"
              >
                <UserX size={14} />
                <span>Suspend Account</span>
              </button>
            )}

            {/* Force Sign-Out / Revoke Sessions */}
            <button
              type="button"
              onClick={() => {
                const targetUser = actionMenu.user;
                setActionMenu(null);
                onOpenAccountAction('revoke_sessions', {
                  id: targetUser.id,
                  email: targetUser.email,
                  name: targetUser.name,
                });
              }}
              className="admin-dropdown-item action-sessions"
            >
              <LogOut size={14} />
              <span>Force Sign-Out (All Sessions)</span>
            </button>

            {/* Deactivate / Reactivate */}
            {actionMenu.user.accountStatus === 'deactivated' ? (
              <button
                type="button"
                onClick={() => {
                  const targetUser = actionMenu.user;
                  setActionMenu(null);
                  onOpenAccountAction('reactivate', {
                    id: targetUser.id,
                    email: targetUser.email,
                    name: targetUser.name,
                  });
                }}
                className="admin-dropdown-item action-reinstate"
              >
                <UserCheck size={14} />
                <span>Reactivate Account</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const targetUser = actionMenu.user;
                  setActionMenu(null);
                  onOpenAccountAction('deactivate', {
                    id: targetUser.id,
                    email: targetUser.email,
                    name: targetUser.name,
                  });
                }}
                className="admin-dropdown-item action-deactivate"
              >
                <Lock size={14} />
                <span>Deactivate Account</span>
              </button>
            )}

            <div className="admin-dropdown-divider" />

            {/* Export JSON */}
            <button
              type="button"
              onClick={() => {
                const uid = actionMenu.user.id;
                setActionMenu(null);
                void handleExportUser(uid, 'json');
              }}
              className="admin-dropdown-item"
            >
              <Download size={14} />
              <span>Export Data (JSON)</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={() => {
                const uid = actionMenu.user.id;
                setActionMenu(null);
                void handleExportUser(uid, 'csv');
              }}
              className="admin-dropdown-item"
            >
              <FileSpreadsheet size={14} />
              <span>Export Data (CSV)</span>
            </button>

            <div className="admin-dropdown-divider" />

            {/* Deletion Workflow */}
            {actionMenu.user.accountStatus === 'deletion_requested' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const targetUser = actionMenu.user;
                    setActionMenu(null);
                    onOpenAccountAction('cancel_deletion', {
                      id: targetUser.id,
                      email: targetUser.email,
                      name: targetUser.name,
                    });
                  }}
                  className="admin-dropdown-item action-reinstate"
                >
                  <UserCheck size={14} />
                  <span>Cancel Deletion</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetUser = actionMenu.user;
                    setActionMenu(null);
                    onOpenAccountAction('execute_deletion', {
                      id: targetUser.id,
                      email: targetUser.email,
                      name: targetUser.name,
                    });
                  }}
                  className="admin-dropdown-item action-purge"
                >
                  <Trash2 size={14} />
                  <span>Execute Permanent Purge</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const targetUser = actionMenu.user;
                  setActionMenu(null);
                  onOpenAccountAction('request_deletion', {
                    id: targetUser.id,
                    email: targetUser.email,
                    name: targetUser.name,
                  });
                }}
                className="admin-dropdown-item action-delete"
              >
                <Trash2 size={14} />
                <span>Request Deletion Workflow</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
