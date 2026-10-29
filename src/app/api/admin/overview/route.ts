import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getAdminOverview } from '@/modules/storage/firestore/admin-billing.store';

/**
 * GET /api/admin/overview
 * Returns aggregate metrics for the JobNexus Admin Console:
 * - Pending verification submissions count
 * - 12h SLA breach count
 * - Active Premium subscribers count
 * - Total approved and rejected counts
 * - Audit logs count
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  try {
    const metrics = await getAdminOverview();
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err) {
    console.error('[Admin Overview GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve administrative overview metrics.',
      },
      { status: 500 }
    );
  }
}

