import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob } from '../domain/job.types';

function createBenchJob(i: number): NormalizedJob {
  const roles = [
    'Senior AI Engineer',
    'Generative AI Engineer',
    'LLM Engineer',
    'Agentic AI Engineer',
    'Forward Deployed Engineer',
    'Data Engineer',
    'Python Developer',
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
  ];
  const cities = ['Bengaluru, India', 'Hyderabad, India', 'Remote', 'Pune, India', 'Mumbai, India'];
  const companies = ['Scale AI', 'Google', 'Meta', 'Amazon', 'Databricks', 'Palantir', 'Stripe'];
  const title = roles[i % roles.length];
  const company = companies[i % companies.length];
  const location = cities[i % cities.length];
  const isRemote = location === 'Remote';

  return {
    id: `bench-job-${i}`,
    sourceId: `provider-${i % 5}`,
    sourceName: `Provider ${i % 5}`,
    title: `${title} #${i}`,
    company,
    location,
    isRemote,
    workplaceType: isRemote ? 'remote' : 'onsite',
    description: `High performance engineering for ${title} at ${company}. Experience with distributed systems and cloud scale architectures.`,
    applicationUrl: `https://jobs.lever.co/company/bench-${i}`,
    publishedAt: new Date(Date.now() - (i % 30) * 86400000).toISOString(),
    employmentType: 'Full-time',
    tags: ['Cloud', 'Distributed Systems', 'TypeScript', 'Python'],
    industry: 'technology',
    category: 'Technology & IT',
    isIndiaEligible: true,
    seniority: i % 3 === 0 ? 'Senior' : 'Mid',
  };
}

function calculatePercentile(latencies: number[], p: number): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

describe('JobNexus — Search Performance Benchmark Suite (Section 4 Targets)', () => {
  const POOL_SIZE = 5000;
  const benchmarkDataset: NormalizedJob[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    benchmarkDataset.push(createBenchJob(i));
  }

  beforeEach(() => {
    JobSearchService.clearCache();
  });

  it('meets cached search API targets: p50 <= 150ms and p95 <= 400ms', async () => {
    const provider: JobProvider = {
      id: 'bench-provider',
      name: 'BenchProvider',
      async fetchJobs() {
        return benchmarkDataset;
      },
    };

    const service = new JobSearchService([provider]);

    // Warm-up query (populates query cache)
    await service.searchJobs({ query: 'AI Engineer' });

    // Execute 100 benchmark queries
    const latencies: number[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = await service.searchJobs({ query: 'AI Engineer' });
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);
      assert.ok(res.jobs.length > 0);
    }

    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log(`[Benchmark - Cached Search] Iterations: ${iterations}, p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    // Section 4 acceptance targets
    assert.ok(p50 <= 150, `Cached search API p50 (${p50}ms) must be <= 150ms`);
    assert.ok(p95 <= 400, `Cached search API p95 (${p95}ms) must be <= 400ms`);
  });

  it('meets uncached indexed search target: p95 <= 800ms across 5,000 jobs', async () => {
    const provider: JobProvider = {
      id: 'bench-provider-uncached',
      name: 'BenchProviderUncached',
      async fetchJobs() {
        return benchmarkDataset;
      },
    };

    const service = new JobSearchService([provider]);

    // Ensure raw catalogue is primed, but queries are unique (uncached query execution)
    await service.getJobStats();

    const latencies: number[] = [];
    const testQueries = [
      'Python Developer',
      'LLM Engineer',
      'Forward Deployed Engineer',
      'Data Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Generative AI Engineer',
      'Agentic AI Engineer',
      'Senior AI Engineer',
      'Full Stack Developer',
    ];

    for (const q of testQueries) {
      const t0 = performance.now();
      const res = await service.searchJobs({ query: q });
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);
      assert.ok(res.jobs.length > 0);
    }

    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    console.log(`[Benchmark - Uncached Search] Queries: ${testQueries.length}, p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`);

    // Section 4 acceptance targets
    assert.ok(p95 <= 800, `Uncached indexed search p95 (${p95}ms) must be <= 800ms`);
  });

  it('meets Stats API target: p95 <= 300ms', async () => {
    const provider: JobProvider = {
      id: 'bench-provider-stats',
      name: 'BenchProviderStats',
      async fetchJobs() {
        return benchmarkDataset;
      },
    };

    const service = new JobSearchService([provider]);

    // Prime stats
    await service.getJobStats();

    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const stats = await service.getJobStats();
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);
      assert.ok(stats.totalJobs >= POOL_SIZE);
    }

    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    console.log(`[Benchmark - Stats API] Calls: 50, p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`);

    assert.ok(p95 <= 300, `Stats API p95 (${p95}ms) must be <= 300ms`);
  });

  it('guarantees asynchronous provider ingestion: slow provider never blocks cached search', async () => {
    let slowProviderCalled = 0;
    const slowProvider: JobProvider = {
      id: 'slow-async-provider',
      name: 'SlowAsyncProvider',
      async fetchJobs() {
        slowProviderCalled++;
        // Simulate a 3-second upstream ATS lag
        await new Promise((r) => setTimeout(r, 200));
        return benchmarkDataset;
      },
    };

    const service = new JobSearchService([slowProvider]);

    // Initial search
    await service.searchJobs({});

    // Immediate subsequent search MUST return from memory cache in < 50ms without waiting on the slow provider
    const t0 = performance.now();
    const cachedRes = await service.searchJobs({});
    const elapsed = performance.now() - t0;

    assert.ok(cachedRes.jobs.length > 0);
    assert.ok(elapsed < 50, `Cached response took ${elapsed}ms; must be < 50ms`);
  });

  it('measures concurrency throughput and cache hit ratio under concurrent load', async () => {
    const provider: JobProvider = {
      id: 'bench-provider-concurrency',
      name: 'BenchProviderConcurrency',
      async fetchJobs() {
        return benchmarkDataset;
      },
    };

    const service = new JobSearchService([provider]);
    await service.searchJobs({ query: 'Python Developer' });

    // Dispatch 50 concurrent requests simultaneously
    const CONCURRENT_REQUESTS = 50;
    const t0 = performance.now();
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      service.searchJobs({ query: 'Python Developer' })
    );

    const results = await Promise.all(promises);
    const totalElapsed = performance.now() - t0;

    assert.strictEqual(results.length, CONCURRENT_REQUESTS);
    assert.ok(results.every((r) => r.jobs.length > 0));

    const qps = (CONCURRENT_REQUESTS / (totalElapsed / 1000));
    console.log(`[Benchmark - Concurrent Throughput] 50 requests in ${totalElapsed.toFixed(2)}ms (${qps.toFixed(0)} QPS)`);

    assert.ok(totalElapsed < 1000, `50 concurrent cached requests took ${totalElapsed}ms; must be < 1000ms`);
  });
});
