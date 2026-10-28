import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TeachingAdapter, UkTeachingJobRaw } from '../adapters/teaching/teaching.adapter';

describe('UK Teaching Vacancies Adapter Suite', () => {
  const MOCK_TEACHING_JOBS: UkTeachingJobRaw[] = [
    {
      title: 'Head of Mathematics (Secondary)',
      url: 'https://teaching-vacancies.service.gov.uk/jobs/head-of-mathematics-leftwich',
      datePosted: '2026-10-25',
      description: '<p>Seeking an experienced Head of Maths to lead our STEM department.</p>',
      employmentType: 'Full-time',
      hiringOrganization: {
        name: 'Leftwich High School',
        sameAs: 'https://www.leftwichhigh.com',
      },
      jobLocation: {
        address: {
          addressLocality: 'Northwich',
          addressRegion: 'Cheshire',
          addressCountry: 'GB',
        },
      },
      baseSalary: {
        value: {
          value: '£42,000 - £48,000 Annually',
        },
      },
    },
    {
      title: 'Learning Support Assistant - Speech & Language',
      url: 'https://teaching-vacancies.service.gov.uk/jobs/lsa-speech-and-language',
      datePosted: '2026-10-26',
      description: '<div>Support students with communication needs.</div>',
      employmentType: 'Part-time',
      hiringOrganization: {
        name: 'Oakwood Primary Academy',
      },
      jobLocation: {
        address: {
          addressLocality: 'Manchester',
          addressRegion: 'Greater Manchester',
          addressCountry: 'GB',
        },
      },
    },
  ];

  it('initializes adapter with correct metadata', () => {
    const adapter = new TeachingAdapter();
    assert.strictEqual(adapter.id, 'teaching_uk');
    assert.strictEqual(adapter.name, 'UK Teaching Vacancies');
    assert.strictEqual(adapter.timeoutMs, 6000);
  });

  it('normalizes teaching vacancies into Canonical NormalizedJob format with education industry', async () => {
    const adapter = new TeachingAdapter(MOCK_TEACHING_JOBS);
    const jobs = await adapter.fetchJobs();

    assert.strictEqual(jobs.length, 2);

    const first = jobs[0];
    assert.strictEqual(first.title, 'Head of Mathematics (Secondary)');
    assert.strictEqual(first.company, 'Leftwich High School');
    assert.strictEqual(first.industry, 'education');
    assert.strictEqual(first.category, 'Education & Training');
    assert.strictEqual(first.location, 'Northwich, Cheshire, United Kingdom');
    assert.strictEqual(first.sourceName, 'UK Teaching Vacancies');
    assert.strictEqual(first.applicationUrl, 'https://teaching-vacancies.service.gov.uk/jobs/head-of-mathematics-leftwich');
    assert.ok(first.tags.includes('Education'));
    assert.ok(first.tags.includes('Teaching'));
    assert.strictEqual(first.seniority, 'Lead');
    assert.strictEqual(first.salary, '£42,000 - £48,000 Annually');

    const second = jobs[1];
    assert.strictEqual(second.title, 'Learning Support Assistant - Speech & Language');
    assert.strictEqual(second.company, 'Oakwood Primary Academy');
    assert.strictEqual(second.industry, 'education');
    assert.strictEqual(second.employmentType, 'Part Time');
  });

  it('skips malformed items missing title or application URL', async () => {
    const malformed: UkTeachingJobRaw[] = [
      { title: '', url: 'https://teaching-vacancies.service.gov.uk/jobs/invalid' },
      { title: 'No URL Role' },
      { title: 'Invalid Scheme', url: 'javascript:alert(1)' },
    ];
    const adapter = new TeachingAdapter(malformed);
    const jobs = await adapter.fetchJobs();
    assert.strictEqual(jobs.length, 0);
  });
});

