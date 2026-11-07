/**
 * JobNexus Central Legal, Compliance & Verification SLA Configuration
 *
 * Authoritative single source of truth for:
 * - Policy versions & effective dates
 * - Manual UPI Verification SLA (120 minutes / 2 hours)
 * - Statutory grievance & compliance contacts (India DPDP Act 2023 & IT Rules)
 * - Platform nature & non-agency disclaimers
 */

export const LEGAL_VERSIONS = {
  privacyPolicy: '1.0',
  termsAndConditions: '1.0',
} as const;

export const LEGAL_METADATA = {
  effectiveDate: '2026-11-01',
  lastUpdatedDate: '2026-11-07',
  jurisdiction: 'Bengaluru, Karnataka, India',
  governingLaw: 'Laws of India',
} as const;

/**
 * 2-Hour (120-minute) Manual UPI Payment Verification SLA
 *
 * Operational Commitment:
 * - Commences strictly upon valid, complete payment details submission (server-side `submittedAt`).
 * - Never starts at order creation, QR code display, or client browser time.
 * - Idempotent repeated submissions do not reset or extend the SLA deadline.
 * - Concludes when an authorized administrator records Approval or Rejection.
 */
export const UPI_VERIFICATION_SLA = {
  hours: 2,
  minutes: 120,
  ms: 2 * 60 * 60 * 1000, // 7,200,000 ms
  label: '2 hours',
  maxLabel: 'maximum of 2 hours',
  targetLabel: '2h SLA Target',
  badgeLabel: '>2h',
  breachThresholdMinutes: 120,
} as const;

export const LEGAL_CONTACT = {
  platformName: 'JobNexus',
  operatingEntity: 'JobNexus Technologies',
  supportEmail: 'support@jobnexus.in',
  grievanceEmail: 'grievance@jobnexus.in',
  grievanceOfficerName: 'Grievance Officer — JobNexus Redressal Mechanism',
  city: 'Bengaluru',
  state: 'Karnataka',
  country: 'India',
  responseTimeframe: '30 days as prescribed under the Digital Personal Data Protection Act, 2023 and Information Technology Rules',
  securityNotice:
    'JobNexus will never ask for your UPI PIN, banking password, debit card details, net banking credentials, or one-time password (OTP). Never disclose payment secrets to anyone claiming to represent JobNexus.',
  nonAgencyDisclaimer:
    'JobNexus is a job discovery and aggregation platform for job seekers. It is not an employer, employment agency, recruitment consultancy, staffing agency, or placement service. JobNexus does not conduct interviews, charge job seekers for applications, or make hiring decisions.',
} as const;

/**
 * Computes authoritative SLA deadline given server-side submission timestamp
 */
export function calculateSlaDeadline(submittedAt: Date | string): Date {
  const baseTime = typeof submittedAt === 'string' ? new Date(submittedAt).getTime() : submittedAt.getTime();
  return new Date(baseTime + UPI_VERIFICATION_SLA.ms);
}

/**
 * Evaluates whether a pending submission has breached the 2-hour SLA deadline
 */
export function isSlaOverdue(slaDeadlineAt: string | Date, nowMs: number = Date.now()): boolean {
  const deadlineMs = typeof slaDeadlineAt === 'string' ? new Date(slaDeadlineAt).getTime() : slaDeadlineAt.getTime();
  if (isNaN(deadlineMs)) return false;
  return deadlineMs < nowMs;
}
