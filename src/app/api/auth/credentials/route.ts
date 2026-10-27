import { NextResponse } from 'next/server';
import {
  registerCredentialsUser,
  verifyCredentialsUser,
  updateUserPassword,
  createSession,
  checkAuthRateLimit,
} from '@/modules/auth/server/session.store';
import {
  validateCredentialsSignIn,
  validateCredentialsSignUp,
  validatePasswordResetRequest,
  validatePasswordResetExecution,
} from '@/modules/jobs/domain/auth.validation';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('cf-connecting-ip') || '127.0.0.1';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, email, usernameOrEmail, password, name, role, confirmPassword, code, newPassword } = body;

    const identifier = (usernameOrEmail || email || '').trim();
    const clientIp = getClientIp(request);

    // Rate limiting guard
    const rateLimitKey = `auth_cred_${clientIp}_${identifier.toLowerCase()}`;
    const rateCheck = checkAuthRateLimit(rateLimitKey, 6, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateCheck.retryAfterSec} seconds.` },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSec || 60) },
        }
      );
    }

    // 1. Password Reset Request Mode
    if (mode === 'request-reset') {
      const val = validatePasswordResetRequest(identifier);
      if (!val.valid || !val.normalizedIdentifier) {
        return NextResponse.json({ error: val.error || 'Please enter a valid email or username.' }, { status: 400 });
      }

      // Avoid leaking whether account exists: return generic confirmation
      return NextResponse.json({
        success: true,
        message: `If an account exists for ${val.normalizedIdentifier}, a recovery code has been dispatched.`,
        normalizedEmail: val.normalizedIdentifier,
      });
    }

    // 2. Password Reset Execution Mode
    if (mode === 'reset-password') {
      const val = validatePasswordResetExecution({
        email: identifier,
        code: code || '',
        newPassword: newPassword || password || '',
        confirmPassword: confirmPassword || '',
      });

      if (!val.valid) {
        return NextResponse.json({ error: val.error || 'Invalid reset details.' }, { status: 400 });
      }

      const updateRes = updateUserPassword(identifier, newPassword || password);
      if (!updateRes.success) {
        return NextResponse.json({ error: 'Unable to reset password. Please verify your details.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Password successfully reset. You can now sign in with your new password.',
      });
    }

    // 3. Sign Up Mode
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
        return NextResponse.json({ error: regResult.error || 'Unable to create account.' }, { status: 409 });
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

    // 4. Default: Sign In Mode
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
    // Never leak stack traces, secrets, or internal details
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Credentials Auth Error]:', message);
    return NextResponse.json({ error: 'An unexpected authentication error occurred. Please try again.' }, { status: 500 });
  }
}
