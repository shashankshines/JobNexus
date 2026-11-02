import { PREMIUM_PLAN, type SubscriptionRecord } from './subscription.types';

/**
 * JobNexus 30-Day Subscription Expiration & Renewal Window Engine
 *
 * Pure deterministic evaluator covering the full 30-day Manual UPI subscription
 * lifecycle, pre-expiry reminder windows (5-day & 24-hour), post-expiry state,
 * pending-verification suppression, user cancellation grace, and administrative
 * enforcement exclusions (suspended, terminated, permanently revoked).
 */

export const SUBSCRIPTION_CYCLE_DAYS = 30;
export const RENEWAL_REMINDER_WINDOW_DAYS = 5;
export const URGENT_RENEWAL_WINDOW_HOURS = 24;
export const POST_EXPIRY_EMAIL_WINDOW_DAYS = 30;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const RENEWAL_REMINDER_WINDOW_MS = RENEWAL_REMINDER_WINDOW_DAYS * DAY_MS;
export const URGENT_RENEWAL_WINDOW_MS = URGENT_RENEWAL_WINDOW_HOURS * HOUR_MS;
export const POST_EXPIRY_EMAIL_WINDOW_MS = POST_EXPIRY_EMAIL_WINDOW_DAYS * DAY_MS;

export type RenewalStage =
  | 'none'
  | 'active_healthy'
  | 'cancelled_grace'
  | 'expiring_soon'
  | 'expiring_urgent'
  | 'expired';

export type RenewalEmailMilestone =
  | 'expiring_5d'
  | 'expiring_24h'
  | 'expired';

export interface RenewalWindowSnapshot {
  stage: RenewalStage;
  isWithinRenewalWindow: boolean;
  canRenewNow: boolean;
  shouldShowInAppBanner: boolean;
  isAdminRestricted: boolean;
  hasPendingRenewalVerification: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  currentPeriodEnd: string | null;
  emailMilestone: RenewalEmailMilestone | null;
  emailIdempotencyKey: string | null;
  emailAlreadyDispatched?: boolean;
  headline: string;
  message: string;
}

export function isAdministrativelyRestrictedSubscription(
  sub: SubscriptionRecord | null | undefined
): boolean {
  if (!sub) return false;
  if (sub.status === 'halted' || sub.status === 'terminated') {
    return true;
  }
  if (sub.status === 'cancelled' && sub.metadata?.revoked === true) {
    return true;
  }
  return false;
}

export function buildRenewalEmailIdempotencyKey(params: {
  milestone: RenewalEmailMilestone;
  userId: string;
  currentPeriodEnd: string;
}): string {
  const normalizedPeriodEnd = new Date(params.currentPeriodEnd).toISOString();
  if (params.milestone === 'expiring_5d') {
    return `subscription_expiring_soon:5d:${params.userId}:${normalizedPeriodEnd}`;
  }
  if (params.milestone === 'expiring_24h') {
    return `subscription_expiring_soon:24h:${params.userId}:${normalizedPeriodEnd}`;
  }
  return `subscription_expired:${params.userId}:${normalizedPeriodEnd}`;
}

