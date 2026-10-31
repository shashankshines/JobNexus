import { PopularSearchPill, PopularSearchesResponse } from '../domain/popular-searches.types';
import { parseQueryTokens } from '../domain/job.ranking';
import { DurableStore } from '../../storage/durable.store';

const WINDOW_DAYS = 30;

export const BASELINE_POPULAR_PILLS: Omit<PopularSearchPill, 'updatedAt'>[] = [
  {
    id: 'full-stack-developer',
    label: '⚡ Full Stack',
    query: 'Full Stack Developer',
    searchCount: 4200,
    avgSearches: 140,
    formattedAverage: '140/day',
    trend: 'hot',
    category: 'technology',
  },
  {
    id: 'react-developer',
    label: '⚛️ React / Next.js',
    query: 'React Developer',
    searchCount: 3750,
    avgSearches: 125,
    formattedAverage: '125/day',
    trend: 'hot',
    category: 'technology',
  },
  {
    id: 'ai-machine-learning',
    label: '🤖 AI & ML',
    query: 'AI Machine Learning',
    searchCount: 3450,
    avgSearches: 115,
    formattedAverage: '115/day',
    trend: 'rising',
    category: 'technology',
  },
  {
    id: 'python-backend',
    label: '🐍 Python / Backend',
    query: 'Python Backend Engineer',
    searchCount: 2850,
    avgSearches: 95,
    formattedAverage: '95/day',
    trend: 'steady',
    category: 'technology',
  },
  {
    id: 'devops-cloud',
    label: '☁️ DevOps & Cloud',
    query: 'DevOps Cloud',
    searchCount: 2550,
    avgSearches: 85,
    formattedAverage: '85/day',
    trend: 'steady',
    category: 'technology',
  },
  {
    id: 'healthcare-nursing',
    label: '🏥 Healthcare & Nursing',
    query: 'Healthcare Clinical Nurse',
    searchCount: 2250,
    avgSearches: 75,
    formattedAverage: '75/day',
    trend: 'rising',
    category: 'healthcare',
  },
  {
    id: 'data-analytics',
    label: '📊 Data Analyst',
    query: 'Data Analyst',
    searchCount: 2100,
    avgSearches: 70,
    formattedAverage: '70/day',
    trend: 'rising',
    category: 'technology',
  },
  {
    id: 'mobile-developer',
    label: '📱 Mobile (Flutter/RN)',
    query: 'Mobile Developer',
    searchCount: 1800,
    avgSearches: 60,
    formattedAverage: '60/day',
    trend: 'steady',
    category: 'technology',
  },
  {
    id: 'ui-ux-design',
    label: '🎨 UI/UX Design',
    query: 'Product Designer',
    searchCount: 1650,
    avgSearches: 55,
    formattedAverage: '55/day',
    trend: 'steady',
    category: 'design',
  },
  {
    id: 'cybersecurity',
    label: '🔒 Cybersecurity',
    query: 'Cybersecurity Analyst',
    searchCount: 1500,
    avgSearches: 50,
    formattedAverage: '50/day',
    trend: 'rising',
    category: 'security',
  },
  {
    id: 'education-teaching',
    label: '🎓 Education & Teaching',
    query: 'Education Teacher',
    searchCount: 1350,
    avgSearches: 45,
    formattedAverage: '45/day',
    trend: 'steady',
    category: 'education',
  },
];

function formatAverageSearches(dailyAverage: number): string {
  if (dailyAverage >= 1000) {
    return `${(dailyAverage / 1000).toFixed(1)}k/day`;
  }
  return `${dailyAverage < 1 ? dailyAverage.toFixed(2) : Math.round(dailyAverage)}/day`;
}

