import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  isPageReloadNavigation,
  buildCleanReloadUrl,
  clearStalePendingSearchIntentOnReload,
  SEARCH_URL_PARAM_KEYS,
  type SessionStorageLike,
} from '@/modules/jobs/presentation/search-reload-reset';

function createMemorySessionStorage(initial: Record<string, string> = {}): SessionStorageLike & {
  dump: () => Record<string, string>;
} {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    removeItem: (key: string) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map.entries()),
  };
}

describe('Page Refresh Clears All Searches and Filters', () => {
  describe('1. Reload Navigation Detection (isPageReloadNavigation)', () => {
    it('detects standard W3C PerformanceNavigationTiming reload (Cmd+R, F5, Reload button, pull-to-refresh)', () => {
      const win = {
        performance: {
          getEntriesByType: (type: string) => (type === 'navigation' ? [{ type: 'reload' }] : []),
        },
        history: { state: {} },
      };

      assert.strictEqual(isPageReloadNavigation(win), true);
    });

    it('detects legacy performance.navigation.type === 1 (TYPE_RELOAD) fallback', () => {
      const win = {
        performance: {
          getEntriesByType: () => [],
          navigation: { type: 1 },
        },
        history: { state: null },
      };

      assert.strictEqual(isPageReloadNavigation(win), true);
    });

    it('detects reload of an in-app pushed search entry carrying history.state.searchCriteria', () => {
      const win = {
        performance: {
          getEntriesByType: () => [{ type: 'navigate' }],
        },
        history: {
          state: {
            searchCriteria: {
              query: 'React Developer',
              location: 'Bengaluru',
              remote: 'remote',
            },
          },
        },
      };

      assert.strictEqual(isPageReloadNavigation(win), true);
    });

    it('returns false on a fresh initial navigation without prior search history state', () => {
      const win = {
        performance: {
          getEntriesByType: () => [{ type: 'navigate' }],
          navigation: { type: 0 },
        },
        history: { state: null },
      };

      assert.strictEqual(isPageReloadNavigation(win), false);
    });

    it('handles undefined window (SSR) and restricted performance APIs without throwing', () => {
      assert.strictEqual(isPageReloadNavigation(undefined), false);

      const restrictedWin = {
        performance: {
          getEntriesByType: () => {
            throw new Error('Restricted');
          },
        },
        history: { state: null },
      };
      assert.strictEqual(isPageReloadNavigation(restrictedWin), false);
    });
  });

  describe('2. Clean URL Construction on Reload (buildCleanReloadUrl)', () => {
    it('strips every search, filter, sort, and pagination parameter back to clean root path', () => {
      const dirtySearch =
        '?query=Staff+Engineer&role=frontend-engineer&company=Stripe&location=Bengaluru&type=full-time&level=senior&remote=remote&industry=technology&sort=date&page=2&pageSize=50&refresh=1';

      assert.strictEqual(buildCleanReloadUrl('/', dirtySearch), '/');
      assert.strictEqual(SEARCH_URL_PARAM_KEYS.length, 12);
    });

    it('preserves non-search OAuth callback parameters while stripping active search filters', () => {
      const mixedSearch = '?query=Python&remote=hybrid&auth_success=google';
      assert.strictEqual(buildCleanReloadUrl('/', mixedSearch), '/?auth_success=google');

      const errorSearch = '?industry=healthcare&location=Mumbai&auth_error=access_denied';
      assert.strictEqual(buildCleanReloadUrl('/', errorSearch), '/?auth_error=access_denied');
    });

    it('handles already-clean paths and queryless URLs idempotently', () => {
      assert.strictEqual(buildCleanReloadUrl('/', ''), '/');
      assert.strictEqual(buildCleanReloadUrl('', ''), '/');
    });
  });

  describe('3. Pending Search Intent Cleanup on Reload (clearStalePendingSearchIntentOnReload)', () => {
    it('clears search, pill, domain, and workplace intents on page reload', () => {
      for (const intentType of ['search', 'pill', 'domain', 'workplace']) {
        const storage = createMemorySessionStorage({
          jn_pending_intent: JSON.stringify({ type: intentType, query: 'Machine Learning' }),
        });

        assert.strictEqual(clearStalePendingSearchIntentOnReload(storage), true);
        assert.strictEqual(storage.getItem('jn_pending_intent'), null);
      }
    });

    it('preserves save-job and apply intents so user job actions are never lost', () => {
      for (const intentType of ['save-job', 'apply']) {
        const raw = JSON.stringify({ type: intentType, jobId: 'job_123', url: 'https://boards.greenhouse.io/x' });
        const storage = createMemorySessionStorage({ jn_pending_intent: raw });

        assert.strictEqual(clearStalePendingSearchIntentOnReload(storage), false);
        assert.strictEqual(storage.getItem('jn_pending_intent'), raw);
      }
    });

    it('safely discards malformed JSON in jn_pending_intent and tolerates null storage', () => {
      const corrupted = createMemorySessionStorage({ jn_pending_intent: '{bad-json' });
      assert.strictEqual(clearStalePendingSearchIntentOnReload(corrupted), true);
      assert.strictEqual(corrupted.getItem('jn_pending_intent'), null);
      assert.strictEqual(clearStalePendingSearchIntentOnReload(null), false);
    });
  });

  describe('4. Home Page Integration & Browser Form Auto-Restore Prevention', () => {
    it('wires reload reset into initial warmup and disables browser input auto-restoration', () => {
      const pagePath = path.join(process.cwd(), 'src/app/page.tsx');
      const source = fs.readFileSync(pagePath, 'utf8');

      assert.ok(source.includes('if (isPageReloadNavigation(window))'));
      assert.ok(source.includes('clearStalePendingSearchIntentOnReload(window.sessionStorage)'));
      assert.ok(source.includes('buildCleanReloadUrl(window.location.pathname, window.location.search)'));
      assert.ok(source.includes('window.history.replaceState({}, document.title, cleanUrl)'));
      assert.ok(source.includes('autoComplete="off"'));
    });
  });
});

