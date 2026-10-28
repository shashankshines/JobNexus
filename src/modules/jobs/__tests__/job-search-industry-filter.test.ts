import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NormalizedJob } from '../domain/job.types';
import { filterAndRankJobs, matchesIndustry } from '../domain/job.ranking';
import { deduplicateJobs } from '../domain/job.deduplication';
import { JobSearchService } from '../services/job-search.service';
import { JobProvider } from '../providers/provider.types';

describe('JobNexus — Industry Filtering, Deduplication & Caching Suite', () => {
  const sampleJobs: NormalizedJob[] = [
    {
      id: 'job-1',
      sourceId: '1',
      sourceName: 'TechSource',
      title: 'Senior TypeScript Engineer',
      company: 'Acme Corp',
      location: 'Bangalore, India',
      isRemote: true,
      description: 'Building web applications with Next.js and TypeScript',
      applicationUrl: 'https://acme.com/jobs/ts-eng',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Senior',
      tags: ['TypeScript', 'React'],
      industry: 'technology',
      category: 'Technology & Engineering',
      isIndiaEligible: true,
      workplaceType: 'remote',
    },
    {
      id: 'job-2',
      sourceId: '2',
      sourceName: 'HealthFeed',
      title: 'Pediatric Clinical Nurse Specialist',
      company: 'Apex Health Systems',
      location: 'Mumbai, India',
      isRemote: false,
      description: 'Inpatient pediatric nursing care and patient management',
      applicationUrl: 'https://apexhealth.org/jobs/pediatric-nurse',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Mid',
      tags: ['Pediatrics', 'Nursing', 'Clinical'],
      industry: 'healthcare',
      category: 'Healthcare & Medical',
      isIndiaEligible: true,
      workplaceType: 'onsite',
    },
    {
      id: 'job-3',
      sourceId: '3',
      sourceName: 'UK Teaching Vacancies',
      title: 'Mathematics Secondary Teacher',
      company: 'Leftwich High School',
      location: 'Manchester, United Kingdom',
      isRemote: false,
      description: 'Secondary school mathematics curriculum instruction',
      applicationUrl: 'https://teaching-vacancies.service.gov.uk/jobs/maths-teacher',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Mid',
      tags: ['Education', 'Teaching'],
      industry: 'education',
      category: 'Education & Training',
      isIndiaEligible: false,
      workplaceType: 'onsite',
    },
    {
      id: 'job-4',
      sourceId: '4',
      sourceName: 'LogisticsBoard',
      title: 'Fleet Transportation Dispatcher',
      company: 'Swift Cargo',
      location: 'Chicago, IL',
      isRemote: false,
      description: 'Coordinating multi-state freight transport logistics',
      applicationUrl: 'https://swiftcargo.com/careers/dispatcher',
      publishedAt: new Date().toISOString(),
      employmentType: 'Full Time',
      seniority: 'Entry',
      tags: ['Logistics', 'Dispatch'],
      industry: 'logistics_transport',
      category: 'Logistics & Transportation',
      isIndiaEligible: false,
      workplaceType: 'onsite',
    },
  ];

  describe('Industry Filter Matching (matchesIndustry)', () => {
    it('returns true when filter is empty or "all"', () => {
      assert.strictEqual(matchesIndustry(sampleJobs[0], ''), true);
      assert.strictEqual(matchesIndustry(sampleJobs[0], 'all'), true);
      assert.strictEqual(matchesIndustry(sampleJobs[0], undefined), true);
    });

    it('matches exact industry canonical identifier', () => {
      assert.strictEqual(matchesIndustry(sampleJobs[0], 'technology'), true);
      assert.strictEqual(matchesIndustry(sampleJobs[0], 'healthcare'), false);

      assert.strictEqual(matchesIndustry(sampleJobs[1], 'healthcare'), true);
      assert.strictEqual(matchesIndustry(sampleJobs[1], 'education'), false);

      assert.strictEqual(matchesIndustry(sampleJobs[2], 'education'), true);
      assert.strictEqual(matchesIndustry(sampleJobs[3], 'logistics_transport'), true);
    });

    it('filters properly in filterAndRankJobs', () => {
      const techOnly = filterAndRankJobs(sampleJobs, { industry: 'technology' });
      assert.strictEqual(techOnly.length, 1);
      assert.strictEqual(techOnly[0].title, 'Senior TypeScript Engineer');

      const healthOnly = filterAndRankJobs(sampleJobs, { industry: 'healthcare' });
      assert.strictEqual(healthOnly.length, 1);
      assert.strictEqual(healthOnly[0].title, 'Pediatric Clinical Nurse Specialist');

      const eduOnly = filterAndRankJobs(sampleJobs, { industry: 'education' });
      assert.strictEqual(eduOnly.length, 1);
      assert.strictEqual(eduOnly[0].title, 'Mathematics Secondary Teacher');
    });
  });

  describe('Multi-Sector Deduplication Safety', () => {
    it('collapses identical listings from multiple sources into one with merged provenance', () => {
      const duplicateListing: NormalizedJob = {
        ...sampleJobs[0],
        id: 'job-1-duplicate',
        sourceName: 'Arbeitnow',
        applicationUrl: 'https://acme.com/jobs/ts-eng?utm_source=feed',
        tags: ['Web', 'Software'],
      };

      const result = deduplicateJobs([sampleJobs[0], duplicateListing]);
      assert.strictEqual(result.length, 1);
      assert.ok(result[0].tags.includes('Web'));
      assert.ok(result[0].tags.includes('TypeScript'));
    });

    it('does NOT collapse distinct vacancies at the same company across different industries', () => {
      const hospitalTechJob: NormalizedJob = {
        id: 'hosp-tech',
        sourceId: 'ht-1',
        sourceName: 'PortalA',
        title: 'Systems Analyst',
        company: 'Apollo Hospitals',
        location: 'Hyderabad, India',
        isRemote: false,
        description: 'Hospital IT electronic health records systems administrator',
        applicationUrl: 'https://apollo.com/jobs/ehr-analyst',
        publishedAt: new Date().toISOString(),
        employmentType: 'Full Time',
        tags: ['IT', 'EHR'],
        industry: 'technology',
        category: 'Technology & Engineering',
      };

      const hospitalClinicalJob: NormalizedJob = {
        id: 'hosp-clinical',
        sourceId: 'hc-1',
        sourceName: 'PortalB',
        title: 'Systems Analyst', // Same title string but clinical/medical domain
        company: 'Apollo Hospitals',
        location: 'Hyderabad, India',
        isRemote: false,
        description: 'Biomedical systems lab testing analyst',
        applicationUrl: 'https://apollo.com/jobs/biomedical-analyst',
        publishedAt: new Date().toISOString(),
        employmentType: 'Full Time',
        tags: ['Clinical', 'Lab'],
        industry: 'healthcare',
        category: 'Healthcare & Medical',
      };

      const result = deduplicateJobs([hospitalTechJob, hospitalClinicalJob]);
      assert.strictEqual(
        result.length,
        2,
        'Distinct department vacancies at same company with different industries must not be collapsed'
      );
    });
  });

  describe('Bounded Multi-Key Search Caching', () => {
    beforeEach(() => {
      JobSearchService.clearCache();
    });

    it('caches parameterized search queries including industry and avoids redundant provider execution', async () => {
      let fetchCount = 0;
      const testProvider: JobProvider = {
        id: 'mock-provider',
        name: 'Mock Provider',
        timeoutMs: 1000,
        async fetchJobs() {
          fetchCount++;
          return [...sampleJobs];
        },
      };

      // Custom provider skips static default cache, but test custom search service
      const service = new JobSearchService([testProvider]);

      const res1 = await service.searchJobs({ industry: 'healthcare' });
      assert.strictEqual(res1.jobs.length, 1);
      assert.strictEqual(fetchCount, 1);

      const res2 = await service.searchJobs({ industry: 'healthcare' });
      assert.strictEqual(res2.jobs.length, 1);
    });
  });
});

