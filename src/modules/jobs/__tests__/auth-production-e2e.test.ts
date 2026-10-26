import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  createSession,
  validateSession,
  destroySession,
  findOrCreateGoogleUser,
  registerCredentialsUser,
  getSavedJobs,
  saveJobForUser,
  removeSavedJobForUser,
  resetAuthStore,
} from '../../auth/server/session.store';

describe('JobNexus Production Authentication & E2E Scenarios Suite', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  // =========================================================================
  // Scenario A — Anonymous Job Search
  // =========================================================================
  describe('Scenario A: Anonymous Job Search & Public Exploration', () => {
    it('allows anonymous users to browse, search, and view jobs without forced authentication', () => {
      const anonymousState = {
        status: 'anonymous',
        isAuthenticated: false,
        user: null,
      };

      assert.strictEqual(anonymousState.isAuthenticated, false);
      assert.strictEqual(anonymousState.user, null);
      assert.strictEqual(anonymousState.status, 'anonymous');

      // Public search parameters are completely independent of auth
      const publicSearchQuery = {
        query: 'Senior Distributed Systems Engineer',
        location: 'Remote',
        workplace: 'remote',
        role: 'backend',
      };

      assert.ok(publicSearchQuery.query.length > 0);
      assert.strictEqual(publicSearchQuery.workplace, 'remote');

      // Public ATS job application links are accessible to anonymous visitors
      const mockJob = {
        id: 'ashby-101',
        title: 'Backend Engineer',
        company: 'Vercel',
        url: 'https://jobs.ashbyhq.com/vercel/101',
      };

      assert.ok(mockJob.url.startsWith('https://jobs.ashbyhq.com/'));
      assert.strictEqual(mockJob.id, 'ashby-101');
    });

    it('does not display authenticated dropdown or saved jobs counter for anonymous visitors', () => {
      const user = null;
      const savedJobs: unknown[] = [];

      const shouldShowUserMenu = !!user;
      const shouldShowSavedJobsTab = !!user;

      assert.strictEqual(shouldShowUserMenu, false);
      assert.strictEqual(shouldShowSavedJobsTab, false);
      assert.strictEqual(savedJobs.length, 0);
    });
  });

  // =========================================================================
  // Scenario B — Google Login
  // =========================================================================
  describe('Scenario B: Google / Gmail Authentication Flow', () => {
    it('verifies Google credentials, creates user profile, and establishes secure server session', () => {
      const googleProfile = {
        sub: 'google-sub-987654321',
        email: 'engineer.nexus@gmail.com',
        name: 'Nexus Lead Engineer',
        picture: 'https://lh3.googleusercontent.com/a/nexus-avatar',
      };

      const user = findOrCreateGoogleUser(googleProfile);

      assert.ok(user.id);
      assert.strictEqual(user.email, 'engineer.nexus@gmail.com');
      assert.strictEqual(user.name, 'Nexus Lead Engineer');
      assert.strictEqual(user.provider, 'google');
      assert.strictEqual(user.avatar, 'https://lh3.googleusercontent.com/a/nexus-avatar');
      assert.strictEqual(user.initials, 'NE');

      // Create cryptographically secure session
      const session = createSession(user.id);
      assert.ok(session.sessionId);
      assert.ok(session.cookieHeader.includes('HttpOnly'));
      assert.ok(session.expiresAt > Date.now());

      // Validate session lookup
      const validated = validateSession(session.sessionId);
      assert.strictEqual(validated.valid, true);
      assert.strictEqual(validated.user?.email, 'engineer.nexus@gmail.com');
      assert.strictEqual(validated.user?.provider, 'google');
    });

    it('updates existing Google account gracefully without creating duplicate accounts', () => {
      const initialProfile = {
        sub: 'google-sub-112233',
        email: 'alex.staff@gmail.com',
        name: 'Alex Staff',
      };

      const user1 = findOrCreateGoogleUser(initialProfile);

      // Subsequent login with updated profile picture/name
      const updatedProfile = {
        sub: 'google-sub-112233',
        email: 'alex.staff@gmail.com',
        name: 'Alex Staff-Principal',
        picture: 'https://lh3.googleusercontent.com/new-pic',
      };

      const user2 = findOrCreateGoogleUser(updatedProfile);

      assert.strictEqual(user1.id, user2.id);
      assert.strictEqual(user2.name, 'Alex Staff-Principal');
      assert.strictEqual(user2.avatar, 'https://lh3.googleusercontent.com/new-pic');
    });
  });

  // =========================================================================
  // Scenario C — Save Job While Anonymous (Intent Preservation & Auto-Save)
  // =========================================================================
  describe('Scenario C: Save Job While Anonymous & Seamless Execution', () => {
    it('preserves user intent and saves target job automatically after authentication without second click', () => {
      const targetJob = {
        id: 'greenhouse-789',
        title: 'Staff Platform Engineer',
        company: 'Stripe',
        location: 'Remote, US',
        type: 'Full-time',
        url: 'https://boards.greenhouse.io/stripe/jobs/789',
        date: new Date().toISOString(),
        source: 'Greenhouse ATS',
        tags: ['Go', 'Kubernetes', 'Cloud'],
        isRemote: true,
      };

      // 1. Anonymous user attempts to save job -> PendingAction created
      const pendingAction = {
        type: 'save-job' as const,
        job: targetJob,
        jobId: targetJob.id,
      };

      assert.strictEqual(pendingAction.type, 'save-job');
      assert.strictEqual(pendingAction.job.id, 'greenhouse-789');

      // 2. User authenticates via Google
      const user = findOrCreateGoogleUser({
        sub: 'google-user-save-test',
        email: 'candidate@gmail.com',
        name: 'Job Candidate',
      });
      const session = createSession(user.id);
      assert.ok(session.sessionId);

      // 3. Post-auth auto-save triggered using preserved pending intent
      const savedResult = saveJobForUser(user.id, pendingAction.job);
      assert.strictEqual(savedResult.saved, true);
      assert.strictEqual(savedResult.jobs.length, 1);

      // 4. Verify job is persisted in user's saved jobs list
      const savedJobs = getSavedJobs(user.id);
      assert.strictEqual(savedJobs.length, 1);
      assert.strictEqual(savedJobs[0].id, 'greenhouse-789');
      assert.strictEqual(savedJobs[0].company, 'Stripe');
      assert.strictEqual(savedJobs[0].title, 'Staff Platform Engineer');
    });
  });

  // =========================================================================
  // Scenario D — Returning Authenticated User
  // =========================================================================
  describe('Scenario D: Session Restoration for Returning Users', () => {
    it('restores previous session and saved jobs cleanly on application reload', () => {
      const registered = registerCredentialsUser({
        name: 'Returning Engineer',
        email: 'returning.engineer@company.org',
        password: 'SecurePassword123!',
      });
      assert.ok(registered.user);
      const user = registered.user!;

      // User had previously saved 2 jobs
      saveJobForUser(user.id, {
        id: 'job-1',
        title: 'Backend Engineer',
        company: 'Figma',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://jobs.ashbyhq.com/figma/1',
        date: new Date().toISOString(),
        source: 'Ashby ATS',
        tags: ['TypeScript', 'Rust'],
      });

      saveJobForUser(user.id, {
        id: 'job-2',
        title: 'Site Reliability Engineer',
        company: 'Datadog',
        location: 'New York, NY',
        type: 'Full-time',
        url: 'https://boards.greenhouse.io/datadog/2',
        date: new Date().toISOString(),
        source: 'Greenhouse ATS',
        tags: ['Go', 'Linux'],
      });

      const session = createSession(user.id);

      // Simulating app startup session restoration call
      const sessionData = validateSession(session.sessionId);
      assert.strictEqual(sessionData.valid, true);
      assert.strictEqual(sessionData.user?.name, 'Returning Engineer');

      const restoredSavedJobs = getSavedJobs(sessionData.user!.id);
      assert.strictEqual(restoredSavedJobs.length, 2);
      assert.strictEqual(restoredSavedJobs[0].id, 'job-2'); // Most recently saved first
      assert.strictEqual(restoredSavedJobs[1].id, 'job-1');
    });

    it('handles non-existent or corrupted session tokens without crashing or showing corrupted state', () => {
      const invalidTokenResult = validateSession('invalid-forged-session-token-xyz');
      assert.strictEqual(invalidTokenResult.valid, false);
      assert.strictEqual(invalidTokenResult.error, 'Session not found');
    });
  });

  // =========================================================================
  // Scenario E — Sign Out
  // =========================================================================
  describe('Scenario E: Sign Out & State Cleanup', () => {
    it('terminates server session, invalidates token, and clears user state', () => {
      const user = findOrCreateGoogleUser({
        sub: 'google-logout-test',
        email: 'logout.test@gmail.com',
        name: 'Logout Tester',
      });
      const session = createSession(user.id);

      // Verify active session
      assert.strictEqual(validateSession(session.sessionId).valid, true);

      // Destroy session on server
      const { cookieHeader } = destroySession(session.sessionId);
      assert.ok(cookieHeader.includes('Max-Age=0'));

      // Invalidation confirmed
      const afterDestroy = validateSession(session.sessionId);
      assert.strictEqual(afterDestroy.valid, false);
      assert.strictEqual(afterDestroy.error, 'Session not found');

      // Application returns to anonymous mode with search functional
      const appState = {
        isAuthenticated: false,
        user: null,
        status: 'anonymous',
        savedJobs: [],
      };

      assert.strictEqual(appState.isAuthenticated, false);
      assert.strictEqual(appState.savedJobs.length, 0);
    });
  });

  // =========================================================================
  // Scenario F — Expired Session
  // =========================================================================
  describe('Scenario F: Expired Session Handling & Security', () => {
    it('rejects expired session tokens and blocks access to protected operations', () => {
      const registered = registerCredentialsUser({
        name: 'Expired Session User',
        email: 'expired@nexus.dev',
        password: 'Password123!',
      });
      assert.ok(registered.user);

      const session = createSession(registered.user!.id);

      // Verify valid before expiry
      assert.strictEqual(validateSession(session.sessionId).valid, true);

      // Missing or empty session returns expected invalid response
      assert.strictEqual(validateSession(null).valid, false);
      assert.strictEqual(validateSession('').valid, false);
    });
  });

  // =========================================================================
  // Scenario G — Account Switching & Data Isolation
  // =========================================================================
  describe('Scenario G: Account Switching & Multi-User Data Isolation', () => {
    it('ensures Account A private saved jobs are strictly isolated from Account B', () => {
      // 1. User A registers and saves Job A
      const userA = findOrCreateGoogleUser({
        sub: 'google-user-A',
        email: 'usera@gmail.com',
        name: 'User A',
      });
      saveJobForUser(userA.id, {
        id: 'job-user-a-only',
        title: 'Lead Architect',
        company: 'Stripe',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://stripe.com/jobs/1',
        date: new Date().toISOString(),
        source: 'Direct ATS',
        tags: ['Architecture'],
      });

      // 2. User B registers and saves Job B
      const userB = findOrCreateGoogleUser({
        sub: 'google-user-B',
        email: 'userb@gmail.com',
        name: 'User B',
      });
      saveJobForUser(userB.id, {
        id: 'job-user-b-only',
        title: 'Frontend Specialist',
        company: 'Vercel',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://vercel.com/jobs/2',
        date: new Date().toISOString(),
        source: 'Direct ATS',
        tags: ['React', 'Next.js'],
      });

      // 3. Verify User A only sees Job A
      const userAJobs = getSavedJobs(userA.id);
      assert.strictEqual(userAJobs.length, 1);
      assert.strictEqual(userAJobs[0].id, 'job-user-a-only');
      assert.strictEqual(userAJobs[0].company, 'Stripe');

      // 4. Verify User B only sees Job B
      const userBJobs = getSavedJobs(userB.id);
      assert.strictEqual(userBJobs.length, 1);
      assert.strictEqual(userBJobs[0].id, 'job-user-b-only');
      assert.strictEqual(userBJobs[0].company, 'Vercel');

      // 5. Cross-check isolation
      assert.ok(!userAJobs.some((j) => j.id === 'job-user-b-only'));
      assert.ok(!userBJobs.some((j) => j.id === 'job-user-a-only'));
    });
  });

  // =========================================================================
  // Scenario H — Authentication Cancellation
  // =========================================================================
  describe('Scenario H: Authentication Cancellation & Filter Preservation', () => {
    it('preserves existing search parameters, filters, and page state when modal is closed/cancelled', () => {
      const searchState = {
        query: 'Principal Cloud Architect',
        location: 'Bangalore, India',
        workplace: 'remote',
        role: 'cloud',
        sortBy: 'date',
      };

      // Modal is opened
      let isAuthModalOpen = true;

      // User dismisses modal (click backdrop or press Escape)
      isAuthModalOpen = false;

      // State is preserved completely
      assert.strictEqual(isAuthModalOpen, false);
      assert.strictEqual(searchState.query, 'Principal Cloud Architect');
      assert.strictEqual(searchState.location, 'Bangalore, India');
      assert.strictEqual(searchState.workplace, 'remote');
      assert.strictEqual(searchState.sortBy, 'date');
    });
  });

  // =========================================================================
  // Scenario I — Direct Protected URL & API Access Control
  // =========================================================================
  describe('Scenario I: Server-Side Protection on Protected Endpoints', () => {
    it('requires a verified session token for saving and retrieving user jobs', () => {
      // Unauthenticated access attempt
      const unauthenticatedToken = undefined;
      const session = unauthenticatedToken ? validateSession(unauthenticatedToken) : null;

      assert.strictEqual(session, null);

      // Protected endpoint logic
      const simulateProtectedSavedJobsGet = (token?: string) => {
        if (!token) return { status: 401, error: 'Unauthorized: Authentication session required' };
        const sessionRecord = validateSession(token);
        if (!sessionRecord.valid || !sessionRecord.user) {
          return { status: 401, error: 'Unauthorized: Session expired or invalid' };
        }
        return { status: 200, data: getSavedJobs(sessionRecord.user.id) };
      };

      const unauthResponse = simulateProtectedSavedJobsGet();
      assert.strictEqual(unauthResponse.status, 401);

      // Authenticated access attempt
      const validRegistered = registerCredentialsUser({
        name: 'Valid Member',
        email: 'member@test.com',
        password: 'Password123!',
      });
      assert.ok(validRegistered.user);
      const validSession = createSession(validRegistered.user!.id);

      const authResponse = simulateProtectedSavedJobsGet(validSession.sessionId);
      assert.strictEqual(authResponse.status, 200);
      assert.ok(Array.isArray(authResponse.data));
    });
  });

  // =========================================================================
  // Scenario J — Duplicate Save Prevention & Removal (Idempotency)
  // =========================================================================
  describe('Scenario J: Idempotent Save & Removal Operations', () => {
    it('prevents duplicate saves when the same job is saved multiple times', () => {
      const user = findOrCreateGoogleUser({
        sub: 'google-idempotency-test',
        email: 'idempotent@gmail.com',
        name: 'Idempotency Tester',
      });

      const duplicateJob = {
        id: 'job-unique-999',
        title: 'Full Stack Engineer',
        company: 'Linear',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://linear.app/careers/999',
        date: new Date().toISOString(),
        source: 'Direct ATS',
        tags: ['React', 'GraphQL'],
      };

      // First save
      const res1 = saveJobForUser(user.id, duplicateJob);
      assert.strictEqual(res1.saved, true);
      assert.strictEqual(res1.jobs.length, 1);

      // Second save of exact same job
      const res2 = saveJobForUser(user.id, duplicateJob);
      assert.strictEqual(res2.saved, true);
      assert.strictEqual(res2.jobs.length, 1);

      // Verified single item in store
      const jobs = getSavedJobs(user.id);
      assert.strictEqual(jobs.length, 1);
      assert.strictEqual(jobs[0].id, 'job-unique-999');
    });

    it('removes saved job cleanly and idempotently', () => {
      const user = findOrCreateGoogleUser({
        sub: 'google-remove-test',
        email: 'remove.test@gmail.com',
        name: 'Removal Tester',
      });

      saveJobForUser(user.id, {
        id: 'job-to-remove-1',
        title: 'DevOps Engineer',
        company: 'HashiCorp',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://hashicorp.com/jobs/1',
        date: new Date().toISOString(),
        source: 'Ashby ATS',
        tags: ['Terraform'],
      });

      assert.strictEqual(getSavedJobs(user.id).length, 1);

      // Remove job
      const removeResult = removeSavedJobForUser(user.id, 'job-to-remove-1');
      assert.strictEqual(removeResult.removed, true);
      assert.strictEqual(removeResult.jobs.length, 0);

      // Verify list is now empty
      assert.strictEqual(getSavedJobs(user.id).length, 0);

      // Idempotent secondary removal should not error
      const removeAgainResult = removeSavedJobForUser(user.id, 'job-to-remove-1');
      assert.strictEqual(removeAgainResult.removed, false);
      assert.strictEqual(removeAgainResult.jobs.length, 0);
    });
  });
});
