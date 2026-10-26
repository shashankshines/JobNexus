import { NormalizedJob, JobSearchParams } from './job.types';

const INDIAN_CITIES = [
  'bangalore',
  'bengaluru',
  'delhi',
  'mumbai',
  'pune',
  'hyderabad',
  'chennai',
  'noida',
  'gurgaon',
  'gurugram',
  'kolkata',
  'ahmedabad',
  'thiruvananthapuram',
  'kochi',
  'chandigarh',
  'jaipur',
  'indore',
  'lucknow',
];

const SYNONYMS: Record<string, string> = {
  bangalore: 'bengaluru',
  bengaluru: 'bangalore',
  gurgaon: 'gurugram',
  gurugram: 'gurgaon',
  bombay: 'mumbai',
  mumbai: 'bombay',
  madras: 'chennai',
  chennai: 'madras',
  calcutta: 'kolkata',
  kolkata: 'calcutta',
};

function matchesLocation(job: NormalizedJob, filterLocation: string): boolean {
  if (!filterLocation) return true;
  const filter = filterLocation.trim().toLowerCase();
  const jobLoc = (job.location || '').toLowerCase();

  // Direct substring match
  if (jobLoc.includes(filter)) return true;

  // Synonyms check
  if (SYNONYMS[filter] && jobLoc.includes(SYNONYMS[filter])) return true;

  // If filter is 'india', check all major Indian cities or explicit eligibility
  if (filter === 'india') {
    if (job.isIndiaEligible) return true;
    return INDIAN_CITIES.some((city) => jobLoc.includes(city));
  }

  // If filter is 'remote', check if remote
  if (filter === 'remote' && job.isRemote) return true;

  return false;
}

function matchesType(job: NormalizedJob, filterType?: string): boolean {
  if (!filterType) return true;
  const filter = filterType.trim().toLowerCase();
  const jobType = (job.employmentType || '').toLowerCase();
  return jobType.includes(filter);
}

function matchesLevel(job: NormalizedJob, filterLevel?: string): boolean {
  if (!filterLevel) return true;
  const filter = filterLevel.trim().toLowerCase();
  const seniority = (job.seniority || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  const tags = (job.tags || []).map((t) => t.toLowerCase());

  if (seniority.includes(filter)) return true;
  if (title.includes(filter)) return true;
  if (tags.some((t) => t.includes(filter))) return true;

  return false;
}

function matchesQuery(job: NormalizedJob, query?: string): { matches: boolean; baseScore: number } {
  if (!query || !query.trim()) {
    return { matches: true, baseScore: 10 };
  }

  const cleanQuery = query.trim().toLowerCase();
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  const title = (job.title || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const tags = (job.tags || []).map((t) => t.toLowerCase());
  const desc = (job.description || '').toLowerCase();

  let score = 0;
  let hasAnyMatch = false;

  // Exact phrase match in title
  if (title.includes(cleanQuery)) {
    score += 30;
    hasAnyMatch = true;
  }

  // Individual token matches
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');

    if (regex.test(title)) {
      score += 15;
      hasAnyMatch = true;
    } else if (tags.some((t) => regex.test(t))) {
      score += 10;
      hasAnyMatch = true;
    } else if (regex.test(company)) {
      score += 6;
      hasAnyMatch = true;
    } else if (regex.test(desc)) {
      score += 2;
      hasAnyMatch = true;
    }
  }

  // If multi-token query, ensure at least one token matched
  if (!hasAnyMatch && tokens.length > 0) {
    return { matches: false, baseScore: 0 };
  }

  return { matches: true, baseScore: score };
}

function matchesRemote(job: NormalizedJob, filterRemote?: string): boolean {
  if (!filterRemote) return true;
  const filter = filterRemote.trim().toLowerCase();

  if (filter === 'remote') {
    return job.isRemote === true || job.workplaceType === 'remote';
  }
  if (filter === 'onsite') {
    return job.workplaceType === 'onsite' || (!job.isRemote && job.workplaceType !== 'hybrid');
  }
  if (filter === 'hybrid') {
    return job.workplaceType === 'hybrid' || (job.location || '').toLowerCase().includes('hybrid');
  }
  if (filter === 'remote_india') {
    return job.isRemote === true && Boolean(job.isIndiaEligible);
  }
  if (filter === 'remote_worldwide') {
    const loc = (job.location || '').toLowerCase();
    return (
      job.isRemote === true &&
      (loc.includes('worldwide') || loc.includes('anywhere in the world') || loc === 'remote')
    );
  }

  return true;
}

export function filterAndRankJobs(jobs: NormalizedJob[], params: JobSearchParams): NormalizedJob[] {
  const query = params.query || '';
  const location = params.location || '';
  const type = params.type || '';
  const level = params.level || '';
  const remote = params.remote || '';
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const filtered: NormalizedJob[] = [];

  for (const job of jobs) {
    // Check keyword
    const queryResult = matchesQuery(job, query);
    if (!queryResult.matches) continue;

    // Check location
    if (!matchesLocation(job, location)) continue;

    // Check remote / workplace model
    if (!matchesRemote(job, remote)) continue;

    // Check type
    if (!matchesType(job, type)) continue;

    // Check level
    if (!matchesLevel(job, level)) continue;

    let score = queryResult.baseScore;

    // Bounded location boost
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
