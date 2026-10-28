import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PopularSearchesService } from '../services/popular-searches.service';
import { GET, POST } from '@/app/api/jobs/popular/route';
import { NextRequest } from 'next/server';

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

  it('increments search count, recalculates 30-day average, and updates trend dynamically', () => {
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
    assert.strictEqual(updatedReactPill.avgSearches, Math.round((initialCount + 30) / 30));
    assert.strictEqual(updatedReactPill.formattedAverage, `${Math.round((initialCount + 30) / 30)}/day`);
  });

  it('dynamically re-ranks pills when a lower-ranked search overtakes higher ones', () => {
    // Healthcare begins at 75/day (2250 total searches).
    // Let's add 2500 searches to Healthcare so it reaches ~158/day, overtaking Full Stack (140/day).
    for (let i = 0; i < 2500; i++) {
      PopularSearchesService.recordSearch('Healthcare Clinical Nurse');
    }

    const updatedPills = PopularSearchesService.getPopularPills(8);
    // Healthcare should now be #1
    assert.strictEqual(updatedPills[0].id, 'healthcare-nursing');
    assert.ok(updatedPills[0].avgSearches > 150);
    assert.strictEqual(updatedPills[0].trend, 'hot');
  });

  it('dynamically creates and ranks new rising query pills with domain-specific icons', () => {
    // Record searches for a new trending term: "Cybersecurity Architect"
    PopularSearchesService.recordSearch('Cybersecurity Architect', 'Remote');

    const pills = PopularSearchesService.getPopularPills(20);
    const newPill = pills.find((p) => p.query === 'Cybersecurity Architect');

    assert.ok(newPill, 'Should create new dynamic pill for trending search');
    assert.ok(newPill.label.includes('🔒') || newPill.label.includes('Cybersecurity Architect'));
    assert.strictEqual(newPill.trend, 'rising');
    assert.strictEqual(newPill.location, 'Remote');
    assert.ok(newPill.avgSearches > 0);
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
    assert.strictEqual(response.headers.get('Cache-Control'), 'public, s-maxage=30, stale-while-revalidate=60');
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
