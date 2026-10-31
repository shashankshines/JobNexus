import { NormalizedJob, JobSearchParams } from './job.types';
import { normalizeIndustryFilter, resolveJobIndustry } from './job.taxonomy';

export const INDIAN_CITIES = [
  // Tier 1 Metros & Prime Tech Hubs
  'bangalore',
  'bengaluru',
  'delhi',
  'new delhi',
  'ncr',
  'delhi ncr',
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
  // Tier 2 Emerging Tech Hubs & Innovation Centers
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
  'mysore',
  'mysuru',
  'vadodara',
  'baroda',
  'coimbatore',
  'bhopal',
  'patna',
  'bhubaneswar',
  'bhubaneshwar',
  'nagpur',
  'visakhapatnam',
  'vizag',
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
  'solapur',
  'jodhpur',
  'udaipur',
];

export const INDIAN_STATES = [
  'karnataka',
  'maharashtra',
  'telangana',
  'tamil nadu',
  'uttar pradesh',
  'haryana',
  'delhi',
  'west bengal',
  'gujarat',
  'kerala',
  'rajasthan',
  'punjab',
  'madhya pradesh',
  'andhra pradesh',
  'odisha',
  'orissa',
  'bihar',
  'jharkhand',
  'chhattisgarh',
  'uttarakhand',
  'assam',
  'goa',
  'himachal pradesh',
];

export const US_CITIES = [
  'new york',
  'nyc',
  'san francisco',
  'sf',
  'bay area',
  'silicon valley',
  'seattle',
  'austin',
  'chicago',
  'los angeles',
  'la',
  'boston',
  'denver',
  'atlanta',
  'miami',
  'dallas',
  'houston',
  'san diego',
  'portland',
  'washington dc',
  'pittsburgh',
];

export const US_COUNTRY_IDENTIFIERS = [
  'united states',
  'usa',
  'us',
  'u.s.',
  'u.s.a.',
  'america',
];

export const UK_CITIES = [
  'london',
  'manchester',
  'birmingham',
  'edinburgh',
  'bristol',
  'cambridge',
  'oxford',
  'leeds',
  'glasgow',
];

export const UK_COUNTRY_IDENTIFIERS = [
  'united kingdom',
  'uk',
  'u.k.',
  'great britain',
  'britain',
  'england',
  'scotland',
  'wales',
];

export const GERMANY_CITIES = [
  'berlin',
  'munich',
  'münchen',
  'frankfurt',
  'hamburg',
  'cologne',
  'köln',
  'stuttgart',
  'germany',
  'deutschland',
];

export const CANADA_CITIES = [
  'toronto',
  'vancouver',
  'montreal',
  'ottawa',
  'calgary',
  'waterloo',
  'canada',
];

export const EUROPE_REGIONS = [
  'europe',
  'eu',
  'emea',
  ...UK_CITIES,
  ...UK_COUNTRY_IDENTIFIERS,
  ...GERMANY_CITIES,
  'paris',
  'france',
  'amsterdam',
  'netherlands',
  'holland',
  'dublin',
  'ireland',
  'stockholm',
  'sweden',
  'madrid',
  'barcelona',
  'spain',
  'zurich',
  'geneva',
  'switzerland',
];

export const APAC_REGIONS = [
  'apac',
  'asia',
  'singapore',
  'sydney',
  'melbourne',
  'brisbane',
  'australia',
  'tokyo',
  'japan',
  'seoul',
  'korea',
  'new zealand',
  'auckland',
];

export const GLOBAL_COUNTRY_CITIES: Record<string, string[]> = {
  france: ['paris', 'france'],
  netherlands: ['amsterdam', 'rotterdam', 'netherlands', 'holland'],
  ireland: ['dublin', 'ireland', 'cork'],
  switzerland: ['zurich', 'geneva', 'switzerland', 'lausanne'],
  sweden: ['stockholm', 'sweden', 'gothenburg'],
  spain: ['madrid', 'barcelona', 'spain', 'valencia'],
  singapore: ['singapore'],
  australia: ['sydney', 'melbourne', 'brisbane', 'perth', 'australia'],
  japan: ['tokyo', 'osaka', 'japan'],
  brazil: ['sao paulo', 'são paulo', 'rio de janeiro', 'rio', 'brazil'],
  uae: ['dubai', 'abu dhabi', 'uae', 'united arab emirates'],
};

export const SYNONYMS: Record<string, string[]> = {
  bangalore: ['bengaluru'],
  bengaluru: ['bangalore'],
  gurgaon: ['gurugram'],
  gurugram: ['gurgaon'],
  bombay: ['mumbai'],
  mumbai: ['bombay', 'navi mumbai', 'thane'],
  'navi mumbai': ['mumbai'],
  thane: ['mumbai'],
  madras: ['chennai'],
  chennai: ['madras'],
  calcutta: ['kolkata'],
  kolkata: ['calcutta'],
  delhi: ['new delhi', 'ncr', 'delhi ncr'],
  'new delhi': ['delhi', 'ncr', 'delhi ncr'],
  ncr: ['delhi', 'new delhi', 'delhi ncr', 'gurgaon', 'noida'],
  'delhi ncr': ['delhi', 'new delhi', 'ncr', 'gurgaon', 'noida', 'gurugram'],
  trivandrum: ['thiruvananthapuram'],
  thiruvananthapuram: ['trivandrum'],
  cochin: ['kochi'],
  kochi: ['cochin'],
  baroda: ['vadodara'],
  vadodara: ['baroda'],
  mysore: ['mysuru'],
  mysuru: ['mysore'],
  mangalore: ['mangaluru'],
  mangaluru: ['mangalore'],
  vizag: ['visakhapatnam'],
  visakhapatnam: ['vizag'],
  nasik: ['nashik'],
  nashik: ['nasik'],
  mohali: ['chandigarh', 'tricity'],
  panchkula: ['chandigarh', 'tricity'],
  chandigarh: ['mohali', 'panchkula', 'tricity'],
  bhubaneshwar: ['bhubaneswar'],
  bhubaneswar: ['bhubaneshwar'],
  trichy: ['tiruchirappalli'],
  tiruchirappalli: ['trichy'],
  belgaum: ['belagavi'],
  belagavi: ['belgaum'],
  aurangabad: ['chhatrapati sambhajinagar'],
  'chhatrapati sambhajinagar': ['aurangabad'],
  orissa: ['odisha'],
  odisha: ['orissa'],
  secunderabad: ['hyderabad'],
  sf: ['san francisco', 'bay area', 'silicon valley'],
  'san francisco': ['sf', 'bay area', 'silicon valley'],
  'bay area': ['san francisco', 'sf', 'silicon valley'],
  'silicon valley': ['san francisco', 'sf', 'bay area'],
  nyc: ['new york', 'new york city'],
  'new york': ['nyc', 'new york city'],
  'new york city': ['nyc', 'new york'],
  la: ['los angeles'],
  'los angeles': ['la'],
  munich: ['münchen'],
  münchen: ['munich'],
  cologne: ['köln'],
  köln: ['cologne'],
  us: ['usa', 'united states'],
  usa: ['us', 'united states'],
  'united states': ['us', 'usa'],
  uk: ['united kingdom', 'britain', 'england'],
  'united kingdom': ['uk', 'britain', 'england'],
};

