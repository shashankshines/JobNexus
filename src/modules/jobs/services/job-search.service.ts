import { JobProvider } from '../providers/provider.types';
import { ProviderRegistry } from '../providers/provider.registry';
import {
  NormalizedJob,
  JobSearchParams,
  JobSearchResponse,
  ProviderDiagnostic,
  toLegacyJob,
} from '../domain/job.types';
import { deduplicateJobs } from '../domain/job.deduplication';
import { filterAndRankJobs } from '../domain/job.ranking';

export class JobSearchService {
  private providers: JobProvider[];

  constructor(customProviders?: JobProvider[]) {
    this.providers = customProviders || ProviderRegistry.getDefaultProviders();
  }

  async searchJobs(params: JobSearchParams): Promise<JobSearchResponse> {
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
        const isTimeout = errMsg.toLowerCase().includes('abort') || errMsg.toLowerCase().includes('timeout');

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
}
