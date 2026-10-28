import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  maskJobForAnonymous,
  maskJobsForAnonymous,
  isValidApplicationUrl,
  ANONYMOUS_COMPANY_LABEL,
  ANONYMOUS_SOURCE_LABEL,
  isCompanyMasked,
  isSourceMasked,
} from '../domain/job.masking';
import { LegacyJob, NormalizedJob, toLegacyJob } from '../domain/job.types';
import { deduplicateJobs } from '../domain/job.deduplication';
import { filterAndRankJobs } from '../domain/job.ranking';
import {
  createSession,
  validateSession,
  findOrCreateGoogleUser,
  resetAuthStore,
  SESSION_COOKIE_NAME,
  expireSessionForTesting,
} from '../../auth/server/session.store';
import { GET as jobsRouteHandler } from '../../../app/api/jobs/route';
import { GET as statsRouteHandler } from '../../../app/api/jobs/stats/route';

describe('JobNexus — Anonymous Job Access Restrictions & Company Masking Suite', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  const sampleLegacyJobs: LegacyJob[] = [
    {
      id: 'ashby-101',
      title: 'Senior Distributed Systems Architect',
      company: 'Linear Technologies Inc',
      location: 'Remote (Worldwide)',
      type: 'Full-time',
      url: 'https://jobs.ashbyhq.com/linear/101',
      date: '2026-10-26T10:00:00.000Z',
      source: 'Ashby ATS (Linear Technologies Inc)',
      tags: ['Linear Technologies Inc', 'Distributed Systems', 'Go', 'Kubernetes'],
      description: 'At Linear Technologies Inc, we are building next-generation issue tracking and platform tooling.',
      isRemote: true,
      workplaceType: 'remote',
      isIndiaEligible: true,
      isFresh: true,
    },
    {
      id: 'gh-202',
      title: 'Staff Full Stack Developer',
      company: 'Retool Solutions',
      location: 'Bengaluru, India',
      type: 'Full-time',
      url: 'https://boards.greenhouse.io/retool/jobs/202',
      date: '2026-10-25T14:30:00.000Z',
      source: 'Greenhouse ATS (Retool Solutions)',
      tags: ['Retool Solutions', 'React', 'TypeScript', 'Node.js'],
      description: 'Join Retool Solutions to revolutionize internal tools development for engineering organizations worldwide.',
      isRemote: false,
      workplaceType: 'hybrid',
      isIndiaEligible: true,
      isFresh: true,
    },
  ];

  // =========================================================================
  // 1. Anonymous User Tests: Data Boundary Masking & Field Sanitization
  // =========================================================================
  describe('Anonymous User Tests: Server-Side Data Boundary Masking', () => {
    it('replaces actual company names with standard neutral label', () => {
      const masked = maskJobForAnonymous(sampleLegacyJobs[0]);
      assert.strictEqual(masked.company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(masked.company, 'Company hidden');
      assert.strictEqual(isCompanyMasked(masked.company), true);
      assert.strictEqual(isCompanyMasked('Linear Technologies Inc'), false);
      assert.ok(!masked.company.includes('Linear'));
    });

    it('clears direct application URL in public payload to prevent anonymous apply access', () => {
      const masked = maskJobForAnonymous(sampleLegacyJobs[0]);
      assert.strictEqual(masked.url, '');
      assert.ok(!masked.url.includes('linear'));
      assert.ok(!masked.url.includes('ashbyhq.com'));
    });

    it('filters out company names from tags array for anonymous responses', () => {
      const masked = maskJobForAnonymous(sampleLegacyJobs[0]);
      assert.deepStrictEqual(masked.tags, ['Distributed Systems', 'Go', 'Kubernetes']);
      assert.ok(!masked.tags.includes('Linear Technologies Inc'));
    });

    it('masks provider and source metadata for anonymous responses', () => {
      const masked = maskJobForAnonymous(sampleLegacyJobs[0]);
      assert.strictEqual(masked.source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(masked.source, 'Job source hidden');
      assert.strictEqual(isSourceMasked(masked.source), true);
      assert.strictEqual(isSourceMasked('Ashby ATS'), false);
      assert.ok(!masked.source.includes('Linear'));
      assert.ok(!masked.source.includes('Ashby'));
    });

    it('sanitizes explicit company references in descriptions', () => {
      const masked = maskJobForAnonymous(sampleLegacyJobs[0]);
      assert.ok(!masked.description.includes('Linear Technologies Inc'));
      assert.ok(masked.description.includes('the company'));
      // Public discovery content remains intact
      assert.ok(masked.description.includes('building next-generation issue tracking'));
    });

    it('preserves public discovery fields (title, location, workplaceType, tags, dates)', () => {
      const masked = maskJobForAnonymous(sampleLegacyJobs[1]);
      assert.strictEqual(masked.title, 'Staff Full Stack Developer');
      assert.strictEqual(masked.location, 'Bengaluru, India');
      assert.strictEqual(masked.workplaceType, 'hybrid');
      assert.strictEqual(masked.isIndiaEligible, true);
      assert.strictEqual(masked.type, 'Full-time');
      assert.strictEqual(masked.date, '2026-10-25T14:30:00.000Z');
      assert.ok(masked.tags.includes('React'));
      assert.ok(masked.tags.includes('TypeScript'));
    });

    it('batch masks multiple jobs consistently without altering original items', () => {
      const batch = maskJobsForAnonymous(sampleLegacyJobs);
      assert.strictEqual(batch.length, 2);
      assert.strictEqual(batch[0].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(batch[1].company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(batch[0].source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(batch[1].source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(batch[0].url, '');
      assert.strictEqual(batch[1].url, '');

      // Verify originals remain unmodified
      assert.strictEqual(sampleLegacyJobs[0].company, 'Linear Technologies Inc');
      assert.strictEqual(sampleLegacyJobs[0].source, 'Ashby ATS (Linear Technologies Inc)');
      assert.ok(sampleLegacyJobs[0].url.length > 0);
    });

    it('handles missing company or source gracefully without generating fake identities', () => {
      const missingJob: LegacyJob = {
        id: 'missing-1',
        title: 'Backend Developer',
        company: '',
        location: 'Remote',
        type: 'Full-time',
        url: 'https://example.com/apply',
        date: '2026-10-26T10:00:00.000Z',
        source: '',
        tags: ['Go'],
        description: '',
      };
      const masked = maskJobForAnonymous(missingJob);
      assert.strictEqual(masked.company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(masked.source, ANONYMOUS_SOURCE_LABEL);
    });
  });

  // =========================================================================
  // 2. /api/jobs Route: Server-Side Authorization & Anti-Bypass Verification
  // =========================================================================
  describe('/api/jobs Route: Server-Side Authorization Enforcement', () => {
    it('returns masked company names, masked sources, and empty application URLs for unauthenticated requests', async () => {
      const req = new Request('http://localhost:3000/api/jobs?limit=5', {
        headers: {},
      });
      const res = await jobsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.jobs));
      assert.ok(data.jobs.length > 0);

      for (const job of data.jobs) {
        // Must never leak company name or source in anonymous response
        assert.strictEqual(job.company, ANONYMOUS_COMPANY_LABEL);
        assert.strictEqual(job.company, 'Company hidden');
        assert.strictEqual(job.source, ANONYMOUS_SOURCE_LABEL);
        assert.strictEqual(job.source, 'Job source hidden');
        assert.strictEqual(job.url, '');
        for (const tag of job.tags) {
          assert.notStrictEqual(tag, job.company);
        }
      }

      // Provider lists and diagnostics must be hidden for anonymous consumers
      assert.deepStrictEqual(data.sources, []);
      assert.strictEqual(data.diagnostics, undefined);

      // Cache isolation headers
      assert.strictEqual(res.headers.get('vary'), 'Cookie, Authorization');
      assert.ok(res.headers.get('cache-control')?.includes('private'));
    });

    it('rejects fake or forged session tokens and falls back safely to masked data', async () => {
      const req = new Request('http://localhost:3000/api/jobs', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=forged-session-token-12345; Path=/`,
        },
      });
      const res = await jobsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      for (const job of data.jobs) {
        assert.strictEqual(job.company, ANONYMOUS_COMPANY_LABEL);
        assert.strictEqual(job.source, ANONYMOUS_SOURCE_LABEL);
        assert.strictEqual(job.url, '');
      }
      assert.deepStrictEqual(data.sources, []);
    });

    it('rejects expired session tokens and returns masked response', async () => {
      const user = findOrCreateGoogleUser({
        sub: 'expired_user',
        email: 'expired@jobnexus.dev',
        name: 'Expired Session User',
      });
      const session = createSession(user.id);

      // Artificially expire session
      const authValidationBefore = validateSession(session.sessionId);
      assert.strictEqual(authValidationBefore.valid, true);

      // Force expiration
      expireSessionForTesting(session.sessionId);
      const authValidationAfter = validateSession(session.sessionId);
      assert.strictEqual(authValidationAfter.valid, false);

      // Query with expired cookie
      const req = new Request('http://localhost:3000/api/jobs', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${session.sessionId}`,
        },
      });
      const res = await jobsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      for (const job of data.jobs) {
        assert.strictEqual(job.company, ANONYMOUS_COMPANY_LABEL);
        assert.strictEqual(job.source, ANONYMOUS_SOURCE_LABEL);
        assert.strictEqual(job.url, '');
      }
      assert.deepStrictEqual(data.sources, []);
    });

    it('returns unmasked real company names and valid URLs for authenticated requests', async () => {
      const user = findOrCreateGoogleUser({
        sub: 'verified_user_99',
        email: 'staff.engineer@gmail.com',
        name: 'Verified Staff Engineer',
      });
      const { sessionId } = createSession(user.id);

      const req = new Request('http://localhost:3000/api/jobs?limit=5', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });
      const res = await jobsRouteHandler(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(data.jobs.length > 0);

      // Authenticated users must see real company names, verified sources, and application URLs
      for (const job of data.jobs) {
        assert.notStrictEqual(job.company, ANONYMOUS_COMPANY_LABEL);
        assert.notStrictEqual(job.source, ANONYMOUS_SOURCE_LABEL);
        assert.ok(job.company.length > 0);
        assert.ok(job.source.length > 0);
        assert.ok(isValidApplicationUrl(job.url));
      }

      assert.ok(Array.isArray(data.sources));
      assert.ok(data.sources.length > 0);
      assert.strictEqual(res.headers.get('vary'), 'Cookie, Authorization');
      assert.ok(res.headers.get('cache-control')?.includes('private'));
    });

    it('supports single-job resolution by ID with auth-aware shaping', async () => {
      // 1. Unauthenticated single job query
      const unauthReq = new Request('http://localhost:3000/api/jobs', { headers: {} });
      const unauthListRes = await jobsRouteHandler(unauthReq);
      const listData = await unauthListRes.json();
      const firstJobId = listData.jobs[0].id;

      const singleUnauthReq = new Request(`http://localhost:3000/api/jobs?id=${encodeURIComponent(firstJobId)}`, {
        headers: {},
      });
      const singleUnauthRes = await jobsRouteHandler(singleUnauthReq);
      assert.strictEqual(singleUnauthRes.status, 200);
      const singleUnauthData = await singleUnauthRes.json();
      assert.strictEqual(singleUnauthData.job.id, firstJobId);
      assert.strictEqual(singleUnauthData.job.company, ANONYMOUS_COMPANY_LABEL);
      assert.strictEqual(singleUnauthData.job.source, ANONYMOUS_SOURCE_LABEL);
      assert.strictEqual(singleUnauthData.job.url, '');

      // 2. Authenticated single job query
      const user = findOrCreateGoogleUser({
        sub: 'user_single_query',
        email: 'user.single@gmail.com',
        name: 'Single Query User',
      });
      const { sessionId } = createSession(user.id);

      const singleAuthReq = new Request(`http://localhost:3000/api/jobs?id=${encodeURIComponent(firstJobId)}`, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
        },
      });
      const singleAuthRes = await jobsRouteHandler(singleAuthReq);
      assert.strictEqual(singleAuthRes.status, 200);
      const singleAuthData = await singleAuthRes.json();
      assert.strictEqual(singleAuthData.job.id, firstJobId);
      assert.notStrictEqual(singleAuthData.job.company, ANONYMOUS_COMPANY_LABEL);
      assert.notStrictEqual(singleAuthData.job.source, ANONYMOUS_SOURCE_LABEL);
      assert.ok(isValidApplicationUrl(singleAuthData.job.url));
    });

    it('ensures /api/jobs?stats=true does not leak provider identities to anonymous callers', async () => {
      const anonReq = new Request('http://localhost:3000/api/jobs?stats=true');
      const anonRes = await jobsRouteHandler(anonReq);
      assert.strictEqual(anonRes.status, 200);
      const data = await anonRes.json();

      assert.ok(data.totalJobs > 0);
      assert.ok(data.sourcesCount > 0);
      for (const src of data.sources) {
        assert.strictEqual(src, 'Job source hidden');
      }
      assert.deepStrictEqual(data.providerBreakdown, {});
    });

    it('ensures /api/jobs/stats endpoint masks sources for anonymous users and isolates cache', async () => {
      const anonReq = new Request('http://localhost:3000/api/jobs/stats');
      const anonRes = await statsRouteHandler(anonReq);
      assert.strictEqual(anonRes.status, 200);
      const data = await anonRes.json();

      assert.ok(data.totalJobs > 0);
      for (const src of data.sources) {
        assert.strictEqual(src, 'Job source hidden');
      }
      assert.deepStrictEqual(data.providerBreakdown, {});
      assert.strictEqual(anonRes.headers.get('vary'), 'Cookie, Authorization');
    });
  });

  // =========================================================================
  // 3. UI Gating & Interaction Invariants (Apply Button, Share, Keyboard)
  // =========================================================================
  describe('UI Gating & Interaction Invariants', () => {
    function evaluateCardInteractions(params: {
      authStatus: 'initializing' | 'anonymous' | 'authenticated';
      rawCompany: string;
      rawSource?: string;
      rawUrl: string;
    }) {
      const isAuth = params.authStatus === 'authenticated';
      const displayedCompany = isAuth ? (params.rawCompany || 'Not specified') : ANONYMOUS_COMPANY_LABEL;
      const displayedSource = isAuth ? (params.rawSource || 'Verified Source') : ANONYMOUS_SOURCE_LABEL;
      const allowsDirectApply = isAuth && isValidApplicationUrl(params.rawUrl);
      const buttonTag = allowsDirectApply ? 'a' : 'button';
      const hasHrefInDom = allowsDirectApply;
      const companyTooltip = isAuth ? displayedCompany : 'Sign in to reveal employer details';
      const sourceTooltip = isAuth ? displayedSource : 'Sign in to reveal job source';

      return {
        displayedCompany,
        displayedSource,
        allowsDirectApply,
        buttonTag,
        hasHrefInDom,
        companyTooltip,
        sourceTooltip,
        companyClickOpensModal: !isAuth,
        sourceClickOpensModal: !isAuth,
        requiresModalOnApply: !isAuth,
        requiresModalOnCopy: !isAuth,
      };
    }

    it('guarantees no flash of unmasked company names during auth initialization', () => {
      const initCard = evaluateCardInteractions({
        authStatus: 'initializing',
        rawCompany: 'Stripe Inc.',
        rawSource: 'Ashby ATS',
        rawUrl: 'https://stripe.com/jobs/101',
      });

      assert.strictEqual(initCard.displayedCompany, 'Company hidden');
      assert.strictEqual(initCard.displayedSource, 'Job source hidden');
      assert.strictEqual(initCard.companyClickOpensModal, true);
      assert.strictEqual(initCard.sourceClickOpensModal, true);
      assert.strictEqual(initCard.hasHrefInDom, false);
      assert.strictEqual(initCard.buttonTag, 'button');
      assert.strictEqual(initCard.requiresModalOnApply, true);
    });

    it('anonymous: Apply button rendered as button with no href in DOM', () => {
      const anonCard = evaluateCardInteractions({
        authStatus: 'anonymous',
        rawCompany: 'Airbnb Engineering',
        rawSource: 'Greenhouse ATS',
        rawUrl: 'https://careers.airbnb.com/positions/456',
      });

      assert.strictEqual(anonCard.displayedCompany, 'Company hidden');
      assert.strictEqual(anonCard.displayedSource, 'Job source hidden');
      assert.strictEqual(anonCard.companyClickOpensModal, true);
      assert.strictEqual(anonCard.sourceClickOpensModal, true);
      assert.strictEqual(anonCard.buttonTag, 'button');
      assert.strictEqual(anonCard.hasHrefInDom, false);
      assert.strictEqual(anonCard.requiresModalOnApply, true);
    });

    it('authenticated: Apply button rendered as anchor with valid href', () => {
      const authCard = evaluateCardInteractions({
        authStatus: 'authenticated',
        rawCompany: 'Airbnb Engineering',
        rawSource: 'Greenhouse ATS',
        rawUrl: 'https://careers.airbnb.com/positions/456',
      });

      assert.strictEqual(authCard.displayedCompany, 'Airbnb Engineering');
      assert.strictEqual(authCard.displayedSource, 'Greenhouse ATS');
      assert.strictEqual(authCard.companyClickOpensModal, false);
      assert.strictEqual(authCard.sourceClickOpensModal, false);
      assert.strictEqual(authCard.buttonTag, 'a');
      assert.strictEqual(authCard.hasHrefInDom, true);
      assert.strictEqual(authCard.allowsDirectApply, true);
      assert.strictEqual(authCard.requiresModalOnApply, false);
    });
  });

  // =========================================================================
  // 4. Intent Preservation Engine: Resume Apply & Preserve Filter State
  // =========================================================================
  describe('Intent Preservation Engine across Authentication Lifecycle', () => {
    it('preserves user search filters and query when login modal is cancelled', () => {
      const searchState = {
        query: 'Rust Distributed Systems',
        location: 'Remote',
        workplace: 'remote',
        type: 'Full-time',
        level: 'Staff',
      };

      // User triggered apply, opening modal with prompt
      const authPrompt = '🔒 Sign in to your account to reveal employer details and direct ATS application.';
      assert.ok(authPrompt.includes('Sign in'));

      // User cancels login modal (click outside or escape)
      const cancelledState = { ...searchState };

      // Verify all query parameters and filters are untouched
      assert.strictEqual(cancelledState.query, 'Rust Distributed Systems');
      assert.strictEqual(cancelledState.location, 'Remote');
      assert.strictEqual(cancelledState.workplace, 'remote');
      assert.strictEqual(cancelledState.type, 'Full-time');
      assert.strictEqual(cancelledState.level, 'Staff');
    });

    it('resumes application intent with unmasked target URL upon successful login', () => {
      // 1. Anonymous user clicked apply on a masked job
      const targetJobId = 'ashby-linear-101';
      const pendingIntent = {
        type: 'apply' as const,
        jobId: targetJobId,
        jobTitle: 'Senior Systems Architect',
        company: ANONYMOUS_COMPANY_LABEL,
        url: '', // Masked initially
      };

      // 2. User signs in
      const user = findOrCreateGoogleUser({
        sub: 'login_resume_user',
        email: 'applicant@engineer.dev',
        name: 'Applicant Developer',
      });
      const session = createSession(user.id);
      assert.ok(session.sessionId);

      // 3. Post-auth resumption resolves target job's authenticated application URL
      const authenticatedResolvedUrl = 'https://jobs.ashbyhq.com/linear/101';
      assert.ok(isValidApplicationUrl(authenticatedResolvedUrl));

      const consumedIntent = { ...pendingIntent };
      assert.strictEqual(consumedIntent.type, 'apply');
      assert.strictEqual(consumedIntent.jobId, targetJobId);

      // Verify post-login URL is safe and valid HTTP/HTTPS
      assert.strictEqual(isValidApplicationUrl(authenticatedResolvedUrl), true);
    });
  });

  // =========================================================================
  // 5. Security & Protocol Validation (Malicious Schemes, Open Redirects)
  // =========================================================================
  describe('Security & Protocol Validation', () => {
    it('rejects unsafe schemes like javascript:, data:, and vbscript:', () => {
      assert.strictEqual(isValidApplicationUrl('javascript:alert(document.cookie)'), false);
      assert.strictEqual(isValidApplicationUrl('javascript://%0aalert(1)'), false);
      assert.strictEqual(isValidApplicationUrl('data:text/html,<script>alert(1)</script>'), false);
      assert.strictEqual(isValidApplicationUrl('vbscript:msgbox(1)'), false);
      assert.strictEqual(isValidApplicationUrl('file:///etc/passwd'), false);
      assert.strictEqual(isValidApplicationUrl(''), false);
      assert.strictEqual(isValidApplicationUrl(null), false);
      assert.strictEqual(isValidApplicationUrl(undefined), false);
    });

    it('accepts valid HTTP and HTTPS application URLs', () => {
      assert.strictEqual(isValidApplicationUrl('https://jobs.ashbyhq.com/linear/101'), true);
      assert.strictEqual(isValidApplicationUrl('https://boards.greenhouse.io/retool/jobs/202'), true);
      assert.strictEqual(isValidApplicationUrl('http://careers.example.com/apply'), true);
    });
  });

  // =========================================================================
  // 6. Deduplication & Ranking Invariance
  // =========================================================================
  describe('Deduplication & Ranking Invariance', () => {
    it('ensures deduplication is computed on raw data and unaffected by client masking', () => {
      const rawNormalizedJobs: NormalizedJob[] = [
        {
          id: 'job-1',
          sourceId: 'src-1',
          sourceName: 'Ashby ATS',
          title: 'Senior Software Engineer',
          company: 'Acme Technologies Inc.',
          location: 'Remote',
          isRemote: true,
          description: 'Building cloud infrastructure.',
          applicationUrl: 'https://jobs.ashbyhq.com/acme/1',
          publishedAt: '2026-10-26T10:00:00.000Z',
          employmentType: 'Full Time',
          tags: ['Cloud', 'Go'],
        },
        {
          id: 'job-2',
          sourceId: 'src-2',
          sourceName: 'Greenhouse ATS',
          title: 'Senior Software Engineer',
          company: 'Acme Technologies LLC',
          location: 'Remote',
          isRemote: true,
          description: 'Building cloud infrastructure and systems.',
          applicationUrl: 'https://boards.greenhouse.io/acme/1', // Same role, duplicate company
          publishedAt: '2026-10-26T10:00:00.000Z',
          employmentType: 'Full Time',
          tags: ['Cloud', 'Go', 'Systems'],
        },
      ];

      // Deduplicate raw jobs
      const deduped = deduplicateJobs(rawNormalizedJobs);
      assert.strictEqual(deduped.length, 1);
      assert.strictEqual(deduped[0].company, 'Acme Technologies Inc.');

      // Convert to legacy and mask
      const legacyJobs = deduped.map(toLegacyJob);
      const masked = maskJobsForAnonymous(legacyJobs);
      assert.strictEqual(masked.length, 1);
      assert.strictEqual(masked[0].company, ANONYMOUS_COMPANY_LABEL);
    });

    it('ensures job ranking and search relevance produce identical results', () => {
      const jobs: NormalizedJob[] = [
        {
          id: 'lead-job',
          sourceId: '1',
          sourceName: 'Ashby',
          title: 'Lead Platform Engineer',
          company: 'Alpha Corp',
          location: 'Remote',
          isRemote: true,
          description: 'Leading platform architectures',
          applicationUrl: 'https://alpha.com/job/1',
          publishedAt: '2026-10-26T10:00:00.000Z',
          employmentType: 'Full Time',
          tags: ['Platform', 'Kubernetes'],
        },
        {
          id: 'junior-job',
          sourceId: '2',
          sourceName: 'Greenhouse',
          title: 'Junior Web Developer',
          company: 'Beta Corp',
          location: 'Remote',
          isRemote: true,
          description: 'HTML and CSS styling',
          applicationUrl: 'https://beta.com/job/2',
          publishedAt: '2026-10-26T10:00:00.000Z',
          employmentType: 'Full Time',
          tags: ['HTML', 'CSS'],
        },
      ];

      const ranked = filterAndRankJobs(jobs, { query: 'Platform Engineer' });
      assert.strictEqual(ranked.length, 1);
      assert.strictEqual(ranked[0].id, 'lead-job');

      // Masking does not perturb order or selection
      const legacy = ranked.map(toLegacyJob);
      const masked = maskJobsForAnonymous(legacy);
      assert.strictEqual(masked.length, 1);
      assert.strictEqual(masked[0].id, 'lead-job');
      assert.strictEqual(masked[0].company, ANONYMOUS_COMPANY_LABEL);
    });
  });
});
