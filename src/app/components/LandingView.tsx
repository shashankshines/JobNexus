'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
  Search,
  Lock,
  Building,
  Clock,
  Layers,
  ChevronRight,
  Code2,
  Server,
  MapPin,
  UserPlus,
} from 'lucide-react';
import { useAuth, AuthIntent, AuthMode } from '../context/AuthContext';
import { useJobStats } from '@/modules/jobs/hooks/useJobStats';
import JobCard from './JobCard';
import ThemeToggle from './ThemeToggle';
import JobNexusLogo from './JobNexusLogo';

const PREVIEW_VERIFIED_JOBS = [
  {
    id: 'preview-1',
    title: 'Staff Distributed Systems Engineer',
    company: 'Confidential Employer',
    location: 'Remote (US / Global)',
    type: 'Full-time',
    salary: '$185,000 - $240,000',
    tags: ['Go', 'Kubernetes', 'Distributed Systems', 'Kafka'],
    source: 'Greenhouse ATS',
    date: new Date().toISOString(),
    isRemote: true,
    workplaceType: 'remote',
    isIndiaEligible: true,
    isFresh: true,
    url: 'https://boards.greenhouse.io',
  },
  {
    id: 'preview-2',
    title: 'Senior Full Stack Engineer (Next.js / TypeScript)',
    company: 'Confidential Employer',
    location: 'Bengaluru, India (Hybrid)',
    type: 'Full-time',
    salary: '₹35 - ₹55 LPA',
    tags: ['React', 'Next.js', 'TypeScript', 'Node.js'],
    source: 'Ashby ATS',
    date: new Date(Date.now() - 3600000 * 3).toISOString(),
    isRemote: false,
    workplaceType: 'hybrid',
    isIndiaEligible: true,
    isFresh: true,
    url: 'https://ashbyhq.com',
  },
  {
    id: 'preview-3',
    title: 'Lead AI & Machine Learning Scientist',
    company: 'Confidential Employer',
    location: 'Remote (Global Flexible)',
    type: 'Full-time',
    salary: '$195,000 - $260,000',
    tags: ['PyTorch', 'LLMs', 'Inference', 'Python'],
    source: 'Himalayas',
    date: new Date(Date.now() - 3600000 * 5).toISOString(),
    isRemote: true,
    workplaceType: 'remote',
    isIndiaEligible: true,
    isFresh: false,
    url: 'https://himalayas.app',
  },
  {
    id: 'preview-4',
    title: 'Frontend Engineer, Ads & Monetization',
    company: 'Confidential Employer',
    location: 'Anywhere in the World',
    type: 'Full-time',
    salary: '$160,000 - $210,000',
    tags: ['React', 'TypeScript', 'GraphQL', 'Next.js'],
    source: 'We Work Remotely',
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    isRemote: true,
    workplaceType: 'remote',
    isIndiaEligible: true,
    isFresh: true,
    url: 'https://weworkremotely.com',
  },
  {
    id: 'preview-5',
    title: 'Cloud Infrastructure & SRE Architect',
    company: 'Confidential Employer',
    location: 'Remote / Hybrid (US & EU)',
    type: 'Full-time',
    salary: '$175,000 - $230,000',
    tags: ['Terraform', 'AWS', 'Kubernetes', 'Prometheus'],
    source: 'Greenhouse ATS',
    date: new Date(Date.now() - 3600000 * 8).toISOString(),
    isRemote: true,
    workplaceType: 'remote',
    isIndiaEligible: false,
    isFresh: false,
    url: 'https://boards.greenhouse.io',
  },
  {
    id: 'preview-6',
    title: 'Principal Platform Engineer (Kubernetes & Go)',
    company: 'Confidential Employer',
    location: 'Pune / Bengaluru, India',
    type: 'Full-time',
    salary: '₹45 - ₹70 LPA',
    tags: ['Go', 'Microservices', 'Docker', 'PostgreSQL'],
    source: 'Ashby ATS',
    date: new Date(Date.now() - 3600000 * 4).toISOString(),
    isRemote: false,
    workplaceType: 'hybrid',
    isIndiaEligible: true,
    isFresh: true,
    url: 'https://ashbyhq.com',
  },
];

