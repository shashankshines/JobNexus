import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob } from '../domain/job.types';

const mockHealthyJob: NormalizedJob = {
  id: 'test-1',
  sourceId: '101',
  sourceName: 'HealthyProvider',
  title: 'Full Stack Engineer',
  company: 'InnovateCorp',
  location: 'Remote',
  isRemote: true,
  description: 'Building modern web applications',
  applicationUrl: 'https://innovatecorp.com/apply/101',
  publishedAt: new Date().toISOString(),
  employmentType: 'Full Time',
  tags: ['nextjs', 'react', 'typescript'],
};

class HealthyProvider implements JobProvider {
  readonly id = 'healthy';
  readonly name = 'HealthyProvider';
  async fetchJobs(): Promise<NormalizedJob[]> {
    return [mockHealthyJob];
  }
}

class EmptyProvider implements JobProvider {
  readonly id = 'empty';
  readonly name = 'EmptyProvider';
  async fetchJobs(): Promise<NormalizedJob[]> {
    return [];
  }
}

class FailingProvider implements JobProvider {
  readonly id = 'failing';
  readonly name = 'FailingProvider';
  async fetchJobs(): Promise<NormalizedJob[]> {
    throw new Error('Connection reset by peer');
  }
}

class TimeoutProvider implements JobProvider {
  readonly id = 'timeout';
  readonly name = 'TimeoutProvider';
  async fetchJobs(): Promise<NormalizedJob[]> {
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'AbortError';
    throw error;
  }
}

class StaticProvider implements JobProvider {
  readonly id = 'static';
  readonly name = 'StaticProvider';

  constructor(private readonly jobs: NormalizedJob[]) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    return this.jobs;
  }
}

