/**
 * Centralized Workplace Arrangement & Remote Eligibility Classifier.
 * Implements strict, verifiable classification according to Section 3:
 * - ONSITE, HYBRID, REMOTE, UNSPECIFIED
 * - Remote eligibility: worldwide, india_remote, country_specific, region_specific, timezone_restricted, unspecified
 *
 * Rules:
 * 1. Never classify as remote merely because location is missing.
 * 2. Never infer hybrid from general working policy unless explicit evidence exists.
 * 3. Use explicit provider fields or reliable job-description evidence.
 * 4. Always preserve the original location string and workplace description.
 * 5. If unverifiable, strictly classify as UNSPECIFIED.
 * 6. Never discard jobs because workplace classification is unavailable.
 */

export const INDIAN_HUBS = [
  'india',
  'bharat',
  'bangalore',
  'bengaluru',
  'delhi',
  'new delhi',
  'ncr',
  'mumbai',
  'bombay',
  'pune',
  'hyderabad',
  'chennai',
  'madras',
  'noida',
  'greater noida',
  'gurgaon',
  'gurugram',
  'kolkata',
  'calcutta',
  'ahmedabad',
  'thiruvananthapuram',
  'trivandrum',
  'kochi',
  'cochin',
  'chandigarh',
  'mohali',
  'panchkula',
  'jaipur',
  'indore',
  'lucknow',
  'nagpur',
  'bhubaneswar',
  'bhubaneshwar',
  'patna',
  'bhopal',
  'visakhapatnam',
  'vizag',
  'coimbatore',
  'vadodara',
  'baroda',
  'mysore',
  'mysuru',
  'surat',
  'faridabad',
  'ghaziabad',
  'navi mumbai',
  'thane',
  'secunderabad',
  'mangalore',
  'mangaluru',
  'dehradun',
  'nashik',
  'nasik',
  'guwahati',
  'raipur',
  'ranchi',
  'kanpur',
  'varanasi',
  'amritsar',
  'ludhiana',
  'jalandhar',
  'madurai',
  'trichy',
  'tiruchirappalli',
  'vijayawada',
  'guntur',
  'hubli',
  'dharwad',
  'belgaum',
  'belagavi',
  'aurangabad',
  'chhatrapati sambhajinagar',
];

export type PrimaryWorkplaceType = 'ONSITE' | 'HYBRID' | 'REMOTE' | 'UNSPECIFIED';

export type RemoteEligibilityType =
  | 'worldwide'
  | 'india_remote'
  | 'country_specific'
  | 'region_specific'
  | 'timezone_restricted'
  | 'unspecified';

export interface WorkplaceClassification {
  primaryType: PrimaryWorkplaceType;
  remoteEligibility: RemoteEligibilityType;
  isRemote: boolean;
  isIndiaEligible: boolean;
  rawLocationPreserved: string;
  normalizedLocation: string;
  // Legacy compatibility: lowercase workplaceType ('remote' | 'hybrid' | 'onsite' | 'unknown')
  workplaceType: 'remote' | 'hybrid' | 'onsite' | 'unknown';
}

const REGION_INDICATORS = [
  'emea', 'apac', 'latam', 'na', 'eu', 'europe', 'asia', 'north america', 'south america',
  'california', 'bay area', 'east coast', 'west coast', 'bavaria', 'ontario',
];

const TIMEZONE_INDICATORS = [
  'utc', 'gmt', 'est', 'pst', 'cst', 'mst', 'cet', 'eet', 'ist', 'aest',
  'timezone', 'time zone', 'hours overlap', 'working hours',
];

