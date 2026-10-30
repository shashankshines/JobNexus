'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
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
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
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
  Building2,
  HeartPulse,
  HardHat,
  Factory,
  Truck,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  Landmark,
  Headphones,
  GraduationCap,
} from 'lucide-react';
import JobCard from './components/JobCard';
import ThemeToggle from './components/ThemeToggle';
import FuturisticToast from './components/FuturisticToast';
import JobNexusLogo from './components/JobNexusLogo';
import { useAuth } from './context/AuthContext';
import { useJobStats } from '@/modules/jobs/hooks/useJobStats';
import { useElapsedJobCounter } from '@/modules/jobs/hooks/useElapsedJobCounter';

const PremiumOfferModal = dynamic(
  () => import('./components/PremiumOfferModal').then((mod) => mod.PremiumOfferModal),
  { ssr: false }
);

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes client cache
import {
  isValidApplicationUrl,
  getFallbackApplicationUrl,
  isCompanyMasked,
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
  industry?: string;
}

const DISCOVERY_DOMAINS: DiscoveryDomain[] = [
  {
    title: 'Healthcare & Clinical Care',
    count: '400+ Roles',
    desc: 'Physicians, registered nurses, clinical practice, pharmacy, and hospital healthcare teams.',
    tags: ['Nursing', 'Clinical Care', 'Pharmacy', 'Hospital Care'],
    icon: HeartPulse,
    industry: 'healthcare',
  },
  {
    title: 'Technology & IT Engineering',
    count: '1,200+ Roles',
    desc: 'Full-stack development, cloud systems, AI/ML, data engineering, and tech architecture.',
    tags: ['Full Stack', 'Cloud & DevOps', 'AI & ML', 'Cybersecurity'],
    icon: Code2,
    industry: 'technology',
  },
  {
    title: 'Finance, Banking & Accounts',
    count: '350+ Roles',
    desc: 'Chartered accounting, auditing, taxation, financial analysis, investment, and banking.',
    tags: ['Accounting', 'Audit & Tax', 'Financial Analyst', 'Corporate Finance'],
    icon: TrendingUp,
    industry: 'finance_accounting',
  },
  {
    title: 'Education & Academic Training',
    count: '280+ Roles',
    desc: 'School teachers, university professors, instructional leadership, and academic curriculum.',
    tags: ['Teaching', 'Higher Education', 'Curriculum', 'Pedagogy'],
    icon: GraduationCap,
    industry: 'education',
  },
  {
    title: 'Construction & Skilled Trades',
    count: '150+ Roles',
    desc: 'Civil engineering, site supervision, electrical, plumbing, carpentry, and infrastructure.',
    tags: ['Civil Engineering', 'Site Engineer', 'Electrical', 'Trades'],
    icon: HardHat,
    industry: 'construction_trades',
  },
  {
    title: 'Logistics & Supply Chain',
    count: '220+ Roles',
    desc: 'Global supply chain managers, warehouse operations, freight dispatchers, and fleet logistics.',
    tags: ['Supply Chain', 'Warehousing', 'Freight', 'Fleet Operations'],
    icon: Truck,
    industry: 'logistics_transport',
  },
  {
    title: 'Manufacturing & Industrial',
    count: '190+ Roles',
    desc: 'Plant operations, mechanical engineering, production supervision, and quality assurance.',
    tags: ['Mechanical', 'Plant Operations', 'Production', 'Quality Control'],
    icon: Factory,
    industry: 'manufacturing',
  },
  {
    title: 'Retail, Sales & Commerce',
    count: '550+ Roles',
    desc: 'Store management, merchandising, account executives, B2B enterprise sales, and retail leads.',
    tags: ['B2B Sales', 'Store Operations', 'Merchandising', 'Account Executive'],
    icon: ShoppingBag,
    industry: 'retail_sales',
  },
  {
    title: 'Hospitality & Tourism',
    count: '120+ Roles',
    desc: 'Executive chefs, hotel managers, front office operations, catering, and guest services.',
    tags: ['Hotel Management', 'Culinary Arts', 'Catering', 'Guest Relations'],
    icon: UtensilsCrossed,
    industry: 'hospitality_tourism',
  },
  {
    title: 'Administration & Human Resources',
    count: '260+ Roles',
    desc: 'People operations, talent acquisition, office management, and executive administration.',
    tags: ['People Ops', 'Recruiting', 'Office Management', 'HR Partner'],
    icon: Users,
    industry: 'administration_hr',
  },
  {
    title: 'Government & Public Sector',
    count: '180+ Roles',
    desc: 'Civil services, public administration, humanitarian aid, disaster relief, and municipal policy.',
    tags: ['Civil Services', 'Public Policy', 'Humanitarian', 'Disaster Relief'],
    icon: Landmark,
    industry: 'government_public',
  },
  {
    title: 'Customer Support & Service',
    count: '210+ Roles',
    desc: 'Client success managers, technical helpdesk, customer care specialists, and contact center leads.',
    tags: ['Customer Success', 'Technical Support', 'Helpdesk', 'Client Care'],
    icon: Headphones,
    industry: 'customer_service',
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
  salary?: string;
  industry?: string;
  category?: string;
}

interface QuickPill {
  id?: string;
  label: string;
  query?: string;
  location?: string;
  remote?: string;
  industry?: string;
  searchCount?: number;
  avgSearches?: number;
  formattedAverage?: string;
  trend?: 'hot' | 'rising' | 'steady';
}

const DEFAULT_POPULAR_PILLS: QuickPill[] = [
  { id: 'healthcare-nursing', label: '🏥 Healthcare', industry: 'healthcare', avgSearches: 135, formattedAverage: '135/day', trend: 'hot' },
  { id: 'full-stack-developer', label: '⚡ Full Stack', query: 'Full Stack Developer', industry: 'technology', avgSearches: 130, formattedAverage: '130/day', trend: 'hot' },
  { id: 'finance-accounting', label: '📊 Finance & Accounts', industry: 'finance_accounting', avgSearches: 110, formattedAverage: '110/day', trend: 'rising' },
  { id: 'education-teaching', label: '🎓 Education & Teaching', industry: 'education', avgSearches: 105, formattedAverage: '105/day', trend: 'rising' },
  { id: 'construction-trades', label: '🏗️ Construction & Trades', industry: 'construction_trades', avgSearches: 90, formattedAverage: '90/day', trend: 'steady' },
  { id: 'logistics-supply', label: '🚚 Logistics & Supply', industry: 'logistics_transport', avgSearches: 85, formattedAverage: '85/day', trend: 'steady' },
  { id: 'manufacturing-industrial', label: '⚙️ Manufacturing', industry: 'manufacturing', avgSearches: 80, formattedAverage: '80/day', trend: 'steady' },
  { id: 'retail-sales', label: '🛍️ Retail & Sales', industry: 'retail_sales', avgSearches: 75, formattedAverage: '75/day', trend: 'rising' },
  { id: 'ai-machine-learning', label: '🤖 AI & ML', query: 'AI Machine Learning', industry: 'technology', avgSearches: 70, formattedAverage: '70/day', trend: 'rising' },
  { id: 'admin-hr', label: '📋 Admin & HR', industry: 'administration_hr', avgSearches: 65, formattedAverage: '65/day', trend: 'steady' },
  { id: 'customer-support', label: '🎧 Customer Support', industry: 'customer_service', avgSearches: 60, formattedAverage: '60/day', trend: 'steady' },
];


const WORKPLACE_OPTIONS = [
  { value: '', label: 'Any Workplace', icon: '🌐' },
  { value: 'remote', label: 'Fully Remote', icon: '🏠' },
  { value: 'hybrid', label: 'Hybrid', icon: '🔄' },
  { value: 'onsite', label: 'On-site', icon: '🏢' },
];

/**
 * High-performance client-side in-memory filter engine.
 * Instantly renders matching jobs in 0ms when pills or searches are clicked,
 * completely eliminating loading lag and skeleton card flickering.
 */
function filterJobsClientSide(
  jobs: Job[],
  filters: {
    query?: string;
    company?: string;
    location?: string;
    type?: string;
    level?: string;
    remote?: string;
    industry?: string;
  }
): Job[] {
  if (!jobs || jobs.length === 0) return [];
  const q = filters.query?.toLowerCase().trim();
  const comp = filters.company?.toLowerCase().trim();
  const loc = filters.location?.toLowerCase().trim();
  const typ = filters.type?.toLowerCase().trim();
  const lvl = filters.level?.toLowerCase().trim();
  const rem = filters.remote?.toLowerCase().trim();
  const ind = filters.industry?.toLowerCase().trim();

  return jobs.filter((job) => {
    // Workplace filter: Remote, Hybrid, On-site
    if (rem && rem !== 'all') {
      if (rem === 'remote' && !job.isRemote && job.workplaceType !== 'remote') return false;
      if (rem === 'hybrid' && job.workplaceType !== 'hybrid') return false;
      if (rem === 'onsite' && (job.isRemote || job.workplaceType === 'remote' || job.workplaceType === 'hybrid')) return false;
    }

    // Canonical industry filter
    if (ind && ind !== 'all') {
      const jobInd = (job.industry || '').toLowerCase();
      const jobCat = (job.category || '').toLowerCase();
      const matchInd =
        jobInd.includes(ind) ||
        ind.includes(jobInd) ||
        jobCat.includes(ind) ||
        ind.includes(jobCat);
      if (!matchInd) return false;
    }

    // Company filter
    if (comp) {
      if (!job.company || !job.company.toLowerCase().includes(comp)) return false;
    }

    // Employment type filter
    if (typ && typ !== 'all') {
      const jobType = (job.type || '').toLowerCase();
      if (!jobType.includes(typ)) return false;
    }

    // Experience / Seniority level filter
    if (lvl && lvl !== 'all') {
      const title = (job.title || '').toLowerCase();
      const tags = (job.tags || []).map((t) => t.toLowerCase()).join(' ');
      if (lvl === 'entry' && !title.includes('junior') && !title.includes('entry') && !title.includes('intern') && !title.includes('graduate') && !tags.includes('entry')) return false;
      if (lvl === 'senior' && !title.includes('senior') && !title.includes('lead') && !title.includes('principal') && !title.includes('staff')) return false;
      if (lvl === 'lead' && !title.includes('lead') && !title.includes('manager') && !title.includes('director') && !title.includes('head')) return false;
    }

    // Location filter
    if (loc) {
      const jobLoc = (job.location || '').toLowerCase();
      if (!jobLoc.includes(loc)) return false;
    }

    // Query text match (title, tags, category)
    if (q) {
      const title = (job.title || '').toLowerCase();
      const tags = (job.tags || []).map((t) => t.toLowerCase()).join(' ');
      const category = (job.category || '').toLowerCase();
      const match = title.includes(q) || tags.includes(q) || category.includes(q);
      if (!match) return false;
    }

    return true;
  });
}

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

const HERO_ROTATING_WORDS = [
  {
    text: 'Career Opportunity',
    words: ['Career', 'Opportunity'],
    sector: '15+ Sectors',
    icon: '✨',
    color: '#818cf8',
    gradient: 'linear-gradient(135deg, #818cf8 0%, #c084fc 45%, #f472b6 100%)',
    glow: 'rgba(99, 102, 241, 0.45)',
  },
  {
    text: 'Tech & AI Role',
    words: ['Tech & AI', 'Role'],
    sector: 'Technology',
    icon: '💻',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 45%, #c084fc 100%)',
    glow: 'rgba(56, 189, 248, 0.45)',
  },
  {
    text: 'Healthcare Position',
    words: ['Healthcare', 'Position'],
    sector: 'Healthcare',
    icon: '🏥',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #34d399 0%, #2dd4bf 45%, #38bdf8 100%)',
    glow: 'rgba(52, 211, 153, 0.45)',
  },
  {
    text: 'Finance & Banking Job',
    words: ['Finance & Banking', 'Job'],
    sector: 'Finance',
    icon: '📈',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 45%, #ec4899 100%)',
    glow: 'rgba(251, 191, 36, 0.45)',
  },
  {
    text: 'Global Remote Role',
    words: ['Global Remote', 'Role'],
    sector: 'Worldwide',
    icon: '🌍',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #c084fc 0%, #f472b6 45%, #818cf8 100%)',
    glow: 'rgba(168, 85, 247, 0.45)',
  },
  {
    text: 'Leadership Role',
    words: ['Leadership', 'Role'],
    sector: 'Executive',
    icon: '🚀',
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, #fb7185 0%, #e11d48 45%, #818cf8 100%)',
    glow: 'rgba(244, 63, 94, 0.45)',
  },
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

  // Admin UI visibility strictly locked to designated administrator
  const isDesignatedAdmin = Boolean(
    isAuthenticated &&
    user &&
    user.email?.toLowerCase().trim() === 'shashankshines@gmail.com'
  );

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
  const [company, setCompany] = useState('');
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
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showWorkplaceDropdown, setShowWorkplaceDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  // Advanced Refinements Drawer state
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const industryRailRef = useRef<HTMLDivElement>(null);

  const scrollIndustryRail = useCallback((direction: 'left' | 'right') => {
    if (industryRailRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      industryRailRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, []);

  const activeRefinementsCount = useMemo(() => {
    return (selectedRole ? 1 : 0) + (company ? 1 : 0) + (industry ? 1 : 0) + (type ? 1 : 0) + (level ? 1 : 0);
  }, [selectedRole, company, industry, type, level]);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const locBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const headerBackdropRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const industryDropdownRef = useRef<HTMLDivElement>(null);
  const workplaceDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const intentProcessedRef = useRef(false);
  const jobGridRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const tracksContentRef = useRef<HTMLDivElement>(null);
  const feedContentRef = useRef<HTMLDivElement>(null);
  const savedContentRef = useRef<HTMLDivElement>(null);
  const [isResultsFocused, setIsResultsFocused] = useState(false);
  const [tabFocusBadge, setTabFocusBadge] = useState<string | null>(null);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeDiscoveryTab, setActiveDiscoveryTab] = useState<'feed' | 'tracks'>('feed');
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  // High-performance client-side multi-key search & pill cache
  const clientSearchCacheRef = useRef<Map<string, { jobs: Job[]; timestamp: number }>>(new Map());
  const allRawJobsCacheRef = useRef<Job[]>([]);
  const activeSearchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isHeroPaused) return;
    const interval = setInterval(() => {
      setHeroWordIndex((prev) => (prev + 1) % HERO_ROTATING_WORDS.length);
    }, 3600);
    return () => clearInterval(interval);
  }, [isHeroPaused]);

  const currentHeroWord = HERO_ROTATING_WORDS[heroWordIndex];

  const executeSearch = useCallback(
    async (
      searchQuery = query,
      searchLoc = location,
      searchType = type,
      searchLevel = level,
      roleCategory = selectedRole,
      searchRemote = remote,
      searchIndustry = industry,
      searchCompany = company
    ) => {
      setSearched(true);
      setShowJobDropdown(false);
      setShowLocDropdown(false);
      setShowRoleDropdown(false);
      setShowCompanyDropdown(false);
      setShowIndustryDropdown(false);
      setShowWorkplaceDropdown(false);
      setShowTypeDropdown(false);
      setShowLevelDropdown(false);

      const params = new URLSearchParams();
      const effectiveQuery = [searchQuery, roleCategory].filter(Boolean).join(' ').trim();
      if (effectiveQuery) params.append('query', effectiveQuery);
      if (searchCompany) params.append('company', searchCompany);
      if (searchLoc) params.append('location', searchLoc);
      if (searchType) params.append('type', searchType);
      if (searchLevel) params.append('level', searchLevel);
      if (searchRemote) params.append('remote', searchRemote);
      if (searchIndustry && searchIndustry !== 'all') params.append('industry', searchIndustry);

      const cacheKey = params.toString();
      const isUnconstrained =
        !effectiveQuery &&
        !searchLoc &&
        !searchType &&
        !searchLevel &&
        !searchRemote &&
        (!searchIndustry || searchIndustry === 'all') &&
        !searchCompany;

      // 1. Instant Cache Hit Check: If this query/pill was already visited, return in 0ms!
      const cached = clientSearchCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
        setJobs(cached.jobs);
        setLoading(false);
        if (isUnconstrained) {
          syncFromJobsCount(cached.jobs.length);
        }
        return;
      }

      // 2. Optimistic Instant In-Memory Filter:
      // If we already have the raw job catalog in memory, instantly render matching jobs in 0ms!
      if (allRawJobsCacheRef.current.length > 0) {
        const optimisticJobs = filterJobsClientSide(allRawJobsCacheRef.current, {
          query: effectiveQuery,
          company: searchCompany,
          location: searchLoc,
          type: searchType,
          level: searchLevel,
          remote: searchRemote,
          industry: searchIndustry,
        });
        if (optimisticJobs.length > 0) {
          setJobs(optimisticJobs);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      // Abort any prior in-flight request so rapid pill clicks don't collide
      if (activeSearchAbortRef.current) {
        activeSearchAbortRef.current.abort();
      }
      const abortController = new AbortController();
      activeSearchAbortRef.current = abortController;

      try {
        const res = await fetch(`/api/jobs?${cacheKey}`, {
          signal: abortController.signal,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.jobs && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
          clientSearchCacheRef.current.set(cacheKey, {
            jobs: data.jobs,
            timestamp: Date.now(),
          });

          if (isUnconstrained) {
            allRawJobsCacheRef.current = data.jobs;
            syncFromJobsCount(data.jobs.length);
          } else if (allRawJobsCacheRef.current.length === 0) {
            allRawJobsCacheRef.current = data.jobs;
          }

          if (typeof window !== 'undefined' && data.jobs.length > 0) {
            try {
              sessionStorage.setItem('jobnexus_initial_catalog', JSON.stringify(data.jobs.slice(0, 100)));
            } catch {
              // Ignore quota
            }
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
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('[Search Error]:', error);
        if (allRawJobsCacheRef.current.length === 0) {
          setJobs([]);
        }
      } finally {
        if (activeSearchAbortRef.current === abortController) {
          setLoading(false);
          activeSearchAbortRef.current = null;
        }
      }
    },
    [query, company, location, type, level, selectedRole, remote, industry, syncFromJobsCount]
  );

  const resetToDiscovery = useCallback(() => {
    setQuery('');
    setCompany('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    setIndustry('');
    setSortBy('relevance');
    setActiveView('all');
    setShowRoleDropdown(false);
    setShowCompanyDropdown(false);
    setShowIndustryDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setShowJobDropdown(false);
    setShowLocDropdown(false);
    setRoleSearchQuery('');
    setCompanySearchQuery('');
    setJobs([]);
    setSearched(false);
    setVisibleCount(JOBS_BATCH_SIZE);
    setActiveDiscoveryTab('feed');
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

  // Pre-load raw catalog on mount from sessionStorage and background fetch for instant 0ms pill clicking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('jobnexus_initial_catalog');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            allRawJobsCacheRef.current = parsed;
          }
        }
      } catch {
        // Fall back gracefully
      }
    }

    // Warm up the raw jobs catalog in background so all future searches/pill clicks resolve in 0ms!
    if (allRawJobsCacheRef.current.length === 0) {
      executeSearch('', '', '', '', '', '', '', '');
    }
  }, [executeSearch]);

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
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(target)) {
        setShowCompanyDropdown(false);
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

  // Debounce suggestions on input changes to minimize main-thread rendering friction while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setJobSuggestions(getSuggestions(query));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocationSuggestions(getLocationSuggestions(location, 15));
    }, 150);
    return () => clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  const scrollToResults = useCallback((customBadge?: string | React.SyntheticEvent) => {
    if (typeof window === 'undefined') return;

    const performScroll = () => {
      const target = feedContentRef.current || resultsSectionRef.current || jobGridRef.current;
      if (!target) return;

      const headerOffset = 90;
      const targetRect = target.getBoundingClientRect();
      const targetTop = targetRect.top + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });

      setTabFocusBadge(typeof customBadge === 'string' ? customBadge : 'Results in Focus');
      setIsResultsFocused(true);
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      focusTimeoutRef.current = setTimeout(() => {
        setIsResultsFocused(false);
        setTabFocusBadge(null);
      }, 2000);

      try {
        target.focus({ preventScroll: true });
      } catch {
        // Fallback for environments without focus support
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(performScroll);
    });
  }, []);

  const handleDiscoveryTabSelect = useCallback((targetTab: 'feed' | 'tracks') => {
    setActiveDiscoveryTab(targetTab);

    // If switching to live roles feed but jobs haven't been fetched yet, trigger browse all
    if (targetTab === 'feed' && !searched && jobs.length === 0) {
      executeSearch('', '', '', '', '', '', '', '');
    }

    setTabFocusBadge(targetTab === 'tracks' ? 'Curated Tracks (12) in Focus' : 'Live Roles Feed in Focus');
    setIsResultsFocused(true);

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      setIsResultsFocused(false);
      setTabFocusBadge(null);
    }, 2200);

    // Gracefully transfer focus and smooth-scroll to content below
    setTimeout(() => {
      const targetEl = targetTab === 'tracks'
        ? tracksContentRef.current
        : (feedContentRef.current || jobGridRef.current || resultsSectionRef.current);

      if (targetEl) {
        const headerOffset = 100;
        const rect = targetEl.getBoundingClientRect();
        const targetTop = rect.top + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth',
        });

        try {
          targetEl.focus({ preventScroll: true });
        } catch {
          // Fallback
        }
      }
    }, 45);
  }, [searched, jobs.length, executeSearch]);

  const handleSortSelect = useCallback((newSort: 'relevance' | 'date') => {
    setSortBy(newSort);
    setTabFocusBadge(newSort === 'relevance' ? 'Sorted by Best Match' : 'Sorted by Freshest First');
    setIsResultsFocused(true);

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      setIsResultsFocused(false);
      setTabFocusBadge(null);
    }, 2000);

    setTimeout(() => {
      const targetEl = feedContentRef.current || jobGridRef.current;
      if (targetEl) {
        try {
          targetEl.focus({ preventScroll: true });
        } catch {}
      }
    }, 45);
  }, []);

  const handleViewSelect = useCallback((targetView: 'all' | 'saved') => {
    setActiveView(targetView);
    setTabFocusBadge(targetView === 'saved' ? 'Saved Roles in Focus' : 'All Roles Feed in Focus');
    setIsResultsFocused(true);

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      setIsResultsFocused(false);
      setTabFocusBadge(null);
    }, 2000);

    setTimeout(() => {
      const targetEl = targetView === 'saved'
        ? savedContentRef.current
        : (feedContentRef.current || resultsSectionRef.current);

      if (targetEl) {
        const headerOffset = 100;
        const rect = targetEl.getBoundingClientRect();
        const targetTop = rect.top + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth',
        });
        try {
          targetEl.focus({ preventScroll: true });
        } catch {}
      }
    }, 45);
  }, []);

  const handleDomainClick = (domain: DiscoveryDomain) => {
    const nextQuery = domain.query ?? '';
    const nextLoc = domain.location ?? '';
    const nextRemote = domain.remote ?? '';
    const nextIndustry = domain.industry ?? '';
    setQuery(nextQuery);
    setLocation(nextLoc);
    setRemote(nextRemote);
    setIndustry(nextIndustry);
    setSelectedRole('');
    setActiveDiscoveryTab('feed');
    executeSearch(nextQuery, nextLoc, type, level, '', nextRemote, nextIndustry);
    scrollToResults();
  };

  const handleBrowseAllClick = () => {
    setQuery('');
    setCompany('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    setIndustry('');
    setActiveDiscoveryTab('feed');
    executeSearch('', '', '', '', '', '', '', '');
    scrollToResults();
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    executeSearch();
    scrollToResults();
  };

  const handleJobSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowJobDropdown(false);
    // Clearing stale industry and selectedRole ensures searching for specific job titles
    // explores across all verified sectors and doesn't get constrained by earlier navigation
    setIndustry('');
    setSelectedRole('');
    executeSearch(suggestion, location, type, level, '', remote, '', company);
    scrollToResults();
  };

  const handleLocSuggestionClick = (loc: string) => {
    setLocation(loc);
    setShowLocDropdown(false);
    executeSearch(query, loc, type, level, selectedRole, remote, industry, company);
    scrollToResults();
  };

  const handleRoleSelect = (roleVal: string) => {
    setSelectedRole(roleVal);
    setShowRoleDropdown(false);
    setRoleSearchQuery('');
    // Selecting a role category clears lingering industry filters so cross-industry positions are discovered
    setIndustry('');
    let nextRemote = remote;
    if (isRemoteRole(roleVal) && !remote) {
      nextRemote = 'remote';
      setRemote('remote');
    }
    executeSearch(query, location, type, level, roleVal, nextRemote, '', company);
    scrollToResults();
  };

  const handleClearRole = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedRole('');
    setShowRoleDropdown(false);
    setRoleSearchQuery('');
    executeSearch(query, location, type, level, '', remote, industry, company);
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

  const handleSelectCompany = useCallback(
    (selectedComp: string) => {
      setCompany(selectedComp);
      setShowCompanyDropdown(false);
      executeSearch(query, location, type, level, selectedRole, remote, industry, selectedComp);
      scrollToResults();
    },
    [query, location, type, level, selectedRole, remote, industry, executeSearch, scrollToResults]
  );

  const handleSelectIndustry = useCallback(
    (selectedInd: string) => {
      // Find matching canonical industry option
      const match = INDUSTRY_OPTIONS.find(
        (opt) =>
          opt.value === selectedInd ||
          opt.label.toLowerCase() === selectedInd.toLowerCase() ||
          opt.label.toLowerCase().includes(selectedInd.toLowerCase())
      );
      const indVal = match ? match.value : selectedInd;
      setIndustry(indVal);
      executeSearch(query, location, type, level, selectedRole, remote, indVal, company);
      scrollToResults();
    },
    [query, location, type, level, selectedRole, remote, company, executeSearch, scrollToResults]
  );

  const availableCompanies = useMemo(() => {
    const compSet = new Set<string>();
    for (const j of jobs) {
      if (j.company && !isCompanyMasked(j.company)) {
        compSet.add(j.company.trim());
      }
    }
    return Array.from(compSet).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredCompanies = useMemo(() => {
    if (!companySearchQuery.trim()) return availableCompanies;
    const q = companySearchQuery.toLowerCase().trim();
    return availableCompanies.filter((c) => c.toLowerCase().includes(q));
  }, [availableCompanies, companySearchQuery]);

  const handleWorkplaceCategoryClick = (categoryRemoteParam: string) => {
    setRemote(categoryRemoteParam);
    executeSearch(query, location, type, level, selectedRole, categoryRemoteParam);
  };

  const handleQuickPillClick = (pill: QuickPill) => {
    // When clicking a role query pill without explicit industry, clear stale industry filter
    const nextIndustry = pill.industry || '';
    const nextQuery = pill.query ?? (pill.industry ? '' : query);
    const nextLoc = pill.location ?? location;
    const nextRemote = pill.remote ?? remote;

    setQuery(nextQuery);
    setIndustry(nextIndustry);
    if (pill.location !== undefined) setLocation(nextLoc);
    if (pill.remote !== undefined) setRemote(nextRemote);

    executeSearch(nextQuery, nextLoc, type, level, selectedRole, nextRemote, nextIndustry, company);
    scrollToResults();
  };

  const clearAllFilters = () => {
    setQuery('');
    setCompany('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    setIndustry('');
    setShowRoleDropdown(false);
    setShowCompanyDropdown(false);
    setShowIndustryDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setRoleSearchQuery('');
    setCompanySearchQuery('');
    executeSearch('', '', '', '', '', '', '', '');
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
  }, [query, company, location, type, level, selectedRole, remote, industry, sortBy, activeView, jobs]);

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

  // Fixed Header Scroll-State Elevation (glass tint on scroll)
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 8;
      headerWrapperRef.current?.classList.toggle('is-stuck', isScrolled);
      headerBackdropRef.current?.classList.toggle('is-stuck', isScrolled);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
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
    scrollToResults();
  };

  const handleFooterLocationClick = (locQuery: string, remoteVal = '') => {
    setActiveView('all');
    setLocation(locQuery);
    if (remoteVal) setRemote(remoteVal);
    executeSearch(query, locQuery, type, level, selectedRole, remoteVal || remote);
    scrollToResults();
  };

  return (
    <div className="site-layout-wrapper">
      {/* Translucent Frosted Glass Section Behind Fixed Header */}
      <div ref={headerBackdropRef} className="site-header-backdrop" aria-hidden="true" />
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
                  {/* Dedicated Admin Console Direct Access Button — strictly visible only to shashankshines@gmail.com */}
                  {isDesignatedAdmin && (
                    <Link
                      href="/admin"
                      title="Open JobNexus Admin Console"
                      className="site-header-btn-admin"
                    >
                      <ShieldCheck size={14} className="admin-btn-icon" />
                      <span className="admin-btn-text">Admin Console</span>
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
                            {isDesignatedAdmin ? (
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

                            {isDesignatedAdmin && (
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
        <div className="site-header-spacer" aria-hidden="true" />

        {/* Hero Section */}
        <section style={{ margin: '0.85rem 0 1.25rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>
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

          {/* Luminous Animated Hero Headline Container */}
          <div className="hero-headline-container">
            <div
              className="hero-aurora-glow"
              aria-hidden="true"
              style={{
                background: `radial-gradient(circle, ${currentHeroWord.glow} 0%, rgba(168, 85, 247, 0.06) 45%, transparent 70%)`,
              }}
            />
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="hero-headline"
            >
              <div className="hero-headline-tier hero-headline-tier-primary">
                <span className="hero-headline-lead">Find Your Next</span>{' '}
                <motion.span
                  layout
                  transition={{ layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
                  className="hero-rotating-wrapper"
                  onMouseEnter={() => setIsHeroPaused(true)}
                  onMouseLeave={() => setIsHeroPaused(false)}
                  onClick={() => setHeroWordIndex((prev) => (prev + 1) % HERO_ROTATING_WORDS.length)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHeroWordIndex((prev) => (prev + 1) % HERO_ROTATING_WORDS.length);
                    }
                  }}
                  title="Click to advance opportunity (hover to pause)"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`phrase-${heroWordIndex}`}
                      className="hero-rotating-word-group"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {currentHeroWord.words.map((part, pIdx) => (
                        <motion.span
                          key={`${heroWordIndex}-${pIdx}`}
                          initial={{ y: '110%', opacity: 0, scale: 0.92 }}
                          animate={{ y: '0%', opacity: 1, scale: 1 }}
                          exit={{ y: '-110%', opacity: 0, scale: 0.92 }}
                          transition={{
                            duration: 0.64,
                            ease: [0.16, 1, 0.3, 1],
                            delay: pIdx * 0.07,
                          }}
                          className="hero-rotating-word"
                          style={{
                            backgroundImage: currentHeroWord.gradient,
                            textShadow: `0 0 28px ${currentHeroWord.glow}`,
                          }}
                        >
                          {part}
                        </motion.span>
                      ))}
                    </motion.span>
                  </AnimatePresence>
                </motion.span>
              </div>

              <div className="hero-headline-tier hero-headline-tier-secondary">
                <span className="hero-headline-tail">
                  <span>Across</span>{' '}
                  <span className="hero-industry-highlight">
                    Any Industry
                    <span className="hero-industry-underline-beam" aria-hidden="true" />
                  </span>
                </span>
                <span className="hero-sector-ticker-wrap">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`sector-${heroWordIndex}`}
                      initial={{ y: '95%', opacity: 0, scale: 0.9 }}
                      animate={{ y: '0%', opacity: 1, scale: 1 }}
                      exit={{ y: '-95%', opacity: 0, scale: 0.9 }}
                      transition={{
                        duration: 0.6,
                        ease: [0.16, 1, 0.3, 1],
                        delay: 0.08,
                      }}
                      className="hero-sector-ticker"
                      style={{
                        borderColor: `${currentHeroWord.color}44`,
                        color: currentHeroWord.color,
                        background: `${currentHeroWord.color}14`,
                        boxShadow: `0 2px 10px ${currentHeroWord.glow}`,
                      }}
                    >
                      <span style={{ marginRight: '0.22rem' }}>{currentHeroWord.icon}</span>
                      <span>{currentHeroWord.sector}</span>
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45 }}
            style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', maxWidth: 660, margin: '0 auto 0.75rem', lineHeight: 1.55 }}
          >
            Direct applications from verified employer ATS pipelines and official portals across Tech, Healthcare, Finance, Education, Trades, and more.
          </motion.p>

          {/* Streamlined Trust Seal Strip */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="hero-trust-seal-strip"
          >
            <span className="hero-trust-item">
              <ShieldCheck size={14} color="#10b981" />
              <span>100% Direct ATS Links</span>
            </span>
            <span className="hero-trust-divider" aria-hidden="true">•</span>
            <span className="hero-trust-item">
              <Building2 size={14} color="#a855f7" />
              <span>15+ Career Sectors</span>
            </span>
            <span className="hero-trust-divider" aria-hidden="true">•</span>
            <span className="hero-trust-item">
              <Globe size={14} color="#38bdf8" />
              <span>Global &amp; India Roles</span>
            </span>
          </motion.div>

          {/* Unified Search Command Console with Integrated Workplace Mode Header */}
          <motion.form
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            onSubmit={handleSearchSubmit}
            className="glass-panel search-console-form"
            style={{
              width: '100%',
              maxWidth: '100%',
              margin: '0 auto',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 18,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Dedicated Workplace Category Selector (Integrated directly as Top Header of Search Console) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                marginBottom: '0.15rem',
              }}
            >
              <div
                className="workplace-pills-bar"
                style={{
                  display: 'inline-flex',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '3px',
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
                        padding: '0.52rem 0.8rem',
                        borderRadius: 10,
                        fontSize: '0.84rem',
                        fontWeight: 600,
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
                        <span style={{ fontSize: '0.92rem' }}>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
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

              {/* Refinement Filters Toggle Button */}
              <button
                type="button"
                onClick={() => setShowFiltersDrawer((prev) => !prev)}
                className={`search-filters-toggle-btn ${showFiltersDrawer || activeRefinementsCount > 0 ? 'is-active' : ''}`}
                aria-expanded={showFiltersDrawer}
                aria-label="Toggle advanced job filters"
                title="Toggle advanced filters"
              >
                <SlidersHorizontal size={16} />
                <span>Filters</span>
                {activeRefinementsCount > 0 && (
                  <span className="search-filters-badge" aria-label={`${activeRefinementsCount} active filters`}>
                    {activeRefinementsCount}
                  </span>
                )}
              </button>

              {/* Primary Search CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                onClick={scrollToResults}
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

            {/* Advanced Refinements Collapsible Drawer */}
            <AnimatePresence>
              {(showFiltersDrawer || activeRefinementsCount > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="search-refinements-drawer"
                >
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
                      className="glass-panel dropdown-popover-left"
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

              {/* Company Custom Dropdown */}
              <div
                ref={companyDropdownRef}
                className="search-refinement-company"
                style={{
                  position: 'relative',
                  flex: '1.1',
                  minWidth: 155,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowCompanyDropdown((prev) => !prev);
                    setShowRoleDropdown(false);
                    setShowIndustryDropdown(false);
                    setShowWorkplaceDropdown(false);
                    setShowTypeDropdown(false);
                    setShowLevelDropdown(false);
                  }}
                  aria-expanded={showCompanyDropdown}
                  aria-haspopup="listbox"
                  aria-label="Filter by company"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.4rem',
                    background: 'var(--input-bg)',
                    borderRadius: 10,
                    padding: '0.62rem 0.75rem',
                    border: showCompanyDropdown ? '1px solid var(--border-focus)' : '1px solid var(--input-border)',
                    boxShadow: showCompanyDropdown ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                    color: company ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: company ? 600 : 400,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', minWidth: 0 }}>
                    <Building2 size={15} color={company ? 'var(--primary-start)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {company || 'All Companies'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    {company && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompany('');
                          executeSearch(query, location, type, level, selectedRole, remote, industry, '');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setCompany('');
                            executeSearch(query, location, type, level, selectedRole, remote, industry, '');
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
                        title="Clear company filter"
                      >
                        <X size={13} />
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      color="var(--text-secondary)"
                      style={{
                        transform: showCompanyDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showCompanyDropdown && (
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
                        minWidth: 'max(100%, 260px)',
                        maxWidth: 'calc(100vw - 32px)',
                        maxHeight: 320,
                        overflowY: 'auto',
                        zIndex: 250,
                        background: 'var(--dropdown-bg)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '0.4rem 0',
                      }}
                    >
                      {availableCompanies.length > 5 && (
                        <div style={{ padding: '0.35rem 0.65rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                          <input
                            type="text"
                            placeholder="Search employer..."
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              borderRadius: 8,
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              outline: 'none',
                            }}
                          />
                        </div>
                      )}

                      {/* All Companies option */}
                      <div
                        onClick={() => {
                          setCompany('');
                          setShowCompanyDropdown(false);
                          setCompanySearchQuery('');
                          executeSearch(query, location, type, level, selectedRole, remote, industry, '');
                        }}
                        style={{
                          padding: '0.62rem 0.95rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          fontSize: '0.84rem',
                          color: company === '' ? 'var(--primary-start)' : 'var(--text-primary)',
                          fontWeight: company === '' ? 600 : 400,
                          background: company === '' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (company !== '') e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          if (company !== '') e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <Building2 size={14} color={company === '' ? 'var(--primary-start)' : 'var(--text-secondary)'} />
                          <span>All Companies</span>
                        </div>
                        {company === '' && <Check size={14} color="var(--primary-start)" />}
                      </div>

                      {filteredCompanies.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No companies found matching &quot;{companySearchQuery}&quot;
                        </div>
                      ) : (
                        filteredCompanies.map((compName) => {
                          const isSelected = company.toLowerCase() === compName.toLowerCase();
                          return (
                            <div
                              key={compName}
                              onClick={() => {
                                handleSelectCompany(compName);
                              }}
                              style={{
                                padding: '0.55rem 0.95rem',
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden', minWidth: 0 }}>
                                <Building2 size={13} color={isSelected ? 'var(--primary-start)' : 'var(--text-secondary)'} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {compName}
                                </span>
                              </div>
                              {isSelected && <Check size={14} color="var(--primary-start)" style={{ flexShrink: 0 }} />}
                            </div>
                          );
                        })
                      )}
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
                      className="glass-panel dropdown-popover-left"
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
                      className="glass-panel dropdown-popover-right"
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
                      className="glass-panel dropdown-popover-left"
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
              {(query || company || location || remote || selectedRole || type || level || industry) && (
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
          </motion.div>
        )}
      </AnimatePresence>

            {/* Active Filter Chips Bar */}
            {(query || company || location || remote || selectedRole || type || level || industry) && (
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
                        executeSearch('', location, type, level, selectedRole, remote, industry, company);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove keyword filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {company && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.22rem 0.6rem',
                      borderRadius: 9999,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10b981',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    <Building2 size={11} />
                    <span>{company}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCompany('');
                        executeSearch(query, location, type, level, selectedRole, remote, industry, '');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove company filter"
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
                        executeSearch(query, '', type, level, selectedRole, remote, industry, company);
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
                        executeSearch(query, location, type, level, selectedRole, '', industry, company);
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
                        executeSearch(query, location, '', level, selectedRole, remote, industry, company);
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
                        executeSearch(query, location, type, '', selectedRole, remote, industry, company);
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
                        executeSearch(query, location, type, level, selectedRole, remote, '', company);
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
              </motion.div>
            )}
          </motion.form>

          {/* Multi-Industry Quick Selection Bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="industry-showcase-container"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0 0.25rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  letterSpacing: '0.01em',
                }}
              >
                <Building2 size={13} style={{ color: 'var(--primary-start)' }} />
                <span>Explore by Industry:</span>
              </span>

              {industry && (
                <button
                  type="button"
                  onClick={() => {
                    setIndustry('');
                    executeSearch(query, location, type, level, selectedRole, remote, '', company);
                    scrollToResults();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary-start)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    textDecoration: 'underline',
                  }}
                >
                  <X size={12} />
                  <span>Show All Industries</span>
                </button>
              )}
            </div>

            <div className="industry-showcase-wrapper">
              <button
                type="button"
                onClick={() => scrollIndustryRail('left')}
                className="industry-rail-nav-btn industry-rail-nav-btn-left"
                aria-label="Scroll industries left"
                title="Scroll left"
              >
                <ChevronLeft size={16} />
              </button>

              <div ref={industryRailRef} className="industry-showcase-pills">
                {INDUSTRY_OPTIONS.map((opt) => {
                  const isSelected = industry === opt.value;
                  return (
                    <button
                      key={opt.value || 'all'}
                      type="button"
                      onClick={() => {
                        const nextInd = isSelected ? '' : opt.value;
                        setIndustry(nextInd);
                        executeSearch(query, location, type, level, selectedRole, remote, nextInd, company);
                        scrollToResults();
                      }}
                      title={opt.value ? `Filter opportunities in ${opt.label}` : 'Show all industries'}
                      className={`industry-rail-pill ${isSelected ? 'is-active' : ''}`}
                    >
                      <span className="industry-rail-pill-icon">{opt.icon}</span>
                      <span>{opt.label}</span>
                      {isSelected && <Check size={12} color="var(--primary-start)" style={{ strokeWidth: 2.5 }} />}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollIndustryRail('right')}
                className="industry-rail-nav-btn industry-rail-nav-btn-right"
                aria-label="Scroll industries right"
                title="Scroll right"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>

          {/* Dynamic Popular Search Pills (Ranked by Average Daily Searches) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
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
                  className={`quick-pill-btn ${isSelected ? 'is-selected' : ''}`}
                >
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </motion.div>
        </section>

        {/* Results Header & Grid Section Anchor */}
        <section
          ref={resultsSectionRef}
          id="search-results-section"
          tabIndex={-1}
          className={`search-results-section ${isResultsFocused ? 'results-focused-glow' : ''}`}
          style={{
            scrollMarginTop: '90px',
            outline: 'none',
            position: 'relative',
          }}
          aria-label="Search results and opportunities feed"
        >
          {/* Results Header Toolbar (World-class Responsive Command Bar) */}
          {!loading && (activeView === 'saved' ? savedJobs.length > 0 : (searched && displayedJobs.length > 0)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="results-header-toolbar"
            >
              {/* Primary Top Bar: Feed Headline, Live Telemetry Pill & Mode Switcher */}
              <div className="results-bar-header">
                <div className="results-bar-title-group">
                  <h3 className="results-heading">
                    {activeView === 'saved' ? (
                      `${savedJobs.length} Saved Positions`
                    ) : (
                      displayedJobs.length > JOBS_BATCH_SIZE
                        ? `Showing ${visibleJobs.length} of ${displayedJobs.length.toLocaleString()} Verified Positions`
                        : `${displayedJobs.length.toLocaleString()} Verified Positions`
                    )}
                  </h3>

                  {isResultsFocused && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.88, y: -2 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      className="results-focus-clue-badge"
                      title="Content section in focus"
                      role="status"
                      aria-live="polite"
                    >
                      <ArrowDown size={11} strokeWidth={2.5} />
                      <span>{tabFocusBadge || 'Content in Focus'}</span>
                    </motion.span>
                  )}

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

                  {/* Autoload status indicator is rendered in the utility row below for clean horizontal balance */}
                </div>

                {/* Primary Mode Switcher: Live Roles vs Curated Tracks */}
                {activeView !== 'saved' && (
                  <div className="results-mode-switcher" role="tablist" aria-label="Feed display mode">
                    <button
                      type="button"
                      role="tab"
                      id="tab-mode-feed"
                      aria-selected={activeDiscoveryTab === 'feed'}
                      aria-controls="panel-mode-feed"
                      tabIndex={activeDiscoveryTab === 'feed' ? 0 : -1}
                      onClick={() => handleDiscoveryTabSelect('feed')}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                          e.preventDefault();
                          handleDiscoveryTabSelect('tracks');
                        }
                      }}
                      className={`results-mode-btn ${activeDiscoveryTab === 'feed' ? 'is-active' : ''}`}
                    >
                      <Zap size={13} />
                      <span>Live Roles</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tab-mode-tracks"
                      aria-selected={activeDiscoveryTab === 'tracks'}
                      aria-controls="panel-mode-tracks"
                      tabIndex={activeDiscoveryTab === 'tracks' ? 0 : -1}
                      onClick={() => handleDiscoveryTabSelect('tracks')}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                          e.preventDefault();
                          handleDiscoveryTabSelect('feed');
                        }
                      }}
                      className={`results-mode-btn ${activeDiscoveryTab === 'tracks' ? 'is-active' : ''}`}
                    >
                      <Compass size={13} />
                      <span>Curated Tracks (12)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Utility Sub-Bar: Filter Actions, Auto-load Pill & Sort Controls */}
              <div className="results-bar-controls">
                <div className="results-bar-actions-left">
                  {activeView === 'saved' ? (
                    <button
                      type="button"
                      onClick={() => handleViewSelect('all')}
                      className="btn-secondary results-action-btn"
                    >
                      <ArrowLeft size={13} />
                      <span>Back to All Roles</span>
                    </button>
                  ) : (
                    <>
                      {(query || location || remote || selectedRole || type || level || industry || company) ? (
                        <div className="results-active-filters-wrap">
                          <button
                            type="button"
                            onClick={resetToDiscovery}
                            className="btn-secondary results-action-btn"
                            title="Reset search query and active filters"
                          >
                            <RotateCcw size={12} />
                            <span>Reset Feed</span>
                          </button>
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="results-clear-link"
                          >
                            Clear all filters
                          </button>
                        </div>
                      ) : (
                        <span className="results-stream-hint">
                          <span className="results-stream-dot" />
                          <span className="desktop-only">Direct ATS sync • Updated hourly • No middleman fees</span>
                          <span className="mobile-only">Direct ATS sync • Hourly updates</span>
                        </span>
                      )}

                      {displayedJobs.length > JOBS_BATCH_SIZE && (
                        <span className="autoload-scroll-pill" title="Scroll down to auto-load more verified openings">
                          <Zap size={11} />
                          <span>Auto-load active</span>
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Right: Sort Control Segmented Pill */}
                <div className="results-bar-sort-group">
                  <div className="results-sort-label">
                    <SlidersHorizontal size={13} />
                    <span>Sort:</span>
                  </div>
                  <div className="results-sort-segmented" role="radiogroup" aria-label="Sort listings">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={sortBy === 'relevance'}
                      onClick={() => handleSortSelect('relevance')}
                      className={`results-sort-btn ${sortBy === 'relevance' ? 'is-active' : ''}`}
                    >
                      <TrendingUp size={12} />
                      <span>Best Match</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={sortBy === 'date'}
                      onClick={() => handleSortSelect('date')}
                      className={`results-sort-btn ${sortBy === 'date' ? 'is-active' : ''}`}
                    >
                      <Clock size={12} />
                      <span>Freshest First</span>
                    </button>
                  </div>
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
            <div
              ref={savedContentRef}
              id="panel-mode-saved"
              role="tabpanel"
              aria-label="Saved roles"
              tabIndex={-1}
              className={`saved-jobs-view-panel ${isResultsFocused && activeView === 'saved' ? 'tab-panel-focused-glow' : ''}`}
              style={{ outline: 'none', scrollMarginTop: '100px' }}
            >
              {savedJobs.length === 0 ? (
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
                    onClick={() => handleViewSelect('all')}
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
                      <JobCard
                        key={job.id || `saved-${index}`}
                        job={job}
                        index={index}
                        onSelectCompany={handleSelectCompany}
                        onSelectIndustry={handleSelectIndustry}
                      />
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
              )}
            </div>
          ) : !searched || activeDiscoveryTab === 'tracks' ? (
            /* Curated Discovery Tracks View */
            <div
              ref={tracksContentRef}
              id="panel-mode-tracks"
              role="tabpanel"
              aria-labelledby="tab-mode-tracks"
              tabIndex={-1}
              className={`curated-tracks-view-panel ${isResultsFocused && activeDiscoveryTab === 'tracks' ? 'tab-panel-focused-glow' : ''}`}
              style={{ outline: 'none', marginTop: '0.5rem', paddingBottom: '3rem', scrollMarginTop: '100px' }}
            >
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
                    marginBottom: '0.75rem',
                  }}
                >
                  <Compass size={14} />
                  <span>Curated Discovery Tracks</span>
                </div>
                <h3 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Explore Opportunities Across Every Industry
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 640, margin: '0 auto', lineHeight: 1.55 }}>
                  Select a career sector to explore live verified positions from direct employer ATS and official job boards, or search specific keywords above.
                </p>
              </div>

              {/* 12-Card Domain Explorer Grid */}
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
          ) : displayedJobs.length === 0 ? (
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
          ) : (
            <div
              ref={feedContentRef}
              id="panel-mode-feed"
              role="tabpanel"
              aria-labelledby="tab-mode-feed"
              tabIndex={-1}
              className={`live-feed-view-panel ${isResultsFocused && activeDiscoveryTab === 'feed' ? 'tab-panel-focused-glow' : ''}`}
              style={{ outline: 'none', scrollMarginTop: '100px' }}
            >
              <div
                ref={jobGridRef}
                className="job-grid"
                style={{
                  overflowAnchor: 'auto',
                }}
              >
                {visibleJobs.map((job, index) => (
                  <JobCard
                    key={job.id || `job-${index}`}
                    job={job}
                    index={index}
                    onSelectCompany={handleSelectCompany}
                    onSelectIndustry={handleSelectIndustry}
                  />
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
            </div>
          )}
        </div>
        </section>

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
