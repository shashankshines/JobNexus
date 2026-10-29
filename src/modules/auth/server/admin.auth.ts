/**
 * Production Server-Side Admin Authorization Helper
 * Enforces strict security invariants:
 * 1. Cryptographically valid active session.
 * 2. Mandatory Google OAuth provider (`user.provider === 'google'`).
 * 3. Server-side email allowlist check (`process.env.ADMIN_EMAILS`).
 * 4. Never trusts client-supplied headers or role claims.
 */

import { extractSessionId, validateSession, UserRecord } from './session.store';

export type AdminAuthResult =
  | {
      authorized: true;
      statusCode: 200;
      user: UserRecord;
      adminEmail: string;
      adminUserId: string;
    }
  | {
      authorized: false;
      statusCode: 401 | 403;
      error: string;
      user?: UserRecord;
    };

/**
 * Parses and normalizes the server-controlled ADMIN_EMAILS allowlist.
 * Handles comma-delimited strings, whitespace trimming, and optional surrounding quotes.
 * Case-insensitive (normalized to lowercase).
 * Fails closed if ADMIN_EMAILS is unset or empty.
 */
export function parseAdminEmails(envValue?: string): Set<string> {
  const raw = envValue !== undefined ? envValue : (process.env.ADMIN_EMAILS || '');
  const unquoted = raw.trim().replace(/^["']|["']$/g, '');
  if (!unquoted) {
    return new Set<string>();
  }

  const parts = unquoted.split(',');
  const normalized = new Set<string>();
  for (const part of parts) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed) {
      normalized.add(trimmed);
    }
  }

  return normalized;
}

/**
 * Checks whether an email address is explicitly authorized as an administrator.
 */
export function isAllowedAdminEmail(email?: string | null, envValue?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const allowlist = parseAdminEmails(envValue);
  return allowlist.has(email.trim().toLowerCase());
}

/**
 * Strictly authorizes an incoming HTTP Request for administrative access.
 * Returns typed result with statusCode and error message for fast response crafting.
 */
export async function authorizeAdminRequest(request?: Request | null): Promise<AdminAuthResult> {
  if (!request) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: No request context provided.',
    };
  }

  const sessionId = extractSessionId(request);
  if (!sessionId) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Authentication required. No active session token found.',
    };
  }

  const validation = validateSession(sessionId);
  if (!validation.valid || !validation.user) {
    return {
      authorized: false,
      statusCode: 401,
      error: validation.error
        ? `Unauthorized: ${validation.error}.`
        : 'Unauthorized: Active session expired or invalid.',
    };
  }

  const { user } = validation;

  // Security Invariant 1: Google OAuth provider is required for administrative operations
  if (user.provider !== 'google') {
    return {
      authorized: false,
      statusCode: 403,
      error: 'Forbidden: Admin access strictly requires Google OAuth authentication.',
      user,
    };
  }

  // Security Invariant 2: Explicit email allowlist check
  if (!isAllowedAdminEmail(user.email)) {
    return {
      authorized: false,
      statusCode: 403,
      error: `Forbidden: User "${user.email}" is not authorized as a JobNexus administrator.`,
      user,
    };
  }

  return {
    authorized: true,
    statusCode: 200,
    user,
    adminEmail: user.email.trim().toLowerCase(),
    adminUserId: user.id,
  };
}

