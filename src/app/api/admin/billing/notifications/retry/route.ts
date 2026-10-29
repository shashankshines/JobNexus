import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { retryNotificationById } from '@/modules/email/email.service';

/**
 * POST /api/admin/billing/notifications/retry
 * Manual retry endpoint for failed/undelivered transactional notifications.
 * Gated strictly to authorized administrators (shashankshines@gmail.com).
 * Records an immutable audit log upon retry execution.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  let body: { notificationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const notificationId = (body?.notificationId || '').trim();
  if (!notificationId) {
    return NextResponse.json(
      { success: false, error: 'notificationId is required.' },
      { status: 400 }
    );
  }

  try {
    const result = await retryNotificationById(notificationId, auth.adminEmail!);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.error || 'Failed to dispatch notification retry.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      message: 'Notification retry processed successfully.',
    });
  } catch (err) {
    console.error('[Admin Notifications Retry Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error while retrying notification.',
      },
      { status: 500 }
    );
  }
}