export function classifyWorkplace(
  rawLocation?: string,
  rawDescription?: string,
  explicitIsRemote?: boolean,
  rawWorkplaceType?: string
): WorkplaceClassification {
  const originalLocation = (rawLocation || '').trim();
  const lowerLoc = originalLocation.toLowerCase();
  const lowerDesc = (rawDescription || '').slice(0, 800).toLowerCase();
  const lowerWorkplace = (rawWorkplaceType || '').toLowerCase();

  // Rule 1: Never classify a job as remote merely because its location is missing.
  if (!originalLocation && explicitIsRemote === undefined && !rawWorkplaceType) {
    return {
      primaryType: 'UNSPECIFIED',
      remoteEligibility: 'unspecified',
      isRemote: false,
      isIndiaEligible: false,
      rawLocationPreserved: '',
      normalizedLocation: 'Location not provided',
      workplaceType: 'unknown',
    };
  }

  // Check 1: Explicit Hybrid evidence
  const hasExplicitHybrid =
    lowerWorkplace === 'hybrid' ||
    lowerLoc.includes('hybrid') ||
    lowerLoc.includes('partially remote') ||
    /\b(\d+\s*days?\s*(in office|on-?site|from home))\b/i.test(lowerLoc) ||
    /\b(\d+\s*days?\s*(in office|on-?site))\b/i.test(lowerDesc);

  if (hasExplicitHybrid) {
    const isIndiaDirect = INDIAN_HUBS.some((hub) => lowerLoc.includes(hub));
    return {
      primaryType: 'HYBRID',
      remoteEligibility: 'unspecified',
      isRemote: false,
      isIndiaEligible: isIndiaDirect,
      rawLocationPreserved: originalLocation,
      normalizedLocation: originalLocation || 'Hybrid',
      workplaceType: 'hybrid',
    };
  }

  // Check 2: Explicit Remote evidence
  const hasExplicitRemote =
    explicitIsRemote === true ||
    lowerWorkplace === 'remote' ||
    lowerLoc.includes('remote') ||
    lowerLoc.includes('telecommute') ||
    lowerLoc.includes('distributed') ||
    lowerLoc.includes('work from home') ||
    lowerLoc.includes('anywhere') ||
    lowerLoc.includes('worldwide') ||
    lowerLoc.includes('global');

  if (hasExplicitRemote) {
    // Classify Remote Eligibility
    let remoteEligibility: RemoteEligibilityType = 'unspecified';
    const isWorldwide =
      lowerLoc.includes('worldwide') ||
      lowerLoc.includes('anywhere in the world') ||
      lowerLoc.includes('global') ||
      lowerLoc.includes('remote worldwide') ||
      lowerLoc.includes('anywhere') ||
      lowerLoc.includes('work from anywhere');

    const isIndiaRemote =
      lowerLoc.includes('india') ||
      INDIAN_HUBS.some((hub) => lowerLoc.includes(hub));

    const isTimezone = TIMEZONE_INDICATORS.some((tz) => lowerLoc.includes(tz) || lowerDesc.includes(tz));
    const isRegion = REGION_INDICATORS.some((reg) => lowerLoc.includes(reg));

    if (isWorldwide) {
      remoteEligibility = 'worldwide';
    } else if (isIndiaRemote) {
      remoteEligibility = 'india_remote';
    } else if (isTimezone) {
      remoteEligibility = 'timezone_restricted';
    } else if (isRegion) {
      remoteEligibility = 'region_specific';
    } else if (lowerLoc.includes('only') || lowerLoc.includes('remote -') || lowerLoc.includes('remote,')) {
      remoteEligibility = 'country_specific';
    }

    const isIndiaEligible = isWorldwide || isIndiaRemote || (remoteEligibility === 'worldwide');

    return {
      primaryType: 'REMOTE',
      remoteEligibility,
      isRemote: true,
      isIndiaEligible,
      rawLocationPreserved: originalLocation,
      normalizedLocation: originalLocation || 'Remote',
      workplaceType: 'remote',
    };
  }

  // Check 3: Explicit Onsite evidence
  if (originalLocation && originalLocation.toLowerCase() !== 'location not provided') {
    const isIndiaDirect = INDIAN_HUBS.some((hub) => lowerLoc.includes(hub));
    return {
      primaryType: 'ONSITE',
      remoteEligibility: 'unspecified',
      isRemote: false,
      isIndiaEligible: isIndiaDirect,
      rawLocationPreserved: originalLocation,
      normalizedLocation: originalLocation,
      workplaceType: 'onsite',
    };
  }

  // Fallback Rule 5: If unverifiable, use UNSPECIFIED
  return {
    primaryType: 'UNSPECIFIED',
    remoteEligibility: 'unspecified',
    isRemote: false,
    isIndiaEligible: false,
    rawLocationPreserved: originalLocation,
    normalizedLocation: originalLocation || 'Location not provided',
    workplaceType: 'unknown',
  };
}
