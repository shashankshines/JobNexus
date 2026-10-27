import { NextResponse } from 'next/server';
import {
  findOrCreateGoogleUser,
  createSession,
} from '@/modules/auth/server/session.store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?auth_error=${encodeURIComponent(error || 'missing_authorization_code')}`);
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?auth_error=google_oauth_unconfigured`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Google OAuth Callback] Code exchange failed:', errText);
      return NextResponse.redirect(`${appUrl}/?auth_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const { id_token, access_token } = tokenData;

    let profile: {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
      email_verified?: boolean | string;
    } | null = null;

    if (access_token) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (userInfoRes.ok) {
          profile = await userInfoRes.json();
        }
      } catch (e) {
        console.warn('[Google OAuth Callback] Userinfo fetch failed, trying tokeninfo:', e);
      }
    }

    if (!profile && id_token) {
      try {
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
        );
        if (tokenInfoRes.ok) {
          profile = await tokenInfoRes.json();
        }
      } catch (e) {
        console.error('[Google OAuth Callback] Tokeninfo fetch failed:', e);
      }
    }

    if (!profile || !profile.email) {
      return NextResponse.redirect(`${appUrl}/?auth_error=profile_retrieval_failed`);
    }

    const isVerified = profile.email_verified === true || profile.email_verified === 'true';
    if (!isVerified) {
      return NextResponse.redirect(`${appUrl}/?auth_error=email_not_verified`);
    }

    const user = findOrCreateGoogleUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture,
      email_verified: true,
    });

    const { cookieHeader } = createSession(user.id);
    const redirectResponse = NextResponse.redirect(`${appUrl}/?auth_success=google`);
    redirectResponse.headers.set('Set-Cookie', cookieHeader);
    return redirectResponse;
  } catch (err) {
    console.error('[Google OAuth Callback Error]:', err);
    return NextResponse.redirect(`${appUrl}/?auth_error=internal_oauth_error`);
  }
}
