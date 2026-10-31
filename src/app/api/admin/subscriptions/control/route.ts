import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  adminManualGrantSubscriptionInTransaction,
  adminExtendSubscriptionInTransaction,
  adminSuspendSubscriptionInTransaction,
  adminReinstateSubscriptionInTransaction,
  adminRevokeSubscriptionInTransaction,
  adminTerminateSubscriptionInTransaction,
  MandatoryReasonMissingError,
} from '@/modules/storage/firestore/admin-billing.store';
import { getUserByEmail } from '@/modules/auth/server/session.store';

/**
 * POST /api/admin/subscriptions/control
 * Unified manual entitlement management endpoint:
 * - action: 'grant' | 'extend' | 'suspend' | 'reinstate' | 'terminate' | 'revoke'
 * - targetUserId: string
 * - reason: string (MANDATORY)
 * - days?: number (for grant or extend, default 30)
 * - extendDays?: number (optional extra days when reinstating)
 *
 * Invariants:
 * 1. Requires authorized Google OAuth admin.
 * 2. Mandatory reason required for every action.
 * 3. Never fabricates payment records, orders, or UTRs.
 * 4. Strictly records append-only audit log in admin_audit_logs.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
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
  let targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const days = typeof body.days === 'number' ? body.days : Number(body.days) || 30;
  const extendDays = typeof body.extendDays === 'number' ? body.extendDays : undefined;

  // If administrator provided an email address instead of a raw userId, resolve it
  if (targetUserId.includes('@')) {
    const userByMail = getUserByEmail(targetUserId);
    if (userByMail) {
      targetUserId = userByMail.id;
    }
  }

  if (!targetUserId) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: targetUserId.' },
      { status: 400 }
    );
  }

  if (!reason) {
    return NextResponse.json(
      { success: false, error: 'A mandatory administrative reason is required.' },
      { status: 400 }
    );
  }

  try {
    let result;
    switch (action) {
      case 'grant':
        result = await adminManualGrantSubscriptionInTransaction({
          targetUserId,
          adminEmail: auth.adminEmail,
          adminUserId: auth.adminUserId,
          days,
          reason,
        });
        break;

      case 'extend':
        result = await adminExtendSubscriptionInTransaction({
          targetUserId,
          adminEmail: auth.adminEmail,
          adminUserId: auth.adminUserId,
          days,
          reason,
        });
        break;

      case 'suspend':
        result = await adminSuspendSubscriptionInTransaction({
          targetUserId,
          adminEmail: auth.adminEmail,
          adminUserId: auth.adminUserId,
          reason,
        });
        break;

      case 'reinstate':
        result = await adminReinstateSubscriptionInTransaction({
          targetUserId,
          adminEmail: auth.adminEmail,
          adminUserId: auth.adminUserId,
          reason,
          extendDays,
        });
        break;

      case 'terminate':
        result = await adminTerminateSubscriptionInTransaction({
          targetUserId,
          adminEmail: auth.adminEmail,
          adminUserId: auth.adminUserId,
          reason,
        });
        break;

      case 'revoke':
        result = await adminRevokeSubscriptionInTransaction({
          targetUserId,
          adminEmail: auth.adminEmail,
          adminUserId: auth.adminUserId,
          reason,
        });
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid action "${action}". Allowed: grant, extend, suspend, reinstate, terminate, revoke.`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      subscription: result,
      message: `Successfully executed "${action}" on user "${targetUserId}".`,
    });
  } catch (err) {
    if (err instanceof MandatoryReasonMissingError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }

    console.error(`[Admin Subscription Control Error (${action})]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : `Failed to execute action "${action}".`,
      },
      { status: 500 }
    );
  }
}

