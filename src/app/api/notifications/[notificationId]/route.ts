import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import {
  markNotificationRead,
  dismissNotification,
} from '@/modules/notifications/services/smart-notification.store';

interface RouteContext {
  params: Promise<{ notificationId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to update notification status.' },
      { status: 401 }
    );
  }

  const resolvedParams = await context.params;
  const notificationId = resolvedParams.notificationId;

  if (!notificationId) {
    return NextResponse.json({ error: 'Missing notification ID.' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'read';

    let success = false;
    if (action === 'dismiss') {
      success = await dismissNotification(auth.user.id, notificationId);
    } else {
      success = await markNotificationRead(auth.user.id, notificationId);
    }

    if (!success) {
      return NextResponse.json({ error: 'Notification not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, notificationId, action });
  } catch (error) {
    console.error('[Notification PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update notification status.' },
      { status: 500 }
    );
  }
}
