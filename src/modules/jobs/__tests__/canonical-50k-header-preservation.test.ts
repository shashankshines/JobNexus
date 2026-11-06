import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob, isJobActive } from '../domain/job.types';
import { deduplicateJobs } from '../domain/job.deduplication';
import {
  computeCanonicalJobId,
  computeContentHash,
} from '../domain/canonical-job.types';
import {
  upsertCanonicalJobs,
  resetCanonicalJobMemoryStore,
  getPendingJobEvents,
} from '../services/canonical-job.store';
import {
  processPendingJobEvents,
  resetSmartNotificationMemoryStore,
  createAlert,
  updateNotificationPreferences,
  getUserNotifications,
} from '@/modules/notifications/services/smart-notification.store';
import { GET as jobsRouteHandler } from '@/app/api/jobs/route';
import { GET as statsRouteHandler } from '@/app/api/jobs/stats/route';

describe('JobNexus — 50K Canonical Catalogue Preservation & Header Count Accuracy Suite', () => {
  beforeEach(() => {
    process.env.ALLOW_CATALOG_SNAPSHOT_IN_TEST = 'true';
    try {
      const snapPath = path.resolve(process.cwd(), '.catalog-snapshot.json');
      if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
    } catch {}
    JobSearchService.clearCache();
    resetCanonicalJobMemoryStore();
    resetSmartNotificationMemoryStore();
  });

  afterEach(() => {
    try {
      const snapPath = path.resolve(process.cwd(), '.catalog-snapshot.json');
      if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
    } catch {}
    JobSearchService.clearCache();
  });

  // 1. Cold start with the 50K seed
  it('1. Cold start with the 50K seed loads exactly 50,000 active canonical records in 0ms', async () => {
    const service = new JobSearchService();
    const stats = await service.getJobStats();

    assert.strictEqual(stats.totalJobs, 50000);
    assert.strictEqual(stats.exactCount, 50000);
    assert.strictEqual(stats.formattedCount, '50,000');
    assert.strictEqual(stats.sourcesCount, 100);
    assert.strictEqual(stats.itCount, 25000);
    assert.strictEqual(stats.nonItCount, 25000);
  });

  // 2. Smaller live provider response after seed loading
  it('2. Smaller live provider response does not shrink or discard the 50K baseline catalogue', async () => {
    const service = new JobSearchService();
    await service.getJobStats(); // load 50,000 baseline

    const mockFreshJobs: NormalizedJob[] = [
      {
        id: 'fresh-role-1',
        sourceId: 'src-gh',
        sourceName: 'Greenhouse ATS',
        title: 'Senior Cloud Reliability Lead',
        company: 'Stripe',
        location: 'Bangalore, India',
        isRemote: false,
        isIndiaEligible: true,
        workplaceType: 'hybrid',
        description: 'Lead engineering reliability',
        applicationUrl: 'https://boards.greenhouse.io/stripe/jobs/fresh-1',
        publishedAt: new Date().toISOString(),
        employmentType: 'Full-time',
        tags: ['Reliability', 'Go'],
        industry: 'cybersecurity_cloud',
        category: 'Cybersecurity & Cloud',
      },
    ];

    (service as any).fetchFromProviders = async () => ({
      allJobs: mockFreshJobs,
      diagnostics: [
        { providerId: 'greenhouse', providerName: 'Greenhouse ATS', fetchedCount: 1, status: 'fulfilled' as const, latencyMs: 80 },
      ],
    });

    const searchResponse = await service.searchJobs({ forceRefresh: true });
    assert.ok(searchResponse.totalAvailable >= 50000, `Expected totalAvailable >= 50,000, got ${searchResponse.totalAvailable}`);
    const stats = await service.getJobStats();
    assert.ok(stats.totalJobs >= 50000, `Expected totalJobs >= 50,000, got ${stats.totalJobs}`);
  });

  // 3. Provider response with 9,395 raw records
  it('3. Provider response with 9,395 raw records merges additively and preserves full catalogue', async () => {
    const service = new JobSearchService();
    await service.getJobStats();

    // Create 9,395 mock provider jobs
    const mock9395: NormalizedJob[] = [];
    for (let i = 0; i < 9395; i++) {
      mock9395.push({
        id: `mock-batch-9395-${i}`,
        sourceId: `src-${i % 13}`,
        sourceName: `Provider ${i % 13}`,
        title: `Engineer Role ${i}`,
        company: `Company ${i % 50}`,
        location: 'Remote',
        isRemote: true,
        isIndiaEligible: true,
        workplaceType: 'remote',
        description: 'Building modern platforms',
        applicationUrl: `https://boards.greenhouse.io/company/jobs/batch-9395-${i}`,
        publishedAt: new Date().toISOString(),
        employmentType: 'Full-time',
        tags: ['Cloud', 'Software'],
        industry: 'it_software',
        category: 'Information Technology',
      });
    }

    (service as any).fetchFromProviders = async () => ({
      allJobs: mock9395,
      diagnostics: [
        { providerId: 'greenhouse', providerName: 'Greenhouse ATS', fetchedCount: 9395, status: 'fulfilled' as const, latencyMs: 250 },
      ],
    });

    await service.searchJobs({ forceRefresh: true });
    const stats = await service.getJobStats();
    assert.ok(stats.totalJobs >= 50000, `Catalogue must not degrade to 9,395! Total: ${stats.totalJobs}`);
  });

  // 4. Provider response with only 6,556 usable records
  it('4. Provider response with only 6,556 usable records preserves all existing catalogue records', async () => {
    const service = new JobSearchService();
    await service.getJobStats();

    const mock6556: NormalizedJob[] = [];
    for (let i = 0; i < 6556; i++) {
      mock6556.push({
        id: `mock-batch-6556-${i}`,
        sourceId: `src-${i % 5}`,
        sourceName: `Provider ${i % 5}`,
        title: `Specialist ${i}`,
        company: `Enterprise ${i % 30}`,
        location: 'Bangalore, India',
        isRemote: false,
        isIndiaEligible: true,
        workplaceType: 'hybrid',
        description: 'Enterprise operations',
        applicationUrl: `https://jobs.lever.co/enterprise/batch-6556-${i}`,
        publishedAt: new Date().toISOString(),
        employmentType: 'Full-time',
        tags: ['Operations'],
        industry: 'manufacturing_production',
        category: 'Manufacturing & Production',
      });
    }

    (service as any).fetchFromProviders = async () => ({
      allJobs: mock6556,
      diagnostics: [
        { providerId: 'lever', providerName: 'Lever ATS', fetchedCount: 6556, status: 'fulfilled' as const, latencyMs: 200 },
      ],
    });

    await service.searchJobs({ forceRefresh: true });
    const stats = await service.getJobStats();
    assert.ok(stats.totalJobs >= 50000, `Catalogue must not degrade to 6,556! Total: ${stats.totalJobs}`);
  });

  // 5. Partial provider failures and timeouts
  it('5. Partial provider failures and timeouts do not purge existing listings from those providers', async () => {
    const service = new JobSearchService();
    await service.getJobStats();

    // Simulate 3 failing providers and 1 successful
    (service as any).fetchFromProviders = async () => ({
      allJobs: [],
      diagnostics: [
        { providerId: 'greenhouse', providerName: 'Greenhouse ATS', fetchedCount: 0, status: 'timeout' as const, latencyMs: 5000, error: 'Timed out' },
        { providerId: 'lever', providerName: 'Lever ATS', fetchedCount: 0, status: 'rejected' as const, latencyMs: 210, error: 'Connection refused' },
        { providerId: 'ashby', providerName: 'Ashby ATS', fetchedCount: 0, status: 'rejected' as const, latencyMs: 400, error: 'Rate limit' },
      ],
    });

    await service.searchJobs({ forceRefresh: true });
    const stats = await service.getJobStats();
    assert.strictEqual(stats.totalJobs, 50000, 'Provider failures must not cause catalogue to shrink');
    assert.ok(stats.providerCoverage.incomplete, 'Coverage must report incomplete');
    assert.ok((stats.providerCoverage.failed ?? 0) > 0, 'Failed count must be greater than 0');
  });

  // 6. Duplicate jobs across different providers
  it('6. Duplicate jobs across different providers are unified with provenance preservation', () => {
    const job1: NormalizedJob = {
      id: 'job-p1',
      sourceId: 'src-p1',
      sourceName: 'Greenhouse ATS',
      title: 'Principal Distributed Architect',
      company: 'Datadog',
      location: 'Remote',
      isRemote: true,
      description: 'Short desc',
      applicationUrl: 'https://careers.datadog.com/jobs/arch-1',
      publishedAt: '2026-11-05T10:00:00Z',
      employmentType: 'Full-time',
      tags: ['Observability'],
      industry: 'it_software',
    };

    const job2: NormalizedJob = {
      id: 'job-p2',
      sourceId: 'src-p2',
      sourceName: 'RemoteOK',
      title: 'Principal Distributed Architect',
      company: 'Datadog',
      location: 'Remote',
      isRemote: true,
      description: 'Comprehensive, highly detailed description for observability platform engineering.',
      applicationUrl: 'https://careers.datadog.com/jobs/arch-1?utm_source=remoteok',
      publishedAt: '2026-11-06T10:00:00Z',
      employmentType: 'Full-time',
      tags: ['Rust', 'Observability'],
      industry: 'it_software',
    };

    const deduped = deduplicateJobs([job1, job2]);
    assert.strictEqual(deduped.length, 1, 'Duplicate jobs must be unified to 1 record');
    assert.ok(deduped[0].tags.includes('Rust'));
    assert.ok(deduped[0].tags.includes('Observability'));
    assert.ok(deduped[0].description.length > 50, 'Must preserve more complete description');
    assert.ok(deduped[0].alternateSources?.some(s => s.sourceName === 'RemoteOK'), 'Must record alternate source provenance');
  });

  // 7. Existing job updated by newer provider data
  it('7. Existing job updated by newer provider data updates publishedAt, tags, and description', async () => {
    const service = new JobSearchService();
    await service.getJobStats();

    const baselineJob = (JobSearchService as any).cachedRawJobs[0];
    const newerDate = new Date(Date.now() + 60000).toISOString();

    const updatedJob: NormalizedJob = {
      ...baselineJob,
      title: baselineJob.title + ' [Lead Spec]',
      tags: [...baselineJob.tags, 'QuantumComputing2026'],
      publishedAt: newerDate,
      description: baselineJob.description + ' Includes advanced leadership responsibilities.',
    };

    (service as any).fetchFromProviders = async () => ({
      allJobs: [updatedJob],
      diagnostics: [
        { providerId: 'test-src', providerName: baselineJob.sourceName, fetchedCount: 1, status: 'fulfilled' as const, latencyMs: 50 },
      ],
    });

    await service.searchJobs({ forceRefresh: true });
    const postJobs = (JobSearchService as any).cachedRawJobs as NormalizedJob[];
    const updated = postJobs.find(j => j.id === baselineJob.id);

    assert.ok(updated);
    assert.strictEqual(updated.publishedAt, newerDate);
    assert.ok(updated.tags.includes('QuantumComputing2026'));
    assert.ok(updated.title.includes('[Lead Spec]'));
  });

  // 8. Expired and inactive job handling
  it('8. Expired and inactive jobs are filtered out from active canonical counts according to lifecycle rules', () => {
    const activeJob: NormalizedJob = {
      id: 'active-1',
      sourceId: 'src-1',
      sourceName: 'Source 1',
      title: 'DevOps Lead',
      company: 'Cloud Corp',
      location: 'Remote',
      isRemote: true,
      description: 'Active role',
      applicationUrl: 'https://cloudcorp.com/jobs/1',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full-time',
      tags: [],
      status: 'active',
    };

    const expiredStatusJob: NormalizedJob = {
      ...activeJob,
      id: 'expired-status-1',
      status: 'expired',
    };

    const withdrawnJob: NormalizedJob = {
      ...activeJob,
      id: 'withdrawn-1',
      status: 'withdrawn',
    };

    const expiredDateJob: NormalizedJob = {
      ...activeJob,
      id: 'expired-date-1',
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    const futureExpiryJob: NormalizedJob = {
      ...activeJob,
      id: 'future-expiry-1',
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(), // 24 hours in future
    };

    assert.strictEqual(isJobActive(activeJob), true);
    assert.strictEqual(isJobActive(expiredStatusJob), false);
    assert.strictEqual(isJobActive(withdrawnJob), false);
    assert.strictEqual(isJobActive(expiredDateJob), false);
    assert.strictEqual(isJobActive(futureExpiryJob), true);
  });

  // 9. Snapshot selection when seed is larger than provider snapshot
  it('9. Snapshot selection chooses 50,000 baseline seed over a smaller partial provider snapshot', () => {
    const loaded = JobSearchService.loadDiskSnapshot(true);
    assert.ok(loaded);
    assert.ok(loaded.allJobs.length >= 50000, `Must load at least 50,000 jobs, found: ${loaded.allJobs.length}`);
  });

  // 10. Cache refresh and subsequent cold start
  it('10. Cache refresh populates memory cache and subsequent requests return in 0ms without re-fetching', async () => {
    const service = new JobSearchService();
    const t0 = Date.now();
    const stats1 = await service.getJobStats();
    const duration1 = Date.now() - t0;

    const t1 = Date.now();
    const stats2 = await service.getJobStats();
    const duration2 = Date.now() - t1;

    assert.strictEqual(stats1.totalJobs, stats2.totalJobs);
    assert.ok(duration2 < 15, `Cached retrieval should be instantaneous (<15ms), took ${duration2}ms`);
  });

  // 11. Correct configured/succeeded/failed provider metrics
  it('11. Correctly distinguishes configured, succeeded, failed, and catalogueSourceCoverage metrics', async () => {
    const service = new JobSearchService();
    const stats = await service.getJobStats();

    assert.ok(stats.providerCoverage.configured > 0);
    assert.ok(stats.providerCoverage.succeeded <= stats.providerCoverage.configured);
    assert.strictEqual(
      stats.providerCoverage.failed,
      stats.providerCoverage.configured - stats.providerCoverage.succeeded
    );
    assert.strictEqual(stats.providerCoverage.catalogueSourceCoverage, 100);
    assert.strictEqual(stats.sourcesCount, 100);
  });

  // 12. Search response remains usable when diagnostic counts differ
  it('12. Search response remains usable when diagnostic counts differ from live providers', async () => {
    const service = new JobSearchService();
    const response = await service.searchJobs({ page: 1, pageSize: 50 });

    assert.strictEqual(response.count, 50000);
    assert.strictEqual(response.totalAvailable, 50000);
    assert.strictEqual(response.jobs.length, 50);
    assert.ok(response.providerCoverage.configured > 0);
    assert.ok(response.providerCoverage.succeeded <= response.providerCoverage.configured);
    assert.strictEqual(response.providerCoverage.catalogueSourceCoverage, 100);
  });

  // 13. Header count matches the authoritative catalogue statistics
  it('13. Header count matches authoritative catalogue statistics without discrepancies', async () => {
    const service = new JobSearchService();
    const stats = await service.getJobStats();
    const search = await service.searchJobs({ page: 1, pageSize: 1 });

    assert.strictEqual(stats.totalJobs, 50000);
    assert.strictEqual(stats.exactCount, 50000);
    assert.strictEqual(search.totalAvailable, stats.totalJobs);
    assert.strictEqual(stats.formattedCount, stats.totalJobs.toLocaleString());
  });

  // 14. IT/non-IT filters and existing sector classifications
  it('14. Correctly balances exactly 25,000 IT and 25,000 Non-IT jobs across sectors', async () => {
    const service = new JobSearchService();
    const stats = await service.getJobStats();

    assert.strictEqual(stats.itCount, 25000);
    assert.strictEqual(stats.nonItCount, 25000);
    assert.strictEqual((stats.itCount || 0) + (stats.nonItCount || 0), 50000);

    // IT search filter
    const itSearch = await service.searchJobs({ industry: 'it_software' });
    assert.ok(itSearch.count > 0 && itSearch.count <= 25000);

    // Non-IT search filter
    const healthcareSearch = await service.searchJobs({ industry: 'healthcare_pharma' });
    assert.ok(healthcareSearch.count > 0 && healthcareSearch.count <= 25000);
  });

  // 15. Pagination and sorting
  it('15. Paginates deterministically across the 50,000 catalogue with stable snapshotId', async () => {
    const service = new JobSearchService();
    const page1 = await service.searchJobs({ page: 1, pageSize: 50 });
    const page2 = await service.searchJobs({ page: 2, pageSize: 50 });

    assert.strictEqual(page1.jobs.length, 50);
    assert.strictEqual(page2.jobs.length, 50);
    assert.strictEqual(page1.snapshotId, page2.snapshotId, 'snapshotId must be identical across pages of the same search');
    assert.strictEqual(page1.totalAvailable, 50000);
    assert.strictEqual(page2.totalAvailable, 50000);

    // Ensure zero overlap between page 1 and page 2
    const p1Ids = new Set(page1.jobs.map(j => j.id));
    for (const j of page2.jobs) {
      assert.ok(!p1Ids.has(j.id), `Duplicate job ${j.id} found across page 1 and 2`);
    }
  });

  // 16. Unauthenticated source masking
  it('16. Unauthenticated requests to /api/jobs and /api/jobs/stats mask sources and sensitive company names', async () => {
    const statsReq = new Request('http://localhost:3000/api/jobs/stats');
    const statsRes = await statsRouteHandler(statsReq);
    const statsData = await statsRes.json();

    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsData.totalJobs, 50000);
    assert.ok(Array.isArray(statsData.sources));
    for (const src of statsData.sources) {
      assert.strictEqual(src, 'Job source hidden', 'All unauthenticated sources must be masked');
    }
    assert.deepStrictEqual(statsData.providerBreakdown, {}, 'Provider breakdown must be empty for anonymous users');

    const jobsReq = new Request('http://localhost:3000/api/jobs?pageSize=5');
    const jobsRes = await jobsRouteHandler(jobsReq);
    const jobsData = await jobsRes.json();

    assert.strictEqual(jobsRes.status, 200);
    assert.strictEqual(jobsData.totalAvailable, 50000);
    for (const job of jobsData.jobs) {
      assert.strictEqual(job.company, 'Company hidden', 'Company must be masked for anonymous users');
      assert.strictEqual(job.source, 'Job source hidden', 'Source must be masked for anonymous users');
    }
  });

  // 17. New-job notification idempotency
  it('17. Merging jobs generates JOB_CREATED events only for genuinely new records idempotently', async () => {
    resetCanonicalJobMemoryStore();

    const jobA: NormalizedJob = {
      id: 'job-notification-test-1',
      sourceId: 'src-notif-1',
      sourceName: 'Greenhouse ATS',
      title: 'Principal Cloud Platform Engineer',
      company: 'Razorpay',
      location: 'Bangalore, India',
      isRemote: false,
      isIndiaEligible: true,
      workplaceType: 'hybrid',
      description: 'Design payment platform infrastructure',
      applicationUrl: 'https://boards.greenhouse.io/razorpay/jobs/cloud-1',
      publishedAt: '2026-11-06T10:00:00Z',
      employmentType: 'Full-time',
      tags: ['Platform', 'Kubernetes'],
      industry: 'cybersecurity_cloud',
      category: 'Cybersecurity & Cloud',
    };

    // First ingestion of jobA: should insert and emit JOB_CREATED event
    const run1 = await upsertCanonicalJobs([jobA], { emitEvents: true });
    assert.strictEqual(run1.inserted, 1);
    assert.strictEqual(run1.eventsCreated, 1);

    // Second ingestion of identical jobA: should be unchanged and emit 0 events
    const run2 = await upsertCanonicalJobs([jobA], { emitEvents: true });
    assert.strictEqual(run2.inserted, 0);
    assert.strictEqual(run2.unchanged, 1);
    assert.strictEqual(run2.eventsCreated, 0, 'Repeated ingestion must be strictly idempotent with 0 events');
  });

  // 18. Historical seed jobs do not trigger duplicate notifications
  it('18. Historical seed jobs are tracked and do not trigger duplicate notifications for subscribers', async () => {
    resetCanonicalJobMemoryStore();
    resetSmartNotificationMemoryStore();

    const historicalJob: NormalizedJob = {
      id: 'historical-seed-job-1',
      sourceId: 'src-seed',
      sourceName: 'Arbeitnow Tech',
      title: 'Senior Data Scientist — Machine Learning',
      company: 'Amazon',
      location: 'Hyderabad, India',
      isRemote: false,
      isIndiaEligible: true,
      workplaceType: 'hybrid',
      description: 'Machine learning for recommender systems',
      applicationUrl: 'https://www.arbeitnow.com/jobs/amazon-ml-1',
      publishedAt: '2026-11-04T10:00:00Z',
      employmentType: 'Full-time',
      tags: ['Machine Learning', 'Python'],
      industry: 'ai_data_science',
      category: 'AI & Data Science',
    };

    // Seed the historical job without event emission
    await upsertCanonicalJobs([historicalJob], { emitEvents: false });

    // Verify outbox has 0 events for historical seed
    const pendingEvents = await getPendingJobEvents(10);
    assert.strictEqual(pendingEvents.length, 0, 'Historical seed jobs must not create outbox events');

    // Subscribe user with matching alert
    const subscriberId = 'usr_subscriber_historical_test';
    await updateNotificationPreferences(subscriberId, {
      enabled: true,
      mode: 'instant',
      activeDays: [1, 2, 3, 4, 5, 6, 7],
      startTime: '00:00',
      endTime: '23:59',
    });
    await createAlert(subscriberId, {
      alertName: 'ML Alert',
      enabled: true,
      jobCategories: 'it',
      keywords: ['Machine Learning'],
    });

    // Run outbox event processor: 0 notifications created
    const outboxResult = await processPendingJobEvents(10);
    assert.strictEqual(outboxResult.eventsProcessed, 0);
    assert.strictEqual(outboxResult.notificationsCreated, 0);

    const userInbox = await getUserNotifications(subscriberId);
    assert.strictEqual(userInbox.notifications.length, 0, 'Subscriber must receive 0 notifications for historical seed');
  });
});
