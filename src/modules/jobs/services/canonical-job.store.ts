/**
 * JobNexus — Durable Canonical Job Store & Outbox Engine
 * Manages atomic persistence, deterministic deduplication, first-seen tracking,
 * and reliable JOB_CREATED event generation for 50,000+ canonical jobs.
 */

import { DurableStore } from '@/modules/storage/durable.store';
import { isFirestoreConfigured } from '@/modules/storage/firestore/client';
import {
  getCanonicalJobsCollection,
  getJobEventsOutboxCollection,
} from '@/modules/storage/firestore/collections';
import { NormalizedJob, JobSearchParams } from '../domain/job.types';
import {
  CanonicalJob,
  JobOutboxEvent,
  CanonicalJobStats,
  computeCanonicalJobId,
  computeContentHash,
  toCanonicalJob,
  fromCanonicalJob,
} from '../domain/canonical-job.types';
import { isValidJobApplicationUrl } from '@/modules/notifications/services/smart-notification.store';
import { filterAndRankJobs } from '../domain/job.ranking';

export const EVENT_CLAIM_LEASE_DURATION_MS = 60 * 1000; // 60s lease

interface GlobalCanonicalStoreRegistry {
  canonicalJobs: DurableStore<CanonicalJob>;
  jobEventsOutbox: DurableStore<JobOutboxEvent>;
  memoryCanonicalJobs: Map<string, CanonicalJob>;
  memoryEvents: Map<string, JobOutboxEvent>;
}

const globalForCanonical = globalThis as unknown as {
  __jobnexus_canonical_registry?: GlobalCanonicalStoreRegistry;
};

if (!globalForCanonical.__jobnexus_canonical_registry) {
  globalForCanonical.__jobnexus_canonical_registry = {
    canonicalJobs: new DurableStore<CanonicalJob>('canonical_jobs'),
    jobEventsOutbox: new DurableStore<JobOutboxEvent>('job_events_outbox'),
    memoryCanonicalJobs: new Map<string, CanonicalJob>(),
    memoryEvents: new Map<string, JobOutboxEvent>(),
  };
}

const durableJobs = globalForCanonical.__jobnexus_canonical_registry.canonicalJobs;
const durableEvents = globalForCanonical.__jobnexus_canonical_registry.jobEventsOutbox;
const memoryJobs = globalForCanonical.__jobnexus_canonical_registry.memoryCanonicalJobs;
const memoryEvents = globalForCanonical.__jobnexus_canonical_registry.memoryEvents;

/**
 * Resets memory state (useful for hermetic tests)
 */
export function resetCanonicalJobMemoryStore(): void {
  memoryJobs.clear();
  memoryEvents.clear();
  try {
    durableJobs.clear();
    durableEvents.clear();
  } catch {
    // Ignore clear errors in memory mode
  }
}

/**
 * Loads a canonical job by its deterministic canonicalJobId
 */
export async function getCanonicalJobById(canonicalJobId: string): Promise<CanonicalJob | null> {
  const cached = memoryJobs.get(canonicalJobId) || durableJobs.get(canonicalJobId);
  if (cached) return cached;

  if (isFirestoreConfigured()) {
    try {
      const snap = await getCanonicalJobsCollection<CanonicalJob>().doc(canonicalJobId).get();
      if (snap.exists && snap.data()) {
        const data = snap.data()!;
        memoryJobs.set(canonicalJobId, data);
        return data;
      }
    } catch {
      // Best-effort
    }
  }

  return null;
}

/**
 * Upserts normalized jobs into the canonical store.
 * Strictly distinguishes genuinely new canonical records from updates or duplicate provider listings.
 * Only genuinely new canonical records trigger a JOB_CREATED event in the outbox.
 */
