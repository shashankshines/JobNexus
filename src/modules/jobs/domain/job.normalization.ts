const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'source',
  'fbclid',
  'gclid',
  'dclid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
]);

import {
  INDIAN_HUBS,
  classifyWorkplace,
  PrimaryWorkplaceType,
  RemoteEligibilityType,
  WorkplaceClassification,
} from './workplace.classification';

export {
  INDIAN_HUBS,
  classifyWorkplace,
};
export type {
  PrimaryWorkplaceType,
  RemoteEligibilityType,
  WorkplaceClassification,
};

export function isValidHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function canonicalizeUrl(rawUrl: string): string {
  if (!isValidHttpUrl(rawUrl)) return '';
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Safely remove marketing trackers while preserving application parameters
    const toDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) {
      parsed.searchParams.delete(key);
    }

    // Strip trailing hash/fragment and trailing slash on root
    parsed.hash = '';
    let result = parsed.toString();
    if (result.endsWith('/') && parsed.pathname === '/') {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return rawUrl.trim();
  }
}

export function stripHtml(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDate(dateInput: unknown): string {
  if (!dateInput) return new Date().toISOString();

  // If number or numeric string (Unix epoch timestamp)
  if (typeof dateInput === 'number' || (typeof dateInput === 'string' && /^\d+$/.test(dateInput))) {
    let num = Number(dateInput);
    if (num < 1e11) {
      num *= 1000; // convert seconds to milliseconds
    }
    const d = new Date(num);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  if (typeof dateInput === 'string') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  return new Date().toISOString();
}

export function normalizeLocation(
  rawLocation?: string,
  rawDescription?: string,
  explicitIsRemote?: boolean,
  rawWorkplaceType?: string
): {
  location: string;
  isRemote: boolean;
  isIndiaEligible: boolean;
  workplaceType: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  primaryType: PrimaryWorkplaceType;
  remoteEligibility: RemoteEligibilityType;
} {
  const result = classifyWorkplace(
    rawLocation,
    rawDescription,
    explicitIsRemote,
    rawWorkplaceType
  );

  return {
    location: result.normalizedLocation,
    isRemote: result.isRemote,
    isIndiaEligible: result.isIndiaEligible,
    workplaceType: result.workplaceType,
    primaryType: result.primaryType,
    remoteEligibility: result.remoteEligibility,
  };
}

export function normalizeEmploymentType(rawType?: unknown): string {
  if (!rawType) return 'Full Time';
  let str = '';
  if (Array.isArray(rawType)) {
    str = rawType.filter(Boolean).join(', ');
  } else if (typeof rawType === 'string') {
    str = rawType;
  } else {
    str = String(rawType);
  }

  const lower = str.toLowerCase();
  if (lower.includes('apprentice')) return 'Apprenticeship';
  if (lower.includes('intern')) return 'Internship';
  if (lower.includes('trainee') || lower.includes('fresher') || lower.includes('graduate trainee')) return 'Trainee / Fresher';
  if (lower.includes('freelance')) return 'Freelance';
  if (lower.includes('part') || lower.includes('part-time')) return 'Part Time';
  if (lower.includes('temporary') || lower.includes('temp')) return 'Temporary';
  if (lower.includes('contract') || lower.includes('consult')) return 'Contract';
  return 'Full Time';
}

export function normalizeSeniority(title: string, tags: string[] = []): string {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();

  if (/\b(lead|principal|staff|manager|director|vp|head|architect)\b/i.test(text)) {
    return 'Lead';
  }
  if (/\b(senior|sr\.?|advanced|expert)\b/i.test(text)) {
    return 'Senior';
  }
  if (/\b(entry|junior|jr\.?|intern|internship|graduate|associate|fresher|apprentice|trainee)\b/i.test(text)) {
    return 'Entry';
  }
  return 'Mid';
}

export function normalizeSalary(rawSalary?: unknown): string | undefined {
  if (!rawSalary) return undefined;
  if (typeof rawSalary !== 'string' && typeof rawSalary !== 'number') return undefined;
  const str = String(rawSalary).trim();
  if (
    !str ||
    str.toLowerCase() === 'unspecified' ||
    str.toLowerCase() === 'competitive' ||
    str.toLowerCase() === 'not disclosed'
  ) {
    return undefined;
  }

  // Preserve Indian LPA / Lakhs / Per Annum representations: e.g. "12 - 18 LPA", "6 Lakhs", "₹12,00,000"
  if (/(\b(lpa|lakh|lakhs|inr|₹)\b)/i.test(str)) {
    return str.replace(/\s+/g, ' ');
  }

  // Preserve standard currency strings: e.g. "₹50,000 / month", "$120,000 - $150,000"
  if (/[₹$€£]\s*[\d,]+/.test(str)) {
    return str.replace(/\s+/g, ' ');
  }

  return str.replace(/\s+/g, ' ');
}

export { classifyJobIndustry, getIndustryLabel } from './job.taxonomy';
export type { JobIndustry } from './job.taxonomy';
