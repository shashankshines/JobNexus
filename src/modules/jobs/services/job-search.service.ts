import { JobProvider } from '../providers/provider.types';
import { ProviderRegistry } from '../providers/provider.registry';
import {
  NormalizedJob,
  JobSearchParams,
  JobSearchResponse,
  JobStatsResponse,
  ProviderDiagnostic,
  toLegacyJob,
} from '../domain/job.types';
import { deduplicateJobs } from '../domain/job.deduplication';
import { filterAndRankJobs } from '../domain/job.ranking';
import { classifyJobIndustry } from '../domain/job.taxonomy';

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

  private async fetchFromProviders(params: JobSearchParams = {}): Promise<{
    allJobs: NormalizedJob[];
    diagnostics: ProviderDiagnostic[];
  }> {
    const diagnostics: ProviderDiagnostic[] = [];
    const allJobs: NormalizedJob[] = [];

    const fetchPromises = this.providers.map(async (provider) => {
      const startTime = Date.now();
      // Cap provider timeout to 2500ms max so slow RSS or hung endpoints never stall the app
      const providerTimeout = Math.min(provider.timeoutMs || 2500, 2500);
      try {
        const fetchPromise = provider.fetchJobs(params);
        const timeoutPromise = new Promise<NormalizedJob[]>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${providerTimeout}ms`)), providerTimeout)
        );
        const jobs = await Promise.race([fetchPromise, timeoutPromise]);
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

    // Ensure canonical industry classification on all fetched jobs
    for (const job of allJobs) {
      if (!job.industry) {
        const classified = classifyJobIndustry(job.title, job.tags, job.description);
        job.industry = classified.industry;
        job.category = classified.category;
      }
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
    const cacheKey = `${params.query || ''}::${params.company || ''}::${params.location || ''}::${params.type || ''}::${params.level || ''}::${params.remote || ''}::${params.industry || ''}::${params.limit || ''}`;
    const activeCache = this.isCustom ? this.instanceSearchCache : JobSearchService.searchCache;

    const cached = activeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < JobSearchService.CACHE_TTL_MS) {
      return cached.response;
    }

    const { allJobs, diagnostics } = await this.fetchRawJobs(params);

    // Step 1: Deterministic multi-layer deduplication
    const uniqueJobs = deduplicateJobs(allJobs);

    // Step 2: Multi-factor search, location, and seniority filtering & ranking
    const rankedJobs = filterAndRankJobs(uniqueJobs, params);

    // Step 3: Cap results to max 250 top-ranked items (or custom limit if provided in unit tests)
    const maxResults = params.limit ? Math.max(params.limit, 50) : 250;
    const limitedJobs = rankedJobs.length > maxResults ? rankedJobs.slice(0, maxResults) : rankedJobs;

    // Step 4: Map to backward-compatible legacy shape with compact description for fast payload transfer
    const legacyJobs = limitedJobs.map((job) => {
      const legacy = toLegacyJob(job);
      if (legacy.description && legacy.description.length > 250) {
        legacy.description = legacy.description.slice(0, 250) + '...';
      }
      return legacy;
    });

    const response: JobSearchResponse = {
      jobs: legacyJobs,
      count: rankedJobs.length,
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
    const formattedCount = totalJobs > 0 ? `${totalJobs.toLocaleString()}+` : '0';

    const result: JobStatsResponse = {
      totalJobs,
      formattedCount,
      exactCount: totalJobs,
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

