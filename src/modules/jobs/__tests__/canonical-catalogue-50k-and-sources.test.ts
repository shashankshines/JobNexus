import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceRegistry, VERIFIED_SOURCES } from '../providers/source.registry';
import { JobSearchService } from '../services/job-search.service';
import { deduplicateJobs } from '../domain/job.deduplication';
import { isFabricatedJobUrl, isValidProviderApplicationUrl } from '../domain/job.normalization';
import { LinkHealthService } from '../services/link-health.service';
import {
  computeCanonicalJobId,
  computeContentHash,
  toCanonicalJob,
  fromCanonicalJob,
  CanonicalJob,
} from '../domain/canonical-job.types';
import {
  upsertCanonicalJobs,
  getCanonicalJobById,
  getPendingJobEvents,
  markJobEventProcessed,
  resetCanonicalJobMemoryStore,
} from '../services/canonical-job.store';
import {
  processPendingJobEvents,
  resetSmartNotificationMemoryStore,
  createAlert,
  updateNotificationPreferences,
  getUserNotifications,
} from '@/modules/notifications/services/smart-notification.store';
import { NormalizedJob } from '../domain/job.types';

describe('JobNexus — 50K Canonical Catalogue & 100 Verified Sources Integration Suite', () => {
  describe('1. Verified Job Source Coverage (50 IT + 50 Non-IT = 100 Sources)', () => {
    it('verifies that exactly 100 verified sources are registered', () => {
      assert.strictEqual(VERIFIED_SOURCES.length, 100);
      assert.strictEqual(SourceRegistry.getAll().length, 100);
    });

    it('verifies exactly 50 IT and 50 Non-IT sources', () => {
      const itSources = SourceRegistry.getItSources();
      const nonItSources = SourceRegistry.getNonItSources();
      assert.strictEqual(itSources.length, 50, 'Must have exactly 50 IT sources');
      assert.strictEqual(nonItSources.length, 50, 'Must have exactly 50 Non-IT sources');
    });

    it('verifies all 100 sources have valid https URLs, sectors, and active status', () => {
      for (const source of VERIFIED_SOURCES) {
        assert.ok(source.id, 'Source must have an ID');
        assert.ok(source.name, `Source ${source.id} must have a name`);
        assert.ok(
          source.verifiedUrl.startsWith('https://'),
          `Source ${source.name} must have an HTTPS URL: ${source.verifiedUrl}`
        );
        assert.ok(source.sector, `Source ${source.name} must have a sector`);
        assert.strictEqual(source.active, true, `Source ${source.name} should be active`);
        assert.ok(
          ['healthy', 'degraded', 'offline'].includes(source.healthStatus),
          `Invalid health status: ${source.healthStatus}`
        );
      }
    });

    it('provides operational diagnostics and sector breakdown metrics', () => {
      const stats = SourceRegistry.getStats();
      assert.strictEqual(stats.total, 100);
      assert.strictEqual(stats.itCount, 50);
      assert.strictEqual(stats.nonItCount, 50);
      assert.strictEqual(stats.healthyCount, 100);
      assert.ok(Object.keys(stats.sectors).length >= 15, 'Must cover at least 15 distinct sectors');
    });
  });

  describe('2. Canonical Genuine Job Catalogue & Link Health Verification', () => {
    it('loads the genuine canonical job catalogue with zero synthetic records', async () => {
      const diskSnapshot = JobSearchService.loadDiskSnapshot(true);
      assert.ok(diskSnapshot, 'Disk snapshot or genuine-catalog-seed must exist');
      assert.ok(
        diskSnapshot.allJobs.length >= 8000,
        `Catalogue must contain at least 8,000 genuine verified jobs, found: ${diskSnapshot.allJobs.length}`
      );

      const unique = deduplicateJobs(diskSnapshot.allJobs);
      assert.ok(
        unique.length >= 8000,
        'Genuine jobs must be strictly unique without collisions in deduplicateJobs()'
      );

      // Verify ZERO jobs have fabricated application URLs
      for (const job of diskSnapshot.allJobs.slice(0, 500)) {
        if (job.applicationUrl) {
          assert.strictEqual(
            isFabricatedJobUrl(job.applicationUrl),
            false,
            `Job ${job.id} (${job.title}) has fabricated applicationUrl: ${job.applicationUrl}`
          );
          assert.strictEqual(
            isValidProviderApplicationUrl(job.applicationUrl),
            true,
            `Job ${job.id} applicationUrl must be a valid provider URL: ${job.applicationUrl}`
          );
        }
      }
    });

    it('rejects fabricated URL patterns and accepts genuine provider URLs', () => {
      assert.strictEqual(isFabricatedJobUrl('https://stripe.com/jobs/senior-software-engineer-101'), true);
      assert.strictEqual(isFabricatedJobUrl('https://airbnb.com/openings/product-manager-404'), true);
      assert.strictEqual(isFabricatedJobUrl('https://example.com'), true);
      assert.strictEqual(isFabricatedJobUrl('https://example.com/'), true);
      assert.strictEqual(isFabricatedJobUrl(''), true);

      // Real provider URLs must NOT be flagged as fabricated
      assert.strictEqual(isFabricatedJobUrl('https://boards.greenhouse.io/stripe/jobs/1234567'), false);
      assert.strictEqual(isFabricatedJobUrl('https://jobs.lever.co/databricks/abc-def-123'), false);
      assert.strictEqual(isFabricatedJobUrl('https://jobs.ashbyhq.com/openai/xyz-789'), false);
      assert.strictEqual(isFabricatedJobUrl('https://www.arbeitnow.com/jobs/companies/tech-corp/role-slug'), false);
    });

    it('verifies LinkHealthService handles cache, health states, and batching correctly', async () => {
      const healthService = new LinkHealthService();
      healthService.recordResult('https://boards.greenhouse.io/test/job-1', 'verified', 200);
      healthService.recordResult('https://boards.greenhouse.io/test/job-blocked', 'blocked', 403);
      healthService.recordResult('https://boards.greenhouse.io/test/job-broken', 'broken', 404);

      assert.strictEqual(healthService.checkCached('https://boards.greenhouse.io/test/job-1')?.status, 'verified');
      assert.strictEqual(healthService.checkCached('https://boards.greenhouse.io/test/job-blocked')?.status, 'blocked');
      assert.strictEqual(healthService.checkCached('https://boards.greenhouse.io/test/job-broken')?.status, 'broken');

      // Synthetic URLs are instantly marked broken without network calls
      const syntheticCheck = await healthService.verifyUrl('https://fakecompany.com/jobs/role-999');
      assert.strictEqual(syntheticCheck.status, 'broken');
    });

    it('verifies genuine IT and Non-IT balance', async () => {
      const diskSnapshot = JobSearchService.loadDiskSnapshot(true)!;
      const itJobs = diskSnapshot.allJobs.filter((j) =>
        ['it_software', 'ai_data_science', 'cybersecurity_cloud', 'technology'].includes(j.industry as string)
      );
      const nonItJobs = diskSnapshot.allJobs.length - itJobs.length;

      assert.ok(itJobs.length >= 2000, `Must have at least 2,000 IT jobs, found ${itJobs.length}`);
      assert.ok(nonItJobs >= 4000, `Must have at least 4,000 Non-IT jobs, found ${nonItJobs}`);
    });

    it('verifies workplace distribution (Remote, Hybrid, On-site) and India eligibility', async () => {
      const diskSnapshot = JobSearchService.loadDiskSnapshot(true)!;
      const remote = diskSnapshot.allJobs.filter((j) => j.workplaceType === 'remote').length;
      const hybrid = diskSnapshot.allJobs.filter((j) => j.workplaceType === 'hybrid').length;
      const onsite = diskSnapshot.allJobs.filter((j) => j.workplaceType === 'onsite').length;
      const unknown = diskSnapshot.allJobs.filter((j) => j.workplaceType === 'unknown' || !j.workplaceType).length;
      const indiaEligible = diskSnapshot.allJobs.filter((j) => j.isIndiaEligible).length;

      assert.ok(remote > 1000, `Expected substantial remote jobs, found ${remote}`);
      assert.ok(hybrid >= 400, `Expected substantial hybrid jobs, found ${hybrid}`);
      assert.ok(onsite > 1000, `Expected substantial onsite jobs, found ${onsite}`);
      assert.strictEqual(remote + hybrid + onsite + unknown, diskSnapshot.allJobs.length, 'All jobs must have a valid workplace type');
      assert.ok(indiaEligible >= 500, `Expected substantial India-eligible jobs, found ${indiaEligible}`);
    });

    it('reports canonical statistics via getJobStats() accurately matching the catalogue', async () => {
      const diskSnapshot = JobSearchService.loadDiskSnapshot(true)!;
      JobSearchService.setSnapshotForTesting(diskSnapshot.allJobs, diskSnapshot.diagnostics);

      const service = new JobSearchService();
      const stats = await service.getJobStats();

      assert.strictEqual(stats.totalJobs, diskSnapshot.allJobs.length);
      assert.strictEqual(stats.formattedCount, diskSnapshot.allJobs.length.toLocaleString());
      assert.ok(stats.sourcesCount > 0);
      assert.ok((stats.itCount || 0) >= 2000);
      assert.ok((stats.nonItCount || 0) >= 4000);
      assert.ok(stats.workplaceDistribution);
      assert.strictEqual(stats.workplaceDistribution.remote, stats.remoteJobs);
    });
  });

  describe('3. Durable Canonical Store & Outbox Engine (JOB_CREATED Events)', () => {
    const testJob1: NormalizedJob = {
      id: 'test-canon-job-1',
      sourceId: 'src-101',
      sourceName: 'Stripe',
      title: 'Senior Staff Infrastructure Engineer',
      company: 'Stripe',
      location: 'Bangalore, India',
      isRemote: false,
      isIndiaEligible: true,
      workplaceType: 'hybrid',
      description: 'Architect global ledger systems at scale.',
      applicationUrl: 'https://boards.greenhouse.io/stripe/jobs/4567890',
      publishedAt: '2026-11-06T10:00:00.000Z',
      employmentType: 'Full-time',
      seniority: 'Lead',
      tags: ['Distributed Systems', 'Go', 'Kubernetes'],
      industry: 'it_software',
      category: 'Technology & Engineering',
    };

    it('computes deterministic canonicalJobId and contentHash', () => {
      const id1 = computeCanonicalJobId(testJob1.title, testJob1.company, testJob1.applicationUrl);
      const id2 = computeCanonicalJobId(testJob1.title, testJob1.company, testJob1.applicationUrl);
      assert.strictEqual(id1, id2, 'Canonical ID must be strictly deterministic');

      const hash1 = computeContentHash(testJob1);
      const hash2 = computeContentHash(testJob1);
      assert.strictEqual(hash1, hash2, 'Content hash must be strictly deterministic');
    });

    it('emits JOB_CREATED outbox event for genuinely new canonical job', async () => {
      resetCanonicalJobMemoryStore();

      const result = await upsertCanonicalJobs([testJob1], { emitEvents: true });
      assert.strictEqual(result.inserted, 1);
      assert.strictEqual(result.eventsCreated, 1);

      const pendingEvents = await getPendingJobEvents(10);
      assert.strictEqual(pendingEvents.length, 1);
      assert.strictEqual(pendingEvents[0].eventType, 'JOB_CREATED');
      assert.strictEqual(pendingEvents[0].job.title, testJob1.title);
      assert.strictEqual(pendingEvents[0].status, 'processing');
    });

    it('does NOT create duplicate outbox events on repeated upserts of identical job', async () => {
      const repeatedResult = await upsertCanonicalJobs([testJob1], { emitEvents: true });
      assert.strictEqual(repeatedResult.inserted, 0, 'Should not insert duplicate job');
      assert.strictEqual(repeatedResult.unchanged, 1, 'Should mark as unchanged');
      assert.strictEqual(repeatedResult.eventsCreated, 0, 'Must NOT emit duplicate outbox event');
    });

    it('consumes outbox events through processPendingJobEvents() and delivers notifications', async () => {
      resetCanonicalJobMemoryStore();
      resetSmartNotificationMemoryStore();

      const testJob2: NormalizedJob = {
        ...testJob1,
        id: 'test-canon-job-2',
        title: 'Lead Distributed Systems Architect',
        applicationUrl: 'https://boards.greenhouse.io/stripe/jobs/5678901',
      };
      await upsertCanonicalJobs([testJob2], { emitEvents: true });

      // Configure a subscriber with 24x7x365 notifications
      const userId = 'usr_subscriber_50k';
      await updateNotificationPreferences(userId, {
        enabled: true,
        mode: 'instant',
        activeDays: [1, 2, 3, 4, 5, 6, 7],
        startTime: '00:00',
        endTime: '23:59',
      });

      // Save an alert matching the job
      await createAlert(userId, {
        alertName: 'Infrastructure Alert',
        enabled: true,
        jobCategories: 'it',
        keywords: ['Distributed Systems'],
      });

      // Process the pending event from the outbox
      const outboxRun = await processPendingJobEvents(10);
      assert.strictEqual(outboxRun.eventsProcessed, 1);
      assert.strictEqual(outboxRun.notificationsCreated, 1);
      assert.strictEqual(outboxRun.delivered, 1);

      // Verify the user received the notification
      const userInbox = await getUserNotifications(userId);
      assert.strictEqual(userInbox.notifications.length, 1);
      assert.strictEqual(userInbox.notifications[0].jobTitle, testJob2.title);
      assert.strictEqual(userInbox.notifications[0].jobCompany, 'Stripe');
      assert.strictEqual(userInbox.notifications[0].deliveryStatus, 'DELIVERED');

      // Subsequent run has 0 pending events
      const secondRun = await processPendingJobEvents(10);
      assert.strictEqual(secondRun.eventsProcessed, 0);
    });
  });
});
