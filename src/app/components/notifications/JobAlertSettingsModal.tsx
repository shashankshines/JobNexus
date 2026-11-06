'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Check,
  Power,
  Clock,
  Globe,
  Calendar,
  AlertCircle,
  Briefcase,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  SavedJobAlert,
  JobCategoryFilter,
} from '@/modules/notifications/domain/smart-notification.types';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const WEEKDAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
];

interface JobAlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertsUpdated?: () => void;
}

export const JobAlertSettingsModal: React.FC<JobAlertSettingsModalProps> = ({
  isOpen,
  onClose,
  onAlertsUpdated,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    userId: '',
    createdAt: '',
    updatedAt: '',
  });
  const [alerts, setAlerts] = useState<SavedJobAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Alert editor modal state
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [alertFormName, setAlertFormName] = useState('');
  const [alertFormCategory, setAlertFormCategory] = useState<JobCategoryFilter>('all');
  const [alertFormRoles, setAlertFormRoles] = useState('');
  const [alertFormKeywords, setAlertFormKeywords] = useState('');
  const [alertFormExcluded, setAlertFormExcluded] = useState('');
  const [alertFormWorkModes, setAlertFormWorkModes] = useState<string[]>([]);
  const [alertFormJobTypes, setAlertFormJobTypes] = useState<string[]>([]);
  const [alertFormLocations, setAlertFormLocations] = useState('');
  const [alertFormExp, setAlertFormExp] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prefsRes, alertsRes] = await Promise.all([
        fetch('/api/notifications/preferences'),
        fetch('/api/notifications/alerts'),
      ]);

      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        if (prefsData.preferences) {
          setPreferences(prefsData.preferences);
        }
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        if (Array.isArray(alertsData.alerts)) {
          setAlerts(alertsData.alerts);
        }
      }
    } catch (err) {
      console.warn('[JobAlertSettingsModal] Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleUpdatePreference = async (updates: Partial<NotificationPreferences>) => {
    setIsSavingPrefs(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPreferences(data.preferences);
          setStatusMessage('Preferences updated successfully.');
          setTimeout(() => setStatusMessage(null), 3000);
        }
      }
    } catch {
      setStatusMessage('Failed to update preferences.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleToggleDay = (dayId: number) => {
    let newDays = [...preferences.activeDays];
    if (newDays.includes(dayId)) {
      if (newDays.length === 1) return; // Keep at least one active day
      newDays = newDays.filter((d) => d !== dayId);
    } else {
      newDays = [...newDays, dayId].sort();
    }
    handleUpdatePreference({ activeDays: newDays });
  };

  const openCreateAlert = () => {
    setEditingAlertId(null);
    setAlertFormName('My Job Alert');
    setAlertFormCategory('all');
    setAlertFormRoles('');
    setAlertFormKeywords('');
    setAlertFormExcluded('');
    setAlertFormWorkModes(['remote']);
    setAlertFormJobTypes(['full-time']);
    setAlertFormLocations('');
    setAlertFormExp([]);
    setIsEditingAlert(true);
  };

  const openEditAlert = (alert: SavedJobAlert) => {
    setEditingAlertId(alert.alertId);
    setAlertFormName(alert.alertName);
    setAlertFormCategory(alert.jobCategories || 'all');
    setAlertFormRoles((alert.roles || []).join(', '));
    setAlertFormKeywords((alert.keywords || []).join(', '));
    setAlertFormExcluded((alert.excludedKeywords || []).join(', '));
    setAlertFormWorkModes(alert.workModes || []);
    setAlertFormJobTypes(alert.jobTypes || []);
    setAlertFormLocations((alert.locations || []).join(', '));
    setAlertFormExp(alert.experienceRange || []);
    setIsEditingAlert(true);
  };

  const handleSaveAlert = async () => {
    const parseComma = (s: string) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

    const payload = {
      alertName: alertFormName.trim() || 'Custom Job Alert',
      jobCategories: alertFormCategory,
      roles: parseComma(alertFormRoles),
      keywords: parseComma(alertFormKeywords),
      excludedKeywords: parseComma(alertFormExcluded),
      workModes: alertFormWorkModes,
      jobTypes: alertFormJobTypes,
      locations: parseComma(alertFormLocations),
      experienceRange: alertFormExp,
      enabled: true,
    };

    try {
      if (editingAlertId) {
        const res = await fetch(`/api/notifications/alerts/${editingAlertId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setAlerts((prev) => prev.map((a) => (a.alertId === editingAlertId ? data.alert : a)));
        }
      } else {
        const res = await fetch('/api/notifications/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setAlerts((prev) => [data.alert, ...prev]);
        }
      }

      setIsEditingAlert(false);
      onAlertsUpdated?.();
    } catch (err) {
      console.warn('[JobAlertSettingsModal] Save alert error:', err);
    }
  };

  const handleToggleAlertActive = async (alert: SavedJobAlert) => {
    const newEnabled = !alert.enabled;
    setAlerts((prev) =>
      prev.map((a) => (a.alertId === alert.alertId ? { ...a, enabled: newEnabled } : a))
    );
    try {
      await fetch(`/api/notifications/alerts/${alert.alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      onAlertsUpdated?.();
    } catch {
      // Revert on failure
      setAlerts((prev) =>
        prev.map((a) => (a.alertId === alert.alertId ? { ...a, enabled: !newEnabled } : a))
      );
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
    try {
      await fetch(`/api/notifications/alerts/${alertId}`, {
        method: 'DELETE',
      });
      onAlertsUpdated?.();
    } catch {
      loadData();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Job Notification Settings"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isEditingAlert) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-elevated, #0f172a)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={18} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Job Notification Settings
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Configure smart matching rules, delivery windows and quiet hours
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {statusMessage && (
            <div
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Check size={14} />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Section A: Master Switch */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '12px',
              background: preferences.enabled ? 'rgba(56, 189, 248, 0.04)' : 'rgba(255, 255, 255, 0.02)',
              border: preferences.enabled
                ? '1px solid rgba(56, 189, 248, 0.25)'
                : '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Power size={16} color={preferences.enabled ? '#38bdf8' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  Master Job Notifications
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: preferences.enabled ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                    color: preferences.enabled ? '#34d399' : '#f87171',
                  }}
                >
                  {preferences.enabled ? 'ACTIVE' : 'MUTED'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {preferences.enabled
                  ? 'Active matching is enabled. Genuinely new jobs will be delivered within your configured schedule.'
                  : 'Notifications suppressed. Pending queue is cancelled. Turning ON resumes matching without historical backlog.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleUpdatePreference({ enabled: !preferences.enabled })}
              disabled={isSavingPrefs}
              style={{
                width: '48px',
                height: '26px',
                borderRadius: '999px',
                background: preferences.enabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
              aria-label="Toggle master notifications"
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: preferences.enabled ? '25px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>

          {/* Section B: Delivery Schedule & Timezone */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              padding: '1rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Clock size={16} color="#38bdf8" />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Delivery Schedule & Quiet Hours
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {/* Delivery Window */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Delivery Window
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="time"
                    value={preferences.startTime}
                    onChange={(e) => handleUpdatePreference({ startTime: e.target.value })}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      padding: '5px 8px',
                      fontSize: '0.82rem',
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>to</span>
                  <input
                    type="time"
                    value={preferences.endTime}
                    onChange={(e) => handleUpdatePreference({ endTime: e.target.value })}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      padding: '5px 8px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              {/* Timezone Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Timezone (IANA)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Globe size={14} color="var(--text-secondary)" />
                  <select
                    value={preferences.timezone}
                    onChange={(e) => handleUpdatePreference({ timezone: e.target.value })}
                    style={{
                      flex: 1,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      padding: '6px 8px',
                      fontSize: '0.82rem',
                    }}
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active Days */}
            <div style={{ marginTop: '0.35rem' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Active Delivery Days (Sunday disabled by default)
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {WEEKDAYS.map((day) => {
                  const isActive = preferences.activeDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => handleToggleDay(day.id)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                        border: isActive ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border)',
                        color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section C: Multiple Saved Job Alerts */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Layers size={16} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Saved Job Alerts ({alerts.length})
                </h4>
              </div>

              <button
                type="button"
                onClick={openCreateAlert}
                style={{
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>New Alert</span>
              </button>
            </div>

            {alerts.length === 0 ? (
              <div
                style={{
                  padding: '2rem 1rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border)',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Sparkles size={20} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>No alerts configured</span>
                <span style={{ fontSize: '0.76rem', maxWidth: '300px' }}>
                  Create alerts for specific job titles, workplace preferences, or industries to receive timely updates.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {alerts.map((alert) => (
                  <div
                    key={alert.alertId}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      background: alert.enabled ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      opacity: alert.enabled ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {alert.alertName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background:
                              alert.jobCategories === 'it'
                                ? 'rgba(56, 189, 248, 0.15)'
                                : alert.jobCategories === 'non_it'
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : 'rgba(255, 255, 255, 0.08)',
                            color:
                              alert.jobCategories === 'it'
                                ? '#38bdf8'
                                : alert.jobCategories === 'non_it'
                                  ? '#c084fc'
                                  : 'var(--text-secondary)',
                          }}
                        >
                          {alert.jobCategories === 'it'
                            ? 'IT & Tech'
                            : alert.jobCategories === 'non_it'
                              ? 'Non-IT & Core'
                              : 'All Sectors'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleAlertActive(alert)}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: alert.enabled ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: alert.enabled ? '#34d399' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          {alert.enabled ? 'Enabled' : 'Paused'}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditAlert(alert)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Edit alert"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAlert(alert.alertId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Delete alert"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Criteria Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.72rem' }}>
                      {alert.roles && alert.roles.length > 0 && (
                        <span style={{ color: '#38bdf8' }}>Roles: {alert.roles.join(', ')}</span>
                      )}
                      {alert.keywords && alert.keywords.length > 0 && (
                        <span style={{ color: '#818cf8' }}>• Keywords: {alert.keywords.join(', ')}</span>
                      )}
                      {alert.workModes && alert.workModes.length > 0 && (
                        <span style={{ color: '#34d399' }}>• Modes: {alert.workModes.join(', ')}</span>
                      )}
                      {alert.locations && alert.locations.length > 0 && (
                        <span style={{ color: '#fbbf24' }}>• Locations: {alert.locations.join(', ')}</span>
                      )}
                      {alert.excludedKeywords && alert.excludedKeywords.length > 0 && (
                        <span style={{ color: '#f87171' }}>• Excluded: {alert.excludedKeywords.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Nested Alert Editor Sub-Modal */}
      {isEditingAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            padding: '1rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--surface-elevated, #0f172a)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingAlertId ? 'Edit Job Alert' : 'Create Job Alert'}
              </h4>
              <button
                type="button"
                onClick={() => setIsEditingAlert(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '65vh', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Alert Name
                </label>
                <input
                  type="text"
                  value={alertFormName}
                  onChange={(e) => setAlertFormName(e.target.value)}
                  placeholder="e.g. Remote Product Manager"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Sector Classification
                </label>
                <select
                  value={alertFormCategory}
                  onChange={(e) => setAlertFormCategory(e.target.value as JobCategoryFilter)}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="all">All Sectors (IT & Non-IT)</option>
                  <option value="it">IT, Tech & Software Only</option>
                  <option value="non_it">Non-IT & Core Industries Only</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Roles / Titles (comma-separated)
                </label>
                <input
                  type="text"
                  value={alertFormRoles}
                  onChange={(e) => setAlertFormRoles(e.target.value)}
                  placeholder="e.g. Frontend Engineer, React Developer"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Include Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={alertFormKeywords}
                  onChange={(e) => setAlertFormKeywords(e.target.value)}
                  placeholder="e.g. TypeScript, Next.js, GraphQL"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Excluded Keywords (boundary-matched, negative filter)
                </label>
                <input
                  type="text"
                  value={alertFormExcluded}
                  onChange={(e) => setAlertFormExcluded(e.target.value)}
                  placeholder="e.g. Junior, Intern, Unpaid"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Workplace Modes
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['remote', 'hybrid', 'onsite'].map((mode) => {
                    const isChecked = alertFormWorkModes.includes(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setAlertFormWorkModes((prev) =>
                            isChecked ? prev.filter((m) => m !== mode) : [...prev, mode]
                          );
                        }}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                          border: isChecked ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border)',
                          color: isChecked ? '#38bdf8' : 'var(--text-secondary)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Preferred Locations (comma-separated)
                </label>
                <input
                  type="text"
                  value={alertFormLocations}
                  onChange={(e) => setAlertFormLocations(e.target.value)}
                  placeholder="e.g. India, Bengaluru, Remote"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '7px 10px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsEditingAlert(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAlert}
                style={{
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
