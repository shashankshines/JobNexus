import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getAdminSubscriptions } from '@/modules/storage/firestore/admin-billing.store';
import { evaluateSubscriptionEntitlement } from '@/modules/billing/services/entitlement.service';

/**
 * GET /api/admin/subscriptions
 * Retrieves subscriptions for administrative inspection.
 * Supports filtering by specific userId or listing recent records.
 * Computes authoritative entitlement state for each record.
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
  const userId = searchParams.get('userId') || searchParams.get('query') || undefined;
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const rawSubs = await getAdminSubscriptions({
      userId,
      query: userId,
      limit: isNaN(limitParam) ? 50 : limitParam,
    });

    const enrichedSubs = rawSubs.map((sub) => {
      const entitlement = evaluateSubscriptionEntitlement(sub.userId, sub);
      return {
        ...sub,
        entitlement,
      };
    });

    return NextResponse.json({
      success: true,
      subscriptions: enrichedSubs,
      total: enrichedSubs.length,
    });
  } catch (err) {
    console.error('[Admin Subscriptions GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve subscription records.',
      },
      { status: 500 }
    );
  }
}

