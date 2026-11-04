import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  ADMIN_NOTIFICATION_EMAIL,
  listAdminNotifications,
  markAdminNotification,
  markAllAdminNotificationsRead,
  NotificationPriority,
  NotificationStatus,
} from '@/modules/notifications/admin-notifications.service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }
  if (auth.adminEmail !== ADMIN_NOTIFICATION_EMAIL) {
    return NextResponse.json(
      { success: false, error: 'This notification inbox is assigned to the designated administrator account.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 50;
    const status = (searchParams.get('status') as NotificationStatus | 'all') || undefined;
    const priority = (searchParams.get('priority') as NotificationPriority | 'all') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const result = await listAdminNotifications({
      limit,
      status,
      priority,
      cursor,
      unreadOnly,
    });

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.totalUnread,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    console.error('[Admin Notifications] Failed to load inbox:', error);
    return NextResponse.json({ success: false, error: 'Unable to load admin notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }
  if (auth.adminEmail !== ADMIN_NOTIFICATION_EMAIL) {
    return NextResponse.json(
      { success: false, error: 'This notification inbox is assigned to the designated administrator account.' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      action?: 'read' | 'actioned' | 'acknowledged' | 'resolved' | 'mark_all_read';
    };

    if (body.action === 'mark_all_read') {
      const count = await markAllAdminNotificationsRead(auth.adminEmail);
      return NextResponse.json({ success: true, count, message: `${count} notifications marked as read.` });
    }

    if (!body.id || !['read', 'actioned', 'acknowledged', 'resolved'].includes(body.action || '')) {
      return NextResponse.json(
        { success: false, error: 'A valid notification id and action are required.' },
        { status: 400 }
      );
    }

    const updated = await markAdminNotification(
      body.id,
      body.action as 'read' | 'actioned' | 'acknowledged' | 'resolved',
      auth.adminEmail
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Notification not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    console.error('[Admin Notifications] Failed to update inbox item:', error);
    return NextResponse.json({ success: false, error: 'Unable to update notification.' }, { status: 500 });
  }
}
