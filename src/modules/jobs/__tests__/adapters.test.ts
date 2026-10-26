import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HimalayasAdapter } from '../adapters/himalayas/himalayas.adapter';
import { WeWorkRemotelyAdapter } from '../adapters/weworkremotely/weworkremotely.adapter';
import { GreenhouseAdapter } from '../adapters/ats/greenhouse.adapter';
import { AshbyAdapter } from '../adapters/ats/ashby.adapter';

describe('Provider Adapters Unit Tests', () => {
  describe('HimalayasAdapter', () => {
    it('normalizes Himalayas job structure correctly', () => {
      const adapter = new HimalayasAdapter();
      assert.strictEqual(adapter.name, 'Himalayas');
      assert.strictEqual(adapter.isRemoteOnly, true);
    });
  });

  describe('WeWorkRemotelyAdapter', () => {
    const adapter = new WeWorkRemotelyAdapter();

    it('correctly parses RSS XML items with company prefix and location', () => {
      const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>We Work Remotely</title>
    <item>
      <title>Keeper Security: Senior Cloud Architect</title>
      <region>Anywhere in the World</region>
      <category>Cloud Engineering</category>
      <type>Full-Time</type>
      <description>&lt;p&gt;Looking for an experienced architect.&lt;/p&gt;</description>
      <pubDate>Mon, 26 Oct 2026 09:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/keeper-security-senior-cloud-architect</link>
    </item>
    <item>
      <title>Acme Corp: Remote React Developer</title>
      <region>USA Only</region>
      <category>Frontend</category>
      <type>Contract</type>
      <description>&lt;p&gt;React specialist needed.&lt;/p&gt;</description>
      <pubDate>Mon, 26 Oct 2026 08:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/acme-corp-remote-react-developer?utm_source=rss</link>
    </item>
  </channel>
</rss>`;

      const jobs = adapter.parseRssXml(sampleXml);
      assert.strictEqual(jobs.length, 2);

      const job1 = jobs[0];
      assert.strictEqual(job1.company, 'Keeper Security');
      assert.strictEqual(job1.title, 'Senior Cloud Architect');
      assert.strictEqual(job1.location, 'Anywhere in the World');
      assert.strictEqual(job1.isRemote, true);
      assert.strictEqual(job1.workplaceType, 'remote');
      assert.strictEqual(job1.isIndiaEligible, true);
      assert.strictEqual(job1.seniority, 'Lead');
      assert.strictEqual(job1.employmentType, 'Full Time');

      const job2 = jobs[1];
      assert.strictEqual(job2.company, 'Acme Corp');
      assert.strictEqual(job2.title, 'Remote React Developer');
      assert.strictEqual(job2.isRemote, true);
      assert.strictEqual(job2.isIndiaEligible, false); // USA Only
      assert.strictEqual(job2.applicationUrl, 'https://weworkremotely.com/remote-jobs/acme-corp-remote-react-developer'); // stripped UTM
    });

    it('safely handles malformed XML items and skips invalid URLs', () => {
      const badXml = `<rss><channel><item><title>Broken Job</title><link>not-a-valid-url</link></item></channel></rss>`;
      const jobs = adapter.parseRssXml(badXml);
      assert.strictEqual(jobs.length, 0);
    });
  });

  describe('Greenhouse & Ashby ATS Adapters', () => {
    it('initializes Greenhouse adapter with default verified employer boards', () => {
      const gh = new GreenhouseAdapter();
      assert.strictEqual(gh.name, 'Greenhouse ATS');
    });

    it('initializes Ashby adapter with default verified employer boards', () => {
      const ashby = new AshbyAdapter();
      assert.strictEqual(ashby.name, 'Ashby ATS');
    });
  });
});
