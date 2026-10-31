/**
 * JobNexus Premium Membership — Domain Types & Plans
 * Server-controlled plan parameters and authoritative subscription lifecycle models.
 */

export const PREMIUM_PLAN = {
  id: 'premium_monthly' as const,
  name: 'JobNexus Premium',
  description: 'Uncapped direct ATS application links, priority company unmasking, and unlimited verified job saving.',
  currency: 'INR' as const,
  priceInr: 499,
  amountInPaise: 49900,
  interval: 'monthly' as const,
  taxTerms: 'All-inclusive of applicable taxes (GST). Renews automatically at ₹499/month until cancelled.',
  benefits: [
    'Direct Application Access: Get convenient access to available application links and move from job discovery to applying with fewer steps.',
    'Instant Company Unmasking: Zero waiting for employer identities & job sources',
    'Unlimited Saved Jobs: Organize, track, and monitor target positions',
    'Ad-Free & Distraction-Free: Focused engineering discovery interface',
    'Verified India & Global Remote Feeds: Early access to newly ingested opportunities',
  ],
  cancellationPolicy: 'Cancel anytime in 1 click from your profile. Retain full access until the end of your billing cycle.',
  disclaimer: 'JobNexus is a career discovery and aggregation platform. Membership does not guarantee interviews, employment, or job offers.',
};

export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'      // Reversible administrative suspension (access blocked, period preserved)
  | 'terminated'  // Reversible administrative termination (access blocked, history preserved)
  | 'cancelled'   // Permanent revocation (metadata.revoked === true) OR user-initiated cancel
  | 'completed'
  | 'expired';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  userEmail?: string;
  planId: 'premium_monthly';
  status: SubscriptionStatus;
  provider: 'manual_upi' | 'razorpay' | 'manual' | 'test';
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  providerPaymentId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  paymentReference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingEventRecord {
  id: string; // Provider event id (e.g. event_... or payment_...)
  provider: string;
  eventType: string;
  receivedAt?: string;
  createdAt: string;
  processed?: boolean;
  payloadHash?: string;
  payload?: Record<string, unknown>;
}

export interface UserEntitlement {
  userId: string;
  isPremium: boolean;
  tier: 'free' | 'premium';
  status: 'free' | 'active' | 'cancelled_grace' | 'expired' | 'suspended';
  subscription?: {
    id: string;
    planId: string;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    provider?: string;
  };
  reason: string;
}
