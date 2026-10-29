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
  const targetUserId = searchParams.get('targetUserId') || undefined;
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const logs = await getAdminAuditLogs({
      action,
      targetUserId,
      limit: isNaN(limitParam) ? 50 : limitParam,
    });

    return NextResponse.json({
      success: true,
      logs,
      total: logs.length,
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

