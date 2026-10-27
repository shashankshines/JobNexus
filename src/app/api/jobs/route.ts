import { NextResponse } from 'next/server';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import { LegacyJob } from '@/modules/jobs/domain/job.types';
import {
  SESSION_COOKIE_NAME,
  validateSession,
} from '@/modules/auth/server/session.store';
import {
  maskJobForAnonymous,
  maskJobsForAnonymous,
} from '@/modules/jobs/domain/job.masking';
import { buildExternalPlatformSearchLinks } from '@/modules/jobs/domain/job.links';

// Re-export Job interface for backward compatibility with existing imports
export type Job = LegacyJob;

const searchService = new JobSearchService();

function extractSessionId(request: Request): string | null {
  // 1. Check HTTP-only cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (match) return match.split('=')[1];

  // 2. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isStats = searchParams.get('stats') === 'true';
    if (isStats) {
      const stats = await searchService.getJobStats();
      return NextResponse.json(stats, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      });
    }

    const query = searchParams.get('query') || '';
    const location = searchParams.get('location') || '';
    const type = searchParams.get('type') || '';
    const level = searchParams.get('level') || '';
    const remote = searchParams.get('remote') || '';
    const jobId = searchParams.get('id');

    // Step 1: Execute server-side job aggregation, deduplication, and ranking on raw data
    const result = await searchService.searchJobs({
      query,
      location,
      type,
      level,
      remote,
    });

    // Step 2: Verify server-side session
    const sessionId = extractSessionId(request);
    const auth = validateSession(sessionId);
    const isAuthenticated = Boolean(auth.valid && auth.user);

    // Support single job query by id
    if (jobId) {
      const targetJob = result.jobs.find((j) => j.id === jobId);
      if (!targetJob) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({
        job: isAuthenticated ? targetJob : maskJobForAnonymous(targetJob),
      });
    }

    // Step 3: Server-side data boundary shaping
    // Anonymous users receive masked company names and redacted application URLs.
    // Authenticated users receive full unmasked company details.
    const shapedJobs = isAuthenticated
      ? result.jobs
      : maskJobsForAnonymous(result.jobs);

    return NextResponse.json({
      jobs: shapedJobs,
      count: shapedJobs.length,
      sources: result.sources,
      diagnostics: result.diagnostics,
      externalDiscovery: buildExternalPlatformSearchLinks({ query, location }),
    });
  } catch (error) {
    console.error('[JobNexus API Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
