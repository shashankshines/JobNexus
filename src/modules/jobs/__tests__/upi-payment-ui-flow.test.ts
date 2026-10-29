import { describe, it } from 'node:test';
import assert from 'node:assert';
import QRCode from 'qrcode';
import { PREMIUM_PLAN } from '../../billing/domain/subscription.types';
import {
  buildUpiPaymentUri,
  isValidUpiPaymentUri,
} from '../../../app/components/billing/upi-payment-uri';

describe('JobNexus Phase 2B.2 — Manual UPI Payment UI & Submission Experience', () => {
  // ==========================================================================
  // 1. UPI Payment URI Construction & RFC 3986 Compliance
  // ==========================================================================
  describe('1. UPI Payment URI Construction & RFC 3986 Compliance', () => {
    it('constructs a compliant UPI URI with server-authoritative details', () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus',
        amountInr: 499,
        orderId: 'ord_test_123456',
        note: 'JobNexus Premium - ord_test_123456',
      });

      assert.ok(uri.startsWith('upi://pay?'));
      assert.ok(uri.includes('pa=jobnexus%40icici'));
      assert.ok(uri.includes('pn=JobNexus'));
      assert.ok(uri.includes('am=499'));
      assert.ok(uri.includes('cu=INR'));
      assert.ok(uri.includes('tr=ord_test_123456'));
      assert.strictEqual(isValidUpiPaymentUri(uri), true);
    });

    it('properly URL-encodes spaces and special characters in payee name and note', () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus.official@hdfcbank',
        payeeName: 'JobNexus Technologies Pvt. Ltd.',
        amountInr: 499,
        note: 'Membership Plan — Month 1 & ATS',
      });

      assert.ok(uri.includes('pn=JobNexus+Technologies+Pvt.+Ltd.'));
      assert.ok(uri.includes('tn=Membership+Plan+%E2%80%94+Month+1+%26+ATS'));
      assert.strictEqual(isValidUpiPaymentUri(uri), true);
    });

    it('rejects invalid or missing UPI ID (VPA)', () => {
      assert.throws(
        () =>
          buildUpiPaymentUri({
            upiId: '',
            amountInr: 499,
          }),
        /valid UPI ID/
      );

      assert.throws(
        () =>
          buildUpiPaymentUri({
            upiId: '   ',
            amountInr: 499,
          }),
        /valid UPI ID/
      );
    });

    it('rejects non-positive or invalid amounts', () => {
      assert.throws(
        () =>
          buildUpiPaymentUri({
            upiId: 'jobnexus@icici',
            amountInr: 0,
          }),
        /positive number/
      );

      assert.throws(
        () =>
          buildUpiPaymentUri({
            upiId: 'jobnexus@icici',
            amountInr: -499,
          }),
        /positive number/
      );

      assert.throws(
        () =>
          buildUpiPaymentUri({
            upiId: 'jobnexus@icici',
            amountInr: NaN,
          }),
        /positive number/
      );
    });

    it('validates UPI payment URIs with isValidUpiPaymentUri helper', () => {
      assert.strictEqual(
        isValidUpiPaymentUri('upi://pay?pa=jobnexus@icici&pn=JobNexus&am=499&cu=INR'),
        true
      );
      // Missing @ in pa
      assert.strictEqual(
        isValidUpiPaymentUri('upi://pay?pa=invalid_vpa&pn=JobNexus&am=499&cu=INR'),
        false
      );
      // Non-INR currency
      assert.strictEqual(
        isValidUpiPaymentUri('upi://pay?pa=jobnexus@icici&pn=JobNexus&am=499&cu=USD'),
        false
      );
      // Zero amount
      assert.strictEqual(
        isValidUpiPaymentUri('upi://pay?pa=jobnexus@icici&pn=JobNexus&am=0&cu=INR'),
        false
      );
      // Non-UPI scheme
      assert.strictEqual(
        isValidUpiPaymentUri('https://jobnexus.world/pay?pa=jobnexus@icici'),
        false
      );
    });
  });

  // ==========================================================================
  // 2. Local QR Code Generation & Scanning Contrast
  // ==========================================================================
  describe('2. Local QR Code Generation & Scanning Contrast', () => {
    it('generates a valid high-contrast Data URL locally using qrcode', async () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus',
        amountInr: PREMIUM_PLAN.priceInr,
        orderId: 'ord_qr_local_test',
      });

      const dataUrl = await QRCode.toDataURL(uri, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });

      assert.ok(dataUrl.startsWith('data:image/png;base64,'));
      assert.ok(dataUrl.length > 500); // Substantial image data
    });

    it('generates a clean SVG string locally with valid SVG structure', async () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus',
        amountInr: 499,
      });

      const svgString = await QRCode.toString(uri, {
        type: 'svg',
        margin: 2,
      });

      assert.ok(svgString.includes('<svg'));
      assert.ok(svgString.includes('</svg>'));
      assert.ok(svgString.includes('viewBox='));
    });
  });

  // ==========================================================================
  // 3. UI Pricing and Security Invariants
  // ==========================================================================
  describe('3. UI Pricing and Security Invariants', () => {
    it('authoritative plan price is strictly ₹499 across domain constants', () => {
      assert.strictEqual(PREMIUM_PLAN.priceInr, 499);
      assert.strictEqual(PREMIUM_PLAN.amountInPaise, 49900);
      assert.strictEqual(PREMIUM_PLAN.currency, 'INR');
      assert.strictEqual(PREMIUM_PLAN.id, 'premium_monthly');
    });

    it('plan benefits and legal disclaimer explicitly state cancellation and discovery nature', () => {
      assert.ok(PREMIUM_PLAN.benefits.length >= 4);
      assert.ok(PREMIUM_PLAN.cancellationPolicy.includes('Cancel anytime'));
      assert.ok(PREMIUM_PLAN.taxTerms.includes('₹499/month'));
      assert.ok(PREMIUM_PLAN.disclaimer.includes('does not guarantee interviews'));
    });

    it('ensures UPI URI never leaks sensitive server tokens or private secrets', () => {
      const uri = buildUpiPaymentUri({
        upiId: 'jobnexus@icici',
        payeeName: 'JobNexus Official',
        amountInr: 499,
        orderId: 'ord_public_reference_890',
        note: 'JobNexus Premium - ord_public_reference_890',
      });

      // Must not contain any bearer, secret, or private credentials
      assert.strictEqual(uri.includes('FIREBASE'), false);
      assert.strictEqual(uri.includes('private_key'), false);
      assert.strictEqual(uri.includes('session'), false);
      assert.strictEqual(uri.includes('secret'), false);
    });
  });

  // ==========================================================================
  // 4. Form Validation Logic for Payment Submissions
  // ==========================================================================
  describe('4. Form Validation Logic for Payment Submissions', () => {
    it('normalizes raw UTR inputs accurately (strips whitespace, dashes, slashes)', () => {
      const raw1 = '  4298-1729-3812  ';
      const clean1 = raw1.trim().toUpperCase().replace(/[\s\-_#/]/g, '');
      assert.strictEqual(clean1, '429817293812');

      const raw2 = 'UPI/ AXIS 1928374829 /pay';
      const clean2 = raw2.trim().toUpperCase().replace(/^(UPI\/|UTR:|REF:|TXN:)\s*/i, '').replace(/[\s\-_#/]/g, '');
      assert.strictEqual(clean2, 'AXIS1928374829PAY');
    });

    it('validates acceptable UTR length (10 to 22 characters)', () => {
      const isUtrValidLength = (utr: string) => {
        const clean = utr.trim().toUpperCase().replace(/[\s\-_#/]/g, '');
        return clean.length >= 10 && clean.length <= 22 && /^[A-Z0-9]+$/.test(clean);
      };

      assert.strictEqual(isUtrValidLength('429817293812'), true); // 12-char bank UTR
      assert.strictEqual(isUtrValidLength('AXIS19283748'), true); // 12-char provider ref
      assert.strictEqual(isUtrValidLength('123456789'), false); // 9-char (too short)
      assert.strictEqual(isUtrValidLength('12345678901234567890123'), false); // 23-char (too long)
      assert.strictEqual(isUtrValidLength('42981729@#$!'), false); // invalid characters
    });

    it('identifies and rejects trivial test patterns in form validation', () => {
      const isTrivialUtr = (utr: string) => {
        const clean = utr.trim().toUpperCase().replace(/[\s\-_#/]/g, '');
        return /^0+$/.test(clean) || /^1+$/.test(clean) || clean === '123456789012';
      };

      assert.strictEqual(isTrivialUtr('000000000000'), true);
      assert.strictEqual(isTrivialUtr('111111111111'), true);
      assert.strictEqual(isTrivialUtr('123456789012'), true);
      assert.strictEqual(isTrivialUtr('429817293812'), false);
    });
  });
});

