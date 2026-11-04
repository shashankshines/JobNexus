import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  ADMIN_NOTIFICATION_EMAIL,
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
  AdminNotificationPreferences,
} from '@/modules/notifications/admin-notifications.service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }
  if (auth.adminEmail !== ADMIN_NOTIFICATION_EMAIL) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 403 }
    );
  }

  try {
    const preferences = await getAdminNotificationPreferences(auth.adminEmail);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('[Admin Notifications] Preferences fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load preferences.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }
  if (auth.adminEmail !== ADMIN_NOTIFICATION_EMAIL) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as Partial<AdminNotificationPreferences>;
    const updated = await updateAdminNotificationPreferences(body, auth.adminEmail);
    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    console.error('[Admin Notifications] Preferences update error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to save preferences.';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

