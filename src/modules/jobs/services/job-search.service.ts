import { createHash } from 'node:crypto';
import { JobProvider } from '../providers/provider.types';
import { ProviderRegistry } from '../providers/provider.registry';
import {
  NormalizedJob,
  LegacyJob,
  JobSearchParams,
  JobSearchResponse,
  JobStatsResponse,
  ProviderDiagnostic,
  toLegacyJob,
} from '../domain/job.types';
import { deduplicateJobs } from '../domain/job.deduplication';
import { filterAndRankJobs } from '../domain/job.ranking';
import {
  INDUSTRY_TAXONOMY,
  normalizeIndustryFilter,
  resolveJobIndustry,
} from '../domain/job.taxonomy';

interface CachedSearchResult {
  response: JobSearchResponse;
  timestamp: number;
}

// Global cache attachment on globalThis to prevent Next.js dev reloads from wiping in-memory jobs
const globalJobNexusCache = globalThis as unknown as {
  __JOBNEXUS_RAW_JOBS__?: NormalizedJob[];
  __JOBNEXUS_DIAGNOSTICS__?: ProviderDiagnostic[];
  __JOBNEXUS_CACHE_TIME__?: number;
  __JOBNEXUS_FETCH_PROMISE__?: Promise<{ allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[] }> | null;
  __JOBNEXUS_SEARCH_CACHE__?: Map<string, CachedSearchResult>;
  __JOBNEXUS_STATS_CACHE__?: { stats: JobStatsResponse; timestamp: number };
};

export class JobSearchService {
  private providers: JobProvider[];
  private isCustom: boolean;
  private instanceSearchCache = new Map<string, CachedSearchResult>();
  private customInFlightPromise?: Promise<{ allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[] }> | null;

  private static readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_SEARCH_CACHE_ENTRIES = 300;

  static get cachedRawJobs(): NormalizedJob[] | null {
    return globalJobNexusCache.__JOBNEXUS_RAW_JOBS__ ?? null;
  }
  static set cachedRawJobs(jobs: NormalizedJob[] | null) {
    globalJobNexusCache.__JOBNEXUS_RAW_JOBS__ = jobs ?? undefined;
  }

  static get cachedDiagnostics(): ProviderDiagnostic[] | null {
    return globalJobNexusCache.__JOBNEXUS_DIAGNOSTICS__ ?? null;
  }
  static set cachedDiagnostics(diags: ProviderDiagnostic[] | null) {
    globalJobNexusCache.__JOBNEXUS_DIAGNOSTICS__ = diags ?? undefined;
  }

  static get cacheTimestamp(): number {
    return globalJobNexusCache.__JOBNEXUS_CACHE_TIME__ ?? 0;
  }
  static set cacheTimestamp(time: number) {
    globalJobNexusCache.__JOBNEXUS_CACHE_TIME__ = time;
  }

  static get inFlightFetchPromise(): Promise<{ allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[] }> | null {
    return globalJobNexusCache.__JOBNEXUS_FETCH_PROMISE__ ?? null;
  }
  static set inFlightFetchPromise(p: Promise<{ allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[] }> | null) {
    globalJobNexusCache.__JOBNEXUS_FETCH_PROMISE__ = p;
  }

  static get searchCache(): Map<string, CachedSearchResult> {
    if (!globalJobNexusCache.__JOBNEXUS_SEARCH_CACHE__) {
      globalJobNexusCache.__JOBNEXUS_SEARCH_CACHE__ = new Map();
    }
    return globalJobNexusCache.__JOBNEXUS_SEARCH_CACHE__;
  }

  static clearCache(): void {
    JobSearchService.cachedRawJobs = null;
    JobSearchService.cachedDiagnostics = null;
    JobSearchService.cacheTimestamp = 0;
    JobSearchService.inFlightFetchPromise = null;
    JobSearchService.searchCache.clear();
    globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
  }

  constructor(customProviders?: JobProvider[]) {
    this.providers = customProviders || ProviderRegistry.getDefaultProviders();
    this.isCustom = Boolean(customProviders);
  }

