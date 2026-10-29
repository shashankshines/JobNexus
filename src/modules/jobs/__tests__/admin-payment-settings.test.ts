import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import {
  setMockFirestoreDb,
  resetFirestoreRegistry,
} from '../../storage/firestore/client';
import { createMockFirestoreDb, InMemoryFirestoreStore } from '../../storage/firestore/mock';
import {
  getBillingConfigCollection,
  FIRESTORE_COLLECTIONS,
} from '../../storage/firestore/collections';
import {
  getPaymentSettings,
  updatePaymentSettingsInTransaction,
  validatePaymentSettingsInput,
  isValidUpiId,
  isValidPayeeName,
  isValidPaymentDescription,
  PaymentSettingsMissingError,
  PAYMENT_SETTINGS_DOC_ID,
} from '../../storage/firestore/settings.store';
import {
  createPaymentOrder,
  getPaymentOrderById,
} from '../../storage/firestore/order.store';
import {
  parseAdminEmails,
  isAllowedAdminEmail,
  authorizeAdminRequest,
} from '../../auth/server/admin.auth';
import {
  resetAuthStore,
  createSession,
  findOrCreateGoogleUser,
  registerCredentialsUser,
  SESSION_COOKIE_NAME,
} from '../../auth/server/session.store';
import {
  GET as adminSettingsGetHandler,
  PUT as adminSettingsPutHandler,
} from '../../../app/api/admin/billing/settings/route';
import {
  POST as billingOrderPostHandler,
} from '../../../app/api/billing/order/route';