function resolveEmojiIcon(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('react') || q.includes('front')) return '⚛️';
  if (q.includes('ai') || q.includes('machine learning') || q.includes('ml')) return '🤖';
  if (q.includes('python')) return '🐍';
  if (q.includes('cloud') || q.includes('devops') || q.includes('aws')) return '☁️';
  if (q.includes('health') || q.includes('nurse') || q.includes('doctor') || q.includes('clinical')) return '🏥';
  if (q.includes('data') || q.includes('analyst') || q.includes('analytics')) return '📊';
  if (q.includes('mobile') || q.includes('android') || q.includes('ios') || q.includes('flutter')) return '📱';
  if (q.includes('design') || q.includes('ui') || q.includes('ux') || q.includes('figma')) return '🎨';
  if (q.includes('security') || q.includes('cyber')) return '🔒';
  if (q.includes('teach') || q.includes('school') || q.includes('education')) return '🎓';
  if (q.includes('finance') || q.includes('account')) return '💰';
  if (q.includes('logistics') || q.includes('supply') || q.includes('transport')) return '🚚';
  if (q.includes('construct') || q.includes('engineer')) return '🏗️';
  return '🔍';
}

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRoleOnlyQuery(rawQuery: string): string {
  const parsed = parseQueryTokens(rawQuery);
  if (!parsed.hasRoleTokens) return '';

  let roleQuery = rawQuery;
  for (const location of parsed.locationTokens) {
    const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    roleQuery = roleQuery.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  }
  roleQuery = roleQuery
    .replace(/\b(in|at|near|within|of)\b/gi, ' ')
    .replace(/[,\s]+/g, ' ')
    .trim();

  return normalizeKey(roleQuery) === normalizeKey(parsed.rolePhrase)
    ? roleQuery
    : parsed.rolePhrase;
}

export class PopularSearchesService {
  private static store = new DurableStore<PopularSearchPill & { dailySearches?: Record<string, number> }>('popular_searches');
  private static initialized = false;

