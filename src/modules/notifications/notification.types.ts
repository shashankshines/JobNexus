export const ADMIN_NOTIFICATION_EMAIL = 'shashankshines@gmail.com';
export const ADMIN_NOTIFICATIONS_COLLECTION = 'admin_notifications';
export const ADMIN_NOTIFICATION_FAILURES_COLLECTION = 'admin_notification_failures';

export type AdminNotificationType =
  | 'premium_order_created'
  | 'payment_submitted'
  | 'duplicate_utr_detected'
  | 'payment_verification_pending'
  | 'payment_approved'
  | 'payment_rejected'
  | 'subscription_cancel_requested'
  | 'subscription_expiring'
  | 'subscription_suspended'
  | 'subscription_reinstated'
  | 'subscription_terminated'
  | 'subscription_revoked'
  | 'account_suspended'
  | 'account_reinstated';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type NotificationStatus = 'unread' | 'read' | 'acknowledged' | 'resolved';

export interface AdminNotificationDocument {
  id: string;
  eventId?: string;
  eventKey?: string;
  recipientEmail: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  actionLabel: string;
  actionUrl: string;
  actionType?: string;
  userId: string;
  userEmail?: string;
  actorUserId?: string;
  actorEmail?: string;
  targetUserId?: string;
  targetEmail?: string;
  orderId?: string;
  submissionId?: string;
  subscriptionId?: string;
  auditLogId?: string;
  createdAt: string;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AdminNotificationFailureRecord {
  id: string;
  eventKey: string;
  input: Record<string, unknown>;
  attempts: number;
  lastAttemptAt: string;
  lastError: string;
  status: 'pending_recovery' | 'exhausted' | 'recovered';
  createdAt: string;
  recoveredAt?: string | null;
}

export interface AdminNotificationPreferences {
  voiceEnabled: boolean;
  voiceVerbosity: 'brief' | 'detailed';
  soundEnabled: boolean;
  quietMode: boolean;
  priorityOnly: boolean;
  volume: number;
  updatedAt?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: AdminNotificationPreferences = {
  voiceEnabled: false,
  voiceVerbosity: 'brief',
  soundEnabled: true,
  quietMode: false,
  priorityOnly: false,
  volume: 0.8,
};

export const ALLOWED_ADMIN_ACTION_PREFIXES = [
  '/admin?tab=verifications',
  '/admin?tab=subscriptions',
  '/admin?tab=users',
  '/admin?tab=ledger',
  '/admin?tab=overview',
  '/admin?tab=audit_logs',
  '/admin?tab=settings_preview',
  '/admin',
] as const;

export function isValidAdminActionUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Strictly disallow absolute protocols, data/javascript URI schemes, or external redirects
  if (trimmed.startsWith('//') || trimmed.includes('://') || trimmed.toLowerCase().startsWith('javascript:')) {
    return false;
  }
  // Must match an allowed admin route prefix
  return ALLOWED_ADMIN_ACTION_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}&`) || trimmed.startsWith(`${prefix}?`)
  );
}

export function serializeCompoundCursor(createdAt: string, id: string): string {
  return `${createdAt}__${id}`;
}

export function parseCompoundCursor(cursor: string | null | undefined): { createdAt: string; id: string } | null {
  if (!cursor || typeof cursor !== 'string') return null;
  const parts = cursor.split('__');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { createdAt: parts[0], id: parts.slice(1).join('__') };
  }
  return null;
}
