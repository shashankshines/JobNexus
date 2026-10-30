import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getAdminAuditLogs } from '@/modules/storage/firestore/admin-billing.store';

/**
 * GET /api/admin/audit-logs
 * Retrieves immutable audit logs for administrative accountability.
 * Supports filtering by action, targetUserId, and pagination limits.
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
  const action = searchParams.get('action') || undefined;
  const adminEmail = searchParams.get('adminEmail') || undefined;
  const targetUserId = searchParams.get('targetUserId') || undefined;
  const cursorParam = searchParams.get('cursor') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const limitParam = parseInt(searchParams.get('limit') || '5', 10);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const logs = await getAdminAuditLogs({
      action,
      adminEmail,
      targetUserId,
      cursor: cursorParam,
      dateFrom,
      dateTo,
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
    });

    const totalCount = typeof (logs as { total?: number }).total === 'number' ? (logs as { total?: number }).total! : logs.length;
    const nextCursor = (logs as { nextCursor?: string | null }).nextCursor || null;
    const hasMore = Boolean((logs as { hasMore?: boolean }).hasMore);

    return NextResponse.json({
      success: true,
      logs,
      total: totalCount,
      nextCursor,
      prevCursor: null,
      hasMore,
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
    });
  } catch (err) {
    console.error('[Admin Audit Logs GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve audit log records.',
      },
      { status: 500 }
    );
  }
}

