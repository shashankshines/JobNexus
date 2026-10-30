import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getAdminSubmissions } from '@/modules/storage/firestore/admin-billing.store';

/**
 * GET /api/admin/billing/submissions
 * Lists payment submissions with associated order details.
 * Supports status filtering ('all' | 'pending_verification' | 'approved' | 'rejected') and pagination.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') || 'all';
  const queryParam = searchParams.get('query') || undefined;
  const cursorParam = searchParams.get('cursor') || undefined;
  const limitParam = parseInt(searchParams.get('limit') || '5', 10);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

  const status =
    statusParam === 'pending_verification' ||
    statusParam === 'approved' ||
    statusParam === 'rejected'
      ? statusParam
      : 'all';

  try {
    const result = await getAdminSubmissions({
      status,
      query: queryParam,
      cursor: cursorParam,
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
    });

    return NextResponse.json({
      success: true,
      submissions: result.submissions,
      total: result.total,
      nextCursor: result.nextCursor || null,
      prevCursor: null,
      hasMore: Boolean(result.hasMore),
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
    });
  } catch (err) {
    console.error('[Admin Submissions GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve payment submissions.',
      },
      { status: 500 }
    );
  }
}