export function evaluateRenewalWindow(params: {
  subscription: SubscriptionRecord | null | undefined;
  hasPendingVerification?: boolean;
  nowMs?: number;
}): RenewalWindowSnapshot {
  const { subscription } = params;
  const hasPendingRenewalVerification = Boolean(params.hasPendingVerification);
  const nowMs = typeof params.nowMs === 'number' ? params.nowMs : Date.now();

  const emptySnapshot: RenewalWindowSnapshot = {
    stage: 'none',
    isWithinRenewalWindow: false,
    canRenewNow: false,
    shouldShowInAppBanner: false,
    isAdminRestricted: false,
    hasPendingRenewalVerification,
    daysRemaining: 0,
    hoursRemaining: 0,
    currentPeriodEnd: null,
    emailMilestone: null,
    emailIdempotencyKey: null,
    headline: '',
    message: '',
  };

  if (!subscription || !subscription.userId) {
    return emptySnapshot;
  }

  // Unverified checkout/initial states are never part of the 30-day renewal lifecycle
  if (
    subscription.status === 'created' ||
    subscription.status === 'pending' ||
    subscription.status === 'authenticated'
  ) {
    return emptySnapshot;
  }

  // Edge Case: Administratively suspended, terminated, or permanently revoked accounts
  // must NEVER receive renewal reminders or self-serve renewal prompts.
  if (isAdministrativelyRestrictedSubscription(subscription)) {
    return {
      ...emptySnapshot,
      isAdminRestricted: true,
      currentPeriodEnd: subscription.currentPeriodEnd || null,
    };
  }

  if (!subscription.currentPeriodEnd) {
    return emptySnapshot;
  }

  const periodEndMs = new Date(subscription.currentPeriodEnd).getTime();
  if (Number.isNaN(periodEndMs)) {
    return emptySnapshot;
  }

  const normalizedPeriodEnd = new Date(periodEndMs).toISOString();
  const formattedEndDate = new Date(periodEndMs).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const remainingMs = periodEndMs - nowMs;

  // 1. Expired 30-day period (remainingMs <= 0)
  if (remainingMs <= 0) {
    const expiredAgoMs = Math.abs(remainingMs);
    const eligibleForExpiredEmail =
      !hasPendingRenewalVerification &&
      expiredAgoMs <= POST_EXPIRY_EMAIL_WINDOW_MS;

    const emailMilestone: RenewalEmailMilestone | null = eligibleForExpiredEmail
      ? 'expired'
      : null;

    return {
      stage: 'expired',
      isWithinRenewalWindow: true,
      canRenewNow: !hasPendingRenewalVerification,
      shouldShowInAppBanner: true,
      isAdminRestricted: false,
      hasPendingRenewalVerification,
      daysRemaining: 0,
      hoursRemaining: 0,
      currentPeriodEnd: normalizedPeriodEnd,
      emailMilestone,
      emailIdempotencyKey: emailMilestone
        ? buildRenewalEmailIdempotencyKey({
            milestone: emailMilestone,
            userId: subscription.userId,
            currentPeriodEnd: normalizedPeriodEnd,
          })
        : null,
      headline: hasPendingRenewalVerification
        ? 'Renewal Payment Under Verification'
        : 'Your 30-Day JobNexus Premium Access Has Ended',
      message: hasPendingRenewalVerification
        ? 'Your previous 30-day cycle ended, and your submitted UPI renewal reference is currently awaiting administrator verification.'
        : `Your Premium period ended on ${formattedEndDate}. Renew for ₹${PREMIUM_PLAN.priceInr} (regularly ₹${PREMIUM_PLAN.originalPriceInr}) to unlock direct employer ATS links and company identities again — your saved jobs are safe.`,
    };
  }

  const daysRemaining = Math.max(1, Math.ceil(remainingMs / DAY_MS));
  const hoursRemaining = Math.max(1, Math.ceil(remainingMs / HOUR_MS));

  // 2. Final 24-Hour Urgent Expiration Window (0 < remainingMs <= 24h)
  if (remainingMs <= URGENT_RENEWAL_WINDOW_MS) {
    const emailMilestone: RenewalEmailMilestone | null =
      !hasPendingRenewalVerification && !subscription.cancelAtPeriodEnd
        ? 'expiring_24h'
        : null;

    const timeLabel =
      hoursRemaining === 1 ? 'less than 1 hour' : `${hoursRemaining} hours`;

    return {
      stage: 'expiring_urgent',
      isWithinRenewalWindow: true,
      canRenewNow: !hasPendingRenewalVerification,
      shouldShowInAppBanner: true,
      isAdminRestricted: false,
      hasPendingRenewalVerification,
      daysRemaining: 1,
      hoursRemaining,
      currentPeriodEnd: normalizedPeriodEnd,
      emailMilestone,
      emailIdempotencyKey: emailMilestone
        ? buildRenewalEmailIdempotencyKey({
            milestone: emailMilestone,
            userId: subscription.userId,
            currentPeriodEnd: normalizedPeriodEnd,
          })
        : null,
      headline: hasPendingRenewalVerification
        ? `Premium Expires in ${timeLabel} · Renewal Verification Pending`
        : `Premium Access Expires in ${timeLabel}`,
      message: hasPendingRenewalVerification
        ? `Your renewal UPI reference has been received and is under verification before ${formattedEndDate}.`
        : `Your 30-day cycle ends on ${formattedEndDate}. Renew now for ₹${PREMIUM_PLAN.priceInr} (regularly ₹${PREMIUM_PLAN.originalPriceInr}) to add +30 days seamlessly without losing any remaining hours.`,
    };
  }

  // 3. 5-Day Pre-Expiry Renewal Window (24h < remainingMs <= 5 days)
  if (remainingMs <= RENEWAL_REMINDER_WINDOW_MS) {
    const emailMilestone: RenewalEmailMilestone | null =
      !hasPendingRenewalVerification && !subscription.cancelAtPeriodEnd
        ? 'expiring_5d'
        : null;

    const dayLabel = daysRemaining === 1 ? '1 day' : `${daysRemaining} days`;

    return {
      stage: 'expiring_soon',
      isWithinRenewalWindow: true,
      canRenewNow: !hasPendingRenewalVerification,
      shouldShowInAppBanner: true,
      isAdminRestricted: false,
      hasPendingRenewalVerification,
      daysRemaining,
      hoursRemaining,
      currentPeriodEnd: normalizedPeriodEnd,
      emailMilestone,
      emailIdempotencyKey: emailMilestone
        ? buildRenewalEmailIdempotencyKey({
            milestone: emailMilestone,
            userId: subscription.userId,
            currentPeriodEnd: normalizedPeriodEnd,
          })
        : null,
      headline: hasPendingRenewalVerification
        ? `Premium Valid for ${dayLabel} · Renewal Under Review`
        : `Your Premium Access Expires in ${dayLabel}`,
      message: hasPendingRenewalVerification
        ? `Your renewal payment is awaiting administrator verification. Upon approval, +30 days will be added to ${formattedEndDate}.`
        : `Your 30-day membership is valid until ${formattedEndDate}. Renew early for ₹${PREMIUM_PLAN.priceInr} (regularly ₹${PREMIUM_PLAN.originalPriceInr}) to extend by a full +30 days from your current expiry date.`,
    };
  }

  // 4. User-cancelled subscription still in paid period (> 5 days left)
  if (subscription.cancelAtPeriodEnd || subscription.status === 'cancelled') {
    return {
      stage: 'cancelled_grace',
      isWithinRenewalWindow: true,
      canRenewNow: !hasPendingRenewalVerification,
      shouldShowInAppBanner: false,
      isAdminRestricted: false,
      hasPendingRenewalVerification,
      daysRemaining,
      hoursRemaining,
      currentPeriodEnd: normalizedPeriodEnd,
      emailMilestone: null,
      emailIdempotencyKey: null,
      headline: `Premium Access Valid Until ${formattedEndDate}`,
      message: `Your membership remains active through ${formattedEndDate}. You can extend for +30 days anytime.`,
    };
  }

  // 5. Healthy active 30-day subscription (> 5 days remaining)
  return {
    stage: 'active_healthy',
    isWithinRenewalWindow: false,
    canRenewNow: false,
    shouldShowInAppBanner: false,
    isAdminRestricted: false,
    hasPendingRenewalVerification,
    daysRemaining,
    hoursRemaining,
    currentPeriodEnd: normalizedPeriodEnd,
    emailMilestone: null,
    emailIdempotencyKey: null,
    headline: 'Active JobNexus Premium',
    message: `Your 30-day membership is active through ${formattedEndDate}.`,
  };
}

