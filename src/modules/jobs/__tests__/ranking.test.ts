import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  filterAndRankJobs,
  matchesLocation,
  matchesQuery,
  matchesSingleLocation,
  parseQueryTokens,
  matchesType,
  matchesLevel,
  matchesRemote,
} from '../domain/job.ranking';
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
    workplaceType: partial.workplaceType,
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

describe('Search by City Suite', () => {
  it('supports bidirectional Indian city synonyms (Bangalore <-> Bengaluru)', () => {
    const blrJob = makeJob({ id: 'blr', location: 'Bengaluru, Karnataka' });
    const bngJob = makeJob({ id: 'bng', location: 'Bangalore, India' });

    assert.ok(matchesLocation(blrJob, 'Bangalore'));
    assert.ok(matchesLocation(blrJob, 'Bengaluru'));
    assert.ok(matchesLocation(bngJob, 'Bangalore'));
    assert.ok(matchesLocation(bngJob, 'Bengaluru'));
  });

  it('supports Gurgaon <-> Gurugram <-> Delhi NCR synonyms', () => {
    const gurgaonJob = makeJob({ id: 'ggn', location: 'Gurgaon, Haryana' });
    const gurugramJob = makeJob({ id: 'ggr', location: 'Gurugram, India' });
    const noidaJob = makeJob({ id: 'noida', location: 'Noida, Uttar Pradesh' });
    const delhiJob = makeJob({ id: 'delhi', location: 'New Delhi, India' });

    // Gurgaon / Gurugram cross-resolution
    assert.ok(matchesLocation(gurgaonJob, 'Gurugram'));
    assert.ok(matchesLocation(gurugramJob, 'Gurgaon'));

    // NCR includes Gurgaon, Noida, and Delhi
    assert.ok(matchesLocation(gurgaonJob, 'Delhi NCR'));
    assert.ok(matchesLocation(noidaJob, 'Delhi NCR'));
    assert.ok(matchesLocation(delhiJob, 'Delhi NCR'));
  });

  it('supports Mumbai <-> Bombay, Chennai <-> Madras, Kolkata <-> Calcutta', () => {
    const mumbaiJob = makeJob({ location: 'Mumbai, Maharashtra' });
    const chennaiJob = makeJob({ location: 'Chennai, Tamil Nadu' });
    const kolkataJob = makeJob({ location: 'Kolkata, West Bengal' });

    assert.ok(matchesLocation(mumbaiJob, 'Bombay'));
    assert.ok(matchesLocation(mumbaiJob, 'Mumbai'));
    assert.ok(matchesLocation(chennaiJob, 'Madras'));
    assert.ok(matchesLocation(chennaiJob, 'Chennai'));
    assert.ok(matchesLocation(kolkataJob, 'Calcutta'));
    assert.ok(matchesLocation(kolkataJob, 'Kolkata'));
  });

  it('supports US cities and synonyms (SF <-> San Francisco, NYC <-> New York, Austin, Seattle)', () => {
    const sfJob = makeJob({ location: 'San Francisco, CA' });
    const nycJob = makeJob({ location: 'New York, NY' });
    const austinJob = makeJob({ location: 'Austin, TX' });
    const seattleJob = makeJob({ location: 'Seattle, WA' });

    assert.ok(matchesLocation(sfJob, 'sf'));
    assert.ok(matchesLocation(sfJob, 'San Francisco'));
    assert.ok(matchesLocation(sfJob, 'Bay Area'));
    assert.ok(matchesLocation(nycJob, 'nyc'));
    assert.ok(matchesLocation(nycJob, 'New York'));
    assert.ok(matchesLocation(austinJob, 'Austin'));
    assert.ok(matchesLocation(seattleJob, 'Seattle'));
  });

  it('supports European cities (London, Berlin, Munich, Paris, Amsterdam)', () => {
    const londonJob = makeJob({ location: 'London, Greater London' });
    const berlinJob = makeJob({ location: 'Berlin, Germany' });
    const munichJob = makeJob({ location: 'München, Bayern' });
    const parisJob = makeJob({ location: 'Paris, France' });

    assert.ok(matchesLocation(londonJob, 'London'));
    assert.ok(matchesLocation(berlinJob, 'Berlin'));
    assert.ok(matchesLocation(munichJob, 'Munich'));
    assert.ok(matchesLocation(munichJob, 'München'));
    assert.ok(matchesLocation(parisJob, 'Paris'));
  });

  it('negative: searching a city does NOT match unrelated cities', () => {
    const blrJob = makeJob({ location: 'Bengaluru, Karnataka' });
    const londonJob = makeJob({ location: 'London, UK' });

    assert.strictEqual(matchesLocation(blrJob, 'Pune'), false);
    assert.strictEqual(matchesLocation(blrJob, 'Hyderabad'), false);
    assert.strictEqual(matchesLocation(blrJob, 'London'), false);
    assert.strictEqual(matchesLocation(londonJob, 'Berlin'), false);
    assert.strictEqual(matchesLocation(londonJob, 'San Francisco'), false);
  });
});

