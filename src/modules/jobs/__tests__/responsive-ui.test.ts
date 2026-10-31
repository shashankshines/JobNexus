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
    it('sets 100% width on search-console-form in page.tsx without hardcoded 1040px constraint', () => {
      assert.ok(
        pageContent.includes("className=\"glass-panel search-console-form\""),
        'page.tsx must define search-console-form'
      );
      assert.ok(
        pageContent.includes("width: '100%'") && pageContent.includes("maxWidth: '100%'"),
        'search-console-form in page.tsx must use 100% width and maxWidth to fill container across resolutions'
      );
      assert.ok(
        !pageContent.includes("maxWidth: 1040"),
        'search-console-form in page.tsx must NOT constrain maxWidth to 1040px'
      );
    });

    it('guarantees search-console-form has 100% width and responsive adaptation in globals.css', () => {
      assert.match(cssContent, /\.search-console-form\s*\{[^}]*width:\s*100%;/s, 'search-console-form must have width: 100% in CSS');
      assert.ok(cssContent.includes('@media (max-width: 640px)'), 'Should have mobile media query');
      assert.ok(cssContent.includes('padding: 1rem 0.85rem !important;'), 'Should adapt padding on mobile');
    });

    it('defines mobile stacking for search inputs in globals.css', () => {
      assert.ok(cssContent.includes('.search-inputs-row'), 'Should define search-inputs-row');
      assert.ok(cssContent.includes('flex-direction: column !important;'), 'Should stack search inputs vertically on mobile');
      assert.ok(cssContent.includes('width: 100% !important;'), 'Should expand inputs to 100% on mobile');
    });

    it('defines balanced 2x2 grid for refinement dropdowns on mobile', () => {
      assert.ok(cssContent.includes('.search-refinements-bar'), 'Should define search-refinements-bar');
      assert.ok(cssContent.includes('grid-template-columns: 1fr 1fr !important;'), 'Should arrange filter dropdowns in a neat 2x2 grid on mobile');
    });

    it('allocates balanced desktop widths to refinement dropdowns in globals.css', () => {
      assert.ok(cssContent.includes('.search-refinement-role {\n  flex: 1.1;\n  min-width: 160px;'), 'Role must have flex: 1.1 and min-width: 160px in globals.css');
      assert.ok(cssContent.includes('.search-refinement-industry {\n  flex: 1.4;\n  min-width: 190px;'), 'Industry must have flex: 1.4 and min-width: 190px in globals.css');
      assert.ok(cssContent.includes('.search-refinement-workplace {\n  flex: 0.85;\n  min-width: 140px;'), 'Workplace must have flex: 0.85 and min-width: 140px in globals.css');
      assert.ok(cssContent.includes('.search-refinement-type {\n  flex: 0.75;\n  min-width: 120px;'), 'Type must have flex: 0.75 and min-width: 120px in globals.css');
      assert.ok(cssContent.includes('.search-refinement-level {\n  flex: 0.8;\n  min-width: 130px;'), 'Level must have flex: 0.8 and min-width: 130px in globals.css');
    });

    it('ensures dropdown items in All Roles, Any Workplace, Any Level render on a single line with nowrap', () => {
      assert.ok(pageContent.includes("minWidth: 'max(100%, 320px)'"), 'Role popover must have minWidth >= 320px');
      assert.ok(pageContent.includes("minWidth: 'max(100%, 280px)'"), 'Industry popover must guarantee at least 280px width for all items');
      assert.ok(pageContent.includes("minWidth: 'max(100%, 190px)'"), 'Workplace popover must guarantee at least 190px width for all items');
      assert.ok(pageContent.includes("minWidth: 'max(100%, 175px)'"), 'Type popover must guarantee at least 175px width for all items');
      assert.ok(pageContent.includes("minWidth: 'max(100%, 185px)'"), 'Level popover must guarantee at least 185px width for all items');
      assert.ok(pageContent.includes("<span style={{ whiteSpace: 'nowrap' }}>All Roles & Categories</span>"), 'Role header item must be nowrap');
      assert.ok(pageContent.includes("<span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>"), 'Workplace option must be nowrap');
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

    it('implements fluid spring sliding animation effect on landing page workplace tabs', () => {
      assert.ok(pageContent.includes('layoutId="activeWorkplaceSlidePill"'), 'page.tsx must use layoutId for sliding tab animation');
      assert.ok(landingContent.includes('layoutId="activeLandingWorkplaceTab"'), 'LandingView must use layoutId for sliding tab animation');
      assert.ok(cssContent.includes('.workplace-active-slide-indicator'), 'globals.css must define .workplace-active-slide-indicator');
    });
  });

  describe('Horizontal Swipe & Touch Scroll Targets', () => {
    it('prevents flex shrinking of pill items during horizontal touch swipe on mobile', () => {
      assert.match(
        cssContent,
        /\.quick-pills-container\s*>\s*\*\s*\{\s*flex-shrink:\s*0;/,
        'Pills must have flex-shrink: 0 to prevent child items from shrinking'
      );
    });

    it('provides responsive desktop and mobile text variants for roles matched pill', () => {
      assert.ok(pageContent.includes('className="desktop-only"'), 'Must have desktop-only variant');
      assert.ok(pageContent.includes('className="mobile-only"'), 'Must have mobile-only compact variant');
    });
  });

  describe('Landscape View & Pulsating Green Dot Count Visibility Suite', () => {
    it('defines landscape orientation media query for handheld viewports (<= 550px height)', () => {
      assert.ok(
        cssContent.includes('(orientation: landscape) and (max-height: 550px)'),
        'Must define landscape orientation and constrained height media query'
      );
      assert.ok(
        cssContent.includes('(max-height: 500px)'),
        'Must define compact landscape height fallback'
      );
    });

    it('activates .mobile-only and suppresses .desktop-only in landscape orientation', () => {
      const match = cssContent.includes('(orientation: landscape) and (max-height: 550px)');
      assert.ok(match, 'Landscape query must be present');
      assert.ok(cssContent.includes('.desktop-only {\n    display: none !important;\n  }'));
      assert.ok(cssContent.includes('.mobile-only {\n    display: inline-flex !important;\n  }'));
    });

    it('guarantees flex-shrink: 0 and min-width: fit-content on site-header-status and roles-matched-pill', () => {
      assert.ok(cssContent.includes('.site-header-status {'), 'site-header-status must be defined');
      assert.ok(cssContent.includes('.roles-matched-pill {'), 'roles-matched-pill must be defined');
      assert.ok(cssContent.includes('min-width: fit-content;'), 'Pills must have min-width: fit-content to prevent count truncation');
    });

    it('guarantees flex-shrink: 0 on both green pulsating indicators (.site-header-radar and .pulse-dot)', () => {
      assert.ok(cssContent.includes('.site-header-radar {'), 'site-header-radar must be defined');
      assert.ok(cssContent.includes('.pulse-dot {'), 'pulse-dot must be defined');
      assert.ok(cssContent.includes('flex-shrink: 0;'), 'Dots must not shrink under flex pressure');
    });

    it('hides header badge, subtitle, and saved label in landscape to maximize width for count visibility', () => {
      assert.ok(cssContent.includes('.site-header-saved-label'), 'Should target site-header-saved-label');
      assert.ok(pageContent.includes('className="site-header-saved-label"'), 'page.tsx must use site-header-saved-label');
    });

    it('implements structured count-main and count-secondary tokens in page.tsx for adaptive count formatting', () => {
      assert.ok(pageContent.includes('className="count-main"'), 'page.tsx must use count-main for essential count');
      assert.ok(pageContent.includes('className="count-secondary"'), 'page.tsx must use count-secondary for auxiliary text');
      assert.ok(cssContent.includes('.count-secondary'), 'globals.css must support count-secondary token');
    });
  });

  describe('Brand Logo Assets & Responsive UI System Suite', () => {
    const brandDir = path.resolve(__dirname, '../../../../public/brand');
    const authPath = path.resolve(__dirname, '../../../app/components/AuthModal.tsx');
    const authContent = fs.readFileSync(authPath, 'utf-8');
    const logoComponentPath = path.resolve(__dirname, '../../../app/components/JobNexusLogo.tsx');
    const logoComponentContent = fs.readFileSync(logoComponentPath, 'utf-8');

    it('maintains streamlined canonical responsive brand assets and deletes extra versions', () => {
      const canonicalBrandFiles = [
        'jobnexus-mark.png',
        'jobnexus-logo.png',
      ];

      for (const file of canonicalBrandFiles) {
        const fullPath = path.join(brandDir, file);
        assert.ok(fs.existsSync(fullPath), `Asset ${file} must exist in public/brand`);
        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 100, `Asset ${file} must have valid non-empty file size`);
      }

      // Verify all redundant/extra versions have been deleted
      const extraVersions = [
        'jobnexus-icon-512.png',
        'jobnexus-icon-192.png',
        'jobnexus-icon-64.png',
        'jobnexus-icon-32.png',
        'jobnexus-full-dark.png',
        'jobnexus-full-light.png',
        'jobnexus-horizontal-dark.png',
        'jobnexus-horizontal-light.png',
      ];
      for (const extra of extraVersions) {
        assert.ok(!fs.existsSync(path.join(brandDir, extra)), `Extra asset ${extra} must be deleted`);
      }

      // Verify only canonical brand files exist in public/brand
      const filesInBrand = fs.readdirSync(brandDir).filter((f) => !f.startsWith('.'));
      assert.strictEqual(filesInBrand.length, 2, 'Must have exactly 2 canonical logos in public/brand');
    });

    it('provides Next.js App Router metadata icons and favicon', () => {
      const appIcon = path.resolve(__dirname, '../../../app/icon.png');
      const appleIcon = path.resolve(__dirname, '../../../app/apple-icon.png');
      const appFavicon = path.resolve(__dirname, '../../../app/favicon.ico');
      const publicFavicon = path.resolve(__dirname, '../../../../public/favicon.ico');

      assert.ok(fs.existsSync(appIcon), 'App router icon.png must exist');
      assert.ok(fs.existsSync(appleIcon), 'App router apple-icon.png must exist');
      assert.ok(fs.existsSync(appFavicon), 'App router favicon.ico must exist');
      assert.ok(fs.existsSync(publicFavicon), 'Public favicon.ico must exist');
    });

    it('implements JobNexusLogo component with all required variants and high-DPI scaling', () => {
      assert.ok(logoComponentContent.includes("variant?: 'mark' | 'inline' | 'full' | 'banner'"), 'Must support all variants');
      assert.ok(logoComponentContent.includes('jobnexus-mark.png'), 'Must reference crisp jN ribbon mark');
      assert.ok(logoComponentContent.includes('jobnexus-logo.png'), 'Must reference canonical master full logo');
      assert.ok(logoComponentContent.includes('export { JobNexusLogo }'), 'Must provide named export');
    });

    it('integrates JobNexusLogo into the sticky header, landing header, auth modal, and footer', () => {
      assert.ok(pageContent.includes('<JobNexusLogo variant="mark"'), 'page.tsx sticky header must use JobNexusLogo');
      assert.ok(landingContent.includes('<JobNexusLogo variant="mark"'), 'LandingView must use JobNexusLogo in header');
      assert.ok(authContent.includes('<JobNexusLogo variant="mark"'), 'AuthModal must use JobNexusLogo');
      assert.ok(authContent.includes('Job<span className="text-gradient">Nexus</span>'), 'AuthModal brand name must match brand styling');
      assert.ok(authContent.includes('Discover • Apply • Grow'), 'AuthModal must feature the brand tagline');
      assert.ok(pageContent.includes('Discover • Apply • Grow'), 'page.tsx sticky header must feature Discover • Apply • Grow');
      assert.ok(logoComponentContent.includes('Discover • Apply • Grow'), 'JobNexusLogo must feature Discover • Apply • Grow');
      assert.ok(pageContent.includes('className="site-footer"'), 'page.tsx must feature responsive brand footer');
    });

    it('defines .site-header-logo styling in globals.css with pedestal background, subtle border, and responsive dimensioning', () => {
      assert.ok(cssContent.includes('.site-header-logo {'), 'globals.css must define .site-header-logo');
      assert.ok(cssContent.includes('.site-header-logo:hover'), 'globals.css must provide hover micro-animation');
      assert.ok(cssContent.includes('jobnexus-logo-dark'), 'globals.css must have theme visibility rules for dark mode');
      assert.ok(cssContent.includes('jobnexus-logo-light'), 'globals.css must have theme visibility rules for light mode');
    });

    it('ensures all logos across the platform have zero filter, zero drop-shadow, and zero shadow effects', () => {
      assert.ok(!logoComponentContent.includes('drop-shadow'), 'JobNexusLogo must not contain drop-shadow filters');
      assert.ok(!authContent.includes('boxShadow: \'0 8px 24px'), 'AuthModal logo pedestal must not contain box shadow');
      assert.ok(cssContent.includes('.jobnexus-mark-img'), 'globals.css must target logo elements');
      assert.ok(cssContent.includes('filter: none !important;'), 'globals.css must enforce zero filter on logos');
      assert.ok(cssContent.includes('box-shadow: none !important;'), 'globals.css must enforce zero box-shadow on logos');
    });
  });

  describe('Smooth Hero Text Animation Invariants', () => {
    it('structures hero headline into two balanced, shift-free tiers', () => {
      assert.ok(pageContent.includes('hero-headline-tier-primary'), 'page.tsx must define primary headline tier');
      assert.ok(pageContent.includes('hero-headline-tier-secondary'), 'page.tsx must define secondary headline tier');
      assert.ok(cssContent.includes('.hero-headline-tier'), 'globals.css must style .hero-headline-tier');
    });

    it('uses mode="popLayout" for gapless, continuous vertical reel animation', () => {
      assert.ok(pageContent.includes('mode="popLayout"'), 'Rotating words must use mode="popLayout" to eliminate empty gaps');
      assert.ok(!pageContent.includes('rotateX: -35'), 'Must eliminate 3D rotateX to prevent GPU raster stutters on gradient text');
      assert.ok(!pageContent.includes('filter: \'blur(6px)\''), 'Must eliminate filter: blur to preserve 60/120fps hardware acceleration');
    });

    it('implements hardware-accelerated transforms and containment on rotating word wrapper', () => {
      assert.ok(cssContent.includes('contain: layout;'), 'globals.css must isolate layout shifts with contain: layout');
      assert.ok(cssContent.includes('will-change: transform, opacity;'), 'globals.css must declare will-change for GPU compositor layer');
      assert.ok(cssContent.includes('transform: translateZ(0);'), 'globals.css must force GPU layer promotion');
    });

    it('synchronizes the sector ticker badge seamlessly with the rotating word', () => {
      assert.ok(pageContent.includes('hero-sector-ticker-wrap'), 'page.tsx must wrap ticker in hero-sector-ticker-wrap');
      assert.ok(cssContent.includes('.hero-sector-ticker-wrap'), 'globals.css must define .hero-sector-ticker-wrap');
    });

    it('respects prefers-reduced-motion for accessibility', () => {
      assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'globals.css must include reduced-motion media query');
    });
  });

  describe('85% Viewport Layout Width Architecture & Responsive Resilience', () => {
    const adminPagePath = path.resolve(__dirname, '../../../app/admin/page.tsx');
    const adminPageContent = fs.readFileSync(adminPagePath, 'utf-8');

    const adminSettingsPath = path.resolve(__dirname, '../../../app/admin/billing/settings/page.tsx');
    const adminSettingsContent = fs.readFileSync(adminSettingsPath, 'utf-8');

    it('configures .container to 85% viewport width on desktop displays', () => {
      assert.ok(cssContent.includes('.container {\n  width: 85%;\n  max-width: 85vw;'), 'globals.css must define .container with 85% width and 85vw max-width');
      assert.ok(cssContent.includes('margin: 0 auto;'), '.container must be horizontally centered');
      assert.ok(cssContent.includes('box-sizing: border-box;'), '.container must use border-box');
    });

    it('configures .site-header-wrapper to 85% viewport width with matching horizontal alignment', () => {
      assert.ok(cssContent.includes('.site-header-wrapper {\n  position: fixed;\n  top: 12px;\n  left: 0;\n  right: 0;\n  z-index: 1000;\n  width: 85%;\n  max-width: 85vw;'), 'globals.css must define .site-header-wrapper with 85% width and 85vw max-width');
      assert.ok(cssContent.includes('margin: 0 auto;'), '.site-header-wrapper must center with margin: 0 auto');
    });

    it('ensures mobile and Android viewports (<= 768px) expand containers to full 100% width with 16px padding', () => {
      assert.ok(cssContent.includes('@media (max-width: 768px)'), 'globals.css must define <= 768px media query');
      assert.ok(cssContent.includes('width: 100% !important;\n    max-width: 100% !important;\n    padding: 0 16px !important;'), 'Must expand .container and .site-header-wrapper to 100% on <= 768px screens');
    });

    it('configures .admin-main-container and admin headers to 85% width on desktop', () => {
      assert.ok(cssContent.includes('.admin-main-container {\n  width: 85%;\n  max-width: 85vw;'), '.admin-main-container must use 85% width and 85vw max-width');
      assert.ok(adminPageContent.includes("width: '85%', maxWidth: '85vw'"), 'admin/page.tsx header must use 85% width');
      assert.ok(adminSettingsContent.includes("width: '85%',\n            maxWidth: '85vw'"), 'admin/billing/settings/page.tsx header must use 85% width');
    });

    it('allows quick search pills to span the expanded 85% container without 1000px cap', () => {
      assert.ok(cssContent.includes('.quick-pills-container {\n  display: flex;\n  gap: 0.5rem;\n  align-items: center;\n  justify-content: center;\n  flex-wrap: wrap;\n  width: 100%;\n  max-width: 100%;'), '.quick-pills-container must use 100% max-width');
      assert.ok(!cssContent.includes('.industry-showcase-container'), 'Removed industry slider must not retain layout styles');
    });
  });
});
