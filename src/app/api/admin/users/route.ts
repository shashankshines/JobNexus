import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  getAdminUsersDirectory,
  AdminUsersDirectoryFilter,
} from '@/modules/storage/firestore/admin-billing.store';

/**
 * GET /api/admin/users
 * Paginated, searchable, filterable directory of all registered users with summary metrics.
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
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
    );
    const search = searchParams.get('search') || undefined;
    const accountStatus = (searchParams.get('accountStatus') || 'all') as AdminUsersDirectoryFilter['accountStatus'];
    const provider = (searchParams.get('provider') || 'all') as AdminUsersDirectoryFilter['provider'];
    const premiumStatus = (searchParams.get('premiumStatus') || 'all') as AdminUsersDirectoryFilter['premiumStatus'];
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as AdminUsersDirectoryFilter['sortBy'];
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as AdminUsersDirectoryFilter['sortOrder'];

    const directory = await getAdminUsersDirectory({
      page,
      pageSize,
      search,
      accountStatus,
      provider,
      premiumStatus,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      ...directory,
    });
  } catch (err) {
    console.error('[Admin Users Directory GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve users directory.',
      },
      { status: 500 }
    );
  }
}