// Helper to construct NextRequest for testing
function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = new Headers(options.headers || {});
  if (options.cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.cookie}`);
  }
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const rawBody = options.body ? JSON.stringify(options.body) : undefined;
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers,
    body: rawBody,
  });
}

describe('Admin Payment Settings & Authorization (Phase 2B.3A)', () => {
  let mockStore: InMemoryFirestoreStore;
  const originalEnv = { ...process.env };

  const ADMIN_EMAIL = 'admin@jobnexus.world';
  const REGULAR_USER_EMAIL = 'candidate@gmail.com';

  beforeEach(() => {
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    resetAuthStore();

    // Set standard test admin environment
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    process.env.BUSINESS_UPI_ID = 'jobnexus@icici';
    process.env.BUSINESS_UPI_NAME = 'JobNexus Technologies';
  });

  afterEach(() => {
    resetFirestoreRegistry();
    resetAuthStore();
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. Admin Authorization Helper Tests
  // ==========================================================================
  describe('Admin Authorization Server Guards', () => {
    it('correctly parses ADMIN_EMAILS environment variable', () => {
      const set1 = parseAdminEmails('admin1@jobnexus.world, admin2@jobnexus.world ');
      assert.strictEqual(set1.size, 2);
      assert.strictEqual(set1.has('admin1@jobnexus.world'), true);
      assert.strictEqual(set1.has('admin2@jobnexus.world'), true);

      // Quoted string
      const set2 = parseAdminEmails('"shashankshines@gmail.com, Admin@Jobnexus.World"');
      assert.strictEqual(set2.size, 2);
      assert.strictEqual(set2.has('shashankshines@gmail.com'), true);
      assert.strictEqual(set2.has('admin@jobnexus.world'), true);

      // Empty / unset
      const set3 = parseAdminEmails('');
      assert.strictEqual(set3.size, 0);

      const set4 = parseAdminEmails(undefined);
      assert.strictEqual(set4.has('admin@jobnexus.world'), true); // uses process.env.ADMIN_EMAILS
    });

    it('correctly evaluates isAllowedAdminEmail case-insensitively', () => {
      assert.strictEqual(isAllowedAdminEmail('ADMIN@jobnexus.world'), true);
      assert.strictEqual(isAllowedAdminEmail('admin@jobnexus.world'), true);
      assert.strictEqual(isAllowedAdminEmail('candidate@example.com'), false);
      assert.strictEqual(isAllowedAdminEmail(''), false);
      assert.strictEqual(isAllowedAdminEmail(null), false);
      assert.strictEqual(isAllowedAdminEmail(undefined), false);
    });

    it('denies access with 401 when request has no session', async () => {
      const req = createMockRequest('/api/admin/billing/settings');
      const auth = await authorizeAdminRequest(req);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.statusCode, 401);
      assert.match(auth.error, /Authentication required/i);
    });

    it('denies access with 401 when session is invalid', async () => {
      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: 'invalid_session_uuid',
      });
      const auth = await authorizeAdminRequest(req);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.statusCode, 401);
    });

    it('denies access with 403 when user authenticated via credentials provider', async () => {
      const { user: credUser } = registerCredentialsUser({
        email: ADMIN_EMAIL, // even if matching admin email!
        name: 'Credentials Admin',
        password: 'Password123!',
      });
      assert(credUser);
      const session = createSession(credUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });

      const auth = await authorizeAdminRequest(req);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.statusCode, 403);
      assert.match(auth.error, /Google OAuth authentication/i);
    });

    it('denies access with 403 when Google user is not in ADMIN_EMAILS allowlist', async () => {
      const googleUser = findOrCreateGoogleUser({
        email: REGULAR_USER_EMAIL,
        name: 'Regular Candidate',
        sub: 'google_sub_123',
      });
      const session = createSession(googleUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });

      const auth = await authorizeAdminRequest(req);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.statusCode, 403);
      assert.match(auth.error, /not authorized as a JobNexus administrator/i);
    });

    it('authorizes access with 200 when Google user is in ADMIN_EMAILS allowlist', async () => {
      const adminUser = findOrCreateGoogleUser({
        email: ADMIN_EMAIL,
        name: 'Super Admin',
        sub: 'google_admin_sub_456',
      });
      const session = createSession(adminUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });

      const auth = await authorizeAdminRequest(req);
      assert.strictEqual(auth.authorized, true);
      assert.strictEqual(auth.statusCode, 200);
      assert.strictEqual(auth.adminEmail, ADMIN_EMAIL);
      assert.strictEqual(auth.adminUserId, adminUser.id);
    });
  });

  // ==========================================================================
  // 2. Input Validation Tests
  // ==========================================================================
  describe('Input Validation for Payment Settings', () => {
    it('validates UPI VPA formats accurately', () => {
      // Valid VPAs
      assert.strictEqual(isValidUpiId('jobnexus@icici'), true);
      assert.strictEqual(isValidUpiId('billing.nexus@oksbi'), true);
      assert.strictEqual(isValidUpiId('finance-team_01@hdfcbank'), true);
      assert.strictEqual(isValidUpiId('business@ybl'), true);

      // Invalid VPAs
      assert.strictEqual(isValidUpiId(''), false);
      assert.strictEqual(isValidUpiId('jobnexus'), false);
      assert.strictEqual(isValidUpiId('@icici'), false);
      assert.strictEqual(isValidUpiId('job nexus@icici'), false);
      assert.strictEqual(isValidUpiId('jobnexus@'), false);
      assert.strictEqual(isValidUpiId('a@@b'), false);
      assert.strictEqual(isValidUpiId('<script>@icici'), false);
      assert.strictEqual(isValidUpiId('jobnexus@bank;drop table;'), false);
    });

    it('validates Payee Name (Unicode-safe and injection prevention)', () => {
      // Valid names
      assert.strictEqual(isValidPayeeName('JobNexus Technologies'), true);
      assert.strictEqual(isValidPayeeName('JobNexus & Co.'), true);
      assert.strictEqual(isValidPayeeName('जॉबनैक्सस'), true); // Hindi Unicode
      assert.strictEqual(isValidPayeeName("JobNexus, O'Connor"), true);

      // Invalid names
      assert.strictEqual(isValidPayeeName(''), false);
      assert.strictEqual(isValidPayeeName('A'), false); // Too short
      assert.strictEqual(isValidPayeeName('<script>alert(1)</script>'), false);
      assert.strictEqual(isValidPayeeName('Payee <Name>'), false);
      assert.strictEqual(isValidPayeeName('Name with control \x00 character'), false);
    });

    it('validates Payment Description format and length', () => {
      assert.strictEqual(isValidPaymentDescription('JobNexus Premium Subscription'), true);
      assert.strictEqual(isValidPaymentDescription('Monthly Membership (30-day)'), true);
      assert.strictEqual(isValidPaymentDescription(''), false);
      assert.strictEqual(isValidPaymentDescription('Line 1\nLine 2'), false); // newline forbidden
      assert.strictEqual(isValidPaymentDescription('<img src=x onerror=alert(1)>'), false);
      assert.strictEqual(isValidPaymentDescription('a'.repeat(121)), false); // > 120 chars
    });

    it('validates complete input payload and normalizes fields', () => {
      const validRes = validatePaymentSettingsInput({
        upiId: '  newmerchant@axisbank  ',
        payeeName: '  JobNexus Global Services  ',
        paymentDescription: '  Premium Upgrade  ',
      });
      assert.strictEqual(validRes.valid, true);
      assert.deepStrictEqual(validRes.normalized, {
        upiId: 'newmerchant@axisbank',
        payeeName: 'JobNexus Global Services',
        paymentDescription: 'Premium Upgrade',
      });

      const invalidRes = validatePaymentSettingsInput({
        upiId: 'not-a-vpa',
        payeeName: '',
        paymentDescription: 'Line 1\nLine 2',
      });
      assert.strictEqual(invalidRes.valid, false);
      assert.strictEqual(typeof invalidRes.errors.upiId, 'string');
      assert.strictEqual(typeof invalidRes.errors.payeeName, 'string');
      assert.strictEqual(typeof invalidRes.errors.paymentDescription, 'string');
    });
  });

  // ==========================================================================
  // 3. Precedence & Fail-Closed Tests
  // ==========================================================================
  describe('Precedence & Fail-Closed Behavior', () => {
    it('prefers authoritative Firestore configuration when present', async () => {
      // 1. Seed Firestore document
      const configCol = getBillingConfigCollection();
      await configCol.doc(PAYMENT_SETTINGS_DOC_ID).set({
        upiId: 'custom.firestore@icici',
        payeeName: 'Firestore Custom Payee',
        paymentDescription: 'Firestore Premium Description',
        updatedAt: '2026-10-29T10:00:00.000Z',
        updatedBy: 'admin@jobnexus.world',
        version: 3,
      });

      // 2. Fetch active settings
      const settings = await getPaymentSettings();
      assert.strictEqual(settings.isConfiguredInFirestore, true);
      assert.strictEqual(settings.upiId, 'custom.firestore@icici');
      assert.strictEqual(settings.payeeName, 'Firestore Custom Payee');
      assert.strictEqual(settings.paymentDescription, 'Firestore Premium Description');
      assert.strictEqual(settings.version, 3);
      assert.strictEqual(settings.updatedBy, 'admin@jobnexus.world');
    });

    it('falls back to environment variables when Firestore document is absent', async () => {
      process.env.BUSINESS_UPI_ID = 'envfallback@oksbi';
      process.env.BUSINESS_UPI_NAME = 'Env Payee Name';

      const settings = await getPaymentSettings();
      assert.strictEqual(settings.isConfiguredInFirestore, false);
      assert.strictEqual(settings.upiId, 'envfallback@oksbi');
      assert.strictEqual(settings.payeeName, 'Env Payee Name');
      assert.strictEqual(settings.version, 0);
      assert.strictEqual(settings.updatedBy, 'system_env');
    });

    it('fails closed when configuration is missing and strict environment is active', async () => {
      // Force production mode and blank environment configuration
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.BUSINESS_UPI_ID = '   ';
      process.env.BUSINESS_UPI_NAME = '   ';

      await assert.rejects(
        async () => {
          await getPaymentSettings();
        },
        (err) => {
          assert(err instanceof PaymentSettingsMissingError);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 4. Transactional Update & Audit Logging Tests
  // ==========================================================================
  describe('Transactional Settings Update & Append-Only Audit Trail', () => {
    it('creates initial version 1 and appends audit log record', async () => {
      const updated = await updatePaymentSettingsInTransaction({
        upiId: 'merchant.v1@icici',
        payeeName: 'JobNexus Initial Payee',
        paymentDescription: 'JobNexus Premium V1',
        adminEmail: ADMIN_EMAIL,
        adminUserId: 'admin_usr_001',
        reason: 'Initial setup of business UPI',
      });

      assert.strictEqual(updated.upiId, 'merchant.v1@icici');
      assert.strictEqual(updated.payeeName, 'JobNexus Initial Payee');
      assert.strictEqual(updated.version, 1);
      assert.strictEqual(updated.updatedBy, ADMIN_EMAIL);

      // Verify Firestore document persistence
      const configDoc = await getBillingConfigCollection().doc(PAYMENT_SETTINGS_DOC_ID).get();
      assert.strictEqual(configDoc.exists, true);
      assert.deepStrictEqual(configDoc.data(), updated);

      // Verify Audit Log document
      const auditColData = mockStore.getCollectionData(FIRESTORE_COLLECTIONS.ADMIN_AUDIT_LOGS);
      assert.strictEqual(auditColData.size, 1);

      const [auditEntry] = Array.from(auditColData.values());
      assert.strictEqual(auditEntry.action, 'payment_settings_updated');
      assert.strictEqual(auditEntry.actorEmail, ADMIN_EMAIL);
      assert.strictEqual(auditEntry.actorId, 'admin_usr_001');
      assert.strictEqual(auditEntry.targetEntityId, PAYMENT_SETTINGS_DOC_ID);
      assert.strictEqual(auditEntry.previousState, null);
      assert.strictEqual(auditEntry.newState.version, 1);
      assert.strictEqual(auditEntry.newState.upiId, 'merchant.v1@icici');
      assert.strictEqual(auditEntry.reason, 'Initial setup of business UPI');
    });

    it('increments version to 2 and logs previousState on second update', async () => {
      // 1. First update
      await updatePaymentSettingsInTransaction({
        upiId: 'merchant.v1@icici',
        payeeName: 'JobNexus V1',
        paymentDescription: 'JobNexus Premium V1',
        adminEmail: ADMIN_EMAIL,
        adminUserId: 'admin_usr_001',
      });

      // 2. Second update
      const secondUpdate = await updatePaymentSettingsInTransaction({
        upiId: 'merchant.v2@hdfcbank',
        payeeName: 'JobNexus V2 Corporation',
        paymentDescription: 'JobNexus Premium V2',
        adminEmail: ADMIN_EMAIL,
        adminUserId: 'admin_usr_001',
        reason: 'Migrated to HDFC merchant account',
      });

      assert.strictEqual(secondUpdate.version, 2);
      assert.strictEqual(secondUpdate.upiId, 'merchant.v2@hdfcbank');

      // Verify audit log has two records
      const auditColData = mockStore.getCollectionData(FIRESTORE_COLLECTIONS.ADMIN_AUDIT_LOGS);
      assert.strictEqual(auditColData.size, 2);

      const logs = Array.from(auditColData.values());
      const secondLog = logs.find((l) => l.newState.version === 2);
      assert(secondLog);
      assert.strictEqual(secondLog.previousState.version, 1);
      assert.strictEqual(secondLog.previousState.upiId, 'merchant.v1@icici');
      assert.strictEqual(secondLog.newState.version, 2);
      assert.strictEqual(secondLog.newState.upiId, 'merchant.v2@hdfcbank');
      assert.strictEqual(secondLog.reason, 'Migrated to HDFC merchant account');
    });
  });

  // ==========================================================================
  // 5. Order Snapshot Invariance Tests
  // ==========================================================================
  describe('Order Snapshot Invariance', () => {
    it('preserves initial UPI snapshot on existing orders when settings change later', async () => {
      // Step A: Set initial payment settings to v1
      await updatePaymentSettingsInTransaction({
        upiId: 'jobnexus.v1@icici',
        payeeName: 'JobNexus V1 Payee',
        paymentDescription: 'Version 1 Note',
        adminEmail: ADMIN_EMAIL,
        adminUserId: 'admin_usr_001',
      });

      // Step B: User creates order 1
      const order1 = await createPaymentOrder({ userId: 'candidate_user_1' });
      assert.strictEqual(order1.upiId, 'jobnexus.v1@icici');
      assert.strictEqual(order1.payeeName, 'JobNexus V1 Payee');
      assert.strictEqual(order1.paymentDescription, 'Version 1 Note');
      assert.strictEqual(order1.configVersion, 1);

      // Step C: Administrator updates settings to v2
      await updatePaymentSettingsInTransaction({
        upiId: 'jobnexus.v2@hdfcbank',
        payeeName: 'JobNexus V2 Payee',
        paymentDescription: 'Version 2 Note',
        adminEmail: ADMIN_EMAIL,
        adminUserId: 'admin_usr_001',
      });

      // Step D: User creates order 2
      const order2 = await createPaymentOrder({ userId: 'candidate_user_2' });
      assert.strictEqual(order2.upiId, 'jobnexus.v2@hdfcbank');
      assert.strictEqual(order2.payeeName, 'JobNexus V2 Payee');
      assert.strictEqual(order2.paymentDescription, 'Version 2 Note');
      assert.strictEqual(order2.configVersion, 2);

      // Step E: Verify order 1 was NEVER modified and retains its original snapshot
      const fetchedOrder1 = await getPaymentOrderById(order1.orderId);
      assert(fetchedOrder1);
      assert.strictEqual(fetchedOrder1.upiId, 'jobnexus.v1@icici');
      assert.strictEqual(fetchedOrder1.payeeName, 'JobNexus V1 Payee');
      assert.strictEqual(fetchedOrder1.paymentDescription, 'Version 1 Note');
      assert.strictEqual(fetchedOrder1.configVersion, 1);
    });
  });

  // ==========================================================================
  // 6. Admin API Route Integration Tests
  // ==========================================================================
  describe('API Route: /api/admin/billing/settings', () => {
    it('GET: returns 401 when unauthenticated', async () => {
      const req = createMockRequest('/api/admin/billing/settings');
      const res = await adminSettingsGetHandler(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    it('GET: returns 403 when authenticated as non-admin user', async () => {
      const regularUser = findOrCreateGoogleUser({
        email: REGULAR_USER_EMAIL,
        name: 'Regular Candidate',
        sub: 'reg_user_1',
      });
      const session = createSession(regularUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });
      const res = await adminSettingsGetHandler(req);
      assert.strictEqual(res.status, 403);
    });

    it('GET: returns 200 with current settings for authorized admin', async () => {
      const adminUser = findOrCreateGoogleUser({
        email: ADMIN_EMAIL,
        name: 'Admin User',
        sub: 'admin_user_sub',
      });
      const session = createSession(adminUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });
      const res = await adminSettingsGetHandler(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(typeof json.settings.upiId, 'string');
      assert.strictEqual(typeof json.settings.payeeName, 'string');
    });

    it('PUT: returns 400 when invalid UPI ID or payload is provided', async () => {
      const adminUser = findOrCreateGoogleUser({
        email: ADMIN_EMAIL,
        name: 'Admin User',
        sub: 'admin_user_sub',
      });
      const session = createSession(adminUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        method: 'PUT',
        cookie: session.sessionId,
        body: {
          upiId: 'invalid-upi-string',
          payeeName: 'Valid Payee Name',
          paymentDescription: 'Valid Description',
        },
      });

      const res = await adminSettingsPutHandler(req);
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(typeof json.fieldErrors.upiId, 'string');
    });

    it('PUT: updates settings and persists audit log when authorized admin submits valid data', async () => {
      const adminUser = findOrCreateGoogleUser({
        email: ADMIN_EMAIL,
        name: 'Admin User',
        sub: 'admin_user_sub',
      });
      const session = createSession(adminUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        method: 'PUT',
        cookie: session.sessionId,
        body: {
          upiId: 'jobnexus.production@icici',
          payeeName: 'JobNexus Corporate Payee',
          paymentDescription: 'Premium Candidate Plan',
          reason: 'Switching to dedicated corporate account',
        },
      });

      const res = await adminSettingsPutHandler(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.settings.upiId, 'jobnexus.production@icici');
      assert.strictEqual(json.settings.payeeName, 'JobNexus Corporate Payee');
      assert.strictEqual(json.settings.version, 1);

      // Verify subsequent GET returns the new settings
      const getReq = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });
      const getRes = await adminSettingsGetHandler(getReq);
      const getJson = await getRes.json();
      assert.strictEqual(getJson.settings.upiId, 'jobnexus.production@icici');
      assert.strictEqual(getJson.settings.isConfiguredInFirestore, true);

      // Verify audit log
      const auditColData = mockStore.getCollectionData(FIRESTORE_COLLECTIONS.ADMIN_AUDIT_LOGS);
      assert.strictEqual(auditColData.size, 1);
    });

    it('Billing Order creation integrates with updated settings snapshot', async () => {
      // 1. Admin updates payment settings to custom UPI
      const adminUser = findOrCreateGoogleUser({
        email: ADMIN_EMAIL,
        name: 'Admin User',
        sub: 'admin_user_sub',
      });
      const adminSession = createSession(adminUser.id);

      await adminSettingsPutHandler(
        createMockRequest('/api/admin/billing/settings', {
          method: 'PUT',
          cookie: adminSession.sessionId,
          body: {
            upiId: 'custom.billing@oksbi',
            payeeName: 'JobNexus Billing Services',
            paymentDescription: 'JobNexus Premium 30-Day',
          },
        })
      );

      // 2. Candidate user requests order via POST /api/billing/order
      const candidateUser = findOrCreateGoogleUser({
        email: REGULAR_USER_EMAIL,
        name: 'Candidate User',
        sub: 'cand_user_999',
      });
      const candidateSession = createSession(candidateUser.id);

      const orderPostReq = createMockRequest('/api/billing/order', {
        method: 'POST',
        cookie: candidateSession.sessionId,
        body: { planId: 'premium_monthly' },
      });

      const orderPostRes = await billingOrderPostHandler(orderPostReq);
      assert.strictEqual(orderPostRes.status, 201);

      const orderPostJson = await orderPostRes.json();
      assert.strictEqual(orderPostJson.success, true);
      assert.strictEqual(orderPostJson.order.upiId, 'custom.billing@oksbi');
      assert.strictEqual(orderPostJson.order.payeeName, 'JobNexus Billing Services');
      assert.strictEqual(orderPostJson.instructions.upiId, 'custom.billing@oksbi');
      assert.strictEqual(orderPostJson.instructions.payeeName, 'JobNexus Billing Services');
      assert.match(orderPostJson.instructions.note, /JobNexus Premium 30-Day/);
    });
  });
});
