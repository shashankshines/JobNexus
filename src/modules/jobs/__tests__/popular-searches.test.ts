import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PopularSearchesService } from '../services/popular-searches.service';
import { GET, POST } from '@/app/api/jobs/popular/route';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

describe('JobNexus — Dynamic Popular Search Pills & Average Search Volume Suite', () => {
  beforeEach(() => {
    PopularSearchesService.resetToDefault();
  });

  it('initializes with baseline popular pills sorted by average searches descending', () => {
    const pills = PopularSearchesService.getPopularPills(8);

    assert.strictEqual(pills.length, 8);
    assert.strictEqual(pills[0].id, 'full-stack-developer');
    assert.strictEqual(pills[0].avgSearches, 140);
    assert.strictEqual(pills[0].formattedAverage, '140/day');
    assert.strictEqual(pills[0].trend, 'hot');

    assert.strictEqual(pills[1].id, 'react-developer');
    assert.strictEqual(pills[1].avgSearches, 125);
    assert.strictEqual(pills[1].formattedAverage, '125/day');

    // Verify descending order by avgSearches
    for (let i = 0; i < pills.length - 1; i++) {
      assert.ok(
        (pills[i].avgSearches || 0) >= (pills[i + 1].avgSearches || 0),
        `Pill at index ${i} (${pills[i].avgSearches}) should be >= pill at index ${i + 1} (${pills[i + 1].avgSearches})`
      );
    }
  });

  it('increments actual search volume and recalculates the rolling 30-day average', () => {
    const initialPills = PopularSearchesService.getPopularPills(10);
    const reactPill = initialPills.find((p) => p.id === 'react-developer');
    assert.ok(reactPill);
    const initialCount = reactPill.searchCount;

    // Simulate 30 searches for React Developer
    for (let i = 0; i < 30; i++) {
      PopularSearchesService.recordSearch('React Developer');
    }

    const updatedPills = PopularSearchesService.getPopularPills(10);
    const updatedReactPill = updatedPills.find((p) => p.id === 'react-developer');
    assert.ok(updatedReactPill);

    assert.strictEqual(updatedReactPill.searchCount, initialCount + 30);
    assert.strictEqual(updatedReactPill.avgSearches, 1);
    assert.strictEqual(updatedReactPill.formattedAverage, '1/day');
  });

  it('ranks pills by real recent searches rather than seeded historical totals', () => {
    for (let i = 0; i < 2500; i++) {
      PopularSearchesService.recordSearch('Healthcare Clinical Nurse');
    }

    const updatedPills = PopularSearchesService.getPopularPills(8);
    assert.strictEqual(updatedPills[0].id, 'healthcare-nursing');
    assert.strictEqual(updatedPills[0].searchCount, 2250 + 2500);
    assert.strictEqual(updatedPills[0].avgSearches, 2500 / 30);
    assert.strictEqual(updatedPills[0].trend, 'rising');
  });

  it('dynamically creates and ranks new rising query pills with domain-specific icons', () => {
    PopularSearchesService.recordSearch('Cybersecurity Architect');

    const pills = PopularSearchesService.getPopularPills(20);
    const newPill = pills.find((p) => p.query === 'Cybersecurity Architect');

    assert.ok(newPill, 'Should create new dynamic pill for trending search');
    assert.ok(newPill.label.includes('🔒') || newPill.label.includes('Cybersecurity Architect'));
    assert.strictEqual(newPill.trend, 'rising');
    assert.ok(!('location' in newPill), 'Popular role pills must not include location metadata');
    assert.strictEqual(newPill.searchCount, 1, 'New search topics must start with actual counts, not seeded volume');
    assert.strictEqual(newPill.avgSearches, 1 / 30);
  });

  it('keeps distinct role searches separate instead of merging partial query matches', () => {
    PopularSearchesService.recordSearch('Senior React Developer');
    PopularSearchesService.recordSearch('React Developer');

    const pills = PopularSearchesService.getPopularPills(20);
    const seniorRole = pills.find((pill) => pill.query === 'Senior React Developer');
    const baselineRole = pills.find((pill) => pill.query === 'React Developer');
    assert.ok(seniorRole);
    assert.ok(baselineRole);
    assert.strictEqual(seniorRole.searchCount, 1);
    assert.strictEqual(baselineRole.searchCount, 3751);
  });

  it('safely handles empty, noisy, or short search terms without polluting pills', () => {
    const beforeCount = PopularSearchesService.getPopularPills(20).length;

    PopularSearchesService.recordSearch('');
    PopularSearchesService.recordSearch('   ');
    PopularSearchesService.recordSearch('a');
    PopularSearchesService.recordSearch('###');

    const afterCount = PopularSearchesService.getPopularPills(20).length;
    assert.strictEqual(beforeCount, afterCount, 'Noisy searches should be ignored');
  });

  it('records only the role portion of mixed searches and ignores location-only searches', () => {
    PopularSearchesService.recordSearch('React Developer in Bengaluru');
    PopularSearchesService.recordSearch('Mumbai, Maharashtra');

    const pills = PopularSearchesService.getPopularPills(20);
    const reactPill = pills.find((pill) => pill.query === 'React Developer');

    assert.ok(reactPill);
    assert.strictEqual(reactPill.searchCount, 3751);
    assert.ok(!pills.some((pill) => /bengaluru|mumbai|maharashtra/i.test(pill.query)));
  });

  it('respects requested limits and returns metadata via getPopularSearchesResponse', () => {
    const response = PopularSearchesService.getPopularSearchesResponse(5);

    assert.strictEqual(response.pills.length, 5);
    assert.strictEqual(response.periodDays, 30);
    assert.ok(response.totalSearchesRecorded > 10000);
    assert.ok(response.lastUpdated);
  });

  it('GET /api/jobs/popular returns HTTP 200 with dynamic pills and cache headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/jobs/popular?limit=6');
    const response = await GET(request);

    assert.strictEqual(response.status, 200);
    const data = await response.json();

    assert.ok(Array.isArray(data.pills));
    assert.strictEqual(data.pills.length, 6);
    assert.strictEqual(data.periodDays, 30);
    assert.strictEqual(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  });

  it('POST /api/jobs/popular increments search and returns updated pills', async () => {
    const request = new NextRequest('http://localhost:3000/api/jobs/popular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Full Stack Developer', location: 'India' }),
    });

    const response = await POST(request);
    assert.strictEqual(response.status, 200);
    const data = await response.json();

    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.pills));
    assert.ok(data.pills.length > 0);
    assert.ok(data.lastUpdated);
    assert.strictEqual(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
    assert.ok(data.pills.some((pill: { query: string; searchCount: number; location?: string }) =>
      pill.query === 'Full Stack Developer' && pill.searchCount > 4200 && !pill.location
    ));
  });

  it('returns a newly searched topic immediately in the latest popular list', async () => {
    const request = new NextRequest('http://localhost:3000/api/jobs/popular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Realtime Data Platform Engineer', location: 'Toronto' }),
    });

    const response = await POST(request);
    const recorded = await response.json();
    assert.strictEqual(response.status, 200);
    assert.ok(recorded.pills.some((pill: { query: string }) => pill.query === 'Realtime Data Platform Engineer'));

    const latestResponse = await GET(new NextRequest('http://localhost:3000/api/jobs/popular?limit=10'));
    const latest = await latestResponse.json();
    const pill = latest.pills.find((item: { query: string }) => item.query === 'Realtime Data Platform Engineer');
    assert.ok(pill);
    assert.strictEqual(pill.searchCount, 1);
    assert.ok(!('location' in pill), 'API pills must not include location metadata');
  });

  it('records role queries only and refreshes the visible pill list', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    const recordRequest = pageContent.indexOf("fetch('/api/jobs/popular'");
    const cacheReturn = pageContent.indexOf('clientSearchCacheRef.current.get(cacheKey)');

    assert.ok(recordRequest >= 0 && recordRequest < cacheReturn, 'Search volume must be recorded before a cached result can return');
    assert.ok(pageContent.includes('const popularityQuery = searchCriteria.query || searchCriteria.role'), 'Only role/query terms must be recorded');
    assert.ok(pageContent.includes('if (options.recordPopularity && popularityQuery.trim().length >= 2)'), 'Only explicit submissions must count toward popularity');
    assert.ok(!pageContent.includes('searchCriteria.query || searchCriteria.role || searchCriteria.company'), 'Company and location-only searches must not be recorded');
    assert.ok(pageContent.includes("body: JSON.stringify({ query: popularityQuery })"), 'Location must not be sent to the popularity API');
    assert.ok(/executeSearch\(\{[\s\S]*?query,[\s\S]*?role: selectedRole,[\s\S]*?\}, \{ recordPopularity: true \}\)/.test(pageContent), 'Submitting the form must record its role query');
    assert.ok(pageContent.includes('applyPopularPills(data)'), 'The UI must apply authoritative server rankings after searches');
    assert.ok(pageContent.includes("fetch('/api/jobs/popular?limit=10', { cache: 'no-store' })"), 'The visible list must refresh from uncached server data');
    assert.ok(pageContent.includes('window.setInterval(() => void refreshPopularPills(), 15_000)'), 'The visible list must periodically pick up other recent searches');
    assert.ok(!pageContent.includes('avgSearches = (p.avgSearches || 50) + 1'), 'The browser must not invent popularity counts locally');
  });

  it('POST /api/jobs/popular returns 400 when query is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/jobs/popular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '  ' }),
    });

    const response = await POST(request);
    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.error, 'Search query is required');
  });
});
