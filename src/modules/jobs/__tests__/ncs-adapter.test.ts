import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NcsAdapter, VERIFIED_NCS_VACANCIES } from '../adapters/ncs/ncs.adapter';
import { maskJobForAnonymous, getFallbackApplicationUrl } from '../domain/job.masking';
import { toLegacyJob } from '../domain/job.types';
import {
  normalizeEmploymentType,
  normalizeSeniority,
  normalizeSalary,
  normalizeLocation,
} from '../domain/job.normalization';

describe('National Career Service (NCS) Adapter Suite', () => {
  it('instantiates with official metadata and default timeout', () => {
    const adapter = new NcsAdapter();
    assert.strictEqual(adapter.id, 'ncs');
    assert.strictEqual(adapter.name, 'National Career Service');
    assert.strictEqual(adapter.timeoutMs, 6000);
  });

  it('quarantines synthetic data: returns empty array in production when unconfigured', async () => {
    const adapter = new NcsAdapter(); // No test fixture injected
    const jobs = await adapter.fetchJobs();
    assert.strictEqual(jobs.length, 0, 'Production must never serve unverifiable synthetic vacancies');
  });

  it('fetches verified Indian public sector, ministry, and apprenticeship vacancies with injected fixture', async () => {
    const adapter = new NcsAdapter(VERIFIED_NCS_VACANCIES);
    const jobs = await adapter.fetchJobs();

    assert.ok(Array.isArray(jobs));
    assert.ok(jobs.length >= VERIFIED_NCS_VACANCIES.length);

    // Verify properties on first job
    const sample = jobs[0];
    assert.ok(sample.id.startsWith('ncs-'));
    assert.strictEqual(sample.sourceName, 'National Career Service');
    assert.ok(sample.title.length > 0);
    assert.ok(sample.company.length > 0);
    assert.strictEqual(sample.isIndiaEligible, true);
    assert.ok(sample.location.length > 0);
    assert.ok(sample.applicationUrl.startsWith('https://www.ncs.gov.in'));
    assert.ok(sample.tags.length > 0);
  });

  it('accurately maps Indian tech hubs (Bengaluru, Pune, Delhi NCR, Hyderabad, Mumbai, Nagpur)', async () => {
    const adapter = new NcsAdapter(VERIFIED_NCS_VACANCIES);
    const jobs = await adapter.fetchJobs();

    const blrJob = jobs.find((j) => j.location.includes('Bengaluru'));
    assert.ok(blrJob, 'Should include Bengaluru vacancies');
    assert.strictEqual(blrJob.isIndiaEligible, true);

    const puneJob = jobs.find((j) => j.location.includes('Pune'));
    assert.ok(puneJob, 'Should include Pune vacancies');

    const nagpurJob = jobs.find((j) => j.location.includes('Nagpur'));
    assert.ok(nagpurJob, 'Should include tier-2 hubs like Nagpur');
  });

  it('preserves Indian salary formats (LPA, Lakhs, INR / month)', async () => {
    const adapter = new NcsAdapter(VERIFIED_NCS_VACANCIES);
    const jobs = await adapter.fetchJobs();

    const nicJob = jobs.find((j) => j.company.includes('NIC'));
    assert.ok(nicJob);
    assert.strictEqual(nicJob.salary, '₹14,00,000 - ₹20,00,000');

    const drdoJob = jobs.find((j) => j.company.includes('DRDO'));
    assert.ok(drdoJob);
    assert.strictEqual(drdoJob.salary, '₹35,000 / month');
  });

  it('normalizes apprenticeship roles with proper employmentType and Entry seniority', async () => {
    const adapter = new NcsAdapter(VERIFIED_NCS_VACANCIES);
    const jobs = await adapter.fetchJobs();

    const apprenticeJobs = jobs.filter((j) => j.employmentType === 'Apprenticeship');
    assert.ok(apprenticeJobs.length >= 2, 'Should contain NAPS apprenticeship roles');

    for (const appJob of apprenticeJobs) {
      assert.strictEqual(appJob.seniority, 'Entry');
      assert.strictEqual(appJob.isIndiaEligible, true);
    }
  });

  it('complies strictly with anonymous user data masking', async () => {
    const adapter = new NcsAdapter(VERIFIED_NCS_VACANCIES);
    const [rawJob] = await adapter.fetchJobs();

    const legacyJob = toLegacyJob(rawJob);
    const masked = maskJobForAnonymous(legacyJob);

    // Company name must be masked
    assert.strictEqual(masked.company, 'Company undisclosed');
    // Application URL must be redacted for anonymous users
    assert.strictEqual(masked.url, '');
    // Public discovery attributes remain intact
    assert.strictEqual(masked.title, rawJob.title);
    assert.strictEqual(masked.location, rawJob.location);
    assert.strictEqual(masked.isIndiaEligible, true);
    assert.strictEqual(masked.source, 'National Career Service');
  });

  it('provides verified fallback URL for National Career Service', () => {
    const fallback = getFallbackApplicationUrl({
      source: 'National Career Service',
      title: 'Cloud Engineer',
      url: '',
    });

    assert.strictEqual(fallback, 'https://www.ncs.gov.in/job-seeker/pages/search.aspx');
  });
});

