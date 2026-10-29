'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
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
  UserCheck,
  Crown,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Check,
  ArrowDown,
  Home as HomeIcon,
} from 'lucide-react';
import JobCard from './components/JobCard';
import ThemeToggle from './components/ThemeToggle';
import FuturisticToast from './components/FuturisticToast';
import JobNexusLogo from './components/JobNexusLogo';
import { PremiumOfferModal } from './components/PremiumOfferModal';
import { useAuth } from './context/AuthContext';
import { useJobStats } from '@/modules/jobs/hooks/useJobStats';
import { useElapsedJobCounter } from '@/modules/jobs/hooks/useElapsedJobCounter';
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
  POPULAR_LOCATION_GROUPS,
  getLocationTier,
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
    desc: 'Verified on-site and hybrid engineering roles across Tier 1 & Tier 2 Indian tech hubs.',
    tags: ['Bengaluru', 'Delhi NCR', 'Hyderabad', 'Pune', 'Tier 2 Hubs'],
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
  id?: string;
  label: string;
  query?: string;
  location?: string;
  remote?: string;
  searchCount?: number;
  avgSearches?: number;
  formattedAverage?: string;
  trend?: 'hot' | 'rising' | 'steady';
}

const DEFAULT_POPULAR_PILLS: QuickPill[] = [
  { id: 'full-stack-developer', label: '⚡ Full Stack', query: 'Full Stack Developer', avgSearches: 140, formattedAverage: '140/day', trend: 'hot' },
  { id: 'react-developer', label: '⚛️ React / Next.js', query: 'React Developer', avgSearches: 125, formattedAverage: '125/day', trend: 'hot' },
  { id: 'ai-machine-learning', label: '🤖 AI & ML', query: 'AI Machine Learning', avgSearches: 115, formattedAverage: '115/day', trend: 'rising' },
  { id: 'python-backend', label: '🐍 Python / Backend', query: 'Python Backend Engineer', avgSearches: 95, formattedAverage: '95/day', trend: 'steady' },
  { id: 'devops-cloud', label: '☁️ DevOps & Cloud', query: 'DevOps Cloud', avgSearches: 85, formattedAverage: '85/day', trend: 'steady' },
  { id: 'healthcare-nursing', label: '🏥 Healthcare', query: 'Healthcare Clinical Nurse', avgSearches: 75, formattedAverage: '75/day', trend: 'rising' },
  { id: 'data-analytics', label: '📊 Data Analyst', query: 'Data Analyst', avgSearches: 70, formattedAverage: '70/day', trend: 'rising' },
  { id: 'mobile-developer', label: '📱 Mobile (Flutter/RN)', query: 'Mobile Developer', avgSearches: 60, formattedAverage: '60/day', trend: 'steady' },
  { id: 'ui-ux-design', label: '🎨 UI/UX Design', query: 'Product Designer', avgSearches: 55, formattedAverage: '55/day', trend: 'steady' },
  { id: 'cybersecurity', label: '🔒 Cybersecurity', query: 'Cybersecurity Analyst', avgSearches: 50, formattedAverage: '50/day', trend: 'rising' },
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

const INDUSTRY_OPTIONS = [
  { value: '', label: 'All Industries', icon: '🌐' },
  { value: 'technology', label: 'Technology & IT', icon: '💻' },
  { value: 'healthcare', label: 'Healthcare & Medical', icon: '🏥' },
  { value: 'education', label: 'Education & Teaching', icon: '🎓' },
  { value: 'finance_accounting', label: 'Finance & Accounting', icon: '📊' },
  { value: 'construction_trades', label: 'Construction & Trades', icon: '🏗️' },
  { value: 'manufacturing', label: 'Manufacturing & Industrial', icon: '⚙️' },
  { value: 'logistics_transport', label: 'Logistics & Supply Chain', icon: '🚚' },
  { value: 'retail_sales', label: 'Retail & Sales', icon: '🛍️' },
  { value: 'hospitality_tourism', label: 'Hospitality & Tourism', icon: '🍽️' },
  { value: 'administration_hr', label: 'Administration & HR', icon: '📋' },
  { value: 'agriculture', label: 'Agriculture & Forestry', icon: '🌱' },
  { value: 'government_public', label: 'Government & Public Sector', icon: '🏛️' },
  { value: 'customer_service', label: 'Customer Service & Support', icon: '🎧' },
  { value: 'security_facilities', label: 'Security & Facilities', icon: '🛡️' },
  { value: 'other', label: 'General / Other', icon: '📁' },
];

export default function Home() {
  const {
    user,
    isAdmin,
    isAuthenticated,
    authStatus,
    isHydrated,
    logout,
    consumePendingIntent,
    openAuthModal,
    savedJobs,
    entitlement,
    isPremium,
    isPremiumOfferOpen,
    openPremiumOfferModal,
    closePremiumOfferModal,
    refreshEntitlement,
    toast,
    clearToast,
    showToast,
  } = useAuth();
  const { formattedCount, sourcesCount, syncFromJobsCount } = useJobStats();
  const [activeView, setActiveView] = useState<'all' | 'saved'>('all');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);

  const handleCancelSubscription = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel auto-renewal? You will continue to have full JobNexus Premium access until the end of your paid billing cycle.'
      )
    ) {
      return;
    }
    setIsCancellingSubscription(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await refreshEntitlement();
        showToast('Auto-renewal cancelled. You retain full Premium access through your current period.', 'info');
      } else {
        showToast(data.error || 'Failed to cancel subscription.', 'error');
      }
    } catch {
      showToast('Network error while requesting cancellation.', 'error');
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const handleSubscriptionSuccess = useCallback(async () => {
    await refreshEntitlement();
    showToast('Welcome to JobNexus Premium! Your subscription is active.', 'success');
  }, [refreshEntitlement, showToast]);
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

  // Dynamic Popular Search Pills state (ranked by average searches)
  const [popularPills, setPopularPills] = useState<QuickPill[]>(DEFAULT_POPULAR_PILLS);

  // Suggestions state
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);

  // Refinement Filter Dropdowns state
  const [industry, setIndustry] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showWorkplaceDropdown, setShowWorkplaceDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const locBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const industryDropdownRef = useRef<HTMLDivElement>(null);
  const workplaceDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const intentProcessedRef = useRef(false);
  const jobGridRef = useRef<HTMLDivElement>(null);

  const executeSearch = useCallback(
    async (
      searchQuery = query,
      searchLoc = location,
      searchType = type,
      searchLevel = level,
      roleCategory = selectedRole,
      searchRemote = remote,
      searchIndustry = industry
    ) => {
      setLoading(true);
      setSearched(true);
      setShowJobDropdown(false);
      setShowLocDropdown(false);
      setShowRoleDropdown(false);
      setShowIndustryDropdown(false);
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
        if (searchIndustry && searchIndustry !== 'all') params.append('industry', searchIndustry);

        const res = await fetch(`/api/jobs?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await res.json();

        if (data.jobs && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
          // When full unconstrained feed is retrieved, sync live count
          if (!effectiveQuery && !searchLoc && !searchType && !searchLevel && !searchRemote && !searchIndustry) {
            syncFromJobsCount(data.jobs.length);
          }
        } else {
          setJobs([]);
        }

        // Dynamically increment average searches and update popular search pills
        if (effectiveQuery && effectiveQuery.trim().length >= 2) {
          const q = effectiveQuery.trim();
          setPopularPills((prev) => {
            const copy = prev.map((p) => ({ ...p }));
            const normQ = q.toLowerCase();
            let matched = false;

            for (const pill of copy) {
              const pillQ = (pill.query || '').toLowerCase();
              const pillL = (pill.label || '').toLowerCase();
              if (pillQ === normQ || pillL.includes(normQ) || normQ.includes(pillQ)) {
                pill.avgSearches = (pill.avgSearches || 50) + 1;
                pill.searchCount = (pill.searchCount || 1500) + 1;
                pill.formattedAverage = `${pill.avgSearches}/day`;
                pill.trend = pill.avgSearches > 100 ? 'hot' : 'rising';
                matched = true;
                break;
              }
            }

            if (!matched) {
              copy.push({
                id: `custom-${normQ.replace(/[^a-z0-9]+/g, '-')}`,
                label: `🔍 ${q}`,
                query: q,
                location: searchLoc,
                avgSearches: 45,
                searchCount: 1350,
                formattedAverage: '45/day',
                trend: 'rising',
              });
            }

            copy.sort((a, b) => (b.avgSearches || 0) - (a.avgSearches || 0));
            const updated = copy.slice(0, 10);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('jobnexus_popular_searches', JSON.stringify(updated));
              } catch {
                // Ignore quota
              }
            }
            return updated;
          });

          // Background sync to server
          fetch('/api/jobs/popular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, location: searchLoc }),
          }).catch(() => {});
        }
      } catch (error) {
        console.error('[Search Error]:', error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [query, location, type, level, selectedRole, remote, industry, syncFromJobsCount]
  );

  const resetToDiscovery = useCallback(() => {
    setQuery('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    setIndustry('');
    setSortBy('relevance');
    setActiveView('all');
    setShowRoleDropdown(false);
    setShowIndustryDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setShowJobDropdown(false);
    setShowLocDropdown(false);
    setRoleSearchQuery('');
    setJobs([]);
    setSearched(false);
    setVisibleCount(JOBS_BATCH_SIZE);
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname.split('?')[0] || '/';
      window.history.replaceState({}, document.title, cleanUrl);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [JOBS_BATCH_SIZE]);

  const handleSignOut = useCallback(() => {
    setIsUserMenuOpen(false);
    setIsProfileModalOpen(false);
    resetToDiscovery();
    logout();
  }, [logout, resetToDiscovery]);

  // When authentication status transitions (login or logout):
  // - If user logs out (authenticated -> anonymous): immediately redirect to clean landing page, clearing all filters
  // - If user logs in (anonymous -> authenticated): re-execute active search to immediately unmask company identities
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthRef.current !== isAuthenticated) {
      const wasAuthenticated = prevAuthRef.current;
      prevAuthRef.current = isAuthenticated;

      if (wasAuthenticated && !isAuthenticated) {
        resetToDiscovery();
      } else if (!wasAuthenticated && isAuthenticated) {
        if (searched || jobs.length > 0) {
          executeSearch();
        }
      }
    }
  }, [isAuthenticated, searched, jobs.length, executeSearch, resetToDiscovery]);

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
                const res = await fetch(`/api/jobs?id=${encodeURIComponent(targetJobId)}`, {
                  cache: 'no-store',
                  headers: { 'Cache-Control': 'no-cache' },
                });
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

  // Synchronize dynamic popular search pills based on average search volume
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('jobnexus_popular_searches');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPopularPills(parsed);
          }
        }
      } catch {
        // Fall back gracefully
      }
    }

    fetch('/api/jobs/popular')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.pills) && data.pills.length > 0) {
          setPopularPills(data.pills);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('jobnexus_popular_searches', JSON.stringify(data.pills));
            } catch {
              // Ignore quota
            }
          }
        }
      })
      .catch(() => {
        // Offline / fallback to defaults
      });
  }, []);

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
      if (industryDropdownRef.current && !industryDropdownRef.current.contains(target)) {
        setShowIndustryDropdown(false);
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
    setLocationSuggestions(getLocationSuggestions(location, 15));
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

  const handleClearRole = (e?: React.SyntheticEvent) => {
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

  const selectedIndustryObj = useMemo(
    () => INDUSTRY_OPTIONS.find((opt) => opt.value === industry) || INDUSTRY_OPTIONS[0],
    [industry]
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
    setIndustry('');
    setShowRoleDropdown(false);
    setShowIndustryDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setRoleSearchQuery('');
    executeSearch('', '', '', '', '', '', '');
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
  }, [query, location, type, level, selectedRole, remote, industry, sortBy, activeView, jobs]);

  // Clean up timer on unmount
  useEffect(() => {
    const timeoutId = loadingMoreTimeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Sliced jobs for progressive chunk lazy loading
  const visibleJobs = useMemo(() => {
    return displayedJobs.slice(0, visibleCount);
  }, [displayedJobs, visibleCount]);

  const hasMore = visibleCount < displayedJobs.length;

  // Track scroll-through progress and animated elapsed counting across job cards
  const isJobGridActive = (searched && displayedJobs.length > 0) || (activeView === 'saved' && savedJobs.length > 0);
  const {
    isScrollingCards,
    animatedElapsedCount,
    progressPercent,
    isAllViewed,
  } = useElapsedJobCounter({
    gridRef: jobGridRef,
    totalJobs: displayedJobs.length,
    isActive: isJobGridActive,
  });

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    if (loadingMoreTimeoutRef.current) {
      clearTimeout(loadingMoreTimeoutRef.current);
    }

    // Instant synchronous batch append: jobs are already client-cached in displayedJobs.
    // Eliminates artificial delays, prevents overscroll rubber-banding, and completely avoids scroll jumps.
    setVisibleCount((prev) => Math.min(prev + JOBS_BATCH_SIZE, displayedJobs.length));

    // Release loading lock after DOM paint
    requestAnimationFrame(() => {
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMore, displayedJobs.length]);

  // Seamless auto-load on scroll via IntersectionObserver with 800px lookahead
  useEffect(() => {
    if (!hasMore || loading) return;
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
        rootMargin: '800px 0px', // Lookahead: appends cards smoothly before user reaches the bottom
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMore]);

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

  const handleFooterCategoryClick = (categoryQuery: string) => {
    setActiveView('all');
    setQuery(categoryQuery);
    setSelectedRole('');
    executeSearch(categoryQuery, location, type, level, '', remote);
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleFooterLocationClick = (locQuery: string, remoteVal = '') => {
    setActiveView('all');
    setLocation(locQuery);
    if (remoteVal) setRemote(remoteVal);
    executeSearch(query, locQuery, type, level, selectedRole, remoteVal || remote);
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  return (
    <div className="site-layout-wrapper">
      <main className="container" style={{ flex: '1 0 auto', paddingBottom: '3.5rem' }}>
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
                <JobNexusLogo variant="mark" size={26} priority />
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
                  Discover • Apply • Grow
                </p>
              </div>
            </motion.div>

            {/* Dynamic Live Aggregation Status Pill */}
            <motion.div
              key={searched ? `searched-${displayedJobs.length}` : activeView === 'saved' ? `saved-${savedJobs.length}` : `total-${formattedCount}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`site-header-status ${isScrollingCards ? 'is-scrolling-cards' : ''}`}
              title={
                isScrollingCards
                  ? `Scrolled through ${animatedElapsedCount} of ${displayedJobs.length.toLocaleString()} matched roles (${Math.round(progressPercent)}% viewed)`
                  : searched
                    ? `Showing ${displayedJobs.length.toLocaleString()} active roles filtered from ${formattedCount} live verified openings across ${sourcesCount} direct ATS feeds`
                    : activeView === 'saved'
                      ? `${savedJobs.length} bookmarked tech opportunities`
                      : `Total ${formattedCount} live verified opportunities actively aggregated from ${sourcesCount} direct employer ATS feeds`
              }
            >
              <span className={`site-header-radar ${isScrollingCards ? (isAllViewed ? 'is-complete' : 'is-scrolling') : ''}`} />
              <span>
                <span className="desktop-only">
                  {searched ? (
                    isScrollingCards ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{animatedElapsedCount}</span>
                        <span className="elapsed-counter-of">of</span>
                        <span className="elapsed-counter-total">{displayedJobs.length.toLocaleString()}</span>
                        <span className="elapsed-counter-label">Roles Matched</span>
                        <span className="elapsed-counter-dot count-secondary">•</span>
                        <span className="elapsed-counter-verified count-secondary">
                          {isAllViewed ? 'All Roles Viewed' : `${formattedCount} Total Verified`}
                        </span>
                      </span>
                    ) : (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{displayedJobs.length.toLocaleString()}</span>
                        <span className="elapsed-counter-label">Roles Matched</span>
                        <span className="elapsed-counter-dot count-secondary">•</span>
                        <span className="elapsed-counter-verified count-secondary">{formattedCount} Total Verified</span>
                      </span>
                    )
                  ) : activeView === 'saved' && savedJobs.length > 0 ? (
                    isScrollingCards ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{animatedElapsedCount}</span>
                        <span className="elapsed-counter-of">of</span>
                        <span className="elapsed-counter-total">{savedJobs.length}</span>
                        <span className="elapsed-counter-label">Saved Roles</span>
                        <span className="elapsed-counter-dot count-secondary">•</span>
                        <span className="elapsed-counter-verified count-secondary">
                          {isAllViewed ? 'All Saved Viewed' : 'Saved Collection'}
                        </span>
                      </span>
                    ) : (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{savedJobs.length}</span>
                        <span className="elapsed-counter-label">Saved Positions</span>
                      </span>
                    )
                  ) : (
                    <span className="elapsed-counter-status">
                      <span className="elapsed-counter-num">{formattedCount}</span>
                      <span className="elapsed-counter-label">Live</span>
                      <span className="count-secondary">Verified Roles</span>
                    </span>
                  )}
                </span>
                <span className="mobile-only">
                  {searched ? (
                    isScrollingCards ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{animatedElapsedCount}</span>
                        <span className="elapsed-counter-of">/</span>
                        <span className="elapsed-counter-total">{displayedJobs.length.toLocaleString()}</span>
                        <span className="elapsed-counter-label">Matched</span>
                      </span>
                    ) : (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{displayedJobs.length.toLocaleString()}</span>
                        <span className="elapsed-counter-label">Matched</span>
                      </span>
                    )
                  ) : activeView === 'saved' && savedJobs.length > 0 ? (
                    isScrollingCards ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{animatedElapsedCount}</span>
                        <span className="elapsed-counter-of">/</span>
                        <span className="elapsed-counter-total">{savedJobs.length}</span>
                        <span className="elapsed-counter-label">Saved</span>
                      </span>
                    ) : (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{savedJobs.length}</span>
                        <span className="elapsed-counter-label">Saved</span>
                      </span>
                    )
                  ) : (
                    <span className="elapsed-counter-status">
                      <span className="elapsed-counter-num">{formattedCount}</span>
                      <span className="elapsed-counter-label">Live</span>
                    </span>
                  )}
                </span>
              </span>
              {isScrollingCards && (
                <span
                  className={`site-header-status-progress ${isAllViewed ? 'is-complete' : ''}`}
                  style={{ width: `${progressPercent}%` }}
                  aria-hidden="true"
                />
              )}
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
                  {/* Dedicated Admin Console Direct Access Button */}
                  {(isAdmin || user.isAdmin || user.email?.toLowerCase() === 'shashankshines@gmail.com') && (
                    <Link
                      href="/admin"
                      title="Open JobNexus Admin Console"
                      className="site-header-btn-admin"
                    >
                      <ShieldCheck size={14} className="admin-btn-icon" />
                      <span>Admin Console</span>
                      <span className="admin-live-dot" title="Console Operational" />
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveView(activeView === 'saved' ? 'all' : 'saved')}
                    title={activeView === 'saved' ? 'View all jobs' : 'View saved jobs'}
                    className={`site-header-btn ${activeView === 'saved' ? 'site-header-btn-active' : 'site-header-btn-ghost'}`}
                  >
                    <Bookmark size={14} fill={activeView === 'saved' ? 'currentColor' : 'none'} />
                    <span className="site-header-saved-label">Saved</span>
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
                            {(isAdmin || user.isAdmin || user.email?.toLowerCase() === 'shashankshines@gmail.com') ? (
                              <span className="user-dropdown-admin-badge">
                                <ShieldCheck size={12} style={{ flexShrink: 0 }} />
                                <span>Administrator</span>
                              </span>
                            ) : (
                              <span
                                className={`user-dropdown-role-badge ${
                                  isPremium
                                    ? 'user-dropdown-premium-badge'
                                    : user.provider === 'google'
                                      ? 'user-dropdown-google-badge'
                                      : 'user-dropdown-member-badge'
                                }`}
                              >
                                {isPremium ? (
                                  <>
                                    <Crown size={12} style={{ flexShrink: 0 }} />
                                    <span>Premium Member</span>
                                  </>
                                ) : user.provider === 'google' ? (
                                  <>
                                    <Globe size={12} style={{ flexShrink: 0 }} />
                                    <span>Google Account</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck size={12} style={{ flexShrink: 0 }} />
                                    <span>Verified Member</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Menu Actions */}
                          <div style={{ padding: '0.35rem 0', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {!isPremium && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsUserMenuOpen(false);
                                  openPremiumOfferModal();
                                }}
                                className="user-dropdown-upgrade-btn"
                              >
                                <div className="dropdown-action-icon-wrap dropdown-upgrade-icon-wrap">
                                  <Crown size={14} className="upgrade-btn-icon" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontWeight: 700 }}>Upgrade to Premium</span>
                                  <span style={{ fontSize: '0.68rem', opacity: 0.75, fontWeight: 500 }}>
                                    Direct ATS links & no wait
                                  </span>
                                </div>
                                <span className="dropdown-price-pill">₹499</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setActiveView('saved');
                                setIsUserMenuOpen(false);
                              }}
                              className="user-dropdown-action-btn"
                              style={{ background: activeView === 'saved' ? 'rgba(99, 102, 241, 0.12)' : 'transparent' }}
                            >
                              <div className="dropdown-action-icon-wrap">
                                <Bookmark size={14} color="var(--primary-start)" />
                              </div>
                              <span style={{ flex: 1, fontWeight: 500 }}>Saved Opportunities</span>
                              <span className="dropdown-count-pill">{savedJobs.length}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsProfileModalOpen(true);
                                setIsUserMenuOpen(false);
                              }}
                              className="user-dropdown-action-btn"
                            >
                              <div className="dropdown-action-icon-wrap">
                                <UserIcon size={14} color="var(--text-secondary)" />
                              </div>
                              <span style={{ flex: 1, fontWeight: 500 }}>Account & Profile</span>
                              <ChevronRight size={14} className="dropdown-item-arrow" />
                            </button>

                            {(isAdmin || user.isAdmin || user.provider === 'google' || user.email?.toLowerCase() === 'shashankshines@gmail.com') && (
                              <Link
                                href="/admin"
                                onClick={() => setIsUserMenuOpen(false)}
                                className="user-dropdown-admin-card"
                              >
                                <div className="dropdown-action-icon-wrap dropdown-admin-icon-wrap">
                                  <LayoutDashboard size={15} className="admin-card-icon" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                  <span className="admin-card-title">Admin Console</span>
                                  <span className="admin-card-subtitle">
                                    Payments, Subscriptions & Settings
                                  </span>
                                </div>
                                <ChevronRight size={14} className="dropdown-item-arrow" />
                              </Link>
                            )}
                          </div>

                          {/* Sign Out Action */}
                          <div style={{ paddingTop: '0.35rem', borderTop: '1px solid var(--border)' }}>
                            <button
                              type="button"
                              onClick={handleSignOut}
                              className="user-dropdown-action-btn"
                            >
                              <div className="dropdown-action-icon-wrap dropdown-signout-icon-wrap">
                                <LogOut size={14} color="#ef4444" />
                              </div>
                              <span style={{ fontWeight: 600, color: '#ef4444' }}>Sign Out</span>
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
              {searched ? `${formattedCount} Total Verified` : `${sourcesCount} Verified Public Sources`}
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
            <span style={{ fontSize: '0.78rem', color: 'var(--tag-text)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--tag-bg)', padding: '0.32rem 0.8rem', borderRadius: 9999, border: '1px solid var(--tag-border)' }}>
              <ShieldCheck size={14} color="#10b981" /> 100% Direct ATS Links
            </span>
            {/* <span style={{ fontSize: '0.78rem', color: 'var(--tag-text)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--tag-bg)', padding: '0.32rem 0.8rem', borderRadius: 9999, border: '1px solid var(--tag-border)' }}>
            <Zap size={14} color="#f59e0b" /> Zero Paywalls
          </span> */}
            <span style={{ fontSize: '0.78rem', color: 'var(--tag-text)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--tag-bg)', padding: '0.32rem 0.8rem', borderRadius: 9999, border: '1px solid var(--tag-border)' }}>
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
              className="workplace-pills-bar"
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
                position: 'relative',
              }}
            >
              {WORKPLACE_CATEGORIES.map((cat) => {
                const isActive = remote === cat.remoteParam;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleWorkplaceCategoryClick(cat.remoteParam)}
                    className="workplace-pill-btn"
                    style={{
                      position: 'relative',
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
                      border: '1px solid transparent',
                      background: 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      whiteSpace: 'nowrap',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      userSelect: 'none',
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeWorkplaceSlidePill"
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
                    <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.95rem' }}>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
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
            className="glass-panel search-console-form"
            style={{
              width: '100%',
              maxWidth: '100%',
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
            <div className="search-inputs-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Query Input */}
              <div
                ref={searchBoxRef}
                className="search-query-box"
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
                        minWidth: 'min(100%, 280px)',
                        maxWidth: 'calc(100vw - 32px)',
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
                className="search-loc-box"
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
                  {showLocDropdown && (
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
                        minWidth: 'min(100%, 300px)',
                        maxWidth: 'calc(100vw - 32px)',
                        maxHeight: 380,
                        overflowY: 'auto',
                        zIndex: 250,
                        background: 'var(--dropdown-bg)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                        flexDirection: 'column',
                        display: 'flex',
                        textAlign: 'left',
                      }}
                    >
                      {!location.trim() ? (
                        /* Grouped View: Tier 1 Metros, Tier 2 Emerging Tech Hubs, Global & Remote */
                        POPULAR_LOCATION_GROUPS.map((group, gIdx) => (
                          <div key={gIdx}>
                            <div
                              style={{
                                padding: '0.55rem 0.95rem',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-secondary)',
                                background: 'var(--tag-bg)',
                                borderBottom: '1px solid var(--border)',
                                borderTop: gIdx > 0 ? '1px solid var(--border)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{group.group}</span>
                              <span style={{ fontSize: '0.67rem', opacity: 0.8 }}>{group.badge}</span>
                            </div>
                            {group.locations.map((item, i) => {
                              const tierClass = item.tier === 'tier1'
                                ? 'loc-tier-tier1'
                                : item.tier === 'tier2'
                                  ? 'loc-tier-tier2'
                                  : item.tier === 'remote'
                                    ? 'loc-tier-remote'
                                    : 'loc-tier-global';
                              return (
                                <div
                                  key={i}
                                  onClick={() => handleLocSuggestionClick(item.label)}
                                  style={{
                                    padding: '0.65rem 0.95rem',
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
                                  <MapPin size={13} color="var(--primary-start)" style={{ flexShrink: 0 }} />
                                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                  <span className={`loc-tier-badge ${tierClass}`}>{item.badge}</span>
                                </div>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        /* Filtered Results View when typing */
                        <>
                          <div
                            style={{
                              padding: '0.55rem 0.95rem',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--text-secondary)',
                              background: 'var(--tag-bg)',
                              borderBottom: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>Matching Locations</span>
                            <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>{locationSuggestions.length} found</span>
                          </div>
                          {locationSuggestions.length === 0 ? (
                            <div
                              style={{
                                padding: '1rem',
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.84rem',
                              }}
                            >
                              No predefined cities matching &ldquo;{location}&rdquo;. Press Enter or Search to query worldwide.
                            </div>
                          ) : (
                            locationSuggestions.map((loc, i) => {
                              const tier = getLocationTier(loc);
                              const tierBadge = tier === 'tier1' ? 'Tier 1' : tier === 'tier2' ? 'Tier 2' : tier === 'remote' ? 'Remote' : tier === 'global' ? 'Global' : null;
                              const tierClass = tier === 'tier1'
                                ? 'loc-tier-tier1'
                                : tier === 'tier2'
                                  ? 'loc-tier-tier2'
                                  : tier === 'remote'
                                    ? 'loc-tier-remote'
                                    : 'loc-tier-global';
                              return (
                                <div
                                  key={i}
                                  onClick={() => handleLocSuggestionClick(loc)}
                                  style={{
                                    padding: '0.65rem 0.95rem',
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
                                  <MapPin size={13} color="var(--primary-start)" style={{ flexShrink: 0 }} />
                                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc}</span>
                                  {tierBadge && (
                                    <span className={`loc-tier-badge ${tierClass}`}>{tierBadge}</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Primary Search CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="btn-primary search-submit-btn"
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
              className="search-refinements-bar"
              style={{
                display: 'flex',
                gap: '0.65rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                paddingTop: '0.85rem',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span className="search-refinements-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.15rem' }}>
                Filters:
              </span>

              {/* Role & Category Custom Dropdown */}
              <div
                ref={roleDropdownRef}
                className="search-refinement-role"
                style={{
                  position: 'relative',
                  flex: '1.1',
                  minWidth: 160,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleDropdown((prev) => !prev);
                    setShowIndustryDropdown(false);
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
                            handleClearRole(e);
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
                        width: 'max-content',
                        minWidth: 'max(100%, 320px)',
                        maxWidth: 'min(440px, calc(100vw - 2.5rem))',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                            <Briefcase size={13} color="var(--primary-start)" style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap' }}>All Roles & Categories</span>
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

              {/* Industry Custom Dropdown */}
              <div
                ref={industryDropdownRef}
                className="search-refinement-industry"
                style={{
                  position: 'relative',
                  flex: '1.4',
                  minWidth: 190,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowIndustryDropdown((prev) => !prev);
                    setShowRoleDropdown(false);
                    setShowWorkplaceDropdown(false);
                    setShowTypeDropdown(false);
                    setShowLevelDropdown(false);
                  }}
                  aria-expanded={showIndustryDropdown}
                  aria-haspopup="listbox"
                  aria-label="Filter by industry"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.4rem',
                    background: 'var(--input-bg)',
                    borderRadius: 10,
                    padding: '0.62rem 0.75rem',
                    border: showIndustryDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                    boxShadow: showIndustryDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                    color: industry ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: industry ? 600 : 400,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', minWidth: 0 }}>
                    <span>{selectedIndustryObj.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedIndustryObj.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    {industry && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndustry('');
                          executeSearch(query, location, type, level, selectedRole, remote, '');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setIndustry('');
                            executeSearch(query, location, type, level, selectedRole, remote, '');
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
                        title="Clear industry filter"
                      >
                        <X size={13} />
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      color="var(--text-secondary)"
                      style={{
                        transform: showIndustryDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showIndustryDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="glass-panel dropdown-popover-right"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        width: 'max-content',
                        minWidth: 'max(100%, 280px)',
                        maxWidth: 'calc(100vw - 32px)',
                        maxHeight: 320,
                        overflowY: 'auto',
                        zIndex: 250,
                        background: 'var(--dropdown-bg)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '0.35rem 0',
                      }}
                    >
                      {INDUSTRY_OPTIONS.map((opt, idx) => {
                        const isSelected = industry === opt.value;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setIndustry(opt.value);
                              setShowIndustryDropdown(false);
                              executeSearch(query, location, type, level, selectedRole, remote, opt.value);
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{opt.icon}</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.86rem' }}>
                                {opt.label}
                              </span>
                            </div>
                            {isSelected && <Check size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Workplace Custom Dropdown */}
              <div
                ref={workplaceDropdownRef}
                className="search-refinement-workplace"
                style={{
                  position: 'relative',
                  flex: '0.85',
                  minWidth: 140,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkplaceDropdown((prev) => !prev);
                    setShowRoleDropdown(false);
                    setShowIndustryDropdown(false);
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
                        width: 'max-content',
                        minWidth: 'max(100%, 190px)',
                        maxWidth: 'calc(100vw - 32px)',
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', flex: 1 }}>
                              <span style={{ flexShrink: 0 }}>{opt.icon}</span>
                              <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                            </div>
                            {isSelected && <Check size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />}
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
                className="search-refinement-type"
                style={{
                  position: 'relative',
                  flex: '0.75',
                  minWidth: 120,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowTypeDropdown((prev) => !prev);
                    setShowRoleDropdown(false);
                    setShowIndustryDropdown(false);
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
                      className="glass-panel dropdown-popover-right"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        width: 'max-content',
                        minWidth: 'max(100%, 175px)',
                        maxWidth: 'calc(100vw - 32px)',
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
                            <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{opt.label}</span>
                            {isSelected && <Check size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />}
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
                className="search-refinement-level"
                style={{
                  position: 'relative',
                  flex: '0.8',
                  minWidth: 130,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowLevelDropdown((prev) => !prev);
                    setShowRoleDropdown(false);
                    setShowIndustryDropdown(false);
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
                      className="glass-panel dropdown-popover-right"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        width: 'max-content',
                        minWidth: 'max(100%, 185px)',
                        maxWidth: 'calc(100vw - 32px)',
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
                            <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{opt.label}</span>
                            {isSelected && <Check size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Clear Filters CTA if active */}
              {(query || location || remote || selectedRole || type || level || industry) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="search-refinement-reset"
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
            {(query || location || remote || selectedRole || type || level || industry) && (
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
                      background: 'var(--badge-rose-bg)',
                      border: '1px solid var(--badge-rose-border)',
                      color: 'var(--badge-rose-text)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>{selectedLevelObj.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setLevel('');
                        executeSearch(query, location, type, '', selectedRole, remote, industry);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove seniority filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {industry && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.22rem 0.6rem',
                      borderRadius: 9999,
                      background: 'rgba(236, 72, 153, 0.15)',
                      border: '1px solid rgba(236, 72, 153, 0.35)',
                      color: '#f472b6',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>{selectedIndustryObj.icon}</span>
                    <span>{selectedIndustryObj.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIndustry('');
                        executeSearch(query, location, type, level, selectedRole, remote, '');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove industry filter"
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
                    className="roles-matched-pill"
                    style={{ marginLeft: 'auto' }}
                  >
                    <span className="pulse-dot" />
                    <span className="desktop-only">
                      <span className="count-main">{displayedJobs.length.toLocaleString()} Roles Matched</span>
                      <span className="count-secondary"> • {formattedCount} Total Verified</span>
                    </span>
                    <span className="mobile-only">
                      {displayedJobs.length.toLocaleString()} Roles Matched
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.form>

          {/* Dynamic Popular Search Pills (Ranked by Average Daily Searches) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="quick-pills-container"
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <TrendingUp size={13} style={{ color: 'var(--primary)' }} />
              <span>Popular Searches:</span>
            </span>
            {popularPills.map((pill, idx) => {
              const isSelected = query.toLowerCase() === (pill.query || '').toLowerCase();
              return (
                <button
                  key={pill.id || idx}
                  type="button"
                  onClick={() => handleQuickPillClick(pill)}
                  title={`${pill.avgSearches || 0} avg daily searches • ${pill.trend === 'hot' ? 'High Demand' : pill.trend === 'rising' ? 'Trending' : 'Popular'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--tag-bg)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? 'rgba(99, 102, 241, 0.45)' : 'var(--tag-border)'}`,
                    boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.2)' : 'none',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 20,
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </motion.div>
        </section>

        {/* Results Header Toolbar */}
        {!loading && (activeView === 'saved' ? savedJobs.length > 0 : searched && displayedJobs.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="results-header-toolbar"
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
                  className="roles-matched-pill"
                >
                  <span className="pulse-dot" />
                  <span className="desktop-only">
                    {isScrollingCards ? (
                      <>
                        <span className="count-main">{animatedElapsedCount} of {displayedJobs.length.toLocaleString()} Roles Matched</span>
                        <span className="count-secondary"> • {formattedCount} Total Verified</span>
                      </>
                    ) : (
                      <>
                        <span className="count-main">{displayedJobs.length.toLocaleString()} Roles Matched</span>
                        <span className="count-secondary"> • {formattedCount} Total Verified</span>
                      </>
                    )}
                  </span>
                  <span className="mobile-only">
                    {isScrollingCards
                      ? `${animatedElapsedCount}/${displayedJobs.length.toLocaleString()} Roles`
                      : `${displayedJobs.length.toLocaleString()} Roles`}
                  </span>
                </motion.div>
              )}
              {displayedJobs.length > JOBS_BATCH_SIZE && (
                <span className="autoload-scroll-pill">
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
            <div className="skeleton-job-grid" style={{ marginTop: '1.5rem' }}>
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
                  ref={jobGridRef}
                  className="job-grid"
                  style={{
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
                    className="lazy-load-sentinel"
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
                      overflowAnchor: 'none',
                      contain: 'layout style',
                      minHeight: 80,
                    }}
                  >
                    {isLoadingMore ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
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
                  <HomeIcon size={15} />
                  <span>Explore Remote Roles</span>
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
                ref={jobGridRef}
                className="job-grid"
                style={{
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
                  className="lazy-load-sentinel"
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
                    overflowAnchor: 'none',
                    contain: 'layout style',
                    minHeight: 80,
                  }}
                >
                  {isLoadingMore ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
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
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    color: '#687ff0ff',
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
              <div className="discovery-domain-grid">
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

              {/* Candidate Trust & Quality Assurance Standards Strip */}
              <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.2rem' }}>
                  JOBNEXUS VERIFIED CAREER DISCOVERY STANDARDS
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                  {[
                    { label: 'Direct Employer ATS Pipelines', icon: <ShieldCheck size={13} color="var(--accent-emerald)" /> },
                    { label: '100% Verified Tech Opportunities', icon: <Zap size={13} color="#38bdf8" /> },
                    { label: 'Zero Recruiter Spam', icon: <ShieldCheck size={13} color="var(--accent-emerald)" /> },
                    { label: 'Tier 1 & Tier 2 India Tech Hubs', icon: <span style={{ fontSize: '0.85rem' }}>🇮🇳</span> },
                    { label: 'Worldwide Distributed & Remote Roles', icon: <Globe size={13} color="#6366f1" /> },
                    { label: 'Real-Time Hourly Synchronization', icon: <Clock size={13} color="#f59e0b" /> },
                    { label: 'Authentic Direct Application Access', icon: <Sparkles size={13} color="#a855f7" /> },
                  ].map((item, idx) => (
                    <span key={idx} className="trust-badge">
                      {item.icon}
                      <span>{item.label}</span>
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

        {/* Floating Glassmorphic Scroll Progress HUD Indicator */}
        <AnimatePresence>
          {showScrollTop && isScrollingCards && displayedJobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ duration: 0.2 }}
              className="floating-elapsed-indicator"
              onClick={scrollToTop}
              role="button"
              tabIndex={0}
              title="Click to scroll back to top"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  scrollToTop();
                }
              }}
            >
              <Compass size={13} color="#818cf8" />
              <span className="floating-elapsed-text">
                {animatedElapsedCount} / {displayedJobs.length.toLocaleString()}
              </span>
              <span className="floating-elapsed-sub">roles</span>
            </motion.div>
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
                className="glass-panel profile-modal-card"
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <JobNexusLogo variant="mark" size={24} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                      Account Profile
                    </h3>
                  </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Saved Opportunities</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{savedJobs.length} roles</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Session Security</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#34d399' }}>HTTP-Only Secure Cookie</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Membership Tier</span>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: isPremium ? '#38bdf8' : 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {isPremium ? '⭐ Premium (₹499/mo)' : 'Free Discovery'}
                    </span>
                  </div>

                  {isPremium && entitlement?.subscription && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {entitlement.subscription.cancelAtPeriodEnd ? 'Access Paid Through' : 'Next Renewal'}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {new Date(entitlement.subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Subscription Actions */}
                {isPremium ? (
                  <div style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
                    {entitlement?.subscription?.cancelAtPeriodEnd ? (
                      <div
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(234, 179, 8, 0.1)',
                          borderRadius: 8,
                          border: '1px solid rgba(234, 179, 8, 0.25)',
                          fontSize: '0.75rem',
                          color: '#facc15',
                        }}
                      >
                        Auto-renewal cancelled. Premium access remains active until the end of your billing cycle.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCancelSubscription}
                        disabled={isCancellingSubscription}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '0.78rem',
                          cursor: isCancellingSubscription ? 'wait' : 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {isCancellingSubscription ? 'Cancelling auto-renewal...' : 'Cancel Auto-Renewal'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        openPremiumOfferModal();
                      }}
                      style={{
                        width: '100%',
                        padding: '0.7rem 1rem',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                      }}
                    >
                      <span>Upgrade to Premium (₹499/mo)</span>
                      <Sparkles size={14} />
                    </button>
                  </div>
                )}

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
                    onClick={handleSignOut}
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

        {/* Post-Login / On-Demand Premium Offer Modal */}
        <PremiumOfferModal
          isOpen={isPremiumOfferOpen}
          onClose={closePremiumOfferModal}
          onSubscriptionSuccess={handleSubscriptionSuccess}
          userEmail={user?.email}
          userName={user?.name}
        />
      </main>

      {/* Sleek Modern Platform Footer with Official Brand Lockup */}
      <footer className="site-footer">
        <div className="container footer-container">
          <div className="footer-grid">
            {/* Brand & Telemetry Column */}
            <div className="footer-brand-col">
              <JobNexusLogo variant="inline" size={32} showTagline />
              <p className="footer-desc">
                Next-generation career discovery platform aggregating verified engineering, AI, and distributed tech opportunities directly from employer ATS portals with zero ghost jobs.
              </p>
              <div className="footer-telemetry-badge">
                <span className="pulse-dot" />
                <span>10 Direct ATS Feeds Active • 99.8% Live Role Accuracy</span>
              </div>
            </div>

            {/* Top Career Domains */}
            <div>
              <h4 className="footer-col-title">Career Domains</h4>
              <ul className="footer-links-list">
                <li>
                  <button type="button" onClick={() => handleFooterCategoryClick('Distributed Systems')} className="footer-link-btn">
                    Distributed Systems
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterCategoryClick('Machine Learning AI')} className="footer-link-btn">
                    Machine Learning & AI
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterCategoryClick('Frontend React')} className="footer-link-btn">
                    Frontend & React
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterCategoryClick('Cloud DevOps SRE')} className="footer-link-btn">
                    Cloud Infrastructure & DevOps
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterCategoryClick('Staff Principal Engineer')} className="footer-link-btn">
                    Staff & Principal Engineering
                  </button>
                </li>
              </ul>
            </div>

            {/* Global Tech Hubs */}
            <div>
              <h4 className="footer-col-title">Global Tech Hubs</h4>
              <ul className="footer-links-list">
                <li>
                  <button type="button" onClick={() => handleFooterLocationClick('', 'remote')} className="footer-link-btn">
                    Global Remote Roles
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterLocationClick('Bengaluru, Karnataka')} className="footer-link-btn">
                    Bengaluru & India Hubs
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterLocationClick('San Francisco, CA')} className="footer-link-btn">
                    San Francisco Bay Area
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterLocationClick('London, UK')} className="footer-link-btn">
                    London & Europe
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleFooterLocationClick('New York, NY')} className="footer-link-btn">
                    New York Metro
                  </button>
                </li>
              </ul>
            </div>

            {/* Platform & Quick Access */}
            <div>
              <h4 className="footer-col-title">Platform Access</h4>
              <ul className="footer-links-list">
                <li>
                  <button type="button" onClick={resetToDiscovery} className="footer-link-btn">
                    Explore Verified Roles
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => { setActiveView('saved'); window.scrollTo({ top: 380, behavior: 'smooth' }); }} className="footer-link-btn">
                    Saved Roles Vault ({savedJobs.length})
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => (user ? setIsProfileModalOpen(true) : openAuthModal())} className="footer-link-btn">
                    {user ? 'Account Settings' : 'Sign In / Register'}
                  </button>
                </li>
                <li>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <ShieldCheck size={14} color="#34d399" />
                    Anti-Scam Filter Active
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom Bar */}
          <div className="footer-bottom-bar">
            <div>
              <span>© {new Date().getFullYear()} JobNexus Inc. All rights reserved. Direct ATS crawl pipeline.</span>
            </div>

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="footer-back-to-top"
              aria-label="Scroll back to top"
            >
              <span>Back to top</span>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
