import { NormalizedJob, JobSearchParams } from './job.types';

export const INDIAN_CITIES = [
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
  'thiruvananthapuram',
  'trivandrum',
  'kochi',
  'cochin',
  'chandigarh',
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
  'nagpur',
  'visakhapatnam',
  'vizag',
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
  mumbai: ['bombay'],
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
    if (COMMON_STOP_WORDS.has(word)) {
      continue;
    }
    if (isKnownLocation(word)) {
      locationTokens.push(word);
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

  // Remote / Worldwide check
  if (
    f === 'remote' ||
    f === 'remote (worldwide)' ||
    f === 'worldwide' ||
    f === 'global' ||
    f === 'anywhere in the world' ||
    f === 'anywhere'
  ) {
    if (isRemote) return true;
    if (
      jobLoc.includes('remote') ||
      jobLoc.includes('worldwide') ||
      jobLoc.includes('anywhere in the world') ||
      jobLoc.includes('global') ||
      jobLoc.includes('anywhere')
    ) {
      return true;
    }
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
 * Evaluates whether a job matches a search location, supporting:
 * - City searches (Bengaluru, Bangalore, Pune, Mumbai, London, New York)
 * - Country searches (India, United States, UK, Germany, Canada, Australia)
 * - Alternative compound filters with '/' (e.g., "Delhi NCR / Gurgaon / Noida")
 * - Hierarchical compound filters with ',' (e.g., "Bengaluru, Karnataka", "San Francisco, CA")
 * - Bi-directional synonym resolution
 */
export function matchesLocation(job: NormalizedJob, filterLocation: string): boolean {
  if (!filterLocation || !filterLocation.trim()) return true;

  const rawFilter = filterLocation.trim().toLowerCase();
  const jobLoc = (job.location || '').toLowerCase();
  const isRemote = Boolean(job.isRemote || job.workplaceType === 'remote');
  const isIndiaEligible = Boolean(job.isIndiaEligible);

  // 1. Direct atomic match
  if (matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, rawFilter)) {
    return true;
  }

  // 2. Alternative options separated by slash or pipe (e.g. "Delhi NCR / Gurgaon / Noida")
  if (rawFilter.includes('/') || rawFilter.includes('|')) {
    const parts = rawFilter
      .split(/[/|]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, part)) {
        return true;
      }
    }
    return false;
  }

  // 3. Hierarchical City, State/Country separated by comma or semicolon (e.g. "Bengaluru, Karnataka", "San Francisco, CA")
  if (rawFilter.includes(',') || rawFilter.includes(';')) {
    const parts = rawFilter
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const cityPart = parts[0];
      const regionPart = parts[1];

      // A: If job matches the primary city (e.g., job in "Bengaluru, India" matches "Bengaluru, Karnataka")
      if (matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, cityPart)) {
        return true;
      }

      // B: If job does not specify a distinct competing city, but matches the specified state/country
      const hasKnownCity = [
        ...INDIAN_CITIES,
        ...US_CITIES,
        ...UK_CITIES,
        ...GERMANY_CITIES,
      ].some((c) => safeLocationMatch(jobLoc, c));

      if (!hasKnownCity && matchesSingleLocation(jobLoc, isRemote, isIndiaEligible, regionPart)) {
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
  const title = (job.title || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const tags = (job.tags || []).map((t) => t.toLowerCase());
  const desc = (job.description || '').toLowerCase();

  let score = 0;

  // Case 1: Query contains role tokens (e.g. "React Developer", "React Developer Bangalore")
  if (parsed.hasRoleTokens) {
    let hasRoleMatch = false;

    // Exact role phrase match in title
    if (parsed.rolePhrase && title.includes(parsed.rolePhrase)) {
      score += 35;
      hasRoleMatch = true;
    }

    // Individual role tokens match across title, tags, company, description
    for (const token of parsed.roleTokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      if (regex.test(title)) {
        score += 15;
        hasRoleMatch = true;
      } else if (tags.some((t) => regex.test(t))) {
        score += 10;
        hasRoleMatch = true;
      } else if (regex.test(company)) {
        score += 8;
        hasRoleMatch = true;
      } else if (regex.test(desc)) {
        score += 2;
        hasRoleMatch = true;
      }
    }

    // If query specified roles/skills, this job MUST match at least one role token!
    if (!hasRoleMatch) {
      return { matches: false, baseScore: 0 };
    }

    // If query ALSO included location terms (e.g. "React Developer Bangalore"),
    // confer a high geographic boost when the location matches.
    if (parsed.hasLocationTokens) {
      const matchesAnyLocationToken = parsed.locationTokens.some((loc) =>
        matchesLocation(job, loc)
      );
      if (matchesAnyLocationToken) {
        score += 25;
      }
    }

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

export function matchesRemote(job: NormalizedJob, filterRemote?: string): boolean {
  if (!filterRemote || !filterRemote.trim()) return true;
  const filter = filterRemote.trim().toLowerCase();
  const loc = (job.location || '').toLowerCase();

  if (filter === 'remote') {
    return (
      job.isRemote === true ||
      job.workplaceType === 'remote' ||
      loc.includes('remote')
    );
  }
  if (filter === 'onsite' || filter === 'on-site') {
    return (
      job.workplaceType === 'onsite' ||
      (!job.isRemote &&
        job.workplaceType !== 'hybrid' &&
        !loc.includes('remote') &&
        !loc.includes('hybrid'))
    );
  }
  if (filter === 'hybrid') {
    return job.workplaceType === 'hybrid' || loc.includes('hybrid');
  }
  if (filter === 'remote_india') {
    return (
      (job.isRemote === true || job.workplaceType === 'remote') &&
      Boolean(job.isIndiaEligible)
    );
  }
  if (filter === 'remote_worldwide') {
    return (
      (job.isRemote === true || job.workplaceType === 'remote') &&
      (loc.includes('worldwide') ||
        loc.includes('anywhere in the world') ||
        loc === 'remote' ||
        Boolean(job.isIndiaEligible))
    );
  }

  return true;
}

export function filterAndRankJobs(
  jobs: NormalizedJob[],
  params: JobSearchParams
): NormalizedJob[] {
  const query = params.query || '';
  const location = params.location || '';
  const type = params.type || '';
  const level = params.level || '';
  const remote = params.remote || '';
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const filtered: NormalizedJob[] = [];

  for (const job of jobs) {
    // 1. Check keyword/role
    const queryResult = matchesQuery(job, query);
    if (!queryResult.matches) continue;

    // 2. Check location (City, Country, Region, Synonyms, Compound parts)
    if (!matchesLocation(job, location)) continue;

    // 3. Check remote / workplace model
    if (!matchesRemote(job, remote)) continue;

    // 4. Check employment type
    if (!matchesType(job, type)) continue;

    // 5. Check seniority level
    if (!matchesLevel(job, level)) continue;

    let score = queryResult.baseScore;

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
    return timeB - timeA;
  });

  return filtered;
}
