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
});
