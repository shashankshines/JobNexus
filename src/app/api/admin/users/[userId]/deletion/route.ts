import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  getUserById,
  getUserByEmail,
  updateUserAccountStatus,
  deleteUserAccount,
} from '@/modules/auth/server/session.store';
import { recordAdminAuditLog } from '@/modules/storage/firestore/audit.store';

/**
 * POST /api/admin/users/[userId]/deletion
 * Manages the controlled deletion lifecycle:
 * - action: 'request' | 'cancel' | 'execute'
 * - reason: string (MANDATORY, >= 5 chars)
 * - retentionDays?: number (for 'request', default 30)
 * - confirmationChecked?: boolean (required true for 'execute')
 *
 * Invariants:
 * 1. Immediate deletion is never an accidental single click.
 * 2. 'execute' permanently purges credentials, auth identity, and sessions,
 *    while preserving financial ledger entries and immutable audit logs.
 * 3. Records an immutable audit log entry for every stage.
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

  const action = typeof body.action === 'string' ? body.action.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const retentionDays = typeof body.retentionDays === 'number' ? body.retentionDays : 30;
  const confirmationChecked = body.confirmationChecked === true;

  const validActions = ['request', 'cancel', 'execute'];
  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid deletion action "${action}". Must be one of: ${validActions.join(', ')}.`,
      },
      { status: 400 }
    );
  }

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

    if (action === 'request') {
      const previousStatus = user.accountStatus || 'active';
      const { user: updatedUser, revokedSessionsCount } = updateUserAccountStatus(user.id, {
        status: 'deletion_requested',
        reason,
        updatedBy: auth.user.email,
        retentionDays,
      });

      await recordAdminAuditLog({
        actorId: auth.user.id || auth.user.email,
        actorEmail: auth.user.email,
        action: 'account_deletion_requested',
        targetUserId: updatedUser.id,
        targetUserEmail: updatedUser.email,
        targetEntityId: updatedUser.id,
        previousState: {
          accountStatus: previousStatus,
        },
        newState: {
          accountStatus: updatedUser.accountStatus,
          deletionRequestedAt: updatedUser.deletionRequestedAt,
          deletionScheduledFor: updatedUser.deletionScheduledFor,
          retentionDays,
          revokedSessionsCount,
        },
        reason,
      });

      return NextResponse.json({
        success: true,
        message: `Account deletion requested. Scheduled purge on ${updatedUser.deletionScheduledFor}. Active sessions terminated.`,
        user: updatedUser,
        revokedSessionsCount,
      });
    }

    if (action === 'cancel') {
      const previousStatus = user.accountStatus;
      const { user: updatedUser } = updateUserAccountStatus(user.id, {
        status: 'active',
        reason: `Deletion request cancelled: ${reason}`,
        updatedBy: auth.user.email,
      });

      await recordAdminAuditLog({
        actorId: auth.user.id || auth.user.email,
        actorEmail: auth.user.email,
        action: 'account_deletion_cancelled',
        targetUserId: updatedUser.id,
        targetUserEmail: updatedUser.email,
        targetEntityId: updatedUser.id,
        previousState: {
          accountStatus: previousStatus,
          deletionRequestedAt: user.deletionRequestedAt,
          deletionScheduledFor: user.deletionScheduledFor,
        },
        newState: {
          accountStatus: updatedUser.accountStatus,
        },
        reason,
      });

      return NextResponse.json({
        success: true,
        message: 'Account deletion request successfully cancelled. Account reinstated to active status.',
        user: updatedUser,
      });
    }

    if (action === 'execute') {
      if (!confirmationChecked) {
        return NextResponse.json(
          {
            success: false,
            error: 'Explicit confirmation required before executing irreversible account deletion.',
          },
          { status: 400 }
        );
      }

      const targetEmail = user.email;
      const targetId = user.id;

      // Purge credentials, auth identity, saved jobs, sessions
      const deletionResult = deleteUserAccount(user.id, { preserveFinancialRecords: true });

      // Record final audit entry
      await recordAdminAuditLog({
        actorId: auth.user.id || auth.user.email,
        actorEmail: auth.user.email,
        action: 'account_deletion_completed',
        targetUserId: targetId,
        targetUserEmail: targetEmail,
        targetEntityId: targetId,
        previousState: {
          accountStatus: user.accountStatus,
          deletionRequestedAt: user.deletionRequestedAt,
        },
        newState: {
          accountStatus: 'deleted',
          credentialsDeleted: deletionResult.credentialsDeleted,
          revokedSessionsCount: deletionResult.revokedSessionsCount,
          completedAt: new Date().toISOString(),
        },
        reason,
      });

      return NextResponse.json({
        success: true,
        message: `Account for "${targetEmail}" has been permanently purged. Financial records and audit logs retained according to policy.`,
        deletionResult,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unhandled deletion action.' },
      { status: 400 }
    );
  } catch (err) {
    console.error(`[Admin Deletion Error for "${userId}"]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to process deletion request.',
      },
      { status: 500 }
    );
  }
}
