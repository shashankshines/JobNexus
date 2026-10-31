import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isValidHttpUrl,
  canonicalizeUrl,
  stripHtml,
  normalizeDate,
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSeniority,
} from '../domain/job.normalization';

describe('Job Normalization & Sanitization Unit Tests', () => {
  describe('isValidHttpUrl', () => {
    it('accepts valid HTTP and HTTPS URLs', () => {
      assert.strictEqual(isValidHttpUrl('https://example.com/jobs/1'), true);
      assert.strictEqual(isValidHttpUrl('http://jobs.example.org?id=123'), true);
    });

    it('rejects unsafe protocols and invalid strings', () => {
      assert.strictEqual(isValidHttpUrl('javascript:alert(1)'), false);
      assert.strictEqual(isValidHttpUrl('data:text/html,<script>alert(1)</script>'), false);
      assert.strictEqual(isValidHttpUrl('ftp://files.example.com'), false);
      assert.strictEqual(isValidHttpUrl('/relative/url'), false);
      assert.strictEqual(isValidHttpUrl(''), false);
      assert.strictEqual(isValidHttpUrl(null), false);
      assert.strictEqual(isValidHttpUrl(undefined), false);
    });
  });

  describe('canonicalizeUrl', () => {
    it('strips tracking UTM parameters while preserving legitimate params', () => {
      const dirtyUrl = 'https://Example.com/jobs/dev?utm_source=linkedin&utm_medium=feed&jobId=9988&ref=jobboard';
      const cleanUrl = canonicalizeUrl(dirtyUrl);
      assert.strictEqual(cleanUrl, 'https://example.com/jobs/dev?jobId=9988');
    });

    it('strips fragments and trailing root slashes', () => {
      const urlWithHash = 'https://example.com/#apply';
      assert.strictEqual(canonicalizeUrl(urlWithHash), 'https://example.com');
    });

    it('returns empty string for invalid URLs', () => {
      assert.strictEqual(canonicalizeUrl('not a url'), '');
    });
  });

  describe('stripHtml', () => {
    it('strips HTML tags and decodes entities safely', () => {
      const raw = '<p>Senior <strong>React</strong> &amp; Node.js developer &lt;Remote&gt; role. &#39;Fast&#39; pace.</p>';
      const clean = stripHtml(raw);
      assert.strictEqual(clean, "Senior React & Node.js developer <Remote> role. 'Fast' pace.");
    });

    it('strips embedded scripts and styles', () => {
      const dangerous = '<div>Hello <script>alert("xss")</script><style>body{color:red}</style>World</div>';
      assert.strictEqual(stripHtml(dangerous), 'Hello World');
    });
  });

  describe('normalizeDate', () => {
    it('converts unix epoch seconds to ISO string', () => {
      const epochSec = 1700000000;
      const iso = normalizeDate(epochSec);
      assert.strictEqual(iso, new Date(epochSec * 1000).toISOString());
    });

    it('converts unix epoch milliseconds to ISO string', () => {
      const epochMs = 1700000000000;
      const iso = normalizeDate(epochMs);
      assert.strictEqual(iso, new Date(epochMs).toISOString());
    });

    it('handles ISO date strings and fallback for invalid dates', () => {
      const validIso = '2026-05-15T12:00:00.000Z';
      assert.strictEqual(normalizeDate(validIso), validIso);

      const invalid = normalizeDate('invalid-date-string');
      assert.ok(!isNaN(new Date(invalid).getTime()));
    });
  });

  describe('normalizeLocation', () => {
    it('detects remote and Indian eligibility correctly', () => {
      const res1 = normalizeLocation('Bengaluru, India');
      assert.strictEqual(res1.isIndiaEligible, true);
      assert.strictEqual(res1.isRemote, false);

      const res2 = normalizeLocation('Remote, Anywhere in the World');
      assert.strictEqual(res2.isRemote, true);
      assert.strictEqual(res2.isIndiaEligible, true);

      const res3 = normalizeLocation('Berlin, Germany');
      assert.strictEqual(res3.isRemote, false);
      assert.strictEqual(res3.isIndiaEligible, false);
    });

    it('does not infer geographic eligibility or workplace type from incomplete locations', () => {
      const genericRemote = normalizeLocation('Remote');
      assert.strictEqual(genericRemote.isRemote, true);
      assert.strictEqual(genericRemote.isIndiaEligible, false);
      assert.strictEqual(genericRemote.workplaceType, 'remote');

      const hybrid = normalizeLocation('Pune, India (Hybrid)');
      assert.strictEqual(hybrid.isRemote, false);
      assert.strictEqual(hybrid.isIndiaEligible, true);
      assert.strictEqual(hybrid.workplaceType, 'hybrid');

      const unknown = normalizeLocation('');
      assert.strictEqual(unknown.location, 'Location not provided');
      assert.strictEqual(unknown.isRemote, false);
      assert.strictEqual(unknown.isIndiaEligible, false);
      assert.strictEqual(unknown.workplaceType, 'unknown');
    });
  });

  describe('normalizeEmploymentType & normalizeSeniority', () => {
    it('normalizes employment types correctly', () => {
      assert.strictEqual(normalizeEmploymentType('Full-Time (Permanent)'), 'Full Time');
      assert.strictEqual(normalizeEmploymentType(['Full-Time']), 'Full Time');
      assert.strictEqual(normalizeEmploymentType(['Part-Time', 'Contract']), 'Part Time');
      assert.strictEqual(normalizeEmploymentType('Contractor / 6 months'), 'Contract');
      assert.strictEqual(normalizeEmploymentType('Part-Time 20h'), 'Part Time');
      assert.strictEqual(normalizeEmploymentType('Internship 2026'), 'Internship');
    });

    it('classifies seniority correctly', () => {
      assert.strictEqual(normalizeSeniority('Principal Software Engineer'), 'Lead');
      assert.strictEqual(normalizeSeniority('Senior Frontend Architect'), 'Lead');
      assert.strictEqual(normalizeSeniority('Sr. React Developer'), 'Senior');
      assert.strictEqual(normalizeSeniority('Junior Web Developer'), 'Entry');
      assert.strictEqual(normalizeSeniority('Software Engineer'), 'Mid');
    });
  });
});
