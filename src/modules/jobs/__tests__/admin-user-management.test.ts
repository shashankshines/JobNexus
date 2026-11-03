import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { InMemoryFirestoreStore, createMockFirestoreDb } from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  getOrdersCollection,
  getSubmissionsCollection,
  getSubscriptionsCollection,
  getAuditLogsCollection,
  SubscriptionDocument,
} from '@/modules/storage/firestore/collections';
import {
  getAdminUsersDirectory,
} from '@/modules/storage/firestore/admin-billing.store';
import {
  createSession,
  validateSession,
  findOrCreateGoogleUser,
  registerCredentialsUser,
  verifyCredentialsUser,
  saveJobForUser,
  updateUserAccountStatus,
  resetAuthStore,
  getUserById,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/server/session.store';

// API Routes to test
import { GET as getUsersDirectoryRoute } from '@/app/api/admin/users/route';
import { POST as updateUserStatusRoute } from '@/app/api/admin/users/[userId]/status/route';
import { POST as revokeSessionsRoute } from '@/app/api/admin/users/[userId]/sessions/revoke/route';
import { GET as exportUserDataRoute } from '@/app/api/admin/users/[userId]/export/route';
import { POST as manageDeletionRoute } from '@/app/api/admin/users/[userId]/deletion/route';
import { GET as getUser360Route } from '@/app/api/admin/users/[userId]/route';

describe('JobNexus — Admin User & Account Management (P0 & P1)', () => {
  let mockStore: InMemoryFirestoreStore;
  const adminEmail = 'admin@jobnexus.internal';
  const targetEmail1 = 'alice@example.com';
  const targetEmail2 = 'bob@example.com';
  const targetEmail3 = 'charlie@example.com';

  beforeEach(() => {
    resetAuthStore();
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    process.env.ADMIN_EMAILS = adminEmail;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  async function createAdminSession(): Promise<{ userId: string; sessionId: string; cookie: string }> {
    const user = await findOrCreateGoogleUser({
      sub: 'google_admin_999',
      email: adminEmail,
      name: 'System Administrator',
      picture: 'https://example.com/admin.jpg',
    });
    const { sessionId } = createSession(user.id);
    return {
      userId: user.id,
      sessionId,
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    };
  }

  async function createRegularUser(email: string, name: string) {
    const user = await findOrCreateGoogleUser({
      sub: `google_${email}`,
      email,
      name,
    });
    const { sessionId } = createSession(user.id);
    return { user, sessionId, cookie: `${SESSION_COOKIE_NAME}=${sessionId}` };
  }

  describe('1. Users Directory: Search, Filters & Server-Side Pagination', () => {
    it('accurately lists, searches, filters, and paginates users with summary metrics', async () => {
      // 1. Seed accounts
      const userA = await findOrCreateGoogleUser({
        sub: 'sub_alice',
        email: 'alice@example.com',
        name: 'Alice Developer',
      });
      const userB = await findOrCreateGoogleUser({
        sub: 'sub_bob',
        email: 'bob@example.com',
        name: 'Bob Designer',
      });
      const regC = await registerCredentialsUser({
        email: 'charlie@example.com',
        password: 'Password123!',
        name: 'Charlie Manager',
      });
      assert.ok(regC.user);

      // Add subscriptions in mock Firestore: Alice is premium, Bob & Charlie are free
      const subsCol = getSubscriptionsCollection();
      await subsCol.doc(userA.id).set({
        id: `sub_${userA.id}`,
        userId: userA.id,
        userEmail: userA.email,
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date(Date.now() - 5 * 86400000).toISOString(),
        currentPeriodEnd: new Date(Date.now() + 25 * 86400000).toISOString(),
        source: 'payment_backed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update Bob's status to suspended
      updateUserAccountStatus(userB.id, {
        status: 'suspended',
        reason: 'Payment fraud investigation',
        updatedBy: adminEmail,
      });

      // Add saved jobs for Alice
      saveJobForUser(userA.id, {
        id: 'job_1',
        title: 'Lead Software Engineer',
        company: 'Stripe',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://stripe.com/jobs/1',
        date: new Date().toISOString(),
        source: 'greenhouse',
        tags: ['TypeScript', 'Node'],
      });

      // Query directory with no filters
      const allResult = await getAdminUsersDirectory({ page: 1, pageSize: 10 });
      assert.strictEqual(allResult.total, 3);
      assert.strictEqual(allResult.summary.totalUsers, 3);
      assert.strictEqual(allResult.summary.activeUsers, 2);
      assert.strictEqual(allResult.summary.suspendedUsers, 1);
      assert.strictEqual(allResult.summary.googleUsers, 2);
      assert.strictEqual(allResult.summary.credentialsUsers, 1);
      assert.strictEqual(allResult.summary.premiumUsers, 1);
      assert.strictEqual(allResult.summary.freeUsers, 2);

      // Search by name
      const searchResult = await getAdminUsersDirectory({ search: 'alice' });
      assert.strictEqual(searchResult.total, 1);
      assert.strictEqual(searchResult.users[0].email, 'alice@example.com');
      assert.strictEqual(searchResult.users[0].savedJobsCount, 1);
      assert.strictEqual(searchResult.users[0].subscription.isPremium, true);

      // Filter by suspended status
      const suspendedResult = await getAdminUsersDirectory({ accountStatus: 'suspended' });
      assert.strictEqual(suspendedResult.total, 1);
      assert.strictEqual(suspendedResult.users[0].email, 'bob@example.com');

      // Filter by provider
      const credResult = await getAdminUsersDirectory({ provider: 'credentials' });
      assert.strictEqual(credResult.total, 1);
      assert.strictEqual(credResult.users[0].email, 'charlie@example.com');

      // Test server-side pagination with pageSize: 1
      const page1 = await getAdminUsersDirectory({ page: 1, pageSize: 1 });
      assert.strictEqual(page1.users.length, 1);
      assert.strictEqual(page1.page, 1);
      assert.strictEqual(page1.totalPages, 3);

      const page2 = await getAdminUsersDirectory({ page: 2, pageSize: 1 });
      assert.strictEqual(page2.users.length, 1);
      assert.strictEqual(page2.page, 2);
      assert.notStrictEqual(page1.users[0].id, page2.users[0].id);
    });

    it('enforces admin authorization on GET /api/admin/users', async () => {
      // 1. Unauthenticated request
      const req1 = new NextRequest('http://localhost:3000/api/admin/users');
      const res1 = await getUsersDirectoryRoute(req1);
      assert.strictEqual(res1.status, 401);

      // 2. Non-admin regular user request
      const { sessionId } = await createRegularUser('user@example.com', 'Regular User');
      const req2 = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
      });
      const res2 = await getUsersDirectoryRoute(req2);
      assert.strictEqual(res2.status, 403);

      // 3. Authorized admin request
      const admin = await createAdminSession();
      const req3 = new NextRequest('http://localhost:3000/api/admin/users?page=1&pageSize=20', {
        headers: { cookie: admin.cookie },
      });
      const res3 = await getUsersDirectoryRoute(req3);
      assert.strictEqual(res3.status, 200);
      const json = await res3.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.users));
      assert.ok(json.summary);
    });
  });

  describe('2. Account Lifecycle Controls: Suspend, Reinstate, Deactivate & Access Enforcement', () => {
    it('suspends an account, terminates active sessions, and blocks access while preserving subscription', async () => {
      const admin = await createAdminSession();
      const { user, sessionId } = await createRegularUser(targetEmail1, 'Alice Test');

      // Give Alice an active subscription
      const subsCol = getSubscriptionsCollection();
      await subsCol.doc(user.id).set({
        id: `sub_${user.id}`,
        userId: user.id,
        userEmail: user.email,
        planId: 'premium_monthly',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        source: 'payment_backed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Verify Alice has valid session before suspension
      const valBefore = validateSession(sessionId);
      assert.strictEqual(valBefore.valid, true);

      // Reject suspension if mandatory reason is missing or too short
      const failReq = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({ status: 'suspended', reason: 'bad' }),
      });
      const failRes = await updateUserStatusRoute(failReq, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(failRes.status, 400);

      // Suspend Alice with valid justification
      const suspendReq = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          status: 'suspended',
          reason: 'Severe Terms of Service violation detected',
        }),
      });
      const suspendRes = await updateUserStatusRoute(suspendReq, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(suspendRes.status, 200);
      const suspendJson = await suspendRes.json();
      assert.strictEqual(suspendJson.success, true);
      assert.strictEqual(suspendJson.user.accountStatus, 'suspended');
      assert.strictEqual(suspendJson.revokedSessionsCount, 1);

      // Verify existing session is immediately rejected (session deleted from store)
      const valAfter = validateSession(sessionId);
      assert.strictEqual(valAfter.valid, false);
      assert.ok(valAfter.error);

      // Verify Google OAuth login is blocked
      await assert.rejects(
        async () => {
          await findOrCreateGoogleUser({
            sub: `google_${targetEmail1}`,
            email: targetEmail1,
            name: 'Alice Test',
          });
        },
        /suspended by an administrator/i
      );

      // INVARIANT: Alice's subscription entitlement remains intact and NOT deleted or prematurely cancelled
      const subDoc = (await subsCol.doc(user.id).get()).data() as SubscriptionDocument;
      assert.strictEqual(subDoc.status, 'active');

      // Verify audit log entry was created
      const auditCol = getAuditLogsCollection();
      const auditDocs = await auditCol.where('targetUserId', '==', user.id).get();
      assert.strictEqual(auditDocs.docs.length, 1);
      const auditEntry = auditDocs.docs[0].data();
      assert.strictEqual(auditEntry.action, 'account_suspended');
      assert.strictEqual(auditEntry.reason, 'Severe Terms of Service violation detected');
      assert.strictEqual(auditEntry.actorEmail, adminEmail);

      // Now Reinstate Alice's account
      const reinstateReq = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          status: 'active',
          reason: 'Appeal reviewed and granted by trust team',
        }),
      });
      const reinstateRes = await updateUserStatusRoute(reinstateReq, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(reinstateRes.status, 200);
      const reinstateJson = await reinstateRes.json();
      assert.strictEqual(reinstateJson.user.accountStatus, 'active');

      // Alice can sign in again
      const reloggedUser = await findOrCreateGoogleUser({
        sub: `google_${targetEmail1}`,
        email: targetEmail1,
        name: 'Alice Test',
      });
      const newSession = createSession(reloggedUser.id);
      const valReinstate = validateSession(newSession.sessionId);
      assert.strictEqual(valReinstate.valid, true);
    });

    it('supports deactivation and reactivation lifecycle', async () => {
      const admin = await createAdminSession();
      const reg = await registerCredentialsUser({
        email: targetEmail2,
        password: 'Password123!',
        name: 'Bob Candidate',
      });
      const bob = reg.user!;
      const { sessionId } = createSession(bob.id);

      // Deactivate account
      const deactReq = new NextRequest(`http://localhost:3000/api/admin/users/${bob.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          status: 'deactivated',
          reason: 'User requested self-exclusion for 30 days',
        }),
      });
      const deactRes = await updateUserStatusRoute(deactReq, { params: Promise.resolve({ userId: bob.id }) });
      assert.strictEqual(deactRes.status, 200);

      // Session rejected (session purged on deactivation)
      const valSess = validateSession(sessionId);
      assert.strictEqual(valSess.valid, false);
      assert.ok(valSess.error);

      // Credentials login rejected
      const loginAttempt = await verifyCredentialsUser(targetEmail2, 'Password123!');
      assert.ok(loginAttempt.error);
      assert.match(loginAttempt.error!, /deactivated/i);

      // Reactivate account
      const reactReq = new NextRequest(`http://localhost:3000/api/admin/users/${bob.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          status: 'active',
          reason: 'Self-exclusion period concluded',
        }),
      });
      const reactRes = await updateUserStatusRoute(reactReq, { params: Promise.resolve({ userId: bob.id }) });
      assert.strictEqual(reactRes.status, 200);

      // Credentials login succeeds again
      const loginSuccess = await verifyCredentialsUser(targetEmail2, 'Password123!');
      assert.strictEqual(loginSuccess.user?.email, targetEmail2);
    });
  });

  describe('3. Session Management: Force Sign-Out (Revoke All Sessions)', () => {
    it('terminates all sessions for target user server-side without affecting other users', async () => {
      const admin = await createAdminSession();
      const { user: user1, sessionId: s1 } = await createRegularUser('target1@example.com', 'Target One');
      // Create secondary session for user1 (e.g. mobile browser)
      const { sessionId: s2 } = createSession(user1.id);

      // Create session for unrelated user2
      const { sessionId: sUser2 } = await createRegularUser('target2@example.com', 'Target Two');

      assert.strictEqual(validateSession(s1).valid, true);
      assert.strictEqual(validateSession(s2).valid, true);
      assert.strictEqual(validateSession(sUser2).valid, true);

      // Revoke user1 sessions via API
      const revokeReq = new NextRequest(`http://localhost:3000/api/admin/users/${user1.id}/sessions/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          reason: 'Administrative security precaution after suspicious access pattern',
        }),
      });
      const revokeRes = await revokeSessionsRoute(revokeReq, { params: Promise.resolve({ userId: user1.id }) });
      assert.strictEqual(revokeRes.status, 200);
      const revokeJson = await revokeRes.json();
      assert.strictEqual(revokeJson.success, true);
      assert.strictEqual(revokeJson.revokedSessionsCount, 2);

      // Both user1 sessions must now fail validation
      assert.strictEqual(validateSession(s1).valid, false);
      assert.strictEqual(validateSession(s2).valid, false);

      // User2 session remains completely valid and undisturbed
      assert.strictEqual(validateSession(sUser2).valid, true);

      // Audit log recorded
      const auditCol = getAuditLogsCollection();
      const auditDocs = await auditCol.where('action', '==', 'sessions_revoked').get();
      assert.strictEqual(auditDocs.docs.length, 1);
      assert.strictEqual(auditDocs.docs[0].data().targetUserId, user1.id);
    });
  });

  describe('4. Controlled Account Deletion & Statutory Financial Retention', () => {
    it('manages controlled deletion lifecycle (request -> cancel -> execute) and preserves financial records', async () => {
      const admin = await createAdminSession();
      const { user, sessionId } = await createRegularUser(targetEmail3, 'Charlie Test');

      // Seed orders and submissions for Charlie to verify financial retention
      const ordersCol = getOrdersCollection();
      await ordersCol.doc('ord_charlie_1').set({
        orderId: 'ord_charlie_1',
        userId: user.id,
        userEmail: user.email,
        planId: 'premium_monthly',
        amountInr: 349,
        amountInPaise: 34900,
        currency: 'INR',
        status: 'submitted',
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus Payments',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const subsCol = getSubmissionsCollection();
      await subsCol.doc('subn_charlie_1').set({
        submissionId: 'subn_charlie_1',
        orderId: 'ord_charlie_1',
        userId: user.id,
        userEmail: user.email,
        utrNumber: '123456789012',
        declaredAmount: 349,
        paymentDate: '2026-11-03',
        submittedAt: new Date().toISOString(),
        slaDeadlineAt: new Date(Date.now() + 43200000).toISOString(),
        status: 'approved',
      });

      // 1. Request Deletion
      const reqDel = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          action: 'request',
          reason: 'User GDPR right to be forgotten request',
          retentionDays: 14,
        }),
      });
      const resDel = await manageDeletionRoute(reqDel, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(resDel.status, 200);
      const jsonDel = await resDel.json();
      assert.strictEqual(jsonDel.user.accountStatus, 'deletion_requested');
      assert.ok(jsonDel.user.deletionScheduledFor);

      // Active session revoked immediately upon deletion request
      assert.strictEqual(validateSession(sessionId).valid, false);

      // 2. Cancel Deletion
      const reqCancel = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          action: 'cancel',
          reason: 'User revoked deletion request within grace window',
        }),
      });
      const resCancel = await manageDeletionRoute(reqCancel, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(resCancel.status, 200);
      const jsonCancel = await resCancel.json();
      assert.strictEqual(jsonCancel.user.accountStatus, 'active');

      // 3. Execute Deletion: requires confirmationChecked
      const reqExecFail = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          action: 'execute',
          reason: 'Mandatory statutory purge',
          confirmationChecked: false,
        }),
      });
      const resExecFail = await manageDeletionRoute(reqExecFail, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(resExecFail.status, 400);

      // Execute Deletion with explicit confirmation
      const reqExec = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}/deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: admin.cookie,
        },
        body: JSON.stringify({
          action: 'execute',
          reason: 'Final authorized purge of credentials and authentication identity',
          confirmationChecked: true,
        }),
      });
      const resExec = await manageDeletionRoute(reqExec, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(resExec.status, 200);

      // User identity in auth store is purged
      assert.strictEqual(getUserById(user.id), null);

      // CRITICAL INVARIANT: Financial records are preserved in Firestore
      const preservedOrder = (await ordersCol.doc('ord_charlie_1').get()).data();
      assert.ok(preservedOrder);
      assert.strictEqual(preservedOrder.orderId, 'ord_charlie_1');

      const preservedSub = (await subsCol.doc('subn_charlie_1').get()).data();
      assert.ok(preservedSub);
      assert.strictEqual(preservedSub.submissionId, 'subn_charlie_1');

      // Immutable audit log recorded
      const auditCol = getAuditLogsCollection();
      const auditDocs = await auditCol.where('action', '==', 'account_deletion_completed').get();
      assert.strictEqual(auditDocs.docs.length, 1);
    });
  });

  describe('5. Authorized User Data Export: JSON & CSV', () => {
    it('exports user data without leaking credentials, passwords or session tokens', async () => {
      const admin = await createAdminSession();
      const reg = await registerCredentialsUser({
        email: 'export_target@example.com',
        password: 'SuperSecretPassword123!',
        name: 'Export Candidate',
      });
      const user = reg.user!;

      // Add a saved job
      saveJobForUser(user.id, {
        id: 'job_export_1',
        title: 'Staff Fullstack Engineer',
        company: 'Vercel',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://vercel.com/careers/1',
        date: new Date().toISOString(),
        source: 'greenhouse',
        tags: ['Next.js', 'React'],
      });

      // 1. JSON Export
      const jsonReq = new NextRequest(
        `http://localhost:3000/api/admin/users/${user.id}/export?format=json`,
        { headers: { cookie: admin.cookie } }
      );
      const jsonRes = await exportUserDataRoute(jsonReq, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(jsonRes.status, 200);
      assert.strictEqual(jsonRes.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.match(jsonRes.headers.get('content-disposition') || '', /attachment; filename="user_export_/);

      const exportBody = await jsonRes.json();
      assert.strictEqual(exportBody.identity.email, 'export_target@example.com');
      assert.strictEqual(exportBody.savedJobs.length, 1);
      assert.strictEqual(exportBody.savedJobs[0].title, 'Staff Fullstack Engineer');

      // Verify no sensitive credentials leaked
      const exportRecord = exportBody as Record<string, unknown>;
      assert.strictEqual(exportRecord.password, undefined);
      assert.strictEqual(exportRecord.passwordHash, undefined);
      assert.strictEqual(exportRecord.sessionTokens, undefined);

      // 2. CSV Export
      const csvReq = new NextRequest(
        `http://localhost:3000/api/admin/users/${user.id}/export?format=csv`,
        { headers: { cookie: admin.cookie } }
      );
      const csvRes = await exportUserDataRoute(csvReq, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(csvRes.status, 200);
      assert.strictEqual(csvRes.headers.get('content-type'), 'text/csv; charset=utf-8');
      const csvText = await csvRes.text();
      assert.ok(csvText.includes('export_target@example.com'));
      assert.ok(csvText.includes('Staff Fullstack Engineer'));

      // Verify audit log
      const auditCol = getAuditLogsCollection();
      const auditDocs = await auditCol.where('action', '==', 'user_data_exported').get();
      assert.strictEqual(auditDocs.docs.length, 2); // 1 JSON + 1 CSV
    });
  });

  describe('6. User 360° Dossier Integration', () => {
    it('returns enriched account identity, lifecycle metadata, and saved jobs in User 360', async () => {
      const admin = await createAdminSession();
      const user = await findOrCreateGoogleUser({
        sub: 'sub_360',
        email: 'dossier_user@example.com',
        name: 'Dossier Candidate',
      });

      saveJobForUser(user.id, {
        id: 'job_dossier_1',
        title: 'Principal Architect',
        company: 'JobNexus',
        location: 'Bengaluru',
        type: 'Full-time',
        url: 'https://jobnexus.com/careers/arch',
        date: new Date().toISOString(),
        source: 'direct',
        tags: ['Architecture'],
      });

      const req = new NextRequest(`http://localhost:3000/api/admin/users/${user.id}`, {
        headers: { cookie: admin.cookie },
      });
      const res = await getUser360Route(req, { params: Promise.resolve({ userId: user.id }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.dossier.identity.userId, user.id);
      assert.strictEqual(json.dossier.identity.accountStatus, 'active');
      assert.strictEqual(json.dossier.savedJobs.length, 1);
      assert.strictEqual(json.dossier.savedJobs[0].title, 'Principal Architect');
    });
  });
});
