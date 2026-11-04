import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
import { executeWithConcurrencyLimit } from './concurrency';

interface CachedSearchResult {
  response: JobSearchResponse;
  timestamp: number;
}

interface RankedQuerySnapshot {
  rankedJobs: NormalizedJob[];
  snapshotId: string;
  totalAvailable: number;
  timestamp: number;
  diagnostics: ProviderDiagnostic[];
}

// Global cache attachment on globalThis to prevent Next.js dev reloads from wiping in-memory jobs
const globalJobNexusCache = globalThis as unknown as {
  __JOBNEXUS_RAW_JOBS__?: NormalizedJob[];
  __JOBNEXUS_UNIQUE_JOBS__?: NormalizedJob[];
  __JOBNEXUS_DIAGNOSTICS__?: ProviderDiagnostic[];
  __JOBNEXUS_CACHE_TIME__?: number;
  __JOBNEXUS_FETCH_PROMISE__?: Promise<{ allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[] }> | null;
  __JOBNEXUS_SEARCH_CACHE__?: Map<string, CachedSearchResult>;
  __JOBNEXUS_RANKED_QUERY_CACHE__?: Map<string, RankedQuerySnapshot>;
  __JOBNEXUS_STATS_CACHE__?: { stats: JobStatsResponse; timestamp: number };
  __JOBNEXUS_PROVIDER_CACHE__?: Map<string, { jobs: NormalizedJob[]; fetchedAt: number }>;
};

export class JobSearchService {
  private providers: JobProvider[];
  private isCustom: boolean;
  private instanceSearchCache = new Map<string, CachedSearchResult>();
  private instanceRankedQueryCache = new Map<string, RankedQuerySnapshot>();
  private instanceUniqueJobs: NormalizedJob[] | null = null;
  private customInFlightPromise?: Promise<{ allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[] }> | null;

  private static readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_SEARCH_CACHE_ENTRIES = 300;

  static get cachedRawJobs(): NormalizedJob[] | null {
    return globalJobNexusCache.__JOBNEXUS_RAW_JOBS__ ?? null;
  }
  static set cachedRawJobs(jobs: NormalizedJob[] | null) {
    globalJobNexusCache.__JOBNEXUS_RAW_JOBS__ = jobs ?? undefined;
  }

  static get cachedUniqueJobs(): NormalizedJob[] | null {
    return globalJobNexusCache.__JOBNEXUS_UNIQUE_JOBS__ ?? null;
  }
  static set cachedUniqueJobs(jobs: NormalizedJob[] | null) {
    globalJobNexusCache.__JOBNEXUS_UNIQUE_JOBS__ = jobs ?? undefined;
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

  static get rankedQueryCache(): Map<string, RankedQuerySnapshot> {
    if (!globalJobNexusCache.__JOBNEXUS_RANKED_QUERY_CACHE__) {
      globalJobNexusCache.__JOBNEXUS_RANKED_QUERY_CACHE__ = new Map();
    }
    return globalJobNexusCache.__JOBNEXUS_RANKED_QUERY_CACHE__;
  }

  static clearCache(): void {
    JobSearchService.cachedRawJobs = null;
    JobSearchService.cachedUniqueJobs = null;
    JobSearchService.cachedDiagnostics = null;
    JobSearchService.cacheTimestamp = 0;
    JobSearchService.inFlightFetchPromise = null;
    JobSearchService.searchCache.clear();
    JobSearchService.rankedQueryCache.clear();
    globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
    globalJobNexusCache.__JOBNEXUS_PROVIDER_CACHE__?.clear();
  }

  static loadDiskSnapshot(): { allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[]; timestamp: number } | null {
    if (process.env.NODE_ENV === 'test') return null;
    const paths = [
      path.resolve(process.cwd(), '.catalog-snapshot.json'),
      path.resolve(process.cwd(), 'src/modules/jobs/data/catalog-seed.json'),
      path.join(os.tmpdir(), 'jobnexus-catalog-snapshot.json'),
    ];

    for (const filePath of paths) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data.allJobs) && data.allJobs.length > 0) {
            return {
              allJobs: data.allJobs,
              diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
              timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
            };
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    try {
      // Direct bundled import fallback guaranteeing cold-start instant readiness on serverless (e.g. Vercel)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const seedData = require('../data/catalog-seed.json');
      if (Array.isArray(seedData?.allJobs) && seedData.allJobs.length > 0) {
        return {
          allJobs: seedData.allJobs,
          diagnostics: Array.isArray(seedData.diagnostics) ? seedData.diagnostics : [],
          timestamp: typeof seedData.timestamp === 'number' ? seedData.timestamp : 0,
        };
      }
    } catch {
      // Bundled json not present or unreadable
    }

    return null;
  }

