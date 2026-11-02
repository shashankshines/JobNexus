'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ExternalLink, RefreshCw } from 'lucide-react';

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
  userEmail?: string;
  createdAt: string;
  readAt?: string;
  actionedAt?: string;
};

export function AdminNotificationCenter() {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/notifications?limit=50', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load notifications.');
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: string) => {
    setBusyId(id);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'read' }),
      });
      if (!response.ok) throw new Error('Unable to update notification.');
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update notification.');
    } finally {
      setBusyId('');
    }
  };

  const openAction = async (item: AdminNotification) => {
    setBusyId(item.id);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'actioned' }),
      });
      if (!response.ok) throw new Error('Unable to record notification action.');
      setItems((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, readAt: entry.readAt || new Date().toISOString(), actionedAt: new Date().toISOString() }
        : entry));
      router.push(item.actionUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open notification action.');
    } finally {
      setBusyId('');
    }
  };

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <section aria-labelledby="admin-notifications-title" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 16, padding: '1.1rem', background: 'var(--card-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={19} />
          <div>
            <h2 id="admin-notifications-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Admin Notifications</h2>
            <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: '.78rem' }}>Subscription activity sent to shashankshines@gmail.com · {unreadCount} unread</p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh notifications" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-color)', borderRadius: 9, padding: '8px 11px', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger, #dc2626)', fontSize: '.85rem' }}>{error}</p>}
      {loading ? <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Loading notifications…</p> :
        items.length === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: 0 }}>No subscription activity notifications yet.</p> :
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {items.map((item) => (
            <article key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 12, background: item.readAt ? 'transparent' : 'var(--surface-subtle, rgba(59,130,246,.06))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '.9rem' }}>{item.title}</strong>
                    {!item.readAt && <span style={{ fontSize: '.68rem', borderRadius: 99, padding: '2px 7px', background: 'var(--accent-soft, rgba(59,130,246,.12))' }}>NEW</span>}
                  </div>
                  <p style={{ margin: '5px 0', color: 'var(--text-secondary)', fontSize: '.82rem' }}>{item.message}</p>
                  {item.userEmail && <p style={{ margin: 0, fontSize: '.75rem', color: 'var(--text-secondary)' }}>User: {item.userEmail}</p>}
                  <time dateTime={item.createdAt} style={{ display: 'block', marginTop: 5, fontSize: '.7rem', color: 'var(--text-tertiary, var(--text-secondary))' }}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" disabled={busyId === item.id} onClick={() => void openAction(item)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '8px 10px', background: 'var(--accent)', color: '#fff', border: 0, fontSize: '.78rem', fontWeight: 650, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {item.actionLabel} <ExternalLink size={13} />
                  </button>
                  {!item.readAt && <button type="button" disabled={busyId === item.id} onClick={() => void markRead(item.id)} aria-label="Mark notification as read" style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}><Check size={14} /></button>}
                </div>
              </div>
            </article>
          ))}
        </div>}
    </section>
  );
}