export async function upsertCanonicalJobs(
  jobs: NormalizedJob[],
  options: { emitEvents?: boolean; sourceId?: string } = {}
): Promise<{
  inserted: number;
  updated: number;
  unchanged: number;
  eventsCreated: number;
  canonicalJobs: CanonicalJob[];
}> {
  const emitEvents = options.emitEvents !== false;
  const nowIso = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let eventsCreated = 0;
  const processedCanonicalJobs: CanonicalJob[] = [];

  for (const job of jobs) {
    if (!job || !job.title || !job.company) continue;
    // Security & link validation: skip jobs with malicious or invalid URLs
    if (job.applicationUrl && !isValidJobApplicationUrl(job.applicationUrl)) {
      continue;
    }

    const canonicalJobId = computeCanonicalJobId(job.title, job.company, job.applicationUrl || job.location);
    const existing = memoryJobs.get(canonicalJobId) || durableJobs.get(canonicalJobId);

    if (!existing) {
      // 1. Genuinely NEW canonical job record
      const canonical = toCanonicalJob(job, null, nowIso);
      memoryJobs.set(canonicalJobId, canonical);
      durableJobs.set(canonicalJobId, canonical);
      inserted++;
      processedCanonicalJobs.push(canonical);

      // Create durable JOB_CREATED event for outbox
      if (emitEvents) {
        const eventId = `evt_job_created_${canonicalJobId}`;
        const eventDoc: JobOutboxEvent = {
          eventId,
          eventType: 'JOB_CREATED',
          canonicalJobId,
          job: canonical,
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          createdAt: nowIso,
        };
        memoryEvents.set(eventId, eventDoc);
        durableEvents.set(eventId, eventDoc);
        eventsCreated++;

        if (isFirestoreConfigured()) {
          try {
            await getJobEventsOutboxCollection<JobOutboxEvent>().doc(eventId).set(eventDoc);
          } catch {
            // Memory/durable fallback
          }
        }
      }

      if (isFirestoreConfigured()) {
        try {
          await getCanonicalJobsCollection<CanonicalJob>().doc(canonicalJobId).set(canonical);
        } catch {
          // Memory/durable fallback
        }
      }
    } else {
      // 2. Existing canonical job: Check contentHash
      const currentHash = computeContentHash({
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        applicationUrl: job.applicationUrl,
      });

      const updatedSources = Array.from(new Set([...existing.sources, job.sourceName]));
      const updatedSourceIds = Array.from(new Set([...existing.sourceIds, job.sourceId]));

      if (existing.contentHash === currentHash) {
        // Unchanged listing re-ingested from a provider
        existing.lastSeenAt = nowIso;
        existing.sources = updatedSources;
        existing.sourceIds = updatedSourceIds;
        existing.status = 'active';
        durableJobs.set(canonicalJobId, existing);
        unchanged++;
      } else {
        // Content changed on job listing (e.g. updated description or salary)
        existing.contentHash = currentHash;
        existing.title = job.title;
        existing.description = job.description || existing.description;
        existing.location = job.location || existing.location;
        existing.lastSeenAt = nowIso;
        existing.updatedAt = nowIso;
        existing.sources = updatedSources;
        existing.sourceIds = updatedSourceIds;
        existing.status = 'active';
        durableJobs.set(canonicalJobId, existing);
        updated++;
      }
      processedCanonicalJobs.push(existing);
    }
  }

  return {
    inserted,
    updated,
    unchanged,
    eventsCreated,
    canonicalJobs: processedCanonicalJobs,
  };
}

/**
 * Retrieves pending job outbox events with atomic claim leases
 */
export async function getPendingJobEvents(batchSize = 50): Promise<JobOutboxEvent[]> {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const claimExpiresAt = now + EVENT_CLAIM_LEASE_DURATION_MS;
  const eligibleEvents: JobOutboxEvent[] = [];

  // Check memory / durable events
  for (const event of memoryEvents.values()) {
    if (
      event.status === 'pending' ||
      (event.status === 'processing' && event.claimExpiresAt && event.claimExpiresAt < now)
    ) {
      event.status = 'processing';
      event.claimExpiresAt = claimExpiresAt;
      event.attempts++;
      eligibleEvents.push(event);
      if (eligibleEvents.length >= batchSize) break;
    }
  }

  if (eligibleEvents.length === 0) {
    for (const event of durableEvents.values()) {
      if (
        event.status === 'pending' ||
        (event.status === 'processing' && event.claimExpiresAt && event.claimExpiresAt < now)
      ) {
        event.status = 'processing';
        event.claimExpiresAt = claimExpiresAt;
        event.attempts++;
        durableEvents.set(event.eventId, event);
        eligibleEvents.push(event);
        if (eligibleEvents.length >= batchSize) break;
      }
    }
  }

  return eligibleEvents;
}

