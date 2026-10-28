import { NextRequest, NextResponse } from 'next/server';
import { PopularSearchesService } from '@/modules/jobs/services/popular-searches.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 8, 1), 20) : 8;

    const data = PopularSearchesService.getPopularSearchesResponse(limit);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[Popular Searches API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve popular searches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const location = typeof body?.location === 'string' ? body.location.trim() : undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const updatedPills = PopularSearchesService.recordSearch(query, location);

    return NextResponse.json({
      success: true,
      pills: updatedPills,
    });
  } catch (error) {
    console.error('[Popular Searches API Record Error]:', error);
    return NextResponse.json(
      { error: 'Failed to record search' },
      { status: 500 }
    );
  }
}