describe('Search by Country & Region Suite', () => {
  it('searching "India" matches all Indian cities, states, and global remote eligible for India', () => {
    const blrJob = makeJob({ location: 'Bengaluru', isIndiaEligible: true });
    const puneJob = makeJob({ location: 'Pune, Maharashtra', isIndiaEligible: true });
    const hydJob = makeJob({ location: 'Hyderabad, Telangana', isIndiaEligible: true });
    const remoteIndiaJob = makeJob({ location: 'Remote', isIndiaEligible: true });
    const londonJob = makeJob({ location: 'London, UK', isIndiaEligible: false });

    assert.ok(matchesLocation(blrJob, 'India'));
    assert.ok(matchesLocation(puneJob, 'India'));
    assert.ok(matchesLocation(hydJob, 'India'));
    assert.ok(matchesLocation(remoteIndiaJob, 'India'));
    assert.strictEqual(matchesLocation(londonJob, 'India'), false);
  });

  it('searching "United States" / "USA" matches US cities and state abbreviations with word boundaries', () => {
    const sfJob = makeJob({ location: 'San Francisco, CA' });
    const austinJob = makeJob({ location: 'Austin, TX' });
    const nyJob = makeJob({ location: 'New York, NY' });
    const blrJob = makeJob({ location: 'Bengaluru, India' });

    assert.ok(matchesLocation(sfJob, 'United States'));
    assert.ok(matchesLocation(sfJob, 'USA'));
    assert.ok(matchesLocation(austinJob, 'United States'));
    assert.ok(matchesLocation(nyJob, 'USA'));
    assert.strictEqual(matchesLocation(blrJob, 'United States'), false);
    assert.strictEqual(matchesLocation(blrJob, 'USA'), false);
  });

  it('searching "United Kingdom" / "UK" matches UK cities without partial word collisions', () => {
    const londonJob = makeJob({ location: 'London, United Kingdom' });
    const mcrJob = makeJob({ location: 'Manchester, UK' });
    const blrJob = makeJob({ location: 'Bengaluru, India' });

    assert.ok(matchesLocation(londonJob, 'UK'));
    assert.ok(matchesLocation(londonJob, 'United Kingdom'));
    assert.ok(matchesLocation(mcrJob, 'UK'));
    assert.strictEqual(matchesLocation(blrJob, 'UK'), false);
  });

  it('searching "Germany" matches German tech hubs', () => {
    const berlinJob = makeJob({ location: 'Berlin' });
    const munichJob = makeJob({ location: 'Munich' });
    const parisJob = makeJob({ location: 'Paris, France' });

    assert.ok(matchesLocation(berlinJob, 'Germany'));
    assert.ok(matchesLocation(munichJob, 'Germany'));
    assert.strictEqual(matchesLocation(parisJob, 'Germany'), false);
  });

  it('searching "Europe" matches UK, Germany, France, Netherlands, and Sweden', () => {
    const londonJob = makeJob({ location: 'London, UK' });
    const berlinJob = makeJob({ location: 'Berlin, Germany' });
    const amsterdamJob = makeJob({ location: 'Amsterdam, Netherlands' });
    const blrJob = makeJob({ location: 'Bengaluru, India' });

    assert.ok(matchesLocation(londonJob, 'Europe'));
    assert.ok(matchesLocation(berlinJob, 'Europe'));
    assert.ok(matchesLocation(amsterdamJob, 'Europe'));
    assert.strictEqual(matchesLocation(blrJob, 'Europe'), false);
  });
});

