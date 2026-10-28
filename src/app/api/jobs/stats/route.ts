import { NextResponse } from 'next/server';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import {
  validateSession,
  extractSessionId,
} from '@/modules/auth/server/session.store';

const searchService = new JobSearchService();

export async function GET(request: Request = new Request('http://localhost:3000/api/jobs/stats')) {
  try {
    const sessionId = extractSessionId(request);
    const auth = validateSession(sessionId);
    const isAuthenticated = Boolean(auth.valid && auth.user);

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
  } catch (error) {
    console.error('[JobNexus Stats API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job stats' },
      { status: 500 }
    );
  }
}
