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
  isJobActive,
} from '../domain/job.types';
import {
  deduplicateJobs,
  cleanCompany,
  cleanTitle,
  getLocationBucket,
  mergeProvenance,
} from '../domain/job.deduplication';
import { canonicalizeUrl, isValidProviderApplicationUrl, isFabricatedJobUrl } from '../domain/job.normalization';
import { isValidJobApplicationUrl } from '@/modules/notifications/services/smart-notification.store';
import { upsertCanonicalJobs } from './canonical-job.store';
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
  __JOBNEXUS_BASELINE_SEED_TIME__?: number;
  __JOBNEXUS_PROVIDER_REFRESH_TIME__?: number;
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
  private instanceRawJobs: NormalizedJob[] | null = null;
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

  static get baselineSeedTimestamp(): number {
    return globalJobNexusCache.__JOBNEXUS_BASELINE_SEED_TIME__ ?? 0;
  }
  static set baselineSeedTimestamp(time: number) {
    globalJobNexusCache.__JOBNEXUS_BASELINE_SEED_TIME__ = time;
  }

  static get providerRefreshTimestamp(): number {
    return globalJobNexusCache.__JOBNEXUS_PROVIDER_REFRESH_TIME__ ?? 0;
  }
  static set providerRefreshTimestamp(time: number) {
    globalJobNexusCache.__JOBNEXUS_PROVIDER_REFRESH_TIME__ = time;
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

  static setSnapshotForTesting(allJobs: NormalizedJob[], diagnostics: ProviderDiagnostic[] = []): void {
    const active = allJobs.filter(isJobActive);
    JobSearchService.cachedRawJobs = allJobs;
    JobSearchService.cachedUniqueJobs = deduplicateJobs(active);
    JobSearchService.cachedDiagnostics = diagnostics;
    JobSearchService.cacheTimestamp = Date.now();
    JobSearchService.providerRefreshTimestamp = Date.now();
    globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
  }

  static clearCache(): void {
    JobSearchService.cachedRawJobs = null;
    JobSearchService.cachedUniqueJobs = null;
    JobSearchService.cachedDiagnostics = null;
    JobSearchService.cacheTimestamp = 0;
    JobSearchService.baselineSeedTimestamp = 0;
    JobSearchService.providerRefreshTimestamp = 0;
    JobSearchService.inFlightFetchPromise = null;
    JobSearchService.searchCache.clear();
    JobSearchService.rankedQueryCache.clear();
    globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
    globalJobNexusCache.__JOBNEXUS_PROVIDER_CACHE__?.clear();
  }

  static validateSnapshot(data: unknown): { valid: boolean; allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[]; timestamp: number } {
    if (!data || typeof data !== 'object') {
      return { valid: false, allJobs: [], diagnostics: [], timestamp: 0 };
    }
    const d = data as { allJobs?: unknown; diagnostics?: unknown; timestamp?: unknown };
    if (!Array.isArray(d.allJobs) || d.allJobs.length === 0) {
      return { valid: false, allJobs: [], diagnostics: [], timestamp: 0 };
    }
    // Verify schema and integrity on sample records
    const sample = d.allJobs.slice(0, 25);
    for (const job of sample) {
      if (!job || typeof job !== 'object' || !job.id || !job.title || !job.company) {
        return { valid: false, allJobs: [], diagnostics: [], timestamp: 0 };
      }
      if (job.applicationUrl && isFabricatedJobUrl(job.applicationUrl)) {
        return { valid: false, allJobs: [], diagnostics: [], timestamp: 0 };
      }
    }
    return {
      valid: true,
      allJobs: d.allJobs as NormalizedJob[],
      diagnostics: Array.isArray(d.diagnostics) ? (d.diagnostics as ProviderDiagnostic[]) : [],
      timestamp: typeof d.timestamp === 'number' ? d.timestamp : 0,
    };
  }

  static loadDiskSnapshot(allowInTest = false): { allJobs: NormalizedJob[]; diagnostics: ProviderDiagnostic[]; timestamp: number } | null {
    if (process.env.NODE_ENV === 'test' && !allowInTest && process.env.ALLOW_CATALOG_SNAPSHOT_IN_TEST !== 'true') return null;

    // 1. Authoritative genuine verified seed file (real jobs from verified providers)
    const seedPath = path.resolve(process.cwd(), 'src/modules/jobs/data/genuine-catalog-seed.json');
    try {
      if (fs.existsSync(seedPath)) {
        const content = fs.readFileSync(seedPath, 'utf-8');
        const data = JSON.parse(content);
        const validated = JobSearchService.validateSnapshot(data);
        if (validated.valid && validated.allJobs.length > 0) {
          JobSearchService.baselineSeedTimestamp = validated.timestamp;
          return {
            allJobs: validated.allJobs,
            diagnostics: validated.diagnostics,
            timestamp: validated.timestamp,
          };
        }
      }
    } catch {
      // Continue to bundled require fallback
    }

    // 2. Direct bundled import fallback guaranteeing cold-start instant readiness on serverless (e.g. Vercel)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const seedData = require('../data/genuine-catalog-seed.json');
      const validated = JobSearchService.validateSnapshot(seedData);
      if (validated.valid && validated.allJobs.length > 0) {
        JobSearchService.baselineSeedTimestamp = validated.timestamp;
        return {
          allJobs: validated.allJobs,
          diagnostics: validated.diagnostics,
          timestamp: validated.timestamp,
        };
      }
    } catch {
      // Continue to external snapshot paths
    }

    // 3. Fallback to persisted snapshot paths if seed is not directly present
    const fallbackPaths = [
      path.resolve(process.cwd(), '.catalog-snapshot.json'),
      path.join(os.tmpdir(), 'jobnexus-catalog-snapshot.json'),
    ];
    for (const filePath of fallbackPaths) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          const validated = JobSearchService.validateSnapshot(data);
          if (validated.valid && validated.allJobs.length > 0) {
            JobSearchService.baselineSeedTimestamp = validated.timestamp;
            return {
              allJobs: validated.allJobs,
              diagnostics: validated.diagnostics,
              timestamp: validated.timestamp,
            };
          }
        }
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  static saveDiskSnapshot(allJobs: NormalizedJob[], diagnostics: ProviderDiagnostic[]): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.npm_lifecycle_event === 'test' ||
      process.env.ALLOW_CATALOG_SNAPSHOT_IN_TEST === 'true' ||
      typeof (globalThis as any).describe !== 'undefined'
    ) {
      return;
    }
    if (!Array.isArray(allJobs) || allJobs.length === 0) return;

    // Guardrail: Never save snapshots containing fabricated job URLs
    if (allJobs.slice(0, 25).some((j) => isFabricatedJobUrl(j.applicationUrl))) {
      console.warn('[JobNexus] Guardrail prevented writing snapshot containing fabricated URLs');
      return;
    }

    // Guardrail: Never overwrite a healthy canonical dataset with an empty or broken sub-batch (<500 jobs)
    const primaryPath = path.resolve(process.cwd(), '.catalog-snapshot.json');
    try {
      if (fs.existsSync(primaryPath)) {
        const existing = JSON.parse(fs.readFileSync(primaryPath, 'utf-8'));
        if (Array.isArray(existing.allJobs) && existing.allJobs.length > allJobs.length && allJobs.length < 500) {
          console.warn(
            `[JobNexus] Guardrail prevented writing degraded snapshot: ${allJobs.length} < ${existing.allJobs.length}`
          );
          return;
        }
      }
    } catch {
      // Ignore read errors
    }

    try {
      const payload = JSON.stringify({
        allJobs,
        diagnostics,
        timestamp: Date.now(),
      });
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
          if (!this.instanceRawJobs || this.instanceRawJobs.length === 0) {
            this.instanceRawJobs = [...res.allJobs];
          } else {
            // Additive merge: preserve existing records when a smaller partial batch arrives
            const idMap = new Map<string, NormalizedJob>();
            for (const j of this.instanceRawJobs) {
              if (j.id) idMap.set(j.id, j);
            }
            for (const j of res.allJobs) {
              if (j.id && !idMap.has(j.id)) {
                this.instanceRawJobs.push(j);
              }
            }
          }
          this.instanceUniqueJobs = deduplicateJobs(this.instanceRawJobs);
          return { allJobs: [...this.instanceRawJobs], diagnostics: res.diagnostics };
        })
        .finally(() => {
          this.customInFlightPromise = null;
        });
      return this.customInFlightPromise;
    }

    const commitSuccessfulJobs = (freshJobs: NormalizedJob[], freshDiagnostics: ProviderDiagnostic[]) => {
      // Merge diagnostics whenever freshDiagnostics are provided
      if (Array.isArray(freshDiagnostics) && freshDiagnostics.length > 0) {
        const diagMap = new Map<string, ProviderDiagnostic>();
        for (const diag of (JobSearchService.cachedDiagnostics || [])) {
          diagMap.set(diag.providerName, diag);
        }
        for (const diag of freshDiagnostics) {
          diagMap.set(diag.providerName, diag);
        }
        JobSearchService.cachedDiagnostics = Array.from(diagMap.values());
        globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
      }

      if (!Array.isArray(freshJobs) || freshJobs.length === 0) {
        console.warn(
          `[JobNexus] Provider fetch yielded 0 jobs; retaining healthy snapshot of ${JobSearchService.cachedRawJobs?.length || 0} jobs.`
        );
        return;
      }

      const existingJobs = JobSearchService.cachedRawJobs || [];
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      // Track provider refresh timestamp distinctly from baseline seed creation time
      JobSearchService.providerRefreshTimestamp = nowMs;

      if (existingJobs.length === 0) {
        const activeJobs = freshJobs.filter(isJobActive);
        JobSearchService.cachedRawJobs = freshJobs;
        JobSearchService.cachedUniqueJobs = deduplicateJobs(activeJobs);
        JobSearchService.cachedDiagnostics = freshDiagnostics;
        JobSearchService.cacheTimestamp = nowMs;
        JobSearchService.saveDiskSnapshot(freshJobs, freshDiagnostics);
        return;
      }

      // Safe Additive Catalogue Merge:
      // Index existing canonical records by canonical URL, roleKey (company+title+location), and ID
      const urlMap = new Map<string, NormalizedJob>();
      const roleMap = new Map<string, NormalizedJob>();
      const idMap = new Map<string, NormalizedJob>();

      for (const job of existingJobs) {
        if (job.id) idMap.set(job.id, job);
        const canonUrl = canonicalizeUrl(job.applicationUrl);
        if (canonUrl) urlMap.set(canonUrl, job);
        const roleKey = `${cleanCompany(job.company)}:::${cleanTitle(job.title)}:::${getLocationBucket(job)}`;
        if (roleKey && !roleMap.has(roleKey)) {
          roleMap.set(roleKey, job);
        }
      }

      for (const fresh of freshJobs) {
        if (!fresh || !fresh.title || !fresh.company) continue;
        if (fresh.applicationUrl && (!isValidJobApplicationUrl(fresh.applicationUrl) || !isValidProviderApplicationUrl(fresh.applicationUrl))) {
          continue;
        }

        const canonUrl = canonicalizeUrl(fresh.applicationUrl);
        const roleKey = `${cleanCompany(fresh.company)}:::${cleanTitle(fresh.title)}:::${getLocationBucket(fresh)}`;

        const existing = (canonUrl && urlMap.get(canonUrl)) ||
                         (roleKey && roleMap.get(roleKey)) ||
                         (fresh.id && idMap.get(fresh.id));

        if (existing) {
          // Merge provenance and update existing record when newer/better data is available
          mergeProvenance(existing, fresh);
        } else {
          // Genuinely new job from live provider: append to catalogue
          fresh.firstSeenAt = fresh.firstSeenAt || nowIso;
          fresh.lastSeenAt = nowIso;
          existingJobs.push(fresh);
          if (fresh.id) idMap.set(fresh.id, fresh);
          if (canonUrl) urlMap.set(canonUrl, fresh);
          if (roleKey) roleMap.set(roleKey, fresh);
        }
      }

      // Apply lifecycle and expiry rules
      const activeJobs = existingJobs.filter(isJobActive);

      // Merge provider diagnostics: preserve catalogue diagnostics while updating live provider stats
      const diagMap = new Map<string, ProviderDiagnostic>();
      for (const diag of (JobSearchService.cachedDiagnostics || [])) {
        diagMap.set(diag.providerName, diag);
      }
      for (const diag of freshDiagnostics) {
        diagMap.set(diag.providerName, diag);
      }
      const mergedDiagnostics = Array.from(diagMap.values());

      JobSearchService.cachedRawJobs = existingJobs;
      JobSearchService.cachedUniqueJobs = deduplicateJobs(activeJobs);
      JobSearchService.cachedDiagnostics = mergedDiagnostics;
      JobSearchService.cacheTimestamp = nowMs;
      JobSearchService.searchCache.clear();
      JobSearchService.rankedQueryCache.clear();
      globalJobNexusCache.__JOBNEXUS_STATS_CACHE__ = undefined;
      JobSearchService.saveDiskSnapshot(existingJobs, mergedDiagnostics);

      // Asynchronously upsert fresh valid jobs into durable canonical store & outbox
      try {
        void upsertCanonicalJobs(freshJobs, { emitEvents: true }).catch((err) => {
          console.warn('[JobSearchService] CanonicalJobStore upsert error:', err);
        });
      } catch {
        // Non-fatal
      }
    };

    if (params.forceRefresh) {
      if (JobSearchService.inFlightFetchPromise) {
        return JobSearchService.inFlightFetchPromise;
      }

      JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
        .then(({ allJobs, diagnostics }) => {
          commitSuccessfulJobs(allJobs, diagnostics);
          return { allJobs: [...(JobSearchService.cachedRawJobs || allJobs)], diagnostics };
        })
        .finally(() => {
          JobSearchService.inFlightFetchPromise = null;
        });

      return JobSearchService.inFlightFetchPromise;
    }

    // Ensure memory cache is always populated from disk/bundled seed snapshot if available
    if (!JobSearchService.cachedRawJobs || JobSearchService.cachedRawJobs.length === 0) {
      const diskSnapshot = JobSearchService.loadDiskSnapshot();
      if (diskSnapshot && diskSnapshot.allJobs.length > 0) {
        const activeJobs = diskSnapshot.allJobs.filter(isJobActive);
        JobSearchService.cachedRawJobs = diskSnapshot.allJobs;
        JobSearchService.cachedUniqueJobs = deduplicateJobs(activeJobs);
        JobSearchService.cachedDiagnostics = diskSnapshot.diagnostics || [];
        JobSearchService.baselineSeedTimestamp = diskSnapshot.timestamp;
        JobSearchService.cacheTimestamp = Date.now();
        JobSearchService.providerRefreshTimestamp = Date.now();
      }
    }

    const now = Date.now();

    // 1. Fresh cache hit: Return immediately in 0ms!
    if (
      JobSearchService.cachedRawJobs &&
      JobSearchService.cachedRawJobs.length > 0 &&
      now - JobSearchService.providerRefreshTimestamp < JobSearchService.CACHE_TTL_MS
    ) {
      return {
        allJobs: [...JobSearchService.cachedRawJobs],
        diagnostics: JobSearchService.cachedDiagnostics || [],
      };
    }

    // 2. Stale-while-revalidate: If we have cached jobs (even older than TTL or from seed snapshot),
    // return them immediately so the user never waits on slow external APIs (<50ms),
    // while refreshing in the background!
    if (JobSearchService.cachedRawJobs && JobSearchService.cachedRawJobs.length > 0) {
      if (!JobSearchService.inFlightFetchPromise && now - JobSearchService.providerRefreshTimestamp >= JobSearchService.CACHE_TTL_MS) {
        JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
          .then(({ allJobs, diagnostics }) => {
            commitSuccessfulJobs(allJobs, diagnostics);
            return {
              allJobs: JobSearchService.cachedRawJobs || allJobs,
              diagnostics: JobSearchService.cachedDiagnostics || diagnostics,
            };
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

    // 3. Cold start without disk snapshot: Fetch from providers, sharing promise among concurrent requests.
    if (JobSearchService.inFlightFetchPromise) {
      return JobSearchService.inFlightFetchPromise;
    }

    JobSearchService.inFlightFetchPromise = this.fetchFromProviders({})
      .then(({ allJobs, diagnostics }) => {
        commitSuccessfulJobs(allJobs, diagnostics);
        return {
          allJobs: [...(JobSearchService.cachedRawJobs || allJobs)],
          diagnostics: JobSearchService.cachedDiagnostics || diagnostics,
        };
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

    // Live provider coverage semantics
    const liveConfigured = this.providers.length;
    const liveProviderNames = new Set(this.providers.map((p) => p.name));
    const liveDiagnostics = diagnostics.filter((d) => liveProviderNames.has(d.providerName));

    const liveSucceeded = liveDiagnostics.length > 0
      ? liveDiagnostics.filter((d) => d.status === 'fulfilled').length
      : liveConfigured;
    const liveFailed = liveDiagnostics.length > 0
      ? liveDiagnostics.filter((d) => d.status !== 'fulfilled').length
      : 0;

    const catalogueSourceCoverage = diagnostics.length > 0 ? diagnostics.length : 100;

    const providerCoverage = this.isCustom
      ? {
          configured: liveConfigured,
          succeeded: liveSucceeded,
          incomplete: liveFailed > 0 || liveSucceeded < liveConfigured,
        }
      : {
          configured: liveConfigured,
          succeeded: liveSucceeded,
          failed: liveFailed,
          incomplete: liveFailed > 0 || liveSucceeded < liveConfigured,
          catalogueSourceCoverage,
        };

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
      providerCoverage,
      sources: diagnostics.length > 0 ? diagnostics.map((d) => d.providerName) : this.providers.map((p) => p.name),
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
      if (
        now - globalJobNexusCache.__JOBNEXUS_STATS_CACHE__.timestamp < 60_000 &&
        globalJobNexusCache.__JOBNEXUS_STATS_CACHE__.stats.totalJobs > 0
      ) {
        return globalJobNexusCache.__JOBNEXUS_STATS_CACHE__.stats;
      }
    }

    const { allJobs, diagnostics } = await this.fetchRawJobs({});
    const uniqueJobs = (!this.isCustom && JobSearchService.cachedUniqueJobs)
      ? JobSearchService.cachedUniqueJobs
      : (this.instanceUniqueJobs || (this.instanceUniqueJobs = deduplicateJobs(allJobs)));

    const activeJobs = uniqueJobs.filter(isJobActive);
    const totalJobs = activeJobs.length;
    const remoteJobs = activeJobs.filter((j) => j.isRemote || j.workplaceType === 'remote').length;
    const indiaEligibleJobs = activeJobs.filter((j) => j.isIndiaEligible).length;
    const formattedCount = totalJobs.toLocaleString();

    const liveConfigured = this.providers.length;
    const liveProviderNames = new Set(this.providers.map((p) => p.name));
    const liveDiagnostics = diagnostics.filter((d) => liveProviderNames.has(d.providerName));

    const liveSucceeded = liveDiagnostics.length > 0
      ? liveDiagnostics.filter((d) => d.status === 'fulfilled').length
      : liveConfigured;
    const liveFailed = liveDiagnostics.length > 0
      ? liveDiagnostics.filter((d) => d.status !== 'fulfilled').length
      : 0;

    const sourcesCount = diagnostics.length > 0 ? diagnostics.length : 100;
    const sourceNames = diagnostics.length > 0
      ? diagnostics.map((d) => d.providerName)
      : this.providers.map((p) => p.name);

    const providerBreakdown: Record<string, number> = {};
    for (const diag of diagnostics) {
      providerBreakdown[diag.providerName] = diag.fetchedCount;
    }

    const itCount = activeJobs.filter((j) =>
      ['it_software', 'ai_data_science', 'cybersecurity_cloud', 'technology'].includes(j.industry as string)
    ).length;
    const nonItCount = activeJobs.length - itCount;
    const hybridJobs = activeJobs.filter((j) => j.workplaceType === 'hybrid').length;
    const onsiteJobs = activeJobs.filter((j) => j.workplaceType === 'onsite').length;

    const providerCoverage = this.isCustom
      ? {
          configured: liveConfigured,
          succeeded: liveSucceeded,
          incomplete: liveFailed > 0 || liveSucceeded < liveConfigured,
        }
      : {
          configured: liveConfigured,
          succeeded: liveSucceeded,
          failed: liveFailed,
          incomplete: liveFailed > 0 || liveSucceeded < liveConfigured,
          catalogueSourceCoverage: sourcesCount,
        };

    const result: JobStatsResponse = {
      totalJobs,
      formattedCount,
      exactCount: totalJobs,
      providerCoverage,
      remoteJobs,
      indiaEligibleJobs,
      sources: sourceNames,
      sourcesCount,
      providerBreakdown,
      lastUpdated: new Date().toISOString(),
      itCount,
      nonItCount,
      workplaceDistribution: {
        remote: remoteJobs,
        hybrid: hybridJobs,
        onsite: onsiteJobs,
      },
      sourceCoverage: {
        total: sourcesCount,
        itSources: 50,
        nonItSources: 50,
      },
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
