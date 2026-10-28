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
    const location = searchParams.get('location') || '';
    const type = searchParams.get('type') || '';
    const level = searchParams.get('level') || '';
    const remote = searchParams.get('remote') || '';
    const industry = searchParams.get('industry') || '';
    const jobId = searchParams.get('id');

    // Step 1: Execute server-side job aggregation, deduplication, and ranking on raw data
    const result = await searchService.searchJobs({
      query,
      location,
      type,
      level,
      remote,
      industry,
    });

    const responseHeaders: Record<string, string> = {
      'Vary': 'Cookie, Authorization',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    };

    // Support single job query by id
    if (jobId) {
      const targetJob = result.jobs.find((j) => j.id === jobId);
      if (!targetJob) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(
        {
          job: isAuthenticated ? targetJob : maskJobForAnonymous(targetJob),
        },
        {
          headers: responseHeaders,
        }
      );
    }

    // Step 2: Server-side data boundary shaping
    // Anonymous users receive masked company names, masked sources, empty provider list, and omitted diagnostics.
    // Authenticated users receive full unmasked company details, sources, and verified diagnostics.
    const shapedJobs = isAuthenticated
      ? result.jobs
      : maskJobsForAnonymous(result.jobs);

    return NextResponse.json(
      {
        jobs: shapedJobs,
        count: shapedJobs.length,
        sources: isAuthenticated ? result.sources : [],
        diagnostics: isAuthenticated ? result.diagnostics : undefined,
        externalDiscovery: buildExternalPlatformSearchLinks({ query, location }),
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
