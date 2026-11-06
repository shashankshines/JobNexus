export interface NormalizedJob {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  description: string;
  applicationUrl: string;
  sourceUrl?: string;
  publishedAt: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  employmentType: string;
  seniority?: string;
  tags: string[];
  status?: 'active' | 'expired' | 'withdrawn' | 'unknown';
  expiresAt?: string;
  isIndiaEligible?: boolean;
  workplaceType?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  primaryWorkplaceType?: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'UNSPECIFIED';
  remoteEligibility?:
    | 'worldwide'
    | 'india_remote'
    | 'country_specific'
    | 'region_specific'
    | 'timezone_restricted'
    | 'unspecified';
  score?: number;
  alternateSources?: Array<{ sourceName: string; sourceUrl?: string; applicationUrl: string }>;
  salary?: string;
  industry?: string;
  category?: string;
}

export interface JobSearchParams {
  query?: string;
  role?: string;
  company?: string;
  location?: string;
  type?: string;
  level?: string;
  remote?: string;
  industry?: string;
  sort?: 'relevance' | 'date';
  page?: number;
  pageSize?: number;
  limit?: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

export interface LegacyJob {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  date: string;
  source: string;
  tags: string[];
  description: string;
  score?: number;
  isRemote?: boolean;
  workplaceType?: string;
  primaryWorkplaceType?: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'UNSPECIFIED';
  remoteEligibility?: string;
  isIndiaEligible?: boolean;
  isFresh?: boolean;
  salary?: string;
  industry?: string;
  category?: string;
}

export interface ProviderDiagnostic {
  providerId: string;
  providerName: string;
  status: 'fulfilled' | 'rejected' | 'timeout';
  fetchedCount: number;
  latencyMs: number;
  error?: string;
}

export interface ProviderCoverage {
  configured: number;
  succeeded: number;
  failed?: number;
  incomplete: boolean;
  catalogueSourceCoverage?: number;
}

export interface JobSearchResponse {
  jobs: LegacyJob[];
  /** Total matching jobs in the current normalized provider snapshot. */
  count: number;
  /** Total unique jobs in the current normalized provider snapshot. */
  totalAvailable: number;
  /** Stable fingerprint of the ordered matching jobs for consistent pagination. */
  snapshotId: string;
  returnedCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  truncated: boolean;
  providerCoverage: ProviderCoverage;
  sources: string[];
  diagnostics?: ProviderDiagnostic[];
}

export interface JobStatsResponse {
  totalJobs: number;
  formattedCount: string;
  exactCount: number;
  providerCoverage: ProviderCoverage;
  remoteJobs: number;
  indiaEligibleJobs: number;
  sources: string[];
  sourcesCount: number;
  providerBreakdown: Record<string, number>;
  lastUpdated: string;
  itCount?: number;
  nonItCount?: number;
  workplaceDistribution?: {
    remote: number;
    hybrid: number;
    onsite: number;
  };
  sourceCoverage?: {
    total: number;
    itSources: number;
    nonItSources: number;
  };
}

export function isJobActive(job: NormalizedJob): boolean {
  if (!job) return false;
  if (job.status === 'expired' || job.status === 'withdrawn') return false;
  if (job.expiresAt) {
    const exp = new Date(job.expiresAt).getTime();
    if (!isNaN(exp) && exp < Date.now()) return false;
  }
  return true;
}

export function toLegacyJob(job: NormalizedJob): LegacyJob {
  const publishedTime = job.publishedAt ? new Date(job.publishedAt).getTime() : 0;
  const isFresh = publishedTime > 0 ? Date.now() - publishedTime < 4 * 24 * 60 * 60 * 1000 : false;

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    type: job.employmentType,
    url: job.applicationUrl,
    date: job.publishedAt,
    source: job.sourceName,
    tags: job.tags,
    description: job.description,
    score: job.score,
    isRemote: job.isRemote,
    workplaceType: job.workplaceType ?? (job.isRemote ? 'remote' : job.location?.trim() ? 'onsite' : 'unknown'),
    primaryWorkplaceType: job.primaryWorkplaceType,
    remoteEligibility: job.remoteEligibility,
    isIndiaEligible: job.isIndiaEligible,
    isFresh,
    salary: job.salary,
    industry: job.industry,
    category: job.category,
  };
}
