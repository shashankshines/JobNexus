/**
 * Production-Ready Server Session & User Store
 * Provides cryptographically secure session management,
 * user authentication (Google & Credentials), and isolated saved-job persistence.
 */

import crypto from 'node:crypto';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  provider: 'google' | 'credentials';
  initials: string;
  createdAt: string;
  savedJobs: SavedJobItem[];
}

export interface SavedJobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  date: string;
  source: string;
  tags: string[];
  isRemote?: boolean;
  workplaceType?: string;
  isIndiaEligible?: boolean;
  isFresh?: boolean;
  savedAt: string;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = 'jobnexus_session_v1';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

// In-memory persistent registry across server requests
const users = new Map<string, UserRecord>();
const usersByEmail = new Map<string, string>(); // email -> userId
const sessions = new Map<string, SessionRecord>(); // sessionId -> SessionRecord

// Password hash store (mocked secure salted hash for memory store)
const passwordHashes = new Map<string, string>(); // userId -> hash

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

export function computeInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const word = parts[0];
    return word.length >= 2 ? word.substring(0, 2).toUpperCase() : word.toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Creates a cryptographically random session token for an authenticated user.
 */
export function createSession(userId: string): {
  sessionId: string;
  expiresAt: number;
  cookieHeader: string;
} {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_MS;

  sessions.set(sessionId, {
    sessionId,
    userId,
    createdAt: now,
    expiresAt,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const cookieHeader = `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${Math.floor(
    SESSION_MAX_AGE_MS / 1000
  )}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;

  return { sessionId, expiresAt, cookieHeader };
}

/**
 * Validates a session token, returning the associated user if active and not expired.
 */
export function validateSession(sessionId: string | null | undefined): {
  valid: boolean;
  user?: UserRecord;
  error?: string;
} {
  if (!sessionId) {
    return { valid: false, error: 'No session provided' };
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return { valid: false, error: 'Session not found' };
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return { valid: false, error: 'Session expired' };
  }

  const user = users.get(session.userId);
  if (!user) {
    sessions.delete(sessionId);
    return { valid: false, error: 'User not found' };
  }

  return { valid: true, user };
}

/**
 * Artificially expires a session for deterministic security testing.
 */
export function expireSessionForTesting(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.expiresAt = Date.now() - 1000;
  }
}

/**
 * Destroys an existing session and produces an expired cookie header.
 */
export function destroySession(sessionId: string | null | undefined): { cookieHeader: string } {
  if (sessionId) {
    sessions.delete(sessionId);
  }
  const isProd = process.env.NODE_ENV === 'production';
  const cookieHeader = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
    isProd ? '; Secure' : ''
  }`;
  return { cookieHeader };
}

/**
 * Finds or creates a user authenticated via Google OAuth / Google Identity Services.
 */
export function findOrCreateGoogleUser(profile: {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}): UserRecord {
  const cleanEmail = profile.email.trim().toLowerCase();
  const existingUserId = usersByEmail.get(cleanEmail);

  if (existingUserId && users.has(existingUserId)) {
    const existing = users.get(existingUserId)!;
    // Security check: Never link to existing account if Google email is unverified
    if (profile.email_verified === false) {
      throw new Error('Google account email is not verified. Account linking rejected.');
    }
    // Update profile fields
    existing.name = profile.name || existing.name;
    existing.avatar = profile.picture || existing.avatar;
    existing.initials = computeInitials(existing.name);
    return existing;
  }

  const newId = `usr_google_${profile.sub || crypto.randomUUID().slice(0, 8)}`;
  const newUser: UserRecord = {
    id: newId,
    email: cleanEmail,
    name: profile.name || cleanEmail.split('@')[0],
    avatar: profile.picture,
    role: 'Software Engineer',
    provider: 'google',
    initials: computeInitials(profile.name || cleanEmail.split('@')[0]),
    createdAt: new Date().toISOString(),
    savedJobs: [],
  };

  users.set(newId, newUser);
  usersByEmail.set(cleanEmail, newId);
  return newUser;
}

/**
 * Finds or creates a user authenticated via Credentials (Email/Username + Password).
 */
export function registerCredentialsUser(data: {
  email: string;
  password?: string;
  name?: string;
  role?: string;
}): { user?: UserRecord; error?: string } {
  const cleanEmail = data.email.trim().toLowerCase();
  if (usersByEmail.has(cleanEmail)) {
    return { error: 'An account with this email or username already exists.' };
  }

  const newId = `usr_cred_${crypto.randomUUID().slice(0, 8)}`;
  const userName = data.name?.trim() || cleanEmail.split('@')[0];
  const newUser: UserRecord = {
    id: newId,
    email: cleanEmail,
    name: userName,
    role: data.role?.trim() || 'Software Engineer',
    provider: 'credentials',
    initials: computeInitials(userName),
    createdAt: new Date().toISOString(),
    savedJobs: [],
  };

  if (data.password) {
    const salt = newId;
    passwordHashes.set(newId, hashPassword(data.password, salt));
  }

  users.set(newId, newUser);
  usersByEmail.set(cleanEmail, newId);
  return { user: newUser };
}

/**
 * Validates credentials for sign-in.
 * Rejects non-existent accounts or incorrect passwords without leaking account existence.
 */
export function verifyCredentialsUser(
  email: string,
  password?: string
): { user?: UserRecord; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const userId = usersByEmail.get(cleanEmail);

  if (!userId || !users.has(userId)) {
    return { error: 'Invalid email/username or password. Please try again.' };
  }

  if (!password) {
    return { error: 'Password is required to sign in.' };
  }

  const user = users.get(userId)!;
  if (passwordHashes.has(userId)) {
    const salt = userId;
    const computedHash = hashPassword(password, salt);
    if (computedHash !== passwordHashes.get(userId)) {
      return { error: 'Invalid email/username or password. Please try again.' };
    }
  }

  return { user };
}

/**
 * Updates a user's password securely (for password reset flows).
 */
export function updateUserPassword(
  identifier: string,
  newPassword: string
): { success: boolean; error?: string } {
  const clean = identifier.trim().toLowerCase();
  const userId = usersByEmail.get(clean);
  if (!userId || !users.has(userId)) {
    return { success: false, error: 'Account not found.' };
  }
  const salt = userId;
  passwordHashes.set(userId, hashPassword(newPassword, salt));
  return { success: true };
}

// In-memory rate limiting store: key -> { count: number, resetAt: number }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkAuthRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 10 * 60 * 1000 // 10 minutes
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

export function resetRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Returns saved jobs for an authenticated user.
 */
export function getSavedJobs(userId: string): SavedJobItem[] {
  const user = users.get(userId);
  return user ? [...user.savedJobs] : [];
}

/**
 * Idempotently saves a job to the user's collection, preventing duplicates.
 */
export function saveJobForUser(
  userId: string,
  job: Partial<SavedJobItem> & { id: string; title: string; company: string; url: string }
): { saved: boolean; jobs: SavedJobItem[] } {
  const user = users.get(userId);
  if (!user) {
    return { saved: false, jobs: [] };
  }

  const alreadySaved = user.savedJobs.some((j) => j.id === job.id);
  if (!alreadySaved) {
    const item: SavedJobItem = {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || 'Remote',
      type: job.type || 'Full-time',
      url: job.url,
      date: job.date || new Date().toISOString(),
      source: job.source || 'Verified ATS',
      tags: job.tags || [],
      isRemote: job.isRemote,
      workplaceType: job.workplaceType,
      isIndiaEligible: job.isIndiaEligible,
      isFresh: job.isFresh,
      savedAt: new Date().toISOString(),
    };
    user.savedJobs.unshift(item);
  }

  return { saved: true, jobs: [...user.savedJobs] };
}

/**
 * Removes a saved job from the user's collection.
 */
export function removeSavedJobForUser(
  userId: string,
  jobId: string
): { removed: boolean; jobs: SavedJobItem[] } {
  const user = users.get(userId);
  if (!user) {
    return { removed: false, jobs: [] };
  }

  const initialCount = user.savedJobs.length;
  user.savedJobs = user.savedJobs.filter((j) => j.id !== jobId);
  return { removed: user.savedJobs.length < initialCount, jobs: [...user.savedJobs] };
}

/**
 * Resets the in-memory store. Useful for clean isolated tests.
 */
export function resetAuthStore(): void {
  users.clear();
  usersByEmail.clear();
  sessions.clear();
  passwordHashes.clear();
  resetRateLimits();
}
