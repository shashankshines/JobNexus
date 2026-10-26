'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  MapPin,
  Loader2,
  AlertCircle,
  Sparkles,
  Briefcase,
  Zap,
  X,
  ArrowUp,
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  TrendingUp,
  Globe,
  Code2,
  Server,
  ArrowRight,
  ChevronRight,
  Compass,
} from 'lucide-react';
import JobCard from './components/JobCard';
import LandingView from './components/LandingView';
import ThemeToggle from './components/ThemeToggle';
import { useAuth } from './context/AuthContext';
import {
  getSuggestions,
  getLocationSuggestions,
  JOB_POST_GROUPS,
  WORKPLACE_CATEGORIES,
  isRemoteRole,
} from '@/utils/suggestions';
import { motion, AnimatePresence } from 'framer-motion';

interface DiscoveryDomain {
  title: string;
  count: string;
  desc: string;
  tags: string[];
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  query?: string;
  remote?: string;
  location?: string;
}

const DISCOVERY_DOMAINS: DiscoveryDomain[] = [
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

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  date: string;
  source: string;
  tags: string[];
  isRemote?: boolean;
  workplaceType?: string;
  isIndiaEligible?: boolean;
  isFresh?: boolean;
}

interface QuickPill {
  label: string;
  query?: string;
  location?: string;
  remote?: string;
}

const QUICK_JOB_POSTS: QuickPill[] = [
  { label: '⚡ Full Stack', query: 'Full Stack Developer' },
  { label: '⚛️ React / Next.js', query: 'React Developer' },
  { label: '🤖 AI & Machine Learning', query: 'AI Machine Learning' },
  { label: '🐍 Python / Backend', query: 'Python Backend Engineer' },
  { label: '☁️ DevOps & Cloud', query: 'DevOps Cloud' },
  { label: '📱 Mobile (Flutter/RN)', query: 'Mobile Developer' },
  { label: '🎨 UI/UX Design', query: 'Product Designer' },
  { label: '🔒 Cybersecurity', query: 'Cybersecurity Analyst' },
];