describe('JobSearchService Integration & Resilience Tests', () => {
  it('aggregates jobs from healthy providers successfully', async () => {
    const service = new JobSearchService([new HealthyProvider()]);
    const response = await service.searchJobs({ query: 'Full Stack' });

    assert.strictEqual(response.count, 1);
    assert.strictEqual(response.jobs[0].title, 'Full Stack Engineer');
    assert.strictEqual(response.jobs[0].source, 'HealthyProvider');
    assert.strictEqual(response.jobs[0].url, 'https://innovatecorp.com/apply/101');
    assert.strictEqual(response.sources[0], 'HealthyProvider');
  });

  it('handles empty provider response without crashing', async () => {
    const service = new JobSearchService([new EmptyProvider()]);
    const response = await service.searchJobs({ query: 'Engineer' });

    assert.strictEqual(response.count, 0);
    assert.deepStrictEqual(response.jobs, []);
  });

  it('guarantees partial failure resilience: failing and timed-out providers do not break healthy results', async () => {
    const service = new JobSearchService([
      new HealthyProvider(),
      new FailingProvider(),
      new TimeoutProvider(),
    ]);

    const response = await service.searchJobs({ query: 'Engineer' });

    // Healthy provider results must still be returned!
    assert.strictEqual(response.count, 1);
    assert.strictEqual(response.jobs[0].title, 'Full Stack Engineer');

    // Diagnostics should report statuses accurately
    assert.ok(response.diagnostics);
    const healthyDiag = response.diagnostics.find((d) => d.providerId === 'healthy');
    const failingDiag = response.diagnostics.find((d) => d.providerId === 'failing');
    const timeoutDiag = response.diagnostics.find((d) => d.providerId === 'timeout');

    assert.strictEqual(healthyDiag?.status, 'fulfilled');
    assert.strictEqual(failingDiag?.status, 'rejected');
    assert.strictEqual(timeoutDiag?.status, 'timeout');
    assert.strictEqual(response.providerCoverage.configured, 3);
    assert.strictEqual(response.providerCoverage.succeeded, 1);
    assert.strictEqual(response.providerCoverage.incomplete, true);
  });

  it('preserves exact legacy contract structure for frontend consumption', async () => {
    const service = new JobSearchService([new HealthyProvider()]);
    const response = await service.searchJobs({});

    assert.ok(Array.isArray(response.jobs));
    assert.ok(typeof response.count === 'number');
    assert.ok(Array.isArray(response.sources));

    const sampleJob = response.jobs[0];
    assert.ok('id' in sampleJob);
    assert.ok('title' in sampleJob);
    assert.ok('company' in sampleJob);
    assert.ok('location' in sampleJob);
    assert.ok('type' in sampleJob);
    assert.ok('url' in sampleJob);
    assert.ok('date' in sampleJob);
    assert.ok('source' in sampleJob);
    assert.ok('tags' in sampleJob);
    assert.ok('description' in sampleJob);
  });

  it('keeps selected role filters independent in search results and cache keys', async () => {
    const service = new JobSearchService([
      new StaticProvider([
        {
          ...mockHealthyJob,
          id: 'frontend',
          sourceId: 'frontend',
          applicationUrl: 'https://innovatecorp.com/jobs/frontend',
          title: 'Frontend Developer',
        },
        {
          ...mockHealthyJob,
          id: 'backend',
          sourceId: 'backend',
          applicationUrl: 'https://innovatecorp.com/jobs/backend',
          title: 'Backend Developer',
        },
      ]),
    ]);

    const frontend = await service.searchJobs({ role: 'Frontend Developer' });
    const backend = await service.searchJobs({ role: 'Backend Developer' });

    assert.deepStrictEqual(frontend.jobs.map((job) => job.id), ['frontend']);
    assert.deepStrictEqual(backend.jobs.map((job) => job.id), ['backend']);
  });

  it('reports the full matching count and response truncation separately', async () => {
    const jobs = Array.from({ length: 260 }, (_, index) => ({
      ...mockHealthyJob,
      id: `job-${String(index).padStart(3, '0')}`,
      sourceId: String(index),
      applicationUrl: `https://innovatecorp.com/jobs/${index}`,
      title: `Software Engineer ${index}`,
      industry: 'technology',
    }));
    const service = new JobSearchService([new StaticProvider(jobs)]);

    const response = await service.searchJobs({});

    assert.strictEqual(response.count, 260);
    assert.strictEqual(response.returnedCount, 250);
    assert.strictEqual(response.jobs.length, 250);
    assert.strictEqual(response.truncated, true);
    assert.strictEqual((await service.searchJobs({ limit: 500 })).returnedCount, 250);

    const beyondLegacyCap = await service.getJobById('job-259');
    assert.strictEqual(beyondLegacyCap?.id, 'job-259');
  });

  it('paginates beyond the legacy 250-job response cap without duplicate records', async () => {
    const jobs = Array.from({ length: 260 }, (_, index) => ({
      ...mockHealthyJob,
      id: `page-job-${String(index).padStart(3, '0')}`,
      sourceId: `page-${index}`,
      applicationUrl: `https://innovatecorp.com/jobs/page-${index}`,
      title: `Software Engineer ${index}`,
      industry: 'technology',
    }));
    const service = new JobSearchService([new StaticProvider(jobs)]);
    const firstPage = await service.searchJobs({ industry: 'technology', page: 1, pageSize: 100 });
    const secondPage = await service.searchJobs({ industry: 'technology', page: 2, pageSize: 100 });
    const thirdPage = await service.searchJobs({ industry: 'technology', page: 3, pageSize: 100 });

    assert.strictEqual(firstPage.count, 260);
    assert.strictEqual(firstPage.totalAvailable, 260);
    assert.strictEqual(firstPage.returnedCount, 100);
    assert.strictEqual(firstPage.hasMore, true);
    assert.strictEqual(secondPage.returnedCount, 100);
    assert.strictEqual(secondPage.hasMore, true);
    assert.strictEqual(thirdPage.returnedCount, 60);
    assert.strictEqual(thirdPage.hasMore, false);
    assert.strictEqual(firstPage.snapshotId, secondPage.snapshotId);
    assert.strictEqual(secondPage.snapshotId, thirdPage.snapshotId);

    const allIds = [
      ...firstPage.jobs,
      ...secondPage.jobs,
      ...thirdPage.jobs,
    ].map((job) => job.id);
    assert.strictEqual(new Set(allIds).size, 260);
  });

  it('sorts freshest-first before slicing pages with deterministic ties', async () => {
    const jobs = [
      { ...mockHealthyJob, id: 'old', sourceId: 'old', applicationUrl: 'https://innovatecorp.com/jobs/old', title: 'Role Old', publishedAt: '2025-01-01T00:00:00.000Z' },
      { ...mockHealthyJob, id: 'newer-b', sourceId: 'newer-b', applicationUrl: 'https://innovatecorp.com/jobs/newer-b', title: 'Role Newer B', publishedAt: '2025-03-01T00:00:00.000Z' },
      { ...mockHealthyJob, id: 'newer-a', sourceId: 'newer-a', applicationUrl: 'https://innovatecorp.com/jobs/newer-a', title: 'Role Newer A', publishedAt: '2025-03-01T00:00:00.000Z' },
    ];
    const service = new JobSearchService([new StaticProvider(jobs)]);

    const firstPage = await service.searchJobs({ sort: 'date', page: 1, pageSize: 2 });
    const secondPage = await service.searchJobs({ sort: 'date', page: 2, pageSize: 2 });

    assert.deepStrictEqual(firstPage.jobs.map((job) => job.id), ['newer-a', 'newer-b']);
    assert.deepStrictEqual(secondPage.jobs.map((job) => job.id), ['old']);
  });

  it('changes the pagination snapshot fingerprint when matching jobs change', async () => {
    const firstJob = {
      ...mockHealthyJob,
      id: 'snapshot-job-a',
      sourceId: 'snapshot-a',
      applicationUrl: 'https://innovatecorp.com/jobs/snapshot-a',
    };
    const secondJob = {
      ...mockHealthyJob,
      id: 'snapshot-job-b',
      sourceId: 'snapshot-b',
      applicationUrl: 'https://innovatecorp.com/jobs/snapshot-b',
    };
    const firstSnapshot = await new JobSearchService([new StaticProvider([firstJob])]).searchJobs({
      page: 1,
      pageSize: 1,
    });
    const changedSnapshot = await new JobSearchService([new StaticProvider([secondJob])]).searchJobs({
      page: 1,
      pageSize: 1,
    });

    assert.notStrictEqual(firstSnapshot.snapshotId, changedSnapshot.snapshotId);
  });
});
