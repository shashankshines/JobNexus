export const ADMIN_NOTIFICATION_EMAIL = 'shashankshines@gmail.com';
export const ADMIN_NOTIFICATIONS_COLLECTION = 'admin_notifications';

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
