import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob } from '../domain/job.types';
import { GET as jobsRouteHandler } from '../../../app/api/jobs/route';
import { GET as statsRouteHandler } from '../../../app/api/jobs/stats/route';

const createMockJob = (id: string, overrides: Partial<NormalizedJob> = {}): NormalizedJob => ({
  id,
  sourceId: id,
  sourceName: 'MockProvider',
  title: 'Senior TypeScript Engineer',
  company: 'Tech Corp',
  location: 'Remote',
  isRemote: true,
  description: 'Building next-gen platforms',
  applicationUrl: `https://techcorp.com/jobs/${id}`,
  publishedAt: new Date().toISOString(),
  employmentType: 'Full Time',
  tags: ['typescript', 'react'],
  isIndiaEligible: true,
  ...overrides,
});

class MockProvider implements JobProvider {
  constructor(
    readonly id: string,
    readonly name: string,
    private jobs: NormalizedJob[] = []
  ) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    return this.jobs;
  }
}

class FailingMockProvider implements JobProvider {
  constructor(
    readonly id: string,
    readonly name: string
  ) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    throw new Error('Connection refused to provider feed');
  }
}

describe('JobSearchService.getJobStats Suite', () => {
  beforeEach(() => {
    JobSearchService.clearCache();
  });

  it('computes correct job stats from a single provider', async () => {
    const jobs = [
      createMockJob('job-1', { title: 'Senior Frontend Engineer', isRemote: true, isIndiaEligible: true }),
      createMockJob('job-2', { title: 'Lead Backend Engineer', isRemote: false, isIndiaEligible: false }),
    ];
    const service = new JobSearchService([new MockProvider('p1', 'Provider 1', jobs)]);

    const stats = await service.getJobStats();
    assert.strictEqual(stats.totalJobs, 2);
    assert.strictEqual(stats.exactCount, 2);
    assert.strictEqual(stats.formattedCount, '2+');
    assert.strictEqual(stats.remoteJobs, 1);
    assert.strictEqual(stats.indiaEligibleJobs, 1);
    assert.strictEqual(stats.sourcesCount, 1);
    assert.deepStrictEqual(stats.sources, ['Provider 1']);
    assert.strictEqual(stats.providerBreakdown['Provider 1'], 2);
    assert.ok(stats.lastUpdated);
  });

  it('aggregates jobs and deduplicates accurately across multiple providers', async () => {
    // Both providers return the same canonical job URL
    const jobA = createMockJob('a-1', {
      title: 'Staff Engineer',
      company: 'Unified Inc',
      applicationUrl: 'https://unified.inc/careers/staff-eng',
    });
    const jobB = createMockJob('b-1', {
      title: 'Staff Engineer',
      company: 'Unified Inc',
      applicationUrl: 'https://unified.inc/careers/staff-eng', // Duplicate
    });
    const jobC = createMockJob('c-1', {
      title: 'Product Designer',
      company: 'DesignWorks',
      applicationUrl: 'https://designworks.io/apply/1',
      isRemote: true,
    });

    const service = new JobSearchService([
      new MockProvider('prov-a', 'Provider Alpha', [jobA]),
      new MockProvider('prov-b', 'Provider Beta', [jobB, jobC]),
    ]);

    const stats = await service.getJobStats();
    // After deduplication, jobA and jobB are unified, resulting in 2 unique jobs
    assert.strictEqual(stats.totalJobs, 2);
    assert.strictEqual(stats.formattedCount, '2+');
    assert.strictEqual(stats.sourcesCount, 2);
    assert.strictEqual(stats.providerBreakdown['Provider Alpha'], 1);
    assert.strictEqual(stats.providerBreakdown['Provider Beta'], 2);
  });

  it('handles empty provider feeds gracefully', async () => {
    const service = new JobSearchService([new MockProvider('empty-p', 'EmptyProvider', [])]);
    const stats = await service.getJobStats();

    assert.strictEqual(stats.totalJobs, 0);
    assert.strictEqual(stats.formattedCount, '0');
    assert.strictEqual(stats.remoteJobs, 0);
    assert.strictEqual(stats.indiaEligibleJobs, 0);
    assert.strictEqual(stats.providerBreakdown['EmptyProvider'], 0);
  });

  it('remains resilient when one or more providers fail', async () => {
    const healthyJob = createMockJob('healthy-1');
    const service = new JobSearchService([
      new MockProvider('healthy-p', 'Healthy Source', [healthyJob]),
      new FailingMockProvider('failing-p', 'Failing Source'),
    ]);

    const stats = await service.getJobStats();
    // Healthy source jobs must still be aggregated
    assert.strictEqual(stats.totalJobs, 1);
    assert.strictEqual(stats.formattedCount, '1+');
    assert.strictEqual(stats.providerBreakdown['Healthy Source'], 1);
    assert.strictEqual(stats.providerBreakdown['Failing Source'], 0);
  });
});

describe('Live Job Stats API Routes', () => {
  it('GET /api/jobs?stats=true returns valid real-time stats', async () => {
    const req = new Request('http://localhost:3000/api/jobs?stats=true');
    const res = await jobsRouteHandler(req);

    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.ok(typeof data.totalJobs === 'number');
    assert.ok(data.totalJobs > 0);
    assert.ok(typeof data.formattedCount === 'string');
    assert.ok(data.formattedCount.endsWith('+'));
    assert.ok(Array.isArray(data.sources));
    assert.strictEqual(data.sourcesCount, data.sources.length);
    assert.ok(data.providerBreakdown);
  });

  it('GET /api/jobs/stats returns valid real-time stats payload with caching headers', async () => {
    const res = await statsRouteHandler();

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('cache-control')?.includes('public'));

    const data = await res.json();
    assert.ok(typeof data.totalJobs === 'number');
    assert.ok(data.totalJobs > 0);
    assert.strictEqual(data.exactCount, data.totalJobs);
    assert.ok(typeof data.remoteJobs === 'number');
    assert.ok(typeof data.indiaEligibleJobs === 'number');
    assert.ok(data.lastUpdated);
  });
});
