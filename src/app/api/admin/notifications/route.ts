import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { listAdminNotifications, markAdminNotification } from '@/modules/notifications/admin-notifications.service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });

  try {
    const { searchParams } = new URL(request.url);
    const notifications = await listAdminNotifications({
      limit: Number(searchParams.get('limit')) || 50,
      unreadOnly: searchParams.get('unreadOnly') === 'true',
    });
    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
    });
  } catch (error) {
    console.error('[Admin Notifications] Failed to load inbox:', error);
    return NextResponse.json({ success: false, error: 'Unable to load admin notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });

  try {
    const body = await request.json() as { id?: string; action?: 'read' | 'actioned' };
    if (!body.id || !['read', 'actioned'].includes(body.action || '')) {
      return NextResponse.json({ success: false, error: 'A valid notification id and action are required.' }, { status: 400 });
    }
    const updated = await markAdminNotification(body.id, body.action!);
    if (!updated) return NextResponse.json({ success: false, error: 'Notification not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Notifications] Failed to update inbox item:', error);
    return NextResponse.json({ success: false, error: 'Unable to update notification.' }, { status: 500 });
  }
}
