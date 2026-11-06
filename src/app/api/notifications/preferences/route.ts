import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/modules/notifications/services/smart-notification.store';
import { NotificationMode } from '@/modules/notifications/domain/smart-notification.types';

export async function GET(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to manage job notification preferences.' },
      { status: 401 }
    );
  }

  try {
    const preferences = await getNotificationPreferences(auth.user.id);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('[Notification Preferences GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve notification preferences.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to manage job notification preferences.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const updates: {
      enabled?: boolean;
      mode?: NotificationMode;
      timezone?: string;
      startTime?: string;
      endTime?: string;
      activeDays?: number[];
    } = {};

    if (typeof body.enabled === 'boolean') {
      updates.enabled = body.enabled;
    }

    if (body.mode === 'instant' || body.mode === 'scheduled' || body.mode === 'digest') {
      updates.mode = body.mode;
    }

    if (typeof body.timezone === 'string' && body.timezone.trim().length > 0) {
      updates.timezone = body.timezone.trim();
    }

    if (typeof body.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime)) {
      updates.startTime = body.startTime;
    }

    if (typeof body.endTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime)) {
      updates.endTime = body.endTime;
    }

    if (Array.isArray(body.activeDays)) {
      updates.activeDays = body.activeDays.filter(
        (d: unknown) => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7
      );
    }

    const preferences = await updateNotificationPreferences(auth.user.id, updates);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('[Notification Preferences PUT Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences.' },
      { status: 500 }
    );
  }
}
