import { NextResponse } from 'next/server';
import {
  registerCredentialsUser,
  verifyCredentialsUser,
  createSession,
} from '@/modules/auth/server/session.store';
import {
  validateCredentialsSignIn,
  validateCredentialsSignUp,
} from '@/modules/jobs/domain/auth.validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, email, usernameOrEmail, password, name, role, confirmPassword } = body;

    const identifier = (usernameOrEmail || email || '').trim();

    if (mode === 'signup') {
      const val = validateCredentialsSignUp({
        name,
        usernameOrEmail: identifier,
        password,
        confirmPassword,
        role,
      });

      if (!val.valid || !val.normalizedIdentifier) {
        return NextResponse.json({ error: val.error || 'Invalid sign up details.' }, { status: 400 });
      }

      const regResult = registerCredentialsUser({
        email: val.normalizedIdentifier,
        name: val.sanitizedName,
        password,
        role: val.role,
      });

      if (regResult.error || !regResult.user) {
        return NextResponse.json({ error: regResult.error || 'Unable to create account.' }, { status: 400 });
      }

      const { cookieHeader } = createSession(regResult.user.id);
      const response = NextResponse.json({
        success: true,
        user: {
          id: regResult.user.id,
          name: regResult.user.name,
          email: regResult.user.email,
          role: regResult.user.role,
          provider: regResult.user.provider,
          initials: regResult.user.initials,
          createdAt: regResult.user.createdAt,
          savedJobsCount: regResult.user.savedJobs.length,
        },
      });
      response.headers.set('Set-Cookie', cookieHeader);
      return response;
    }

    // Default: sign in
    const val = validateCredentialsSignIn({
      usernameOrEmail: identifier,
      password,
    });

    if (!val.valid || !val.normalizedIdentifier) {
      return NextResponse.json({ error: val.error || 'Invalid sign in details.' }, { status: 400 });
    }

    const verifyResult = verifyCredentialsUser(val.normalizedIdentifier, password);
    if (verifyResult.error || !verifyResult.user) {
      return NextResponse.json({ error: verifyResult.error || 'Invalid credentials.' }, { status: 401 });
    }

    const { cookieHeader } = createSession(verifyResult.user.id);
    const response = NextResponse.json({
      success: true,
      user: {
        id: verifyResult.user.id,
        name: verifyResult.user.name,
        email: verifyResult.user.email,
        role: verifyResult.user.role,
        provider: verifyResult.user.provider,
        initials: verifyResult.user.initials,
        createdAt: verifyResult.user.createdAt,
        savedJobsCount: verifyResult.user.savedJobs.length,
      },
    });
    response.headers.set('Set-Cookie', cookieHeader);
    return response;
  } catch (error) {
    console.error('[Credentials Auth Error]:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