  static saveDiskSnapshot(allJobs: NormalizedJob[], diagnostics: ProviderDiagnostic[]): void {
    if (process.env.NODE_ENV === 'test') return;
    if (!Array.isArray(allJobs) || allJobs.length === 0) return;

    try {
      const payload = JSON.stringify({
        allJobs,
        diagnostics,
        timestamp: Date.now(),
      });
      const primaryPath = path.resolve(process.cwd(), '.catalog-snapshot.json');
      fs.writeFile(primaryPath, payload, 'utf-8', (err) => {
        if (err) {
          const tmpPath = path.join(os.tmpdir(), 'jobnexus-catalog-snapshot.json');
          fs.writeFile(tmpPath, payload, 'utf-8', () => {});
        }
      });
    } catch {
      // Non-fatal if disk write fails
    }
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
    const uniqueJobs = (!this.isCustom && JobSearchService.cachedUniqueJobs)
      ? JobSearchService.cachedUniqueJobs
      : (this.instanceUniqueJobs || (this.instanceUniqueJobs = deduplicateJobs(allJobs)));
    const job = uniqueJobs.find((candidate) => candidate.id === id);
    return job ? this.toCompactLegacyJob(job) : null;
  }

  private async fetchFromProviders(params: JobSearchParams = {}): Promise<{
    allJobs: NormalizedJob[];
    diagnostics: ProviderDiagnostic[];
  }> {
    const diagnostics: ProviderDiagnostic[] = [];
    const allJobs: NormalizedJob[] = [];

    const providerTasks = this.providers.map((provider) => async () => {
      const startTime = Date.now();
      // Cap provider timeout to 6000ms max so that multi-board ATS adapters (Greenhouse, Ashby, Lever)
      // have sufficient time to complete aggregation across all employer boards, avoiding premature drop-offs.
      const providerTimeout = Math.min(provider.timeoutMs || 6000, 6000);
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

        // Cache successful non-empty provider batches for resilient fallback
        if (!this.isCustom && jobs.length > 0) {
          if (!globalJobNexusCache.__JOBNEXUS_PROVIDER_CACHE__) {
            globalJobNexusCache.__JOBNEXUS_PROVIDER_CACHE__ = new Map();
          }
          globalJobNexusCache.__JOBNEXUS_PROVIDER_CACHE__.set(provider.id, {
            jobs,
            fetchedAt: Date.now(),
          });
        }

        return jobs;
      } catch (err: unknown) {
        if (timer) clearTimeout(timer);
        abortController.abort();
        const latencyMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isTimeout =
          errMsg.toLowerCase().includes('abort') ||
          errMsg.toLowerCase().includes('timeout');

        // Check if we have a cached snapshot for this provider to maintain full integration inventory
        const cachedFallback = !this.isCustom
          ? globalJobNexusCache.__JOBNEXUS_PROVIDER_CACHE__?.get(provider.id)
          : undefined;

        if (cachedFallback && cachedFallback.jobs.length > 0) {
          diagnostics.push({
            providerId: provider.id,
            providerName: provider.name,
            status: isTimeout ? 'timeout' : 'rejected',
            fetchedCount: cachedFallback.jobs.length,
            latencyMs,
            error: `${errMsg} (using cached fallback)`,
          });
          console.warn(`[JobNexus] Provider ${provider.name} ${isTimeout ? 'timed out' : 'failed'} (${latencyMs}ms); used ${cachedFallback.jobs.length} cached jobs.`);
          return cachedFallback.jobs;
        }

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

    const results = await executeWithConcurrencyLimit(providerTasks, Math.max(providerTasks.length, 12));
    for (const jobBatch of results) {
      if (Array.isArray(jobBatch)) {
        allJobs.push(...jobBatch);
      }
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
      this.customInFlightPromise = this.fetchFromProviders(params)
        .then((res) => {
          this.instanceUniqueJobs = deduplicateJobs(res.allJobs);
          return res;
        })
        .finally(() => {
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
          JobSearchService.cachedUniqueJobs = deduplicateJobs(allJobs);
          JobSearchService.cachedDiagnostics = diagnostics;
          JobSearchService.cacheTimestamp = Date.now();
          JobSearchService.searchCache.clear();
          JobSearchService.rankedQueryCache.clear();
          globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
          JobSearchService.saveDiskSnapshot(allJobs, diagnostics);
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
            JobSearchService.cachedUniqueJobs = deduplicateJobs(allJobs);
            JobSearchService.cachedDiagnostics = diagnostics;
            JobSearchService.cacheTimestamp = Date.now();
            JobSearchService.searchCache.clear();
            JobSearchService.rankedQueryCache.clear();
            globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
            JobSearchService.saveDiskSnapshot(allJobs, diagnostics);
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

    // 3. Cold start with persistent disk snapshot: Load in <50ms, revalidate asynchronously
    const diskSnapshot = JobSearchService.loadDiskSnapshot();
    if (diskSnapshot && diskSnapshot.allJobs.length > 0) {
      JobSearchService.cachedRawJobs = diskSnapshot.allJobs;
      JobSearchService.cachedUniqueJobs = deduplicateJobs(diskSnapshot.allJobs);
      JobSearchService.cachedDiagnostics = diskSnapshot.diagnostics || [];
      JobSearchService.cacheTimestamp = diskSnapshot.timestamp || Date.now();

      // Trigger background revalidation without blocking this user request
      if (!JobSearchService.inFlightFetchPromise) {
        JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
          .then(({ allJobs, diagnostics }) => {
            JobSearchService.cachedRawJobs = allJobs;
            JobSearchService.cachedUniqueJobs = deduplicateJobs(allJobs);
            JobSearchService.cachedDiagnostics = diagnostics;
            JobSearchService.cacheTimestamp = Date.now();
            JobSearchService.searchCache.clear();
            JobSearchService.rankedQueryCache.clear();
            globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
            JobSearchService.saveDiskSnapshot(allJobs, diagnostics);
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

    // 4. Cold start without disk snapshot: Fetch from providers, sharing promise among concurrent requests.
    if (JobSearchService.inFlightFetchPromise) {
      return JobSearchService.inFlightFetchPromise;
    }

    JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
      .then(({ allJobs, diagnostics }) => {
        JobSearchService.cachedRawJobs = allJobs;
        JobSearchService.cachedUniqueJobs = deduplicateJobs(allJobs);
        JobSearchService.cachedDiagnostics = diagnostics;
        JobSearchService.cacheTimestamp = Date.now();
        JobSearchService.searchCache.clear();
        JobSearchService.rankedQueryCache.clear();
        globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
        JobSearchService.saveDiskSnapshot(allJobs, diagnostics);
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

    const queryKey = JSON.stringify([
      normalizeFilter(params.query),
      normalizeFilter(params.role),
      normalizeFilter(params.company),
      normalizeFilter(params.location),
      normalizeFilter(params.type),
      normalizeFilter(params.level),
      normalizeFilter(params.remote),
      normalizedIndustry ?? `invalid:${normalizeFilter(params.industry)}`,
      params.sort || 'relevance',
    ]);
    const activeQueryCache = this.isCustom ? this.instanceRankedQueryCache : JobSearchService.rankedQueryCache;

    let rankedJobs: NormalizedJob[];
    let snapshotId: string;
    let totalAvailable: number;
    let diagnostics: ProviderDiagnostic[];

    const cachedQuery = !params.forceRefresh ? activeQueryCache.get(queryKey) : undefined;
    if (cachedQuery && Date.now() - cachedQuery.timestamp < JobSearchService.CACHE_TTL_MS) {
      rankedJobs = cachedQuery.rankedJobs;
      snapshotId = cachedQuery.snapshotId;
      totalAvailable = cachedQuery.totalAvailable;
      diagnostics = cachedQuery.diagnostics;
    } else {
      const rawResult = await this.fetchRawJobs(params);
      diagnostics = rawResult.diagnostics;
      const allJobs = rawResult.allJobs;

      // Deterministic multi-layer deduplication (reads singleton pre-deduplicated cache in 0ms)
      const uniqueJobs = (!this.isCustom && JobSearchService.cachedUniqueJobs)
        ? JobSearchService.cachedUniqueJobs
        : (this.instanceUniqueJobs || (this.instanceUniqueJobs = deduplicateJobs(allJobs)));

      totalAvailable = uniqueJobs.length;

      // Multi-factor search, location, and seniority filtering & ranking
      rankedJobs = filterAndRankJobs(uniqueJobs, params);
      if (params.sort === 'date') {
        rankedJobs.sort((a, b) => {
          const publishedA = new Date(a.publishedAt).getTime() || 0;
          const publishedB = new Date(b.publishedAt).getTime() || 0;
          return publishedB - publishedA || a.id.localeCompare(b.id);
        });
      }

      const snapshotHash = createHash('sha256');
      for (const job of rankedJobs) {
        snapshotHash.update(job.id).update('\0');
      }
      snapshotId = snapshotHash.digest('hex');

      activeQueryCache.set(queryKey, {
        rankedJobs,
        snapshotId,
        totalAvailable,
        timestamp: Date.now(),
        diagnostics,
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

    // Step 4: Map to backward-compatible legacy shape with compact description for fast payload transfer
    const legacyJobs = limitedJobs.map((job) => this.toCompactLegacyJob(job));

    const response: JobSearchResponse = {
      jobs: legacyJobs,
      count: rankedJobs.length,
      totalAvailable,
      snapshotId,
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
    const uniqueJobs = (!this.isCustom && JobSearchService.cachedUniqueJobs)
      ? JobSearchService.cachedUniqueJobs
      : (this.instanceUniqueJobs || (this.instanceUniqueJobs = deduplicateJobs(allJobs)));

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

// Background pre-warm in non-test server environments so user requests are served in 0ms from hot cache
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  queueMicrotask(() => {
    new JobSearchService().searchJobs({ page: 1, pageSize: 50 }).catch((err) => {
      console.warn('[JobSearchService] Background warm-up caught non-fatal error:', err);
    });
  });
}
