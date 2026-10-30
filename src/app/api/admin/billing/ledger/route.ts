import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  getConsolidatedPaymentLedger,
  PaymentLedgerFilter,
} from '@/modules/storage/firestore/admin-billing.store';

/**
 * GET /api/admin/billing/ledger
 * Retrieves Consolidated Payment Ledger merging payment orders with submissions:
 * - Verified payments, pending claims, rejected claims, unsubmitted orders, expired checkouts
 * - Financial integrity summary: verified revenue (₹499 * approved), pending claimed revenue
 * - Explicit disclosure regarding non-automated refunds
 * - Full search (UTR, orderId, userId, userEmail) and date range filtering
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
  const statusParam = searchParams.get('status') as PaymentLedgerFilter['status'] | null;
  const query = searchParams.get('query') || undefined;
  const cursorParam = searchParams.get('cursor') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const limitParam = parseInt(searchParams.get('limit') || '5', 10);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

  const filter: PaymentLedgerFilter = {
    status: statusParam && statusParam !== 'all' ? statusParam : 'all',
    query,
    cursor: cursorParam,
    dateFrom,
    dateTo,
    limit: isNaN(limitParam) ? 5 : limitParam,
    offset: isNaN(offsetParam) ? 0 : offsetParam,
  };

  try {
    const result = await getConsolidatedPaymentLedger(filter);
    return NextResponse.json({
      success: true,
      records: result.records,
      summary: result.summary,
      total: result.total,
      nextCursor: result.nextCursor || null,
      prevCursor: null,
      hasMore: Boolean(result.hasMore),
      limit: isNaN(limitParam) ? 5 : limitParam,
      offset: isNaN(offsetParam) ? 0 : offsetParam,
    });
  } catch (err) {
    console.error('[Admin Billing Ledger GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve payment ledger records.',
      },
      { status: 500 }
    );
  }
}

