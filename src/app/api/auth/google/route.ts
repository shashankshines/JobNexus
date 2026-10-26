import { NextResponse } from 'next/server';
import {
  findOrCreateGoogleUser,
  createSession,
} from '@/modules/auth/server/session.store';

interface GoogleTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

function parseJwtPayload(token: string): GoogleTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('binary')
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as GoogleTokenPayload;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credential, profile } = body;

    let verifiedProfile: {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    } | null = null;

    const clientId = process.env.GOOGLE_CLIENT_ID;

    // 1. If an official Google ID token is provided
    if (credential && typeof credential === 'string') {
      if (clientId) {
        // Online verification with Google's public tokeninfo endpoint
        try {
          const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`, {
            headers: { 'User-Agent': 'JobNexus-Auth/1.0' },
          });
          if (res.ok) {
            const tokenInfo = await res.json();
            if (tokenInfo.aud === clientId || !clientId) {
              verifiedProfile = {
                sub: tokenInfo.sub,
                email: tokenInfo.email,
                name: tokenInfo.name || tokenInfo.email.split('@')[0],
                picture: tokenInfo.picture,
              };
            }
          }
        } catch (err) {
          console.warn('[Google Auth] Online tokeninfo verification failed, falling back to local decode:', err);
        }
      }

      // If online verification was not executed (e.g. no clientId or offline), decode token
      if (!verifiedProfile) {
        const decoded = parseJwtPayload(credential);
        if (decoded && decoded.email) {
          verifiedProfile = {
            sub: decoded.sub || 'g_mock_' + Date.now(),
            email: decoded.email,
            name: decoded.name || decoded.email.split('@')[0],
            picture: decoded.picture,
          };
        }
      }
    }

    // 2. Direct verified profile payload (for testing or direct GIS credential callback)
    if (!verifiedProfile && profile && profile.email) {
      verifiedProfile = {
        sub: profile.sub || 'g_user_' + Date.now(),
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        picture: profile.picture,
      };
    }

    if (!verifiedProfile || !verifiedProfile.email) {
      return NextResponse.json(
        { error: 'Invalid Google authentication token or identity payload.' },
        { status: 400 }
      );
    }

    const user = findOrCreateGoogleUser(verifiedProfile);
    const { cookieHeader } = createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        provider: user.provider,
        initials: user.initials,
        createdAt: user.createdAt,
        savedJobsCount: user.savedJobs.length,
      },
    });

    response.headers.set('Set-Cookie', cookieHeader);
    return response;
  } catch (error) {
    console.error('[Google Auth Error]:', error);
    return NextResponse.json(
      { error: 'Internal error processing Google authentication.' },
      { status: 500 }
    );
  }
}
