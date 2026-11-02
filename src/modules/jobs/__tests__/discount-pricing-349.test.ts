import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  InMemoryFirestoreStore,
  createMockFirestoreDb,
} from '@/modules/storage/firestore/mock';
import { setMockFirestoreDb } from '@/modules/storage/firestore/client';
import {
  getOrdersCollection,
  type PaymentOrderDocument,
} from '@/modules/storage/firestore/collections';
import {
  createPaymentOrder,
  createPaymentSubmission,
  getActiveOrderForUser,
} from '@/modules/storage/firestore/order.store';
import {
  approvePaymentSubmissionInTransaction,
  getAdminOverview,
  getConsolidatedPaymentLedger,
  invalidateAdminStoresCache,
  OrderValidationError,
} from '@/modules/storage/firestore/admin-billing.store';
import { invalidateUserEntitlementCache } from '@/modules/billing/services/entitlement.service';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';
import { resolveBillingFlowSnapshot } from '@/modules/billing/domain/billing-flow-state';
import { evaluateRenewalWindow, DAY_MS } from '@/modules/billing/domain/renewal-window';
import {
  getSimulationProvider,
  resetEmailServiceForTesting,
} from '@/modules/email/email.service';
import { renderSubscriptionExpiringEmail } from '@/modules/email/templates/subscription-expiring.template';
import { renderSubscriptionExpiredEmail } from '@/modules/email/templates/subscription-expired.template';
import { renderPaymentApprovedEmail } from '@/modules/email/templates/payment-approved.template';
import { buildUpiPaymentUri } from '@/app/components/billing/upi-payment-uri';

