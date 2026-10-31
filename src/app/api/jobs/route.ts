import { NextResponse } from 'next/server';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import { LegacyJob } from '@/modules/jobs/domain/job.types';
import {
  validateSession,
  extractSessionId,
} from '@/modules/auth/server/session.store';
import {
  maskJobForAnonymous,
  maskJobsForAnonymous,
} from '@/modules/jobs/domain/job.masking';
import { buildExternalPlatformSearchLinks } from '@/modules/jobs/domain/job.links';
import { normalizeIndustryFilter } from '@/modules/jobs/domain/job.taxonomy';

// Re-export Job interface for backward compatibility with existing imports
export type Job = LegacyJob;

const searchService = new JobSearchService();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = extractSessionId(request);
    const auth = validateSession(sessionId);
    const isAuthenticated = Boolean(auth.valid && auth.user);

    const isStats = searchParams.get('stats') === 'true';
    if (isStats) {
      const stats = await searchService.getJobStats();
      const safeStats = isAuthenticated
        ? stats
        : {
            ...stats,
            sources: stats.sources.map(() => 'Job source hidden'),
            providerBreakdown: {},
          };

      return NextResponse.json(safeStats, {
        headers: {
          'Vary': 'Cookie, Authorization',
          'Cache-Control': isAuthenticated
            ? 'private, no-cache, no-store, must-revalidate'
            : 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

    const query = searchParams.get('query') || '';
    const role = searchParams.get('role') || '';
    const company = searchParams.get('company') || '';
    const location = searchParams.get('location') || '';
    const type = searchParams.get('type') || '';
    const level = searchParams.get('level') || '';
    const remote = searchParams.get('remote') || '';
    const rawIndustry = searchParams.get('industry') || '';
    const industry = normalizeIndustryFilter(rawIndustry);
    const page = Number(searchParams.get('page') || '1');
    const rawPageSize = searchParams.get('pageSize');
    const pageSize = rawPageSize === null ? undefined : Number(rawPageSize);
    const rawSort = searchParams.get('sort') || 'relevance';
    const rawRefresh = searchParams.get('refresh');
    const jobId = searchParams.get('id');

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      (pageSize !== undefined &&
        (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)) ||
      (rawSort !== 'relevance' && rawSort !== 'date')
      || (rawRefresh !== null && rawRefresh !== '1')
    ) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }
    if (industry === null) {
      return NextResponse.json({ error: 'Invalid industry filter' }, { status: 400 });
    }

    // Single-job resolution must search the full normalized snapshot, not only its first page.
    if (jobId) {
      const targetJob = await searchService.getJobById(jobId);
      if (!targetJob) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(
        {
          job: isAuthenticated ? targetJob : maskJobForAnonymous(targetJob),
        },
        {
          headers: {
            'Vary': 'Cookie, Authorization',
            'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
          },
        }
      );
    }

    // Step 1: Execute server-side job aggregation, deduplication, and ranking on raw data
    const result = await searchService.searchJobs({
      query,
      role,
      company,
      location,
      type,
      level,
      remote,
      industry,
      page,
      pageSize,
      forceRefresh: rawRefresh === '1',
      sort: rawSort,
    });

    const responseHeaders: Record<string, string> = {
      'Vary': 'Cookie, Authorization',
      'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
    };

    // Step 2: Server-side data boundary shaping
    // Anonymous users receive masked company names, masked sources, empty provider list, and omitted diagnostics.
    // Authenticated users receive full unmasked company details, sources, and verified diagnostics.
    const shapedJobs = isAuthenticated
      ? result.jobs
      : maskJobsForAnonymous(result.jobs);

    return NextResponse.json(
      {
        jobs: shapedJobs,
        count: result.count,
        totalAvailable: result.totalAvailable,
        snapshotId: result.snapshotId,
        returnedCount: result.returnedCount,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        truncated: result.truncated,
        providerCoverage: result.providerCoverage,
        sources: isAuthenticated ? result.sources : [],
        diagnostics: isAuthenticated ? result.diagnostics : undefined,
        externalDiscovery: buildExternalPlatformSearchLinks({
          query: [query, role].filter(Boolean).join(' '),
          company,
          location,
        }),
      },
      {
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error('[JobNexus API Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
