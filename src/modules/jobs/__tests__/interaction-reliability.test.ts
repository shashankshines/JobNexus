import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Navigation and interaction reliability safeguards', () => {
  it('resumes authenticated apply intents from one owner only', () => {
    const authContext = source('src/app/context/AuthContext.tsx');
    const homePage = source('src/app/page.tsx');

    assert.ok(!authContext.includes("action.type === 'apply'"));
    assert.ok(homePage.includes("intent.type === 'apply'"));
    assert.ok(authContext.includes("setPendingIntent({ type: 'apply', url: savedIntent.url })"));
    assert.ok(homePage.includes('const intent = consumePendingIntent();\n      if (intent) {'));
  });

  it('ignores stale session and account-scoped data responses', () => {
    const authContext = source('src/app/context/AuthContext.tsx');

    assert.ok(authContext.includes('expectedEpoch !== authEpochRef.current'));
    assert.ok(authContext.includes('expectedEpoch === authEpochRef.current && Array.isArray(data.savedJobs)'));
    assert.ok(authContext.includes('requestEpoch === authEpochRef.current && data.savedJobs'));
  });

  it('prevents duplicate save-job mutations while the action is pending', () => {
    const jobCard = source('src/app/components/JobCard.tsx');

    assert.ok(jobCard.includes('if (isBookmarkPending) return;'));
    assert.ok(jobCard.includes('disabled={isBookmarkPending}'));
    assert.ok(jobCard.includes('aria-busy={isBookmarkPending}'));
  });

  it('keeps submit and refinement controls above autocomplete overlays', () => {
    const styles = source('src/app/globals.css');

    assert.match(styles, /\.search-submit-btn\s*\{[^}]*z-index:\s*300;/);
    assert.match(styles, /\.search-refinements-bar\s*\{[^}]*z-index:\s*300;/);
  });

  it('synchronizes applied search state with URLs and paginates beyond the legacy cap', () => {
    const homePage = source('src/app/page.tsx');
    const apiRoute = source('src/app/api/jobs/route.ts');
    const searchService = source('src/modules/jobs/services/job-search.service.ts');

    assert.ok(homePage.includes('window.history.pushState({ ...window.history.state, searchCriteria }'));
    assert.ok(homePage.includes("window.addEventListener('popstate', restoreSearchFromUrl)"));
    assert.ok(homePage.includes('params.set(\'pageSize\', String(SEARCH_PAGE_SIZE))'));
    assert.ok(homePage.includes('const loadNextSearchPage = useCallback'));
    assert.ok(homePage.includes('data.totalAvailable !== totalAvailableJobs'));
    assert.ok(apiRoute.includes('totalAvailable: result.totalAvailable'));
    assert.ok(apiRoute.includes('hasMore: result.hasMore'));
    assert.ok(searchService.includes('const hasMore = offset + limitedJobs.length < rankedJobs.length'));
  });

  it('keeps provider failures out of the public UI and exposes a retry for total search failure', () => {
    const homePage = source('src/app/page.tsx');

    assert.ok(!homePage.includes('Some job sources unavailable'));
    assert.ok(!homePage.includes('providerDetailsOpen'));
    assert.ok(!homePage.includes('Retry unavailable providers'));
    assert.ok(!homePage.includes('available provider data'));
    assert.ok(homePage.includes('data.providerCoverage.succeeded === 0'));
    assert.ok(homePage.includes('Search temporarily unavailable'));
    assert.ok(homePage.includes('Retry Search'));
    assert.ok(homePage.includes('forceRefresh: true'));
    assert.ok(homePage.includes('failedSearch.criteria'));
    assert.ok(homePage.includes('No matching jobs found'));
    assert.ok(homePage.includes('Clear All Filters'));
    assert.ok(homePage.includes('Explore Remote Roles'));
    assert.ok(homePage.includes('Return to Discovery'));
    assert.ok(homePage.indexOf(') : searchError ?') < homePage.indexOf(') : displayedJobs.length === 0 ?'));
    assert.ok(!homePage.includes('Global inventory is partial because one or more configured sources failed.'));
  });

  it('uses the same order-independent cache identity for first and subsequent search pages', () => {
    const homePage = source('src/app/page.tsx');

    assert.ok(homePage.includes('function getClientSearchCacheKey(params: URLSearchParams, isAuthenticated: boolean)'));
    assert.ok(homePage.includes('Array.from(params.entries()).sort('));
    assert.ok(homePage.includes('const cacheKey = getClientSearchCacheKey(params, isAuthenticated)'));
    assert.ok(homePage.includes('const cacheKey = getClientSearchCacheKey(firstPageParams, isAuthenticated)'));
    assert.ok(homePage.includes("params.set('sort', appliedSortBy)"));
  });
});