const PREVIEW_DISCOVERY_TRACKS = [
  {
    title: 'Fully Remote & Global',
    count: '450+ Roles',
    desc: 'Verified remote roles across global engineering teams with timezone flexibility.',
    tags: ['Work Anywhere', 'USD / EUR Rates', 'Async First'],
    icon: Globe,
    remote: 'remote',
  },
  {
    title: 'AI & Machine Learning',
    count: '180+ Roles',
    desc: 'LLM agents, PyTorch inference, computer vision, data engineering, and generative AI.',
    tags: ['LLMs', 'PyTorch', 'GenAI', 'MLOps'],
    icon: Sparkles,
    query: 'AI Machine Learning',
  },
  {
    title: 'Frontend & Full Stack',
    count: '320+ Roles',
    desc: 'Modern web architectures with React, Next.js, TypeScript, Tailwind, and Node.js.',
    tags: ['React', 'Next.js', 'TypeScript', 'Node.js'],
    icon: Code2,
    query: 'Full Stack Developer',
  },
  {
    title: 'Backend & Cloud Systems',
    count: '290+ Roles',
    desc: 'High-scale microservices, Go, Python, distributed systems, and cloud pipelines.',
    tags: ['Go', 'Python', 'Microservices', 'AWS / GCP'],
    icon: Server,
    query: 'Backend Engineer',
  },
  {
    title: 'India Tech Hubs',
    count: '240+ Roles',
    desc: 'Verified on-site and hybrid engineering roles in Bengaluru, Hyderabad, and Pune.',
    tags: ['Bengaluru', 'Hyderabad', 'Pune', 'Gurgaon'],
    icon: MapPin,
    location: 'India',
  },
  {
    title: 'DevOps & Infrastructure',
    count: '150+ Roles',
    desc: 'Kubernetes orchestration, CI/CD automation, cloud infrastructure, and observability.',
    tags: ['Kubernetes', 'Docker', 'Terraform', 'CI/CD'],
    icon: ShieldCheck,
    query: 'DevOps SRE',
  },
];

const QUICK_ROLE_PILLS = [
  { label: '⚡ Full Stack', query: 'Full Stack Developer' },
  { label: '⚛️ React / Next.js', query: 'React Developer' },
  { label: '🤖 AI & Machine Learning', query: 'AI Machine Learning' },
  { label: '🐍 Python / Backend', query: 'Python Backend Engineer' },
  { label: '☁️ DevOps & Cloud', query: 'DevOps Cloud' },
  { label: '📱 Mobile (Flutter/RN)', query: 'Mobile Developer' },
  { label: '🎨 UI/UX Design', query: 'Product Designer' },
  { label: '🔒 Cybersecurity', query: 'Cybersecurity Analyst' },
];

const PILLARS = [
  {
    title: 'Direct ATS Integration',
    desc: 'We index jobs directly from employer Applicant Tracking Systems like Greenhouse and Ashby. You apply straight on company portals without middleman recruiters.',
    icon: Building,
    badge: '100% Direct Links',
  },
  {
    title: 'Zero Ghost Jobs',
    desc: 'Automated 24/7 validation purges inactive listings and closed URLs so you never waste time applying to expired positions or ghost requisitions.',
    icon: ShieldCheck,
    badge: 'Real-time Verification',
  },
  {
    title: 'Dedicated Remote & India Filtering',
    desc: 'Instant clarity between 100% Global Remote roles with timezone flexibility and verified top tech hub positions in Bengaluru, Hyderabad, and Pune.',
    icon: Globe,
    badge: 'Transparent Workplaces',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'JobNexus allowed me to skip the endless recruiter inboxes and apply directly on Greenhouse boards. Landed my Senior Platform role in 2 weeks.',
    author: 'Priya N.',
    role: 'Senior Platform Engineer',
    company: 'Fintech Scaleup',
  },
  {
    quote:
      'The Workplace Category toggle is a game-changer. I filter specifically for USD-paying Global Remote jobs without sorting through hybrid bait-and-switches.',
    author: 'Marcus K.',
    role: 'Staff Full Stack Developer',
    company: 'Remote Series-B',
  },
  {
    quote:
      'Cleanest interface in tech careers. No spam rankings, no paywalls, just real verified jobs with fast ATS application paths.',
    author: 'Rohan M.',
    role: 'AI Infrastructure Lead',
    company: 'Bengaluru AI Lab',
  },
];

