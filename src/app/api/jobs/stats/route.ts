import { NextResponse } from 'next/server';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';

const searchService = new JobSearchService();

export async function GET() {
  try {
    const stats = await searchService.getJobStats();
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
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
