import type { SubscriptionRecord, UserEntitlement } from './subscription.types';
import type {
  PaymentOrderDocument,
  PaymentSubmissionDocument,
} from '@/modules/storage/firestore/collections';
import {
  evaluateRenewalWindow,
  type RenewalWindowSnapshot,
} from './renewal-window';

export type BillingFlowStep =
  | 'plan_review'
  | 'payment_instructions'
  | 'submit_reference'
  | 'status_view';

export interface BillingFlowSnapshot {
  step: BillingFlowStep;
  submission: PaymentSubmissionDocument | null;
  order: PaymentOrderDocument | null;
  hasPendingVerification: boolean;
  hasRejectedSubmission: boolean;
  checkedAt: string;
  renewal: RenewalWindowSnapshot;
}

/**
 * Pure deterministic state-machine resolver mapping authoritative server records
 * (entitlement, subscription record, submissions sorted newest-first, and unexpired
 * created order) to the exact billing modal screen and renewal window state.
 */
export function resolveBillingFlowSnapshot(params: {
  entitlement: UserEntitlement | null;
  submissions: PaymentSubmissionDocument[];
  activeOrder: PaymentOrderDocument | null;
  subscription?: SubscriptionRecord | null;
  checkedAt?: string;
  nowMs?: number;
}): BillingFlowSnapshot {
  const { entitlement, submissions, activeOrder } = params;
  const checkedAt = params.checkedAt || new Date().toISOString();

  const pendingSubmission =
    submissions.find((s) => s.status === 'pending_verification') || null;

  const effectiveSubscription: SubscriptionRecord | null =
    params.subscription !== undefined
      ? params.subscription
      : entitlement?.subscription
        ? {
            id: entitlement.subscription.id,
            userId: entitlement.userId,
            planId: 'premium_monthly',
            status: entitlement.subscription.status,
            provider:
              (entitlement.subscription.provider as SubscriptionRecord['provider']) ||
              'manual_upi',
            currentPeriodStart: '',
            currentPeriodEnd: entitlement.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: entitlement.subscription.cancelAtPeriodEnd,
            createdAt: '',
            updatedAt: '',
          }
        : null;

  const renewal = evaluateRenewalWindow({
    subscription: effectiveSubscription,
    hasPendingVerification: Boolean(pendingSubmission),
    nowMs: params.nowMs,
  });

  // 1. Any pending verification claim takes strict precedence -> Status View (Pending)
  if (pendingSubmission) {
    return {
      step: 'status_view',
      submission: pendingSubmission,
      order: null,
      hasPendingVerification: true,
      hasRejectedSubmission: false,
      checkedAt,
      renewal,
    };
  }

  const latestSubmission = submissions[0] || null;

  // 2. Active Premium entitlement (including 5-day / 24h early-renewal window)
  if (entitlement?.isPremium) {
    const approvedSubmission =
      submissions.find((s) => s.status === 'approved') || null;

    // 2a. Edge Case: Active subscriber submitted an early-renewal UTR that was rejected
    const isRejectedEarlyRenewal =
      latestSubmission !== null &&
      latestSubmission.status === 'rejected' &&
      (!approvedSubmission ||
        latestSubmission.submittedAt >= approvedSubmission.submittedAt) &&
      (!effectiveSubscription?.currentPeriodStart ||
        latestSubmission.submittedAt >= effectiveSubscription.currentPeriodStart);

    if (isRejectedEarlyRenewal && latestSubmission) {
      const rejectionTimestamp =
        latestSubmission.reviewedAt || latestSubmission.submittedAt;
      const hasNewerActiveOrder = Boolean(
        activeOrder &&
          activeOrder.status === 'created' &&
          activeOrder.orderId !== latestSubmission.orderId &&
          activeOrder.createdAt > rejectionTimestamp
      );

      if (hasNewerActiveOrder && activeOrder) {
        return {
          step: 'payment_instructions',
          submission: null,
          order: activeOrder,
          hasPendingVerification: false,
          hasRejectedSubmission: false,
          checkedAt,
          renewal,
        };
      }

      return {
        step: 'status_view',
        submission: latestSubmission,
        order: null,
        hasPendingVerification: false,
        hasRejectedSubmission: true,
        checkedAt,
        renewal,
      };
    }

    // 2b. Active subscriber inside renewal window who already initiated an unexpired renewal QR order
    if (
      renewal.isWithinRenewalWindow &&
      activeOrder &&
      activeOrder.status === 'created' &&
      (!approvedSubmission ||
        activeOrder.createdAt >
          (approvedSubmission.reviewedAt || approvedSubmission.submittedAt))
    ) {
      return {
        step: 'payment_instructions',
        submission: null,
        order: activeOrder,
        hasPendingVerification: false,
        hasRejectedSubmission: false,
        checkedAt,
        renewal,
      };
    }

    return {
      step: 'status_view',
      submission: approvedSubmission,
      order: null,
      hasPendingVerification: false,
      hasRejectedSubmission: false,
      checkedAt,
      renewal,
    };
  }

  // 3. Non-premium user whose most recent submission was rejected
  if (latestSubmission && latestSubmission.status === 'rejected') {
    const rejectionTimestamp =
      latestSubmission.reviewedAt || latestSubmission.submittedAt;
    const hasNewerActiveOrder = Boolean(
      activeOrder &&
        activeOrder.status === 'created' &&
        activeOrder.orderId !== latestSubmission.orderId &&
        activeOrder.createdAt > rejectionTimestamp
    );

    if (hasNewerActiveOrder && activeOrder) {
      return {
        step: 'payment_instructions',
        submission: null,
        order: activeOrder,
        hasPendingVerification: false,
        hasRejectedSubmission: false,
        checkedAt,
        renewal,
      };
    }

    return {
      step: 'status_view',
      submission: latestSubmission,
      order: null,
      hasPendingVerification: false,
      hasRejectedSubmission: true,
      checkedAt,
      renewal,
    };
  }

  // 4. Non-premium user with an unexpired active order already initiated -> Payment Instructions (QR)
  if (activeOrder && activeOrder.status === 'created') {
    return {
      step: 'payment_instructions',
      submission: null,
      order: activeOrder,
      hasPendingVerification: false,
      hasRejectedSubmission: false,
      checkedAt,
      renewal,
    };
  }

  // 5. Default free / expired user with no active order or pending claim -> Plan Review (Offer)
  return {
    step: 'plan_review',
    submission: null,
    order: null,
    hasPendingVerification: false,
    hasRejectedSubmission: false,
    checkedAt,
    renewal,
  };
}