export default function Home() {
  const { user, isAuthenticated, isHydrated, logout, consumePendingIntent } = useAuth();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [remote, setRemote] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Suggestions state
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const locBoxRef = useRef<HTMLDivElement>(null);
  const intentProcessedRef = useRef(false);

  const executeSearch = useCallback(
    async (
      searchQuery = query,
      searchLoc = location,
      searchType = type,
      searchLevel = level,
      roleCategory = selectedRole,
      searchRemote = remote
    ) => {
      setLoading(true);
      setSearched(true);
      setShowJobDropdown(false);
      setShowLocDropdown(false);

      try {
        const params = new URLSearchParams();
        const effectiveQuery = [searchQuery, roleCategory].filter(Boolean).join(' ').trim();
        if (effectiveQuery) params.append('query', effectiveQuery);
        if (searchLoc) params.append('location', searchLoc);
        if (searchType) params.append('type', searchType);
        if (searchLevel) params.append('level', searchLevel);
        if (searchRemote) params.append('remote', searchRemote);

        const res = await fetch(`/api/jobs?${params.toString()}`);
        const data = await res.json();

        if (data.jobs && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        } else {
          setJobs([]);
        }
      } catch (error) {
        console.error('[Search Error]:', error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [query, location, type, level, selectedRole, remote]
  );

  // Seamlessly execute any search or application action triggered before login
  useEffect(() => {
    if (isAuthenticated && !intentProcessedRef.current) {
      intentProcessedRef.current = true;
      const intent = consumePendingIntent();
      if (intent) {
        if (intent.type === 'apply' && intent.url) {
          window.open(intent.url, '_blank', 'noopener,noreferrer');
          const roleQuery = intent.jobTitle || intent.company || '';
          setQuery(roleQuery);
          executeSearch(roleQuery, '', '', '', '', '');
        } else if (intent.type === 'search') {
          const q = intent.query || '';
          const loc = intent.location || '';
          setQuery(q);
          if (loc) setLocation(loc);
          executeSearch(q, loc, '', '', '', '');
        } else if (intent.type === 'pill') {
          const q = intent.query || '';
          setQuery(q);
          executeSearch(q, '', '', '', '', '');
        } else if (intent.type === 'domain') {
          const q = intent.query || '';
          const loc = intent.location || '';
          const rem = intent.remote || '';
          setQuery(q);
          setLocation(loc);
          setRemote(rem);
          executeSearch(q, loc, '', '', '', rem);
        } else if (intent.type === 'workplace') {
          const rem = intent.remote || '';
          setRemote(rem);
          executeSearch('', '', '', '', '', rem);
        }
      }
    } else if (!isAuthenticated) {
      intentProcessedRef.current = false;
    }
  }, [isAuthenticated, consumePendingIntent, executeSearch]);

  // Scroll listener for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 380);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowJobDropdown(false);
      }
      if (locBoxRef.current && !locBoxRef.current.contains(event.target as Node)) {
        setShowLocDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update suggestions on input changes
  useEffect(() => {
    setJobSuggestions(getSuggestions(query));
  }, [query]);

  useEffect(() => {
    setLocationSuggestions(getLocationSuggestions(location));
  }, [location]);

  const handleDomainClick = (domain: DiscoveryDomain) => {
    const nextQuery = domain.query ?? '';
    const nextLoc = domain.location ?? '';
    const nextRemote = domain.remote ?? '';
    setQuery(nextQuery);
    setLocation(nextLoc);
    setRemote(nextRemote);
    setSelectedRole('');
    executeSearch(nextQuery, nextLoc, type, level, '', nextRemote);
  };

  const handleBrowseAllClick = () => {
    setQuery('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    executeSearch('', '', '', '', '', '');
  };

  const resetToDiscovery = () => {
    setQuery('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    setJobs([]);
    setSearched(false);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    executeSearch();
  };

  const handleJobSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowJobDropdown(false);
    executeSearch(suggestion, location, type, level, selectedRole, remote);
  };

  const handleLocSuggestionClick = (loc: string) => {
    setLocation(loc);
    setShowLocDropdown(false);
    executeSearch(query, loc, type, level, selectedRole, remote);
  };

  const handleRoleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roleVal = e.target.value;
    setSelectedRole(roleVal);
    let nextRemote = remote;
    if (isRemoteRole(roleVal) && !remote) {
      nextRemote = 'remote';
      setRemote('remote');
    }
    executeSearch(query, location, type, level, roleVal, nextRemote);
  };

  const handleWorkplaceCategoryClick = (categoryRemoteParam: string) => {
    setRemote(categoryRemoteParam);
    executeSearch(query, location, type, level, selectedRole, categoryRemoteParam);
  };

  const handleQuickPillClick = (pill: QuickPill) => {
    const nextQuery = pill.query ?? query;
    const nextLoc = pill.location ?? location;
    const nextRemote = pill.remote ?? remote;

    setQuery(nextQuery);
    if (pill.location !== undefined) setLocation(nextLoc);
    if (pill.remote !== undefined) setRemote(nextRemote);

    executeSearch(nextQuery, nextLoc, type, level, selectedRole, nextRemote);
  };

  const clearAllFilters = () => {
    setQuery('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    executeSearch('', '', '', '', '', '');
  };

  // Client-side instant sorting
  const displayedJobs = useMemo(() => {
    if (sortBy === 'date') {
      return [...jobs].sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
    }
    return jobs;
  }, [jobs, sortBy]);

  if (!isHydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles color="white" size={22} />
          </div>
          <div className="skeleton-shimmer" style={{ width: 140, height: 16, borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingView />;
  }

  return (
    <main className="container" style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      {/* Authenticated Dashboard Header */}
      <header
        style={{
          padding: '1.5rem 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1rem',
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          onClick={resetToDiscovery}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <Sparkles color="white" size={20} />
          </motion.div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              Job<span className="text-gradient">Nexus</span>
            </h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.04em' }}>
              AUTHENTICATED SEARCH CONSOLE
            </p>
          </div>
        </motion.div>

        {/* Live Aggregation Status Pill + ThemeToggle + User Profile Capsule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <ThemeToggle />
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              background: 'var(--surface-card)',
              padding: '0.42rem 0.95rem',
              borderRadius: 9999,
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-card)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span className="pulse-dot" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.01em' }}>
              1,340+ Live Verified Roles
            </span>
          </motion.div>

          {/* User Profile Capsule */}
          {user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: 'var(--surface-card)',
                padding: '0.35rem 0.75rem 0.35rem 0.45rem',
                borderRadius: 9999,
                border: '1px solid var(--border-card)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(66, 133, 244, 0.4)',
                }}
              >
                {user.initials}
              </div>
              <div style={{ textAlign: 'left', marginRight: '0.2rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{user.name}</span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: 'rgba(66, 133, 244, 0.18)',
                      color: 'var(--primary)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 4,
                      border: '1px solid rgba(66, 133, 244, 0.3)',
                    }}
                  >
                    Gmail
                  </span>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.1 }}>
                  {user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of JobNexus"
                style={{
                  background: 'var(--tag-bg)',
                  border: '1px solid var(--tag-border)',
                  borderRadius: 8,
                  padding: '0.32rem 0.65rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--tag-bg)';
                  e.currentTarget.style.borderColor = 'var(--tag-border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                Log Out
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ margin: '3.2rem 0 2rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.95rem',
            borderRadius: 9999,
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.22)',
            color: '#a5b4fc',
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          <Sparkles size={13} color="#818cf8" />
          <span>Verified Tech Career Platform</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: 'clamp(2.4rem, 5.2vw, 3.8rem)', fontWeight: 800, marginBottom: '1.15rem', lineHeight: 1.15, letterSpacing: '-0.03em' }}
        >
          Find Your Next <br />
          <span className="text-gradient">High-Growth Tech Role</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', maxWidth: 640, margin: '0 auto 1.6rem', lineHeight: 1.65 }}
        >
          Direct applications from verified employer ATS boards and legitimate public engineering hubs. Zero spam, zero middleman fees.
        </motion.p>

        {/* Value Proposition Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '2rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.32rem 0.8rem', borderRadius: 9999, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <ShieldCheck size={14} color="#10b981" /> 100% Direct ATS Links
          </span>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.32rem 0.8rem', borderRadius: 9999, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Zap size={14} color="#f59e0b" /> Zero Paywalls
          </span>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.32rem 0.8rem', borderRadius: 9999, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Globe size={14} color="#38bdf8" /> Global &amp; India Roles
          </span>
        </motion.div>

        {/* Dedicated Workplace Category Selector */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            maxWidth: 620,
            margin: '0 auto 1.5rem',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '4px',
              gap: '4px',
              boxShadow: 'var(--shadow-sm)',
              width: '100%',
              maxWidth: 580,
            }}
          >
            {WORKPLACE_CATEGORIES.map((cat) => {
              const isActive = remote === cat.remoteParam;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleWorkplaceCategoryClick(cat.remoteParam)}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.62rem 0.85rem',
                    borderRadius: 10,
                    fontSize: '0.86rem',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                    background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(139, 92, 246, 0.28))' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.25)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Unified 2-Tier Search Console */}
        <motion.form
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          onSubmit={handleSearchSubmit}
          className="glass-panel"
          style={{
            maxWidth: 1040,
            margin: '0 auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Top Tier: Primary Inputs + Search CTA */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Query Input */}
            <div
              ref={searchBoxRef}
              style={{
                flex: '1.8',
                minWidth: 260,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--input-bg)',
                borderRadius: 12,
                padding: '0 0.9rem',
                border: showJobDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                boxShadow: showJobDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search role, skills, or company (e.g. React, Python, Staff)..."
                value={query}
                onFocus={() => setShowJobDropdown(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowJobDropdown(true);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.95rem 0.6rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.95rem',
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setJobSuggestions(getSuggestions(''));
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                  title="Clear input"
                >
                  <X size={15} />
                </button>
              )}

              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {showJobDropdown && jobSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: '115%',
                      left: 0,
                      width: '100%',
                      minWidth: 280,
                      zIndex: 200,
                      background: 'var(--dropdown-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-lg)',
                      flexDirection: 'column',
                      display: 'flex',
                      overflow: 'hidden',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        padding: '0.6rem 0.95rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--tag-bg)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Zap size={13} color="var(--primary-start)" />
                      Suggested Roles
                    </div>
                    {jobSuggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        onClick={() => handleJobSuggestionClick(suggestion)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.55rem',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Briefcase size={14} color="var(--primary-start)" />
                        <span>{suggestion}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Location Input */}
            <div
              ref={locBoxRef}
              style={{
                flex: '1.2',
                minWidth: 200,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--input-bg)',
                borderRadius: 12,
                padding: '0 0.9rem',
                border: showLocDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                boxShadow: showLocDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <MapPin size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="City, Country, or India..."
                value={location}
                onFocus={() => setShowLocDropdown(true)}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setShowLocDropdown(true);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.95rem 0.6rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.95rem',
                }}
              />
              {location && (
                <button
                  type="button"
                  onClick={() => {
                    setLocation('');
                    setLocationSuggestions(getLocationSuggestions(''));
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                  title="Clear location"
                >
                  <X size={15} />
                </button>
              )}

              {/* Location Suggestions Dropdown */}
              <AnimatePresence>
                {showLocDropdown && locationSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: '115%',
                      left: 0,
                      width: '100%',
                      minWidth: 240,
                      zIndex: 200,
                      background: 'var(--dropdown-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-lg)',
                      flexDirection: 'column',
                      display: 'flex',
                      overflow: 'hidden',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        padding: '0.6rem 0.95rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        background: 'var(--tag-bg)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Popular Locations
                    </div>
                    {locationSuggestions.map((loc, i) => (
                      <div
                        key={i}
                        onClick={() => handleLocSuggestionClick(loc)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.55rem',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <MapPin size={13} color="var(--primary-start)" />
                        <span>{loc}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Primary Search CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="btn-primary"
              style={{
                height: 48,
                padding: '0 2rem',
                borderRadius: 12,
                fontSize: '0.95rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search size={17} />
                  <span>Search Jobs</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Bottom Tier: Refinement Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.65rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              paddingTop: '0.85rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.15rem' }}>
              Filters:
            </span>

            {/* Role Dropdown */}
            <div style={{ flex: '1', minWidth: 160, background: 'var(--input-bg)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid var(--input-border)' }}>
              <select
                value={selectedRole}
                onChange={handleRoleSelectChange}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.65rem 0.35rem',
                  color: selectedRole ? 'var(--text-primary)' : 'var(--text-secondary)',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: selectedRole ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>All Roles & Categories</option>
                {JOB_POST_GROUPS.map((group, gIdx) => (
                  <optgroup
                    key={gIdx}
                    label={group.group}
                    style={{ background: 'var(--dropdown-bg)', color: 'var(--primary-start)', fontWeight: 'bold' }}
                  >
                    {group.posts.map((post, pIdx) => (
                      <option
                        key={pIdx}
                        value={post.value}
                        style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)', fontWeight: 'normal' }}
                      >
                        {post.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Workplace Dropdown */}
            <div style={{ flex: '0.8', minWidth: 140, background: 'var(--input-bg)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid var(--input-border)' }}>
              <select
                value={remote}
                onChange={(e) => {
                  setRemote(e.target.value);
                  executeSearch(query, location, type, level, selectedRole, e.target.value);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.65rem 0.35rem',
                  color: remote ? 'var(--text-primary)' : 'var(--text-secondary)',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: remote ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>🌐 Any Workplace</option>
                <option value="remote" style={{ background: 'var(--dropdown-bg)', color: 'var(--accent-emerald)' }}>🏠 Fully Remote</option>
                <option value="hybrid" style={{ background: 'var(--dropdown-bg)', color: 'var(--accent-violet)' }}>🔄 Hybrid</option>
                <option value="onsite" style={{ background: 'var(--dropdown-bg)', color: 'var(--accent-amber)' }}>🏢 On-site</option>
              </select>
            </div>

            {/* Type Dropdown */}
            <div style={{ flex: '0.7', minWidth: 130, background: 'var(--input-bg)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid var(--input-border)' }}>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  executeSearch(query, location, e.target.value, level, selectedRole, remote);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.65rem 0.35rem',
                  color: type ? 'var(--text-primary)' : 'var(--text-secondary)',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: type ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Any Type</option>
                <option value="full time" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Full Time</option>
                <option value="contract" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Contract</option>
                <option value="part time" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Part Time</option>
                <option value="freelance" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Freelance</option>
                <option value="internship" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Internship</option>
              </select>
            </div>

            {/* Level Dropdown */}
            <div style={{ flex: '0.7', minWidth: 130, background: 'var(--input-bg)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid var(--input-border)' }}>
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  executeSearch(query, location, type, e.target.value, selectedRole, remote);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.65rem 0.35rem',
                  color: level ? 'var(--text-primary)' : 'var(--text-secondary)',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: level ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Any Level</option>
                <option value="entry" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Entry Level</option>
                <option value="mid" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Mid Level</option>
                <option value="senior" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Senior</option>
                <option value="lead" style={{ background: 'var(--dropdown-bg)', color: 'var(--text-primary)' }}>Lead / Manager</option>
              </select>
            </div>

            {/* Clear Filters CTA if active */}
            {(query || location || remote || selectedRole || type || level) && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                  borderRadius: 10,
                  fontSize: '0.82rem',
                  padding: '0.65rem 0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <X size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </motion.form>

        {/* Quick Popular Search Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            maxWidth: 1000,
            margin: '1.25rem auto 0',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem' }}>
            Popular Searches:
          </span>
          {QUICK_JOB_POSTS.map((pill, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickPillClick(pill)}
              style={{
                background: query === pill.query ? 'rgba(99, 102, 241, 0.2)' : 'var(--tag-bg)',
                color: query === pill.query ? 'var(--primary)' : 'var(--text-secondary)',
                border: `1px solid ${query === pill.query ? 'rgba(99, 102, 241, 0.45)' : 'var(--tag-border)'}`,
                boxShadow: query === pill.query ? '0 2px 8px rgba(99, 102, 241, 0.2)' : 'none',
                padding: '0.38rem 0.85rem',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: query === pill.query ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {pill.label}
            </button>
          ))}
        </motion.div>
      </section>

      {/* Results Header Toolbar */}
      {!loading && searched && displayedJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem 0.5rem',
            marginBottom: '1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {displayedJobs.length} Verified Positions
            </span>
            <button
              type="button"
              onClick={resetToDiscovery}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Compass size={13} />
              <span>Back to Discovery</span>
            </button>
            {(query || location || remote || selectedRole || type || level) && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '0.2rem 0.4rem',
                }}
              >
                Clear all filters
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <SlidersHorizontal size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Sort:
            </span>
            <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setSortBy('relevance')}
                style={{
                  background: sortBy === 'relevance' ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))' : 'transparent',
                  color: sortBy === 'relevance' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: sortBy === 'relevance' ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <TrendingUp size={12} />
                Best Match
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                style={{
                  background: sortBy === 'date' ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))' : 'transparent',
                  color: sortBy === 'date' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: sortBy === 'date' ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <Clock size={12} />
                Freshest First
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Results or Discovery Section */}
      <div style={{ minHeight: 400 }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  minHeight: 220,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton-shimmer" style={{ width: '55%', height: 22 }} />
                  <div className="skeleton-shimmer" style={{ width: 75, height: 22, borderRadius: 9999 }} />
                </div>
                <div className="skeleton-shimmer" style={{ width: '35%', height: 16 }} />
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="skeleton-shimmer" style={{ width: '30%', height: 14 }} />
                  <div className="skeleton-shimmer" style={{ width: '25%', height: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <div className="skeleton-shimmer" style={{ width: 60, height: 22, borderRadius: 9999 }} />
                  <div className="skeleton-shimmer" style={{ width: 75, height: 22, borderRadius: 9999 }} />
                  <div className="skeleton-shimmer" style={{ width: 65, height: 22, borderRadius: 9999 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div className="skeleton-shimmer" style={{ width: 90, height: 20 }} />
                  <div className="skeleton-shimmer" style={{ width: 80, height: 32, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : searched && displayedJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4.5rem 1.5rem' }} className="animate-fade-in">
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'inline-flex',
                padding: '1.25rem',
                borderRadius: '50%',
                marginBottom: '1.25rem',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertCircle size={36} color="var(--error)" />
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>No active public listings found</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              We couldn&apos;t verify any active public links matching your exact combination. Try broadening your keywords or resetting filters.
            </p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetToDiscovery}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Compass size={15} />
                <span>Return to Discovery</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearAllFilters}
                className="btn-primary"
              >
                Clear All Filters
              </motion.button>
            </div>
          </div>
        ) : searched && displayedJobs.length > 0 ? (
          <motion.div
            layout
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}
          >
            <AnimatePresence mode="popLayout">
              {displayedJobs.map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Standard Discovery Section when not searched yet */
          <div style={{ marginTop: '0.5rem', paddingBottom: '3rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.9rem',
                  borderRadius: 9999,
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: '#a5b4fc',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                }}
              >
                <Compass size={14} />
                <span>Curated Discovery Tracks</span>
              </div>
              <h3 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                Explore High-Demand Engineering Tracks
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
                Select a high-demand domain to explore live verified opportunities, or query specific keywords with the search console above.
              </p>
            </div>

            {/* 6-Card Domain Explorer Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.4rem' }}>
              {DISCOVERY_DOMAINS.map((domain, idx) => {
                const Icon = domain.icon;
                return (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -5, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDomainClick(domain)}
                    className="domain-card"
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

            {/* Browse All Banner */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="glass-panel"
              style={{
                marginTop: '2.5rem',
                padding: '2.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem',
                background: 'linear-gradient(135deg, var(--surface-card) 0%, rgba(99, 102, 241, 0.12) 100%)',
                border: '1px solid var(--border-card)',
                boxShadow: 'var(--shadow-card)',
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  Prefer to explore without filters?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                  Access our full aggregated feed of 1,340+ verified opportunities directly from public boards.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleBrowseAllClick}
                className="btn-primary"
                style={{ padding: '0.85rem 1.8rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
              >
                <span>Browse All 1,300+ Positions</span>
                <ArrowRight size={17} />
              </motion.button>
            </motion.div>

            {/* Verified Public Network Trust Strip */}
            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.2rem' }}>
                AGGREGATING DIRECTLY FROM VERIFIED PUBLIC SOURCES & EMPLOYER ATS BOARDS
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                {['Greenhouse ATS', 'Ashby ATS', 'Himalayas', 'WeWorkRemotely', 'Jobicy', 'RemoteOK', 'Remotive', 'Arbeitnow'].map((source, sIdx) => (
                  <span key={sIdx} className="trust-badge">
                    <ShieldCheck size={13} color="var(--accent-emerald)" />
                    <span>{source}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Back to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.12, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            style={{
              position: 'fixed',
              bottom: 30,
              right: 30,
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary-start), var(--primary-end))',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
              zIndex: 100,
            }}
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}
