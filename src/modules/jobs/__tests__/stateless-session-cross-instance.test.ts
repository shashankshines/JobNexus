import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  createSession,
  validateSession,
  destroySession,
  expireSessionForTesting,
  resetAuthStore,
  findOrCreateGoogleUser,
  registerCredentialsUser,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/server/session.store';
import {
  authorizeAdminRequest,
  isAllowedAdminEmail,
  parseAdminEmails,
  DESIGNATED_ADMIN_EMAIL,
} from '@/modules/auth/server/admin.auth';
import { GET as savedJobsGetHandler } from '@/app/api/saved-jobs/route';

describe('Stateless Cryptographic Sessions & Cross-Instance Serverless Verification', () => {
  beforeEach(() => {
    resetAuthStore();
    delete process.env.ADMIN_EMAILS;
  });

  describe('1. Cross-Instance Token Verification', () => {
    it('generates an HMAC-SHA256 signed stateless session token', () => {
      const user = findOrCreateGoogleUser({
        sub: 'google_user_123',
        email: 'developer@example.com',
        name: 'Jane Developer',
        email_verified: true,
      });

      const { sessionId, cookieHeader } = createSession(user.id);

      assert.ok(sessionId.includes('.'), 'Session token must be dot-delimited signed token');
      assert.ok(cookieHeader.includes(SESSION_COOKIE_NAME));
      assert.ok(cookieHeader.includes(sessionId));

      // Fast-path in-memory validation
      const auth = validateSession(sessionId);
      assert.strictEqual(auth.valid, true);
      assert.strictEqual(auth.user?.email, 'developer@example.com');
      assert.strictEqual(auth.user?.name, 'Jane Developer');
      assert.strictEqual(auth.user?.provider, 'google');
    });

    it('successfully restores session on a simulated separate serverless instance with empty memory/tmp', () => {
      // Instance A: User signs in
      const user = findOrCreateGoogleUser({
        sub: 'google_user_instance_a',
        email: 'shashankshines@gmail.com',
        name: 'Shashank Admin',
        email_verified: true,
      });
      const { sessionId } = createSession(user.id);

      // Simulate Instance B: A fresh Lambda container with completely separate memory
      resetAuthStore();

      // Instance B receives the session cookie
      const authOnInstanceB = validateSession(sessionId);
      assert.strictEqual(authOnInstanceB.valid, true);
      assert.strictEqual(authOnInstanceB.user?.email, 'shashankshines@gmail.com');
      assert.strictEqual(authOnInstanceB.user?.name, 'Shashank Admin');
      assert.strictEqual(authOnInstanceB.user?.provider, 'google');
      assert.strictEqual(authOnInstanceB.user?.accountStatus, 'active');
    });

    it('rejects tampered or malformed signed tokens', () => {
      const user = registerCredentialsUser({
        email: 'valid@example.com',
        password: 'ValidPassword123!',
      });
      const { sessionId } = createSession(user.user!.id);

      const [payload, sig] = sessionId.split('.');
      // Tamper with signature
      const tamperedSig = sig.slice(0, -2) + 'ff';
      const tamperedToken = `${payload}.${tamperedSig}`;

      resetAuthStore();
      const auth = validateSession(tamperedToken);
      assert.strictEqual(auth.valid, false);
      assert.strictEqual(auth.error, 'Session not found');
    });

    it('correctly reports session expired for expired signed tokens', () => {
      const user = registerCredentialsUser({
        email: 'test@example.com',
        password: 'Password123!',
      });
      const { sessionId } = createSession(user.user!.id);

      expireSessionForTesting(sessionId);
      const auth = validateSession(sessionId);
      assert.strictEqual(auth.valid, false);
      assert.strictEqual(auth.error, 'Session expired');
    });

    it('invalidates revoked session token on logout', () => {
      const user = registerCredentialsUser({
        email: 'logout@example.com',
        password: 'Password123!',
      });
      const { sessionId } = createSession(user.user!.id);

      const { cookieHeader } = destroySession(sessionId);
      assert.ok(cookieHeader.includes('Max-Age=0'));

      const auth = validateSession(sessionId);
      assert.strictEqual(auth.valid, false);
    });
  });

  describe('2. Designated Admin Default Allowlist & Multi-Instance Admin Authorization', () => {
    it('authorizes designated administrator shashankshines@gmail.com when ADMIN_EMAILS is unset in production', async () => {
      delete process.env.ADMIN_EMAILS;

      assert.strictEqual(isAllowedAdminEmail(DESIGNATED_ADMIN_EMAIL), true);
      assert.strictEqual(isAllowedAdminEmail('shashankshines@gmail.com'), true);
      assert.strictEqual(isAllowedAdminEmail('unauthorized@example.com'), false);

      const parsed = parseAdminEmails();
      assert.strictEqual(parsed.has(DESIGNATED_ADMIN_EMAIL), true);
    });

    it('authorizes admin request seamlessly across cold serverless instances', async () => {
      // Instance A: Admin signs in with Google
      const admin = findOrCreateGoogleUser({
        sub: 'google_admin_999',
        email: DESIGNATED_ADMIN_EMAIL,
        name: 'Designated Administrator',
        email_verified: true,
      });
      const { sessionId } = createSession(admin.id);

      // Simulate Instance B: Separate container
      resetAuthStore();

      const mockRequest = new Request('https://jobnexus-world.vercel.app/api/admin/overview', {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });

      const auth = await authorizeAdminRequest(mockRequest);
      assert.strictEqual(auth.authorized, true);
      assert.strictEqual(auth.statusCode, 200);
      if (auth.authorized) {
        assert.strictEqual(auth.adminEmail, DESIGNATED_ADMIN_EMAIL);
      }
    });

    it('denies admin request if user is not Google provider even if email matches', async () => {
      const credUser = registerCredentialsUser({
        email: DESIGNATED_ADMIN_EMAIL,
        password: 'Password123!',
      });
      const { sessionId } = createSession(credUser.user!.id);

      // Simulate Instance B
      resetAuthStore();

      const mockRequest = new Request('https://jobnexus-world.vercel.app/api/admin/overview', {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });

      const auth = await authorizeAdminRequest(mockRequest);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.statusCode, 403);
    });
  });

  describe('3. Saved Jobs Authorization Across Serverless Instances', () => {
    it('authorizes GET /api/saved-jobs seamlessly on cold serverless instances without 401 error', async () => {
      // Instance A: User signs in
      const user = findOrCreateGoogleUser({
        sub: 'sub_12345',
        email: 'candidate@example.com',
        name: 'Alex Candidate',
        email_verified: true,
      });
      const { sessionId } = createSession(user.id);

      // Instance B: Cold serverless container receives GET /api/saved-jobs
      resetAuthStore();

      const request = new Request('https://jobnexus-world.vercel.app/api/saved-jobs', {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });

      const response = await savedJobsGetHandler(request);
      assert.strictEqual(response.status, 200);

      const body = await response.json();
      assert.deepStrictEqual(body.savedJobs, []);
    });

    it('returns 401 when GET /api/saved-jobs has no session cookie', async () => {
      const request = new Request('https://jobnexus-world.vercel.app/api/saved-jobs');
      const response = await savedJobsGetHandler(request);
      assert.strictEqual(response.status, 401);
    });
  });
});

