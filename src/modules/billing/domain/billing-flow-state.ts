import type { UserEntitlement } from './subscription.types';
import type {
  PaymentOrderDocument,
  PaymentSubmissionDocument,
} from '@/modules/storage/firestore/collections';

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
}

/**
 * Pure deterministic state-machine resolver mapping authoritative server records
 * (entitlement, submissions sorted newest-first, and unexpired created order)
 * to the exact billing modal screen that must be shown without intermediate flashes.
 */
export function resolveBillingFlowSnapshot(params: {
  entitlement: UserEntitlement | null;
  submissions: PaymentSubmissionDocument[];
  activeOrder: PaymentOrderDocument | null;
  checkedAt?: string;
}): BillingFlowSnapshot {
  const { entitlement, submissions, activeOrder } = params;
  const checkedAt = params.checkedAt || new Date().toISOString();

  // 1. Any pending verification claim takes strict precedence -> Status View (Pending)
  const pendingSubmission =
    submissions.find((s) => s.status === 'pending_verification') || null;
  if (pendingSubmission) {
    return {
      step: 'status_view',
      submission: pendingSubmission,
      order: null,
      hasPendingVerification: true,
      hasRejectedSubmission: false,
      checkedAt,
    };
  }

  // 2. Active Premium entitlement -> Status View (Active Premium)
  if (entitlement?.isPremium) {
    const approvedSubmission =
      submissions.find((s) => s.status === 'approved') || null;
    return {
      step: 'status_view',
      submission: approvedSubmission,
      order: null,
      hasPendingVerification: false,
      hasRejectedSubmission: false,
      checkedAt,
    };
  }

  // 3. Non-premium user whose most recent submission was rejected
  const latestSubmission = submissions[0] || null;
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
      };
    }

    return {
      step: 'status_view',
      submission: latestSubmission,
      order: null,
      hasPendingVerification: false,
      hasRejectedSubmission: true,
      checkedAt,
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
  };
}