describe('Indian Hiring Normalization & Salary Quality Suite', () => {
  it('normalizes Indian employment types (Apprenticeships, Internships, Freshers)', () => {
    assert.strictEqual(normalizeEmploymentType('Graduate Apprentice'), 'Apprenticeship');
    assert.strictEqual(normalizeEmploymentType('Summer Intern'), 'Internship');
    assert.strictEqual(normalizeEmploymentType('Trainee Engineer'), 'Trainee / Fresher');
    assert.strictEqual(normalizeEmploymentType('Fresher Hiring 2026'), 'Trainee / Fresher');
    assert.strictEqual(normalizeEmploymentType('Full Time Permanent'), 'Full Time');
    assert.strictEqual(normalizeEmploymentType('Contractor 12 Months'), 'Contract');
  });

  it('classifies Indian freshers and apprentices into Entry seniority', () => {
    assert.strictEqual(normalizeSeniority('Graduate Apprentice Engineer'), 'Entry');
    assert.strictEqual(normalizeSeniority('Software Trainee (Fresher)'), 'Entry');
    assert.strictEqual(normalizeSeniority('Junior Frontend Developer'), 'Entry');
    assert.strictEqual(normalizeSeniority('Software Engineer'), 'Mid');
    assert.strictEqual(normalizeSeniority('Senior Software Engineer'), 'Senior');
    assert.strictEqual(normalizeSeniority('Technical Lead / Engineering Manager'), 'Lead');
  });

  it('normalizes Indian and international salary expressions accurately', () => {
    assert.strictEqual(normalizeSalary('14 - 20 LPA'), '14 - 20 LPA');
    assert.strictEqual(normalizeSalary('12 Lakhs Per Annum'), '12 Lakhs Per Annum');
    assert.strictEqual(normalizeSalary('₹50,000 / month'), '₹50,000 / month');
    assert.strictEqual(normalizeSalary('INR 8,00,000'), 'INR 8,00,000');
    assert.strictEqual(normalizeSalary('$120,000 - $140,000'), '$120,000 - $140,000');

    // Negative / undisclosed formats
    assert.strictEqual(normalizeSalary(undefined), undefined);
    assert.strictEqual(normalizeSalary(''), undefined);
    assert.strictEqual(normalizeSalary('Not Disclosed'), undefined);
    assert.strictEqual(normalizeSalary('Competitive'), undefined);
    assert.strictEqual(normalizeSalary('Unspecified'), undefined);
  });

  it('marks Indian tier-1 and tier-2 hubs as India eligible in normalizeLocation', () => {
    const nagpur = normalizeLocation('Nagpur, Maharashtra');
    assert.strictEqual(nagpur.isIndiaEligible, true);

    const vizag = normalizeLocation('Visakhapatnam, Andhra Pradesh');
    assert.strictEqual(vizag.isIndiaEligible, true);

    const coimbatore = normalizeLocation('Coimbatore, Tamil Nadu');
    assert.strictEqual(coimbatore.isIndiaEligible, true);

    const blr = normalizeLocation('Bengaluru, Karnataka');
    assert.strictEqual(blr.isIndiaEligible, true);

    const london = normalizeLocation('London, United Kingdom');
    assert.strictEqual(london.isIndiaEligible, false);
  });
});
