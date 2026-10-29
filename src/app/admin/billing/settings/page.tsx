'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CreditCard,
  Receipt,
  Users,
  Settings,
  History,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { PaymentSettingsView } from '@/app/components/admin/PaymentSettingsView';

export default function AdminPaymentSettingsPage() {
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="admin-shell">
      {/* Top Header (Fixed, non-scrolling, unified admin shell) */}
      <header className="admin-header">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 1.5rem',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/admin"
              className="site-header-btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--primary-start, #818cf8)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
              title="Return to Admin Overview"
            >
              <ArrowLeft size={14} />
              <span>Back to Console</span>
            </Link>

            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <h1 className="admin-header-title">JobNexus Admin Console</h1>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: 'var(--primary-start, #a5b4fc)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Phase 2B.3D
                </span>
              </div>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                Authoritative Receiving UPI Configuration & Settings Control
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Back to Job Search
            </Link>
            <button
              onClick={handleRefresh}
              aria-label="Refresh settings data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--primary-start, #c7d2fe)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Fixed Header Spacer */}
      <div style={{ height: 72 }} aria-hidden="true" />

      {/* Main Container */}
      <main className="admin-main-container">
        {/* Unified Tab Navigation Rail (Non-wrapping Segmented Rail) */}
        <div className="admin-tab-nav-wrapper">
          <nav className="admin-tab-nav" aria-label="Admin Console Navigation">
            {[
              { id: 'overview', label: 'Overview', fullTitle: 'Overview & Metrics', icon: ShieldCheck, href: '/admin?tab=overview' },
              { id: 'verifications', label: 'Verification Queue', fullTitle: 'Payment Verification Queue', icon: CreditCard, href: '/admin?tab=verifications' },
              { id: 'ledger', label: 'Payment Ledger', fullTitle: 'Consolidated Payment Ledger', icon: Receipt, href: '/admin?tab=ledger' },
              { id: 'subscriptions', label: 'Subscribers', fullTitle: 'Subscribers & Entitlements', icon: Users, href: '/admin?tab=subscriptions' },
              { id: 'settings_preview', label: 'Payment Settings', fullTitle: 'Manage UPI Payment Settings', icon: Settings, href: '/admin/billing/settings', isActive: true },
              { id: 'audit_logs', label: 'Audit Trail', fullTitle: 'Authoritative Audit Trail', icon: History, href: '/admin?tab=audit_logs' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.isActive;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`admin-tab-btn ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  title={tab.fullTitle}
                  aria-label={tab.fullTitle}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Embedded Authoritative Settings View */}
        <PaymentSettingsView key={refreshKey} onRefreshParent={handleRefresh} />
      </main>
    </div>
  );
}
