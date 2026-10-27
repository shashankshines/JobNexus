import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { POST as credentialsHandler } from '../../../app/api/auth/credentials/route';
import { POST as googleAuthHandler } from '../../../app/api/auth/google/route';
import { GET as sessionGetHandler, DELETE as sessionDeleteHandler } from '../../../app/api/auth/session/route';
import {
  GET as savedJobsGetHandler,
  POST as savedJobsPostHandler,
  DELETE as savedJobsDeleteHandler,
} from '../../../app/api/saved-jobs/route';
import {
  resetAuthStore,
  SESSION_COOKIE_NAME,
  createSession,
  validateSession,
  expireSessionForTesting,
  registerCredentialsUser,
  findOrCreateGoogleUser,
  saveJobForUser,
} from '../../auth/server/session.store';
import { isValidApplicationUrl, ANONYMOUS_COMPANY_LABEL } from '../domain/job.masking';

function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

function createMockRequest(url: string, options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}): Request {
  const headers = new Headers(options.headers || {});
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.cookie}`);
  }
  return new Request(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe('JobNexus — Complete Sign In, Sign Up, and Google Login Flow Test Suite', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  // =========================================================================
  // 1. Sign In Flow Tests
  // =========================================================================
  describe('Phase 2 — Sign In Verification', () => {
    it('authenticates existing user with valid credentials, establishes session, and returns secure cookie', async () => {
      // 1. Pre-register a test user
      registerCredentialsUser({
        email: 'alex.rivera@jobnexus.io',
        password: 'Password123!',
        name: 'Alex Rivera',
        role: 'Staff Engineer',
      });

      // 2. Perform Sign In request
      const req = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signin',
          usernameOrEmail: 'alex.rivera@jobnexus.io',
          password: 'Password123!',
        },
      });

      const res = await credentialsHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.email, 'alex.rivera@jobnexus.io');
      assert.strictEqual(data.user.name, 'Alex Rivera');
      assert.strictEqual(data.user.provider, 'credentials');

      // Verify Set-Cookie header contains HttpOnly session token
      const cookieHeader = res.headers.get('set-cookie');
      assert.ok(cookieHeader);
      assert.ok(cookieHeader.includes(SESSION_COOKIE_NAME));
      assert.ok(cookieHeader.includes('HttpOnly'));

      // Validate established session
      const sessionId = extractSessionCookie(res);
      assert.ok(sessionId);
      const sessionValidation = validateSession(sessionId);
      assert.strictEqual(sessionValidation.valid, true);
      assert.strictEqual(sessionValidation.user?.email, 'alex.rivera@jobnexus.io');
    });

    it('rejects incorrect password with 401 and does not reveal internal details', async () => {
      registerCredentialsUser({
        email: 'alex.rivera@jobnexus.io',
        password: 'CorrectPassword123!',
      });

      const req = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signin',
          usernameOrEmail: 'alex.rivera@jobnexus.io',
          password: 'WrongPassword456!',
        },
      });

      const res = await credentialsHandler(req);
      assert.strictEqual(res.status, 401);

      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid email/username or password. Please try again.');
      assert.strictEqual(res.headers.get('set-cookie'), null);
    });

    it('rejects non-existent account with 401 and DOES NOT auto-register', async () => {
      const req = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signin',
          usernameOrEmail: 'nonexistent.user@randomdomain.org',
          password: 'SomePassword123!',
        },
      });

      const res = await credentialsHandler(req);
      assert.strictEqual(res.status, 401);

      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid email/username or password. Please try again.');

      // Verify user was NOT auto-created in store
      const sessionReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signin',
          usernameOrEmail: 'nonexistent.user@randomdomain.org',
          password: 'SomePassword123!',
        },
      });
      const checkRes = await credentialsHandler(sessionReq);
      assert.strictEqual(checkRes.status, 401);
    });

    it('rejects empty and malformed identifier / password fields with 400', async () => {
      // Empty fields
      const emptyReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: { mode: 'signin', usernameOrEmail: '', password: '' },
      });
      const emptyRes = await credentialsHandler(emptyReq);
      assert.strictEqual(emptyRes.status, 400);

      // Malformed email format (double @)
      const malformedReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: { mode: 'signin', usernameOrEmail: 'user@@domain.com', password: 'Password123!' },
      });
      const malformedRes = await credentialsHandler(malformedReq);
      assert.strictEqual(malformedRes.status, 400);

      // Short password (<6 chars)
      const shortPassReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: { mode: 'signin', usernameOrEmail: 'user@domain.com', password: '123' },
      });
      const shortPassRes = await credentialsHandler(shortPassReq);
      assert.strictEqual(shortPassRes.status, 400);
    });

    it('enforces rate limiting on repeated failed authentication attempts', async () => {
      registerCredentialsUser({
        email: 'target.account@domain.com',
        password: 'TargetPassword123!',
      });

      // Execute 6 failed requests (exceeding limit of 5)
      let lastRes: Response | null = null;
      for (let i = 0; i < 7; i++) {
        const req = createMockRequest('http://localhost:3000/api/auth/credentials', {
          method: 'POST',
          body: {
            mode: 'signin',
            usernameOrEmail: 'target.account@domain.com',
            password: 'BadPassword!',
          },
          headers: { 'x-forwarded-for': '198.51.100.22' },
        });
        lastRes = await credentialsHandler(req);
      }

      assert.ok(lastRes);
      assert.strictEqual(lastRes.status, 429);
      const data = await lastRes.json();
      assert.ok(data.error.includes('Too many attempts'));
      assert.ok(lastRes.headers.get('Retry-After'));
    });
  });

  // =========================================================================
  // 2. Sign Up Flow Tests
  // =========================================================================
  describe('Phase 3 — Sign Up Verification', () => {
    it('creates a new account successfully, establishes authenticated session, and allows immediate access', async () => {
      const req = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signup',
          name: 'Sarah Connor',
          usernameOrEmail: 'sarah.connor@cyberdyne.org',
          password: 'SecurePass987!',
          confirmPassword: 'SecurePass987!',
        },
      });

      const res = await credentialsHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.email, 'sarah.connor@cyberdyne.org');
      assert.strictEqual(data.user.name, 'Sarah Connor');
      assert.strictEqual(data.user.initials, 'SC');

      const sessionId = extractSessionCookie(res);
      assert.ok(sessionId);

      // Test session endpoint can read this newly created session
      const sessionReq = createMockRequest('http://localhost:3000/api/auth/session', {
        cookie: sessionId,
      });
      const sessionRes = await sessionGetHandler(sessionReq);
      assert.strictEqual(sessionRes.status, 200);
      const sessionData = await sessionRes.json();
      assert.strictEqual(sessionData.authenticated, true);
      assert.strictEqual(sessionData.user.email, 'sarah.connor@cyberdyne.org');
    });

    it('rejects registration when passwords do not match', async () => {
      const req = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signup',
          name: 'Mismatch User',
          usernameOrEmail: 'mismatch@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword456!',
        },
      });

      const res = await credentialsHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Passwords do not match.');
    });

    it('rejects duplicate registration when an account with the same email already exists', async () => {
      // First registration succeeds
      const firstReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signup',
          name: 'Original Account',
          usernameOrEmail: 'duplicate.test@domain.com',
          password: 'OriginalPass123!',
          confirmPassword: 'OriginalPass123!',
        },
      });
      const firstRes = await credentialsHandler(firstReq);
      assert.strictEqual(firstRes.status, 200);

      // Second registration with same email fails with 409
      const secondReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signup',
          name: 'Second Attempt',
          usernameOrEmail: 'duplicate.test@domain.com',
          password: 'AnotherPass123!',
          confirmPassword: 'AnotherPass123!',
        },
      });
      const secondRes = await credentialsHandler(secondReq);
      assert.strictEqual(secondRes.status, 409);
      const data = await secondRes.json();
      assert.strictEqual(data.error, 'An account with this email or username already exists.');
    });

    it('supports full Password Reset flow and allows subsequent login with new password', async () => {
      // 1. Create initial user
      registerCredentialsUser({
        email: 'reset.flow@jobnexus.io',
        password: 'InitialPassword123!',
        name: 'Reset Flow User',
      });

      // 2. Request password reset
      const resetReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'request-reset',
          usernameOrEmail: 'reset.flow@jobnexus.io',
        },
      });
      const resetReqRes = await credentialsHandler(resetReq);
      assert.strictEqual(resetReqRes.status, 200);
      const resetReqData = await resetReqRes.json();
      assert.strictEqual(resetReqData.success, true);

      // 3. Execute password reset with code and new password
      const resetExecReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'reset-password',
          email: 'reset.flow@jobnexus.io',
          code: '123456',
          newPassword: 'BrandNewPassword456!',
          confirmPassword: 'BrandNewPassword456!',
        },
      });
      const resetExecRes = await credentialsHandler(resetExecReq);
      assert.strictEqual(resetExecRes.status, 200);

      // 4. Verify old password no longer works
      const oldLoginReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signin',
          usernameOrEmail: 'reset.flow@jobnexus.io',
          password: 'InitialPassword123!',
        },
      });
      const oldLoginRes = await credentialsHandler(oldLoginReq);
      assert.strictEqual(oldLoginRes.status, 401);

      // 5. Verify new password signs in successfully
      const newLoginReq = createMockRequest('http://localhost:3000/api/auth/credentials', {
        method: 'POST',
        body: {
          mode: 'signin',
          usernameOrEmail: 'reset.flow@jobnexus.io',
          password: 'BrandNewPassword456!',
        },
      });
      const newLoginRes = await credentialsHandler(newLoginReq);
      assert.strictEqual(newLoginRes.status, 200);
      const newLoginData = await newLoginRes.json();
      assert.strictEqual(newLoginData.success, true);
      assert.strictEqual(newLoginData.user.email, 'reset.flow@jobnexus.io');
    });
  });

  // =========================================================================
  // 3. Google Login Flow Tests
  // =========================================================================
  describe('Phase 4 — Google / Gmail Login Verification', () => {
    // Helper to generate mock Google JWT token
    function createMockGoogleIdToken(payload: Record<string, unknown>): string {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const claims = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const sig = Buffer.from('mock-sig').toString('base64url');
      return `${header}.${claims}.${sig}`;
    }

    it('authenticates Google user with verified token, creates user, and issues secure cookie', async () => {
      const token = createMockGoogleIdToken({
        sub: 'google-sub-12345',
        email: 'sarah.engineer@gmail.com',
        name: 'Sarah Engineer',
        picture: 'https://lh3.googleusercontent.com/avatar1',
        email_verified: true,
      });

      const req = createMockRequest('http://localhost:3000/api/auth/google', {
        method: 'POST',
        body: { credential: token },
      });

      const res = await googleAuthHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.email, 'sarah.engineer@gmail.com');
      assert.strictEqual(data.user.name, 'Sarah Engineer');
      assert.strictEqual(data.user.provider, 'google');

      const sessionId = extractSessionCookie(res);
      assert.ok(sessionId);
      const validation = validateSession(sessionId);
      assert.strictEqual(validation.valid, true);
    });

    it('rejects unverified Google accounts and prevents silent account takeover', async () => {
      // Pre-register user with credentials
      registerCredentialsUser({
        email: 'unverified.target@gmail.com',
        password: 'Password123!',
      });

      // Attacker attempts to login with Google token where email_verified is false
      const unverifiedToken = createMockGoogleIdToken({
        sub: 'malicious-sub-999',
        email: 'unverified.target@gmail.com',
        name: 'Attacker Fake',
        email_verified: false,
      });

      const req = createMockRequest('http://localhost:3000/api/auth/google', {
        method: 'POST',
        body: { credential: unverifiedToken },
      });

      const res = await googleAuthHandler(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('not verified'));
    });

    it('handles returning Google users idempotently without duplicating accounts', async () => {
      const token = createMockGoogleIdToken({
        sub: 'google-sub-returning',
        email: 'returning.dev@gmail.com',
        name: 'Returning Developer',
        email_verified: true,
      });

      // First login
      const req1 = createMockRequest('http://localhost:3000/api/auth/google', {
        method: 'POST',
        body: { credential: token },
      });
      const res1 = await googleAuthHandler(req1);
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();

      // Second login with updated name
      const tokenUpdated = createMockGoogleIdToken({
        sub: 'google-sub-returning',
        email: 'returning.dev@gmail.com',
        name: 'Returning Developer Senior',
        email_verified: true,
      });
      const req2 = createMockRequest('http://localhost:3000/api/auth/google', {
        method: 'POST',
        body: { credential: tokenUpdated },
      });
      const res2 = await googleAuthHandler(req2);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();

      // Same user ID, updated profile
      assert.strictEqual(data1.user.id, data2.user.id);
      assert.strictEqual(data2.user.name, 'Returning Developer Senior');
    });

    it('supports Google account switching without leaking previous user session or saved jobs', async () => {
      // 1. User A logs in with Google and saves a job
      const userA = findOrCreateGoogleUser({
        sub: 'user-a-sub',
        email: 'usera.google@gmail.com',
        name: 'Google User A',
      });
      saveJobForUser(userA.id, {
        id: 'job-a-secret',
        title: 'Security Engineer',
        company: 'Cloudflare',
        url: 'https://cloudflare.com/jobs/sec',
      });

      // 2. User B logs in with Google and saves a different job
      const userB = findOrCreateGoogleUser({
        sub: 'user-b-sub',
        email: 'userb.google@gmail.com',
        name: 'Google User B',
      });
      saveJobForUser(userB.id, {
        id: 'job-b-secret',
        title: 'Platform Engineer',
        company: 'Vercel',
        url: 'https://vercel.com/jobs/plat',
      });

      // 3. User A queries saved jobs
      const userASession = createSession(userA.id);
      const reqA = createMockRequest('http://localhost:3000/api/saved-jobs', {
        cookie: userASession.sessionId,
      });
      const resA = await savedJobsGetHandler(reqA);
      const dataA = await resA.json();
      assert.strictEqual(dataA.savedJobs.length, 1);
      assert.strictEqual(dataA.savedJobs[0].id, 'job-a-secret');

      // 4. User B queries saved jobs
      const userBSession = createSession(userB.id);
      const reqB = createMockRequest('http://localhost:3000/api/saved-jobs', {
        cookie: userBSession.sessionId,
      });
      const resB = await savedJobsGetHandler(reqB);
      const dataB = await resB.json();
      assert.strictEqual(dataB.savedJobs.length, 1);
      assert.strictEqual(dataB.savedJobs[0].id, 'job-b-secret');

      // Strict isolation confirmed
      assert.strictEqual(dataA.savedJobs[0].company, 'Cloudflare');
      assert.strictEqual(dataB.savedJobs[0].company, 'Vercel');
    });
  });

  // =========================================================================
  // 4. Protected Endpoints, Pre-Login & Post-Login Behavior Tests
  // =========================================================================
  describe('Phase 6 & 7 — Protected Endpoints, Session Lifecycle & Authorization', () => {
    it('blocks anonymous access to protected endpoints with 401', async () => {
      // GET saved-jobs without session
      const getReq = createMockRequest('http://localhost:3000/api/saved-jobs');
      const getRes = await savedJobsGetHandler(getReq);
      assert.strictEqual(getRes.status, 401);

      // POST saved-jobs without session
      const postReq = createMockRequest('http://localhost:3000/api/saved-jobs', {
        method: 'POST',
        body: { job: { id: 'test-1', title: 'Role', company: 'Corp', url: 'https://corp.com' } },
      });
      const postRes = await savedJobsPostHandler(postReq);
      assert.strictEqual(postRes.status, 401);

      // DELETE saved-jobs without session
      const delReq = createMockRequest('http://localhost:3000/api/saved-jobs?id=test-1', {
        method: 'DELETE',
      });
      const delRes = await savedJobsDeleteHandler(delReq);
      assert.strictEqual(delRes.status, 401);
    });

    it('rejects expired sessions and invalidates access', async () => {
      const user = registerCredentialsUser({
        email: 'expiry.test@jobnexus.io',
        password: 'Password123!',
      });
      const session = createSession(user.user!.id);

      // Artificially expire the session
      expireSessionForTesting(session.sessionId);

      const req = createMockRequest('http://localhost:3000/api/saved-jobs', {
        cookie: session.sessionId,
      });
      const res = await savedJobsGetHandler(req);
      assert.strictEqual(res.status, 401);
    });

    it('allows authenticated users to save and delete jobs idempotently', async () => {
      const user = registerCredentialsUser({
        email: 'idempotent@jobnexus.io',
        password: 'Password123!',
      });
      const session = createSession(user.user!.id);

      const jobData = {
        id: 'ashby-unique-99',
        title: 'Senior Systems Engineer',
        company: 'Tailscale',
        url: 'https://jobs.ashbyhq.com/tailscale/99',
        location: 'Remote',
      };

      // 1. Save job first time
      const save1Req = createMockRequest('http://localhost:3000/api/saved-jobs', {
        method: 'POST',
        cookie: session.sessionId,
        body: { job: jobData },
      });
      const save1Res = await savedJobsPostHandler(save1Req);
      assert.strictEqual(save1Res.status, 200);
      const save1Data = await save1Res.json();
      assert.strictEqual(save1Data.savedJobs.length, 1);

      // 2. Save same job second time (idempotent, length remains 1)
      const save2Req = createMockRequest('http://localhost:3000/api/saved-jobs', {
        method: 'POST',
        cookie: session.sessionId,
        body: { job: jobData },
      });
      const save2Res = await savedJobsPostHandler(save2Req);
      assert.strictEqual(save2Res.status, 200);
      const save2Data = await save2Res.json();
      assert.strictEqual(save2Data.savedJobs.length, 1);

      // 3. Delete saved job
      const delReq = createMockRequest('http://localhost:3000/api/saved-jobs?id=ashby-unique-99', {
        method: 'DELETE',
        cookie: session.sessionId,
      });
      const delRes = await savedJobsDeleteHandler(delReq);
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.savedJobs.length, 0);
    });

    it('destroys session cleanly on logout and expires cookie', async () => {
      const user = registerCredentialsUser({
        email: 'logout.test@jobnexus.io',
        password: 'Password123!',
      });
      const session = createSession(user.user!.id);

      // Verify active
      const checkReq = createMockRequest('http://localhost:3000/api/auth/session', {
        cookie: session.sessionId,
      });
      const checkRes = await sessionGetHandler(checkReq);
      assert.strictEqual(checkRes.status, 200);
      const checkData = await checkRes.json();
      assert.strictEqual(checkData.authenticated, true);

      // Call DELETE /api/auth/session
      const logoutReq = createMockRequest('http://localhost:3000/api/auth/session', {
        method: 'DELETE',
        cookie: session.sessionId,
      });
      const logoutRes = await sessionDeleteHandler(logoutReq);
      assert.strictEqual(logoutRes.status, 200);

      // Verify cookie is expired (Max-Age=0)
      const cookie = logoutRes.headers.get('set-cookie');
      assert.ok(cookie);
      assert.ok(cookie.includes('Max-Age=0'));

      // Subsequent session check fails
      const afterReq = createMockRequest('http://localhost:3000/api/auth/session', {
        cookie: session.sessionId,
      });
      const afterRes = await sessionGetHandler(afterReq);
      const afterData = await afterRes.json();
      assert.strictEqual(afterData.authenticated, false);
    });
  });

  // =========================================================================
  // 5. URL Validation & Defense-in-Depth
  // =========================================================================
  describe('URL & Access Safety Verification', () => {
    it('validates safe application URLs and rejects unsafe protocols', () => {
      assert.strictEqual(isValidApplicationUrl('https://boards.greenhouse.io/stripe/jobs/1'), true);
      assert.strictEqual(isValidApplicationUrl('https://jobs.ashbyhq.com/linear/2'), true);
      assert.strictEqual(isValidApplicationUrl('http://company.com/careers/3'), true);

      // Malicious or invalid protocols rejected
      assert.strictEqual(isValidApplicationUrl('javascript:alert(1)'), false);
      assert.strictEqual(isValidApplicationUrl('data:text/html,<script>alert(1)</script>'), false);
      assert.strictEqual(isValidApplicationUrl('file:///etc/passwd'), false);
      assert.strictEqual(isValidApplicationUrl(''), false);
      assert.strictEqual(isValidApplicationUrl('not-a-valid-url'), false);
    });

    it('verifies anonymous company label constant', () => {
      assert.strictEqual(ANONYMOUS_COMPANY_LABEL, 'Company undisclosed');
    });
  });
});