export default function LandingView() {
  const { openAuthModal } = useAuth();
  const { formattedCount, sourcesCount } = useJobStats();
  const [searchKeywords, setSearchKeywords] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [activeLandingWorkplace, setActiveLandingWorkplace] = useState('');

  const displayedPreviewJobs = useMemo(() => {
    if (!activeLandingWorkplace) return PREVIEW_VERIFIED_JOBS;
    return PREVIEW_VERIFIED_JOBS.filter((job) => job.workplaceType === activeLandingWorkplace);
  }, [activeLandingWorkplace]);

  const platformMetrics = useMemo(
    () => [
      { value: formattedCount, label: 'Verified Public Roles', icon: ShieldCheck, color: '#10b981' },
      { value: String(sourcesCount), label: 'Direct ATS & API Feeds', icon: Layers, color: '#6366f1' },
      { value: '48h', label: 'Avg Interview Response', icon: Clock, color: '#38bdf8' },
      { value: '0$', label: '100% Free For Seekers', icon: Zap, color: '#f59e0b' },
    ],
    [formattedCount, sourcesCount]
  );

  const handleGatedAction = (promptMsg?: string, intent?: AuthIntent, mode?: AuthMode) => {
    openAuthModal(
      promptMsg || 'Sign in to your account to unlock the full search console and direct ATS applications.',
      intent,
      mode
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchKeywords.trim();
    const loc = searchLocation.trim();
    handleGatedAction(
      `🔒 Sign in to your account to search for "${query || 'verified roles'}" across all direct ATS feeds.`,
      {
        type: 'search',
        query,
        location: loc,
      }
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Landing Navbar */}
      <nav
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.1rem 1.5rem',
          }}
        >
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="site-header-logo">
              <JobNexusLogo variant="mark" size={26} priority />
            </div>
            <div>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Job<span className="text-gradient">Nexus</span>
              </span>
              <span
                className="desktop-only"
                style={{
                  marginLeft: '0.55rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 6,
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                }}
              >
                DIRECT ATS
              </span>
            </div>
          </div>

          {/* Right Action Buttons & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => handleGatedAction('Sign in to your account to access verified tech roles.', undefined, 'signin')}
              className="btn-secondary"
              style={{
                padding: '0.52rem 0.95rem',
                fontSize: '0.84rem',
                borderRadius: 10,
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleGatedAction('Create your free JobNexus account to access verified tech roles.', undefined, 'signup')}
              className="btn-primary"
              style={{
                padding: '0.55rem 1.15rem',
                fontSize: '0.86rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderRadius: 10,
              }}
            >
              <UserPlus size={15} />
              <span>Sign Up Free</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '4.5rem 1.5rem 3rem', textAlign: 'center', position: 'relative' }}>
        <div className="container" style={{ maxWidth: 880 }}>
          {/* Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hero-ats-badge"
          >
            <Sparkles size={14} className="hero-ats-badge-icon" />
            <span>
              <span className="hero-ats-badge-accent">Direct ATS Ingestion</span>
              <span className="hero-ats-badge-bullet">•</span>
              <span className="hero-ats-badge-secondary">100% Free For Engineers</span>
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            style={{
              fontSize: 'clamp(2.6rem, 5.8vw, 4.4rem)',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.035em',
              marginBottom: '1.4rem',
              color: 'var(--text-primary)',
            }}
          >
            The Direct ATS Career Engine. <br />
            <span className="text-gradient">Zero Noise. Zero Spam.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.12rem',
              maxWidth: 680,
              margin: '0 auto 2.2rem',
              lineHeight: 1.65,
            }}
          >
            JobNexus indexes verified tech careers directly from employer ATS portals (Greenhouse, Ashby) and premier
            remote hubs. Direct applications. Zero recruitment middleman fees.
          </motion.p>

          {/* Single Hero CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '2.5rem',
            }}
          >
            <button
              type="button"
              onClick={() => handleGatedAction('Sign in to your account to access verified tech roles and direct applications.')}
              className="btn-primary"
              style={{
                padding: '0.92rem 2.6rem',
                fontSize: '1.05rem',
                borderRadius: 14,
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Sparkles size={18} />
              <span>Get Started Free</span>
              <ArrowRight size={18} />
            </button>
          </motion.div>

          {/* Platform Metrics Bar */}
          <div
            className="platform-metrics-grid"
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 18,
              padding: '1.5rem',
              backdropFilter: 'blur(16px)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {platformMetrics.map((metric, idx) => {
              const Icon = metric.icon;
              return (
                <div key={idx} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--tag-bg)',
                      marginBottom: '0.45rem',
                    }}
                  >
                    <Icon size={18} color={metric.color} />
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {metric.value}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: 500 }}>
                    {metric.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pre-login Interactive Search & Filtering Console */}
      <section style={{ padding: '0.5rem 1.5rem 3.5rem' }}>
        <div className="container" style={{ maxWidth: 1040 }}>
          <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              PRE-LOGIN EXPLORER
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
              Preview {formattedCount} Verified Direct ATS Openings
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 620, margin: '0.5rem auto 0' }}>
              Explore real-world engineering roles from top tech employers. Sign in to your account to unlock live keyword querying and 1-click ATS applications.
            </p>
          </div>

          {/* Interactive Gated Workplace Selector with Sliding Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '4px',
                gap: '4px',
                boxShadow: 'var(--shadow-sm)',
                maxWidth: 620,
                width: '100%',
                position: 'relative',
              }}
            >
              {[
                { id: 'all', label: '🌐 All Jobs', remoteParam: '' },
                { id: 'remote', label: '🏠 Fully Remote', remoteParam: 'remote' },
                { id: 'hybrid', label: '🔄 Hybrid Teams', remoteParam: 'hybrid' },
                { id: 'onsite', label: '🏢 On-site Hubs', remoteParam: 'onsite' },
              ].map((item) => {
                const isActive = activeLandingWorkplace === item.remoteParam;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveLandingWorkplace(item.remoteParam);
                      handleGatedAction(
                        `🔒 Sign in to your account to explore ${item.label} engineering roles.`,
                        { type: 'workplace', remote: item.remoteParam }
                      );
                    }}
                    style={{
                      position: 'relative',
                      flex: 1,
                      padding: '0.6rem 0.5rem',
                      background: 'transparent',
                      border: '1px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderRadius: 10,
                      fontSize: '0.84rem',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      whiteSpace: 'nowrap',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      userSelect: 'none',
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeLandingWorkplaceTab"
                        className="workplace-active-slide-indicator"
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 36,
                        }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(139, 92, 246, 0.28))',
                          border: '1px solid rgba(99, 102, 241, 0.5)',
                          zIndex: 1,
                        }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 2 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Gated Search Input Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="glass-panel"
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-card)',
              background: 'var(--surface-card)',
              boxShadow: 'var(--shadow-card)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 240 }}>
              <Search size={18} color="var(--primary-start)" />
              <input
                type="text"
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
                placeholder="Search role, skill, or discipline (e.g. React, Python, Staff SRE)..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  width: '100%',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 160 }}>
              <MapPin size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder="Location (Remote, India, US)..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.86rem',
                  width: '100%',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{
                padding: '0.65rem 1.5rem',
                fontSize: '0.88rem',
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Lock size={13} />
              <span>Search (Sign In)</span>
            </button>
          </form>

          {/* Quick Popular Role Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '2.5rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem' }}>
              Popular Tracks:
            </span>
            {QUICK_ROLE_PILLS.map((pill, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  handleGatedAction(
                    `🔒 Sign in to your account to explore ${pill.label} positions.`,
                    { type: 'pill', query: pill.query }
                  )
                }
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '0.35rem 0.8rem',
                  borderRadius: 20,
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Curated Verified Roles Preview Showcase */}
          <div style={{ marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Live Curated ATS Openings
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Real listings indexed directly from employer Greenhouse &amp; Ashby boards.
                </p>
              </div>

              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 9999,
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                }}
              >
                {PREVIEW_VERIFIED_JOBS.length} Roles Previewed • {formattedCount} Behind Member Login
              </span>
            </div>

            {/* Grid of Verified Job Cards with Gated Apply & Share */}
            <div className="job-grid">
              {displayedPreviewJobs.map((job, index) => (
                <JobCard key={job.id || `preview-${index}`} job={job} index={index} />
              ))}
            </div>

            {/* Gated Showcase Bottom Banner */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="glass-panel"
              style={{
                marginTop: '2rem',
                padding: '1.8rem 2rem',
                borderRadius: 18,
                border: '1px solid var(--border-card)',
                background: 'linear-gradient(135deg, var(--surface-card) 0%, rgba(99, 102, 241, 0.12) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.2rem',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Ready to Apply? Unlock All {formattedCount} Verified Openings
                </h4>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: 540 }}>
                  Sign in to your account to search any skill, filter by timezone or Indian tech hubs, and apply directly with 1 click.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleGatedAction('Sign in to your account to access verified tech roles and direct applications.')}
                className="btn-primary"
                style={{
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.92rem',
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <span>Sign In to Unlock</span>
                <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>

          {/* 6 Discovery Tracks Pre-login Grid */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--primary-start)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              SPECIALIZED TRACKS
            </span>
            <h3 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
              Explore High-Demand Engineering Disciplines
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: 580, margin: '0.4rem auto 0' }}>
              Pre-indexed tracks curated from top tier engineering platforms.
            </p>
          </div>

          <div className="discovery-domain-grid">
            {PREVIEW_DISCOVERY_TRACKS.map((domain, idx) => {
              const Icon = domain.icon;
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -5, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    handleGatedAction(
                      `🔒 Sign in to your account to explore ${domain.title} opportunities.`,
                      {
                        type: 'domain',
                        domainTitle: domain.title,
                        query: domain.query,
                        location: domain.location,
                        remote: domain.remote,
                      }
                    )
                  }
                  className="domain-card"
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="domain-card-icon">
                      <Icon size={22} />
                    </div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: 9999,
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {domain.count}
                    </span>
                  </div>

                  <div>
                    <div className="domain-card-title">
                      <span>{domain.title}</span>
                      <ChevronRight size={16} color="var(--primary-start)" />
                    </div>
                    <p className="domain-card-desc">{domain.desc}</p>
                  </div>

                  <div className="domain-card-tags">
                    {domain.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="domain-card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3 Pillars of Superiority */}
      <section style={{ padding: '4rem 1.5rem', background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: 1040 }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--primary-start)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              ENGINEERING FIRST
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
              Why Developers Choose JobNexus
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', maxWidth: 580, margin: '0.5rem auto 0' }}>
              Traditional job boards are plagued with reposted ghost jobs and recruitment markups. We engineered a better way.
            </p>
          </div>

          <div className="feature-pillars-grid">
            {PILLARS.map((pillar, pIdx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pIdx}
                  className="glass-panel"
                  style={{
                    padding: '2rem 1.8rem',
                    borderRadius: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      <Icon size={22} color="#818cf8" />
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.6rem',
                        borderRadius: 9999,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      {pillar.badge}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pillar.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>{pillar.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Candidate Trust & Quality Assurance Standards Strip */}
      <section style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 960 }}>
          <p
            style={{
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '1.4rem',
            }}
          >
            JOBNEXUS VERIFIED CAREER DISCOVERY STANDARDS
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            {[
              { label: 'Direct Employer ATS Pipelines', icon: <ShieldCheck size={14} color="var(--accent-emerald)" /> },
              { label: '100% Verified Tech Roles', icon: <Zap size={14} color="#38bdf8" /> },
              { label: 'Zero Recruiter Spam & No Dead Links', icon: <ShieldCheck size={14} color="var(--accent-emerald)" /> },
              { label: 'Tier 1 & Tier 2 India Hubs', icon: <span style={{ fontSize: '0.85rem' }}>🇮🇳</span> },
              { label: 'Worldwide Distributed & Remote', icon: <Globe size={14} color="#6366f1" /> },
              { label: 'Real-Time Hourly Synchronization', icon: <Clock size={14} color="#f59e0b" /> },
              { label: 'Authentic Direct Apply Access', icon: <Sparkles size={14} color="#a855f7" /> },
            ].map((item, idx) => (
              <span
                key={idx}
                className="trust-badge"
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.84rem',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 9999,
                  color: '#e2e8f0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Developer Testimonials */}
      <section style={{ padding: '4rem 1.5rem', background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: 1040 }}>
          <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#34d399',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              COMMUNITY PROOF
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)' }}>
              Engineers Hired Direct
            </h2>
          </div>

          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, tIdx) => (
              <div
                key={tIdx}
                className="glass-panel"
                style={{
                  padding: '1.8rem',
                  borderRadius: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.2rem',
                }}
              >
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.65, fontStyle: 'italic' }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      color: '#fff',
                    }}
                  >
                    {t.author[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{t.author}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {t.role} • {t.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom High-Conversion CTA Banner */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 840 }}>
          <div
            className="glass-panel"
            style={{
              padding: '3.5rem 2rem',
              borderRadius: 24,
              border: '1px solid rgba(99, 102, 241, 0.35)',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(99, 102, 241, 0.18) 100%)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Sparkles size={24} color="#818cf8" />
            </div>
            <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.7rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
              Your Dream Role Is One Verified Click Away
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 560, margin: '0 auto 2rem' }}>
              Sign in to your account to access {formattedCount} verified tech roles and direct ATS application links.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => handleGatedAction('Sign in to your account to access verified tech roles and direct applications.')}
                className="btn-primary"
                style={{
                  padding: '0.88rem 2.4rem',
                  fontSize: '1rem',
                  borderRadius: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                }}
              >
                <span>Sign In / Create Account</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border)',
          background: 'var(--footer-bg)',
          padding: '2.5rem 1.5rem',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <JobNexusLogo variant="mark" size={22} />
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Job<span className="text-gradient">Nexus</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              © 2026. All rights reserved.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="pulse-dot" /> 8 ATS Crawlers Active
            </span>
            <button
              type="button"
              onClick={() => handleGatedAction('Sign in to your account to access verified tech roles.')}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
