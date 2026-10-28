import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateElapsedProgress,
  calculateCounterStep,
} from '../hooks/useElapsedJobCounter';

describe('JobNexus Elapsed Roles Counter Suite', () => {
  const VIEWPORT_HEIGHT = 800;
  const DOC_HEIGHT = 4000;

  describe('calculateElapsedProgress Unit Tests', () => {
    it('returns isScrollingCards=false when totalJobs is 0 or negative', () => {
      const result = calculateElapsedProgress(
        { top: 200, bottom: 1200, height: 1000 },
        [220, 400, 600],
        0,
        VIEWPORT_HEIGHT,
        500,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, false);
      assert.strictEqual(result.rawElapsedCount, 0);
      assert.strictEqual(result.progressPercent, 0);
      assert.strictEqual(result.isAllViewed, false);
    });

    it('returns isScrollingCards=false when containerRect is null', () => {
      const result = calculateElapsedProgress(
        null,
        [220, 400],
        20,
        VIEWPORT_HEIGHT,
        500,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, false);
      assert.strictEqual(result.rawElapsedCount, 0);
      assert.strictEqual(result.progressPercent, 0);
    });

    it('returns isScrollingCards=false when user is above the grid (in hero or search console)', () => {
      // readingLine = 800 * 0.65 = 520px
      // containerRect.top is 650px (below readingLine => user has not scrolled down to the cards)
      const result = calculateElapsedProgress(
        { top: 650, bottom: 2500, height: 1850 },
        [660, 800, 950],
        30,
        VIEWPORT_HEIGHT,
        100,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, false);
      assert.strictEqual(result.rawElapsedCount, 0);
      assert.strictEqual(result.progressPercent, 0);
      assert.strictEqual(result.isAllViewed, false);
    });

    it('detects when cards enter the reading area and counts elapsed sequentially', () => {
      // readingLine = 520px
      // Cards at 200px, 350px, 500px, 700px, 900px
      // Cards 1, 2, 3 have top <= 520px. Card 4 is at 700px > 520px.
      const cardTops = [200, 350, 500, 700, 900];
      const result = calculateElapsedProgress(
        { top: 180, bottom: 1500, height: 1320 },
        cardTops,
        10,
        VIEWPORT_HEIGHT,
        600,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 3);
      assert.strictEqual(result.progressPercent, 30);
      assert.strictEqual(result.isAllViewed, false);
    });

    it('accurately counts multi-row cards on desktop layout', () => {
      // 3 columns:
      // Row 1 (cards 1, 2, 3) at top 100
      // Row 2 (cards 4, 5, 6) at top 320
      // Row 3 (cards 7, 8, 9) at top 510 (all <= readingLine 520)
      // Row 4 (cards 10, 11, 12) at top 750 (> 520)
      const cardTops = [100, 100, 100, 320, 320, 320, 510, 510, 510, 750, 750, 750];
      const result = calculateElapsedProgress(
        { top: 80, bottom: 2000, height: 1920 },
        cardTops,
        24,
        VIEWPORT_HEIGHT,
        900,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 9);
      assert.strictEqual(result.progressPercent, (9 / 24) * 100);
      assert.strictEqual(result.isAllViewed, false);
    });

    it('accurately handles mobile single-column step-by-step scrolling', () => {
      // Mobile screen: viewport 667px, readingLine = 667 * 0.65 = 433.5px
      const cardTops = [50, 260, 420, 610, 800];
      const mobileViewport = 667;
      const result = calculateElapsedProgress(
        { top: 40, bottom: 1200, height: 1160 },
        cardTops,
        5,
        mobileViewport,
        450,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 3);
      assert.strictEqual(result.progressPercent, 60);
      assert.strictEqual(result.isAllViewed, false);
    });

    it('marks all viewed when user reaches document bottom', () => {
      const cardTops = [100, 300, 500];
      // scrollY = DOC_HEIGHT - VIEWPORT_HEIGHT = 4000 - 800 = 3200
      const result = calculateElapsedProgress(
        { top: -2400, bottom: 200, height: 2600 },
        cardTops,
        18,
        VIEWPORT_HEIGHT,
        3200,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 18);
      assert.strictEqual(result.progressPercent, 100);
      assert.strictEqual(result.isAllViewed, true);
    });

    it('marks all viewed when user scrolls past grid bottom', () => {
      const cardTops = [-800, -500, -200];
      // container bottom < 60
      const result = calculateElapsedProgress(
        { top: -2000, bottom: 30, height: 2030 },
        cardTops,
        15,
        VIEWPORT_HEIGHT,
        2500,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 15);
      assert.strictEqual(result.progressPercent, 100);
      assert.strictEqual(result.isAllViewed, true);
    });

    it('estimates elapsed count from container scroll ratio when cardTops array is empty', () => {
      // readingLine = 520. container top = 20. height = 1000.
      // scrolledPastTop = 500. scrollRatio = 0.5.
      // totalJobs = 20 -> maxElapsed = ceil(0.5 * 20) = 10
      const result = calculateElapsedProgress(
        { top: 20, bottom: 1020, height: 1000 },
        [],
        20,
        VIEWPORT_HEIGHT,
        600,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 10);
      assert.strictEqual(result.progressPercent, 50);
      assert.strictEqual(result.isAllViewed, false);
    });

    it('clamps minimum elapsed count to 1 when inside the grid but no cards have passed threshold yet', () => {
      // container.top is 400 <= readingLine 520, but card 1 top is at 510 <= 520
      const cardTops = [510, 750, 900];
      const result = calculateElapsedProgress(
        { top: 400, bottom: 1600, height: 1200 },
        cardTops,
        10,
        VIEWPORT_HEIGHT,
        300,
        DOC_HEIGHT
      );
      assert.strictEqual(result.isScrollingCards, true);
      assert.strictEqual(result.rawElapsedCount, 1);
      assert.strictEqual(result.progressPercent, 10);
    });
  });

  describe('calculateCounterStep Unit Tests', () => {
    it('returns target directly when current equals target', () => {
      assert.strictEqual(calculateCounterStep(15, 15), 15);
      assert.strictEqual(calculateCounterStep(0, 0), 0);
    });

    it('increments step-by-step when current < target', () => {
      const step1 = calculateCounterStep(1, 2);
      assert.strictEqual(step1, 2);

      const stepLarge = calculateCounterStep(1, 25, 4);
      assert.strictEqual(stepLarge, 1 + Math.ceil(24 / 4)); // 1 + 6 = 7
      assert.ok(stepLarge > 1 && stepLarge <= 25);
    });

    it('decrements step-by-step when current > target', () => {
      const stepDown = calculateCounterStep(10, 5, 5);
      assert.strictEqual(stepDown, 10 - 1); // diff 5 / 5 = 1 => 9

      const stepLargeDown = calculateCounterStep(40, 10, 4);
      assert.strictEqual(stepLargeDown, 40 - Math.ceil(30 / 4)); // 40 - 8 = 32
      assert.ok(stepLargeDown < 40 && stepLargeDown >= 10);
    });

    it('never overshoots target on increment or decrement', () => {
      assert.strictEqual(calculateCounterStep(19, 20), 20);
      assert.strictEqual(calculateCounterStep(2, 1), 1);
    });
  });
});
