import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getRecentOutboxRecords } from '@/modules/storage/firestore/outbox.store';

/**
 * GET /api/admin/billing/notifications
 * Administrative inspection endpoint for outbox notifications.
 * Gated strictly to authorized administrators (shashankshines@gmail.com).
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
  const statusParam = searchParams.get('status') || undefined;
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const notifications = await getRecentOutboxRecords({
      status: statusParam,
      limit: isNaN(limitParam) ? 50 : Math.min(limitParam, 100),
    });

    return NextResponse.json({
      success: true,
      notifications,
      total: notifications.length,
    });
  } catch (err) {
    console.error('[Admin Notifications GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve notification records.',
      },
      { status: 500 }
    );
  }
}

