import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  createSession,
  validateSession,
  findOrCreateGoogleUser,
  registerCredentialsUser,
  destroySession,
  expireSessionForTesting,
  resetAuthStore,
  SESSION_COOKIE_NAME,
  extractSessionId,
} from '../../auth/server/session.store';
import {
  isCompanyMasked,
  isSourceMasked,
  ANONYMOUS_COMPANY_LABEL,
  ANONYMOUS_SOURCE_LABEL,
} from '../domain/job.masking';
import { GET as jobsRouteHandler } from '../../../app/api/jobs/route';
import { GET as statsRouteHandler } from '../../../app/api/jobs/stats/route';
import { GET as savedJobsGetHandler, POST as savedJobsPostHandler } from '../../../app/api/saved-jobs/route';

describe('JobNexus — P0 Bug Fix: Authenticated Job Visibility Transition Suite', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  // Helper to create an authenticated session and cookie header
  function createTestAuthenticatedCookie(email = 'test.user@jobnexus.dev', name = 'Test User'): {
    sessionId: string;
    cookieHeader: string;
    userId: string;
  } {
    const user = findOrCreateGoogleUser({
      sub: 'sub_' + Buffer.from(email).toString('hex').slice(0, 16),
      email,
      name,
      picture: 'https://example.com/avatar.png',
    });
    const session = createSession(user.id);
    return {
      sessionId: session.sessionId,
      cookieHeader: `${SESSION_COOKIE_NAME}=${session.sessionId}`,
      userId: user.id,
    };
  }

  // =========================================================================
  // 1. Anonymous Users: Data Boundary Masking
  // =========================================================================
  describe('1. Anonymous Users Receive Masked Fields', () => {
    it('returns masked company and source fields when no session is provided', async () => {
      const request = new Request('http://localhost:3000/api/jobs');
      const response = await jobsRouteHandler(request);
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(Array.isArray(data.jobs));
      assert.ok(data.jobs.length > 0);

      for (const job of data.jobs.slice(0, 10)) {
        assert.strictEqual(job.company, ANONYMOUS_COMPANY_LABEL);
        assert.strictEqual(isCompanyMasked(job.company), true);
        assert.strictEqual(job.source, ANONYMOUS_SOURCE_LABEL);
        assert.strictEqual(isSourceMasked(job.source), true);
        assert.strictEqual(job.url, '');
      }

      assert.deepStrictEqual(data.sources, []);
      assert.strictEqual(data.diagnostics, undefined);
    });

    it('returns masked fields for single job queries when unauthenticated', async () => {
      // First get a valid job ID
      const allJobsRes = await jobsRouteHandler(new Request('http://localhost:3000/api/jobs'));
      const allData = await allJobsRes.json();
      const testJobId = allData.jobs[0].id;

      const singleReq = new Request(`http://localhost:3000/api/jobs?id=${encodeURIComponent(testJobId)}`);
      const singleRes = await jobsRouteHandler(singleReq);
      assert.strictEqual(singleRes.status, 200);

      const singleData = await singleRes.json();
      assert.strictEqual(singleData.job.id, testJobId);
      assert.strictEqual(singleData.job.company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(singleData.job.source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(singleData.job.url, '');
    });

    it('returns masked provider stats for anonymous users', async () => {
      const req = new Request('http://localhost:3000/api/jobs/stats');
      const res = await statsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(data.totalJobs > 0);
      assert.ok(data.sources.every((s: string) => s === 'Job source hidden'));
      assert.deepStrictEqual(data.providerBreakdown, {});
    });
  });

  // =========================================================================
  // 2. Authenticated Users: Full Real Fields
  // =========================================================================
  describe('2. Authenticated Sessions Receive Real Company and Source Fields', () => {
    it('returns real company names, provider sources, and application URLs with session cookie', async () => {
      const { cookieHeader } = createTestAuthenticatedCookie();

      const request = new Request('http://localhost:3000/api/jobs', {
        headers: { Cookie: cookieHeader },
      });
      const response = await jobsRouteHandler(request);
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(Array.isArray(data.jobs));
      assert.ok(data.jobs.length > 0);

      const sample = data.jobs.slice(0, 10);
      for (const job of sample) {
        assert.notStrictEqual(job.company, ANONYMOUS_COMPANY_LABEL);
        assert.strictEqual(isCompanyMasked(job.company), false);
        assert.ok(job.company.length > 0);

        assert.notStrictEqual(job.source, ANONYMOUS_SOURCE_LABEL);
        assert.strictEqual(isSourceMasked(job.source), false);
        assert.ok(job.source.length > 0);

        assert.ok(job.url && job.url.startsWith('http'), `Expected valid URL for job: ${job.id}`);
      }

      assert.ok(Array.isArray(data.sources));
      assert.ok(data.sources.length > 0);
      assert.ok(!data.sources.includes('Job source hidden'));
      assert.ok(Array.isArray(data.diagnostics));
    });

    it('returns real fields when authenticated via Authorization Bearer header', async () => {
      const { sessionId } = createTestAuthenticatedCookie('bearer.user@jobnexus.dev');

      const request = new Request('http://localhost:3000/api/jobs', {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const response = await jobsRouteHandler(request);
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(data.jobs.length > 0);
      assert.strictEqual(isCompanyMasked(data.jobs[0].company), false);
      assert.strictEqual(isSourceMasked(data.jobs[0].source), false);
      assert.ok(data.jobs[0].url.length > 0);
    });

    it('returns real unmasked fields for single job query when authenticated', async () => {
      const { cookieHeader } = createTestAuthenticatedCookie();

      const allJobsRes = await jobsRouteHandler(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      const allData = await allJobsRes.json();
      const testJob = allData.jobs[0];

      const singleReq = new Request(`http://localhost:3000/api/jobs?id=${encodeURIComponent(testJob.id)}`, {
        headers: { Cookie: cookieHeader },
      });
      const singleRes = await jobsRouteHandler(singleReq);
      assert.strictEqual(singleRes.status, 200);

      const singleData = await singleRes.json();
      assert.strictEqual(singleData.job.id, testJob.id);
      assert.strictEqual(singleData.job.company, testJob.company);
      assert.strictEqual(isCompanyMasked(singleData.job.company), false);
      assert.strictEqual(singleData.job.source, testJob.source);
      assert.strictEqual(isSourceMasked(singleData.job.source), false);
      assert.strictEqual(singleData.job.url, testJob.url);
    });

    it('returns real provider statistics and breakdown for authenticated sessions', async () => {
      const { cookieHeader } = createTestAuthenticatedCookie();

      const req = new Request('http://localhost:3000/api/jobs/stats', {
        headers: { Cookie: cookieHeader },
      });
      const res = await statsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(data.totalJobs > 0);
      assert.ok(data.sources.length > 0);
      assert.ok(!data.sources.includes('Job source hidden'));
      assert.ok(Object.keys(data.providerBreakdown).length > 0);
    });
  });

  // =========================================================================
  // 3. Stale Anonymous Cache Cannot Keep Fields Masked After Login
  // =========================================================================
  describe('3. Cache Transition: Immediate Unmasking Upon Login', () => {
    it('immediately unmasks company and source when transitioning from anonymous to authenticated', async () => {
      // Step A: Anonymous request
      const anonReq = new Request('http://localhost:3000/api/jobs?limit=5');
      const anonRes = await jobsRouteHandler(anonReq);
      const anonData = await anonRes.json();
      assert.strictEqual(anonData.jobs[0].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(anonData.jobs[0].source, ANONYMOUS_SOURCE_LABEL);

      // Step B: User signs in and receives session
      const { cookieHeader } = createTestAuthenticatedCookie('login.transition@jobnexus.dev');

      // Step C: Subsequent request with cookie must NOT return cached masked data
      const authReq = new Request('http://localhost:3000/api/jobs?limit=5', {
        headers: {
          Cookie: cookieHeader,
          'Cache-Control': 'no-cache',
        },
      });
      const authRes = await jobsRouteHandler(authReq);
      const authData = await authRes.json();

      assert.strictEqual(isCompanyMasked(authData.jobs[0].company), false);
      assert.notStrictEqual(authData.jobs[0].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(isSourceMasked(authData.jobs[0].source), false);
      assert.notStrictEqual(authData.jobs[0].source, ANONYMOUS_SOURCE_LABEL);
      assert.ok(authData.jobs[0].url.length > 0);
    });

    it('shared global registry persists credentials user across separate route executions', async () => {
      // Register user via credentials store
      const regResult = registerCredentialsUser({
        email: 'global.check@jobnexus.dev',
        name: 'Global Check',
        password: 'Password123!',
      });
      assert.ok(regResult.user);

      const session = createSession(regResult.user.id);
      const cookieHeader = `${SESSION_COOKIE_NAME}=${session.sessionId}`;

      // Simulate separate route execution verifying session via extractSessionId and validateSession
      const extracted = extractSessionId(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      assert.strictEqual(extracted, session.sessionId);

      const auth = validateSession(extracted);
      assert.strictEqual(auth.valid, true);
      assert.strictEqual(auth.user?.id, regResult.user.id);

      // Route handler verifies unmasked data
      const res = await jobsRouteHandler(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      const data = await res.json();
      assert.strictEqual(isCompanyMasked(data.jobs[0].company), false);
    });
  });

  // =========================================================================
  // 4. Invalid or Expired Sessions Cannot Access Full Fields
  // =========================================================================
  describe('4. Invalid or Expired Sessions Fall Back to Masked State', () => {
    it('masks fields when session token is invalid or non-existent', async () => {
      const invalidCookie = `${SESSION_COOKIE_NAME}=non-existent-uuid-token`;
      const req = new Request('http://localhost:3000/api/jobs', {
        headers: { Cookie: invalidCookie },
      });
      const res = await jobsRouteHandler(req);
      const data = await res.json();

      assert.strictEqual(data.jobs[0].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(data.jobs[0].source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(data.jobs[0].url, '');
      assert.deepStrictEqual(data.sources, []);
    });

    it('masks fields when session has expired', async () => {
      const { sessionId, cookieHeader } = createTestAuthenticatedCookie('expired@jobnexus.dev');

      // Verify active first
      const beforeRes = await jobsRouteHandler(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      const beforeData = await beforeRes.json();
      assert.strictEqual(isCompanyMasked(beforeData.jobs[0].company), false);

      // Artificially expire the session in the store
      expireSessionForTesting(sessionId);

      // Subsequent request must be masked
      const afterRes = await jobsRouteHandler(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      const afterData = await afterRes.json();
      assert.strictEqual(afterData.jobs[0].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(afterData.jobs[0].source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(afterData.jobs[0].url, '');
      assert.deepStrictEqual(afterData.sources, []);
    });

    it('masks fields when cookie format is malformed', async () => {
      const malformedCookie = `${SESSION_COOKIE_NAME}=""`;
      const req = new Request('http://localhost:3000/api/jobs', {
        headers: { Cookie: malformedCookie },
      });
      const res = await jobsRouteHandler(req);
      const data = await res.json();
      assert.strictEqual(data.jobs[0].company, ANONYMOUS_COMPANY_LABEL);
    });
  });

  // =========================================================================
  // 5. Logout Restores Masking
  // =========================================================================
  describe('5. Logout Restores Anonymous Masking', () => {
    it('restores masked state immediately after session is destroyed', async () => {
      const { sessionId, cookieHeader } = createTestAuthenticatedCookie('logout.test@jobnexus.dev');

      // 1. Authenticated
      const authRes = await jobsRouteHandler(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      const authData = await authRes.json();
      assert.strictEqual(isCompanyMasked(authData.jobs[0].company), false);

      // 2. Destroy session (simulate logout)
      destroySession(sessionId);

      // 3. Next request with old cookie or cleared cookie returns masked fields
      const postLogoutRes = await jobsRouteHandler(
        new Request('http://localhost:3000/api/jobs', { headers: { Cookie: cookieHeader } })
      );
      const postLogoutData = await postLogoutRes.json();
      assert.strictEqual(postLogoutData.jobs[0].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(postLogoutData.jobs[0].source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(postLogoutData.jobs[0].url, '');
      assert.deepStrictEqual(postLogoutData.sources, []);
    });
  });

  // =========================================================================
  // 6. Search, Filters, Bookmarks, and Application Unchanged
  // =========================================================================
  describe('6. Search, Filters, and Saved Jobs Integration', () => {
    it('filtering by location and workplace works identically for authenticated users', async () => {
      const { cookieHeader } = createTestAuthenticatedCookie('filters@jobnexus.dev');

      const req = new Request('http://localhost:3000/api/jobs?remote=remote', {
        headers: { Cookie: cookieHeader },
      });
      const res = await jobsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(data.jobs.length > 0);
      assert.ok(data.jobs.every((j: { isRemote?: boolean }) => j.isRemote === true));
      assert.strictEqual(isCompanyMasked(data.jobs[0].company), false);
    });

    it('saved jobs endpoint authorizes authenticated users and rejects anonymous users', async () => {
      // Anonymous get rejected
      const anonRes = await savedJobsGetHandler(new Request('http://localhost:3000/api/saved-jobs'));
      assert.strictEqual(anonRes.status, 401);

      // Authenticated succeeds
      const { cookieHeader } = createTestAuthenticatedCookie('saved.jobs@jobnexus.dev');
      const authRes = await savedJobsGetHandler(
        new Request('http://localhost:3000/api/saved-jobs', { headers: { Cookie: cookieHeader } })
      );
      assert.strictEqual(authRes.status, 200);
      const authData = await authRes.json();
      assert.deepStrictEqual(authData.savedJobs, []);

      // Saving a job persists correctly
      const saveReq = new Request('http://localhost:3000/api/saved-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          job: {
            id: 'job-save-101',
            title: 'Full Stack Engineer',
            company: 'TechCorp',
            url: 'https://example.com/apply/101',
          },
        }),
      });
      const saveRes = await savedJobsPostHandler(saveReq);
      assert.strictEqual(saveRes.status, 200);
      const saveData = await saveRes.json();
      assert.strictEqual(saveData.saved, true);
      assert.strictEqual(saveData.savedJobs.length, 1);
      assert.strictEqual(saveData.savedJobs[0].company, 'TechCorp');
    });
  });
});
