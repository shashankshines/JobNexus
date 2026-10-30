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
  const query = searchParams.get('userId') || searchParams.get('query') || undefined;
  const rawStatus = searchParams.get('status') || searchParams.get('entitlementStatus');
  const entitlementStatus = (
    rawStatus === 'active' || rawStatus === 'free' || rawStatus === 'expired' || rawStatus === 'suspended' || rawStatus === 'cancelled'
      ? rawStatus
      : 'all'
  ) as 'all' | 'active' | 'free' | 'expired' | 'suspended' | 'cancelled';

  const rawSource = searchParams.get('source');
  const source = (
    rawSource === 'payment_backed' || rawSource === 'manual_grant'
      ? rawSource
      : 'all'
  ) as 'all' | 'payment_backed' | 'manual_grant';

  const expiringSoon = searchParams.get('expiringSoon') === 'true';

  const rawSortBy = searchParams.get('sortBy');
  const sortBy = (
    rawSortBy === 'currentPeriodEnd' || rawSortBy === 'userId' || rawSortBy === 'status' || rawSortBy === 'updatedAt'
      ? rawSortBy
      : 'currentPeriodEnd'
  ) as 'currentPeriodEnd' | 'userId' | 'status' | 'updatedAt';

  const rawSortDir = searchParams.get('sortDir');
  const sortDir = (rawSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
  const limitParam = parseInt(searchParams.get('limit') || '5', 10);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const rawSubs = await getAdminSubscriptions({
      query,
      entitlementStatus,
      source,
      expiringSoon,
      sortBy,
      sortDir,
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
    });

    const enrichedSubs = rawSubs.map((sub) => {
      const entitlement = evaluateSubscriptionEntitlement(sub.userId, sub);
      const isPayment =
        sub.lastUpdatedFrom === 'manual_upi' ||
        sub.provider === 'manual_upi' ||
        sub.provider === 'razorpay';
      const source: 'payment_backed' | 'manual_grant' = isPayment ? 'payment_backed' : 'manual_grant';

      return {
        ...sub,
        source,
        entitlement,
      };
    });

    const totalCount = typeof (rawSubs as { total?: number }).total === 'number' ? (rawSubs as { total?: number }).total! : enrichedSubs.length;

    return NextResponse.json({
      success: true,
      subscriptions: enrichedSubs,
      total: totalCount,
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
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

