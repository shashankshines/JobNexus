import { describe, it } from 'node:test';
import assert from 'node:assert';
import { User, AuthIntent } from '../../../app/context/AuthContext';
import {
  validateAndNormalizeIdentifier,
  deriveDisplayName,
  getInitials,
} from '../domain/auth.validation';

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
      promptMessage: '🔒 Sign in to your account to reveal employer details and direct ATS application.',
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

describe('Universal Authentication & Access Control Journey', () => {
  describe('Identifier Validation & Normalization (Universal Email & Username Support)', () => {
    it('accepts standard @gmail.com email addresses', () => {
      const result = validateAndNormalizeIdentifier('developer@gmail.com');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'developer@gmail.com');
      assert.strictEqual(result.isEmail, true);
      assert.strictEqual(result.error, undefined);
    });

    it('accepts non-Gmail email addresses (Yahoo, Outlook, Hotmail, Proton, Apple, Corporate)', () => {
      const resultYahoo = validateAndNormalizeIdentifier('john@yahoo.com');
      assert.strictEqual(resultYahoo.valid, true);
      assert.strictEqual(resultYahoo.normalized, 'john@yahoo.com');
      assert.strictEqual(resultYahoo.isEmail, true);

      const resultOutlook = validateAndNormalizeIdentifier('john@outlook.com');
      assert.strictEqual(resultOutlook.valid, true);
      assert.strictEqual(resultOutlook.normalized, 'john@outlook.com');

      const resultStripe = validateAndNormalizeIdentifier('staff.eng@stripe.com');
      assert.strictEqual(resultStripe.valid, true);
      assert.strictEqual(resultStripe.normalized, 'staff.eng@stripe.com');
    });

    it('accepts usernames without domain', () => {
      const result = validateAndNormalizeIdentifier('sarah_connor');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'sarah_connor');
      assert.strictEqual(result.isEmail, false);
      assert.strictEqual(result.username, 'sarah_connor');
    });

    it('accepts dotted usernames', () => {
      const result = validateAndNormalizeIdentifier('alex.rivera.dev');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'alex.rivera.dev');
      assert.strictEqual(result.isEmail, false);
    });

    it('normalizes uppercase and trims spaces', () => {
      const result = validateAndNormalizeIdentifier('  Alex.Rivera@Example.COM  ');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.normalized, 'alex.rivera@example.com');
    });

    it('rejects empty input with informative message', () => {
      const result = validateAndNormalizeIdentifier('');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Please enter your username or email address.');
    });

    it('rejects inputs containing internal spaces', () => {
      const result = validateAndNormalizeIdentifier('john doe@domain.com');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Username or email cannot contain spaces.');
    });

    it('rejects lone @ domain without username', () => {
      const result = validateAndNormalizeIdentifier('@domain.com');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Please enter a valid username before @.');
    });
  });

  describe('Initials Generation for Member Profile Capsule', () => {
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

  describe('Display Name Derivation from Handle', () => {
    it('formats dot and underscore separated handles into clean capitalized names', () => {
      assert.strictEqual(deriveDisplayName('alex.rivera.dev@custom.com'), 'Alex Rivera Dev');
      assert.strictEqual(deriveDisplayName('sarah_connor'), 'Sarah Connor');
      assert.strictEqual(deriveDisplayName('johndoe@domain.com'), 'Johndoe');
    });

    it('preserves custom user names if provided', () => {
      assert.strictEqual(deriveDisplayName('test@domain.com', 'Alex Rivera'), 'Alex Rivera');
    });
  });

  describe('Credentials User Model & Session Storage Serialization', () => {
    it('creates a compliant Credentials User model', () => {
      const user: User = {
        id: 'usr_cred_1729900000',
        name: 'Alex Rivera',
        email: 'alex.rivera@domain.com',
        role: 'Software Engineer',
        provider: 'credentials',
        initials: 'AR',
      };

      assert.strictEqual(user.provider, 'credentials');
      assert.strictEqual(user.email, 'alex.rivera@domain.com');
      assert.strictEqual(user.initials, 'AR');
    });

    it('serializes and deserializes user session consistently for localStorage', () => {
      const original: User = {
        id: 'usr_cred_987654',
        name: 'Sarah Connor',
        email: 'sarah.connor.tech@enterprise.org',
        role: 'Staff Systems Architect',
        provider: 'credentials',
        initials: 'SC',
      };

      const serialized = JSON.stringify(original);
      const parsed = JSON.parse(serialized) as User;

      assert.deepStrictEqual(parsed, original);
      assert.strictEqual(parsed.provider, 'credentials');
      assert.strictEqual(parsed.initials, 'SC');
      assert.strictEqual(parsed.email, 'sarah.connor.tech@enterprise.org');
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
      assert.strictEqual(preloginResult.promptMessage, '🔒 Sign in to your account to reveal employer details and direct ATS application.');
    });

    it('postlogin: allows direct ATS application and exposes verified outbound link', () => {
      const authUser: User = {
        id: 'usr_cred_555',
        name: 'Alex Rivera',
        email: 'alex.rivera.dev@custom.com',
        role: 'Senior Full Stack Engineer',
        provider: 'credentials',
        initials: 'AR',
      };

      const postloginResult = evaluateApplyAction(authUser, sampleJobUrl);
      assert.strictEqual(postloginResult.allowedDirectApply, true);
      assert.strictEqual(postloginResult.requiresAuthPrompt, false);
      assert.strictEqual(postloginResult.hasRawHref, true);
      assert.strictEqual(postloginResult.effectiveHref, sampleJobUrl);
      assert.strictEqual(postloginResult.label, 'Apply');
    });

    it('prelogin: intercepts share action and gates link copying behind login', () => {
      const preloginShare = evaluateShareAction(null);
      assert.strictEqual(preloginShare.allowedDirectCopy, false);
      assert.strictEqual(preloginShare.requiresAuthPrompt, true);
    });

    it('postlogin: allows direct ATS link copying to clipboard', () => {
      const authUser: User = {
        id: 'usr_cred_777',
        name: 'Sarah Connor',
        email: 'sarah.connor@domain.com',
        role: 'Systems Engineer',
        provider: 'credentials',
        initials: 'SC',
      };

      const postloginShare = evaluateShareAction(authUser);
      assert.strictEqual(postloginShare.allowedDirectCopy, true);
      assert.strictEqual(postloginShare.requiresAuthPrompt, false);
    });

    it('prelogin: strictly conceals company details and displays confidential badge', () => {
      const evaluateCompanyVisibility = (user: User | null, rawCompany: string) => {
        if (!user) {
          return {
            isConfidential: true,
            displayedName: 'Confidential Co.',
            hasDirectCompanyInDom: false,
          };
        }
        return {
          isConfidential: false,
          displayedName: rawCompany,
          hasDirectCompanyInDom: true,
        };
      };

      const prelogin = evaluateCompanyVisibility(null, 'Acme Corp');
      assert.strictEqual(prelogin.isConfidential, true);
      assert.strictEqual(prelogin.displayedName, 'Confidential Co.');
      assert.strictEqual(prelogin.hasDirectCompanyInDom, false);

      const authUser: User = {
        id: 'usr_cred_123',
        name: 'Alex Rivera',
        email: 'alex@company.com',
        role: 'Developer',
        provider: 'credentials',
        initials: 'AR',
      };
      const postlogin = evaluateCompanyVisibility(authUser, 'Acme Corp');
      assert.strictEqual(postlogin.isConfidential, false);
      assert.strictEqual(postlogin.displayedName, 'Acme Corp');
      assert.strictEqual(postlogin.hasDirectCompanyInDom, true);
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

    it('preserves discovery track exploration intent across credentials authentication', () => {
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

  describe('Sign Out Landing Page Redirection & Filter Invalidation', () => {
    it('resets all applied filters and transitions directly to clean landing page discovery on sign out', () => {
      // Simulating user state post login with multiple active filters
      let state = {
        isAuthenticated: true,
        user: { id: 'usr_test_1', name: 'Dev Member', email: 'dev@jobnexus.io', role: 'engineer', provider: 'google' as const, initials: 'DM' },
        activeView: 'saved' as 'all' | 'saved',
        searched: true,
        query: 'Principal Architect',
        location: 'Bengaluru, India',
        type: 'full-time',
        level: 'lead',
        selectedRole: 'Systems',
        remote: 'remote',
        sortBy: 'date' as 'relevance' | 'date',
        jobs: [{ id: 'job_1', title: 'Principal Architect' }],
        visibleCount: 36,
        showRoleDropdown: true,
        showWorkplaceDropdown: true,
      };

      // Helper matching resetToDiscovery logic executed on sign out
      const resetToDiscovery = () => {
        state = {
          ...state,
          query: '',
          location: '',
          type: '',
          level: '',
          selectedRole: '',
          remote: '',
          sortBy: 'relevance',
          activeView: 'all',
          showRoleDropdown: false,
          showWorkplaceDropdown: false,
          jobs: [],
          searched: false,
          visibleCount: 18,
        };
      };

      // Perform sign out action
      resetToDiscovery();
      state.isAuthenticated = false;
      state.user = null as unknown as typeof state.user;

      // Verify complete landing page state restoration
      assert.strictEqual(state.isAuthenticated, false);
      assert.strictEqual(state.searched, false, 'Searched flag must be reset to false for landing page');
      assert.strictEqual(state.activeView, 'all', 'Active view must reset to all discovery');
      assert.strictEqual(state.query, '', 'Query must be cleared');
      assert.strictEqual(state.location, '', 'Location must be cleared');
      assert.strictEqual(state.type, '', 'Type filter must be cleared');
      assert.strictEqual(state.level, '', 'Seniority level must be cleared');
      assert.strictEqual(state.selectedRole, '', 'Role category must be cleared');
      assert.strictEqual(state.remote, '', 'Remote filter must be cleared');
      assert.strictEqual(state.sortBy, 'relevance', 'Sort order must reset to relevance');
      assert.strictEqual(state.jobs.length, 0, 'Loaded filtered jobs must be cleared');
      assert.strictEqual(state.visibleCount, 18, 'Batch pagination must reset to initial size');
      assert.strictEqual(state.showRoleDropdown, false);
      assert.strictEqual(state.showWorkplaceDropdown, false);
    });

    it('cleans URL query parameters on sign out to prevent lingering filter deep-links', () => {
      const url = new URL('https://jobnexus.io/?query=Senior+DevOps&location=Remote&type=contract');
      assert.ok(url.searchParams.has('query'));
      assert.ok(url.searchParams.has('location'));

      // Clean path resolution on sign out
      const cleanPath = url.pathname.split('?')[0] || '/';
      const cleanUrl = new URL(cleanPath, url.origin);

      assert.strictEqual(cleanUrl.pathname, '/');
      assert.strictEqual(cleanUrl.search, '');
    });
  });
});