export const MULTI_WORD_LOCATIONS = [
  'san francisco',
  'bay area',
  'silicon valley',
  'new york city',
  'new york',
  'washington dc',
  'united states',
  'united kingdom',
  'great britain',
  'new delhi',
  'delhi ncr',
  'greater noida',
  'navi mumbai',
  'los angeles',
  'san diego',
  'tel aviv',
  'abu dhabi',
  'united arab emirates',
  'sao paulo',
  'são paulo',
  'tamil nadu',
  'uttar pradesh',
  'west bengal',
  'andhra pradesh',
  'madhya pradesh',
  'himachal pradesh',
  'hubli dharwad',
  'hubli-dharwad',
  'chhatrapati sambhajinagar',
  'anywhere in the world',
  'remote (worldwide)',
];

export const COMMON_STOP_WORDS = new Set([
  'in',
  'at',
  'for',
  'with',
  'and',
  'or',
  'of',
  'to',
  'the',
  'a',
  'an',
  'job',
  'jobs',
  'hiring',
  'role',
  'roles',
  'opening',
  'openings',
  'position',
  'positions',
]);

const ALL_KNOWN_LOCATIONS = new Set<string>([
  ...INDIAN_CITIES,
  ...INDIAN_STATES,
  'india',
  'bharat',
  'ind',
  ...US_CITIES,
  ...US_COUNTRY_IDENTIFIERS,
  ...UK_CITIES,
  ...UK_COUNTRY_IDENTIFIERS,
  ...GERMANY_CITIES,
  ...CANADA_CITIES,
  ...EUROPE_REGIONS,
  ...APAC_REGIONS,
  ...Object.keys(GLOBAL_COUNTRY_CITIES),
  'remote',
  'worldwide',
  'global',
  'anywhere',
  ...Object.keys(SYNONYMS),
]);

export function isKnownLocation(token: string): boolean {
  if (!token) return false;
  const t = token.trim().toLowerCase();
  return ALL_KNOWN_LOCATIONS.has(t) || Boolean(SYNONYMS[t]);
}

export interface ParsedQuery {
  rawQuery: string;
  roleTokens: string[];
  locationTokens: string[];
  rolePhrase: string;
  hasRoleTokens: boolean;
  hasLocationTokens: boolean;
}

