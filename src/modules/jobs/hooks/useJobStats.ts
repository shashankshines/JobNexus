'use client';

import { useState, useEffect, useCallback } from 'react';
import { JobStatsResponse } from '../domain/job.types';

// Client-side cache to prevent redundant requests across components
let globalClientStats: JobStatsResponse | null = null;
let globalCacheTimestamp = 0;
const CLIENT_CACHE_TTL_MS = 60 * 1000; // 1 minute

export function useJobStats() {
  const [stats, setStats] = useState<JobStatsResponse | null>(globalClientStats);
  const [loading, setLoading] = useState<boolean>(!globalClientStats);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (force = false) => {
    if (!force && globalClientStats && Date.now() - globalCacheTimestamp < CLIENT_CACHE_TTL_MS) {
      setStats(globalClientStats);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/jobs/stats');
      if (!res.ok) {
        throw new Error(`Failed to load stats: HTTP ${res.status}`);
      }
      const data: JobStatsResponse = await res.json();
      globalClientStats = data;
      globalCacheTimestamp = Date.now();
      setStats(data);
      setError(null);
    } catch (err) {
      console.warn('[useJobStats] Failed to fetch live job stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Poll every 120 seconds for live dynamic updates when the page is active
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return; // Skip background polling when tab is inactive
      }
      fetchStats(false);
    }, 120000);
    return () => clearInterval(intervalId);
  }, [fetchStats]);

  const totalCount = stats?.totalJobs ?? null;
  const exactCount = stats?.exactCount ?? null;
  const formattedCount = stats?.formattedCount ?? (loading ? 'Loading' : 'Unavailable');
  const remoteCount = stats?.remoteJobs ?? 0;
  const indiaEligibleCount = stats?.indiaEligibleJobs ?? 0;
  const sourcesCount = stats?.sourcesCount ?? 0;
  const sources = stats?.sources ?? [];
  const inventoryCoverageIncomplete = stats?.providerCoverage.incomplete ?? false;

  return {
    stats,
    loading,
    error,
    totalCount,
    exactCount,
    formattedCount,
    remoteCount,
    indiaEligibleCount,
    sourcesCount,
    sources,
    inventoryCoverageIncomplete,
    refresh: () => fetchStats(true),
  };
}