  private toCompactLegacyJob(job: NormalizedJob): LegacyJob {
    const legacy = toLegacyJob(job);
    if (legacy.description && legacy.description.length > 250) {
      legacy.description = legacy.description.slice(0, 250) + '...';
    }
    return legacy;
  }

  async getJobById(id: string): Promise<LegacyJob | null> {
    const { allJobs } = await this.fetchRawJobs({});
    const job = deduplicateJobs(allJobs).find((candidate) => candidate.id === id);
    return job ? this.toCompactLegacyJob(job) : null;
  }

  private async fetchFromProviders(params: JobSearchParams = {}): Promise<{
    allJobs: NormalizedJob[];
    diagnostics: ProviderDiagnostic[];
  }> {
    const diagnostics: ProviderDiagnostic[] = [];
    const allJobs: NormalizedJob[] = [];

    const fetchPromises = this.providers.map(async (provider) => {
      const startTime = Date.now();
      // Cap provider timeout to 3000ms max so slow RSS or hung endpoints never stall the app
      const providerTimeout = Math.min(provider.timeoutMs || 3000, 3000);
      const abortController = new AbortController();
      let timer: NodeJS.Timeout | null = null;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abortController.abort(new Error(`Timeout after ${providerTimeout}ms`));
            reject(new Error(`Timeout after ${providerTimeout}ms`));
          }, providerTimeout);
        });

        const fetchPromise = provider.fetchJobs({
          ...(params || {}),
          signal: abortController.signal,
        });

        const jobs = await Promise.race([fetchPromise, timeoutPromise]);
        if (timer) clearTimeout(timer);

        const latencyMs = Date.now() - startTime;
        diagnostics.push({
          providerId: provider.id,
          providerName: provider.name,
          status: 'fulfilled',
          fetchedCount: jobs.length,
          latencyMs,
        });
        return jobs;
      } catch (err: unknown) {
        if (timer) clearTimeout(timer);
        abortController.abort();
        const latencyMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isTimeout =
          errMsg.toLowerCase().includes('abort') ||
          errMsg.toLowerCase().includes('timeout');

        diagnostics.push({
          providerId: provider.id,
          providerName: provider.name,
          status: isTimeout ? 'timeout' : 'rejected',
          fetchedCount: 0,
          latencyMs,
          error: errMsg,
        });
        console.warn(`[JobNexus] Provider ${provider.name} ${isTimeout ? 'timed out' : 'failed'} (${latencyMs}ms):`, errMsg);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    for (const jobBatch of results) {
      allJobs.push(...jobBatch);
    }

    // Resolve every provider value to the shared taxonomy before filtering.
    for (const job of allJobs) {
      const industry = resolveJobIndustry(
        job.industry,
        job.category,
        job.title,
        job.tags,
        job.description
      );
      job.industry = industry;
      job.category = INDUSTRY_TAXONOMY[industry].label;
    }

    return { allJobs, diagnostics };
  }

  private async fetchRawJobs(params: JobSearchParams = {}): Promise<{
    allJobs: NormalizedJob[];
    diagnostics: ProviderDiagnostic[];
  }> {
    // If using custom providers (such as in unit tests), share in-flight promise across concurrent requests
    if (this.isCustom) {
      if (this.customInFlightPromise) {
        return this.customInFlightPromise;
      }
      this.customInFlightPromise = this.fetchFromProviders(params).finally(() => {
        this.customInFlightPromise = null;
      });
      return this.customInFlightPromise;
    }

    if (params.forceRefresh) {
      if (JobSearchService.inFlightFetchPromise) {
        return JobSearchService.inFlightFetchPromise;
      }

      JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
        .then(({ allJobs, diagnostics }) => {
          JobSearchService.cachedRawJobs = allJobs;
          JobSearchService.cachedDiagnostics = diagnostics;
          JobSearchService.cacheTimestamp = Date.now();
          JobSearchService.searchCache.clear();
          globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
          return { allJobs: [...allJobs], diagnostics };
        })
        .finally(() => {
          JobSearchService.inFlightFetchPromise = null;
        });

      return JobSearchService.inFlightFetchPromise;
    }

    const now = Date.now();

    // 1. Fresh cache hit: Return immediately in 0ms!
    if (
      JobSearchService.cachedRawJobs &&
      now - JobSearchService.cacheTimestamp < JobSearchService.CACHE_TTL_MS
    ) {
      return {
        allJobs: [...JobSearchService.cachedRawJobs],
        diagnostics: JobSearchService.cachedDiagnostics || [],
      };
    }

    // 2. Stale-while-revalidate: If we have cached jobs that are older than TTL,
    // return them immediately so the user never waits on slow external APIs,
    // while refreshing in the background!
    if (JobSearchService.cachedRawJobs && JobSearchService.cachedRawJobs.length > 0) {
      if (!JobSearchService.inFlightFetchPromise) {
        JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
          .then(({ allJobs, diagnostics }) => {
            JobSearchService.cachedRawJobs = allJobs;
            JobSearchService.cachedDiagnostics = diagnostics;
            JobSearchService.cacheTimestamp = Date.now();
            JobSearchService.searchCache.clear();
            return { allJobs, diagnostics };
          })
          .catch((err) => {
            console.error('[JobSearchService] Background refresh failed:', err);
            return {
              allJobs: JobSearchService.cachedRawJobs || [],
              diagnostics: JobSearchService.cachedDiagnostics || [],
            };
          })
          .finally(() => {
            JobSearchService.inFlightFetchPromise = null;
          });
      }

      return {
        allJobs: [...JobSearchService.cachedRawJobs],
        diagnostics: JobSearchService.cachedDiagnostics || [],
      };
    }

    // 3. Cold start: Cache is empty. Fetch from providers, sharing promise among concurrent requests.
    if (JobSearchService.inFlightFetchPromise) {
      return JobSearchService.inFlightFetchPromise;
    }

    JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
      .then(({ allJobs, diagnostics }) => {
        JobSearchService.cachedRawJobs = allJobs;
        JobSearchService.cachedDiagnostics = diagnostics;
        JobSearchService.cacheTimestamp = Date.now();
        return { allJobs: [...allJobs], diagnostics };
      })
      .finally(() => {
        JobSearchService.inFlightFetchPromise = null;
      });

    return JobSearchService.inFlightFetchPromise;
  }

  async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
    const normalizeFilter = (value?: string) => value?.trim().toLowerCase() || '';
    const normalizedIndustry = normalizeIndustryFilter(params.industry);
    const cacheKey = JSON.stringify([
      normalizeFilter(params.query),
      normalizeFilter(params.role),
      normalizeFilter(params.company),
      normalizeFilter(params.location),
      normalizeFilter(params.type),
      normalizeFilter(params.level),
      normalizeFilter(params.remote),
      normalizedIndustry ?? `invalid:${normalizeFilter(params.industry)}`,
      params.sort || 'relevance',
      params.page || 1,
      params.pageSize || '',
      params.limit || '',
    ]);
    const activeCache = this.isCustom ? this.instanceSearchCache : JobSearchService.searchCache;

    const cached = activeCache.get(cacheKey);
    if (!params.forceRefresh && cached && Date.now() - cached.timestamp < JobSearchService.CACHE_TTL_MS) {
      return cached.response;
    }

    const { allJobs, diagnostics } = await this.fetchRawJobs(params);

    // Step 1: Deterministic multi-layer deduplication
    const uniqueJobs = deduplicateJobs(allJobs);

    // Step 2: Multi-factor search, location, and seniority filtering & ranking
    const rankedJobs = filterAndRankJobs(uniqueJobs, params);
    if (params.sort === 'date') {
      rankedJobs.sort((a, b) => {
        const publishedA = new Date(a.publishedAt).getTime() || 0;
        const publishedB = new Date(b.publishedAt).getTime() || 0;
        return publishedB - publishedA || a.id.localeCompare(b.id);
      });
    }

    // Keep legacy callers capped at 250; interactive searches page through the full snapshot.
    const requestedPage = params.page;
    const page = Number.isSafeInteger(requestedPage) && requestedPage !== undefined && requestedPage > 0
      ? requestedPage
      : 1;
    const requestedLimit = Number.isSafeInteger(params.limit) && params.limit !== undefined
      ? params.limit
      : 250;
    const requestedPageSize = params.pageSize;
    const pageSize = requestedPageSize === undefined
      ? Math.min(250, Math.max(1, requestedLimit))
      : Number.isSafeInteger(requestedPageSize)
        ? Math.min(100, Math.max(1, requestedPageSize))
        : 250;
    const offset = (page - 1) * pageSize;
    const limitedJobs = rankedJobs.slice(offset, offset + pageSize);
    const hasMore = offset + limitedJobs.length < rankedJobs.length;
    const snapshotHash = createHash('sha256');
    for (const job of rankedJobs) {
      snapshotHash.update(job.id).update('\0');
    }

    // Step 4: Map to backward-compatible legacy shape with compact description for fast payload transfer
    const legacyJobs = limitedJobs.map((job) => this.toCompactLegacyJob(job));

    const response: JobSearchResponse = {
      jobs: legacyJobs,
      count: rankedJobs.length,
      totalAvailable: uniqueJobs.length,
      snapshotId: snapshotHash.digest('hex'),
      returnedCount: limitedJobs.length,
      page,
      pageSize,
      hasMore,
      truncated: hasMore,
      providerCoverage: {
        configured: this.providers.length,
        succeeded: diagnostics.filter((diagnostic) => diagnostic.status === 'fulfilled').length,
        incomplete: diagnostics.some((diagnostic) => diagnostic.status !== 'fulfilled'),
      },
      sources: this.providers.map((p) => p.name),
      diagnostics,
    };

    if (activeCache.size >= JobSearchService.MAX_SEARCH_CACHE_ENTRIES) {
      const oldestKey = activeCache.keys().next().value;
      if (oldestKey) activeCache.delete(oldestKey);
    }
    activeCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
    });

    return response;
  }

  async getJobStats(): Promise<JobStatsResponse> {
    const now = Date.now();
    if (!this.isCustom && globalJobNexusCache.__JOBNEXUS_STATS_CACHE__) {
      if (now - globalJobNexusCache.__JOBNEXUS_STATS_CACHE__.timestamp < 60_000) {
        return globalJobNexusCache.__JOBNEXUS_STATS_CACHE__.stats;
      }
    }

    const { allJobs, diagnostics } = await this.fetchRawJobs({});
    const uniqueJobs = deduplicateJobs(allJobs);

    const providerBreakdown: Record<string, number> = {};
    for (const diag of diagnostics) {
      providerBreakdown[diag.providerName] = diag.fetchedCount;
    }

    const totalJobs = uniqueJobs.length;
    const remoteJobs = uniqueJobs.filter((j) => j.isRemote).length;
    const indiaEligibleJobs = uniqueJobs.filter((j) => j.isIndiaEligible).length;
    const formattedCount = totalJobs.toLocaleString();

    const result: JobStatsResponse = {
      totalJobs,
      formattedCount,
      exactCount: totalJobs,
      providerCoverage: {
        configured: this.providers.length,
        succeeded: diagnostics.filter((diagnostic) => diagnostic.status === 'fulfilled').length,
        incomplete: diagnostics.some((diagnostic) => diagnostic.status !== 'fulfilled'),
      },
      remoteJobs,
      indiaEligibleJobs,
      sources: this.providers.map((p) => p.name),
      sourcesCount: this.providers.length,
      providerBreakdown,
      lastUpdated: new Date().toISOString(),
    };

    if (!this.isCustom) {
      globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = { stats: result, timestamp: now };
    }

    return result;
  }
}
