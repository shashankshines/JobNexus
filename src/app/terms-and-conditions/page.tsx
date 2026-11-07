import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Mail,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Building2,
  Scale,
  Sparkles,
} from 'lucide-react';
import JobNexusLogo from '@/app/components/JobNexusLogo';
import ThemeToggle from '@/app/components/ThemeToggle';
import {
  LEGAL_VERSIONS,
  LEGAL_METADATA,
  LEGAL_CONTACT,
  UPI_VERIFICATION_SLA,
} from '@/modules/legal/legal.config';
import { PREMIUM_PLAN } from '@/modules/billing/domain/subscription.types';

export const metadata: Metadata = {
  title: 'Terms & Conditions | JobNexus — Career Discovery Platform',
  description:
    'Official Terms and Conditions of JobNexus. Platform rules, manual UPI verification 2-hour SLA, non-agency disclaimer, and governing law.',
  alternates: {
    canonical: '/terms-and-conditions',
  },
  openGraph: {
    title: 'Terms & Conditions | JobNexus',
    description:
      'Official Terms and Conditions of JobNexus. Platform usage terms, 2-hour verification SLA, and statutory consumer rights.',
    url: 'https://jobnexus-world.vercel.app/terms-and-conditions',
  },
};

export default function TermsAndConditionsPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-poppins), sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Navigation Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: 'var(--nav-bg, rgba(15, 23, 42, 0.85))',
          borderBottom: '1px solid var(--border)',
          transition: 'background-color 0.2s, border-color 0.2s',
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: '0 auto',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <Link
              href="/"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <JobNexusLogo variant="inline" size={32} showTagline={false} />
            </Link>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0.25rem 0.6rem',
                borderRadius: 6,
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--primary-start, #818cf8)',
              }}
            >
              Terms of Service
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ThemeToggle />
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textDecoration: 'none',
                padding: '0.5rem 0.95rem',
                borderRadius: 8,
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Jobs</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ flex: '1 0 auto', maxWidth: 960, width: '100%', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Hero Header */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              borderRadius: 20,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--primary-start, #818cf8)',
              fontSize: '0.78rem',
              fontWeight: 700,
              marginBottom: '1rem',
            }}
          >
            <Scale size={16} />
            <span>VERSION {LEGAL_VERSIONS.termsAndConditions} • BINDING LEGAL AGREEMENT</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              margin: '0 0 0.75rem 0',
              color: 'var(--text-primary)',
            }}
          >
            Terms &amp; Conditions
          </h1>

          <p
            style={{
              fontSize: '0.95rem',
              color: 'var(--text-secondary)',
              maxWidth: 720,
              margin: '0 auto 1.25rem auto',
              lineHeight: 1.6,
            }}
          >
            Please read these terms carefully before accessing JobNexus. They define your legal rights, platform limitations, our non-agency status, and our 2-hour manual UPI verification commitment.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '1.25rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <span><strong>Effective Date:</strong> {LEGAL_METADATA.effectiveDate}</span>
            <span>•</span>
            <span><strong>Last Updated:</strong> {LEGAL_METADATA.lastUpdatedDate}</span>
            <span>•</span>
            <span><strong>Governing Law:</strong> {LEGAL_METADATA.governingLaw}</span>
          </div>
        </div>

        {/* Essential Statutory Highlights Card */}
        <div
          style={{
            marginBottom: '2.5rem',
            padding: '1.5rem',
            borderRadius: 14,
            backgroundColor: 'rgba(99, 102, 241, 0.06)',
            border: '1.5px solid rgba(99, 102, 241, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <ShieldCheck size={20} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Executive Platform Summary &amp; Key Commitments</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', fontSize: '0.84rem' }}>
            <div style={{ padding: '0.75rem 1rem', borderRadius: 8, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>1. Non-Agency Status:</strong>
              <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
                JobNexus is a discovery engine. We are NOT an employer or recruitment agency and never charge fees to apply to jobs.
              </p>
            </div>
            <div style={{ padding: '0.75rem 1rem', borderRadius: 8, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>2. 2-Hour Verification SLA:</strong>
              <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
                Manual UPI payments are reviewed by administrators within a maximum target of <strong>120 minutes</strong> from server submission.
              </p>
            </div>
            <div style={{ padding: '0.75rem 1rem', borderRadius: 8, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>3. Zero Credential Requests:</strong>
              <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
                JobNexus never requests your UPI PIN, banking password, or OTP. Never disclose financial credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents Box */}
        <div
          style={{
            marginBottom: '3rem',
            padding: '1.5rem',
            borderRadius: 14,
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 1rem 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FileText size={18} style={{ color: 'var(--primary-start, #818cf8)' }} />
            Table of Contents (23 Sections)
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.5rem',
              fontSize: '0.82rem',
            }}
          >
            <a href="#term-1" style={{ color: 'var(--primary)', textDecoration: 'none' }}>1. Acceptance of Terms</a>
            <a href="#term-2" style={{ color: 'var(--primary)', textDecoration: 'none' }}>2. Nature and Scope of JobNexus</a>
            <a href="#term-3" style={{ color: 'var(--primary)', textDecoration: 'none' }}>3. Job-Seeker-Focused Positioning</a>
            <a href="#term-4" style={{ color: 'var(--primary)', textDecoration: 'none' }}>4. Non-Agency &amp; Non-Employer Disclaimer</a>
            <a href="#term-5" style={{ color: 'var(--primary)', textDecoration: 'none' }}>5. Account Registration &amp; Security</a>
            <a href="#term-6" style={{ color: 'var(--primary)', textDecoration: 'none' }}>6. Job Aggregation &amp; Vacancy Feeds</a>
            <a href="#term-7" style={{ color: 'var(--primary)', textDecoration: 'none' }}>7. Job Availability Limitations</a>
            <a href="#term-8" style={{ color: 'var(--primary)', textDecoration: 'none' }}>8. External Application Processes</a>
            <a href="#term-9" style={{ color: 'var(--primary)', textDecoration: 'none' }}>9. Prohibited User Activities</a>
            <a href="#term-10" style={{ color: 'var(--primary)', textDecoration: 'none' }}>10. Free &amp; Premium Tiers</a>
            <a href="#term-11" style={{ color: 'var(--primary)', textDecoration: 'none' }}>11. Premium Pricing (₹499 / ₹349)</a>
            <a href="#term-12" style={{ color: 'var(--primary)', textDecoration: 'none' }}>12. Manual UPI Payment Workflow</a>
            <a href="#term-13" style={{ color: 'var(--primary)', textDecoration: 'none' }}>13. 2-Hour Payment Verification SLA</a>
            <a href="#term-14" style={{ color: 'var(--primary)', textDecoration: 'none' }}>14. Payment Rejection &amp; Disputes</a>
            <a href="#term-15" style={{ color: 'var(--primary)', textDecoration: 'none' }}>15. Refund Policy</a>
            <a href="#term-16" style={{ color: 'var(--primary)', textDecoration: 'none' }}>16. Notifications &amp; Alerts</a>
            <a href="#term-17" style={{ color: 'var(--primary)', textDecoration: 'none' }}>17. Intellectual Property Rights</a>
            <a href="#term-18" style={{ color: 'var(--primary)', textDecoration: 'none' }}>18. Third-Party Websites &amp; Services</a>
            <a href="#term-19" style={{ color: 'var(--primary)', textDecoration: 'none' }}>19. Platform Availability &amp; Changes</a>
            <a href="#term-20" style={{ color: 'var(--primary)', textDecoration: 'none' }}>20. Suspension &amp; Termination</a>
            <a href="#term-21" style={{ color: 'var(--primary)', textDecoration: 'none' }}>21. Limitation of Liability</a>
            <a href="#term-22" style={{ color: 'var(--primary)', textDecoration: 'none' }}>22. Privacy Policy Relationship</a>
            <a href="#term-23" style={{ color: 'var(--primary)', textDecoration: 'none' }}>23. Governing Law &amp; Redressal</a>
          </div>
        </div>

        {/* Terms Body Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', lineHeight: 1.7, fontSize: '0.92rem' }}>
          {/* Section 1 */}
          <section id="term-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              1. Acceptance of Terms
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding electronic agreement between you (&quot;User&quot;, &quot;you&quot;, or &quot;your&quot;) and <strong>{LEGAL_CONTACT.operatingEntity}</strong> (&quot;JobNexus&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), governing your access to and use of our career discovery engine, web applications, and services.
            </p>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              By accessing, browsing, registering for an account, or submitting a payment order on JobNexus, you explicitly represent that you are at least 18 years of age, possess the legal capacity to enter into binding contracts under the Indian Contract Act, 1872, and agree to abide by these Terms in full. If you do not agree to all terms, you must refrain from using the platform.
            </p>
          </section>

          {/* Section 2 */}
          <section id="term-2" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              2. Nature and Scope of JobNexus
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus is an algorithmic career aggregation and search engine designed to discover, index, filter, and organize publicly listed career vacancies directly from direct employer Applicant Tracking Systems (ATS) and official corporate portals. The platform serves as an information index, providing direct deep links for job seekers to view and apply for opportunities directly on prospective employers&apos; official hiring portals.
            </p>
          </section>

          {/* Section 3 */}
          <section id="term-3" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              3. Job-Seeker-Focused Platform Positioning
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus is designed exclusively to empower candidates and job seekers by reducing search friction, filtering out fraudulent or ghost job listings, and pointing candidates directly to verified primary career boards. Free users enjoy full search, filter, and application capabilities across the entire verified job catalogue.
            </p>
          </section>

          {/* Section 4 */}
          <section id="term-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              4. Non-Agency &amp; Non-Employer Statutory Disclaimer
            </h2>
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 12,
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1.5px solid rgba(239, 68, 68, 0.35)',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ef4444', margin: '0 0 0.5rem 0' }}>
                MANDATORY STATUTORY NOTICE:
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                {LEGAL_CONTACT.nonAgencyDisclaimer}
              </p>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus does not collect resumes, conduct candidate screening, issue employment offers, or guarantee job placement, callbacks, interview scheduling, or employment outcomes. Job seekers apply directly with third-party hiring companies. JobNexus NEVER charges any fee for submitting job applications.
            </p>
          </section>

          {/* Section 5 */}
          <section id="term-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              5. Account Registration, Credentials &amp; Responsibilities
            </h2>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
              <li>You may access basic job discovery as a visitor or create a registered account via Google Single Sign-On (OAuth) or email/password.</li>
              <li>You are solely responsible for maintaining the confidentiality of your credentials and for all activities conducted under your account.</li>
              <li>You must promptly notify JobNexus at <strong>{LEGAL_CONTACT.supportEmail}</strong> upon discovering any unauthorized access to your account.</li>
              <li>Account sharing, credential leasing, and programmatic account resale are strictly prohibited.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="term-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              6. Job Aggregation &amp; External Vacancy Information
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              All job titles, role descriptions, company profiles, compensation estimates, and qualification requirements displayed on JobNexus are derived from public feeds provided by independent enterprise ATS platforms (such as Greenhouse, Lever, Ashby, Workday, etc.). JobNexus indexes these listings in real time using automated normalization algorithms.
            </p>
          </section>

          {/* Section 7 */}
          <section id="term-7" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              7. Job Availability &amp; Accuracy Limitations
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Hiring companies may fill, pause, alter, or remove job listings on their primary ATS at any time without prior notice. While JobNexus implements rigorous anti-stale deduplication and verification pipelines, we cannot warrant that every indexed role remains active or that employer job descriptions are free from inaccuracies.
            </p>
          </section>

          {/* Section 8 */}
          <section id="term-8" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              8. External Application &amp; Hiring Processes
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Clicking &quot;Apply on Company Site&quot; opens an external hyperlink redirecting your browser directly to the third party&apos;s or hiring organization&apos;s primary careers portal. Any subsequent communication, interview scheduling, document submission, or employment offer occurs strictly between you and that hiring organization. JobNexus is not a party to any resulting employment relationship.
            </p>
          </section>

          {/* Section 9 */}
          <section id="term-9" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              9. Prohibited User Activities
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              When accessing JobNexus, you agree not to:
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
              <li>Deploy automated bots, spiders, or scrapers to extract platform data, API responses, or backend catalogues without prior written authorization.</li>
              <li>Submit forged, duplicate, fabricated, or third-party UPI transaction reference (UTR) numbers in payment flows.</li>
              <li>Attempt to probe, scan, or compromise platform authentication, administrative consoles, or rate-limiting safeguards.</li>
              <li>Misrepresent your identity, impersonate any person or entity, or use another user&apos;s account.</li>
              <li>Introduce viruses, trojans, worms, logic bombs, or other malicious payloads into platform endpoints.</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section id="term-10" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              10. Free &amp; Premium Membership Tiers
            </h2>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
              <li><strong>Free Tier:</strong> Access to complete job search across all indexed sectors, advanced technical role and workplace filters, direct ATS application links, and saving up to 5 bookmarked jobs.</li>
              <li><strong>Premium Membership Tier:</strong> Unlimited saved jobs vault, priority access to newly crawled ATS vacancies, salary benchmark insights, direct recruiter contact hints where available, and smart email job alerts.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section id="term-11" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              11. Premium Membership Pricing (₹499 Standard / ₹349 Promotional)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Premium membership is offered at a standard list price of <strong>₹{PREMIUM_PLAN.originalPriceInr} INR</strong> per 30-day billing cycle. Where promotional discounts are actively displayed, the prevailing checkout price (currently <strong>₹{PREMIUM_PLAN.priceInr} INR</strong>) applies.
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
              <li><strong>Duration:</strong> Membership grants <strong>30 calendar days</strong> of continuous access from the moment of administrative approval.</li>
              <li><strong>No Automatic Recurring Debits:</strong> JobNexus operates on a strict manual renewal model. We do NOT maintain recurring UPI mandates or automatic card deductions. To continue Premium after 30 days, users must initiate a fresh manual order.</li>
            </ul>
          </section>

          {/* Section 12 */}
          <section id="term-12" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              12. Manual UPI Payment &amp; Verification Workflow
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              To ensure compliance and zero payment intermediary fees for Indian job seekers, JobNexus operates via a transparent manual UPI verification process:
            </p>
            <ol style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
              <li>The user initiates an order, generating a unique Order ID and displaying the official JobNexus business UPI QR code / VPA.</li>
              <li>The user completes the transfer via any UPI-enabled mobile application (Google Pay, PhonePe, Paytm, BHIM, Cred, or Mobile Banking).</li>
              <li>The user enters the authentic 12-digit UPI Transaction Reference (UTR) number and submission date into the verification dialog.</li>
              <li>An authorized billing administrator cross-references the submitted UTR against bank credit statements before recording approval.</li>
            </ol>
          </section>

          {/* Section 13 */}
          <section id="term-13" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              13. Two-Hour (120-Minute) Payment Verification SLA
            </h2>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: 12,
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1.5px solid rgba(16, 185, 129, 0.35)',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}>
                <Clock size={18} />
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  Operational Commitment: Maximum 2 Hours (120 Minutes)
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                JobNexus commits to reviewing and taking administrative action on all complete, valid payment submissions within a maximum target of <strong>{UPI_VERIFICATION_SLA.minutes} minutes ({UPI_VERIFICATION_SLA.label})</strong> from the server-recorded submission timestamp.
              </p>
            </div>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
              <li><strong>SLA Clock Commencement:</strong> The 120-minute review window commences strictly when the server confirms receipt of complete, valid payment details (the <code>submittedAt</code> timestamp recorded by our backend). Generating an order or viewing the QR code does NOT start the SLA clock.</li>
              <li><strong>Idempotency:</strong> Repeated submission attempts of an existing order or client browser clock changes do not reset or manipulate the authoritative SLA deadline.</li>
              <li><strong>Terminal Status Halts SLA:</strong> Once an administrator records an official status of either &quot;Approved&quot; or &quot;Rejected&quot;, the SLA escalation halts immediately.</li>
              <li><strong>Nature of SLA:</strong> This SLA represents an operational standard for administrative workflow efficiency. It does NOT constitute an automated instant-approval timer. Access is activated only upon formal bank record confirmation.</li>
            </ul>
          </section>

          {/* Section 14 */}
          <section id="term-14" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              14. Payment Rejection &amp; Disputes
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              A payment submission may be formally rejected by an administrator under the following circumstances:
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: '0 0 0.75rem 0' }}>
              <li>The submitted UTR number does not correspond to any credit received in our bank statement.</li>
              <li>The credited amount is less than the active plan fee.</li>
              <li>The UTR has previously been claimed, reserved, or associated with another user account (duplicate submission).</li>
              <li>The transaction was reversed, cancelled, or flagged as fraudulent by banking networks.</li>
            </ul>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              If your submission is rejected and you hold genuine banking proof of debit, you may file a dispute by emailing <strong>{LEGAL_CONTACT.supportEmail}</strong> with your Order ID, submission date, and official bank statement excerpt.
            </p>
          </section>

          {/* Section 15 */}
          <section id="term-15" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              15. Refund Policy
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus Premium is a non-tangible digital service providing immediate, irrevocable access to curated job insights and technical features upon administrative approval. Consequently, all verified subscription fees are non-refundable once membership is activated, except where a refund is strictly mandated by applicable statutory Indian consumer protection legislation or where an erroneous duplicate debit to our accounts is verified.
            </p>
          </section>

          {/* Section 16 */}
          <section id="term-16" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              16. Notifications &amp; Alerts
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              By registering an account, you consent to receive essential service messages regarding account security, payment status, and order updates. You may opt in or opt out of optional career digests and sector alert emails at any time via your account settings.
            </p>
          </section>

          {/* Section 17 */}
          <section id="term-17" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              17. Intellectual Property Rights
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              All software, algorithms, user interface designs, logos, graphics, trademarks, and documentation comprising JobNexus are the proprietary intellectual property of {LEGAL_CONTACT.operatingEntity}. All trademarks, trade names, company names, and logos of employers appearing on external job postings belong strictly to their respective owners.
            </p>
          </section>

          {/* Section 18 */}
          <section id="term-18" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              18. Third-Party Websites &amp; Services
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus contains external hyperlinks leading to third-party employer career boards, company websites, and external resources. We exercise no control over the content, privacy policies, terms, or hiring practices of third-party websites and disclaim all liability arising from your navigation to or interactions with them.
            </p>
          </section>

          {/* Section 19 */}
          <section id="term-19" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              19. Platform Availability &amp; Modifications
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We reserve the right to upgrade, modify, temporarily suspend, or discontinue any feature, filter, or API endpoint for scheduled maintenance, security hardening, or platform improvement without liability.
            </p>
          </section>

          {/* Section 20 */}
          <section id="term-20" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              20. Account Suspension &amp; Termination
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              We reserve the right to immediately suspend or permanently terminate your account and revoke access to Premium features without prior notice if you violate these Terms, engage in payment fraud, submit fraudulent UTR numbers, deploy unauthorized automated scrapers, or attempt to breach platform security.
            </p>
          </section>

          {/* Section 21 */}
          <section id="term-21" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              21. Limitation of Liability
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              To the maximum extent permissible under applicable Indian law, JobNexus, its founders, directors, employees, and agents shall not be liable for any indirect, incidental, punitive, special, or consequential damages, including loss of profits, employment opportunity loss, data corruption, or business interruption arising out of your access to or inability to use the platform. In any event, our total aggregate liability shall not exceed the subscription fees actually paid by you to JobNexus in the thirty (30) days preceding the claim.
            </p>
          </section>

          {/* Section 22 */}
          <section id="term-22" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              22. Relationship with Privacy Policy
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Our collection and processing of personal data is governed by our{' '}
              <Link href="/privacy-policy" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
                Privacy Policy
              </Link>
              , which is incorporated into and forms an integral part of these Terms. By agreeing to these Terms, you also acknowledge and consent to our Privacy Policy.
            </p>
          </section>

          {/* Section 23 */}
          <section id="term-23">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              23. Governing Law, Jurisdiction &amp; Grievance Redressal
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              These Terms are governed by and construed in accordance with the <strong>laws of the Republic of India</strong>, without regard to conflict of law principles. The competent courts situated in <strong>{LEGAL_METADATA.jurisdiction}</strong> shall have exclusive jurisdiction over any disputes arising under or in connection with these Terms.
            </p>

            <div
              style={{
                padding: '1.5rem',
                borderRadius: 14,
                backgroundColor: 'var(--card-bg)',
                border: '1.5px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Building2 size={20} style={{ color: 'var(--primary-start, #818cf8)' }} />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {LEGAL_CONTACT.operatingEntity} — Legal &amp; Compliance Redressal
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.88rem' }}>
                <Scale size={18} style={{ color: 'var(--text-muted)', marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Grievance Officer:</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{LEGAL_CONTACT.grievanceOfficerName}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.88rem' }}>
                <Mail size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Grievance Email:</strong>{' '}
                  <a href={`mailto:${LEGAL_CONTACT.grievanceEmail}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    {LEGAL_CONTACT.grievanceEmail}
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.88rem' }}>
                <Mail size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Support &amp; Verification Desk:</strong>{' '}
                  <a href={`mailto:${LEGAL_CONTACT.supportEmail}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    {LEGAL_CONTACT.supportEmail}
                  </a>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <strong>Statutory Redressal Window:</strong> All legal grievances and notices will be acknowledged within 48 hours and resolved in accordance with {LEGAL_CONTACT.responseTimeframe}.
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--card-bg)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</Link>
            <span>•</span>
            <Link href="/privacy-policy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms-and-conditions" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Terms &amp; Conditions</Link>
          </div>
          <div>
            © {new Date().getFullYear()} JobNexus. All rights reserved. Direct employer ATS discovery platform.
          </div>
        </div>
      </footer>
    </div>
  );
}
