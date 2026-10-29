import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getUser360Profile } from '@/modules/storage/firestore/admin-billing.store';

/**
 * GET /api/admin/users/[userId]
 * Retrieves User 360° Dossier:
 * - Canonical identity & auth provider
 * - Authoritative subscription entitlement evaluation
 * - Complete order history
 * - Complete UPI submission history with decision metadata
 * - Administrative audit trail
 * - Chronological unified timeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'User ID is required.' },
      { status: 400 }
    );
  }

  try {
    const dossier = await getUser360Profile(userId);
    return NextResponse.json({
      success: true,
      dossier,
    });
  } catch (err) {
    console.error(`[Admin User 360 GET Error for "${userId}"]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve User 360 profile.',
      },
      { status: 500 }
    );
  }
}

