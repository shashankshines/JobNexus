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
  status?: 'active' | 'expired' | 'unknown';
  isIndiaEligible?: boolean;
  workplaceType?: 'remote' | 'hybrid' | 'onsite';
  score?: number;
  alternateSources?: Array<{ sourceName: string; sourceUrl?: string; applicationUrl: string }>;
  salary?: string;
  industry?: string;
  category?: string;
}

export interface JobSearchParams {
  query?: string;
  company?: string;
  location?: string;
  type?: string;
  level?: string;
  remote?: string;
  industry?: string;
  limit?: number;
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

export interface JobSearchResponse {
  jobs: LegacyJob[];
  count: number;
  sources: string[];
  diagnostics?: ProviderDiagnostic[];
}

export interface JobStatsResponse {
  totalJobs: number;
  formattedCount: string;
  exactCount: number;
  remoteJobs: number;
  indiaEligibleJobs: number;
  sources: string[];
  sourcesCount: number;
  providerBreakdown: Record<string, number>;
  lastUpdated: string;
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
    workplaceType: job.workplaceType || (job.isRemote ? 'remote' : 'onsite'),
    isIndiaEligible: job.isIndiaEligible,
    isFresh,
    salary: job.salary,
    industry: job.industry,
    category: job.category,
  };
}
