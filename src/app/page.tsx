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
  Bookmark,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Check,
  ArrowDown,
} from 'lucide-react';
import JobCard from './components/JobCard';
import ThemeToggle from './components/ThemeToggle';
import FuturisticToast from './components/FuturisticToast';
import { useAuth } from './context/AuthContext';
import { useJobStats } from '@/modules/jobs/hooks/useJobStats';
import {
  isValidApplicationUrl,
  getFallbackApplicationUrl,
} from '@/modules/jobs/domain/job.masking';
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

const WORKPLACE_OPTIONS = [
  { value: '', label: 'Any Workplace', icon: '🌐' },
  { value: 'remote', label: 'Fully Remote', icon: '🏠' },
  { value: 'hybrid', label: 'Hybrid', icon: '🔄' },
  { value: 'onsite', label: 'On-site', icon: '🏢' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Any Type' },
  { value: 'full time', label: 'Full Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'part time', label: 'Part Time' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
];

const LEVEL_OPTIONS = [
  { value: '', label: 'Any Level' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Manager' },
];

export default function Home() {
  const {
    user,
    isAuthenticated,
    authStatus,
    isHydrated,
    logout,
    consumePendingIntent,
    openAuthModal,
    savedJobs,
    toast,
    clearToast,
    showToast,
  } = useAuth();
  const { formattedCount, sourcesCount, syncFromJobsCount } = useJobStats();
  const [activeView, setActiveView] = useState<'all' | 'saved'>('all');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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

  // Progressive Chunk Lazy Loading (Infinite Scroll) state
  const JOBS_BATCH_SIZE = 18;
  const [visibleCount, setVisibleCount] = useState(JOBS_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Suggestions state
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);

  // Refinement Filter Dropdowns state
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [showWorkplaceDropdown, setShowWorkplaceDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const locBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const workplaceDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
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
      setShowRoleDropdown(false);
      setShowWorkplaceDropdown(false);
      setShowTypeDropdown(false);
      setShowLevelDropdown(false);

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
          // When full unconstrained feed is retrieved, sync live count
          if (!effectiveQuery && !searchLoc && !searchType && !searchLevel && !searchRemote) {
            syncFromJobsCount(data.jobs.length);
          }
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
    [query, location, type, level, selectedRole, remote, syncFromJobsCount]
  );

  // When authentication status transitions (login or logout),
  // refresh existing search results so masked/unmasked company identities update immediately.
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthRef.current !== isAuthenticated) {
      prevAuthRef.current = isAuthenticated;
      if (searched || jobs.length > 0) {
        executeSearch();
      }
    }
  }, [isAuthenticated, searched, jobs.length, executeSearch]);

  // Seamlessly execute any search or application action triggered before login
  useEffect(() => {
    if (isAuthenticated && !intentProcessedRef.current) {
      intentProcessedRef.current = true;
      const intent = consumePendingIntent();
      if (intent) {
        if (intent.type === 'apply') {
          const targetJobId = intent.jobId || intent.job?.id;
          let applicationUrl = intent.url;

          const resumeApplyAction = async () => {
            // If URL was masked during anonymous session, resolve authenticated URL
            if (!isValidApplicationUrl(applicationUrl) && targetJobId) {
              try {
                const res = await fetch(`/api/jobs?id=${encodeURIComponent(targetJobId)}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.job?.url) {
                    applicationUrl = data.job.url;
                  }
                }
              } catch (err) {
                console.error('[Apply Intent] Failed to resolve authenticated job URL:', err);
              }
            }

            if (isValidApplicationUrl(applicationUrl)) {
              window.open(applicationUrl, '_blank', 'noopener,noreferrer');
              showToast(`Resumed application for "${intent.jobTitle || 'selected job'}"!`, 'success');
            } else {
              const fallback = getFallbackApplicationUrl({
                title: intent.jobTitle,
                company: intent.company,
                source: intent.job?.source as string | undefined,
                url: applicationUrl,
              });
              window.open(fallback, '_blank', 'noopener,noreferrer');
              showToast(`Opened verified portal for "${intent.jobTitle || 'selected job'}"!`, 'info');
            }

            // Refresh current results so real company names are visible
            executeSearch();
          };

          resumeApplyAction();
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
  }, [isAuthenticated, consumePendingIntent, executeSearch, showToast]);

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
      const target = event.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setShowJobDropdown(false);
      }
      if (locBoxRef.current && !locBoxRef.current.contains(target)) {
        setShowLocDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(target)) {
        setShowRoleDropdown(false);
      }
      if (workplaceDropdownRef.current && !workplaceDropdownRef.current.contains(target)) {
        setShowWorkplaceDropdown(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setShowTypeDropdown(false);
      }
      if (levelDropdownRef.current && !levelDropdownRef.current.contains(target)) {
        setShowLevelDropdown(false);
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
    setShowRoleDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setRoleSearchQuery('');
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

  const handleRoleSelect = (roleVal: string) => {
    setSelectedRole(roleVal);
    setShowRoleDropdown(false);
    setRoleSearchQuery('');
    let nextRemote = remote;
    if (isRemoteRole(roleVal) && !remote) {
      nextRemote = 'remote';
      setRemote('remote');
    }
    executeSearch(query, location, type, level, roleVal, nextRemote);
  };

  const handleClearRole = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRole('');
    setShowRoleDropdown(false);
    setRoleSearchQuery('');
    executeSearch(query, location, type, level, '', remote);
  };

  const selectedRoleLabel = useMemo(() => {
    if (!selectedRole) return 'All Roles & Categories';
    for (const group of JOB_POST_GROUPS) {
      const match = group.posts.find((p) => p.value === selectedRole);
      if (match) return match.label;
    }
    return selectedRole;
  }, [selectedRole]);

  const filteredJobPostGroups = useMemo(() => {
    if (!roleSearchQuery.trim()) return JOB_POST_GROUPS;
    const q = roleSearchQuery.toLowerCase().trim();
    return JOB_POST_GROUPS.map((group) => {
      const groupMatches = group.group.toLowerCase().includes(q);
      const filteredPosts = group.posts.filter(
        (post) =>
          groupMatches ||
          post.label.toLowerCase().includes(q) ||
          post.value.toLowerCase().includes(q)
      );
      return {
        ...group,
        posts: filteredPosts,
      };
    }).filter((group) => group.posts.length > 0);
  }, [roleSearchQuery]);

  const selectedWorkplaceObj = useMemo(
    () => WORKPLACE_OPTIONS.find((opt) => opt.value === remote) || WORKPLACE_OPTIONS[0],
    [remote]
  );

  const selectedTypeObj = useMemo(
    () => TYPE_OPTIONS.find((opt) => opt.value === type) || TYPE_OPTIONS[0],
    [type]
  );

  const selectedLevelObj = useMemo(
    () => LEVEL_OPTIONS.find((opt) => opt.value === level) || LEVEL_OPTIONS[0],
    [level]
  );

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
    setShowRoleDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setRoleSearchQuery('');
    executeSearch('', '', '', '', '', '');
  };

  // Client-side instant sorting & activeView filtering
  const displayedJobs = useMemo(() => {
    if (activeView === 'saved') {
      return savedJobs;
    }
    if (sortBy === 'date') {
      return [...jobs].sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
    }
    return jobs;
  }, [jobs, sortBy, activeView, savedJobs]);

  // Reset lazy load visible count whenever any query or filter condition changes
  useEffect(() => {
    if (loadingMoreTimeoutRef.current) {
      clearTimeout(loadingMoreTimeoutRef.current);
    }
    setIsLoadingMore(false);
    setVisibleCount(JOBS_BATCH_SIZE);
  }, [query, location, type, level, selectedRole, remote, sortBy, activeView, jobs]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (loadingMoreTimeoutRef.current) {
        clearTimeout(loadingMoreTimeoutRef.current);
      }
    };
  }, []);

  // Sliced jobs for progressive chunk lazy loading
  const visibleJobs = useMemo(() => {
    return displayedJobs.slice(0, visibleCount);
  }, [displayedJobs, visibleCount]);

  const hasMore = visibleCount < displayedJobs.length;

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    if (loadingMoreTimeoutRef.current) {
      clearTimeout(loadingMoreTimeoutRef.current);
    }

    loadingMoreTimeoutRef.current = setTimeout(() => {
      // Preserve the user's exact scroll offset before new items mount
      const savedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

      setVisibleCount((prev) => Math.min(prev + JOBS_BATCH_SIZE, displayedJobs.length));
      setIsLoadingMore(false);

      // Verify and lock scroll position on the next frame so viewport never jumps upward
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          if (window.scrollY < savedScrollY) {
            window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
          }
        });
      }
    }, 280);
  }, [isLoadingMore, hasMore, displayedJobs.length]);

  // Seamless auto-load on scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || loading || isLoadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '300px 0px',
        threshold: 0.05,
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, isLoadingMore, loadMore]);

  // Sticky Header Scroll-State IntersectionObserver (Modern Web Guidance fallback)
  useEffect(() => {
    const node = headerWrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        node.classList.toggle('is-stuck', entry.boundingClientRect.top <= 14);
      },
      {
        threshold: [1],
        rootMargin: '-13px 0px 0px 0px',
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isHydrated]);

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

  return (
    <main className="container" style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      {/* Authenticated Dashboard Floating Island Header */}
      <div ref={headerWrapperRef} className="site-header-wrapper">
        <header className="site-header">
          {/* Brand Logo & Name */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            className="site-header-brand"
            onClick={resetToDiscovery}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                resetToDiscovery();
              }
            }}
          >
            <div className="site-header-logo">
              <Sparkles color="white" size={19} />
            </div>
            <div className="site-header-title-group">
              <div className="site-header-title-row">
                <h1 className="site-header-title">
                  Job<span className="text-gradient">Nexus</span>
                </h1>
                <span className="site-header-badge">
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                  VERIFIED ATS
                </span>
              </div>
              <p className="site-header-subtitle">
                Direct ATS Feeds • Zero Ghost Jobs
              </p>
            </div>
          </motion.div>

          {/* Dynamic Live Aggregation Status Pill */}
          <motion.div
            key={searched ? `searched-${displayedJobs.length}` : `total-${formattedCount}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="site-header-status"
            title={
              searched
                ? `Showing ${displayedJobs.length.toLocaleString()} active roles filtered from ${formattedCount} live verified openings across ${sourcesCount} direct ATS feeds`
                : `Total ${formattedCount} live verified opportunities actively aggregated from ${sourcesCount} direct employer ATS feeds`
            }
          >
            <span className="site-header-radar" />
            <span>
              <span className="desktop-only">
                {searched
                  ? `${displayedJobs.length.toLocaleString()} Roles Matched • ${formattedCount} Total Verified`
                  : `${formattedCount} Live Verified Roles`}
              </span>
              <span className="mobile-only">
                {searched
                  ? `${displayedJobs.length.toLocaleString()} Matched • ${formattedCount} Total`
                  : `${formattedCount} Live`}
              </span>
            </span>
          </motion.div>

          {/* Action Navigation Cluster (Uniform 36px Height, 10px Radius) */}
          <div className="site-header-actions">
            <ThemeToggle />

            {/* Loading Skeleton during session restoration */}
            {authStatus === 'initializing' && (
              <div
                style={{
                  width: 86,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-card)',
                  animation: 'pulse 1.5s infinite ease-in-out',
                }}
              />
            )}

            {/* Authenticated State: Saved Jobs button + User Profile Dropdown */}
            {isAuthenticated && user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveView(activeView === 'saved' ? 'all' : 'saved')}
                  title={activeView === 'saved' ? 'View all jobs' : 'View saved jobs'}
                  className={`site-header-btn ${activeView === 'saved' ? 'site-header-btn-active' : 'site-header-btn-ghost'}`}
                >
                  <Bookmark size={14} fill={activeView === 'saved' ? 'currentColor' : 'none'} />
                  <span>Saved</span>
                  <span
                    style={{
                      background: activeView === 'saved' ? 'var(--primary-start)' : 'var(--tag-bg)',
                      color: activeView === 'saved' ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 6,
                    }}
                  >
                    {savedJobs.length}
                  </span>
                </button>

                {/* User Dropdown Capsule */}
                <div ref={userMenuRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={isUserMenuOpen}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="site-header-user-btn"
                  >
                    <div
                      className="site-header-avatar"
                      style={{
                        background: user.picture
                          ? `url(${user.picture}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      }}
                    >
                      {!user.picture && user.initials}
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown
                      size={13}
                      color="var(--text-secondary)"
                      style={{
                        transform: isUserMenuOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 8px)',
                          width: 240,
                          background: 'var(--surface-card)',
                          border: '1px solid var(--border-card)',
                          borderRadius: 14,
                          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          padding: '0.5rem',
                          zIndex: 350,
                        }}
                      >
                        {/* User Identity Header */}
                        <div style={{ padding: '0.55rem 0.65rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {user.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {user.email}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '0.35rem',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: user.provider === 'google' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                              color: user.provider === 'google' ? '#60a5fa' : 'var(--primary-start)',
                              padding: '0.12rem 0.45rem',
                              borderRadius: 4,
                            }}
                          >
                            {user.provider === 'google' ? 'Google Account' : 'Verified Member'}
                          </span>
                        </div>

                        {/* Menu Actions */}
                        <div style={{ padding: '0.35rem 0' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveView('saved');
                              setIsUserMenuOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.55rem 0.65rem',
                              borderRadius: 8,
                              border: 'none',
                              background: activeView === 'saved' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <Bookmark size={15} color="var(--primary-start)" />
                            <span>Saved Jobs ({savedJobs.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileModalOpen(true);
                              setIsUserMenuOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.55rem 0.65rem',
                              borderRadius: 8,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <UserIcon size={15} color="var(--text-secondary)" />
                            <span>Account Profile</span>
                          </button>
                        </div>

                        {/* Sign Out Action */}
                        <div style={{ paddingTop: '0.35rem', borderTop: '1px solid var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              logout();
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.55rem 0.65rem',
                              borderRadius: 8,
                              border: 'none',
                              background: 'transparent',
                              color: '#ef4444',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <LogOut size={15} color="#ef4444" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Anonymous State: Standard Sign In CTA */}
            {authStatus === 'anonymous' && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => openAuthModal()}
                className="site-header-btn site-header-btn-primary"
              >
                <UserIcon size={14} />
                <span>Sign In</span>
              </motion.button>
            )}
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section style={{ margin: '3.2rem 0 2rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <motion.div
          key={searched ? `hero-searched-${displayedJobs.length}` : `hero-total-${formattedCount}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-ats-badge"
        >
          <Sparkles size={14} className="hero-ats-badge-icon" />
          <span className="hero-ats-badge-accent">
            {searched ? `${displayedJobs.length.toLocaleString()} Roles Matched` : `${formattedCount} Live Roles`}
          </span>
          <span className="hero-ats-badge-bullet">•</span>
          <span className="hero-ats-badge-secondary">
            {searched ? `${formattedCount} Total Verified` : `${sourcesCount} Verified Public Feeds &amp; ATS`}
          </span>
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

            {/* Role & Category Custom Dropdown */}
            <div
              ref={roleDropdownRef}
              style={{
                position: 'relative',
                flex: '1.2',
                minWidth: 190,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowRoleDropdown((prev) => !prev);
                  setShowWorkplaceDropdown(false);
                  setShowTypeDropdown(false);
                  setShowLevelDropdown(false);
                }}
                aria-expanded={showRoleDropdown}
                aria-haspopup="listbox"
                aria-label="Filter by role and category"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.45rem',
                  background: 'var(--input-bg)',
                  borderRadius: 10,
                  padding: '0.62rem 0.75rem',
                  border: showRoleDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                  boxShadow: showRoleDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                  color: selectedRole ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: selectedRole ? 600 : 400,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', minWidth: 0 }}>
                  <Briefcase size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedRoleLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {selectedRole && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={handleClearRole}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleClearRole(e as any);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: 2,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-secondary)',
                        transition: 'color 0.15s ease',
                      }}
                      title="Clear role filter"
                    >
                      <X size={13} />
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    color="var(--text-secondary)"
                    style={{
                      transform: showRoleDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {showRoleDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: 'max(100%, 320px)',
                      maxWidth: 'min(420px, calc(100vw - 2.5rem))',
                      maxHeight: 380,
                      zIndex: 250,
                      background: 'var(--dropdown-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-lg)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      textAlign: 'left',
                    }}
                  >
                    {/* Sticky Search Filter */}
                    <div
                      style={{
                        padding: '0.65rem 0.75rem',
                        background: 'var(--dropdown-bg)',
                        borderBottom: '1px solid var(--border)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          background: 'var(--input-bg)',
                          borderRadius: 8,
                          padding: '0.45rem 0.65rem',
                          border: '1px solid var(--input-border)',
                        }}
                      >
                        <Search size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                        <input
                          type="text"
                          placeholder="Search roles or categories..."
                          value={roleSearchQuery}
                          onChange={(e) => setRoleSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.82rem',
                            color: 'var(--text-primary)',
                          }}
                        />
                        {roleSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setRoleSearchQuery('')}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Options List */}
                    <div style={{ overflowY: 'auto', maxHeight: 320, padding: '0.35rem 0' }}>
                      {/* Reset / All Roles Option */}
                      <div
                        onClick={() => handleRoleSelect('')}
                        style={{
                          padding: '0.65rem 0.95rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          fontSize: '0.86rem',
                          color: selectedRole === '' ? 'var(--primary-start)' : 'var(--text-primary)',
                          fontWeight: selectedRole === '' ? 600 : 400,
                          background: selectedRole === '' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          transition: 'background 0.15s ease',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedRole !== '') e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          if (selectedRole !== '') e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Briefcase size={13} color="var(--primary-start)" />
                          <span>All Roles & Categories</span>
                        </div>
                        {selectedRole === '' && <Check size={14} color="var(--primary-start)" />}
                      </div>

                      {/* Categorized Groups */}
                      {filteredJobPostGroups.length === 0 ? (
                        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          No roles or categories match &ldquo;{roleSearchQuery}&rdquo;
                        </div>
                      ) : (
                        filteredJobPostGroups.map((group, gIdx) => (
                          <div key={gIdx} style={{ marginBottom: '0.35rem' }}>
                            <div
                              style={{
                                padding: '0.55rem 0.95rem 0.35rem',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--primary-start)',
                                background: 'var(--tag-bg)',
                                borderTop: gIdx > 0 ? '1px solid var(--border)' : 'none',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                              }}
                            >
                              {group.group}
                            </div>
                            {group.posts.map((post, pIdx) => {
                              const isSelected = selectedRole === post.value;
                              return (
                                <div
                                  key={pIdx}
                                  onClick={() => handleRoleSelect(post.value)}
                                  style={{
                                    padding: '0.6rem 0.95rem 0.6rem 1.4rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    fontSize: '0.84rem',
                                    color: isSelected ? 'var(--primary-start)' : 'var(--text-primary)',
                                    fontWeight: isSelected ? 600 : 400,
                                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                    transition: 'background 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {post.label}
                                  </span>
                                  {isSelected && <Check size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />}
                                </div>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Workplace Custom Dropdown */}
            <div
              ref={workplaceDropdownRef}
              style={{
                position: 'relative',
                flex: '0.9',
                minWidth: 155,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowWorkplaceDropdown((prev) => !prev);
                  setShowRoleDropdown(false);
                  setShowTypeDropdown(false);
                  setShowLevelDropdown(false);
                }}
                aria-expanded={showWorkplaceDropdown}
                aria-haspopup="listbox"
                aria-label="Filter by workplace model"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  background: 'var(--input-bg)',
                  borderRadius: 10,
                  padding: '0.62rem 0.75rem',
                  border: showWorkplaceDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                  boxShadow: showWorkplaceDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                  color: remote ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: remote ? 600 : 400,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', minWidth: 0 }}>
                  <span>{selectedWorkplaceObj.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedWorkplaceObj.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {remote && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemote('');
                        executeSearch(query, location, type, level, selectedRole, '');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setRemote('');
                          executeSearch(query, location, type, level, selectedRole, '');
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: 2,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-secondary)',
                      }}
                      title="Clear workplace filter"
                    >
                      <X size={13} />
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    color="var(--text-secondary)"
                    style={{
                      transform: showWorkplaceDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {showWorkplaceDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      minWidth: 175,
                      zIndex: 250,
                      background: 'var(--dropdown-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-lg)',
                      overflow: 'hidden',
                      padding: '0.35rem 0',
                    }}
                  >
                    {WORKPLACE_OPTIONS.map((opt, idx) => {
                      const isSelected = remote === opt.value;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setRemote(opt.value);
                            setShowWorkplaceDropdown(false);
                            executeSearch(query, location, type, level, selectedRole, opt.value);
                          }}
                          style={{
                            padding: '0.62rem 0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            fontSize: '0.84rem',
                            color: isSelected ? 'var(--primary-start)' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 400,
                            background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && <Check size={14} color="var(--primary-start)" />}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Type Custom Dropdown */}
            <div
              ref={typeDropdownRef}
              style={{
                position: 'relative',
                flex: '0.8',
                minWidth: 135,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowTypeDropdown((prev) => !prev);
                  setShowRoleDropdown(false);
                  setShowWorkplaceDropdown(false);
                  setShowLevelDropdown(false);
                }}
                aria-expanded={showTypeDropdown}
                aria-haspopup="listbox"
                aria-label="Filter by employment type"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  background: 'var(--input-bg)',
                  borderRadius: 10,
                  padding: '0.62rem 0.75rem',
                  border: showTypeDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                  boxShadow: showTypeDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                  color: type ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: type ? 600 : 400,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTypeObj.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {type && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setType('');
                        executeSearch(query, location, '', level, selectedRole, remote);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setType('');
                          executeSearch(query, location, '', level, selectedRole, remote);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: 2,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-secondary)',
                      }}
                      title="Clear employment type filter"
                    >
                      <X size={13} />
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    color="var(--text-secondary)"
                    style={{
                      transform: showTypeDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {showTypeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      minWidth: 160,
                      zIndex: 250,
                      background: 'var(--dropdown-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-lg)',
                      overflow: 'hidden',
                      padding: '0.35rem 0',
                    }}
                  >
                    {TYPE_OPTIONS.map((opt, idx) => {
                      const isSelected = type === opt.value;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setType(opt.value);
                            setShowTypeDropdown(false);
                            executeSearch(query, location, opt.value, level, selectedRole, remote);
                          }}
                          style={{
                            padding: '0.62rem 0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            fontSize: '0.84rem',
                            color: isSelected ? 'var(--primary-start)' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 400,
                            background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check size={14} color="var(--primary-start)" />}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Level Custom Dropdown */}
            <div
              ref={levelDropdownRef}
              style={{
                position: 'relative',
                flex: '0.8',
                minWidth: 135,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowLevelDropdown((prev) => !prev);
                  setShowRoleDropdown(false);
                  setShowWorkplaceDropdown(false);
                  setShowTypeDropdown(false);
                }}
                aria-expanded={showLevelDropdown}
                aria-haspopup="listbox"
                aria-label="Filter by seniority level"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  background: 'var(--input-bg)',
                  borderRadius: 10,
                  padding: '0.62rem 0.75rem',
                  border: showLevelDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                  boxShadow: showLevelDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                  color: level ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: level ? 600 : 400,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedLevelObj.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {level && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLevel('');
                        executeSearch(query, location, type, '', selectedRole, remote);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setLevel('');
                          executeSearch(query, location, type, '', selectedRole, remote);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: 2,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-secondary)',
                      }}
                      title="Clear seniority filter"
                    >
                      <X size={13} />
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    color="var(--text-secondary)"
                    style={{
                      transform: showLevelDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {showLevelDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      minWidth: 160,
                      zIndex: 250,
                      background: 'var(--dropdown-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-lg)',
                      overflow: 'hidden',
                      padding: '0.35rem 0',
                    }}
                  >
                    {LEVEL_OPTIONS.map((opt, idx) => {
                      const isSelected = level === opt.value;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setLevel(opt.value);
                            setShowLevelDropdown(false);
                            executeSearch(query, location, type, opt.value, selectedRole, remote);
                          }}
                          style={{
                            padding: '0.62rem 0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            fontSize: '0.84rem',
                            color: isSelected ? 'var(--primary-start)' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 400,
                            background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check size={14} color="var(--primary-start)" />}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
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

          {/* Active Filter Chips Bar */}
          {(query || location || remote || selectedRole || type || level) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                flexWrap: 'wrap',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.15rem' }}>
                Active:
              </span>

              {query && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 9999,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    color: 'var(--primary-start)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <span>&ldquo;{query}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      executeSearch('', location, type, level, selectedRole, remote);
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    title="Remove keyword filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {location && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 9999,
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <MapPin size={11} />
                  <span>{location}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLocation('');
                      executeSearch(query, '', type, level, selectedRole, remote);
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    title="Remove location filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedRole && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 9999,
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    color: 'var(--accent-violet)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <Briefcase size={11} />
                  <span>{selectedRoleLabel}</span>
                  <button
                    type="button"
                    onClick={() => handleClearRole()}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    title="Remove role filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {remote && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 9999,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: 'var(--accent-emerald)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{selectedWorkplaceObj.icon}</span>
                  <span>{selectedWorkplaceObj.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRemote('');
                      executeSearch(query, location, type, level, selectedRole, '');
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    title="Remove workplace filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {type && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 9999,
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: 'var(--accent-amber)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{selectedTypeObj.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setType('');
                      executeSearch(query, location, '', level, selectedRole, remote);
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    title="Remove employment type filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {level && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 9999,
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    color: '#fda4af',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{selectedLevelObj.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLevel('');
                      executeSearch(query, location, type, '', selectedRole, remote);
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    title="Remove seniority filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.2rem 0.4rem',
                  textDecoration: 'underline',
                }}
              >
                Reset all
              </button>

              {/* Dynamic Roles Matched pill in Search Console */}
              {searched && (
                <motion.div
                  key={`console-matched-${displayedJobs.length}`}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.24rem 0.75rem',
                    borderRadius: 9999,
                    background: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#c7d2fe',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                    marginLeft: 'auto',
                  }}
                >
                  <span className="pulse-dot" />
                  <span>
                    {displayedJobs.length.toLocaleString()} Roles Matched • {formattedCount} Total Verified
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.form>

        {/* Quick Popular Search Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="quick-pills-container"
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
      {!loading && (activeView === 'saved' ? savedJobs.length > 0 : searched && displayedJobs.length > 0) && (
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
              {activeView === 'saved'
                ? `${savedJobs.length} Saved Positions`
                : displayedJobs.length > JOBS_BATCH_SIZE
                ? `Showing ${visibleJobs.length} of ${displayedJobs.length.toLocaleString()} Verified Positions`
                : `${displayedJobs.length.toLocaleString()} Verified Positions`}
            </span>
            {activeView !== 'saved' && (
              <motion.div
                key={`toolbar-matched-${displayedJobs.length}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.28rem 0.8rem',
                  borderRadius: 9999,
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
                }}
              >
                <span className="pulse-dot" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c7d2fe', letterSpacing: '0.01em' }}>
                  {displayedJobs.length.toLocaleString()} Roles Matched • {formattedCount} Total Verified
                </span>
              </motion.div>
            )}
            {displayedJobs.length > JOBS_BATCH_SIZE && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.55rem',
                  borderRadius: 9999,
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: '#a5b4fc',
                }}
              >
                <Zap size={11} />
                <span>Auto-loading on scroll</span>
              </span>
            )}
            {activeView === 'saved' ? (
              <button
                type="button"
                onClick={() => setActiveView('all')}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Compass size={13} />
                <span>Back to All Roles</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={resetToDiscovery}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Compass size={13} />
                <span>Back to Discovery</span>
              </button>
            )}
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
        ) : activeView === 'saved' ? (
          savedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4.5rem 1.5rem' }} className="animate-fade-in">
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  display: 'inline-flex',
                  padding: '1.25rem',
                  borderRadius: '50%',
                  marginBottom: '1.25rem',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                }}
              >
                <Bookmark size={36} color="var(--primary-start)" />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Saved Jobs Yet</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                Bookmark tech opportunities by clicking the bookmark icon on any job card. They will stay saved securely across your sessions.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView('all')}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Compass size={15} />
                <span>Browse Verified Roles</span>
              </motion.button>
            </div>
          ) : (
            <>
              <div
                className="job-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '1.5rem',
                  overflowAnchor: 'auto',
                }}
              >
                {visibleJobs.map((job, index) => (
                  <JobCard key={job.id || `saved-${index}`} job={job} index={index} />
                ))}
              </div>

              {hasMore && (
                <div
                  ref={sentinelRef}
                  style={{
                    marginTop: '2.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '1.75rem 1rem',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                  }}
                >
                  {isLoadingMore ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#a5b4fc', fontSize: '0.92rem', fontWeight: 600 }}>
                        <Loader2 size={18} className="animate-spin" color="var(--accent-indigo)" />
                        <span>Loading more saved roles...</span>
                      </div>
                      <div
                        style={{
                          width: 200,
                          height: 4,
                          borderRadius: 9999,
                          background: 'rgba(99, 102, 241, 0.2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          className="skeleton-shimmer"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, #818cf8, transparent)',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <Loader2 size={16} className="animate-spin" color="var(--accent-indigo)" />
                        <span>Scroll to load more or click below</span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={loadMore}
                        className="btn-secondary"
                        style={{
                          fontSize: '0.84rem',
                          padding: '0.6rem 1.4rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <ArrowDown size={14} />
                        <span>
                          Load Next {Math.min(JOBS_BATCH_SIZE, displayedJobs.length - visibleJobs.length)} Roles
                        </span>
                      </motion.button>
                    </>
                  )}
                </div>
              )}
            </>
          )
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
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>No active verified listings found</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              We couldn&apos;t verify any active public links matching your exact combination. Try broadening your keywords or resetting filters.
            </p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearAllFilters}
                className="btn-primary"
              >
                Clear All Filters
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  clearAllFilters();
                  setRemote('remote');
                  executeSearch('', '', '', '', '', 'remote');
                }}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>🏠 Explore Remote Roles</span>
              </motion.button>
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
            </div>
          </div>
        ) : searched && displayedJobs.length > 0 ? (
          <>
            <div
              className="job-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem',
                overflowAnchor: 'auto',
              }}
            >
              {visibleJobs.map((job, index) => (
                <JobCard key={job.id || `job-${index}`} job={job} index={index} />
              ))}
            </div>

            {/* Lazy Load Sentinel & Infinite Controls */}
            {hasMore ? (
              <div
                ref={sentinelRef}
                style={{
                  marginTop: '2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '1.75rem 1rem',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                }}
              >
                {isLoadingMore ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#a5b4fc', fontSize: '0.92rem', fontWeight: 600 }}>
                      <Loader2 size={18} className="animate-spin" color="var(--accent-indigo)" />
                      <span>Loading more verified openings...</span>
                    </div>
                    <div
                      style={{
                        width: 200,
                        height: 4,
                        borderRadius: 9999,
                        background: 'rgba(99, 102, 241, 0.2)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="skeleton-shimmer"
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent, #818cf8, transparent)',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Loader2 size={16} className="animate-spin" color="var(--accent-indigo)" />
                      <span>Scroll to auto-load or click below</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={loadMore}
                      className="btn-secondary"
                      style={{
                        fontSize: '0.84rem',
                        padding: '0.6rem 1.4rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <ArrowDown size={14} />
                      <span>
                        Load Next {Math.min(JOBS_BATCH_SIZE, displayedJobs.length - visibleJobs.length)} Roles ({displayedJobs.length - visibleJobs.length} remaining)
                      </span>
                    </motion.button>
                  </>
                )}
              </div>
            ) : displayedJobs.length > JOBS_BATCH_SIZE ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '2.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.8rem',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 1.1rem',
                    borderRadius: 9999,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: '#34d399',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  <Check size={14} />
                  <span>All {displayedJobs.length} Verified Roles Loaded</span>
                </div>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    textDecoration: 'underline',
                  }}
                >
                  <ArrowUp size={13} />
                  <span>Back to top</span>
                </button>
              </motion.div>
            ) : null}
          </>
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
                  Access our full aggregated feed of {formattedCount} verified opportunities directly from public boards.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleBrowseAllClick}
                className="btn-primary"
                style={{ padding: '0.85rem 1.8rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
              >
                <span>Browse All {formattedCount} Positions</span>
                <ArrowRight size={17} />
              </motion.button>
            </motion.div>

            {/* Verified Public Network Trust Strip */}
            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.2rem' }}>
                AGGREGATING DIRECTLY FROM 9 VERIFIED PUBLIC PORTAL FEEDS &amp; ATS
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                {[
                  { name: 'Greenhouse ATS', isIndia: false },
                  { name: 'Ashby ATS', isIndia: false },
                  { name: 'National Career Service (NCS)', isIndia: true },
                  { name: 'Himalayas', isIndia: false },
                  { name: 'WeWorkRemotely', isIndia: false },
                  { name: 'Jobicy', isIndia: false },
                  { name: 'RemoteOK', isIndia: false },
                  { name: 'Remotive', isIndia: false },
                  { name: 'Arbeitnow', isIndia: false },
                ].map((source, sIdx) => (
                  <span key={sIdx} className="trust-badge">
                    {source.isIndia ? (
                      <span style={{ fontSize: '0.85rem' }}>🇮🇳</span>
                    ) : (
                      <ShieldCheck size={13} color="var(--accent-emerald)" />
                    )}
                    <span>{source.name}</span>
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

      {/* Floating Glassmorphic Scroll Loader Pill */}
      <AnimatePresence>
        {isLoadingMore && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(99, 102, 241, 0.45)',
              borderRadius: 9999,
              padding: '0.65rem 1.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.35)',
              color: '#f8fafc',
              fontSize: '0.86rem',
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            <Loader2 size={16} className="animate-spin" color="#818cf8" />
            <span>Loading verified openings...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Catchy, Properly Aligned, Futuristic Cyber-HUD Toast Notification */}
      <FuturisticToast toast={toast} onDismiss={clearToast} />

      {/* User Account Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && user && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setIsProfileModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: 440,
                padding: '2rem',
                borderRadius: 20,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-card)',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Account Profile
                </h3>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  aria-label="Close profile"
                  style={{
                    background: 'var(--tag-bg)',
                    border: '1px solid var(--tag-border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Avatar & Core Identity */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: user.picture
                      ? `url(${user.picture}) center/cover no-repeat`
                      : 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(66, 133, 244, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  {!user.picture && user.initials}
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {user.email}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '0.45rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: user.provider === 'google' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      color: user.provider === 'google' ? '#60a5fa' : 'var(--primary-start)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 4,
                      border: `1px solid ${user.provider === 'google' ? 'rgba(66, 133, 244, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                    }}
                  >
                    {user.provider === 'google' ? 'Verified Google Account' : 'Verified Email Account'}
                  </span>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Saved Opportunities</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{savedJobs.length} roles</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Session Security</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#34d399' }}>HTTP-Only Secure Cookie</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Member Status</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-start)' }}>Active</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setActiveView('saved');
                  }}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}
                >
                  View Saved Jobs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    logout();
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: '#ef4444' }}
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
