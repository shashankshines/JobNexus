import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Mobile & Standard Resolutions Responsive UI Validation', () => {
  const cssPath = path.resolve(__dirname, '../../../app/globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  const pagePath = path.resolve(__dirname, '../../../app/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');

  const landingPath = path.resolve(__dirname, '../../../app/components/LandingView.tsx');
  const landingContent = fs.readFileSync(landingPath, 'utf-8');

  describe('Breakpoint & Media Query Coverage in globals.css', () => {
    it('defines responsive media query for small mobile devices (<= 360px)', () => {
      assert.ok(cssContent.includes('@media (max-width: 360px)'), 'Should have <= 360px media query');
      assert.ok(cssContent.includes('padding: 0 10px !important;'), 'Should refine container padding on ultra-small screens');
    });

    it('defines responsive media query for compact headers (<= 400px)', () => {
      assert.ok(cssContent.includes('@media (max-width: 400px)'), 'Should have <= 400px media query');
      assert.ok(cssContent.includes('.site-header-badge'), 'Should target .site-header-badge');
      assert.ok(cssContent.includes('display: none !important;'), 'Should hide badge on <= 400px to prevent header crowd-out');
    });

    it('defines responsive media query for mobile platform metrics (<= 480px)', () => {
      assert.ok(cssContent.includes('@media (max-width: 480px)'), 'Should have <= 480px media query');
      assert.ok(cssContent.includes('.platform-metrics-grid'), 'Should target platform-metrics-grid on <= 480px');
    });

    it('defines responsive media query for mobile devices (<= 640px)', () => {
      assert.ok(cssContent.includes('@media (max-width: 640px)'), 'Should have <= 640px media query');
    });

    it('defines responsive media query for tablets and phablets (<= 720px / <= 900px)', () => {
      assert.ok(cssContent.includes('@media (max-width: 720px)'), 'Should have <= 720px media query');
      assert.ok(cssContent.includes('@media (max-width: 900px)'), 'Should have <= 900px media query');
    });
  });

  describe('Grid Overflow Elimination on Narrow Mobile Screens', () => {
    it('uses min(100%, 320px) in job-grid, discovery-domain-grid, and skeleton-job-grid', () => {
      assert.ok(cssContent.includes('minmax(min(100%, 320px), 1fr)'), 'Should use min(100%, 320px) to prevent 320px overflow on <= 360px devices');
    });

    it('switches grids to single column 1fr on mobile screens <= 640px', () => {
      const match = cssContent.includes('.job-grid,\n  .discovery-domain-grid,\n  .skeleton-job-grid');
      assert.ok(match, 'Should group grids together for mobile 1fr rule');
      assert.ok(cssContent.includes('grid-template-columns: 1fr !important;'), 'Should collapse grids to 1fr on mobile');
    });

    it('does NOT have hardcoded inline minmax(320px, 1fr) in page.tsx grids', () => {
      assert.ok(!pageContent.includes("gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'"), 'page.tsx must not hardcode 320px fixed columns');
    });

    it('does NOT have hardcoded inline minmax(320px, 1fr) in LandingView.tsx grids', () => {
      assert.ok(!landingContent.includes("gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'"), 'LandingView.tsx must not hardcode 320px fixed columns');
    });
  });

  describe('Search Console & Refinement Mobile Flow Architecture', () => {
    it('defines mobile stacking for search inputs in globals.css', () => {
      assert.ok(cssContent.includes('.search-inputs-row'), 'Should define search-inputs-row');
      assert.ok(cssContent.includes('flex-direction: column !important;'), 'Should stack search inputs vertically on mobile');
      assert.ok(cssContent.includes('width: 100% !important;'), 'Should expand inputs to 100% on mobile');
    });

    it('defines balanced 2x2 grid for refinement dropdowns on mobile', () => {
      assert.ok(cssContent.includes('.search-refinements-bar'), 'Should define search-refinements-bar');
      assert.ok(cssContent.includes('grid-template-columns: 1fr 1fr !important;'), 'Should arrange filter dropdowns in a neat 2x2 grid on mobile');
    });

    it('defines dropdown-popover-right to avoid right-edge clipping on mobile touch screens', () => {
      assert.ok(cssContent.includes('.dropdown-popover-right'), 'Should define dropdown-popover-right');
      assert.ok(cssContent.includes('right: 0 !important;'), 'Should anchor right-column popovers to the right edge');
    });

    it('applies dropdown-popover-right to Type and Level dropdowns in page.tsx', () => {
      assert.ok(pageContent.includes('dropdown-popover-right'), 'page.tsx should apply dropdown-popover-right class to right column filters');
    });

    it('bounds suggestion popover min-width to avoid narrow mobile viewport overflow', () => {
      assert.ok(pageContent.includes("minWidth: 'min(100%, 280px)'"), 'Query suggestions dropdown must be bounded');
      assert.ok(pageContent.includes("minWidth: 'min(100%, 300px)'"), 'Location suggestions dropdown must be bounded');
      assert.ok(pageContent.includes("maxWidth: 'calc(100vw - 32px)'"), 'Dropdowns must not exceed viewport width');
    });

    it('defines 2x2 balanced layout for workplace category selector on mobile', () => {
      assert.ok(cssContent.includes('.workplace-pills-bar'), 'Should define workplace-pills-bar');
      assert.ok(cssContent.includes('.workplace-pill-btn'), 'Should define workplace-pill-btn');
      assert.ok(pageContent.includes('className="workplace-pills-bar"'), 'page.tsx must use workplace-pills-bar');
      assert.ok(pageContent.includes('className="workplace-pill-btn"'), 'page.tsx must use workplace-pill-btn');
    });
  });

  describe('Horizontal Swipe & Touch Scroll Targets', () => {
    it('prevents flex shrinking of pill items during horizontal touch swipe on mobile', () => {
      assert.ok(cssContent.includes('.quick-pills-container > *'), 'Should style quick-pills children');
      assert.ok(cssContent.includes('flex-shrink: 0;'), 'Pills must have flex-shrink: 0 for smooth swipe scrolling');
    });

    it('provides responsive desktop and mobile text variants for roles matched pill', () => {
      assert.ok(pageContent.includes('className="desktop-only"'), 'Must have desktop-only variant');
      assert.ok(pageContent.includes('className="mobile-only"'), 'Must have mobile-only compact variant');
    });
  });
});
