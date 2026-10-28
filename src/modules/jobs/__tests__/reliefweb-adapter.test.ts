import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ReliefWebAdapter, ReliefWebItem } from '../adapters/reliefweb/reliefweb.adapter';

describe('ReliefWeb (UN OCHA) Adapter Suite', () => {
  const MOCK_RELIEFWEB_ITEMS: ReliefWebItem[] = [
    {
      id: 'rw-101',
      fields: {
        title: 'Emergency Medical Coordinator - Field Hospital',
        url: 'https://reliefweb.int/job/4000101/emergency-medical-coordinator',
        body: '<p>Directing mobile health clinic operations and vaccination programs.</p>',
        date: {
          created: '2026-10-24T10:00:00Z',
        },
        source: [{ name: 'World Health Organization (WHO)' }],
        country: [{ name: 'India' }],
        city: [{ name: 'New Delhi' }],
        theme: [{ name: 'Health' }],
        career_categories: [{ name: 'Health' }],
        type: [{ name: 'Full-time' }],
      },
    },
    {
      id: 'rw-102',
      fields: {
        title: 'Logistics and Supply Chain Officer',
        url: 'https://reliefweb.int/job/4000102/logistics-officer',
        body: '<p>Overseeing warehousing, freight dispatch, and distribution.</p>',
        date: {
          created: '2026-10-25T11:00:00Z',
        },
        source: [{ name: 'UNICEF' }],
        country: [{ name: 'Kenya' }],
        city: [{ name: 'Nairobi' }],
        theme: [{ name: 'Logistics and Telecommunications' }],
        career_categories: [{ name: 'Logistics' }],
        type: [{ name: 'Contract' }],
      },
    },
  ];

  it('initializes adapter with correct metadata', () => {
    const adapter = new ReliefWebAdapter();
    assert.strictEqual(adapter.id, 'reliefweb');
    assert.strictEqual(adapter.name, 'ReliefWeb (UN OCHA)');
    assert.strictEqual(adapter.timeoutMs, 6000);
  });

  it('normalizes multi-sector humanitarian jobs with proper industry classifications', async () => {
    const adapter = new ReliefWebAdapter(MOCK_RELIEFWEB_ITEMS);
    const jobs = await adapter.fetchJobs();

    assert.strictEqual(jobs.length, 2);

    const medicalJob = jobs[0];
    assert.strictEqual(medicalJob.title, 'Emergency Medical Coordinator - Field Hospital');
    assert.strictEqual(medicalJob.company, 'World Health Organization (WHO)');
    assert.strictEqual(medicalJob.industry, 'healthcare');
    assert.strictEqual(medicalJob.location, 'New Delhi, India');
    assert.strictEqual(medicalJob.isIndiaEligible, true);
    assert.strictEqual(medicalJob.sourceName, 'ReliefWeb (UN OCHA)');

    const logisticsJob = jobs[1];
    assert.strictEqual(logisticsJob.title, 'Logistics and Supply Chain Officer');
    assert.strictEqual(logisticsJob.company, 'UNICEF');
    assert.strictEqual(logisticsJob.industry, 'logistics_transport');
    assert.strictEqual(logisticsJob.location, 'Nairobi, Kenya');
  });

  it('safely handles unconfigured appname in live environment without crashing', async () => {
    const originalAppname = process.env.RELIEFWEB_APPNAME;
    delete process.env.RELIEFWEB_APPNAME;

    try {
      const adapter = new ReliefWebAdapter();
      const jobs = await adapter.fetchJobs();
      assert.strictEqual(Array.isArray(jobs), true);
      assert.strictEqual(jobs.length, 0);
    } finally {
      if (originalAppname) {
        process.env.RELIEFWEB_APPNAME = originalAppname;
      }
    }
  });
});

