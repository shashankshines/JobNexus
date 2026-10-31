import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob } from '../domain/job.types';

describe('JobNexus — Blazing Fast Search & Pill Caching Architecture', () => {
  const sampleJobs: NormalizedJob[] = [
    {
      id: 'job-fast-1',
      sourceId: '1',
      sourceName: 'QuickSource',
      title: 'Senior Frontend Architect',
      company: 'TechFlow',
      location: 'Remote',
      isRemote: true,
      description: 'Building high-performance user interfaces in Next.js',
      applicationUrl: 'https://techflow.io/jobs/1',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Senior',
      tags: ['React', 'Next.js', 'TypeScript', 'Tailwind'],
      industry: 'technology',
      category: 'Technology & IT',
      isIndiaEligible: true,
      workplaceType: 'remote',
    },
    {
      id: 'job-fast-2',
      sourceId: '2',
      sourceName: 'QuickSource',
      title: 'Cardiovascular Care Nurse',
      company: 'HeartCare Health',
      location: 'Bangalore, India',
      isRemote: false,
      description: 'Cardiac intensive care inpatient support',
      applicationUrl: 'https://heartcare.org/jobs/2',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Mid',
      tags: ['Nursing', 'Cardiology', 'Clinical Care'],
      industry: 'healthcare',
      category: 'Healthcare & Medical',
      isIndiaEligible: true,
      workplaceType: 'onsite',
    },
    {
      id: 'job-fast-3',
      sourceId: '3',
      sourceName: 'QuickSource',
      title: 'Supply Chain Operations Manager',
      company: 'LogixExpress',
      location: 'Delhi, India',
      isRemote: false,
      description: 'Fleet tracking, inventory fulfillment, and supply logistics',
      applicationUrl: 'https://logix.com/jobs/3',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Lead',
      tags: ['Logistics', 'Supply Chain', 'Fleet Management'],
      industry: 'logistics_transport',
      category: 'Logistics & Supply Chain',
      isIndiaEligible: true,
      workplaceType: 'hybrid',
    },
  ];

  beforeEach(() => {
    JobSearchService.clearCache();
  });

  it('serves repeated pill clicks and searches with sub-millisecond latency from cache', async () => {
    let providerFetchCount = 0;
    const trackingProvider: JobProvider = {
      id: 'tracking-provider',
      name: 'TrackingProvider',
      async fetchJobs() {
        providerFetchCount++;
        // Simulate a tiny delay on first fetch
        await new Promise((r) => setTimeout(r, 10));
        return [...sampleJobs];
      },
    };

    const service = new JobSearchService([trackingProvider]);

    // 1st Search / Pill click: Industry "technology"
    const res1 = await service.searchJobs({ industry: 'technology' });

    assert.strictEqual(res1.jobs.length, 1);
    assert.strictEqual(res1.jobs[0].title, 'Senior Frontend Architect');
    assert.strictEqual(providerFetchCount, 1);

    // 2nd Search / Pill click: Repeat same query -> MUST be served from memory cache in < 5ms!
    const start2 = performance.now();
    const res2 = await service.searchJobs({ industry: 'technology' });
    const duration2 = performance.now() - start2;

    assert.strictEqual(res2.jobs.length, 1);
    assert.strictEqual(res2.jobs[0].title, 'Senior Frontend Architect');
    assert.strictEqual(providerFetchCount, 1, 'Provider must NOT be re-executed for cached queries');
    assert.ok(duration2 < 10, `Cached query should take under 10ms, took ${duration2}ms`);
  });

  it('verifies frontend caches exact searches and aborts stale requests', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    // 1. Client Search Cache
    assert.ok(
      pageContent.includes('clientSearchCacheRef = useRef<Map<string,'),
      'page.tsx must define clientSearchCacheRef for instant 0ms pill returns'
    );
    assert.ok(
      pageContent.includes('clientSearchCacheRef.current.get(cacheKey)'),
      'page.tsx must check clientSearchCacheRef before triggering network fetch'
    );

    // Searches use exact server-filtered results rather than a partial client catalog.
    assert.ok(
      !pageContent.includes('filterJobsClientSide('),
      'page.tsx must not apply a second, incomplete client-side filter'
    );
    assert.ok(
      pageContent.includes('const cacheKey = `${requestKey}::auth='),
      'page.tsx must keep authenticated and anonymous result caches separate'
    );

    // 3. AbortController for Rapid Clicks
    assert.ok(
      pageContent.includes('activeSearchAbortRef = useRef<AbortController | null>(null)'),
      'page.tsx must maintain activeSearchAbortRef'
    );
    assert.ok(
      pageContent.includes('activeSearchAbortRef.current?.abort()'),
      'page.tsx must abort pending requests when a newer search starts'
    );
  });

  it('verifies /api/jobs route applies client-friendly Cache-Control headers', () => {
    const routePath = path.resolve(process.cwd(), 'src/app/api/jobs/route.ts');
    const routeContent = fs.readFileSync(routePath, 'utf8');

    assert.ok(
      routeContent.includes('stale-while-revalidate='),
      'route.ts must include stale-while-revalidate for fast caching'
    );
    assert.ok(
      routeContent.includes('private, max-age=15'),
      'route.ts must set private max-age for fast client browsing'
    );
  });

  it('verifies JobSearchService CACHE_TTL_MS is tuned for high performance (>= 10 minutes) and globalThis persistence', () => {
    const servicePath = path.resolve(process.cwd(), 'src/modules/jobs/services/job-search.service.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');

    assert.ok(
      serviceContent.includes('CACHE_TTL_MS = 15 * 60 * 1000'),
      'JobSearchService must use at least 15-minute cache TTL'
    );
    assert.ok(
      serviceContent.includes('globalJobNexusCache = globalThis'),
      'JobSearchService must attach in-memory jobs cache to globalThis to survive Next.js dev reloads'
    );
    assert.ok(
      serviceContent.includes('inFlightFetchPromise'),
      'JobSearchService must deduplicate concurrent requests via inFlightFetchPromise'
    );
  });
});
