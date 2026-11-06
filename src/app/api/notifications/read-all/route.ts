import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import { markAllNotificationsRead } from '@/modules/notifications/services/smart-notification.store';

export async function POST(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to update notifications.' },
      { status: 401 }
    );
  }

  try {
    const updatedCount = await markAllNotificationsRead(auth.user.id);
    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('[Notification Read-All Error]:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read.' },
      { status: 500 }
    );
  }
}
