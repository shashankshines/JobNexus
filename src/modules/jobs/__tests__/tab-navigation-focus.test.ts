import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Tab Navigation and Direct Content Focus Invariants', () => {
  const pagePath = path.resolve(__dirname, '../../../app/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');

  const adminPath = path.resolve(__dirname, '../../../app/admin/page.tsx');
  const adminContent = fs.readFileSync(adminPath, 'utf-8');

  const authModalPath = path.resolve(__dirname, '../../../app/components/AuthModal.tsx');
  const authModalContent = fs.readFileSync(authModalPath, 'utf-8');

  const cssPath = path.resolve(__dirname, '../../../app/globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  describe('1. Discovery Mode Switcher Tabs in page.tsx', () => {
    it('declares WAI-ARIA tablist container for feed display mode switcher', () => {
      assert.ok(
        pageContent.includes('role="tablist"') && pageContent.includes('aria-label="Feed display mode"'),
        'results-mode-switcher should have role="tablist" and aria-label="Feed display mode"'
      );
    });

    it('declares Live Roles and Curated Tracks as accessible tabs with aria-controls', () => {
      assert.ok(
        pageContent.includes('id="tab-mode-feed"'),
        'Should define id="tab-mode-feed"'
      );
      assert.ok(
        pageContent.includes('aria-controls="panel-mode-feed"'),
        'Live Roles tab must control panel-mode-feed'
      );
      assert.ok(
        pageContent.includes('id="tab-mode-tracks"'),
        'Should define id="tab-mode-tracks"'
      );
      assert.ok(
        pageContent.includes('aria-controls="panel-mode-tracks"'),
        'Curated Tracks tab must control panel-mode-tracks'
      );
    });

    it('implements handleDiscoveryTabSelect transferring focus and smooth-scrolling to content below', () => {
      assert.ok(
        pageContent.includes('handleDiscoveryTabSelect'),
        'Should implement handleDiscoveryTabSelect'
      );
      assert.ok(
        pageContent.includes('targetEl.focus({ preventScroll: true })'),
        'Should call focus with preventScroll: true on target content panel'
      );
      assert.ok(
        pageContent.includes('window.scrollTo(') && pageContent.includes("behavior: 'smooth'"),
        'Should smooth-scroll to content panel top with sticky header offset'
      );
    });

    it('wraps Curated Tracks content in an accessible tabpanel with focus reference', () => {
      assert.ok(
        pageContent.includes('ref={tracksContentRef}'),
        'Tracks panel must have tracksContentRef'
      );
      assert.ok(
        pageContent.includes('id="panel-mode-tracks"'),
        'Tracks panel must have id="panel-mode-tracks"'
      );
      assert.ok(
        pageContent.includes('role="tabpanel"'),
        'Tracks panel must have role="tabpanel"'
      );
      assert.ok(
        pageContent.includes('aria-labelledby="tab-mode-tracks"'),
        'Tracks panel must reference tab-mode-tracks'
      );
      assert.ok(
        pageContent.includes('tabIndex={-1}'),
        'Tracks panel must have tabIndex={-1} for programmatic focus'
      );
    });

    it('wraps Live Roles feed content in an accessible tabpanel with focus reference', () => {
      assert.ok(
        pageContent.includes('ref={feedContentRef}'),
        'Live feed panel must have feedContentRef'
      );
      assert.ok(
        pageContent.includes('id="panel-mode-feed"'),
        'Live feed panel must have id="panel-mode-feed"'
      );
      assert.ok(
        pageContent.includes('aria-labelledby="tab-mode-feed"'),
        'Live feed panel must reference tab-mode-feed'
      );
    });

    it('provides keyboard navigation (ArrowLeft / ArrowRight) for mode tabs', () => {
      assert.ok(
        pageContent.includes("e.key === 'ArrowRight' || e.key === 'ArrowLeft'"),
        'Mode switcher should support horizontal arrow key navigation'
      );
    });

    it('displays active focus clue badge when content is in focus', () => {
      assert.ok(
        pageContent.includes('results-focus-clue-badge'),
        'Should display results-focus-clue-badge'
      );
      assert.ok(
        pageContent.includes('tabFocusBadge'),
        'Should display informative tabFocusBadge indicating active section'
      );
    });
  });

  describe('2. Admin Console 6-Tab Navigation & Direct Focus in admin/page.tsx', () => {
    it('declares WAI-ARIA tablist for admin navigation tabs', () => {
      assert.ok(
        adminContent.includes('role="tablist"') && adminContent.includes('aria-label="Admin Navigation Tabs"'),
        'Admin tab nav must declare role="tablist"'
      );
    });

    it('configures all 6 admin tabs with role="tab", aria-controls, and id', () => {
      assert.ok(
        adminContent.includes('role="tab"'),
        'Admin tabs must have role="tab"'
      );
      assert.ok(
        adminContent.includes('aria-controls="admin-tab-panel"'),
        'Admin tabs must declare aria-controls="admin-tab-panel"'
      );
      assert.ok(
        adminContent.includes('id={`admin-tab-${tab.id}`}'),
        'Admin tabs must declare unique id per tab'
      );
    });

    it('implements handleTabSelect transferring focus and smooth-scrolling to tabpanel below', () => {
      assert.ok(
        adminContent.includes('handleTabSelect'),
        'Admin page must implement handleTabSelect'
      );
      assert.ok(
        adminContent.includes('panel.focus({ preventScroll: true })'),
        'Must call focus on tabContentRef panel'
      );
      assert.ok(
        adminContent.includes('window.scrollTo('),
        'Must smooth scroll to tabpanel'
      );
    });

    it('syncs tab changes with URL query parameter for deep-linking', () => {
      assert.ok(
        adminContent.includes("url.searchParams.set('tab', tabId)"),
        'handleTabSelect must sync active tab to ?tab= query parameter'
      );
    });

    it('wraps all 6 tab contents inside a single accessible tabpanel container', () => {
      assert.ok(
        adminContent.includes('ref={tabContentRef}'),
        'Admin content must have tabContentRef'
      );
      assert.ok(
        adminContent.includes('id="admin-tab-panel"'),
        'Admin content must have id="admin-tab-panel"'
      );
      assert.ok(
        adminContent.includes('role="tabpanel"'),
        'Admin content must have role="tabpanel"'
      );
      assert.ok(
        adminContent.includes('tabIndex={-1}'),
        'Admin content must have tabIndex={-1}'
      );
      assert.ok(
        adminContent.includes('admin-tab-panel-focused'),
        'Admin content must conditionally receive admin-tab-panel-focused class'
      );
    });

    it('displays admin focus clue badge when tab content is focused', () => {
      assert.ok(
        adminContent.includes('admin-focus-clue-badge'),
        'Admin panel must render admin-focus-clue-badge upon tab selection'
      );
    });

    it('connects internal overview buttons to handleTabSelect for direct focus', () => {
      assert.ok(
        adminContent.includes("handleTabSelect('subscriptions')"),
        'View Expiring button must call handleTabSelect to focus subscriptions panel'
      );
      assert.ok(
        adminContent.includes("handleTabSelect('verifications')"),
        'Review Pending button must call handleTabSelect to focus verifications panel'
      );
    });
  });

  describe('3. AuthModal Tab Switching Focus in AuthModal.tsx', () => {
    it('automatically transfers focus to the first input in the switched tabpanel', () => {
      assert.ok(
        authModalContent.includes('handleTabSwitch'),
        'AuthModal must declare handleTabSwitch'
      );
      assert.ok(
        authModalContent.includes('#signin-email') && authModalContent.includes('#signup-name'),
        'handleTabSwitch must select and focus first input of the active form'
      );
    });
  });

  describe('4. Focus Styles & CSS Feedback in globals.css', () => {
    it('defines .tab-panel-focused-glow for content panels', () => {
      assert.ok(
        cssContent.includes('.tab-panel-focused-glow'),
        'globals.css must define .tab-panel-focused-glow'
      );
      assert.ok(
        cssContent.includes('rgba(99, 102, 241,'),
        'tab-panel-focused-glow must use signature primary/indigo accent glow'
      );
    });

    it('defines .admin-tab-content-panel and .admin-tab-panel-focused', () => {
      assert.ok(
        cssContent.includes('.admin-tab-content-panel'),
        'globals.css must define .admin-tab-content-panel'
      );
      assert.ok(
        cssContent.includes('.admin-tab-content-panel.admin-tab-panel-focused'),
        'globals.css must define focus glow for admin tab content panel'
      );
    });

    it('defines .admin-focus-clue-badge with pulse animation', () => {
      assert.ok(
        cssContent.includes('.admin-focus-clue-badge'),
        'globals.css must define .admin-focus-clue-badge'
      );
      assert.ok(
        cssContent.includes('pulseResultsClue'),
        'admin-focus-clue-badge must include pulseResultsClue animation'
      );
    });
  });
});

