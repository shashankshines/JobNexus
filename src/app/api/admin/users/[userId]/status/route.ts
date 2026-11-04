import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  getUserById,
  getUserByEmail,
  updateUserAccountStatus,
  UserAccountStatus,
} from '@/modules/auth/server/session.store';
import { recordAdminAuditLog } from '@/modules/storage/firestore/audit.store';
import { AdminAuditLogDocument } from '@/modules/storage/firestore/collections';
import { createAdminNotification } from '@/modules/notifications/admin-notifications.service';

/**
 * POST /api/admin/users/[userId]/status
 * Updates user account lifecycle status (active, suspended, deactivated, deletion_requested).
 * Requires mandatory justification reason.
 * Automatically terminates active sessions if access is restricted.
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

  const newStatus = typeof body.status === 'string' ? (body.status.trim() as UserAccountStatus) : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const retentionDays = typeof body.retentionDays === 'number' ? body.retentionDays : undefined;

  const validStatuses: UserAccountStatus[] = ['active', 'suspended', 'deactivated', 'deletion_requested'];
  if (!newStatus || !validStatuses.includes(newStatus)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid status "${newStatus}". Must be one of: ${validStatuses.join(', ')}.`,
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

    const previousStatus: UserAccountStatus = user.accountStatus || 'active';
    if (previousStatus === newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `User account is already in "${newStatus}" status. No change needed.`,
        },
        { status: 400 }
      );
    }

    // Determine audit action type
    let auditAction: AdminAuditLogDocument['action'] = 'account_suspended';
    if (newStatus === 'suspended') {
      auditAction = 'account_suspended';
    } else if (newStatus === 'deactivated') {
      auditAction = 'account_deactivated';
    } else if (newStatus === 'deletion_requested') {
      auditAction = 'account_deletion_requested';
    } else if (newStatus === 'active') {
      auditAction = previousStatus === 'deactivated' ? 'account_reactivated' : 'account_reinstated';
    }

    const { user: updatedUser, revokedSessionsCount } = updateUserAccountStatus(user.id, {
      status: newStatus,
      reason,
      updatedBy: auth.user.email,
      retentionDays,
    });

    // Record immutable audit entry
    await recordAdminAuditLog({
      actorId: auth.user.id || auth.user.email,
      actorEmail: auth.user.email,
      action: auditAction,
      targetUserId: updatedUser.id,
      targetUserEmail: updatedUser.email,
      targetEntityId: updatedUser.id,
      previousState: {
        accountStatus: previousStatus,
        accountStatusReason: user.accountStatusReason,
        accountStatusUpdatedAt: user.accountStatusUpdatedAt,
      },
      newState: {
        accountStatus: updatedUser.accountStatus,
        accountStatusReason: updatedUser.accountStatusReason,
        accountStatusUpdatedAt: updatedUser.accountStatusUpdatedAt,
        revokedSessionsCount,
      },
      reason,
    });

    if (newStatus === 'suspended' || newStatus === 'active') {
      try {
        const notifType = newStatus === 'suspended' ? 'account_suspended' : 'account_reinstated';
        await createAdminNotification({
          eventKey: `${notifType}_${user.id}_${Date.now()}`,
          type: notifType,
          priority: newStatus === 'suspended' ? 'critical' : 'normal',
          status: 'resolved',
          title: newStatus === 'suspended' ? 'Account suspended' : 'Account reinstated',
          message: `User account "${user.email || user.id}" status changed from "${previousStatus}" to "${newStatus}". Reason: ${reason}`,
          actionLabel: 'View Account',
          actionUrl: `/admin?tab=users&userId=${encodeURIComponent(user.id)}`,
          userId: user.id,
          userEmail: user.email,
          targetUserId: user.id,
          targetEmail: user.email,
          actorUserId: auth.adminUserId,
          actorEmail: auth.adminEmail,
          metadata: { previousStatus, newStatus, reason },
        });
      } catch (notifErr) {
        console.error('[Admin User Status] Notification failed:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `User account status updated to "${newStatus}".`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        accountStatus: updatedUser.accountStatus,
        accountStatusReason: updatedUser.accountStatusReason,
        accountStatusUpdatedAt: updatedUser.accountStatusUpdatedAt,
        accountStatusUpdatedBy: updatedUser.accountStatusUpdatedBy,
      },
      revokedSessionsCount,
    });
  } catch (err) {
    console.error(`[Admin User Status Update Error for "${userId}"]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update account status.',
      },
      { status: 500 }
    );
  }
}

