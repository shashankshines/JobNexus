'use client';

import { useState, useEffect, useCallback } from 'react';
import { JobStatsResponse } from '../domain/job.types';

// Client-side cache to prevent redundant requests across components
let globalClientStats: JobStatsResponse | null = null;
let globalCacheTimestamp = 0;
const CLIENT_CACHE_TTL_MS = 60 * 1000; // 1 minute

export function useJobStats(fallbackCount = 1350) {
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
      console.warn('[useJobStats] Failed to fetch live job stats, falling back:', err);
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

  const syncFromJobsCount = useCallback((liveCount: number) => {
    if (liveCount > 0) {
      setStats((prev) => {
        const updated: JobStatsResponse = {
          totalJobs: liveCount,
          exactCount: liveCount,
          formattedCount: `${liveCount.toLocaleString()}+`,
          remoteJobs: prev?.remoteJobs ?? 0,
          indiaEligibleJobs: prev?.indiaEligibleJobs ?? 0,
          sources: prev?.sources ?? [],
          sourcesCount: prev?.sourcesCount ?? 8,
          providerBreakdown: prev?.providerBreakdown ?? {},
          lastUpdated: new Date().toISOString(),
        };
        globalClientStats = updated;
        globalCacheTimestamp = Date.now();
        return updated;
      });
    }
  }, []);

  const totalCount = stats?.totalJobs ?? fallbackCount;
  const exactCount = stats?.exactCount ?? stats?.totalJobs ?? fallbackCount;
  const formattedCount = stats?.formattedCount ?? `${fallbackCount.toLocaleString()}+`;
  const remoteCount = stats?.remoteJobs ?? 0;
  const indiaEligibleCount = stats?.indiaEligibleJobs ?? 0;
  const sourcesCount = stats?.sourcesCount ?? 8;
  const sources = stats?.sources ?? [];

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
    refresh: () => fetchStats(true),
    syncFromJobsCount,
  };
}
