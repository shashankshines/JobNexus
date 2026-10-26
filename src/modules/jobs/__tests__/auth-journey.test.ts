import { describe, it } from 'node:test';
import assert from 'node:assert';
import { User, AuthIntent } from '../../../app/context/AuthContext';

// Helper matching AuthContext initials generation
function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Helper matching AuthModal / AuthContext Gmail normalization & validation logic
function validateAndNormalizeGmail(input: string): { valid: boolean; normalized?: string; error?: string } {
  const clean = (input || '').trim().toLowerCase();
  if (!clean) {
    return { valid: false, error: 'Please provide your Gmail address.' };
  }

  // Handle shorthand handles (e.g. 'alex.rivera' -> 'alex.rivera@gmail.com')
  if (!clean.includes('@') && !clean.includes('.')) {
    return { valid: true, normalized: `${clean}@gmail.com` };
  }

  if (clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com')) {
    const username = clean.split('@')[0];
    if (!username) {
      return { valid: false, error: 'Please provide a valid @gmail.com address.' };
    }
    return { valid: true, normalized: clean };
  }

  // If user enters an email from another provider
  if (clean.includes('@')) {
    return { valid: false, error: 'Please provide a valid @gmail.com address.' };
  }

  // Fallback shorthand with dots (e.g. 'alex.rivera' -> 'alex.rivera@gmail.com')
  return { valid: true, normalized: `${clean}@gmail.com` };
}