/**
 * Marks an outbox event as successfully processed
 */
export async function markJobEventProcessed(eventId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const event = memoryEvents.get(eventId) || durableEvents.get(eventId);
  if (event) {
    event.status = 'processed';
    event.processedAt = nowIso;
    delete event.claimExpiresAt;
    memoryEvents.set(eventId, event);
    durableEvents.set(eventId, event);
  }

  if (isFirestoreConfigured()) {
    try {
      await getJobEventsOutboxCollection().doc(eventId).update({
        status: 'processed',
        processedAt: nowIso,
      });
    } catch {
      // Memory fallback
    }
  }

  return true;
}

/**
 * Marks an outbox event as failed with retry/dead-letter status
 */
export async function markJobEventFailed(eventId: string, error: string): Promise<boolean> {
  const event = memoryEvents.get(eventId) || durableEvents.get(eventId);
  if (event) {
    event.error = error;
    if (event.attempts >= event.maxAttempts) {
      event.status = 'failed';
    } else {
      event.status = 'pending'; // retryable
    }
    delete event.claimExpiresAt;
    memoryEvents.set(eventId, event);
    durableEvents.set(eventId, event);
  }

  return true;
}

/**
 * Computes accurate canonical job statistics
 */
export function calculateCanonicalStats(canonicalJobs: CanonicalJob[]): CanonicalJobStats {
  const activeJobs = canonicalJobs.filter((j) => j.status === 'active');
  const totalActive = activeJobs.length;

  let itCount = 0;
  let nonItCount = 0;
  let remoteCount = 0;
  let hybridCount = 0;
  let officeCount = 0;
  let indiaEligibleCount = 0;
  let internationalCount = 0;
  let governmentCount = 0;
  const sourcesSet = new Set<string>();
  const sourceBreakdown: Record<string, number> = {};

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();
  let newJobsTodayCount = 0;

  for (const job of activeJobs) {
    if (job.jobCategory === 'it') {
      itCount++;
    } else {
      nonItCount++;
    }

    if (job.workplaceType === 'remote') {
      remoteCount++;
    } else if (job.workplaceType === 'hybrid') {
      hybridCount++;
    } else {
      officeCount++;
    }

    if (job.isIndiaEligible) {
      indiaEligibleCount++;
    } else {
      internationalCount++;
    }

    if (job.industry === 'government_public') {
      governmentCount++;
    }

    if (new Date(job.publishedAt || job.firstSeenAt).getTime() >= todayTimestamp) {
      newJobsTodayCount++;
    }

    for (const src of job.sources) {
      sourcesSet.add(src);
      sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
    }
  }

  return {
    totalActive,
    itCount,
    nonItCount,
    remoteCount,
    hybridCount,
    officeCount,
    indiaEligibleCount,
    internationalCount,
    governmentCount,
    newJobsTodayCount,
    sourcesCount: sourcesSet.size,
    sources: Array.from(sourcesSet),
    sourceBreakdown,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Searches and filters canonical jobs
 */
export function queryCanonicalJobs(
  canonicalJobs: CanonicalJob[],
  params: JobSearchParams = {}
): { jobs: NormalizedJob[]; totalCount: number } {
  const normalized = canonicalJobs.map(fromCanonicalJob);
  const ranked = filterAndRankJobs(normalized, params);
  return {
    jobs: ranked,
    totalCount: ranked.length,
  };
}
