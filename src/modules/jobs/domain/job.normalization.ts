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

const INDIAN_HUBS = [
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

export function normalizeLocation(rawLocation?: string): {
  location: string;
  isRemote: boolean;
  isIndiaEligible: boolean;
  workplaceType: 'remote' | 'hybrid' | 'onsite';
} {
  const clean = (rawLocation || '').trim();
  const lower = clean.toLowerCase();

  const isHybrid = lower.includes('hybrid') || lower.includes('partially remote');
  const isRemote =
    !clean ||
    lower.includes('remote') ||
    lower.includes('anywhere') ||
    lower.includes('worldwide') ||
    lower.includes('global') ||
    lower.includes('telecommute') ||
    lower.includes('distributed') ||
    lower.includes('work from home');

  const isIndiaDirect = INDIAN_HUBS.some((hub) => lower.includes(hub));
  const isWorldwideRemote =
    lower.includes('anywhere in the world') ||
    lower.includes('worldwide') ||
    lower.includes('global') ||
    lower === 'remote';

  const isIndiaEligible = isIndiaDirect || isWorldwideRemote;

  const workplaceType: 'remote' | 'hybrid' | 'onsite' = isHybrid
    ? 'hybrid'
    : isRemote
    ? 'remote'
    : 'onsite';

  return {
    location: clean || 'Remote',
    isRemote: isRemote || isHybrid,
    isIndiaEligible,
    workplaceType,
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
  if (lower.includes('trainee') || lower.includes('fresher')) return 'Trainee / Fresher';
  if (lower.includes('part') || lower.includes('part-time')) return 'Part Time';
  if (lower.includes('contract') || lower.includes('freelance') || lower.includes('consult'))
    return 'Contract';
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
