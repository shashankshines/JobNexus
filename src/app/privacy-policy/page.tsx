import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  FileText,
  AlertCircle,
  ExternalLink,
  Mail,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Building2,
  Scale,
} from 'lucide-react';
import JobNexusLogo from '@/app/components/JobNexusLogo';
import ThemeToggle from '@/app/components/ThemeToggle';
import {
  LEGAL_VERSIONS,
  LEGAL_METADATA,
  LEGAL_CONTACT,
  UPI_VERIFICATION_SLA,
} from '@/modules/legal/legal.config';

export const metadata: Metadata = {
  title: 'Privacy Policy | JobNexus — Career Discovery Platform',
  description:
    'Official Privacy Policy of JobNexus. Learn how we collect, process, and safeguard job seeker data in compliance with the Digital Personal Data Protection Act, 2023.',
  alternates: {
    canonical: '/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy | JobNexus',
    description:
      'Official Privacy Policy of JobNexus. DPDP Act 2023 aligned, transparent data processing, direct ATS redirects.',
    url: 'https://jobnexus-world.vercel.app/privacy-policy',
  },
};

export default function PrivacyPolicyPage() {
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
              Legal &amp; Privacy
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
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: '0.78rem',
              fontWeight: 700,
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={16} />
            <span>VERSION {LEGAL_VERSIONS.privacyPolicy} • INDIA DPDP ACT 2023 ALIGNED</span>
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
            Privacy Policy
          </h1>

          <p
            style={{
              fontSize: '0.95rem',
              color: 'var(--text-secondary)',
              maxWidth: 680,
              margin: '0 auto 1.25rem auto',
              lineHeight: 1.6,
            }}
          >
            How JobNexus collects, uses, retains, and protects your information when you discover opportunities, create an account, or subscribe to premium features.
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
            <span><strong>Jurisdiction:</strong> {LEGAL_METADATA.jurisdiction}</span>
          </div>
        </div>

        {/* Anti-Fraud Security Highlight Banner */}
        <div
          style={{
            marginBottom: '2.5rem',
            padding: '1.25rem 1.5rem',
            borderRadius: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1.5px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <AlertCircle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h2
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#ef4444',
                margin: '0 0 0.35rem 0',
              }}
            >
              Crucial Payment &amp; Credential Protection Warning
            </h2>
            <p
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {LEGAL_CONTACT.securityNotice} All payments on JobNexus are strictly conducted via official UPI scanning/deep links followed by manual UTR verification. JobNexus administrators will never ask you to transfer funds to personal UPI handles or disclose private financial credentials.
            </p>
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
            Policy Structure &amp; Table of Contents
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.65rem',
              fontSize: '0.84rem',
            }}
          >
            <a href="#section-1" style={{ color: 'var(--primary)', textDecoration: 'none' }}>1. Introduction &amp; Platform Nature</a>
            <a href="#section-2" style={{ color: 'var(--primary)', textDecoration: 'none' }}>2. Information We Collect</a>
            <a href="#section-3" style={{ color: 'var(--primary)', textDecoration: 'none' }}>3. How We Use Your Information</a>
            <a href="#section-4" style={{ color: 'var(--primary)', textDecoration: 'none' }}>4. Interactions with Employer Portals</a>
            <a href="#section-5" style={{ color: 'var(--primary)', textDecoration: 'none' }}>5. Third-Party Service Providers</a>
            <a href="#section-6" style={{ color: 'var(--primary)', textDecoration: 'none' }}>6. Data Security &amp; Safeguards</a>
            <a href="#section-7" style={{ color: 'var(--primary)', textDecoration: 'none' }}>7. Data Retention &amp; Erasure</a>
            <a href="#section-8" style={{ color: 'var(--primary)', textDecoration: 'none' }}>8. Cookies &amp; Local Storage</a>
            <a href="#section-9" style={{ color: 'var(--primary)', textDecoration: 'none' }}>9. Your Rights Under Indian DPDP Act</a>
            <a href="#section-10" style={{ color: 'var(--primary)', textDecoration: 'none' }}>10. Minors &amp; Children&apos;s Privacy</a>
            <a href="#section-11" style={{ color: 'var(--primary)', textDecoration: 'none' }}>11. Policy Updates &amp; Notifications</a>
            <a href="#section-12" style={{ color: 'var(--primary)', textDecoration: 'none' }}>12. Grievance Redressal &amp; Contact</a>
          </div>
        </div>

        {/* Policy Body Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', lineHeight: 1.7, fontSize: '0.92rem' }}>
          {/* Section 1 */}
          <section id="section-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              1. Introduction &amp; Platform Nature
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Welcome to <strong>JobNexus</strong> (accessible at https://jobnexus-world.vercel.app and related domains), operated by {LEGAL_CONTACT.operatingEntity} (&quot;JobNexus&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We provide a career discovery and vacancy aggregation engine that indexes publicly posted employment opportunities directly from official employer Applicant Tracking Systems (ATS) and career portals.
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              This Privacy Policy explains how we collect, store, utilize, disclose, and protect personal data belonging to visitors, registered candidates, and premium subscribers.
            </p>
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: 10,
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
              }}
            >
              <strong style={{ color: 'var(--primary)' }}>Key Platform Positioning:</strong>{' '}
              <span>{LEGAL_CONTACT.nonAgencyDisclaimer}</span>
            </div>
          </section>

          {/* Section 2 */}
          <section id="section-2" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              2. Information We Collect
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              We collect information only to the extent necessary to deliver career discovery features, manage accounts, and verify subscriptions:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                  A. Account &amp; Authentication Information
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                  <li><strong>Google Authentication:</strong> When you sign in via Google OAuth, we receive your Google user ID, primary email address, full name, and avatar image URL.</li>
                  <li><strong>Email/Password Sign-In:</strong> When you register directly, we record your email address and securely salt/hash your authentication credentials via Firebase Authentication. We never store plain-text passwords.</li>
                  <li><strong>Session Identifiers:</strong> Secure, cryptographically random session tokens are maintained to authenticate your requests across the website.</li>
                </ul>
              </div>

              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                  B. Search Queries, Filters &amp; User Preferences
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                  <li><strong>Search &amp; Filter Activity:</strong> Keywords, technical roles, seniority levels, geographic filters, and workplace models (remote, hybrid, on-site) selected during job exploration.</li>
                  <li><strong>Saved Jobs:</strong> Job IDs bookmarked by authenticated users in their personal vault.</li>
                  <li><strong>Smart Notification Preferences:</strong> Subscribed career categories, target roles, and email alert toggles configured in account preferences.</li>
                </ul>
              </div>

              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                  C. Manual UPI Payment &amp; Verification Evidence
                </h3>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                  When you purchase a 30-day Premium membership (standard ₹499 / promotional ₹349), you submit manual payment details for administrative review:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                  <li><strong>Unique Transaction Reference (UTR):</strong> The 12-digit numeric reference generated by your bank or UPI application.</li>
                  <li><strong>Transaction Details:</strong> Payment date, declared amount (INR), and optional notes specifying the originating payment app (e.g., Google Pay, PhonePe, Paytm, or bank name).</li>
                  <li><strong>Payment Audit Logs:</strong> Timestamp of submission, client submission IP, and administrative verification status (Approved, Rejected, or Pending).</li>
                  <li style={{ color: '#ef4444', fontWeight: 600 }}>
                    <strong>Financial Exclusion Notice:</strong> JobNexus does NOT collect, request, or store your UPI PIN, ATM/Debit Card numbers, CVV, Net Banking passwords, or One-Time Passwords (OTP).
                  </li>
                </ul>
              </div>

              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                  D. Device, Log &amp; Network Telemetry
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                  <li>Internet Protocol (IP) address, approximate geographic location (city/country level), device type, operating system, browser version, and server request timestamps collected automatically for rate limiting, DDoS defense, and security audit logs.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="section-3" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              3. Purpose of Data Collection &amp; Processing
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              We process personal information under the following lawful grounds and specific business purposes:
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
              <li><strong>Providing Career Discovery:</strong> Executing real-time search queries, matching candidate queries to relevant ATS feeds, and managing saved vacancy bookmarks.</li>
              <li><strong>Account Administration:</strong> Authenticating users, preserving session state, and securing account credentials.</li>
              <li><strong>Manual Payment Verification &amp; Subscription SLA:</strong> Independently verifying submitted UTR reference numbers against banking credit records within our committed <strong>{UPI_VERIFICATION_SLA.label}</strong> operational review window, and granting 30-day Premium membership upon verification.</li>
              <li><strong>Transactional Communications:</strong> Sending essential service notifications, including payment submission acknowledgements, verification outcome updates, and password resets.</li>
              <li><strong>Platform Security &amp; Fraud Prevention:</strong> Detecting fraudulent duplicate UTR submissions, preventing unauthorized automated scraping, enforcing rate limits, and defending infrastructure against malicious activity.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="section-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              4. Interactions with Job Providers &amp; Direct Employer ATS Portals
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              JobNexus operates by crawling and normalizing public vacancies directly from verified employer Applicant Tracking Systems (including Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Jobicy, RemoteOK, and Arbeitnow).
            </p>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: 12,
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ExternalLink size={18} style={{ color: 'var(--primary)' }} />
                Direct External Redirection
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
                When you click <strong>&quot;Apply on Company Site&quot;</strong>, you are transferred directly to the third party&apos;s or employer&apos;s official website.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                <li>JobNexus does NOT collect, review, or store your resume, CV, portfolio, or job application answers.</li>
                <li>JobNexus does NOT charge candidates to apply to vacancies. All job applications on external employer ATS portals are free of charge.</li>
                <li>Your interaction with employer websites is governed entirely by that employer&apos;s independent Privacy Policy and Terms of Use. We encourage you to review their policies before submitting sensitive application data.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section id="section-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              5. Third-Party Service Providers &amp; Infrastructure
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              We do not sell, rent, monetize, or trade your personal data to data brokers or third-party advertisers. We engage vetted cloud infrastructure providers strictly to operate the platform:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Google Cloud &amp; Firebase</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  Managed database (Firestore Asia/Mumbai region) and Google Identity authentication infrastructure.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Vercel Inc.</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  Edge compute, global serverless hosting, and secure SSL/TLS certificate management.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Transactional Email (Resend/SMTP)</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  Delivery of order confirmation emails, payment submission receipts, and administrative alerts.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="section-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              6. Data Security Safeguards
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              We implement comprehensive technical and organizational safeguards designed to protect personal data against unauthorized access, loss, or alteration:
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
              <li><strong>Transport Layer Security:</strong> All data in transit is encrypted using modern HTTPS (TLS 1.3).</li>
              <li><strong>Firestore Security Rules:</strong> Database collections are governed by strict declarative rules preventing cross-user data leakage and enforcing least-privilege access.</li>
              <li><strong>Strict Role-Based Admin Access:</strong> The JobNexus Admin Console is restricted to designated administrators whose Google accounts are verified against a cryptographically enforced allowlist.</li>
              <li><strong>Masked Data in Email:</strong> UTR reference numbers are masked (e.g., <code>5123••••••••1234</code>) in email bodies to prevent disclosure over plain-text communication channels.</li>
              <li><strong>Atomic UTR Reservation:</strong> Database transactions prevent race conditions, replay attacks, and collision exploitation during payment submission.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section id="section-7" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              7. Data Retention &amp; Erasure Procedures
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              We retain personal data only for as long as necessary to fulfill the purposes outlined in this policy:
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
              <li><strong>Account &amp; Preference Data:</strong> Retained for the lifetime of your account. You may request account closure and complete erasure of personal data by emailing our Grievance Officer.</li>
              <li><strong>Financial &amp; Payment Records:</strong> Payment orders, verified UTR numbers, and administrative approval/rejection audit logs are retained for a minimum statutory period (up to 7 years) to comply with Indian accounting, financial auditing, and taxation standards.</li>
              <li><strong>Server Logs:</strong> Ephemeral HTTP access and security diagnostic logs are cycled and automatically deleted after 90 days.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section id="section-8" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              8. Cookies &amp; Local Browser Storage
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              JobNexus uses minimal browser storage mechanisms strictly required for platform operation:
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
              <li><strong>Authentication Cookies:</strong> Secure, HttpOnly session cookies used to maintain authenticated login state.</li>
              <li><strong>Theme &amp; Display State (LocalStorage):</strong> We store your chosen theme (<code>jobnexus_theme_v1</code>: light, dark, or system) locally in your browser.</li>
              <li><strong>Client-Side Job Cache (LocalStorage):</strong> Temporarily caches saved job IDs and recent search filter selections to ensure instantaneous UI response.</li>
              <li><strong>No Third-Party Ad Cookies:</strong> JobNexus does NOT deploy third-party advertising cookies, cross-site trackers, or surveillance pixels.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section id="section-9" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              9. Your Rights Under Indian Data Protection Law (DPDP Act 2023)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              In accordance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, Indian residents and platform users hold the following rights:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Right to Access Information</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  Request a summary of your personal data processed by JobNexus and the identities of third-party processors.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Right to Correction &amp; Erasure</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  Request correction of inaccurate or incomplete personal information, or complete erasure of non-statutory account records.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Right to Grievance Redressal</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  File grievances directly with our designated Grievance Officer, with guaranteed review within 30 days.
                </p>
              </div>
              <div style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Right to Nominate</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
                  Nominate an individual to exercise data rights in the event of death or incapacity.
                </p>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
              To exercise any of these rights, email your request to <strong>{LEGAL_CONTACT.grievanceEmail}</strong> from your registered email address.
            </p>
          </section>

          {/* Section 10 */}
          <section id="section-10" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              10. Minors &amp; Children&apos;s Privacy
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              JobNexus is designed exclusively for job seekers who are 18 years of age or older (the age of majority under Indian law). We do not knowingly solicit or collect personal data from minors. If you believe a minor has provided us with personal information, contact our Grievance Officer immediately, and we will take prompt steps to delete such data.
            </p>
          </section>

          {/* Section 11 */}
          <section id="section-11" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              11. Policy Updates &amp; Notifications
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              We may revise this Privacy Policy periodically to reflect technological advancements, operational improvements, or legislative changes. When updates are published, the &quot;Last Updated&quot; date at the top of this document will be amended. Continued use of the platform after updates indicates your acknowledgment of the revised terms.
            </p>
          </section>

          {/* Section 12 */}
          <section id="section-12">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              12. Grievance Redressal &amp; Statutory Contact Information
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              In accordance with the Digital Personal Data Protection Act, 2023, and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the contact details of the designated Grievance Redressal Officer are published below:
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
                  {LEGAL_CONTACT.operatingEntity}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.88rem' }}>
                <Scale size={18} style={{ color: 'var(--text-muted)', marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Designation:</strong>{' '}
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
                  <strong style={{ color: 'var(--text-primary)' }}>General Inquiries:</strong>{' '}
                  <a href={`mailto:${LEGAL_CONTACT.supportEmail}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    {LEGAL_CONTACT.supportEmail}
                  </a>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <strong>Statutory Redressal Timeframe:</strong> Grievances are formally acknowledged within 48 hours and resolved within {LEGAL_CONTACT.responseTimeframe}.
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
            <Link href="/terms-and-conditions" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms &amp; Conditions</Link>
            <span>•</span>
            <Link href="/privacy-policy" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>
          </div>
          <div>
            © {new Date().getFullYear()} JobNexus. All rights reserved. Direct employer ATS discovery platform.
          </div>
        </div>
      </footer>
    </div>
  );
}
