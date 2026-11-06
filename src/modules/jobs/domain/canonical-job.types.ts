/**
 * JobNexus — Canonical Job & Outbox Event Domain Types
 * Defines the durable canonical job entity, deduplication hash, and event outbox models.
 */

import crypto from 'node:crypto';
import { NormalizedJob } from './job.types';
import { canonicalizeUrl } from './job.normalization';
import { resolveJobIndustry } from './job.taxonomy';
import { IT_SECTOR_IDS } from '@/modules/notifications/services/job-alert-matcher.service';

export type CanonicalJobStatus = 'active' | 'expired' | 'withdrawn';

export interface CanonicalJob {
  id?: string;
  canonicalJobId: string;
  title: string;
  company: string;
  description: string;
  industry: string;
  jobCategory: 'it' | 'non_it';
  employmentType: string;
  workplaceType: 'remote' | 'hybrid' | 'onsite';
  country: string;
  state?: string;
  city?: string;
  location: string;
  sourceIds: string[];
  sources: string[];
  applicationUrl: string;
  publishedAt: string;
  sourceUpdatedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt?: string;
  status: CanonicalJobStatus;
  contentHash: string;
  isIndiaEligible: boolean;
  tags: string[];
  salary?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobEventType = 'JOB_CREATED' | 'JOB_UPDATED' | 'JOB_EXPIRED';

export interface JobOutboxEvent {
  id?: string;
  eventId: string;
  eventType: JobEventType;
  canonicalJobId: string;
  job: CanonicalJob;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
  claimExpiresAt?: number;
  error?: string;
}

export interface CanonicalJobStats {
  totalActive: number;
  itCount: number;
  nonItCount: number;
  remoteCount: number;
  hybridCount: number;
  officeCount: number;
  indiaEligibleCount: number;
  internationalCount: number;
  governmentCount: number;
  newJobsTodayCount: number;
  sourcesCount: number;
  sources: string[];
  sourceBreakdown: Record<string, number>;
  lastUpdated: string;
}

/**
 * Computes deterministic canonical job ID from normalized metadata
 */
export function computeCanonicalJobId(title: string, company: string, locationOrUrl: string): string {
  const cleanComp = company.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
  const cleanTitl = title.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
  const cleanLoc = locationOrUrl.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
  const rawKey = `${cleanComp}:::${cleanTitl}:::${cleanLoc}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
  return `cjob_${hash}`;
}

/**
 * Computes content hash to detect changes between re-ingestion runs
 */
export function computeContentHash(job: {
  title: string;
  company: string;
  location: string;
  description?: string;
  applicationUrl: string;
}): string {
  const payload = [
    job.title.trim().toLowerCase(),
    job.company.trim().toLowerCase(),
    job.location.trim().toLowerCase(),
    (job.description || '').slice(0, 300).trim(),
    canonicalizeUrl(job.applicationUrl),
  ].join('|||');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Converts a NormalizedJob into a CanonicalJob
 */
export function toCanonicalJob(
  job: NormalizedJob,
  existing?: CanonicalJob | null,
  nowIso = new Date().toISOString()
): CanonicalJob {
  const canonicalUrl = canonicalizeUrl(job.applicationUrl) || job.applicationUrl;
  const canonicalJobId = existing?.canonicalJobId || computeCanonicalJobId(job.title, job.company, canonicalUrl || job.location);
  const contentHash = computeContentHash({
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    applicationUrl: canonicalUrl,
  });

  const resolvedIndustry = job.industry || resolveJobIndustry(
    job.industry,
    job.category,
    job.title,
    job.tags,
    job.description
  );
  const jobCategory: 'it' | 'non_it' = IT_SECTOR_IDS.has(resolvedIndustry) ? 'it' : 'non_it';

  const workplaceType: 'remote' | 'hybrid' | 'onsite' =
    job.workplaceType === 'remote' || job.isRemote
      ? 'remote'
      : job.workplaceType === 'hybrid'
      ? 'hybrid'
      : 'onsite';

  const sourceIds = existing?.sourceIds ? Array.from(new Set([...existing.sourceIds, job.sourceId])) : [job.sourceId];
  const sources = existing?.sources ? Array.from(new Set([...existing.sources, job.sourceName])) : [job.sourceName];

  return {
    id: canonicalJobId,
    canonicalJobId,
    title: job.title,
    company: job.company,
    description: job.description || '',
    industry: resolvedIndustry,
    jobCategory,
    employmentType: job.employmentType || 'full-time',
    workplaceType,
    country: job.isIndiaEligible ? 'India' : 'Global',
    location: job.location || (workplaceType === 'remote' ? 'Remote' : 'Unspecified'),
    sourceIds,
    sources,
    applicationUrl: canonicalUrl,
    publishedAt: job.publishedAt || nowIso,
    sourceUpdatedAt: nowIso,
    firstSeenAt: existing?.firstSeenAt || nowIso,
    lastSeenAt: nowIso,
    status: 'active',
    contentHash,
    isIndiaEligible: Boolean(job.isIndiaEligible),
    tags: Array.from(new Set([...(existing?.tags || []), ...(job.tags || [])])),
    salary: job.salary,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Converts a CanonicalJob into a NormalizedJob for consumer services
 */
export function fromCanonicalJob(canonical: CanonicalJob): NormalizedJob {
  return {
    id: canonical.canonicalJobId,
    sourceId: canonical.sourceIds[0] || 'canonical',
    sourceName: canonical.sources[0] || 'JobNexus Canonical',
    title: canonical.title,
    company: canonical.company,
    location: canonical.location,
    isRemote: canonical.workplaceType === 'remote',
    workplaceType: canonical.workplaceType,
    description: canonical.description,
    applicationUrl: canonical.applicationUrl,
    publishedAt: canonical.publishedAt,
    firstSeenAt: canonical.firstSeenAt,
    lastSeenAt: canonical.lastSeenAt,
    employmentType: canonical.employmentType,
    tags: canonical.tags,
    status: canonical.status === 'withdrawn' ? 'expired' : canonical.status,
    isIndiaEligible: canonical.isIndiaEligible,
    industry: canonical.industry,
    category: canonical.jobCategory === 'it' ? 'Information Technology' : 'Non-IT & Engineering',
    salary: canonical.salary,
    alternateSources: canonical.sources.slice(1).map((s, idx) => ({
      sourceName: s,
      applicationUrl: canonical.applicationUrl,
    })),
  };
}