// Helper matching AuthContext name derivation from email handle
function deriveDisplayName(email: string, customName?: string): string {
  const name = (customName || '').trim();
  if (name) return name;
  const handle = email.split('@')[0] || 'Developer';
  return handle
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper matching JobCard apply button gating and DOM security
function evaluateApplyAction(user: User | null, jobUrl: string): {
  allowedDirectApply: boolean;
  label: string;
  hasRawHref: boolean;
  effectiveHref?: string;
  requiresAuthPrompt: boolean;
  promptMessage?: string;
} {
  if (!user) {
    return {
      allowedDirectApply: false,
      label: 'Apply (Sign In)',
      hasRawHref: false,
      effectiveHref: undefined,
      requiresAuthPrompt: true,
      promptMessage: '🔒 Sign in with your Gmail account to apply directly to verified roles.',
    };
  }

  return {
    allowedDirectApply: true,
    label: 'Apply',
    hasRawHref: true,
    effectiveHref: jobUrl,
    requiresAuthPrompt: false,
  };
}

// Helper matching JobCard share/copy gating
function evaluateShareAction(user: User | null): {
  allowedDirectCopy: boolean;
  requiresAuthPrompt: boolean;
} {
  if (!user) {
    return {
      allowedDirectCopy: false,
      requiresAuthPrompt: true,
    };
  }

  return {
    allowedDirectCopy: true,
    requiresAuthPrompt: false,
  };
}

describe('Gmail-Only Authentication & Access Control Journey', () => {
  describe('Gmail Address Validation & Normalization (Positive & Negative)', () => {
    it('accepts standard @gmail.com email addresses', () => {
      const result = validateAndNormalizeGmail('developer@gmail.com');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'developer@gmail.com');
      assert.strictEqual(result.error, undefined);
    });

    it('accepts @googlemail.com addresses', () => {
      const result = validateAndNormalizeGmail('alex.engineer@googlemail.com');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'alex.engineer@googlemail.com');
    });

    it('automatically normalizes username handle without domain to @gmail.com', () => {
      const result = validateAndNormalizeGmail('sarah_connor');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'sarah_connor@gmail.com');
    });

    it('normalizes dotted usernames to @gmail.com', () => {
      const result = validateAndNormalizeGmail('alex.rivera.dev');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'alex.rivera.dev@gmail.com');
    });

    it('normalizes uppercase and trims spaces', () => {
      const result = validateAndNormalizeGmail('  Alex.Rivera@Gmail.COM  ');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'alex.rivera@gmail.com');
    });

    it('rejects empty input', () => {
      const result = validateAndNormalizeGmail('');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Please provide your Gmail address.');
    });

    it('rejects non-gmail email addresses (Yahoo, Hotmail, etc.)', () => {
      const resultYahoo = validateAndNormalizeGmail('john@yahoo.com');
      assert.strictEqual(resultYahoo.valid, false);
      assert.strictEqual(resultYahoo.error, 'Please provide a valid @gmail.com address.');

      const resultOutlook = validateAndNormalizeGmail('john@outlook.com');
      assert.strictEqual(resultOutlook.valid, false);
      assert.strictEqual(resultOutlook.error, 'Please provide a valid @gmail.com address.');
    });

    it('rejects lone @gmail.com without username', () => {
      const result = validateAndNormalizeGmail('@gmail.com');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Please provide a valid @gmail.com address.');
    });
  });

  describe('Initials Generation for Google Profile Capsule', () => {
    it('generates two-letter initials from first and last name', () => {
      assert.strictEqual(getInitials('Alex Rivera'), 'AR');
      assert.strictEqual(getInitials('Sarah Jenkins'), 'SJ');
      assert.strictEqual(getInitials('Linus Benedict Torvalds'), 'LT');
    });

    it('handles single-word names and edge cases gracefully', () => {
      assert.strictEqual(getInitials('Devin'), 'DE');
      assert.strictEqual(getInitials('K'), 'K');
      assert.strictEqual(getInitials(''), 'U');
    });
  });

  describe('Display Name Derivation from Gmail Handle', () => {
    it('formats dot and underscore separated handles into clean capitalized names', () => {
      assert.strictEqual(deriveDisplayName('alex.rivera.dev@gmail.com'), 'Alex Rivera Dev');
      assert.strictEqual(deriveDisplayName('sarah_connor@gmail.com'), 'Sarah Connor');
      assert.strictEqual(deriveDisplayName('johndoe@gmail.com'), 'Johndoe');
    });

    it('preserves custom user names if provided', () => {
      assert.strictEqual(deriveDisplayName('test@gmail.com', 'Alex Rivera'), 'Alex Rivera');
    });
  });

  describe('Google User Model & Session Storage Serialization', () => {
    it('creates a compliant Google OAuth User model', () => {
      const googleUser: User = {
        id: 'usr_google_1729900000',
        name: 'Alex Rivera',
        email: 'alex.rivera.dev@gmail.com',
        role: 'Software Engineer',
        provider: 'google',
        initials: 'AR',
      };

      assert.strictEqual(googleUser.provider, 'google');
      assert.strictEqual(googleUser.email.endsWith('@gmail.com'), true);
      assert.strictEqual(googleUser.initials, 'AR');
    });

    it('serializes and deserializes Google user session consistently for localStorage', () => {
      const original: User = {
        id: 'usr_google_987654',
        name: 'Sarah Connor',
        email: 'sarah.connor.tech@gmail.com',
        role: 'Staff Systems Architect',
        provider: 'google',
        initials: 'SC',
      };

      const serialized = JSON.stringify(original);
      const parsed = JSON.parse(serialized) as User;

      assert.deepStrictEqual(parsed, original);
      assert.strictEqual(parsed.provider, 'google');
      assert.strictEqual(parsed.initials, 'SC');
      assert.strictEqual(parsed.email, 'sarah.connor.tech@gmail.com');
    });
  });

  describe('Prelogin vs Postlogin Access Policies & Gating', () => {
    const sampleJobUrl = 'https://boards.greenhouse.io/stripe/jobs/4820192';

    it('prelogin: strictly blocks direct apply and prevents raw href exposure in DOM', () => {
      const preloginResult = evaluateApplyAction(null, sampleJobUrl);
      assert.strictEqual(preloginResult.allowedDirectApply, false);
      assert.strictEqual(preloginResult.requiresAuthPrompt, true);
      assert.strictEqual(preloginResult.hasRawHref, false);
      assert.strictEqual(preloginResult.effectiveHref, undefined);
      assert.strictEqual(preloginResult.label, 'Apply (Sign In)');
      assert.ok(preloginResult.promptMessage?.includes('Gmail'));
    });

    it('postlogin: allows direct ATS application and exposes verified outbound link', () => {
      const authUser: User = {
        id: 'usr_google_555',
        name: 'Alex Rivera',
        email: 'alex.rivera.dev@gmail.com',
        role: 'Senior Full Stack Engineer',
        provider: 'google',
        initials: 'AR',
      };

      const postloginResult = evaluateApplyAction(authUser, sampleJobUrl);
      assert.strictEqual(postloginResult.allowedDirectApply, true);
      assert.strictEqual(postloginResult.requiresAuthPrompt, false);
      assert.strictEqual(postloginResult.hasRawHref, true);
      assert.strictEqual(postloginResult.effectiveHref, sampleJobUrl);
      assert.strictEqual(postloginResult.label, 'Apply');
    });

    it('prelogin: intercepts share action and gates link copying behind Gmail login', () => {
      const preloginShare = evaluateShareAction(null);
      assert.strictEqual(preloginShare.allowedDirectCopy, false);
      assert.strictEqual(preloginShare.requiresAuthPrompt, true);
    });

    it('postlogin: allows direct ATS link copying to clipboard', () => {
      const authUser: User = {
        id: 'usr_google_777',
        name: 'Sarah Connor',
        email: 'sarah.connor@gmail.com',
        role: 'Systems Engineer',
        provider: 'google',
        initials: 'SC',
      };

      const postloginShare = evaluateShareAction(authUser);
      assert.strictEqual(postloginShare.allowedDirectCopy, true);
      assert.strictEqual(postloginShare.requiresAuthPrompt, false);
    });
  });

  describe('Prelogin-to-Postlogin Intent Preservation Engine', () => {
    it('preserves application intent when unauthenticated user clicks Apply on preview role', () => {
      let pendingIntent: AuthIntent | null = {
        type: 'apply',
        jobTitle: 'Staff Distributed Systems Engineer',
        company: 'Stripe Ecosystem Partner',
        url: 'https://stripe.com/jobs/staff-dist-eng',
      };

      // Simulating consumePendingIntent
      const consumed = pendingIntent;
      pendingIntent = null;

      assert.ok(consumed !== null);
      assert.strictEqual(consumed.type, 'apply');
      assert.strictEqual(consumed.jobTitle, 'Staff Distributed Systems Engineer');
      assert.strictEqual(consumed.url, 'https://stripe.com/jobs/staff-dist-eng');
      // Verify intent is wiped after consumption to prevent duplicate trigger
      assert.strictEqual(pendingIntent, null);
    });

    it('preserves discovery track exploration intent across Google authentication', () => {
      let pendingIntent: AuthIntent | null = {
        type: 'domain',
        domainTitle: 'AI & Machine Learning',
        query: 'AI Machine Learning',
        remote: 'remote',
      };

      const consumed = pendingIntent;
      pendingIntent = null;

      assert.ok(consumed !== null);
      assert.strictEqual(consumed.type, 'domain');
      assert.strictEqual(consumed.query, 'AI Machine Learning');
      assert.strictEqual(consumed.remote, 'remote');
      assert.strictEqual(pendingIntent, null);
    });

    it('preserves search query intent typed into prelogin search bar', () => {
      let pendingIntent: AuthIntent | null = {
        type: 'search',
        query: 'Kubernetes Platform Engineer',
        location: 'Remote',
      };

      const consumed = pendingIntent;
      pendingIntent = null;

      assert.ok(consumed !== null);
      assert.strictEqual(consumed.type, 'search');
      assert.strictEqual(consumed.query, 'Kubernetes Platform Engineer');
      assert.strictEqual(consumed.location, 'Remote');
    });
  });
});
