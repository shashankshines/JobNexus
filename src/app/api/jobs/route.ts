import { NextResponse } from 'next/server';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import { LegacyJob } from '@/modules/jobs/domain/job.types';

// Re-export Job interface for backward compatibility with existing imports
export type Job = LegacyJob;

const searchService = new JobSearchService();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const location = searchParams.get('location') || '';
    const type = searchParams.get('type') || '';
    const level = searchParams.get('level') || '';
    const remote = searchParams.get('remote') || '';

    const result = await searchService.searchJobs({
      query,
      location,
      type,
      level,
      remote,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[JobNexus API Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
