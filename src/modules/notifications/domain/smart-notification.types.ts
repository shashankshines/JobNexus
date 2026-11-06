/**
 * JobNexus — Smart Job Notification & Scheduling Domain Types
 */

export type NotificationMode = 'instant' | 'scheduled' | 'digest';

export type JobCategoryFilter = 'all' | 'it' | 'non_it';

export type NotificationReadStatus = 'UNREAD' | 'READ' | 'DISMISSED';

export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'DELIVERED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface NotificationPreferences {
  userId: string;
  enabled: boolean;
  mode: NotificationMode;
  timezone: string; // IANA identifier e.g. 'Asia/Kolkata'
  startTime: string; // HH:mm e.g. '09:00'
  endTime: string; // HH:mm e.g. '21:00'
  activeDays: number[]; // 1 = Monday, 7 = Sunday. Default: [1,2,3,4,5,6] (Sun disabled)
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  mode: 'instant',
  timezone: 'Asia/Kolkata',
  startTime: '00:00',
  endTime: '23:59',
  activeDays: [1, 2, 3, 4, 5, 6, 7], // 24 hours x 7 days x 365 days active (all days, unrestricted)
};

export interface SavedJobAlert {
  alertId: string;
  userId: string;
  alertName: string;
  enabled: boolean;
  jobCategories?: JobCategoryFilter; // 'all' | 'it' | 'non_it'
  roles?: string[]; // e.g. ['Frontend Developer', 'UI/UX Designer']
  keywords?: string[]; // e.g. ['React', 'Next.js']
  excludedKeywords?: string[]; // e.g. ['Junior', 'Intern', 'PHP']
  jobTypes?: string[]; // ['full-time', 'part-time', 'contract', 'freelance', 'internship']
  workModes?: string[]; // ['remote', 'hybrid', 'onsite']
  locations?: string[]; // ['India', 'Bengaluru', 'Remote']
  experienceRange?: string[]; // ['entry', 'mid', 'senior', 'lead']
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  companyPreferences?: string[]; // preferred companies
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface SmartJobNotification {
  notificationId: string;
  userId: string;
  canonicalJobId: string;
  jobTitle: string;
  jobCompany: string;
  jobLocation: string;
  jobWorkplaceType?: string;
  jobEmploymentType?: string;
  jobUrl: string;
  jobIndustry?: string;
  matchingAlertIds: string[];
  matchingAlertNames: string[];
  notificationType: 'new_job_match';
  readStatus: NotificationReadStatus;
  deliveryStatus: NotificationDeliveryStatus;
  scheduledAt: string; // ISO
  deliveredAt?: string | null; // ISO
  createdAt: string; // ISO
  dedupeKey: string; // `${userId}__${canonicalJobId}`
  leaseExpiresAt?: string | null; // For atomic claims
  failureReason?: string | null;
}

export interface SmartNotificationInboxSummary {
  notifications: SmartJobNotification[];
  unreadCount: number;
  totalCount: number;
  hasMore: boolean;
}
