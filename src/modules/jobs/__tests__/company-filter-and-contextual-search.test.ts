import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  matchesCompany,
  normalizeCompanyName,
  matchesQuery,
  filterAndRankJobs,
} from '../domain/job.ranking';
import { NormalizedJob } from '../domain/job.types';

function createSampleJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: 'job-sample-1',
    sourceId: 'src-1',
    sourceName: 'TestProvider',
    title: 'Senior Software Engineer',
    company: 'Tata Consultancy Services Ltd.',
    location: 'Bangalore, India',
    employmentType: 'Full-time',
    applicationUrl: 'https://example.com/jobs/1',
    publishedAt: new Date().toISOString(),
    tags: ['react', 'node', 'typescript'],
    description: 'We are seeking a senior engineer to build enterprise cloud applications.',
    isRemote: false,
    workplaceType: 'hybrid',
    isIndiaEligible: true,
    ...overrides,
  };
}

describe('JobNexus — Company Filter & Contextual Search Engine', () => {
  describe('Company Name Normalization & Aliases', () => {
    it('normalizes company names by removing legal entity suffixes and punctuation', () => {
      assert.strictEqual(normalizeCompanyName('Google, LLC.'), 'google');
      assert.strictEqual(normalizeCompanyName('Microsoft Corporation'), 'microsoft');
      assert.strictEqual(normalizeCompanyName('Tata Consultancy Services Pvt. Ltd.'), 'tata consultancy');
      assert.strictEqual(normalizeCompanyName('Amazon Web Services, Inc.'), 'amazon web');
    });

    it('matches exact and partial company names case-insensitively', () => {
      const job = createSampleJob({ company: 'Microsoft Corporation' });
      assert.strictEqual(matchesCompany(job, 'Microsoft'), true);
      assert.strictEqual(matchesCompany(job, 'microsoft'), true);
      assert.strictEqual(matchesCompany(job, 'Microsoft Corporation'), true);
      assert.strictEqual(matchesCompany(job, 'Apple'), false);
    });

    it('resolves known company aliases bidirectionally (e.g. TCS <-> Tata Consultancy Services)', () => {
      const tcsJob = createSampleJob({ company: 'Tata Consultancy Services' });
      assert.strictEqual(matchesCompany(tcsJob, 'TCS'), true);
      assert.strictEqual(matchesCompany(tcsJob, 'tcs'), true);

      const awsJob = createSampleJob({ company: 'Amazon Web Services' });
      assert.strictEqual(matchesCompany(awsJob, 'AWS'), true);
      assert.strictEqual(matchesCompany(awsJob, 'Amazon'), true);

      const metaJob = createSampleJob({ company: 'Meta Platforms Inc.' });
      assert.strictEqual(matchesCompany(metaJob, 'Facebook'), true);
    });

    it('returns true when filterCompany is empty or whitespace', () => {
      const job = createSampleJob();
      assert.strictEqual(matchesCompany(job, ''), true);
      assert.strictEqual(matchesCompany(job, '   '), true);
      assert.strictEqual(matchesCompany(job, undefined), true);
    });
  });

  describe('Contextual Synonym Role Matching Across Sectors', () => {
    it('matches tech role queries using contextual synonym expansion (e.g. "React" -> "Frontend Developer")', () => {
      const job = createSampleJob({
        title: 'Lead Frontend Developer',
        tags: ['web', 'ui'],
        description: 'Building modern interfaces.',
      });
      // Query for 'react' should match 'Lead Frontend Developer' via ROLE_CONTEXTUAL_MAPPINGS
      const result = matchesQuery(job, 'React');
      assert.strictEqual(result.matches, true);
      assert.ok(result.baseScore > 0);
    });

    it('matches healthcare queries using contextual mappings (e.g. "Doctor" -> "Physician")', () => {
      const medicalJob = createSampleJob({
        title: 'Consultant Physician',
        company: 'Apollo Hospitals',
        tags: ['clinical', 'healthcare'],
        description: 'Inpatient and outpatient general medicine care.',
      });
      const result = matchesQuery(medicalJob, 'Doctor');
      assert.strictEqual(result.matches, true);
    });

    it('matches finance & accounting queries (e.g. "CA" -> "Chartered Accountant / Audit")', () => {
      const financeJob = createSampleJob({
        title: 'Statutory Audit Lead',
        company: 'Deloitte',
        tags: ['tax', 'accounting'],
        description: 'Managing statutory audit for enterprise clients.',
      });
      const result = matchesQuery(financeJob, 'CA');
      assert.strictEqual(result.matches, true);
    });

    it('matches construction and engineering queries (e.g. "Civil" -> "Site Engineer")', () => {
      const civilJob = createSampleJob({
        title: 'Site Supervisor Engineer',
        company: 'L&T Construction',
        tags: ['construction', 'autocad'],
        description: 'Supervising high-rise residential construction projects.',
      });
      const result = matchesQuery(civilJob, 'Civil');
      assert.strictEqual(result.matches, true);
    });

    it('matches manufacturing & operations queries (e.g. "Manufacturing" -> "Production Engineer")', () => {
      const mfgJob = createSampleJob({
        title: 'Plant Production Engineer',
        company: 'Bosch India',
        tags: ['machining', 'industrial'],
        description: 'Managing automotive component production line.',
      });
      const result = matchesQuery(mfgJob, 'Manufacturing');
      assert.strictEqual(result.matches, true);
    });

    it('matches customer support queries (e.g. "Customer Service" -> "Call Center / Helpdesk")', () => {
      const supportJob = createSampleJob({
        title: 'Technical Helpdesk Specialist',
        company: 'Concentrix',
        tags: ['voice process', 'chat support'],
        description: 'Tier 2 technical helpdesk support for enterprise SaaS.',
      });
      const result = matchesQuery(supportJob, 'Customer Service');
      assert.strictEqual(result.matches, true);
    });
  });

  describe('Ranking and Scoring Integration with Company Filtering', () => {
    it('filters jobs strictly by company when params.company is supplied', () => {
      const jobs: NormalizedJob[] = [
        createSampleJob({ id: '1', company: 'Google', title: 'Software Engineer' }),
        createSampleJob({ id: '2', company: 'Microsoft', title: 'Software Engineer' }),
        createSampleJob({ id: '3', company: 'Tata Consultancy Services', title: 'Software Engineer' }),
      ];

      const filtered = filterAndRankJobs(jobs, { company: 'Google' });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].company, 'Google');
    });

    it('awards a +25 point boost to matching company jobs', () => {
      const jobs: NormalizedJob[] = [
        createSampleJob({ id: '1', company: 'Infosys Limited', title: 'Developer' }),
      ];

      const ranked = filterAndRankJobs(jobs, { company: 'Infosys' });
      assert.strictEqual(ranked.length, 1);
      // Base score 10 + 25 company boost + 15 India boost = 50+
      assert.ok((ranked[0].score || 0) >= 40);
    });
  });
});

