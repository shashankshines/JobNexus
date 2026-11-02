/**
 * Search & Filter Reload Reset Helpers
 *
 * Ensures that refreshing/reloading JobNexus clears all active and draft
 * search queries, refinement filters, sort selections, and search URL params,
 * returning the user cleanly to the default discovery state while preserving
 * non-search system query parameters (such as OAuth callback flags).
 */

export const SEARCH_URL_PARAM_KEYS = [
  'query',
  'role',
  'company',
  'location',
  'type',
  'level',
  'remote',
  'industry',
  'sort',
  'page',
  'pageSize',
  'refresh',
] as const;

export interface ReloadCheckWindowLike {
  performance?: {
    getEntriesByType?: (type: string) => readonly unknown[];
    navigation?: { type?: number };
  };
  history?: {
    state?: unknown;
  };
}

export interface SessionStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const SEARCH_INTENT_TYPES = new Set(['search', 'pill', 'domain', 'workplace']);

/**
 * Detects whether the current document load was triggered by a page refresh / reload
 * (desktop Cmd+R / F5 / Reload button, mobile pull-to-refresh, or reloading an
 * in-app pushed search history entry).
 */
export function isPageReloadNavigation(win: ReloadCheckWindowLike | undefined): boolean {
  if (!win) return false;

  try {
    const navEntries = win.performance?.getEntriesByType?.('navigation');
    if (Array.isArray(navEntries) && navEntries.length > 0) {
      const firstEntry = navEntries[0];
      const navType =
        firstEntry && typeof firstEntry === 'object' && 'type' in firstEntry
          ? (firstEntry as { type?: unknown }).type
          : undefined;
      if (navType === 'reload') {
        return true;
      }
    }

    // Legacy Navigation Timing Level 1 fallback (TYPE_RELOAD === 1)
    if (win.performance?.navigation?.type === 1) {
      return true;
    }
  } catch {
    // Ignore restricted performance API environments
  }

  // If the current history entry already carries in-app pushed searchCriteria state
  // on initial document mount, the browser reloaded an existing in-session search URL.
  const historyState = win.history?.state;
  if (
    historyState &&
    typeof historyState === 'object' &&
    'searchCriteria' in (historyState as Record<string, unknown>)
  ) {
    return true;
  }

  return false;
}

/**
 * Strips all search, filter, sort, and pagination parameters from a URL path + query string,
 * while strictly preserving non-search parameters (e.g., `auth_success` or `auth_error`).
 */
export function buildCleanReloadUrl(pathname: string, search: string): string {
  const safePath = (pathname || '/').split('?')[0] || '/';
  if (!search) return safePath;

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of SEARCH_URL_PARAM_KEYS) {
    params.delete(key);
  }

  const remaining = params.toString();
  return remaining ? `${safePath}?${remaining}` : safePath;
}

/**
 * Clears any stale search/filter `jn_pending_intent` from sessionStorage on page reload
 * so refreshing never resurrects an abandoned pre-auth filter or keyword search,
 * while leaving job-level intents (`save-job`, `apply`) intact.
 */
export function clearStalePendingSearchIntentOnReload(
  storage: SessionStorageLike | null | undefined
): boolean {
  if (!storage) return false;

  try {
    const raw = storage.getItem('jn_pending_intent');
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { type?: unknown } | null;
    if (parsed && typeof parsed.type === 'string' && SEARCH_INTENT_TYPES.has(parsed.type)) {
      storage.removeItem('jn_pending_intent');
      return true;
    }
  } catch {
    // Malformed intent payload — remove safely so it cannot cause unexpected state
    try {
      storage.removeItem('jn_pending_intent');
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
