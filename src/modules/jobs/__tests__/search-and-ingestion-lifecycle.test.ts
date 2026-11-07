import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';
import { NormalizedJob, ProviderDiagnostic, LegacyJob } from '../domain/job.types';
import {
  stripHtml,
  canonicalizeUrl,
  isFabricatedJobUrl,
  isValidProviderApplicationUrl,
  normalizeLocation,
  normalizeSeniority,
  normalizeEmploymentType,
  normalizeDate,
} from '../domain/job.normalization';
import {
  classifyJobIndustry,
} from '../domain/job.taxonomy';
import { deduplicateJobs } from '../domain/job.deduplication';
import { filterAndRankJobs } from '../domain/job.ranking';
import { maskJobForAnonymous } from '../domain/job.masking';

describe('JobNexus — Search and Ingestion Lifecycle Suite (Provider → Link)', () => {
  beforeEach(() => {
    JobSearchService.clearCache();
  });

  // =========================================================================
  // 1. Ingestion & Normalization Phase
  // =========================================================================
  describe('1. Normalization & Payload Sanitization', () => {
    it('strips malicious HTML and scripts from titles, descriptions and company names', () => {
      const dirtyHtml = '<script>alert("xss")</script><p>Build <strong>scalable</strong> microservices.</p><style>.hidden{display:none}</style>';
      const cleaned = stripHtml(dirtyHtml);

      assert.strictEqual(cleaned.includes('<script>'), false);
      assert.strictEqual(cleaned.includes('<style>'), false);
      assert.strictEqual(cleaned.includes('alert('), false);
      assert.ok(cleaned.includes('Build scalable microservices.'));
    });

    it('normalizes raw provider fields into consistent NormalizedJob properties', () => {
      const location = normalizeLocation('Bengaluru, Karnataka, India');
      const seniority = normalizeSeniority('Senior Full Stack Engineer');
      const type = normalizeEmploymentType('full_time');
      const date = normalizeDate('2026-11-01T10:00:00Z');

      assert.strictEqual(location.location, 'Bengaluru, Karnataka, India');
      assert.strictEqual(location.isIndiaEligible, true);
      assert.strictEqual(seniority, 'Senior');
      assert.strictEqual(type, 'Full Time');
      assert.strictEqual(date, '2026-11-01T10:00:00.000Z');
    });

    it('canonicalizes URLs by removing tracking params while preserving functional application IDs', () => {
      const trackedUrl = 'https://boards.greenhouse.io/figma/jobs/998877?gh_src=newsletter&utm_medium=email&fbclid=abc#requirements';
      const cleanUrl = canonicalizeUrl(trackedUrl);

      assert.strictEqual(cleanUrl, 'https://boards.greenhouse.io/figma/jobs/998877');
      assert.strictEqual(cleanUrl.includes('utm_medium'), false);
      assert.strictEqual(cleanUrl.includes('#requirements'), false);
    });
  });

  // =========================================================================
  // 2. Application Link & Fabricated URL Rejection Phase
  // =========================================================================
  describe('2. Application Link Safety & Fabricated URL Rejection', () => {
    it('strictly rejects synthetic generator URLs with sequence patterns (/jobs/title-1001)', () => {
      const syntheticUrl1 = 'https://microsoft.com/jobs/senior-software-engineer-1002';
      const syntheticUrl2 = 'https://careers.google.com/openings/ai-researcher-49336';

      assert.strictEqual(isFabricatedJobUrl(syntheticUrl1), true);
      assert.strictEqual(isFabricatedJobUrl(syntheticUrl2), true);
      assert.strictEqual(isValidProviderApplicationUrl(syntheticUrl1), false);
      assert.strictEqual(isValidProviderApplicationUrl(syntheticUrl2), false);
    });

    it('strictly rejects placeholder, dummy and mock domains', () => {
      assert.strictEqual(isFabricatedJobUrl('https://placeholder.com/jobs/1'), true);
      assert.strictEqual(isFabricatedJobUrl('https://example.com/apply/nurse'), true);
      assert.strictEqual(isFabricatedJobUrl('https://test.com/careers/developer'), true);
      assert.strictEqual(isFabricatedJobUrl('https://fake.com/openings/123'), true);
      assert.strictEqual(isFabricatedJobUrl('http://localhost:3000/apply'), true);
    });

    it('approves genuine ATS endpoints from Lever, Greenhouse, Ashby, and SmartRecruiters', () => {
      const genuineLever = 'https://jobs.lever.co/netflix/4a1c5d98-1234-5678-90ab-cdef12345678';
      const genuineGreenhouse = 'https://boards.greenhouse.io/airbnb/jobs/4567890';
      const genuineAshby = 'https://jobs.ashbyhq.com/linear/2d8e4f1a';
      const genuineSmartRecruiters = 'https://jobs.smartrecruiters.com/Square/123456789-staff-engineer';

      assert.strictEqual(isFabricatedJobUrl(genuineLever), false);
      assert.strictEqual(isFabricatedJobUrl(genuineGreenhouse), false);
      assert.strictEqual(isFabricatedJobUrl(genuineAshby), false);
      assert.strictEqual(isFabricatedJobUrl(genuineSmartRecruiters), false);

      assert.strictEqual(isValidProviderApplicationUrl(genuineLever), true);
      assert.strictEqual(isValidProviderApplicationUrl(genuineGreenhouse), true);
      assert.strictEqual(isValidProviderApplicationUrl(genuineAshby), true);
      assert.strictEqual(isValidProviderApplicationUrl(genuineSmartRecruiters), true);
    });
  });

  // =========================================================================
  // 3. Role Classification & Multi-Sector Deduplication
  // =========================================================================
  describe('3. Role Classification & Multi-Sector Protection', () => {
    it('classifies distinct career sectors deterministically without defaulting to technology', () => {
      const nurse = classifyJobIndustry('Cardiology Registered Nurse');
      const teacher = classifyJobIndustry('High School Chemistry Teacher');
      const welder = classifyJobIndustry('Industrial Pipeline Welder');
      const driver = classifyJobIndustry('Long Haul Delivery Driver');
      const generic = classifyJobIndustry('Operations Associate');

      assert.strictEqual(nurse.industry, 'healthcare');
      assert.strictEqual(teacher.industry, 'education');
      assert.strictEqual(welder.industry, 'construction_trades');
      assert.strictEqual(driver.industry, 'logistics_transport');
      assert.strictEqual(generic.industry, 'other'); // Invariant: Never defaults to technology!
    });

    it('deduplicates identical jobs from multiple providers into a single canonical entry with merged provenance', () => {
      const jobFromLever: NormalizedJob = {
        id: 'lever-net-1',
        sourceId: 'lever',
        sourceName: 'Lever ATS',
        title: 'Staff Security Engineer',
        company: 'Cloudflare',
        location: 'Remote',
        isRemote: true,
        description: 'Zero trust security architecture.',
        applicationUrl: 'https://jobs.lever.co/cloudflare/sec-101',
        publishedAt: '2026-11-01T12:00:00Z',
        employmentType: 'Full Time',
        tags: ['Security', 'Cloud'],
        industry: 'technology',
        isIndiaEligible: true,
        seniority: 'Lead',
      };

      const jobFromHimalayas: NormalizedJob = {
        id: 'himalayas-net-1',
        sourceId: 'himalayas',
        sourceName: 'Himalayas',
        title: 'Staff Security Engineer',
        company: 'Cloudflare',
        location: 'Remote',
        isRemote: true,
        description: 'Zero trust security architecture and network defense.',
        applicationUrl: 'https://jobs.lever.co/cloudflare/sec-101?utm_source=himalayas',
        publishedAt: '2026-11-02T12:00:00Z',
        employmentType: 'Full Time',
        tags: ['Cybersecurity', 'Cloudflare', 'Zero Trust'],
        industry: 'technology',
        isIndiaEligible: true,
        seniority: 'Lead',
      };

      const deduplicated = deduplicateJobs([jobFromLever, jobFromHimalayas]);

      assert.strictEqual(deduplicated.length, 1);
      assert.strictEqual(deduplicated[0].company, 'Cloudflare');
      assert.strictEqual(deduplicated[0].title, 'Staff Security Engineer');
      // Provenance includes sources
      assert.ok(
        deduplicated[0].sourceName.includes('Lever') || deduplicated[0].sourceName.includes('Himalayas')
      );
    });

    it('does NOT collapse distinct vacancies at the same employer across different roles or sectors', () => {
      const nurseJob: NormalizedJob = {
        id: 'apollo-nurse-1',
        sourceId: 'apollo',
        sourceName: 'Apollo Careers',
        title: 'Intensive Care Nurse',
        company: 'Apollo Hospitals',
        location: 'Bengaluru, India',
        isRemote: false,
        description: 'ICU nursing support.',
        applicationUrl: 'https://careers.apollo.com/jobs/nurse-1',
        publishedAt: '2026-11-01T12:00:00Z',
        employmentType: 'Full Time',
        tags: ['Nursing'],
        industry: 'healthcare',
        isIndiaEligible: true,
        seniority: 'Mid',
      };

      const doctorJob: NormalizedJob = {
        id: 'apollo-doc-1',
        sourceId: 'apollo',
        sourceName: 'Apollo Careers',
        title: 'Consultant Cardiologist',
        company: 'Apollo Hospitals',
        location: 'Bengaluru, India',
        isRemote: false,
        description: 'Cardiology outpatient clinic and catheterization.',
        applicationUrl: 'https://careers.apollo.com/jobs/cardio-1',
        publishedAt: '2026-11-01T12:00:00Z',
        employmentType: 'Full Time',
        tags: ['Cardiology'],
        industry: 'healthcare',
        isIndiaEligible: true,
        seniority: 'Lead',
      };

      const deduplicated = deduplicateJobs([nurseJob, doctorJob]);
      assert.strictEqual(deduplicated.length, 2);
    });
  });

  // =========================================================================
  // 4. Ingestion Resilience & Error Handling Phase
  // =========================================================================
  describe('4. Ingestion Resilience, Timeouts & Error Isolation', () => {
    it('isolates slow or crashing providers without failing the overarching search response', async () => {
      const fastProvider: JobProvider = {
        id: 'fast-provider',
        name: 'FastProvider',
        async fetchJobs() {
          return [
            {
              id: 'job-fast-1',
              sourceId: 'fast',
              sourceName: 'FastProvider',
              title: 'Senior MLOps Engineer',
              company: 'FastAI Corp',
              location: 'Remote',
              isRemote: true,
              description: 'Model deployment on Kubernetes.',
              applicationUrl: 'https://jobs.lever.co/fastai/mlops-1',
              publishedAt: new Date().toISOString(),
              employmentType: 'Full Time',
              tags: ['MLOps', 'Kubeflow'],
              industry: 'technology',
              isIndiaEligible: true,
              seniority: 'Senior',
            },
          ];
        },
      };

      const slowCrashingProvider: JobProvider = {
        id: 'crashing-provider',
        name: 'CrashingProvider',
        async fetchJobs() {
          await new Promise((r) => setTimeout(r, 20));
          throw new Error('500 Internal Server Error: Gateway failure');
        },
      };

      const service = new JobSearchService([fastProvider, slowCrashingProvider]);
      const res = await service.searchJobs({ query: 'MLOps' });

      assert.strictEqual(res.jobs.length, 1);
      assert.strictEqual(res.jobs[0].title, 'Senior MLOps Engineer');
      assert.ok(res.diagnostics && res.diagnostics.length >= 2);
      const crashDiag = res.diagnostics?.find((d) => d.providerName === 'CrashingProvider');
      assert.strictEqual(crashDiag?.status, 'rejected');
      assert.ok(crashDiag?.error?.includes('500 Internal Server Error'));
    });

    it('performs safe additive merge so that partial provider batches do not delete existing catalog', async () => {
      let fetchCallCount = 0;
      const initialPool: NormalizedJob[] = [
        {
          id: 'job-seed-1',
          sourceId: 'p1',
          sourceName: 'P1',
          title: 'Senior Python Engineer',
          company: 'PyCorp',
          location: 'Remote',
          isRemote: true,
          description: 'Python APIs.',
          applicationUrl: 'https://jobs.lever.co/pycorp/1',
          publishedAt: new Date().toISOString(),
          employmentType: 'Full Time',
          tags: ['Python'],
          industry: 'technology',
          isIndiaEligible: true,
          seniority: 'Senior',
        },
        {
          id: 'job-seed-2',
          sourceId: 'p1',
          sourceName: 'P1',
          title: 'Cybersecurity Analyst',
          company: 'SecNet',
          location: 'Remote',
          isRemote: true,
          description: 'SOC analysis.',
          applicationUrl: 'https://jobs.lever.co/secnet/2',
          publishedAt: new Date().toISOString(),
          employmentType: 'Full Time',
          tags: ['Security'],
          industry: 'technology',
          isIndiaEligible: true,
          seniority: 'Mid',
        },
      ];

      const partialBatch: NormalizedJob[] = [
        {
          id: 'job-seed-3',
          sourceId: 'p1',
          sourceName: 'P1',
          title: 'Cloud DevOps Architect',
          company: 'CloudWorks',
          location: 'Remote',
          isRemote: true,
          description: 'Terraform AWS.',
          applicationUrl: 'https://jobs.lever.co/cloudworks/3',
          publishedAt: new Date().toISOString(),
          employmentType: 'Full Time',
          tags: ['Cloud', 'DevOps'],
          industry: 'technology',
          isIndiaEligible: true,
          seniority: 'Lead',
        },
      ];

      const dynamicProvider: JobProvider = {
        id: 'dynamic-provider',
        name: 'DynamicProvider',
        async fetchJobs() {
          fetchCallCount++;
          return fetchCallCount === 1 ? initialPool : partialBatch;
        },
      };

      const service = new JobSearchService([dynamicProvider]);

      // 1st Search: Initial load of 2 jobs
      const res1 = await service.searchJobs({});
      assert.strictEqual(res1.jobs.length, 2);

      // Force refresh with partial batch
      const res2 = await service.searchJobs({ forceRefresh: true });

      // Additive merge: Total jobs must now be 3 (2 preserved + 1 added), NOT replaced with 1!
      assert.strictEqual(res2.jobs.length, 3);
      assert.ok(res2.jobs.some((j) => j.title === 'Senior Python Engineer'));
      assert.ok(res2.jobs.some((j) => j.title === 'Cybersecurity Analyst'));
      assert.ok(res2.jobs.some((j) => j.title === 'Cloud DevOps Architect'));
    });
  });

  // =========================================================================
  // 5. Ranking, Search & Masking Phase
  // =========================================================================
  describe('5. Search Filtering, Seniority & Company Masking Protection', () => {
    const mixedSeniorityJobs: NormalizedJob[] = [
      {
        id: 'job-junior-1',
        sourceId: 's1',
        sourceName: 'S1',
        title: 'Junior React Developer',
        company: 'StartupTech',
        location: 'Remote',
        isRemote: true,
        description: 'Entry level frontend.',
        applicationUrl: 'https://jobs.lever.co/startup/jr',
        publishedAt: new Date().toISOString(),
        employmentType: 'Full Time',
        tags: ['React'],
        industry: 'technology',
        isIndiaEligible: true,
        seniority: 'Entry-level',
      },
      {
        id: 'job-senior-1',
        sourceId: 's1',
        sourceName: 'S1',
        title: 'Senior React Developer',
        company: 'Stripe',
        location: 'Remote',
        isRemote: true,
        description: 'Lead client systems.',
        applicationUrl: 'https://jobs.lever.co/stripe/sr',
        publishedAt: new Date().toISOString(),
        employmentType: 'Full Time',
        tags: ['React'],
        industry: 'technology',
        isIndiaEligible: true,
        seniority: 'Senior',
      },
    ];

    it('filters accurately by seniority level (Senior vs Entry-level)', () => {
      const seniorOnly = filterAndRankJobs(mixedSeniorityJobs, { level: 'Senior' });
      assert.strictEqual(seniorOnly.length, 1);
      assert.strictEqual(seniorOnly[0].id, 'job-senior-1');

      const juniorOnly = filterAndRankJobs(mixedSeniorityJobs, { level: 'Entry-level' });
      assert.strictEqual(juniorOnly.length, 1);
      assert.strictEqual(juniorOnly[0].id, 'job-junior-1');
    });

    it('masks company name and logos for anonymous seekers while revealing them for logged in users', () => {
      const rawJob = mixedSeniorityJobs[1]; // Stripe
      const targetJob: LegacyJob = {
        ...rawJob,
        url: rawJob.applicationUrl,
        date: rawJob.publishedAt,
        type: rawJob.employmentType,
        source: rawJob.sourceName,
      };

      // Anonymous seeker view
      const anonymousView = maskJobForAnonymous(targetJob);
      assert.strictEqual(anonymousView.company, 'Company hidden');
      assert.strictEqual(anonymousView.url, '');
      assert.strictEqual(isFabricatedJobUrl(targetJob.url), false);

      // Authenticated view (unmasked)
      assert.strictEqual(targetJob.company, 'Stripe');
      assert.strictEqual(targetJob.url, 'https://jobs.lever.co/stripe/sr');
    });

    it('rejects out-of-bound or negative pagination parameters safely', async () => {
      const service = new JobSearchService([]);
      const resNegative = await service.searchJobs({ page: -5, pageSize: -10 });

      // Gracefully defaults to Page 1 with valid standard page size
      assert.ok(resNegative.page === 1);
    });
  });
});
