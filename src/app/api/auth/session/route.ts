import { NextResponse } from 'next/server';
import {
  validateSession,
  destroySession,
  extractSessionId,
} from '@/modules/auth/server/session.store';

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
