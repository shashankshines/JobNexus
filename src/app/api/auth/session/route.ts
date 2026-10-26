import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  validateSession,
  destroySession,
} from '@/modules/auth/server/session.store';

function extractSessionId(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  return match ? match.split('=')[1] : null;
}

export async function GET(request: Request) {
  const sessionId = extractSessionId(request);
  const result = validateSession(sessionId);

  if (!result.valid || !result.user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      avatar: result.user.avatar,
      role: result.user.role,
      provider: result.user.provider,
      initials: result.user.initials,
      createdAt: result.user.createdAt,
      savedJobsCount: result.user.savedJobs.length,
    },
  });
}

export async function DELETE(request: Request) {
  const sessionId = extractSessionId(request);
  const { cookieHeader } = destroySession(sessionId);

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', cookieHeader);
  return response;
}
