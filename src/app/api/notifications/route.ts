import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import { getUserNotifications } from '@/modules/notifications/services/smart-notification.store';

export async function GET(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to view your notifications.' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const summary = await getUserNotifications(auth.user.id, {
      unreadOnly,
      limit: isNaN(limit) ? 20 : limit,
    });

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('[User Notifications GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve notifications.' },
      { status: 500 }
    );
  }
}