describe('Compound Location Filter & Suggestion Suite', () => {
  it('handles suggestion "Bengaluru, Karnataka" matching Bangalore and Bengaluru correctly', () => {
    const blrJob = makeJob({ location: 'Bengaluru, India' });
    const bngJob = makeJob({ location: 'Bangalore' });
    const stateOnlyJob = makeJob({ location: 'Karnataka, India' });
    const puneJob = makeJob({ location: 'Pune, Maharashtra' });
    const mysuruJob = makeJob({ location: 'Mysuru, Karnataka' });

    assert.ok(matchesLocation(blrJob, 'Bengaluru, Karnataka'));
    assert.ok(matchesLocation(bngJob, 'Bengaluru, Karnataka'));
    assert.ok(matchesLocation(stateOnlyJob, 'Bengaluru, Karnataka'));
    // Negative checks: other cities should not match a Bengaluru query
    assert.strictEqual(matchesLocation(puneJob, 'Bengaluru, Karnataka'), false);
    assert.strictEqual(matchesLocation(mysuruJob, 'Bengaluru, Karnataka'), false);
  });

  it('handles suggestion "Delhi NCR / Gurgaon / Noida" matching any constituent city or synonym', () => {
    const ggnJob = makeJob({ location: 'Gurgaon, Haryana' });
    const ggrJob = makeJob({ location: 'Gurugram, India' });
    const noidaJob = makeJob({ location: 'Noida, Uttar Pradesh' });
    const delhiJob = makeJob({ location: 'New Delhi, India' });
    const blrJob = makeJob({ location: 'Bengaluru, India' });

    const filter = 'Delhi NCR / Gurgaon / Noida';
    assert.ok(matchesLocation(ggnJob, filter));
    assert.ok(matchesLocation(ggrJob, filter));
    assert.ok(matchesLocation(noidaJob, filter));
    assert.ok(matchesLocation(delhiJob, filter));
    assert.strictEqual(matchesLocation(blrJob, filter), false);
  });

  it('handles suggestion "San Francisco, CA" matching SF while excluding other CA cities', () => {
    const sfJob = makeJob({ location: 'San Francisco, CA' });
    const sfSynJob = makeJob({ location: 'SF, California' });
    const laJob = makeJob({ location: 'Los Angeles, CA' });
    const sdJob = makeJob({ location: 'San Diego, CA' });

    const filter = 'San Francisco, CA';
    assert.ok(matchesLocation(sfJob, filter));
    assert.ok(matchesLocation(sfSynJob, filter));
    assert.strictEqual(matchesLocation(laJob, filter), false);
    assert.strictEqual(matchesLocation(sdJob, filter), false);
  });

  it('handles suggestion "London, UK" matching London while excluding Manchester', () => {
    const londonJob = makeJob({ location: 'London, Greater London' });
    const mcrJob = makeJob({ location: 'Manchester, UK' });

    const filter = 'London, UK';
    assert.ok(matchesLocation(londonJob, filter));
    assert.strictEqual(matchesLocation(mcrJob, filter), false);
  });
});

