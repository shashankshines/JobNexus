import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  getUserById,
  getUserByEmail,
  revokeAllSessionsForUser,
} from '@/modules/auth/server/session.store';
import { recordAdminAuditLog } from '@/modules/storage/firestore/audit.store';

/**
 * POST /api/admin/users/[userId]/sessions/revoke
 * Terminates all active sessions for a target user server-side.
 * Invariant: Requires mandatory administrative reason.
 * Does not leak session tokens.
 * Records an immutable audit log entry.
 */
export async function POST(
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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length < 5) {
    return NextResponse.json(
      {
        success: false,
        error: 'A mandatory administrative reason of at least 5 characters is required.',
      },
      { status: 400 }
    );
  }

  try {
    let user = getUserById(userId);
    if (!user && userId.includes('@')) {
      user = getUserByEmail(userId);
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: `User "${userId}" was not found.` },
        { status: 404 }
      );
    }

    const revokedSessionsCount = revokeAllSessionsForUser(user.id);

    // Record immutable audit entry
    await recordAdminAuditLog({
      actorId: auth.user.id || auth.user.email,
      actorEmail: auth.user.email,
      action: 'sessions_revoked',
      targetUserId: user.id,
      targetUserEmail: user.email,
      targetEntityId: user.id,
      newState: {
        revokedSessionsCount,
        revokedAt: new Date().toISOString(),
      },
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully revoked ${revokedSessionsCount} active session${revokedSessionsCount === 1 ? '' : 's'} for ${user.email}.`,
      revokedSessionsCount,
      targetUserId: user.id,
    });
  } catch (err) {
    console.error(`[Admin Revoke Sessions Error for "${userId}"]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to revoke user sessions.',
      },
      { status: 500 }
    );
  }
}

