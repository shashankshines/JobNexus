import type {
  PaymentOrderDocument,
  PaymentSubmissionDocument,
} from '@/modules/storage/firestore/collections';

export type PaymentOrder = PaymentOrderDocument;
export type PaymentSubmission = PaymentSubmissionDocument;

export type UpiPaymentStep =
  | 'plan_review'
  | 'payment_instructions'
  | 'submit_reference'
  | 'status_view';

