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

export class JobSearchService {
  private providers: JobProvider[];
  private isCustom: boolean;

  // Static in-memory cache for default providers feed
  private static cachedRawJobs: NormalizedJob[] | null = null;
  private static cachedDiagnostics: ProviderDiagnostic[] | null = null;
  private static cacheTimestamp = 0;
  private static readonly CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

  static clearCache(): void {
    JobSearchService.cachedRawJobs = null;
    JobSearchService.cachedDiagnostics = null;
    JobSearchService.cacheTimestamp = 0;
  }

  constructor(customProviders?: JobProvider[]) {
    this.providers = customProviders || ProviderRegistry.getDefaultProviders();
    this.isCustom = Boolean(customProviders);
  }

  private async fetchRawJobs(params: JobSearchParams = {}): Promise<{
    allJobs: NormalizedJob[];
    diagnostics: ProviderDiagnostic[];
  }> {
    const isUnfiltered =
      !params.query &&
      !params.location &&
      !params.type &&
      !params.level &&
      !params.remote;

    // Use cached feed for default providers if within TTL
    if (
      !this.isCustom &&
      isUnfiltered &&
      JobSearchService.cachedRawJobs &&
      Date.now() - JobSearchService.cacheTimestamp < JobSearchService.CACHE_TTL_MS
    ) {
      return {
        allJobs: [...JobSearchService.cachedRawJobs],
        diagnostics: JobSearchService.cachedDiagnostics || [],
      };
    }

    const diagnostics: ProviderDiagnostic[] = [];
    const allJobs: NormalizedJob[] = [];

    const fetchPromises = this.providers.map(async (provider) => {
      const startTime = Date.now();
      try {
        const jobs = await provider.fetchJobs(params);
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
        console.error(`[JobNexus] Provider ${provider.name} failed (${latencyMs}ms):`, errMsg);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    for (const jobBatch of results) {
      allJobs.push(...jobBatch);
    }

    // Update in-memory cache for default providers on unfiltered queries
    if (!this.isCustom && isUnfiltered) {
      JobSearchService.cachedRawJobs = allJobs;
      JobSearchService.cachedDiagnostics = diagnostics;
      JobSearchService.cacheTimestamp = Date.now();
    }

    return { allJobs, diagnostics };
  }

  async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
    const { allJobs, diagnostics } = await this.fetchRawJobs(params);

    // Step 1: Deterministic multi-layer deduplication
    const uniqueJobs = deduplicateJobs(allJobs);

    // Step 2: Multi-factor search, location, and seniority filtering & ranking
    const rankedJobs = filterAndRankJobs(uniqueJobs, params);

    // Step 3: Map to backward-compatible legacy shape
    const legacyJobs = rankedJobs.map(toLegacyJob);

    return {
      jobs: legacyJobs,
      count: legacyJobs.length,
      sources: this.providers.map((p) => p.name),
      diagnostics,
    };
  }

  async getJobStats(): Promise<JobStatsResponse> {
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

    return {
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
  }
}

