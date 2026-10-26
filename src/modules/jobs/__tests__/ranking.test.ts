import { describe, it } from 'node:test';
import assert from 'node:assert';
import { filterAndRankJobs } from '../domain/job.ranking';
import { NormalizedJob } from '../domain/job.types';

function makeJob(partial: Partial<NormalizedJob>): NormalizedJob {
  return {
    id: partial.id || 'job-1',
    sourceId: '1',
    sourceName: 'TestProvider',
    title: partial.title || 'Software Engineer',
    company: partial.company || 'CompanyX',
    location: partial.location || 'Remote',
    isRemote: partial.isRemote ?? true,
    description: partial.description || 'Description of the role',
    applicationUrl: 'https://example.com/apply',
    publishedAt: partial.publishedAt || new Date().toISOString(),
    employmentType: partial.employmentType || 'Full Time',
    tags: partial.tags || [],
    isIndiaEligible: partial.isIndiaEligible ?? false,
    seniority: partial.seniority || 'Mid',
  };
}

describe('Job Ranking & Filtering Unit Tests', () => {
  it('prioritizes exact title match over tags/description', () => {
    const jobExact = makeJob({
      id: 'exact-match',
      title: 'Senior React Developer',
      tags: ['javascript'],
    });

    const jobTag = makeJob({
      id: 'tag-match',
      title: 'Fullstack Engineer',
      tags: ['react', 'node'],
    });

    const results = filterAndRankJobs([jobTag, jobExact], { query: 'React' });
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'exact-match');
    assert.ok((results[0].score ?? 0) > (results[1].score ?? 0));
  });

  it('does NOT let location boost push an irrelevant job ahead of an exact title match', () => {
    const jobRelevantLondon = makeJob({
      id: 'relevant-london',
      title: 'Staff React Engineer',
      location: 'London, UK',
      isIndiaEligible: false,
    });

    const jobIrrelevantIndia = makeJob({
      id: 'irrelevant-mumbai',
      title: 'Financial Accountant',
      location: 'Mumbai, India',
      isIndiaEligible: true,
    });

    // When querying 'React', the accountant job should have NO match and be filtered out completely
    const results = filterAndRankJobs([jobIrrelevantIndia, jobRelevantLondon], { query: 'React' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'relevant-london');
  });

  it('supports Indian city synonyms in location filter (e.g., Bangalore and Bengaluru)', () => {
    const blrJob = makeJob({
      id: 'blr-job',
      title: 'Backend Engineer',
      location: 'Bengaluru, Karnataka',
    });

    const results = filterAndRankJobs([blrJob], { location: 'Bangalore' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'blr-job');
  });

  it('filters by employment type and seniority correctly', () => {
    const leadJob = makeJob({
      id: 'lead-job',
      title: 'Engineering Director',
      seniority: 'Lead',
      employmentType: 'Full Time',
    });

    const internJob = makeJob({
      id: 'intern-job',
      title: 'Software Engineering Intern',
      seniority: 'Entry',
      employmentType: 'Internship',
    });

    const resultsType = filterAndRankJobs([leadJob, internJob], { type: 'internship' });
    assert.strictEqual(resultsType.length, 1);
    assert.strictEqual(resultsType[0].id, 'intern-job');

    const resultsLevel = filterAndRankJobs([leadJob, internJob], { level: 'lead' });
    assert.strictEqual(resultsLevel.length, 1);
    assert.strictEqual(resultsLevel[0].id, 'lead-job');
  });

  it('applies freshness boost to recently published jobs', () => {
    const today = new Date();
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const twoMonthsAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const freshJob = makeJob({
      id: 'fresh-job',
      title: 'DevOps Engineer',
      publishedAt: twoDaysAgo,
    });

    const oldJob = makeJob({
      id: 'old-job',
      title: 'DevOps Engineer',
      publishedAt: twoMonthsAgo,
    });

    const results = filterAndRankJobs([oldJob, freshJob], { query: 'DevOps' });
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'fresh-job');
  });

  it('filters explicitly between Remote vs On-site vs Hybrid workplaces', () => {
    const remoteGlobal = makeJob({
      id: 'job-remote-global',
      title: 'Fullstack Engineer',
      location: 'Remote, Worldwide',
      isRemote: true,
      workplaceType: 'remote',
      isIndiaEligible: true,
    });

    const onsiteBlr = makeJob({
      id: 'job-onsite-blr',
      title: 'Fullstack Engineer',
      location: 'Bengaluru, India',
      isRemote: false,
      workplaceType: 'onsite',
      isIndiaEligible: true,
    });

    const hybridPune = makeJob({
      id: 'job-hybrid-pune',
      title: 'Fullstack Engineer',
      location: 'Pune, India (Hybrid)',
      isRemote: true,
      workplaceType: 'hybrid',
      isIndiaEligible: true,
    });

    // Remote only
    const remoteOnlyRes = filterAndRankJobs([remoteGlobal, onsiteBlr, hybridPune], { remote: 'remote' });
    assert.strictEqual(remoteOnlyRes.length, 2);
    assert.ok(remoteOnlyRes.some((j) => j.id === 'job-remote-global'));
    assert.ok(!remoteOnlyRes.some((j) => j.id === 'job-onsite-blr'));

    // On-site only
    const onsiteRes = filterAndRankJobs([remoteGlobal, onsiteBlr, hybridPune], { remote: 'onsite' });
    assert.strictEqual(onsiteRes.length, 1);
    assert.strictEqual(onsiteRes[0].id, 'job-onsite-blr');

    // Hybrid only
    const hybridRes = filterAndRankJobs([remoteGlobal, onsiteBlr, hybridPune], { remote: 'hybrid' });
    assert.strictEqual(hybridRes.length, 1);
    assert.strictEqual(hybridRes[0].id, 'job-hybrid-pune');

    // Remote India eligible
    const remoteIndiaRes = filterAndRankJobs([remoteGlobal, onsiteBlr], { remote: 'remote_india' });
    assert.strictEqual(remoteIndiaRes.length, 1);
    assert.strictEqual(remoteIndiaRes[0].id, 'job-remote-global');
  });
});
