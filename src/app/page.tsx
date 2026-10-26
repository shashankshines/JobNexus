'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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

  const executeSearch = async (
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
  };

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

  return (
    <main className="container" style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      {/* Header */}
      <header
        style={{
          padding: '1.75rem 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          <motion.div
            whileHover={{ rotate: 15, scale: 1.08 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #00f5ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(99, 102, 241, 0.5), 0 0 10px rgba(0, 245, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            <Sparkles color="white" size={22} />
          </motion.div>
          <div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              Job<span className="text-gradient">Nexus</span>
            </h1>
            <p style={{ fontSize: '0.72rem', color: '#00f5ff', fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              CYBER CAREER ENGINE // v2.4
            </p>
          </div>
        </motion.div>

        {/* Live Aggregation Status Pill */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.55rem',
            background: 'rgba(15, 23, 42, 0.7)',
            padding: '0.45rem 1rem',
            borderRadius: 9999,
            border: '1px solid rgba(0, 245, 255, 0.25)',
            boxShadow: '0 0 16px rgba(0, 245, 255, 0.15)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="pulse-dot" />
          <span style={{ fontSize: '0.78rem', color: '#f8fafc', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
            LIVE AGGREGATION &bull; 8 NODES SYNCED
          </span>
        </motion.div>
      </header>

      {/* Hero Section */}
      <section style={{ margin: '3rem 0 2rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4rem)', fontWeight: 800, marginBottom: '1.25rem', lineHeight: 1.1, letterSpacing: '-0.025em' }}
        >
          Discover Next-Gen <br />
          <span className="text-gradient">Engineering Roles</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: 680, margin: '0 auto 1.5rem', lineHeight: 1.6 }}
        >
          Aggregating verified opportunities live across global engineering networks and employer ATS boards. High signal, zero spam, direct links.
        </motion.p>

        {/* Value Proposition Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '2rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#7dd3fc', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(0, 245, 255, 0.08)', padding: '0.3rem 0.75rem', borderRadius: 9999, border: '1px solid rgba(0, 245, 255, 0.25)' }}>
            <ShieldCheck size={14} color="#00ff87" /> 100% Direct ATS Links
          </span>
          <span style={{ fontSize: '0.78rem', color: '#f472b6', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(236, 72, 153, 0.08)', padding: '0.3rem 0.75rem', borderRadius: 9999, border: '1px solid rgba(236, 72, 153, 0.25)' }}>
            <Zap size={14} color="#ec4899" /> Zero Paywalls or Tracking Walls
          </span>
          <span style={{ fontSize: '0.78rem', color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(139, 92, 246, 0.08)', padding: '0.3rem 0.75rem', borderRadius: 9999, border: '1px solid rgba(139, 92, 246, 0.25)' }}>
            <Briefcase size={14} color="#a855f7" /> Verified Public Feeds
          </span>
        </motion.div>

        {/* Dedicated Workplace Category Selector */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            maxWidth: 1000,
            margin: '0 auto 1.35rem',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              overflowX: 'auto',
              padding: '0.35rem 0.5rem',
              maxWidth: '100%',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {WORKPLACE_CATEGORIES.map((cat) => {
              const isActive = remote === cat.remoteParam;

              let activeBorderColor = 'rgba(0, 245, 255, 0.75)';
              let activeBgColor = 'rgba(0, 245, 255, 0.16)';
              let activeTextColor = '#00f5ff';
              let activeGlow = '0 0 22px rgba(0, 245, 255, 0.45)';

              if (cat.id === 'remote') {
                activeBorderColor = 'rgba(0, 255, 135, 0.8)';
                activeBgColor = 'rgba(0, 255, 135, 0.16)';
                activeTextColor = '#00ff87';
                activeGlow = '0 0 24px rgba(0, 255, 135, 0.45)';
              } else if (cat.id === 'onsite') {
                activeBorderColor = 'rgba(245, 158, 11, 0.8)';
                activeBgColor = 'rgba(245, 158, 11, 0.16)';
                activeTextColor = '#fbbf24';
                activeGlow = '0 0 20px rgba(245, 158, 11, 0.35)';
              } else if (cat.id === 'hybrid') {
                activeBorderColor = 'rgba(236, 72, 153, 0.8)';
                activeBgColor = 'rgba(236, 72, 153, 0.16)';
                activeTextColor = '#f472b6';
                activeGlow = '0 0 22px rgba(236, 72, 153, 0.4)';
              }

              return (
                <motion.button
                  key={cat.id}
                  type="button"
                  onClick={() => handleWorkplaceCategoryClick(cat.remoteParam)}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.62rem 1.25rem',
                    borderRadius: 24,
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isActive ? `1.5px solid ${activeBorderColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isActive ? activeBgColor : 'rgba(255, 255, 255, 0.04)',
                    color: isActive ? activeTextColor : 'var(--text-secondary)',
                    boxShadow: isActive ? activeGlow : 'none',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.09)';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{cat.icon}</span>
                  <span>{cat.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Search Bar & Dropdowns Form */}
        <motion.form
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          onSubmit={handleSearchSubmit}
          className="glass-panel"
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            padding: '1.1rem',
            display: 'flex',
            gap: '0.65rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            position: 'relative',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.88) 0%, rgba(9, 14, 26, 0.96) 100%)',
            border: '1px solid rgba(0, 245, 255, 0.22)',
            borderRadius: 14,
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 30px -5px rgba(99, 102, 241, 0.25)',
          }}
        >
          {/* Query Input with Relevant Job Posts Dropdown */}
          <div
            ref={searchBoxRef}
            style={{
              flex: '1.4',
              minWidth: 220,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(3, 7, 18, 0.7)',
              borderRadius: 10,
              padding: '0 0.85rem',
              border: showJobDropdown ? '1px solid rgba(0, 245, 255, 0.65)' : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: showJobDropdown ? '0 0 16px rgba(0, 245, 255, 0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Job title, role, or keywords"
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
                padding: '0.9rem 0.5rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.95rem',
              }}
            />
            {query && (
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  setQuery('');
                  setJobSuggestions(getSuggestions(''));
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                title="Clear input"
              >
                <X size={15} />
              </motion.button>
            )}

            {/* Relevant Job Posts Dropdown */}
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
                    minWidth: 260,
                    zIndex: 200,
                    background: '#121829',
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
                    flexDirection: 'column',
                    display: 'flex',
                    overflow: 'hidden',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-secondary)',
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Zap size={13} color="var(--primary-start)" />
                    Suggested Job Titles
                  </div>
                  {jobSuggestions.map((suggestion, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ x: 3, background: 'rgba(255,255,255,0.08)' }}
                      onClick={() => handleJobSuggestionClick(suggestion)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <Briefcase size={14} color="var(--primary-start)" />
                      <span>{suggestion}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Location Input with Popular Locations Dropdown */}
          <div
            ref={locBoxRef}
            style={{
              flex: '1',
              minWidth: 190,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(3, 7, 18, 0.7)',
              borderRadius: 10,
              padding: '0 0.85rem',
              border: showLocDropdown ? '1px solid rgba(0, 245, 255, 0.65)' : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: showLocDropdown ? '0 0 16px rgba(0, 245, 255, 0.2)' : 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <MapPin size={18} color={showLocDropdown ? 'var(--neon-cyan)' : 'var(--text-secondary)'} style={{ flexShrink: 0, transition: 'color 0.2s ease' }} />
            <input
              type="text"
              placeholder="City, Country, or India"
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
                padding: '0.9rem 0.5rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.95rem',
                fontFamily: 'var(--font-sans)',
              }}
            />
            {location && (
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  setLocation('');
                  setLocationSuggestions(getLocationSuggestions(''));
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                title="Clear location"
              >
                <X size={15} />
              </motion.button>
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
                    minWidth: 230,
                    zIndex: 200,
                    background: '#070d1e',
                    borderRadius: 10,
                    border: '1px solid rgba(0, 245, 255, 0.25)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 245, 255, 0.1)',
                    flexDirection: 'column',
                    display: 'flex',
                    overflow: 'hidden',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--neon-cyan)',
                      background: 'rgba(0, 245, 255, 0.05)',
                      borderBottom: '1px solid rgba(0, 245, 255, 0.15)',
                    }}
                  >
                    POPULAR LOCATIONS
                  </div>
                  {locationSuggestions.map((loc, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ x: 3, background: 'rgba(0, 245, 255, 0.1)' }}
                      onClick={() => handleLocSuggestionClick(loc)}
                      style={{
                        padding: '0.72rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <MapPin size={13} color="var(--neon-cyan)" />
                      <span>{loc}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Role / Job Post Category Dropdown */}
          <div style={{ flex: '0.8', minWidth: 155, background: 'rgba(3, 7, 18, 0.7)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'border-color 0.2s ease' }}>
            <select
              value={selectedRole}
              onChange={handleRoleSelectChange}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '0.9rem 0.4rem',
                color: selectedRole ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                outline: 'none',
                fontSize: '0.88rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: selectedRole ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#070d1e', color: '#e2e8f0' }}>All Roles & Categories</option>
              {JOB_POST_GROUPS.map((group, gIdx) => (
                <optgroup
                  key={gIdx}
                  label={group.group}
                  style={{ background: '#030712', color: '#00f5ff', fontWeight: 'bold' }}
                >
                  {group.posts.map((post, pIdx) => (
                    <option
                      key={pIdx}
                      value={post.value}
                      style={{ background: '#070d1e', color: '#e2e8f0', fontWeight: 'normal' }}
                    >
                      {post.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Workplace / Remote Model Dropdown */}
          <div style={{ flex: '0.6', minWidth: 140, background: 'rgba(3, 7, 18, 0.7)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'border-color 0.2s ease' }}>
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
                padding: '0.9rem 0.4rem',
                color: remote ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                outline: 'none',
                fontSize: '0.88rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: remote ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#070d1e', color: '#e2e8f0' }}>🌐 Any Workplace</option>
              <option value="remote" style={{ background: '#070d1e', color: '#00ff87' }}>🏠 Remote</option>
              <option value="hybrid" style={{ background: '#070d1e', color: '#00f5ff' }}>🔄 Hybrid</option>
              <option value="onsite" style={{ background: '#070d1e', color: '#f59e0b' }}>🏢 On-site</option>
            </select>
          </div>

          {/* Job Type Dropdown */}
          <div style={{ flex: '0.5', minWidth: 120, background: 'rgba(3, 7, 18, 0.7)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'border-color 0.2s ease' }}>
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
                padding: '0.9rem 0.4rem',
                color: type ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                outline: 'none',
                fontSize: '0.88rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: type ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#070d1e', color: '#e2e8f0' }}>Any Type</option>
              <option value="full time" style={{ background: '#070d1e', color: '#e2e8f0' }}>Full Time</option>
              <option value="contract" style={{ background: '#070d1e', color: '#e2e8f0' }}>Contract</option>
              <option value="part time" style={{ background: '#070d1e', color: '#e2e8f0' }}>Part Time</option>
              <option value="freelance" style={{ background: '#070d1e', color: '#e2e8f0' }}>Freelance</option>
              <option value="internship" style={{ background: '#070d1e', color: '#e2e8f0' }}>Internship</option>
            </select>
          </div>

          {/* Seniority Level Dropdown */}
          <div style={{ flex: '0.5', minWidth: 120, background: 'rgba(3, 7, 18, 0.7)', borderRadius: 10, padding: '0 0.5rem', border: '1px solid rgba(255, 255, 255, 0.08)', transition: 'border-color 0.2s ease' }}>
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
                padding: '0.9rem 0.4rem',
                color: level ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                outline: 'none',
                fontSize: '0.88rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: level ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#070d1e', color: '#e2e8f0' }}>Any Level</option>
              <option value="entry" style={{ background: '#070d1e', color: '#e2e8f0' }}>Entry Level</option>
              <option value="mid" style={{ background: '#070d1e', color: '#e2e8f0' }}>Mid Level</option>
              <option value="senior" style={{ background: '#070d1e', color: '#e2e8f0' }}>Senior</option>
              <option value="lead" style={{ background: '#070d1e', color: '#e2e8f0' }}>Lead / Manager</option>
            </select>
          </div>

          {/* Search Button */}
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(0, 245, 255, 0.5), 0 4px 20px rgba(99, 102, 241, 0.4)' }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            className="btn-primary"
            style={{
              height: 48,
              padding: '0 1.8rem',
              borderRadius: 10,
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.04em',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>SEARCHING</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>SEARCH</span>
              </>
            )}
          </motion.button>
        </motion.form>

        {/* Active Workplace Category Filter Pill */}
        <AnimatePresence>
          {remote && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              style={{
                maxWidth: 1000,
                margin: '0.85rem auto 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.35rem 0.9rem',
                  borderRadius: 16,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#34d399',
                }}
              >
                <span>Category Filter:</span>
                <strong>
                  {WORKPLACE_CATEGORIES.find((c) => c.remoteParam === remote)?.label || remote}
                </strong>
                <button
                  type="button"
                  onClick={() => handleWorkplaceCategoryClick('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#34d399',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    marginLeft: 3,
                  }}
                  title="Reset Category Filter"
                >
                  <X size={13} />
                </button>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Trending Job Post Pills */}
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
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '0.25rem' }}>
            Trending Roles:
          </span>
          {QUICK_JOB_POSTS.map((pill, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => handleQuickPillClick(pill)}
              style={{
                background: query === pill.query ? 'rgba(0, 245, 255, 0.16)' : 'rgba(3, 7, 18, 0.6)',
                color: query === pill.query ? '#00f5ff' : 'var(--text-secondary)',
                border: `1px solid ${query === pill.query ? 'rgba(0, 245, 255, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                boxShadow: query === pill.query ? '0 0 14px rgba(0, 245, 255, 0.25)' : 'none',
                padding: '0.4rem 0.9rem',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: query === pill.query ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s ease',
              }}
            >
              {pill.label}
            </motion.button>
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
            <div style={{ display: 'flex', background: 'rgba(3, 7, 18, 0.7)', borderRadius: 10, padding: 3, border: '1px solid rgba(0, 245, 255, 0.15)' }}>
              <button
                type="button"
                onClick={() => setSortBy('relevance')}
                style={{
                  background: sortBy === 'relevance' ? 'linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(99, 102, 241, 0.25))' : 'transparent',
                  color: sortBy === 'relevance' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                  border: sortBy === 'relevance' ? '1px solid rgba(0, 245, 255, 0.4)' : '1px solid transparent',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
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
                  background: sortBy === 'date' ? 'linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(99, 102, 241, 0.25))' : 'transparent',
                  color: sortBy === 'date' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                  border: sortBy === 'date' ? '1px solid rgba(0, 245, 255, 0.4)' : '1px solid transparent',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
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
                background: 'linear-gradient(135deg, rgba(3, 7, 18, 0.95) 0%, rgba(10, 15, 30, 0.85) 100%)',
                border: '1px solid rgba(0, 245, 255, 0.25)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(0, 245, 255, 0.25)',
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem', color: '#fff' }}>
                  Prefer to explore without filters?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                  Access our full aggregated feed of 1,340+ verified opportunities directly from public boards.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
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