  private static initDefaults(): void {
    if (this.initialized) return;
    const existing = this.store.getAll();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      for (const item of BASELINE_POPULAR_PILLS) {
        this.store.set(item.id, {
          ...item,
          updatedAt: now,
        });
      }
    }
    this.initialized = true;
  }

  static getDefaultPills(): PopularSearchPill[] {
    const now = new Date().toISOString();
    return BASELINE_POPULAR_PILLS.slice(0, 8).map((pill) => ({
      ...pill,
      updatedAt: now,
    }));
  }

  static getPopularPills(limit = 8): PopularSearchPill[] {
    this.initDefaults();
    const storedItems = this.store.getAll().flatMap((item) => {
      const roleQuery = getRoleOnlyQuery(item.query);
      if (!roleQuery) return [];
      const hasLocationTokens = parseQueryTokens(item.query).hasLocationTokens;
      return [{
        ...item,
        query: roleQuery,
        label: hasLocationTokens ? `${resolveEmojiIcon(roleQuery)} ${roleQuery}` : item.label,
      }];
    });
    const now = new Date();
    const hasRecentSearches = storedItems.some((item) => this.getRecentSearchCount(item, now) > 0);
    const items = storedItems.map((item) => {
      const recentSearchCount = this.getRecentSearchCount(item, now);
      const recentAverage = recentSearchCount / WINDOW_DAYS;
      const baseline = BASELINE_POPULAR_PILLS.find((pill) => pill.id === item.id);
      return {
        ...item,
        recentSearchCount,
        avgSearches: hasRecentSearches ? recentAverage : baseline?.avgSearches ?? 0,
        formattedAverage: hasRecentSearches
          ? formatAverageSearches(recentAverage)
          : baseline?.formattedAverage ?? '0/day',
        trend: hasRecentSearches
          ? recentAverage >= 100 ? 'hot' as const : recentSearchCount > 0 ? 'rising' as const : 'steady' as const
          : baseline?.trend ?? 'steady',
      };
    });

    items.sort((a, b) => {
      if (hasRecentSearches && b.recentSearchCount !== a.recentSearchCount) {
        return b.recentSearchCount - a.recentSearchCount;
      }
      if (b.avgSearches !== a.avgSearches) return b.avgSearches - a.avgSearches;
      return b.searchCount - a.searchCount;
    });

    return items.slice(0, limit).map((item) => ({
      id: item.id,
      label: item.label,
      query: item.query,
      searchCount: item.searchCount,
      avgSearches: item.avgSearches,
      formattedAverage: item.formattedAverage,
      trend: item.trend,
      category: item.category,
      updatedAt: item.updatedAt,
    }));
  }

  private static getRecentSearchCount(
    item: PopularSearchPill & { dailySearches?: Record<string, number> },
    now: Date
  ): number {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const windowStart = today - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000;

    return Object.entries(item.dailySearches || {}).reduce((total, [day, count]) => {
      const dayTimestamp = Date.parse(`${day}T00:00:00.000Z`);
      return Number.isFinite(dayTimestamp) && dayTimestamp >= windowStart && dayTimestamp <= today
        ? total + count
        : total;
    }, 0);
  }

  static getPopularSearchesResponse(limit = 8): PopularSearchesResponse {
    this.initDefaults();
    const pills = this.getPopularPills(limit);
    const allItems = this.store.getAll();
    const totalSearchesRecorded = allItems.reduce(
      (acc, pill) => acc + (getRoleOnlyQuery(pill.query) ? pill.searchCount : 0),
      0
    );

    return {
      pills,
      totalSearchesRecorded,
      periodDays: WINDOW_DAYS,
      lastUpdated: new Date().toISOString(),
    };
  }

  static recordSearch(rawQuery: string, limit = 8): PopularSearchPill[] {
    this.initDefaults();
    const clean = getRoleOnlyQuery(rawQuery || '');
    if (!clean || clean.length < 2) {
      return this.getPopularPills(limit);
    }

    const normQuery = normalizeKey(clean);
    // Ignore pure symbols or numeric noise
    if (normQuery.length < 2) {
      return this.getPopularPills(limit);
    }

    const allItems = this.store.getAll();
    let matchedItem: (PopularSearchPill & { dailySearches?: Record<string, number> }) | undefined;

    // Check for existing query match
    for (const item of allItems) {
      const itemNormQuery = normalizeKey(getRoleOnlyQuery(item.query));
      const itemNormLabel = normalizeKey(item.label);
      if (itemNormQuery === normQuery || itemNormLabel === normQuery) {
        matchedItem = item;
        break;
      }
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const today = now.slice(0, 10);

    if (matchedItem) {
      matchedItem.searchCount += 1;
      const firstDay = new Date(nowDate.getTime() - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      matchedItem.dailySearches = Object.fromEntries(
        Object.entries(matchedItem.dailySearches || {}).filter(([day]) => day >= firstDay)
      );
      matchedItem.dailySearches[today] = (matchedItem.dailySearches[today] || 0) + 1;
      const recentSearchCount = this.getRecentSearchCount(matchedItem, nowDate);
      matchedItem.avgSearches = recentSearchCount / WINDOW_DAYS;
      matchedItem.formattedAverage = formatAverageSearches(matchedItem.avgSearches);
      matchedItem.trend = matchedItem.avgSearches >= 100 ? 'hot' : 'rising';
      matchedItem.updatedAt = now;
      this.store.set(matchedItem.id, matchedItem);
    } else {
      // Create new dynamic pill for rising search
      const id = normQuery.replace(/\s+/g, '-');
      const icon = resolveEmojiIcon(clean);

      const newPill: PopularSearchPill & { dailySearches?: Record<string, number> } = {
        id: `custom-${id}`,
        label: `${icon} ${clean}`,
        query: clean,
        searchCount: 1,
        avgSearches: 1 / WINDOW_DAYS,
        formattedAverage: formatAverageSearches(1 / WINDOW_DAYS),
        trend: 'rising',
        updatedAt: now,
        dailySearches: { [today]: 1 },
      };

      this.store.set(newPill.id, newPill);
    }

    return this.getPopularPills(limit);
  }

  static resetToDefault(): void {
    this.store.clear();
    this.initialized = false;
    this.initDefaults();
  }
}