describe('Combined Role + Location Keyword Query Suite', () => {
  it('correctly tokenizes role keywords, location keywords, and stop words', () => {
    const parsed = parseQueryTokens('Senior React Developer in Bangalore');
    assert.deepStrictEqual(parsed.roleTokens, ['senior', 'react', 'developer']);
    assert.deepStrictEqual(parsed.locationTokens, ['bangalore']);
    assert.strictEqual(parsed.rolePhrase, 'senior react developer');
    assert.strictEqual(parsed.hasRoleTokens, true);
    assert.strictEqual(parsed.hasLocationTokens, true);
  });

  it('extracts multi-word location expressions cleanly (e.g. "San Francisco")', () => {
    const parsed = parseQueryTokens('Product Designer San Francisco');
    assert.deepStrictEqual(parsed.roleTokens, ['product', 'designer']);
    assert.deepStrictEqual(parsed.locationTokens, ['san francisco']);
  });

  it('ranks role matches in requested location higher than role matches elsewhere', () => {
    const blrReact = makeJob({
      id: 'blr-react',
      title: 'Senior React Developer',
      location: 'Bengaluru, India',
    });

    const remoteReact = makeJob({
      id: 'remote-react',
      title: 'Senior React Developer',
      location: 'Remote',
    });

    const results = filterAndRankJobs([remoteReact, blrReact], {
      query: 'React Developer Bangalore',
    });

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'blr-react');
    assert.ok((results[0].score ?? 0) > (results[1].score ?? 0));
  });

  it('negative: irrelevant role in matching location is NOT returned', () => {
    const accountantInBlr = makeJob({
      id: 'accountant-blr',
      title: 'Senior Financial Accountant',
      location: 'Bengaluru, India',
      tags: ['finance', 'taxation'],
    });

    const reactEngineer = makeJob({
      id: 'react-eng',
      title: 'Senior React Developer',
      location: 'Remote',
    });

    // Query "React Developer Bangalore" should NOT match accountant in Bangalore
    const results = filterAndRankJobs([accountantInBlr, reactEngineer], {
      query: 'React Developer Bangalore',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'react-eng');
  });

  it('pure location query without role keywords matches all roles in that location', () => {
    const jobA = makeJob({ id: 'a', title: 'React Developer', location: 'Bengaluru, India' });
    const jobB = makeJob({ id: 'b', title: 'Accountant', location: 'Bangalore' });
    const jobC = makeJob({ id: 'c', title: 'Python Engineer', location: 'London, UK' });

    const results = filterAndRankJobs([jobA, jobB, jobC], { query: 'Bangalore' });
    assert.strictEqual(results.length, 2);
    assert.ok(results.some((j) => j.id === 'a'));
    assert.ok(results.some((j) => j.id === 'b'));
    assert.ok(!results.some((j) => j.id === 'c'));
  });
});

describe('Multi-Filter Synchronization Suite', () => {
  it('combines Role Query + Location + Workplace + Employment Type + Level conjunctively', () => {
    const perfectMatch = makeJob({
      id: 'perfect',
      title: 'Senior Full Stack Engineer',
      location: 'Bengaluru, Karnataka',
      workplaceType: 'onsite',
      isRemote: false,
      employmentType: 'Full Time',
      seniority: 'Senior',
    });

    const wrongLevel = makeJob({
      id: 'wrong-level',
      title: 'Junior Full Stack Engineer',
      location: 'Bengaluru, Karnataka',
      workplaceType: 'onsite',
      isRemote: false,
      employmentType: 'Full Time',
      seniority: 'Entry',
    });

    const wrongWorkplace = makeJob({
      id: 'wrong-workplace',
      title: 'Senior Full Stack Engineer',
      location: 'Bengaluru, Karnataka',
      workplaceType: 'remote',
      isRemote: true,
      employmentType: 'Full Time',
      seniority: 'Senior',
    });

    const wrongType = makeJob({
      id: 'wrong-type',
      title: 'Senior Full Stack Engineer',
      location: 'Bengaluru, Karnataka',
      workplaceType: 'onsite',
      isRemote: false,
      employmentType: 'Contract',
      seniority: 'Senior',
    });

    const wrongLocation = makeJob({
      id: 'wrong-location',
      title: 'Senior Full Stack Engineer',
      location: 'London, UK',
      workplaceType: 'onsite',
      isRemote: false,
      employmentType: 'Full Time',
      seniority: 'Senior',
    });

    const candidatePool = [
      perfectMatch,
      wrongLevel,
      wrongWorkplace,
      wrongType,
      wrongLocation,
    ];

    const results = filterAndRankJobs(candidatePool, {
      query: 'Full Stack',
      location: 'Bangalore', // tests synonym with Bengaluru
      remote: 'onsite',
      type: 'full-time',
      level: 'senior',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'perfect');
  });

  it('matches mid-level engineering roles without explicit senior/lead prefix', () => {
    const midEng = makeJob({
      id: 'mid-eng',
      title: 'Software Engineer',
      seniority: 'Mid',
    });

    const srEng = makeJob({
      id: 'sr-eng',
      title: 'Senior Software Engineer',
      seniority: 'Senior',
    });

    const results = filterAndRankJobs([midEng, srEng], { level: 'mid' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'mid-eng');
  });

  it('matches lead/manager roles accurately', () => {
    const mgr = makeJob({
      id: 'mgr',
      title: 'Engineering Manager',
      seniority: 'Lead',
    });

    const intern = makeJob({
      id: 'intern',
      title: 'Software Intern',
      seniority: 'Entry',
    });

    const results = filterAndRankJobs([mgr, intern], { level: 'lead' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'mgr');
  });
});
