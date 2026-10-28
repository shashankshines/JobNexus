import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  EmployerRegistry,
  isValidEmployerSlug,
  globalEmployerRegistry,
  EmployerConfig,
} from '../providers/employer.registry';
import { LeverAdapter, LeverPostingRaw } from '../adapters/ats/lever.adapter';
import { buildExternalPlatformSearchLinks } from '../domain/job.links';
import { ProviderRegistry } from '../providers/provider.registry';

describe('Global Job Discovery Expansion Test Suite', () => {
  describe('EmployerRegistry & SSRF Protection', () => {
    it('validates proper alphanumeric and hyphenated slugs', () => {
      assert.strictEqual(isValidEmployerSlug('stripe'), true);
      assert.strictEqual(isValidEmployerSlug('linear-app'), true);
      assert.strictEqual(isValidEmployerSlug('canonical_uk'), true);
      assert.strictEqual(isValidEmployerSlug('spotify-123'), true);
    });

    it('rejects malformed, path traversal, and malicious slugs', () => {
      assert.strictEqual(isValidEmployerSlug(''), false);
      assert.strictEqual(isValidEmployerSlug('../stripe'), false);
      assert.strictEqual(isValidEmployerSlug('stripe/jobs'), false);
      assert.strictEqual(isValidEmployerSlug('company;rm -rf'), false);
      assert.strictEqual(isValidEmployerSlug('<script>'), false);
      assert.strictEqual(isValidEmployerSlug('company name with spaces'), false);
      assert.strictEqual(isValidEmployerSlug('a'.repeat(65)), false);
    });

    it('loads curated global employers with verified ATS targets', () => {
      const all = globalEmployerRegistry.getAll();
      assert.ok(all.length >= 20, 'Should have at least 20 curated verified global employers');

      const ghEmployers = globalEmployerRegistry.getByAts('greenhouse');
      assert.ok(ghEmployers.length >= 10, 'Should include curated Greenhouse employers');
      assert.ok(ghEmployers.some((e) => e.slug === 'stripe'));
      assert.ok(ghEmployers.some((e) => e.slug === 'datadog'));

      const ashbyEmployers = globalEmployerRegistry.getByAts('ashby');
      assert.ok(ashbyEmployers.length >= 8, 'Should include curated Ashby employers');
      assert.ok(ashbyEmployers.some((e) => e.slug === 'linear'));
      assert.ok(ashbyEmployers.some((e) => e.slug === 'openai'));

      const leverEmployers = globalEmployerRegistry.getByAts('lever');
      assert.ok(leverEmployers.length >= 2, 'Should include curated Lever employers');
      assert.ok(leverEmployers.some((e) => e.slug === 'spotify'));
      assert.ok(leverEmployers.some((e) => e.slug === 'kinsta'));
    });

    it('throws when attempting to register an invalid slug', () => {
      const reg = new EmployerRegistry([]);
      assert.throws(() => {
        reg.register({
          id: 'bad',
          name: 'Bad Employer',
          ats: 'lever',
          slug: '../unsafe',
          active: true,
        });
      }, /Invalid slug/);
    });
  });

  describe('Lever ATS Adapter', () => {
    const mockPostings: LeverPostingRaw[] = [
      {
        id: 'post-101',
        text: 'Senior Distributed Systems Engineer',
        createdAt: 1787566707743,
        descriptionPlain: 'Join the infrastructure platform team building global distributed cache layers.',
        applyUrl: 'https://jobs.lever.co/spotify/post-101/apply',
        hostedUrl: 'https://jobs.lever.co/spotify/post-101',
        categories: {
          commitment: 'Permanent',
          department: 'Engineering',
          team: 'Core Platform',
          location: 'Stockholm, Sweden',
        },
        workplaceType: 'hybrid',
      },
      {
        id: 'post-102',
        text: 'Staff Cloud Security Architect',
        createdAt: 1787566707743,
        descriptionPlain: 'Lead security architecture for cloud and container runtime environments.',
        applyUrl: 'https://jobs.lever.co/spotify/post-102/apply',
        hostedUrl: 'https://jobs.lever.co/spotify/post-102',
        categories: {
          commitment: 'Full-time',
          department: 'Security',
          location: 'Remote',
        },
        workplaceType: 'remote',
      },
    ];

    it('normalizes Lever postings into canonical JobNexus jobs', async () => {
      const testEmployers: EmployerConfig[] = [
        {
          id: 'spotify',
          name: 'Spotify',
          ats: 'lever',
          slug: 'spotify',
          active: true,
        },
      ];

      const adapter = new LeverAdapter(testEmployers, { spotify: mockPostings });
      const jobs = await adapter.fetchJobs();

      assert.strictEqual(jobs.length, 2);

      const job1 = jobs[0];
      assert.ok(job1.id.startsWith('lever-'));
      assert.strictEqual(job1.sourceName, 'Lever ATS');
      assert.strictEqual(job1.title, 'Senior Distributed Systems Engineer');
      assert.strictEqual(job1.company, 'Spotify');
      assert.strictEqual(job1.location, 'Stockholm, Sweden');
      assert.strictEqual(job1.workplaceType, 'hybrid');
      assert.strictEqual(job1.seniority, 'Senior');
      assert.strictEqual(job1.employmentType, 'Full Time');
      assert.ok(job1.applicationUrl.includes('/apply'));
      assert.ok(job1.tags.includes('Engineering'));

      const job2 = jobs[1];
      assert.strictEqual(job2.workplaceType, 'remote');
      assert.strictEqual(job2.isRemote, true);
      assert.strictEqual(job2.seniority, 'Lead');
    });

    it('gracefully handles empty or malformed postings', async () => {
      const testEmployers: EmployerConfig[] = [
        {
          id: 'test-co',
          name: 'Test Co',
          ats: 'lever',
          slug: 'test-co',
          active: true,
        },
      ];

      const adapter = new LeverAdapter(testEmployers, {
        'test-co': [
          { id: 'invalid-no-url', text: 'No URL Role' } as LeverPostingRaw,
          { id: 'invalid-no-title', hostedUrl: 'https://jobs.lever.co/test/1' } as LeverPostingRaw,
        ],
      });

      const jobs = await adapter.fetchJobs();
      assert.strictEqual(jobs.length, 0);
    });

    it('rejects unsafe slugs in LeverAdapter with early return', async () => {
      const adapter = new LeverAdapter();
      const jobs = await adapter.fetchBoardJobs({
        id: 'bad',
        name: 'Bad Employer',
        ats: 'lever',
        slug: '../dangerous',
        active: true,
      });

      assert.deepStrictEqual(jobs, []);
    });
  });

  describe('External Job Platform Deep-Linking (Stage E)', () => {
    it('builds parameter-encoded search links for LinkedIn, Indeed, Glassdoor, and ZipRecruiter', () => {
      const links = buildExternalPlatformSearchLinks({
        query: 'Frontend Engineer',
        location: 'Bengaluru',
      });

      assert.strictEqual(links.length, 4);

      const linkedin = links.find((l) => l.platformId === 'linkedin');
      assert.ok(linkedin);
      assert.strictEqual(linkedin.platformName, 'LinkedIn');
      assert.ok(linkedin.url.includes('keywords=Frontend+Engineer'));
      assert.ok(linkedin.url.includes('location=Bengaluru'));
      assert.strictEqual(linkedin.isExternalSearch, true);

      const indeed = links.find((l) => l.platformId === 'indeed');
      assert.ok(indeed);
      assert.ok(indeed.url.includes('q=Frontend+Engineer'));
      assert.ok(indeed.url.includes('l=Bengaluru'));
      assert.strictEqual(indeed.isExternalSearch, true);

      const glassdoor = links.find((l) => l.platformId === 'glassdoor');
      assert.ok(glassdoor);
      assert.ok(glassdoor.url.includes('sc.keyword=Frontend+Engineer'));
      assert.ok(glassdoor.url.includes('locKeyword=Bengaluru'));

      const zip = links.find((l) => l.platformId === 'ziprecruiter');
      assert.ok(zip);
      assert.ok(zip.url.includes('search=Frontend+Engineer'));
      assert.ok(zip.url.includes('location=Bengaluru'));
    });

    it('handles empty query and location gracefully without undefined or null', () => {
      const links = buildExternalPlatformSearchLinks({});
      assert.strictEqual(links.length, 4);
      for (const link of links) {
        assert.ok(!link.url.includes('undefined'));
        assert.ok(!link.url.includes('null'));
        assert.strictEqual(link.isExternalSearch, true);
        assert.ok(link.attribution.includes('External discovery link'));
      }
    });
  });

  describe('ProviderRegistry Expansion', () => {
    it('registers all verified providers including LeverAdapter, TeachingAdapter, and ReliefWebAdapter', () => {
      const providers = ProviderRegistry.getDefaultProviders();
      assert.strictEqual(providers.length, 12);

      const ids = providers.map((p) => p.id);
      assert.ok(ids.includes('arbeitnow'));
      assert.ok(ids.includes('remotive'));
      assert.ok(ids.includes('jobicy'));
      assert.ok(ids.includes('remoteok'));
      assert.ok(ids.includes('himalayas'));
      assert.ok(ids.includes('weworkremotely'));
      assert.ok(ids.includes('greenhouse'));
      assert.ok(ids.includes('ashby'));
      assert.ok(ids.includes('lever'));
      assert.ok(ids.includes('ncs'));
      assert.ok(ids.includes('teaching_uk'));
      assert.ok(ids.includes('reliefweb'));
    });
  });
});
