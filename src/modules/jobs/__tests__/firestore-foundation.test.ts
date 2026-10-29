import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  isFirestoreConfigured,
  getFirebaseAdminApp,
  getFirestoreDb,
  resetFirestoreRegistry,
} from '../../storage/firestore/client';
import {
  FIRESTORE_COLLECTIONS,
  getOrdersCollection,
  getSubmissionsCollection,
  getUtrReservationsCollection,
  getSubscriptionsCollection,
  getAuditLogsCollection,
  getEmailOutboxCollection,
} from '../../storage/firestore/collections';
import {
  normalizeUtr,
  isValidUtrFormat,
  UtrCollisionError,
} from '../../storage/firestore/utr-reservation';
import {
  getUserEntitlement,
  hasActivePremiumAccess,
} from '../../billing/services/entitlement.service';
import { PREMIUM_PLAN, SubscriptionRecord } from '../../billing/domain/subscription.types';
import { saveSubscription, resetSubscriptionStore } from '../../billing/services/subscription.store';
import { resetAuthStore, registerCredentialsUser, createSession, validateSession } from '../../auth/server/session.store';

describe('JobNexus Phase 2A — Firestore Foundation & Data Integrity Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetFirestoreRegistry();
    resetSubscriptionStore();
    resetAuthStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetFirestoreRegistry();
  });

  // =========================================================================
  // 1. Configuration Validation & Fail-Closed Behavior
  // =========================================================================
  describe('1. Configuration & Client Singleton Initialization', () => {
    it('reports isFirestoreConfigured = false when required credentials are missing', () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      assert.strictEqual(isFirestoreConfigured(), false);
    });

    it('reports isFirestoreConfigured = true when FIRESTORE_EMULATOR_HOST is present', () => {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      assert.strictEqual(isFirestoreConfigured(), true);
    });

    it('fails closed with a descriptive error when Firestore is accessed without credentials', () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      assert.throws(
        () => {
          getFirestoreDb();
        },
        /Missing server credentials/
      );
    });

    it('initializes Firebase Admin App singleton when emulator environment is configured', () => {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      process.env.FIREBASE_PROJECT_ID = 'jobnexus-98b60';

      const app1 = getFirebaseAdminApp();
      const app2 = getFirebaseAdminApp();
      assert.strictEqual(app1, app2, 'getFirebaseAdminApp must return the exact same singleton instance');
      assert.ok(app1.name);
    });

    it('returns the same Firestore database instance on repeated getFirestoreDb calls', () => {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      process.env.FIREBASE_PROJECT_ID = 'jobnexus-98b60';

      const db1 = getFirestoreDb();
      const db2 = getFirestoreDb();
      assert.strictEqual(db1, db2, 'getFirestoreDb must return the cached singleton instance');
    });
  });

  // =========================================================================
  // 2. Collection Names & Typed Document Collections
  // =========================================================================
  describe('2. Canonical Collection Contracts', () => {
    it('defines authoritative collection names matching architecture specs', () => {
      assert.strictEqual(FIRESTORE_COLLECTIONS.ORDERS, 'upi_orders');
      assert.strictEqual(FIRESTORE_COLLECTIONS.SUBMISSIONS, 'upi_submissions');
      assert.strictEqual(FIRESTORE_COLLECTIONS.UTR_RESERVATIONS, 'upi_utr_reservations');
      assert.strictEqual(FIRESTORE_COLLECTIONS.SUBSCRIPTIONS, 'billing_subscriptions');
      assert.strictEqual(FIRESTORE_COLLECTIONS.ADMIN_AUDIT_LOGS, 'admin_audit_logs');
      assert.strictEqual(FIRESTORE_COLLECTIONS.EMAIL_OUTBOX, 'email_outbox');
    });

    it('provides valid collection references from Firestore db', () => {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      process.env.FIREBASE_PROJECT_ID = 'jobnexus-98b60';

      assert.strictEqual(getOrdersCollection().id, 'upi_orders');
      assert.strictEqual(getSubmissionsCollection().id, 'upi_submissions');
      assert.strictEqual(getUtrReservationsCollection().id, 'upi_utr_reservations');
      assert.strictEqual(getSubscriptionsCollection().id, 'billing_subscriptions');
      assert.strictEqual(getAuditLogsCollection().id, 'admin_audit_logs');
      assert.strictEqual(getEmailOutboxCollection().id, 'email_outbox');
    });
  });

  // =========================================================================
  // 3. UTR Normalization, Validation & Collision Detection
  // =========================================================================
  describe('3. UTR Normalization & Format Validation', () => {
    it('normalizes standard 12-digit numeric bank UTRs accurately', () => {
      assert.strictEqual(normalizeUtr('412345678901'), '412345678901');
      assert.strictEqual(normalizeUtr('  412345678901  '), '412345678901');
      assert.strictEqual(normalizeUtr('UPI/412345678901'), '412345678901');
      assert.strictEqual(normalizeUtr('utr: 412345678901'), '412345678901');
      assert.strictEqual(normalizeUtr('TXN: 4123-4567-8901'), '412345678901');
      assert.strictEqual(normalizeUtr('Ref: #412345678901'), '412345678901');
    });

    it('normalizes alphanumeric provider transaction references to uppercase', () => {
      assert.strictEqual(normalizeUtr('paytm_txn_9876543210'), 'PAYTMTXN9876543210');
      assert.strictEqual(normalizeUtr('axis-upi-abc123xyz45'), 'AXISUPIABC123XYZ45');
    });

    it('validates legitimate 12-digit numeric bank UTR formats', () => {
      assert.strictEqual(isValidUtrFormat('429384729104'), true);
      assert.strictEqual(isValidUtrFormat('UPI/501928374619'), true);
      assert.strictEqual(isValidUtrFormat('318294719203'), true);
    });

    it('validates legitimate 10-22 char alphanumeric provider references', () => {
      assert.strictEqual(isValidUtrFormat('PAYTM20261029XYZ8'), true);
      assert.strictEqual(isValidUtrFormat('GPay9876543210'), true);
      assert.strictEqual(isValidUtrFormat('AXIS1234567890AB'), true);
    });

    it('rejects trivial, malformed, or bogus references', () => {
      assert.strictEqual(isValidUtrFormat(''), false);
      assert.strictEqual(isValidUtrFormat('123'), false); // Too short
      assert.strictEqual(isValidUtrFormat('1234567890123456789012345'), false); // Too long (>22)
      assert.strictEqual(isValidUtrFormat('000000000000'), false); // Trivial pattern
      assert.strictEqual(isValidUtrFormat('123456789012'), false); // Trivial sequential
      assert.strictEqual(isValidUtrFormat('111111111111'), false); // All same digit
      assert.strictEqual(isValidUtrFormat('AAAAAAAAAAAA'), false); // All same letter
      assert.strictEqual(isValidUtrFormat('TESTTRANSACTION'), false); // Blocklisted test token
    });

    it('constructs UtrCollisionError with metadata', () => {
      const err = new UtrCollisionError('412345678901', 'ord_123');
      assert.strictEqual(err.name, 'UtrCollisionError');
      assert.strictEqual(err.utr, '412345678901');
      assert.strictEqual(err.existingOrderId, 'ord_123');
      assert.ok(err.message.includes('already been registered'));
    });
  });

  // =========================================================================
  // 4. Entitlement & Existing Billing System Compatibility
  // =========================================================================
  describe('4. Entitlement Service & Existing Billing Compatibility', () => {
    it('preserves existing entitlement evaluation with provider: "manual"', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 86400 * 1000);

      const manualSub: SubscriptionRecord = {
        id: 'sub_manual_test_1',
        userId: 'usr_manual_test_1',
        planId: PREMIUM_PLAN.id,
        status: 'active',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: future.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        paymentReference: '429384729104',
      };

      saveSubscription(manualSub);

      const ent = getUserEntitlement('usr_manual_test_1');
      assert.strictEqual(ent.isPremium, true);
      assert.strictEqual(ent.tier, 'premium');
      assert.strictEqual(ent.status, 'active');
      assert.strictEqual(ent.subscription?.provider, 'manual');
      assert.strictEqual(hasActivePremiumAccess('usr_manual_test_1'), true);
    });

    it('keeps pending manual subscriptions at free tier with fail-closed semantics', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 86400 * 1000);

      saveSubscription({
        id: 'sub_manual_pending_1',
        userId: 'usr_manual_pending_1',
        planId: PREMIUM_PLAN.id,
        status: 'pending',
        provider: 'manual',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: future.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      const ent = getUserEntitlement('usr_manual_pending_1');
      assert.strictEqual(ent.isPremium, false);
      assert.strictEqual(ent.tier, 'free');
      assert.strictEqual(hasActivePremiumAccess('usr_manual_pending_1'), false);
    });

    it('preserves user authentication and session validation completely unaffected', () => {
      const reg = registerCredentialsUser({
        email: 'engineer@jobnexus.dev',
        password: 'Password@123',
        name: 'Dev Engineer',
      });
      assert.ok(reg.user);

      const session = createSession(reg.user.id);
      const validated = validateSession(session.sessionId);
      assert.strictEqual(validated.valid, true);
      assert.strictEqual(validated.user?.id, reg.user.id);
      assert.strictEqual(validated.user?.email, 'engineer@jobnexus.dev');
    });
  });

  // =========================================================================
  // 5. Cloud Firestore Security Rules Static Verification
  // =========================================================================
  describe('5. Cloud Firestore Security Rules (firestore.rules) Verification', () => {
    it('verifies firestore.rules exists and enforces zero-trust default-deny for all client access', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      assert.strictEqual(fs.existsSync(rulesPath), true, 'firestore.rules must exist in the project root');

      const content = fs.readFileSync(rulesPath, 'utf8');
      assert.ok(content.includes("rules_version = '2';"), 'Must declare rules_version = 2');
      assert.ok(content.includes('service cloud.firestore'), 'Must declare service cloud.firestore');
      assert.ok(
        content.includes('match /{document=**}') && content.includes('allow read, write: if false;'),
        'Must declare default deny fallback on root'
      );

      // Verify all canonical collections are explicitly matched and locked down
      const canonicalCollections = [
        'upi_orders',
        'upi_submissions',
        'upi_utr_reservations',
        'billing_subscriptions',
        'admin_audit_logs',
        'email_outbox',
      ];

      for (const col of canonicalCollections) {
        assert.ok(
          content.includes(`match /${col}/`),
          `firestore.rules must explicitly mention collection ${col}`
        );
      }

      // Verify no permissive read or write access is granted to public or authenticated Web SDK
      assert.strictEqual(
        content.includes('allow read: if true'),
        false,
        'Must never contain allow read: if true'
      );
      assert.strictEqual(
        content.includes('allow write: if true'),
        false,
        'Must never contain allow write: if true'
      );
      assert.strictEqual(
        content.includes('allow read, write: if true'),
        false,
        'Must never contain allow read, write: if true'
      );
    });
  });
});

