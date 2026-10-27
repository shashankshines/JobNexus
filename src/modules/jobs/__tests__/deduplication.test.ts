import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deduplicateJobs } from '../domain/job.deduplication';
import { NormalizedJob } from '../domain/job.types';

function createSampleJob(partial: Partial<NormalizedJob>): NormalizedJob {
  return {
    id: partial.id || 'job-1',
    sourceId: partial.sourceId || '1',
    sourceName: partial.sourceName || 'ProviderA',
    title: partial.title || 'Senior Software Engineer',
    company: partial.company || 'TechCorp',
    location: partial.location || 'Remote',
    isRemote: partial.isRemote ?? true,
    description: partial.description || 'Job description',
    applicationUrl: partial.applicationUrl || 'https://techcorp.com/careers/1',
    publishedAt: partial.publishedAt || new Date().toISOString(),
    employmentType: partial.employmentType || 'Full Time',
    tags: partial.tags || ['react', 'node'],
  };
}

describe('Job Deduplication Unit Tests', () => {
  it('deduplicates jobs with the same canonical application URL and merges tags/provenance', () => {
    const jobA = createSampleJob({
      id: 'job-a',
      sourceName: 'Arbeitnow',
      applicationUrl: 'https://example.com/jobs/42?utm_source=feed',
      tags: ['react'],
    });

    const jobB = createSampleJob({
      id: 'job-b',
      sourceName: 'Remotive',
      applicationUrl: 'https://example.com/jobs/42?utm_campaign=winter',
      tags: ['typescript', 'node'],
    });

    const deduped = deduplicateJobs([jobA, jobB]);
    assert.strictEqual(deduped.length, 1);
    assert.strictEqual(deduped[0].id, 'job-a');
    assert.ok(deduped[0].tags.includes('react'));
    assert.ok(deduped[0].tags.includes('typescript'));
    assert.ok(deduped[0].alternateSources?.some((s) => s.sourceName === 'Remotive'));
  });

  it('deduplicates jobs with same company, title, and remote status even with different URLs', () => {
    const jobA = createSampleJob({
      id: 'job-1',
      sourceName: 'Provider1',
      company: 'Acme Inc.',
      title: 'Fullstack Developer',
      location: 'Remote',
      isRemote: true,
      applicationUrl: 'https://p1.com/job/1',
    });

    const jobB = createSampleJob({
      id: 'job-2',
      sourceName: 'Provider2',
      company: 'Acme LLC',
      title: 'Fullstack Developer',
      location: 'Anywhere',
      isRemote: true,
      applicationUrl: 'https://p2.com/job/2',
    });

    const deduped = deduplicateJobs([jobA, jobB]);
    assert.strictEqual(deduped.length, 1);
  });

  it('does NOT merge different roles at the same company', () => {
    const jobA = createSampleJob({
      id: 'eng-1',
      company: 'Google',
      title: 'Backend Engineer',
      applicationUrl: 'https://careers.google.com/jobs/1',
    });

    const jobB = createSampleJob({
      id: 'eng-2',
      company: 'Google',
      title: 'Frontend Engineer',
      applicationUrl: 'https://careers.google.com/jobs/2',
    });

    const deduped = deduplicateJobs([jobA, jobB]);
    assert.strictEqual(deduped.length, 2);
  });

  it('does NOT merge same title at different companies', () => {
    const jobA = createSampleJob({
      id: 'meta-dev',
      company: 'Meta',
      title: 'Software Engineer',
      applicationUrl: 'https://meta.com/careers/1',
    });

    const jobB = createSampleJob({
      id: 'apple-dev',
      company: 'Apple',
      title: 'Software Engineer',
      applicationUrl: 'https://apple.com/careers/2',
    });

    const deduped = deduplicateJobs([jobA, jobB]);
    assert.strictEqual(deduped.length, 2);
  });

  it('does NOT merge same title and company in different on-site cities', () => {
    const jobLondon = createSampleJob({
      id: 'uber-london',
      company: 'Uber',
      title: 'Site Reliability Engineer',
      location: 'London, UK',
      isRemote: false,
      applicationUrl: 'https://uber.com/jobs/lon',
    });

    const jobBlr = createSampleJob({
      id: 'uber-blr',
      company: 'Uber',
      title: 'Site Reliability Engineer',
      location: 'Bengaluru, India',
      isRemote: false,
      applicationUrl: 'https://uber.com/jobs/blr',
    });

    const deduped = deduplicateJobs([jobLondon, jobBlr]);
    assert.strictEqual(deduped.length, 2);
  });

  it('guarantees unique IDs across all returned jobs even if distinct input jobs share the same id', () => {
    // Two distinct jobs (different companies, titles, URLs) that somehow both have id = 'wwr-1'
    const job1 = createSampleJob({
      id: 'wwr-1',
      company: 'Company Alpha',
      title: 'Senior DevOps Architect',
      applicationUrl: 'https://weworkremotely.com/remote-jobs/alpha-devops-1',
    });

    const job2 = createSampleJob({
      id: 'wwr-1',
      company: 'Company Beta',
      title: 'Product Marketing Manager',
      applicationUrl: 'https://weworkremotely.com/remote-jobs/beta-marketing-1',
    });

    const deduped = deduplicateJobs([job1, job2]);
    assert.strictEqual(deduped.length, 2);
    // Keys must be strictly unique
    assert.notStrictEqual(deduped[0].id, deduped[1].id);
    assert.strictEqual(deduped[0].id, 'wwr-1');
    assert.ok(deduped[1].id.startsWith('wwr-1-'));
  });
});
