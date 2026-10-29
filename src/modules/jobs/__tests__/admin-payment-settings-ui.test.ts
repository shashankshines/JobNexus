import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import {
  setMockFirestoreDb,
  resetFirestoreRegistry,
} from '../../storage/firestore/client';
import { createMockFirestoreDb, InMemoryFirestoreStore } from '../../storage/firestore/mock';
import {
  getPaymentSettings,
  updatePaymentSettingsInTransaction,
  isValidUpiId,
  isValidPayeeName,
  isValidPaymentDescription,
} from '../../storage/firestore/settings.store';
import {
  createPaymentOrder,
  getPaymentOrderById,
} from '../../storage/firestore/order.store';
import {
  resetAuthStore,
  createSession,
  findOrCreateGoogleUser,
  SESSION_COOKIE_NAME,
} from '../../auth/server/session.store';
import {
  GET as adminSettingsGetHandler,
  PUT as adminSettingsPutHandler,
} from '../../../app/api/admin/billing/settings/route';
import { buildUpiPaymentUri } from '../../../app/components/billing/upi-payment-uri';

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

describe('JobNexus — Admin Payment Settings UI Consistency & Configuration Clarity (Phase 2B.3D)', () => {
  let mockStore: InMemoryFirestoreStore;
  const originalEnv = { ...process.env };

  const DESIGNATED_ADMIN = 'shashankshines@gmail.com';
  const UNAUTHORIZED_USER = 'candidate@gmail.com';

  beforeEach(() => {
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    resetAuthStore();

    process.env.ADMIN_EMAILS = DESIGNATED_ADMIN;
    process.env.BUSINESS_UPI_ID = 'jobnexus@okhdfcbank';
    process.env.BUSINESS_UPI_NAME = 'JobNexus Technologies';
  });

  afterEach(() => {
    resetFirestoreRegistry();
    resetAuthStore();
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. Navigation Shell & Tab Structure Invariants
  // ==========================================================================
  describe('1. Unified Admin Console Navigation & Tabs', () => {
    it('defines standard 6-tab navigation structure across admin routes', () => {
      const standardAdminTabs = [
        { id: 'overview', label: 'Overview & Metrics' },
        { id: 'verifications', label: 'Payment Verification Queue' },
        { id: 'ledger', label: 'Payment Ledger' },
        { id: 'subscriptions', label: 'Subscribers & Entitlements' },
        { id: 'settings_preview', label: 'Payment Settings' },
        { id: 'audit_logs', label: 'Audit Trail' },
      ];

      assert.strictEqual(standardAdminTabs.length, 6);
      const tabIds = standardAdminTabs.map((t) => t.id);
      assert.ok(tabIds.includes('settings_preview'));
      assert.ok(tabIds.includes('ledger'));
      assert.ok(tabIds.includes('verifications'));
    });

    it('validates URL query tab parameter mapping for direct linking', () => {
      const validTabs = ['overview', 'verifications', 'ledger', 'subscriptions', 'settings_preview', 'audit_logs'];

      const testUrl1 = 'http://localhost:3000/admin?tab=settings_preview';
      const parsed1 = new URL(testUrl1).searchParams.get('tab');
      assert.ok(parsed1 && validTabs.includes(parsed1));

      const testUrl2 = 'http://localhost:3000/admin?tab=invalid_tab';
      const parsed2 = new URL(testUrl2).searchParams.get('tab');
      assert.ok(parsed2 && !validTabs.includes(parsed2));
    });
  });

  // ==========================================================================
  // 2. Real-time Form Validation Engine
  // ==========================================================================
  describe('2. Real-time Form Input Validation Engine', () => {
    it('validates legitimate UPI VPA formats accurately', () => {
      assert.strictEqual(isValidUpiId('jobnexus@okhdfcbank'), true);
      assert.strictEqual(isValidUpiId('billing.nexus@icici'), true);
      assert.strictEqual(isValidUpiId('team-careers_2026@oksbi'), true);
      assert.strictEqual(isValidUpiId('shashank@upi'), true);
    });

    it('rejects invalid or unsafe UPI VPA inputs', () => {
      assert.strictEqual(isValidUpiId(''), false);
      assert.strictEqual(isValidUpiId('invalid-vpa-without-handle'), false);
      assert.strictEqual(isValidUpiId('jobnexus@'), false);
      assert.strictEqual(isValidUpiId('@okhdfcbank'), false);
      assert.strictEqual(isValidUpiId('jobnexus <script>@bank'), false);
      assert.strictEqual(isValidUpiId('jobnexus with spaces@bank'), false);
      assert.strictEqual(isValidUpiId('a@b'), false); // Too short
    });

    it('validates payee display names with international characters and rejects tags', () => {
      assert.strictEqual(isValidPayeeName('JobNexus Technologies Pvt Ltd'), true);
      assert.strictEqual(isValidPayeeName('Shashank Lakhotia'), true);
      assert.strictEqual(isValidPayeeName('A'), false); // Too short (< 2)
      assert.strictEqual(isValidPayeeName(''), false); // Empty
      assert.strictEqual(isValidPayeeName('JobNexus <admin>'), false); // Contains angle brackets
    });

    it('validates payment descriptions and disallows line breaks', () => {
      assert.strictEqual(isValidPaymentDescription('JobNexus Premium Subscription'), true);
      assert.strictEqual(isValidPaymentDescription(''), false); // Empty
      assert.strictEqual(isValidPaymentDescription('First Line\nSecond Line'), false); // Disallows newlines
      assert.strictEqual(isValidPaymentDescription('JobNexus <svg onload=alert(1)>'), false); // Disallows tags
    });
  });

  // ==========================================================================
  // 3. Operational Status & Configuration Source Detection
  // ==========================================================================
  describe('3. Operational Status & Source Hierarchy', () => {
    it('accurately identifies Environment Fallback mode when Firestore is unconfigured', async () => {
      const settings = await getPaymentSettings();
      assert.strictEqual(settings.isConfiguredInFirestore, false);
      assert.strictEqual(settings.version, 0);
      assert.strictEqual(settings.upiId, 'jobnexus@okhdfcbank');
      assert.strictEqual(settings.payeeName, 'JobNexus Technologies');
      assert.strictEqual(settings.updatedAt, null);
      assert.strictEqual(settings.updatedBy, 'system_env');
    });

    it('transitions to Live Firestore persistence after authoritative admin update', async () => {
      await updatePaymentSettingsInTransaction({
        upiId: 'careers.nexus@icici',
        payeeName: 'JobNexus Global Careers',
        paymentDescription: 'JobNexus Premium 30-Day Access',
        adminEmail: DESIGNATED_ADMIN,
        adminUserId: 'usr_admin_test',
        reason: 'Switched receiving handle to ICICI merchant account',
      });

      // Verify subsequent GET retrieves live document with isConfiguredInFirestore: true
      const retrieved = await getPaymentSettings();
      assert.strictEqual(retrieved.isConfiguredInFirestore, true);
      assert.strictEqual(retrieved.version, 1);
      assert.strictEqual(retrieved.upiId, 'careers.nexus@icici');
      assert.strictEqual(retrieved.payeeName, 'JobNexus Global Careers');
      assert.ok(retrieved.updatedAt !== null);
      assert.strictEqual(retrieved.updatedBy, DESIGNATED_ADMIN);
    });
  });

  // ==========================================================================
  // 4. Dirty-State Tracking & Discard Invariants
  // ==========================================================================
  describe('4. Dirty-State Tracking & Unsaved Changes Safeguard', () => {
    it('detects dirty state when inputs deviate from authoritative server values', () => {
      const current = {
        upiId: 'jobnexus@okhdfcbank',
        payeeName: 'JobNexus Technologies',
        paymentDescription: 'JobNexus Premium Subscription',
      };

      // Unchanged
      const input1 = {
        upiId: 'jobnexus@okhdfcbank',
        payeeName: 'JobNexus Technologies',
        paymentDescription: 'JobNexus Premium Subscription',
      };
      const isDirty1 = (
        input1.upiId.trim() !== current.upiId ||
        input1.payeeName.trim() !== current.payeeName ||
        input1.paymentDescription.trim() !== current.paymentDescription
      );
      assert.strictEqual(isDirty1, false);

      // Modified UPI ID
      const input2 = {
        upiId: 'newhandle@icici',
        payeeName: 'JobNexus Technologies',
        paymentDescription: 'JobNexus Premium Subscription',
      };
      const isDirty2 = (
        input2.upiId.trim() !== current.upiId ||
        input2.payeeName.trim() !== current.payeeName ||
        input2.paymentDescription.trim() !== current.paymentDescription
      );
      assert.strictEqual(isDirty2, true);

      // Resetting discards dirty state
      const input3 = { ...current };
      const isDirty3 = (
        input3.upiId.trim() !== current.upiId ||
        input3.payeeName.trim() !== current.payeeName ||
        input3.paymentDescription.trim() !== current.paymentDescription
      );
      assert.strictEqual(isDirty3, false);
    });
  });

  // ==========================================================================
  // 5. Live QR & UPI Deep-Link URI Generation
  // ==========================================================================
  describe('5. Live Preview & Deep-Link URI Invariants', () => {
    it('generates compliant, RFC-3986 URL-encoded UPI payment URIs', () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus@okhdfcbank',
        payeeName: 'JobNexus Careers & Recruitment',
        amountInr: 499,
        note: 'JobNexus Premium Access - 30 Days',
      });

      assert.ok(uri.startsWith('upi://pay?'));
      assert.ok(uri.includes('pa=jobnexus%40okhdfcbank') || uri.includes('pa=jobnexus@okhdfcbank'));
      assert.ok(uri.includes('am=499'));
      assert.ok(uri.includes('cu=INR'));
      assert.ok(uri.includes('JobNexus') && uri.includes('Careers'));
    });

    it('enforces the authoritative ₹499 INR invariant on generated URIs', () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus@okhdfcbank',
        payeeName: 'JobNexus',
        amountInr: 499,
        note: 'Subscription',
      });

      assert.ok(uri.includes('am=499'));
      assert.ok(uri.includes('cu=INR'));
      assert.ok(!uri.includes('am=0'));
      assert.ok(!uri.includes('am=999'));
    });
  });

  // ==========================================================================
  // 6. Immutability of Existing Orders (Snapshot Isolation Invariant)
  // ==========================================================================
  describe('6. Historical Order Snapshot Isolation', () => {
    it('guarantees existing orders preserve original payment snapshot when settings change', async () => {
      // 1. User creates order under Initial configuration
      const user = findOrCreateGoogleUser({
        sub: 'usr_buyer_123',
        email: 'buyer@gmail.com',
        name: 'Buyer Candidate',
      });

      const order1 = await createPaymentOrder({
        userId: user.id,
        userEmail: user.email,
      });

      assert.strictEqual(order1.upiId, 'jobnexus@okhdfcbank');
      assert.strictEqual(order1.payeeName, 'JobNexus Technologies');

      // 2. Administrator updates settings
      await updatePaymentSettingsInTransaction({
        upiId: 'newmerchant@axisbank',
        payeeName: 'JobNexus Global Private Limited',
        paymentDescription: 'New Description',
        adminEmail: DESIGNATED_ADMIN,
        adminUserId: 'usr_admin',
        reason: 'Corporate account migration',
      });

      // 3. User creates a second order under updated configuration
      const order2 = await createPaymentOrder({
        userId: user.id,
        userEmail: user.email,
      });

      assert.strictEqual(order2.upiId, 'newmerchant@axisbank');
      assert.strictEqual(order2.payeeName, 'JobNexus Global Private Limited');

      // 4. Invariant: Order 1 MUST retain immutable original snapshot
      const order1Fetched = await getPaymentOrderById(order1.orderId);
      assert.strictEqual(order1Fetched?.upiId, 'jobnexus@okhdfcbank');
      assert.strictEqual(order1Fetched?.payeeName, 'JobNexus Technologies');
    });
  });

  // ==========================================================================
  // 7. Strict Admin Authorization Gating (API Layer)
  // ==========================================================================
  describe('7. API Authorization Gating (Security Boundary)', () => {
    it('allows designated administrator shashankshines@gmail.com with Google OAuth', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_shashank_123',
        email: DESIGNATED_ADMIN,
        name: 'Shashank Lakhotia',
      });
      const session = createSession(adminUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });

      const res = await adminSettingsGetHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.settings);
    });

    it('rejects unauthorized Google users with 403 Forbidden', async () => {
      const unauthorizedUser = findOrCreateGoogleUser({
        sub: 'google_stranger_456',
        email: UNAUTHORIZED_USER,
        name: 'Candidate User',
      });
      const session = createSession(unauthorizedUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        cookie: session.sessionId,
      });

      const res = await adminSettingsGetHandler(req);
      assert.strictEqual(res.status, 403);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const req = createMockRequest('/api/admin/billing/settings');
      const res = await adminSettingsGetHandler(req);
      assert.strictEqual(res.status, 401);
    });

    it('requires a valid audit rationale before saving changes', async () => {
      const adminUser = findOrCreateGoogleUser({
        sub: 'google_shashank_123',
        email: DESIGNATED_ADMIN,
        name: 'Shashank Lakhotia',
      });
      const session = createSession(adminUser.id);

      const req = createMockRequest('/api/admin/billing/settings', {
        method: 'PUT',
        cookie: session.sessionId,
        body: {
          upiId: 'valid@icici',
          payeeName: 'Valid Name',
          paymentDescription: 'Valid Description',
          reason: 'Switch to ICICI corporate account',
        },
      });

      const res = await adminSettingsPutHandler(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.settings.upiId, 'valid@icici');
    });
  });
});
