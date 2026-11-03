'use client';

import React, { useState } from 'react';
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
  const [activeActionMenuUserId, setActiveActionMenuUserId] = useState<string | null>(null);

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '1rem',
        }}
      >
        {/* Total Users */}
        <div
          className="admin-card"
          style={{
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            borderLeft: '4px solid #6366f1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Registered
            </span>
            <Users size={16} style={{ color: '#818cf8' }} />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary?.totalUsers ?? total}
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
            Across all auth providers
          </span>
        </div>

        {/* Active Accounts */}
        <div
          className="admin-card"
          style={{
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            borderLeft: '4px solid #10b981',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Active Accounts
            </span>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981' }}>
            {summary?.activeUsers ?? 0}
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
            Unrestricted login access
          </span>
        </div>

        {/* Suspended & Restricted */}
        <div
          className="admin-card"
          style={{
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            borderLeft: '4px solid #ef4444',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Suspended Accounts
            </span>
            <UserX size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ef4444' }}>
            {summary?.suspendedUsers ?? 0}
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
            {(summary?.deactivatedUsers ?? 0) > 0 ? `+ ${summary?.deactivatedUsers} deactivated` : 'Login blocked server-side'}
          </span>
        </div>

        {/* Authentication Split */}
        <div
          className="admin-card"
          style={{
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            borderLeft: '4px solid #f59e0b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Auth Methods
            </span>
            <Shield size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>
              {summary?.googleUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Google</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a78bfa' }}>
              {summary?.credentialsUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Password</span>
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
            Verified Google vs Local
          </span>
        </div>

        {/* Premium vs Free */}
        <div
          className="admin-card"
          style={{
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            borderLeft: '4px solid #a855f7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-text-label" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              Subscription Tier
            </span>
            <CreditCard size={16} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
              {summary?.premiumUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Premium</span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              {summary?.freeUsers ?? 0}
            </span>
            <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Free</span>
          </div>
          <span className="admin-text-label" style={{ fontSize: '0.72rem' }}>
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
              maxWidth: 420,
            }}
          >
            <Search
              size={15}
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
                padding: '0.55rem 0.85rem 0.55rem 2.35rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                fontSize: '0.8rem',
                cursor: 'pointer',
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
                fontSize: '0.8rem',
                cursor: 'pointer',
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
                fontSize: '0.8rem',
                cursor: 'pointer',
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
                fontSize: '0.8rem',
                cursor: 'pointer',
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
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem' }}
              title="Refresh Directory"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
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
                fontSize: '0.72rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0 0.25rem',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* SECTION 3: USERS DATA TABLE */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem auto' }} />
            <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Error Loading Directory</h4>
            <p className="admin-text-label" style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{error}</p>
            <button type="button" onClick={onRefresh} className="admin-btn-secondary">
              Try Again
            </button>
          </div>
        ) : loading && users.length === 0 ? (
          <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#6366f1' }} />
            <p className="admin-text-value" style={{ margin: 0, fontSize: '0.85rem' }}>
              Querying registered accounts directory...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Users size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
            <h4 className="admin-text-value" style={{ margin: '0 0 0.35rem 0' }}>No users found</h4>
            <p className="admin-text-label" style={{ fontSize: '0.82rem', margin: 0 }}>
              No registered user accounts match the current filters.
            </p>
          </div>
        ) : (
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
                {users.map((u) => {
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
                            onClick={() =>
                              setActiveActionMenuUserId(
                                activeActionMenuUserId === u.id ? null : u.id
                              )
                            }
                            className="admin-action-btn-secondary"
                            style={{ padding: '0.35rem 0.45rem', fontSize: '0.75rem' }}
                            title="Account actions"
                          >
                            <MoreVertical size={13} />
                          </button>

                          {/* Dropdown Menu */}
                          {activeActionMenuUserId === u.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: 4,
                                width: 220,
                                borderRadius: 10,
                                background: 'var(--bg-secondary, #0f172a)',
                                border: '1px solid var(--border)',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                zIndex: 100,
                                padding: '0.35rem 0',
                                textAlign: 'left',
                              }}
                            >
                              {/* Suspend or Reinstate */}
                              {isSuspended || isDeactivated ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuUserId(null);
                                    onOpenAccountAction('reinstate', {
                                      id: u.id,
                                      email: u.email,
                                      name: u.name,
                                      status: u.accountStatus,
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#10b981',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <UserCheck size={14} />
                                  <span>Reinstate Account</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuUserId(null);
                                    onOpenAccountAction('suspend', {
                                      id: u.id,
                                      email: u.email,
                                      name: u.name,
                                      status: u.accountStatus,
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <UserX size={14} />
                                  <span>Suspend Account</span>
                                </button>
                              )}

                              {/* Force Sign-Out / Revoke Sessions */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuUserId(null);
                                  onOpenAccountAction('revoke_sessions', {
                                    id: u.id,
                                    email: u.email,
                                    name: u.name,
                                  });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  color: '#818cf8',
                                  fontSize: '0.76rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <LogOut size={14} />
                                <span>Force Sign-Out (All Sessions)</span>
                              </button>

                              {/* Deactivate / Reactivate */}
                              {isDeactivated ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuUserId(null);
                                    onOpenAccountAction('reactivate', {
                                      id: u.id,
                                      email: u.email,
                                      name: u.name,
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#10b981',
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <UserCheck size={14} />
                                  <span>Reactivate Account</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuUserId(null);
                                    onOpenAccountAction('deactivate', {
                                      id: u.id,
                                      email: u.email,
                                      name: u.name,
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#f59e0b',
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Lock size={14} />
                                  <span>Deactivate Account</span>
                                </button>
                              )}

                              <div style={{ height: 1, background: 'var(--border)', margin: '0.35rem 0' }} />

                              {/* Export JSON */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuUserId(null);
                                  void handleExportUser(u.id, 'json');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.76rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <Download size={14} />
                                <span>Export Data (JSON)</span>
                              </button>

                              {/* Export CSV */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuUserId(null);
                                  void handleExportUser(u.id, 'csv');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.76rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <FileSpreadsheet size={14} />
                                <span>Export Data (CSV)</span>
                              </button>

                              <div style={{ height: 1, background: 'var(--border)', margin: '0.35rem 0' }} />

                              {/* Deletion Workflow */}
                              {isDeletionRequested ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuUserId(null);
                                      onOpenAccountAction('cancel_deletion', {
                                        id: u.id,
                                        email: u.email,
                                        name: u.name,
                                      });
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem 0.85rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      background: 'none',
                                      border: 'none',
                                      color: '#10b981',
                                      fontSize: '0.76rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <UserCheck size={14} />
                                    <span>Cancel Deletion</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuUserId(null);
                                      onOpenAccountAction('execute_deletion', {
                                        id: u.id,
                                        email: u.email,
                                        name: u.name,
                                      });
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem 0.85rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      fontSize: '0.76rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    <span>Execute Permanent Purge</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuUserId(null);
                                    onOpenAccountAction('request_deletion', {
                                      id: u.id,
                                      email: u.email,
                                      name: u.name,
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem 0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#f43f5e',
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Trash2 size={14} />
                                  <span>Request Deletion Workflow</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION 4: SERVER PAGINATION BAR */}
        {total > 0 && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="admin-text-label" style={{ fontSize: '0.75rem' }}>Page size:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <AdminPaginationBar
              currentPage={page}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={onPageChange}
              itemName="users"
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