export function parseQueryTokens(query: string): ParsedQuery {
  const rawQuery = (query || '').trim();
  if (!rawQuery) {
    return {
      rawQuery: '',
      roleTokens: [],
      locationTokens: [],
      rolePhrase: '',
      hasRoleTokens: false,
      hasLocationTokens: false,
    };
  }

  let working = rawQuery.toLowerCase();
  const locationTokens: string[] = [];

  // 1. Extract known multi-word location expressions first
  for (const multi of MULTI_WORD_LOCATIONS) {
    if (working.includes(multi)) {
      locationTokens.push(multi);
      working = working.replace(
        new RegExp(`\\b${multi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
        ' '
      );
    }
  }

  // 2. Tokenize remaining words
  const words = working.split(/\s+/).filter(Boolean);
  const roleTokens: string[] = [];

  for (const word of words) {
    const locationWord = word.replace(/^[,;:!?()[\]{}]+|[,;:!?()[\]{}]+$/g, '');
    if (COMMON_STOP_WORDS.has(locationWord)) {
      continue;
    }
    if (isKnownLocation(locationWord)) {
      locationTokens.push(locationWord);
    } else {
      roleTokens.push(word);
    }
  }

  const rolePhrase = roleTokens.join(' ').trim();

  return {
    rawQuery,
    roleTokens,
    locationTokens,
    rolePhrase,
    hasRoleTokens: roleTokens.length > 0,
    hasLocationTokens: locationTokens.length > 0,
  };
}

/**
 * Safe matching helper: word boundary check for short tokens (<= 3 chars),
 * substring match for longer tokens.
 */
function safeLocationMatch(target: string, needle: string): boolean {
  if (!target || !needle) return false;
  if (needle.length <= 3) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(target);
  }
  return target.includes(needle);
}

/**
 * Evaluates whether a job matches a single atomic location keyword.
 */
export function matchesSingleLocation(
  jobLoc: string,
  isRemote: boolean,
  isIndiaEligible: boolean,
  filter: string
): boolean {
  if (!filter) return true;
  const f = filter.trim().toLowerCase();
  if (!f) return true;

  const worldwideFilter =
    f === 'remote (worldwide)' ||
    f === 'worldwide' ||
    f === 'global' ||
    f === 'anywhere in the world' ||
    f === 'anywhere';
  if (worldwideFilter) {
    return (
      isRemote &&
      (jobLoc.includes('worldwide') ||
        jobLoc.includes('anywhere in the world') ||
        jobLoc.includes('global') ||
        jobLoc.includes('open to all countries'))
    );
  }
  if (f === 'remote') {
    return isRemote;
  }

  // Direct safe match
  if (safeLocationMatch(jobLoc, f)) return true;

  // Synonyms resolution
  const directSynonyms = SYNONYMS[f];
  if (directSynonyms && directSynonyms.some((syn) => safeLocationMatch(jobLoc, syn))) {
    return true;
  }

  // Country: India (Domestic cities, states, and global remote eligible for India)
  if (f === 'india' || f === 'bharat' || f === 'ind') {
    if (isIndiaEligible) return true;
    if (INDIAN_CITIES.some((city) => safeLocationMatch(jobLoc, city))) return true;
    if (INDIAN_STATES.some((state) => safeLocationMatch(jobLoc, state))) return true;
  }

  // Country: United States
  if (US_COUNTRY_IDENTIFIERS.includes(f)) {
    if (US_COUNTRY_IDENTIFIERS.some((id) => safeLocationMatch(jobLoc, id))) return true;
    if (US_CITIES.some((city) => safeLocationMatch(jobLoc, city))) return true;
    if (/\b(ca|ny|wa|tx|il|ma|co|ga|fl|or|pa|nc|va|oh|mi|nj|az)\b/i.test(jobLoc)) return true;
  }

  // Country: United Kingdom
  if (UK_COUNTRY_IDENTIFIERS.includes(f)) {
    if (UK_COUNTRY_IDENTIFIERS.some((id) => safeLocationMatch(jobLoc, id))) return true;
    if (UK_CITIES.some((city) => safeLocationMatch(jobLoc, city))) return true;
  }

  // Country: Germany
  if (f === 'germany' || f === 'deutschland') {
    if (GERMANY_CITIES.some((c) => safeLocationMatch(jobLoc, c))) return true;
  }

  // Country: Canada
  if (f === 'canada') {
    if (CANADA_CITIES.some((c) => safeLocationMatch(jobLoc, c))) return true;
  }

  // Region: Europe
  if (f === 'europe' || f === 'eu' || f === 'emea') {
    if (EUROPE_REGIONS.some((c) => safeLocationMatch(jobLoc, c))) return true;
  }

  // Region: APAC / Asia
  if (f === 'apac' || f === 'asia') {
    if (APAC_REGIONS.some((c) => safeLocationMatch(jobLoc, c))) return true;
  }

  // Other Global Countries (e.g. Singapore, Australia, France, Japan, etc.)
  if (GLOBAL_COUNTRY_CITIES[f]) {
    if (GLOBAL_COUNTRY_CITIES[f].some((c) => safeLocationMatch(jobLoc, c))) return true;
  }

  return false;
}

/**
 * Helper to unpack aliases, parenthetical variations, and slashes in location filters.
 * e.g., "Kochi (Cochin)" -> ["kochi (cochin)", "kochi", "cochin"]
 * e.g., "Chandigarh / Mohali" -> ["chandigarh / mohali", "chandigarh", "mohali"]
 * e.g., "Delhi NCR (Gurgaon / Noida)" -> ["delhi ncr (gurgaon / noida)", "delhi ncr", "gurgaon / noida", "gurgaon", "noida"]
 */
export function extractLocationVariants(loc: string): string[] {
  const clean = loc.trim().toLowerCase();
  if (!clean) return [];
  const variants = new Set<string>();
  variants.add(clean);

  // Extract parentheses e.g. "kochi (cochin)" or "delhi ncr (gurgaon / noida)"
  const parenMatch = clean.match(/^([^(]+)\(([^)]+)\)(.*)$/);
  if (parenMatch) {
    const main = (parenMatch[1] + (parenMatch[3] || '')).trim();
    const inside = parenMatch[2].trim();
    if (main) variants.add(main);
    if (inside) {
      variants.add(inside);
      if (inside.includes('/') || inside.includes('|')) {
        for (const sub of inside.split(/[/|]+/)) {
          const s = sub.trim();
          if (s) variants.add(s);
        }
      }
    }
  }

  // Slashes check e.g. "chandigarh / mohali"
  if (clean.includes('/') || clean.includes('|')) {
    for (const sub of clean.split(/[/|]+/)) {
      const s = sub.trim();
      if (s) variants.add(s);
    }
  }

  return Array.from(variants);
}

/**
 * Evaluates whether a job matches a search location, supporting:
 * - City searches (Bengaluru, Bangalore, Pune, Mumbai, London, New York)
 * - Country searches (India, United States, UK, Germany, Canada, Australia)
 * - Alternative compound filters with '/' (e.g., "Delhi NCR / Gurgaon / Noida", "Chandigarh / Mohali")
 * - Hierarchical compound filters with ',' (e.g., "Bengaluru, Karnataka", "Kochi (Cochin), Kerala", "San Francisco, CA")
 * - Bi-directional synonym resolution and alias expansion
 */
export function matchesLocation(job: NormalizedJob, filterLocation: string): boolean {
  if (!filterLocation || !filterLocation.trim()) return true;

  const rawFilter = filterLocation.trim().toLowerCase();
  const jobLoc = (job.location || '').toLowerCase();
  const workplace = job.workplaceType ||
    (/\b(hybrid|partially remote)\b/i.test(jobLoc)
      ? 'hybrid'
      : job.isRemote || /\b(remote|telecommute|work from home)\b/i.test(jobLoc)
        ? 'remote'
        : jobLoc.trim()
          ? 'onsite'
          : 'unknown');
  const isRemote = workplace === 'remote';
  const isIndiaEligible = Boolean(job.isIndiaEligible);

  // 1. Direct atomic match with variant expansion
  const directVariants = extractLocationVariants(rawFilter);
  for (const variant of directVariants) {
    if (matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, variant)) {
      return true;
    }
  }

  // 2. Alternative options separated by slash or pipe (e.g. "Delhi NCR / Gurgaon / Noida", "Chandigarh / Mohali")
  if (rawFilter.includes('/') || rawFilter.includes('|')) {
    const parts = rawFilter
      .split(/[/|]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const partVariants = extractLocationVariants(part);
      for (const variant of partVariants) {
        if (matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, variant)) {
          return true;
        }
      }
    }
    return false;
  }

  // 3. Hierarchical City, State/Country separated by comma or semicolon (e.g. "Bengaluru, Karnataka", "Kochi (Cochin), Kerala", "San Francisco, CA")
  if (rawFilter.includes(',') || rawFilter.includes(';')) {
    const parts = rawFilter
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const cityPart = parts[0];
      const regionPart = parts[1];

      // A: If job matches any primary city variant (e.g., job in "Kochi, Kerala" matches "Kochi (Cochin), Kerala")
      const cityVariants = extractLocationVariants(cityPart);
      for (const variant of cityVariants) {
        if (matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, variant)) {
          return true;
        }
      }

      // B: If job does not specify a distinct competing city, but matches the specified state/country
      const hasKnownCity = [
        ...INDIAN_CITIES,
        ...US_CITIES,
        ...UK_CITIES,
        ...GERMANY_CITIES,
      ].some((c) => safeLocationMatch(jobLoc, c));

      const regionVariants = extractLocationVariants(regionPart);
      if (!hasKnownCity && regionVariants.some((r) => matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, r))) {
        return true;
      }

      return false;
    }
  }

  return false;
}

export function matchesType(job: NormalizedJob, filterType?: string): boolean {
  if (!filterType || !filterType.trim()) return true;
  const filter = filterType.trim().toLowerCase();
  const jobType = (job.employmentType || '').toLowerCase();

  if (filter === 'full-time' || filter === 'full time') {
    return (
      jobType.includes('full') ||
      jobType.includes('permanent') ||
      jobType.includes('regular')
    );
  }
  if (filter === 'contract' || filter === 'freelance') {
    return jobType.includes('contract') || jobType.includes('freelance') || jobType.includes('consult');
  }
  if (filter === 'part-time' || filter === 'part time') {
    return jobType.includes('part');
  }
  if (filter === 'internship' || filter === 'intern') {
    return jobType.includes('intern') || jobType.includes('trainee');
  }

  return jobType.includes(filter);
}

export function matchesLevel(job: NormalizedJob, filterLevel?: string): boolean {
  if (!filterLevel || !filterLevel.trim()) return true;
  const filter = filterLevel.trim().toLowerCase();
  const seniority = (job.seniority || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  const tags = (job.tags || []).map((t) => t.toLowerCase());

  if (filter === 'senior' || filter === 'sr') {
    if (
      seniority.includes('senior') ||
      seniority.includes('sr') ||
      seniority.includes('lead') ||
      seniority.includes('principal') ||
      seniority.includes('staff')
    ) {
      return true;
    }
    if (
      title.includes('senior') ||
      title.includes('sr.') ||
      title.includes('sr ') ||
      title.includes('lead') ||
      title.includes('principal') ||
      title.includes('staff')
    ) {
      return true;
    }
    if (tags.some((t) => t.includes('senior') || t.includes('lead'))) {
      return true;
    }
    return false;
  }

  if (filter === 'lead' || filter === 'principal' || filter === 'staff' || filter === 'manager') {
    if (
      seniority.includes('lead') ||
      seniority.includes('principal') ||
      seniority.includes('staff') ||
      seniority.includes('director') ||
      seniority.includes('vp') ||
      seniority.includes('manager')
    ) {
      return true;
    }
    if (
      title.includes('lead') ||
      title.includes('principal') ||
      title.includes('staff') ||
      title.includes('director') ||
      title.includes('head') ||
      title.includes('manager')
    ) {
      return true;
    }
    if (
      tags.some(
        (t) =>
          t.includes('lead') ||
          t.includes('principal') ||
          t.includes('staff') ||
          t.includes('manager')
      )
    ) {
      return true;
    }
    return false;
  }

  if (filter === 'entry' || filter === 'junior' || filter === 'jr') {
    if (
      seniority.includes('entry') ||
      seniority.includes('junior') ||
      seniority.includes('intern')
    ) {
      return true;
    }
    if (
      title.includes('junior') ||
      title.includes('jr.') ||
      title.includes('entry') ||
      title.includes('associate') ||
      title.includes('intern')
    ) {
      return true;
    }
    if (tags.some((t) => t.includes('junior') || t.includes('entry') || t.includes('intern'))) {
      return true;
    }
    return false;
  }

  if (filter === 'mid' || filter === 'intermediate') {
    if (seniority.includes('mid') || seniority.includes('intermediate')) {
      return true;
    }
    // Mid-level fallback if not explicitly senior, lead, or junior/intern
    if (
      !seniority.includes('senior') &&
      !seniority.includes('lead') &&
      !seniority.includes('intern') &&
      !title.includes('senior') &&
      !title.includes('lead') &&
      !title.includes('intern')
    ) {
      return true;
    }
    return false;
  }

  if (seniority.includes(filter)) return true;
  if (title.includes(filter)) return true;
  if (tags.some((t) => t.includes(filter))) return true;

  return false;
}

const ROLE_TITLE_SYNONYMS: Record<string, string[]> = {
  'frontend developer': [
    'frontend developer',
    'front end developer',
    'frontend engineer',
    'front end engineer',
    'ui developer',
    'web ui engineer',
  ],
  'frontend engineer': [
    'frontend engineer',
    'front end engineer',
    'frontend developer',
    'front end developer',
    'ui developer',
    'web ui engineer',
  ],
  'backend developer': [
    'backend developer',
    'backend engineer',
    'api developer',
    'server side developer',
  ],
  'backend engineer': [
    'backend engineer',
    'backend developer',
    'api developer',
    'server side developer',
  ],
  'full stack developer': ['full stack developer', 'fullstack developer', 'full stack engineer', 'fullstack engineer'],
  'data analyst': ['data analyst', 'bi analyst', 'business intelligence analyst', 'reporting analyst'],
  'data engineer': ['data engineer', 'etl engineer', 'data pipeline engineer'],
  teacher: ['teacher', 'school teacher', 'educator', 'teaching faculty', 'teaching staff'],
  accountant: ['accountant', 'financial accountant', 'accounts executive', 'chartered accountant'],
  'hr executive': ['hr executive', 'hr generalist', 'human resources executive'],
  'sales executive': ['sales executive', 'business development executive', 'sales representative'],
  'customer support': ['customer support', 'customer service representative', 'support executive'],
  'customer service': [
    'customer service',
    'customer support',
    'customer service representative',
    'support executive',
    'call center',
    'helpdesk',
  ],
  'react developer': [
    'react developer',
    'react engineer',
    'frontend developer',
    'frontend engineer',
    'front end developer',
    'front end engineer',
    'ui developer',
  ],
  'ui ux designer': ['ui ux designer', 'ux designer', 'ui designer', 'product designer'],
  'ui ux product designer': ['ui ux designer', 'ux designer', 'ui designer', 'product designer'],
};

function normalizeSearchPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phraseMatches(target: string, phrase: string): boolean {
  const normalizedTarget = normalizeSearchPhrase(target);
  const normalizedPhrase = normalizeSearchPhrase(phrase);
  return Boolean(normalizedPhrase) && ` ${normalizedTarget} `.includes(` ${normalizedPhrase} `);
}

function getRoleAlternatives(role: string): string[] {
  const cleanRole = normalizeSearchPhrase(role).replace(/^remote /, '');
  return ROLE_TITLE_SYNONYMS[cleanRole] || [cleanRole];
}

export function matchesRole(job: NormalizedJob, filterRole?: string): boolean {
  if (!filterRole?.trim()) return true;

  const role = normalizeSearchPhrase(filterRole).replace(/^remote /, '');
  if (!role || role === 'remote' || role.startsWith('all remote ')) return true;

  const title = normalizeSearchPhrase(job.title || '');
  const tags = (job.tags || []).map(normalizeSearchPhrase);
  const alternatives = getRoleAlternatives(role);

  if (alternatives.some((alternative) => phraseMatches(title, alternative))) return true;
  if (alternatives.some((alternative) => tags.some((tag) => phraseMatches(tag, alternative)))) return true;

  const roleTokens = role.split(' ').filter(Boolean);
  return roleTokens.length > 0 && roleTokens.every((token) => title.split(' ').includes(token));
}

/**
 * Evaluates whether a job matches a search query.
 * Distinguishes role tokens from location tokens so that:
 * 1. Role keywords (e.g. "React Developer") are strictly required when present.
 * 2. Location keywords (e.g. "Bangalore" in "React Developer Bangalore") confer a
 *    major geographic ranking boost (+25) when matched, without allowing irrelevant
 *    roles (e.g. an accountant) to show up.
 * 3. Pure location queries (e.g. user typed "Bangalore" alone) return all jobs in that location.
 */
export function matchesQuery(
  job: NormalizedJob,
  query?: string
): { matches: boolean; baseScore: number } {
  if (!query || !query.trim()) {
    return { matches: true, baseScore: 10 };
  }

  const parsed = parseQueryTokens(query);
  const title = normalizeSearchPhrase(job.title || '');
  const company = normalizeSearchPhrase(job.company || '');
  const tags = (job.tags || []).map(normalizeSearchPhrase);
  const description = normalizeSearchPhrase(job.description || '');
  const category = normalizeSearchPhrase(`${job.industry || ''} ${job.category || ''}`);
  const queryPhrase = normalizeSearchPhrase(parsed.rolePhrase);
  const queryTokens = Array.from(new Set(queryPhrase.split(' ').filter(Boolean)));

  if (parsed.hasRoleTokens) {
    let score = 0;
    const titleAliases = getRoleAlternatives(queryPhrase);
    const exactTitleMatch = phraseMatches(title, queryPhrase);
    const aliasTitleMatch = titleAliases.some((alias) => phraseMatches(title, alias));
    const allTitleTokensMatch =
      queryTokens.length > 0 && queryTokens.every((token) => title.split(' ').includes(token));
    const allTitleOrTagTokensMatch =
      queryTokens.length > 0 &&
      queryTokens.every((token) => title.split(' ').includes(token) || tags.some((tag) => tag.split(' ').includes(token)));

    if (exactTitleMatch) {
      score = 180;
    } else if (aliasTitleMatch) {
      score = 145;
    } else if (allTitleTokensMatch) {
      score = 130;
    } else if (allTitleOrTagTokensMatch) {
      score = 85 + queryTokens.filter((token) => title.split(' ').includes(token)).length * 10;
    } else if (queryTokens.every((token) => company.split(' ').includes(token))) {
      score = 55;
    } else if (queryTokens.every((token) => category.split(' ').includes(token))) {
      score = 50;
    } else if (phraseMatches(description, queryPhrase)) {
      score = 18;
    } else if (queryTokens.length === 1) {
      const token = queryTokens[0];
      const contextualSynonyms = ROLE_CONTEXTUAL_MAPPINGS[token] || [];
      if (contextualSynonyms.some((synonym) => phraseMatches(title, synonym))) {
        score = 70;
      } else if (contextualSynonyms.some((synonym) => tags.some((tag) => phraseMatches(tag, synonym)))) {
        score = 55;
      } else if (tags.some((tag) => tag.split(' ').includes(token))) {
        score = 90;
      } else if (title.split(' ').includes(token)) {
        score = 110;
      } else if (company.split(' ').includes(token)) {
        score = 45;
      } else if (description.split(' ').includes(token)) {
        score = 12;
      }
    }

    if (score === 0) return { matches: false, baseScore: 0 };
    if (
      parsed.hasLocationTokens &&
      !parsed.locationTokens.some((location) => matchesLocation(job, location))
    ) {
      return { matches: false, baseScore: 0 };
    }
    if (parsed.hasLocationTokens) score += 15;
    return { matches: true, baseScore: score };
  }

  // Case 2: Query contains NO role tokens, but HAS location tokens (e.g. "Bangalore", "India", "San Francisco")
  if (parsed.hasLocationTokens) {
    const matchesLoc = parsed.locationTokens.some((loc) => matchesLocation(job, loc));
    if (matchesLoc) {
      return { matches: true, baseScore: 25 };
    }
    return { matches: false, baseScore: 0 };
  }

  // Case 3: Empty query or stop words only
  return { matches: true, baseScore: 10 };
}

// ============================================================================
// Comprehensive Contextual Role Mappings Across All Major Industries
// ============================================================================

export const ROLE_CONTEXTUAL_MAPPINGS: Record<string, string[]> = {
  // Web & Frontend
  react: ['frontend', 'front end', 'javascript', 'typescript', 'nextjs', 'next.js', 'ui developer', 'web developer', 'react native'],
  nextjs: ['react', 'frontend', 'javascript', 'typescript', 'fullstack', 'full stack', 'web developer'],
  vue: ['frontend', 'javascript', 'typescript', 'nuxt', 'web developer', 'ui engineer'],
  angular: ['frontend', 'typescript', 'javascript', 'web developer', 'ui engineer'],
  frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'nextjs', 'ui engineer', 'web developer', 'html', 'css'],
  
  // Backend & Languages
  backend: ['node', 'nodejs', 'python', 'java', 'golang', 'go', 'c#', '.net', 'rust', 'c++', 'django', 'fastapi', 'spring boot', 'express'],
  node: ['nodejs', 'backend', 'javascript', 'typescript', 'express', 'nest', 'nestjs', 'api developer'],
  python: ['backend', 'django', 'fastapi', 'flask', 'data science', 'machine learning', 'data engineer', 'automation'],
  java: ['backend', 'spring', 'spring boot', 'microservices', 'enterprise', 'j2ee', 'kotlin'],
  golang: ['backend', 'go', 'microservices', 'cloud', 'systems', 'distributed systems'],
  'c++': ['embedded', 'systems', 'gaming', 'high frequency', 'backend', 'c/c++'],
  rust: ['systems', 'backend', 'blockchain', 'infrastructure', 'webassembly'],
  
  // Full Stack
  fullstack: ['full stack', 'frontend', 'backend', 'react', 'node', 'javascript', 'typescript', 'python', 'mern', 'mean'],
  'full stack': ['fullstack', 'frontend', 'backend', 'react', 'node', 'web developer'],
  
  // Mobile
  mobile: ['react native', 'flutter', 'ios', 'android', 'swift', 'kotlin', 'mobile developer'],
  ios: ['swift', 'objective-c', 'mobile', 'ios developer', 'xcode'],
  android: ['kotlin', 'java', 'mobile', 'android developer', 'android sdk'],
  flutter: ['mobile', 'dart', 'cross-platform', 'app developer'],
  
  // Cloud, DevOps & Infrastructure
  devops: ['cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'k8s', 'docker', 'terraform', 'ci/cd', 'sre', 'site reliability'],
  cloud: ['aws', 'azure', 'gcp', 'cloud architect', 'devops', 'infrastructure', 'serverless'],
  aws: ['cloud', 'devops', 'amazon web services', 'ec2', 's3', 'lambda', 'terraform'],
  azure: ['cloud', 'devops', 'microsoft azure', 'azure devops'],
  sre: ['site reliability', 'devops', 'infrastructure', 'kubernetes', 'observability', 'monitoring'],
  
  // Data, AI & Machine Learning
  data: ['data engineer', 'data analyst', 'data scientist', 'analytics', 'sql', 'python', 'bi', 'etl', 'big data'],
  'data engineer': ['etl', 'spark', 'sql', 'python', 'pipeline', 'snowflake', 'databricks', 'kafka', 'bigquery', 'data'],
  'data analyst': ['sql', 'excel', 'tableau', 'power bi', 'analytics', 'reporting', 'business intelligence', 'data'],
  'data scientist': ['machine learning', 'python', 'statistics', 'deep learning', 'pandas', 'modeling', 'data science'],
  ai: ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'nlp', 'llm', 'genai', 'computer vision'],
  'machine learning': ['ml', 'ai', 'deep learning', 'pytorch', 'tensorflow', 'nlp', 'model'],
  
  // QA & Testing
  qa: ['quality assurance', 'test engineer', 'automation', 'sdet', 'manual testing', 'selenium', 'cypress', 'testing'],
  sdet: ['qa', 'test automation', 'software development engineer in test', 'selenium', 'automation testing'],
  
  // Cybersecurity
  security: ['cybersecurity', 'infosec', 'penetration testing', 'soc', 'threat intelligence', 'vulnerability', 'ciso'],
  cybersecurity: ['security', 'infosec', 'soc analyst', 'network security', 'application security'],
  
  // Product, Design & Management
  product: ['product manager', 'pm', 'product owner', 'product analyst', 'product strategy'],
  'product manager': ['pm', 'product owner', 'agile', 'scrum', 'roadmap', 'product strategy'],
  design: ['ui', 'ux', 'product designer', 'ui/ux', 'figma', 'interaction designer', 'visual designer'],
  'ui/ux': ['product designer', 'ux designer', 'ui designer', 'figma', 'user experience', 'design'],
  
  // Healthcare & Life Sciences
  healthcare: ['medical', 'hospital', 'nurse', 'clinical', 'doctor', 'patient care', 'health', 'clinic'],
  medical: ['healthcare', 'physician', 'doctor', 'clinical', 'radiologist', 'surgeon', 'hospital'],
  nurse: ['nursing', 'healthcare', 'registered nurse', 'patient care', 'rn', 'clinical nurse'],
  doctor: ['physician', 'medical officer', 'specialist', 'surgeon', 'resident', 'consultant'],
  pharmacy: ['pharmacist', 'chemist', 'pharma', 'clinical research', 'drug safety'],
  
  // Education & Academics
  education: ['teacher', 'faculty', 'professor', 'lecturer', 'instructor', 'tutor', 'trainer', 'academic'],
  teacher: ['educator', 'instructor', 'school', 'faculty', 'teaching', 'tutor', 'curriculum'],
  professor: ['faculty', 'assistant professor', 'lecturer', 'academic', 'research scholar'],
  
  // Finance, Banking & Accounting
  finance: ['financial analyst', 'accounting', 'investment', 'banking', 'fintech', 'portfolio', 'wealth'],
  accounting: ['accountant', 'ca', 'chartered accountant', 'audit', 'tax', 'bookkeeper', 'payroll', 'gst'],
  ca: ['chartered accountant', 'audit', 'taxation', 'statutory audit', 'internal audit', 'accounting'],
  banking: ['investment banking', 'retail banking', 'credit analyst', 'loan officer', 'relationship manager'],
  
  // Construction, Architecture & Engineering
  construction: ['civil engineer', 'site engineer', 'project engineer', 'builder', 'structural', 'contractor'],
  civil: ['civil engineer', 'structural engineer', 'construction', 'site supervisor', 'autocad'],
  mechanical: ['mechanical engineer', 'design engineer', 'hvac', 'thermal', 'cad', 'manufacturing'],
  electrical: ['electrical engineer', 'electrician', 'power systems', 'electronics', 'circuit'],
  architecture: ['architect', 'interior designer', 'cad', 'revit', 'urban planning', 'bim'],
  
  // Manufacturing, Operations & Logistics
  manufacturing: ['production engineer', 'plant manager', 'quality engineer', 'machinist', 'industrial engineer'],
  logistics: ['supply chain', 'warehouse', 'procurement', 'inventory', 'dispatch', 'freight', 'transport'],
  'supply chain': ['procurement', 'logistics', 'inventory management', 'sourcing', 'vendor management'],
  
  // HR, Admin & Operations
  hr: ['human resources', 'recruiter', 'talent acquisition', 'people operations', 'hrbp', 'hiring', 'payroll'],
  recruiter: ['talent acquisition', 'technical recruiter', 'sourcing', 'recruitment', 'hr executive'],
  operations: ['operations manager', 'coo', 'business operations', 'process improvement', 'ops'],
  
  // Sales, Marketing & Business Development
  sales: ['business development', 'bde', 'bdm', 'account executive', 'inside sales', 'sales executive', 'sales manager'],
  marketing: ['digital marketing', 'growth', 'seo', 'sem', 'content marketing', 'brand manager', 'performance marketing'],
  bde: ['business development executive', 'sales', 'lead generation', 'inside sales', 'client acquisition'],
  
  // Customer Support & BPO
  support: ['customer support', 'customer service', 'technical support', 'helpdesk', 'customer success', 'bpo'],
  customer: ['customer support', 'customer service', 'support', 'helpdesk', 'call center'],
  service: ['customer service', 'customer support', 'client services', 'helpdesk'],
  'customer service': ['customer support', 'call center', 'helpdesk', 'voice process', 'chat support'],
  'customer support': ['customer service', 'helpdesk', 'technical support', 'call center', 'bpo'],
};

// ============================================================================
// Company Normalization & Matching
// ============================================================================

export const COMPANY_ALIASES: Record<string, string[]> = {
  tcs: ['tata consultancy services', 'tata consultancy'],
  tata: ['tata consultancy services', 'tcs', 'tata elxsi', 'tata motors', 'tata digital'],
  infosys: ['infosys limited', 'infy'],
  wipro: ['wipro limited', 'wipro technologies'],
  hcl: ['hcl technologies', 'hcltech'],
  accenture: ['accenture solutions'],
  cognizant: ['cognizant technology solutions', 'cts'],
  google: ['alphabet', 'google llc', 'google cloud'],
  meta: ['facebook', 'meta platforms'],
  amazon: ['aws', 'amazon web services', 'amazon.com'],
  aws: ['amazon web services', 'amazon'],
  microsoft: ['msft', 'microsoft corporation'],
  apple: ['apple inc.'],
  netflix: ['netflix, inc.'],
  uber: ['uber technologies'],
  flipkart: ['flipkart internet'],
  zomato: ['zomato limited', 'blinkit'],
  swiggy: ['bundl technologies', 'swiggy'],
  paytm: ['one97 communications', 'paytm'],
  ola: ['ani technologies', 'ola cabs'],
};

/**
 * Normalizes a company name by stripping legal suffixes and punctuation.
 */
export function normalizeCompanyName(company: string): string {
  if (!company) return '';
  return company
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|limited|pvt|private|co|company|technologies|solutions|services|group|holdings)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches a job's employer against a requested company filter string.
 * Supports exact matching, token containment, legal name variations, and alias expansions.
 */
export function matchesCompany(job: NormalizedJob, filterCompany?: string): boolean {
  if (!filterCompany || !filterCompany.trim()) return true;
  const target = filterCompany.trim().toLowerCase();
  const rawJobCompany = (job.company || '').toLowerCase();

  // 1. Direct raw check
  if (rawJobCompany.includes(target) || target.includes(rawJobCompany)) {
    return true;
  }

  // 2. Normalized check (without legal entity noise)
  const normTarget = normalizeCompanyName(target);
  const normJobComp = normalizeCompanyName(rawJobCompany);
  if (normTarget && normJobComp) {
    if (normJobComp.includes(normTarget) || normTarget.includes(normJobComp)) {
      return true;
    }
  }

  // 3. Known Company Aliases (e.g. TCS <-> Tata Consultancy Services, AWS <-> Amazon, Meta <-> Facebook)
  for (const [key, aliases] of Object.entries(COMPANY_ALIASES)) {
    const allGroupNames = [key, ...aliases].map((n) => normalizeCompanyName(n));
    const targetInGroup = allGroupNames.some((n) => normTarget === n || normTarget.includes(n) || n.includes(normTarget));
    if (targetInGroup) {
      const jobInGroup = allGroupNames.some((n) => normJobComp === n || normJobComp.includes(n) || n.includes(normJobComp));
      if (jobInGroup) {
        return true;
      }
    }
  }

  return false;
}

export function matchesRemote(job: NormalizedJob, filterRemote?: string): boolean {
  if (!filterRemote || !filterRemote.trim()) return true;
  const filter = filterRemote.trim().toLowerCase();
  const loc = (job.location || '').toLowerCase();
  const workplace = job.workplaceType ||
    (/\b(hybrid|partially remote)\b/i.test(loc)
      ? 'hybrid'
      : job.isRemote || /\b(remote|telecommute|work from home)\b/i.test(loc)
        ? 'remote'
        : loc.trim()
          ? 'onsite'
          : 'unknown');

  if (filter === 'remote') {
    return workplace === 'remote';
  }
  if (filter === 'onsite' || filter === 'on-site') {
    return workplace === 'onsite';
  }
  if (filter === 'hybrid') {
    return workplace === 'hybrid';
  }
  if (filter === 'remote_india') {
    return workplace === 'remote' && Boolean(job.isIndiaEligible);
  }
  if (filter === 'remote_worldwide') {
    return (
      workplace === 'remote' &&
      (loc.includes('worldwide') ||
        loc.includes('anywhere in the world') ||
        loc.includes('global') ||
        loc.includes('open to all countries'))
    );
  }

  return true;
}

export function matchesIndustry(job: NormalizedJob, filterIndustry?: string): boolean {
  const target = normalizeIndustryFilter(filterIndustry);
  if (target === '') return true;
  if (!target) return false;
  return resolveJobIndustry(
    job.industry,
    job.category,
    job.title,
    job.tags,
    job.description
  ) === target;
}

export function filterAndRankJobs(
  jobs: NormalizedJob[],
  params: JobSearchParams
): NormalizedJob[] {
  const query = params.query || '';
  const role = params.role || '';
  const company = params.company || '';
  const location = params.location || '';
  const type = params.type || '';
  const level = params.level || '';
  const remote = params.remote || '';
  const industry = params.industry || '';
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const filtered: NormalizedJob[] = [];

  for (const job of jobs) {
    // Independent keyword and selected-role dimensions must both match.
    const queryResult = matchesQuery(job, query);
    if (!queryResult.matches) continue;
    if (!matchesRole(job, role)) continue;

    // 2. Check company filter
    if (!matchesCompany(job, company)) continue;

    // 3. Check location (City, Country, Region, Synonyms, Compound parts)
    if (!matchesLocation(job, location)) continue;

    // 4. Check remote / workplace model
    if (!matchesRemote(job, remote)) continue;

    // 5. Check employment type
    if (!matchesType(job, type)) continue;

    // 6. Check seniority level
    if (!matchesLevel(job, level)) continue;

    // 7. Check industry taxonomy
    if (!matchesIndustry(job, industry)) continue;

    let score = queryResult.baseScore;
    if (role) score += 100;

    // Company filter match boost
    if (company && matchesCompany(job, company)) {
      score += 25;
    }

    // Bounded location boost when explicit location filter is set
    if (location && matchesLocation(job, location)) {
      score += 15;
    }

    // India boost: Only if query is already relevant or browsing without query
    if (job.isIndiaEligible) {
      score += 15;
    }

    // Freshness boost
    const pubTime = new Date(job.publishedAt).getTime();
    if (!isNaN(pubTime)) {
      const ageDays = (now - pubTime) / ONE_DAY_MS;
      if (ageDays <= 7) {
        score += 8;
      } else if (ageDays <= 30) {
        score += 3;
      }
    }

    filtered.push({
      ...job,
      score,
    });
  }

  // Deterministic sorting: Score descending, then publishedAt descending
  filtered.sort((a, b) => {
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    const timeA = new Date(a.publishedAt).getTime() || 0;
    const timeB = new Date(b.publishedAt).getTime() || 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.id.localeCompare(b.id);
  });

  // When browsing the unconstrained discovery feed (no query, no specific industry or company filters),
  // interleave top-scoring listings across distinct canonical industries so that all types of job seekers
  // see diverse opportunities across sectors on the landing screen.
  const isUnconstrained =
    !query &&
    !role &&
    !company &&
    !location &&
    !type &&
    !level &&
    !remote &&
    (!industry || industry === 'all');

  if (isUnconstrained && filtered.length > 2) {
    return interleaveIndustries(filtered);
  }

  return filtered;
}

/**
 * Interleaves jobs round-robin across distinct canonical industries while preserving
 * quality ranking within each industry group.
 */
function interleaveIndustries(jobs: NormalizedJob[]): NormalizedJob[] {
  const groups = new Map<string, NormalizedJob[]>();

  for (const job of jobs) {
    const ind = job.industry || 'other';
    const list = groups.get(ind);
    if (list) {
      list.push(job);
    } else {
      groups.set(ind, [job]);
    }
  }

  const result: NormalizedJob[] = [];
  const groupArrays = Array.from(groups.values());
  let maxLen = 0;
  for (const arr of groupArrays) {
    if (arr.length > maxLen) maxLen = arr.length;
  }

  for (let i = 0; i < maxLen; i++) {
    for (const arr of groupArrays) {
      if (i < arr.length) {
        result.push(arr[i]);
      }
    }
  }

  return result;
}
