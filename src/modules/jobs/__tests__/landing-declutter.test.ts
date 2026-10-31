import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Landing Screen De-clutter & Premium Redesign Architecture', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
  const cssPath = path.resolve(process.cwd(), 'src/app/globals.css');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('implements streamlined hero trust seal strip replacing loose chunky pills', () => {
    assert.ok(
      pageContent.includes('className="hero-trust-seal-strip"'),
      'page.tsx must use hero-trust-seal-strip'
    );
    assert.ok(
      cssContent.includes('.hero-trust-seal-strip {'),
      'globals.css must define .hero-trust-seal-strip'
    );
    assert.ok(
      pageContent.includes('className="hero-trust-item"'),
      'page.tsx must define hero-trust-item'
    );
    assert.ok(
      pageContent.includes('className="hero-trust-divider"'),
      'page.tsx must define hero-trust-divider'
    );
  });

  it('implements Filters drawer toggle with active count badge in search inputs row', () => {
    assert.ok(
      pageContent.includes('search-filters-toggle-btn'),
      'page.tsx must define search-filters-toggle-btn'
    );
    assert.ok(
      cssContent.includes('.search-filters-toggle-btn {'),
      'globals.css must style search-filters-toggle-btn'
    );
    assert.ok(
      pageContent.includes('search-filters-badge'),
      'page.tsx must render search-filters-badge when active filters exist'
    );
    assert.ok(
      cssContent.includes('.search-filters-badge {'),
      'globals.css must define search-filters-badge'
    );
  });

  it('wraps 6 bulky refinement dropdowns in an animated collapsible drawer', () => {
    assert.ok(
      pageContent.includes('className="search-refinements-drawer"'),
      'page.tsx must wrap refinements in search-refinements-drawer'
    );
    assert.ok(
      cssContent.includes('.search-refinements-drawer {'),
      'globals.css must define search-refinements-drawer'
    );
    assert.ok(
      pageContent.includes('showFiltersDrawer || activeRefinementsCount > 0'),
      'Refinements drawer must expand when toggled or when active filters exist'
    );
  });

  it('transforms 16-industry cloud into a sleek horizontal category rail with chevron navigation', () => {
    assert.ok(
      pageContent.includes('className="industry-showcase-wrapper"'),
      'page.tsx must define industry-showcase-wrapper'
    );
    assert.ok(
      pageContent.includes('industry-rail-nav-btn industry-rail-nav-btn-left'),
      'page.tsx must provide left navigation chevron button'
    );
    assert.ok(
      pageContent.includes('industry-rail-nav-btn industry-rail-nav-btn-right'),
      'page.tsx must provide right navigation chevron button'
    );
    assert.ok(
      pageContent.includes('className={`industry-rail-pill'),
      'page.tsx must style rail items with industry-rail-pill'
    );
    assert.ok(
      cssContent.includes('.industry-rail-pill {'),
      'globals.css must define .industry-rail-pill'
    );
    assert.ok(
      cssContent.includes('.industry-showcase-pills {') && cssContent.includes('flex-wrap: nowrap;'),
      'globals.css must prevent multi-row wrapping on industry rail'
    );
  });

  it('styles popular search pills with streamlined single-row trending format', () => {
    assert.ok(
      pageContent.includes('className={`quick-pill-btn'),
      'page.tsx must use quick-pill-btn class'
    );
    assert.ok(
      cssContent.includes('.quick-pill-btn {'),
      'globals.css must define .quick-pill-btn'
    );
  });

  it('removes redundant curated-tracks-quick-rail from live-feed-view-panel to bring job cards above the fold', () => {
    assert.ok(
      !pageContent.includes('className="curated-tracks-quick-rail"'),
      'page.tsx must NOT render curated-tracks-quick-rail inside live-feed-view-panel'
    );
  });

  it('eliminates duplicate roles-matched-pill from search console active tags while preserving it in results toolbar', () => {
    const matchedOccurrences = (pageContent.match(/className="roles-matched-pill"/g) || []).length;
    assert.strictEqual(
      matchedOccurrences,
      1,
      'roles-matched-pill must be rendered once authoritatively in results toolbar, eliminating duplicate clutter in search console'
    );
  });

  it('implements translucent frosted glass section behind fixed header with blur backdrop filter', () => {
    assert.ok(
      pageContent.includes('className="site-header-backdrop"'),
      'page.tsx must render site-header-backdrop'
    );
    assert.ok(
      cssContent.includes('.site-header-backdrop {'),
      'globals.css must define .site-header-backdrop'
    );
    assert.ok(
      cssContent.includes('backdrop-filter: blur(') && cssContent.includes('-webkit-backdrop-filter: blur('),
      'site-header-backdrop must apply backdrop-filter blur'
    );
    assert.ok(
      cssContent.includes('mask-image: linear-gradient('),
      'site-header-backdrop must apply gradient mask for seamless blur transition'
    );
    assert.ok(
      cssContent.includes('.site-header.is-stuck,\n.site-header-wrapper.is-stuck .site-header {') &&
      cssContent.includes('backdrop-filter: blur(28px) saturate(200%);'),
      'site-header.is-stuck must maintain rich translucent blur effect when scrolling'
    );
  });

  it('implements contextual background themes, reduced title font, and rigid horizontal action button alignment in JobCard', () => {
    const cardJsxPath = path.resolve(process.cwd(), 'src/app/components/JobCard.tsx');
    const cardCssPath = path.resolve(process.cwd(), 'src/app/components/JobCard.module.css');
    const cardJsxContent = fs.readFileSync(cardJsxPath, 'utf8');
    const cardCssContent = fs.readFileSync(cardCssPath, 'utf8');

    // 1. Contextual Card Theme Backgrounds
    const expectedPalettes = [
      'indigo', 'cyan', 'purple', 'rose', 'emerald', 'amber',
      'sky', 'teal', 'crimson', 'gold', 'lime', 'india'
    ];
    for (const pal of expectedPalettes) {
      assert.ok(
        cardJsxContent.includes(`${pal}: styles.cardTheme`),
        `JobCard.tsx must map palette "${pal}" to cardTheme class`
      );
      const className = `.cardTheme${pal.charAt(0).toUpperCase() + pal.slice(1)}`;
      assert.ok(
        cardCssContent.includes(className),
        `JobCard.module.css must define contextual theme class ${className}`
      );
    }
    assert.ok(
      cardJsxContent.includes('CARD_THEME_CLASSES[roleCategory.palette]'),
      'JobCard.tsx must apply contextual card theme class to motion card container'
    );

    // 2. Reduced Title Font Size & Line Clamp
    assert.ok(
      cardCssContent.includes('font-size: 0.96rem;') || cardCssContent.includes('font-size: 1.05rem;'),
      'JobCard.module.css must reduce title font size'
    );
    assert.ok(
      cardCssContent.includes('-webkit-line-clamp: 2;') && cardCssContent.includes('overflow: hidden;'),
      'JobCard.module.css must clamp title to 2 lines to prevent layout blowout'
    );
    assert.ok(
      cardJsxContent.includes('className={styles.title} title={job.title}'),
      'JobCard.tsx must render title tooltip'
    );

    // 3. Pixel-Perfect Horizontal Action Strip Alignment
    assert.ok(
      cardJsxContent.includes('className={styles.actionsBtnGroup}'),
      'JobCard.tsx must wrap action buttons in actionsBtnGroup container'
    );
    assert.ok(
      cardCssContent.includes('.actionsBtnGroup {') && cardCssContent.includes('margin-left: auto;'),
      'JobCard.module.css must anchor actionsBtnGroup to the right with margin-left: auto'
    );
    assert.ok(
      cardCssContent.includes('.sourceBadge {') &&
      cardCssContent.includes('max-width: 145px;') &&
      cardCssContent.includes('height: 38px;'),
      'JobCard.module.css must constrain sourceBadge max-width and fix height to 38px'
    );
    assert.ok(
      cardCssContent.includes('.sourceText {') && cardCssContent.includes('text-overflow: ellipsis;'),
      'JobCard.module.css must truncate long source names cleanly'
    );
    assert.ok(
      cardCssContent.includes('.applyBtn {') &&
      cardCssContent.includes('height: 38px;') &&
      cardCssContent.includes('min-width: 96px;'),
      'JobCard.module.css must give applyBtn exact matching 38px height and min-width: 96px'
    );

    // 4. Tag Deduplication
    assert.ok(
      cardJsxContent.includes('const filteredTags = useMemo('),
      'JobCard.tsx must compute filteredTags memo'
    );
    assert.ok(
      cardJsxContent.includes("tagLower === 'remote'"),
      'JobCard.tsx must filter duplicate workplace tags'
    );
  });

  it('positions FRESH label diagonally on top-left corner of JobCard with highlighting badge colors', () => {
    const cardJsxPath = path.resolve(process.cwd(), 'src/app/components/JobCard.tsx');
    const cardCssPath = path.resolve(process.cwd(), 'src/app/components/JobCard.module.css');
    const cardJsxContent = fs.readFileSync(cardJsxPath, 'utf8');
    const cardCssContent = fs.readFileSync(cardCssPath, 'utf8');

    // Diagonal corner ribbon wrapper and badge in JSX
    assert.ok(
      cardJsxContent.includes('styles.diagonalRibbonWrapper'),
      'JobCard.tsx must render diagonalRibbonWrapper for fresh roles'
    );
    assert.ok(
      cardJsxContent.includes('styles.diagonalRibbon'),
      'JobCard.tsx must render diagonalRibbon badge'
    );
    assert.ok(
      cardJsxContent.includes('styles.domainPillFreshIndent'),
      'JobCard.tsx must apply domainPillFreshIndent when isFresh is true to prevent overlap'
    );

    // CSS geometry: -45deg diagonal rotation on top-left corner
    assert.ok(
      cardCssContent.includes('.diagonalRibbonWrapper {') &&
      cardCssContent.includes('border-top-left-radius: 16px;'),
      'JobCard.module.css must position diagonalRibbonWrapper at top-left with rounded corner clipping'
    );
    assert.ok(
      cardCssContent.includes('.diagonalRibbon {') &&
      cardCssContent.includes('transform: rotate(-45deg);'),
      'JobCard.module.css must rotate diagonal ribbon at -45 degrees'
    );

    // Highlighting badge-type colors
    assert.ok(
      cardCssContent.includes('background: linear-gradient(135deg,') &&
      cardCssContent.includes('box-shadow: 0 2px 10px rgba('),
      'JobCard.module.css must use highlighting gradient and luminous shadow on ribbon'
    );
    assert.ok(
      cardCssContent.includes('.domainPillFreshIndent {') &&
      cardCssContent.includes('margin-left:'),
      'JobCard.module.css must provide margin-left on domain pill to avoid overlap with diagonal badge'
    );
  });

  it('guarantees zero visible outline or border ring on card area when clicking pills or buttons', () => {
    const cardCssPath = path.resolve(process.cwd(), 'src/app/components/JobCard.module.css');
    const cardCssContent = fs.readFileSync(cardCssPath, 'utf8');

    // 1. JobCard outline suppression
    assert.ok(
      cardCssContent.includes('.card {') && cardCssContent.includes('outline: none !important;'),
      'JobCard.module.css must enforce outline: none !important on .card'
    );
    assert.ok(
      cardCssContent.includes('.card:focus') && cardCssContent.includes('.card:focus-within'),
      'JobCard.module.css must suppress focus and focus-within outline on .card'
    );

    // 2. Card interactive elements click outline suppression
    assert.ok(
      cardCssContent.includes('.iconBtn:focus') && cardCssContent.includes('.applyBtn:focus'),
      'JobCard.module.css must suppress outline on button focus'
    );

    // 3. Card Area container border/box-shadow ring elimination in globals.css
    assert.ok(
      cssContent.includes('.search-results-section.results-focused-glow') &&
      cssContent.includes('box-shadow: none !important;'),
      'globals.css must ensure results-focused-glow does not apply any box-shadow or border ring'
    );
    assert.ok(
      cssContent.includes('.tab-panel-focused-glow') &&
      cssContent.includes('box-shadow: none !important;'),
      'globals.css must ensure tab-panel-focused-glow does not apply any box-shadow or border ring'
    );
    assert.ok(
      cssContent.includes('.live-feed-view-panel:focus') &&
      cssContent.includes('outline: none !important;'),
      'globals.css must ensure live-feed-view-panel focus outline is strictly disabled'
    );
  });

  it('guarantees high-contrast visibility for filter buttons and pills in light mode', () => {
    // 1. Filters toggle button active & inactive light theme overrides
    assert.ok(
      cssContent.includes(':root[data-theme="light"] .search-filters-toggle-btn.is-active') &&
      cssContent.includes('color: #1e1b4b !important;'),
      'globals.css must provide high-contrast deep indigo text for active filters button in light mode'
    );
    assert.ok(
      cssContent.includes(':root[data-theme="light"] .search-filters-toggle-btn.is-active svg') &&
      cssContent.includes('color: #4338ca !important;'),
      'globals.css must provide high-contrast deep indigo icon for active filters button in light mode'
    );
    assert.ok(
      cssContent.includes(':root[data-theme="light"] .search-filters-badge'),
      'globals.css must define search-filters-badge override for light mode'
    );

    // 2. Industry rail pills light theme visibility
    assert.ok(
      cssContent.includes(':root[data-theme="light"] .industry-rail-pill.is-active') &&
      cssContent.includes('color: #1e1b4b !important;'),
      'globals.css must ensure active industry pill has high-contrast text in light mode'
    );

    // 3. Quick search pills light theme visibility
    assert.ok(
      cssContent.includes(':root[data-theme="light"] .quick-pill-btn.is-active') &&
      cssContent.includes('color: #1e1b4b !important;'),
      'globals.css must ensure active quick pill has high-contrast text in light mode'
    );
  });
});