describe('Discounted ₹349 (Struck-Out ₹499) End-to-End Pricing & Backward Compatibility', () => {
  let mockStore: InMemoryFirestoreStore;

  beforeEach(() => {
    mockStore = new InMemoryFirestoreStore();
    setMockFirestoreDb(createMockFirestoreDb(mockStore));
    invalidateAdminStoresCache();
    invalidateUserEntitlementCache();
    resetEmailServiceForTesting();
  });

  afterEach(() => {
    setMockFirestoreDb(undefined);
    invalidateAdminStoresCache();
    invalidateUserEntitlementCache();
    resetEmailServiceForTesting();
  });

  it('1. enforces ₹349 discounted price with ₹499 struck-out anchor in PREMIUM_PLAN and UPI QR URIs', () => {
    assert.strictEqual(PREMIUM_PLAN.originalPriceInr, 499);
    assert.strictEqual(PREMIUM_PLAN.originalAmountInPaise, 49900);
    assert.strictEqual(PREMIUM_PLAN.priceInr, 349);
    assert.strictEqual(PREMIUM_PLAN.amountInPaise, 34900);
    assert.strictEqual(PREMIUM_PLAN.discountPercent, 30);
    assert.strictEqual(PREMIUM_PLAN.savingsInr, 150);

    const uri = buildUpiPaymentUri({
      upiId: 'jobnexus@icici',
      payeeName: 'JobNexus Official',
      amountInr: PREMIUM_PLAN.priceInr,
      orderId: 'ord_discount_349',
    });
    assert.ok(uri.includes('am=349'));
    assert.strictEqual(uri.includes('am=499'), false);
  });

  it('2. supersedes stale unsubmitted ₹499 orders in getActiveOrderForUser and resolveBillingFlowSnapshot so users get fresh ₹349 QR', async () => {
    const stale499Order: PaymentOrderDocument = {
      orderId: 'ord_stale_499',
      userId: 'usr_stale_upgrade',
      userEmail: 'seeker@example.com',
      planId: 'premium_monthly',
      amountInr: 499,
      amountInPaise: 49900,
      currency: 'INR',
      status: 'created',
      upiId: 'jobnexus@icici',
      payeeName: 'JobNexus',
      createdAt: new Date(Date.now() - 10_000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 3600_000).toISOString(),
    };
    await getOrdersCollection().doc(stale499Order.orderId).set(stale499Order);

    // Must NOT reuse stale ₹499 unsubmitted order
    const activeBefore = await getActiveOrderForUser('usr_stale_upgrade');
    assert.strictEqual(activeBefore, null);

    // Pure state resolver must also route stale ₹499 unsubmitted order back to plan_review
    const snapshot = resolveBillingFlowSnapshot({
      entitlement: {
        userId: 'usr_stale_upgrade',
        isPremium: false,
        tier: 'free',
        status: 'free',
        reason: 'Free tier',
      },
      submissions: [],
      activeOrder: stale499Order,
    });
    assert.strictEqual(snapshot.step, 'plan_review');
    assert.strictEqual(snapshot.order, null);

    // Creating a new order issues ₹349 and IS reused on subsequent active-order checks
    const freshOrder = await createPaymentOrder({
      userId: 'usr_stale_upgrade',
      userEmail: 'seeker@example.com',
    });
    assert.strictEqual(freshOrder.amountInr, 349);
    assert.strictEqual(freshOrder.amountInPaise, 34900);

    const activeAfter = await getActiveOrderForUser('usr_stale_upgrade');
    assert.ok(activeAfter);
    assert.strictEqual(activeAfter.orderId, freshOrder.orderId);
    assert.strictEqual(activeAfter.amountInr, 349);
  });

  it('3. preserves approval compatibility for pre-existing ₹499 pending submissions, approves new ₹349 submissions, rejects tampered amounts, and sums mixed revenue accurately', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Pre-discount ₹499 order already submitted and awaiting admin verification
    const legacyOrder: PaymentOrderDocument = {
      orderId: 'ord_legacy_499',
      userId: 'usr_legacy_499',
      userEmail: 'legacy@example.com',
      planId: 'premium_monthly',
      amountInr: 499,
      amountInPaise: 49900,
      currency: 'INR',
      status: 'created',
      upiId: 'jobnexus@icici',
      payeeName: 'JobNexus',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    };
    await getOrdersCollection().doc(legacyOrder.orderId).set(legacyOrder);

    const legacySub = await createPaymentSubmission({
      orderId: legacyOrder.orderId,
      userId: 'usr_legacy_499',
      userEmail: 'legacy@example.com',
      utr: '499111222333',
      declaredAmount: 499,
      paymentDate: today,
    });

    // New discounted ₹349 order + submission
    const discountedOrder = await createPaymentOrder({
      userId: 'usr_discount_349',
      userEmail: 'discount@example.com',
    });
    assert.strictEqual(discountedOrder.amountInr, 349);

    const discountedSub = await createPaymentSubmission({
      orderId: discountedOrder.orderId,
      userId: 'usr_discount_349',
      userEmail: 'discount@example.com',
      utr: '349444555666',
      declaredAmount: 349,
      paymentDate: today,
    });

    // Tampered ₹199 order + submission MUST be rejected at approval time
    const tamperedOrder: PaymentOrderDocument = {
      orderId: 'ord_tampered_199',
      userId: 'usr_tampered_199',
      userEmail: 'tampered@example.com',
      planId: 'premium_monthly',
      amountInr: 199,
      amountInPaise: 19900,
      currency: 'INR',
      status: 'created',
      upiId: 'jobnexus@icici',
      payeeName: 'JobNexus',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    };
    await getOrdersCollection().doc(tamperedOrder.orderId).set(tamperedOrder);
    const tamperedSub = await createPaymentSubmission({
      orderId: tamperedOrder.orderId,
      userId: 'usr_tampered_199',
      userEmail: 'tampered@example.com',
      utr: '199777888999',
      declaredAmount: 199,
      paymentDate: today,
    });

    await assert.rejects(
      () =>
        approvePaymentSubmissionInTransaction({
          submissionId: tamperedSub.submissionId,
          adminEmail: 'admin@jobnexus.dev',
          adminUserId: 'adm_1',
        }),
      OrderValidationError
    );

    // Approve both historical ₹499 and discounted ₹349 submissions
    const legacyApproval = await approvePaymentSubmissionInTransaction({
      submissionId: legacySub.submissionId,
      adminEmail: 'admin@jobnexus.dev',
      adminUserId: 'adm_1',
    });
    assert.strictEqual(legacyApproval.success, true);

    const discountApproval = await approvePaymentSubmissionInTransaction({
      submissionId: discountedSub.submissionId,
      adminEmail: 'admin@jobnexus.dev',
      adminUserId: 'adm_1',
    });
    assert.strictEqual(discountApproval.success, true);

    // Approval emails reflect exact verified amount (₹499 vs ₹349)
    const sentEmails = getSimulationProvider().getSentEmails();
    const legacyEmail = sentEmails.find((e) => e.to === 'legacy@example.com');
    const discountEmail = sentEmails.find((e) => e.to === 'discount@example.com');
    assert.ok(legacyEmail && legacyEmail.html.includes('₹499'));
    assert.ok(discountEmail && discountEmail.html.includes('₹349'));

    // Overview and Ledger both report exact verified revenue: 499 + 349 = 848
    invalidateAdminStoresCache();
    const overview = await getAdminOverview();
    assert.strictEqual(overview.totalApprovedCount, 2);
    assert.strictEqual(overview.verifiedRevenueInr, 848);

    const ledger = await getConsolidatedPaymentLedger({});
    assert.strictEqual(ledger.summary.verifiedPaymentsCount, 2);
    assert.strictEqual(ledger.summary.verifiedPaymentAmountInr, 848);
  });

  it('4. renders struck-out ₹499 alongside discounted ₹349 across renewal windows and email templates', () => {
    const nowMs = Date.now();
    const expiringSnap = evaluateRenewalWindow({
      subscription: {
        id: 'sub_exp_soon',
        userId: 'usr_exp_soon',
        planId: 'premium_monthly',
        status: 'active',
        provider: 'manual_upi',
        currentPeriodStart: new Date(nowMs - 26 * DAY_MS).toISOString(),
        currentPeriodEnd: new Date(nowMs + 4 * DAY_MS).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(nowMs - 26 * DAY_MS).toISOString(),
        updatedAt: new Date(nowMs - 26 * DAY_MS).toISOString(),
      },
      nowMs,
    });
    assert.ok(expiringSnap.message.includes('₹349'));
    assert.ok(expiringSnap.message.includes('₹499'));

    const expiringEmail = renderSubscriptionExpiringEmail({
      userId: 'usr_exp_soon',
      subscriptionId: 'sub_exp_soon',
      recipientEmail: 'sub@example.com',
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: 349,
      currency: 'INR',
      currentPeriodEnd: new Date(nowMs + 4 * DAY_MS).toISOString(),
      daysRemaining: 4,
      hoursRemaining: 96,
      isUrgent24h: false,
      renewUrl: 'https://jobnexus.app/?renew=1',
    });
    assert.ok(expiringEmail.html.includes('<s'));
    assert.ok(expiringEmail.html.includes('₹499</s>'));
    assert.ok(expiringEmail.html.includes('₹349 INR'));
    assert.ok(expiringEmail.text.includes('₹349 INR (Discounted from ₹499)'));

    const expiredEmail = renderSubscriptionExpiredEmail({
      userId: 'usr_exp_soon',
      subscriptionId: 'sub_exp_soon',
      recipientEmail: 'sub@example.com',
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: 349,
      currency: 'INR',
      expiredAt: new Date(nowMs - DAY_MS).toISOString(),
      renewUrl: 'https://jobnexus.app/?renew=1',
    });
    assert.ok(expiredEmail.html.includes('<s'));
    assert.ok(expiredEmail.html.includes('₹499</s>'));
    assert.ok(expiredEmail.html.includes('₹349 INR'));
    assert.ok(expiredEmail.text.includes('₹349 INR (Discounted from ₹499)'));

    const approvedEmail = renderPaymentApprovedEmail({
      userId: 'usr_exp_soon',
      orderId: 'ord_349',
      submissionId: 'subm_349',
      recipientEmail: 'sub@example.com',
      planTitle: 'JobNexus Premium (30 Days)',
      amountInr: 349,
      currency: 'INR',
      currentPeriodStart: new Date(nowMs).toISOString(),
      currentPeriodEnd: new Date(nowMs + 30 * DAY_MS).toISOString(),
      statusUrl: 'https://jobnexus.app/?view=premium_active',
    });
    assert.ok(approvedEmail.html.includes('Your ₹349 UPI payment has been verified'));
    assert.strictEqual(approvedEmail.html.includes('₹499'), false);
  });

  it('5. verifies strikethrough <s>₹499</s> and discounted ₹349 presentation across all UI components', () => {
    const repoRoot = process.cwd();
    const upiFlowSrc = fs.readFileSync(
      path.join(repoRoot, 'src/app/components/billing/UpiPaymentFlow.tsx'),
      'utf8'
    );
    const homePageSrc = fs.readFileSync(
      path.join(repoRoot, 'src/app/page.tsx'),
      'utf8'
    );
    const paymentSettingsSrc = fs.readFileSync(
      path.join(repoRoot, 'src/app/components/admin/PaymentSettingsView.tsx'),
      'utf8'
    );

    // UpiPaymentFlow must render strikethrough originalPriceInr, discountPercent badge, and priceInr
    assert.ok(upiFlowSrc.includes('PREMIUM_PLAN.originalPriceInr'));
    assert.ok(upiFlowSrc.includes('PREMIUM_PLAN.priceInr'));
    assert.ok(upiFlowSrc.includes('PREMIUM_PLAN.discountPercent'));
    assert.ok(upiFlowSrc.includes('textDecoration: \'line-through\''));

    // Main app page must render <s> strikethrough originalPriceInr alongside priceInr in dropdown, renewal banner, and profile modal
    assert.ok(homePageSrc.includes('PREMIUM_PLAN.originalPriceInr'));
    assert.ok(homePageSrc.includes('PREMIUM_PLAN.priceInr'));
    assert.strictEqual(homePageSrc.includes('₹499'), false);

    // Admin payment settings preview must render strikethrough originalPriceInr + priceInr
    assert.ok(paymentSettingsSrc.includes('PREMIUM_PLAN.originalPriceInr'));
    assert.ok(paymentSettingsSrc.includes('PREMIUM_PLAN.priceInr'));
    assert.strictEqual(paymentSettingsSrc.includes('499'), false);
  });
});

