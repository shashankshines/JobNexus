'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
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
  Leaf,
} from 'lucide-react';
import JobCard from './components/JobCard';
import ThemeToggle from './components/ThemeToggle';
import FuturisticToast from './components/FuturisticToast';
import JobNexusLogo from './components/JobNexusLogo';
import { useAuth } from './context/AuthContext';
import { useJobStats } from '@/modules/jobs/hooks/useJobStats';
import { useElapsedJobCounter } from '@/modules/jobs/hooks/useElapsedJobCounter';
import {
  getIndustryLabel,
  INDUSTRY_TAXONOMY,
  normalizeIndustryFilter,
  type JobIndustry,
} from '@/modules/jobs/domain/job.taxonomy';
const PremiumOfferModal = dynamic(
  () => import('./components/PremiumOfferModal').then((mod) => mod.PremiumOfferModal),
  { ssr: false }
);

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes client cache
const SEARCH_PAGE_SIZE = 50;
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
  industry: JobIndustry;
  desc: string;
  tags: string[];
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
}

const INDUSTRY_DISCOVERY_DETAILS: Record<
  JobIndustry,
  Pick<DiscoveryDomain, 'desc' | 'tags' | 'icon'>
> = {
  technology: {
    desc: 'Software development, cloud systems, AI/ML, data engineering, cybersecurity, and IT operations.',
    tags: ['Full Stack', 'Cloud & DevOps', 'AI & ML', 'Cybersecurity'],
    icon: Code2,
  },
  healthcare: {
    desc: 'Physicians, registered nurses, clinical practice, pharmacy, and hospital healthcare teams.',
    tags: ['Nursing', 'Clinical Care', 'Pharmacy', 'Hospital Care'],
    icon: HeartPulse,
  },
  construction_trades: {
    desc: 'Civil construction, site supervision, electrical, plumbing, carpentry, and infrastructure.',
    tags: ['Civil Engineering', 'Site Engineer', 'Electrical', 'Trades'],
    icon: HardHat,
  },
  manufacturing: {
    desc: 'Plant operations, mechanical engineering, production supervision, and quality assurance.',
    tags: ['Mechanical', 'Plant Operations', 'Production', 'Quality Control'],
    icon: Factory,
  },
  logistics_transport: {
    desc: 'Supply chain management, warehouse operations, freight, transport, and fleet logistics.',
    tags: ['Supply Chain', 'Warehousing', 'Freight', 'Fleet Operations'],
    icon: Truck,
  },
  retail_sales: {
    desc: 'Store management, merchandising, account executives, business development, and retail.',
    tags: ['B2B Sales', 'Store Operations', 'Merchandising', 'Account Executive'],
    icon: ShoppingBag,
  },
  hospitality_tourism: {
    desc: 'Chefs, hotel managers, front office operations, catering, tourism, and guest services.',
    tags: ['Hotel Management', 'Culinary Arts', 'Catering', 'Guest Relations'],
    icon: UtensilsCrossed,
  },
  education: {
    desc: 'School teachers, university faculty, instructional design, and academic leadership.',
    tags: ['Teaching', 'Higher Education', 'Curriculum', 'Pedagogy'],
    icon: GraduationCap,
  },
  finance_accounting: {
    desc: 'Accounting, auditing, taxation, financial analysis, investment, and banking.',
    tags: ['Accounting', 'Audit & Tax', 'Financial Analyst', 'Corporate Finance'],
    icon: TrendingUp,
  },
  administration_hr: {
    desc: 'People operations, talent acquisition, office management, and executive administration.',
    tags: ['People Ops', 'Recruiting', 'Office Management', 'HR Partner'],
    icon: Users,
  },
  agriculture: {
    desc: 'Agronomy, farming, forestry, horticulture, livestock, and agricultural operations.',
    tags: ['Agronomy', 'Farming', 'Forestry', 'Horticulture'],
    icon: Leaf,
  },
  government_public: {
    desc: 'Civil services, public administration, humanitarian aid, and municipal policy.',
    tags: ['Civil Services', 'Public Policy', 'Humanitarian', 'Disaster Relief'],
    icon: Landmark,
  },
  customer_service: {
    desc: 'Customer care, technical helpdesk, client success, and contact center roles.',
    tags: ['Customer Success', 'Technical Support', 'Helpdesk', 'Client Care'],
    icon: Headphones,
  },
  security_facilities: {
    desc: 'Security, facilities operations, workplace safety, and building maintenance.',
    tags: ['Security', 'Facilities', 'Workplace Safety', 'Maintenance'],
    icon: ShieldCheck,
  },
  other: {
    desc: 'Cross-functional roles that do not have enough evidence for a specific industry.',
    tags: ['Cross-functional', 'General Roles', 'Other'],
    icon: Briefcase,
  },
};

const DISCOVERY_DOMAINS: DiscoveryDomain[] = Object.values(INDUSTRY_TAXONOMY).map(({ id }) => ({
  industry: id,
  ...INDUSTRY_DISCOVERY_DETAILS[id],
}));

const INDUSTRY_EMOJI: Record<JobIndustry, string> = {
  technology: '💻',
  healthcare: '🏥',
  construction_trades: '🏗️',
  manufacturing: '⚙️',
  logistics_transport: '🚚',
  retail_sales: '🛍️',
  hospitality_tourism: '🍽️',
  education: '🎓',
  finance_accounting: '📊',
  administration_hr: '📋',
  agriculture: '🌱',
  government_public: '🏛️',
  customer_service: '🎧',
  security_facilities: '🛡️',
  other: '📁',
};

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
  searchCount?: number;
  avgSearches?: number;
  formattedAverage?: string;
  trend?: 'hot' | 'rising' | 'steady';
}

interface SearchCriteria {
  query: string;
  role: string;
  company: string;
  location: string;
  type: string;
  level: string;
  remote: string;
  industry: string;
}

function getSearchCriteriaFromUrl(params: URLSearchParams): SearchCriteria {
  const rawIndustry = params.get('industry') || '';
  const normalizedIndustry = normalizeIndustryFilter(rawIndustry);
  return {
    query: params.get('query') || '',
    role: params.get('role') || '',
    company: params.get('company') || '',
    location: params.get('location') || '',
    type: params.get('type') || '',
    level: params.get('level') || '',
    remote: params.get('remote') || '',
    industry: normalizedIndustry === null ? rawIndustry : normalizedIndustry,
  };
}

function getSearchCriteriaSummary(criteria: SearchCriteria): string {
  const role = JOB_POST_GROUPS.flatMap((group) => group.posts)
    .find((post) => post.value === criteria.role)?.label || criteria.role;
  const workplace = WORKPLACE_OPTIONS.find((option) => option.value === criteria.remote)?.label;
  const jobType = TYPE_OPTIONS.find((option) => option.value === criteria.type)?.label;
  const seniority = LEVEL_OPTIONS.find((option) => option.value === criteria.level)?.label;

  return [
    criteria.industry ? getIndustryLabel(criteria.industry) : '',
    criteria.location,
    workplace,
    jobType,
    seniority,
    role,
    criteria.company,
    criteria.query ? `“${criteria.query}”` : '',
  ].filter(Boolean).join(' · ');
}

function hasActiveSearchCriteria(criteria: SearchCriteria): boolean {
  return Object.values(criteria).some((value) => Boolean(value && value !== 'all'));
}

function getClientSearchCacheKey(params: URLSearchParams, isAuthenticated: boolean): string {
  const entries = Array.from(params.entries()).sort(
    ([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB)
  );
  return `${new URLSearchParams(entries).toString()}::auth=${isAuthenticated ? '1' : '0'}`;
}

interface CachedSearchResult {
  jobs: Job[];
  count: number;
  totalAvailable: number;
  snapshotId: string;
  truncated: boolean;
  page: number;
  timestamp: number;
}

const DEFAULT_POPULAR_PILLS: QuickPill[] = [
  { id: 'full-stack-developer', label: '⚡ Full Stack Developer', query: 'Full Stack Developer', avgSearches: 140, formattedAverage: '140/day', trend: 'hot' },
  { id: 'react-developer', label: '⚛️ React Developer', query: 'React Developer', avgSearches: 125, formattedAverage: '125/day', trend: 'hot' },
  { id: 'ai-machine-learning', label: '🤖 AI / Machine Learning Engineer', query: 'AI Machine Learning Engineer', avgSearches: 115, formattedAverage: '115/day', trend: 'rising' },
  { id: 'registered-nurse', label: '🏥 Registered Nurse', query: 'Registered Nurse', avgSearches: 100, formattedAverage: '100/day', trend: 'rising' },
  { id: 'accountant', label: '💰 Accountant', query: 'Accountant', avgSearches: 95, formattedAverage: '95/day', trend: 'rising' },
  { id: 'teacher', label: '🎓 Teacher', query: 'Teacher', avgSearches: 90, formattedAverage: '90/day', trend: 'rising' },
  { id: 'financial-analyst', label: '📊 Financial Analyst', query: 'Financial Analyst', avgSearches: 85, formattedAverage: '85/day', trend: 'steady' },
  { id: 'project-manager', label: '📋 Project Manager', query: 'Project Manager', avgSearches: 80, formattedAverage: '80/day', trend: 'steady' },
  { id: 'civil-engineer', label: '🏗️ Civil Engineer', query: 'Civil Engineer', avgSearches: 75, formattedAverage: '75/day', trend: 'rising' },
  { id: 'customer-support', label: '🎧 Customer Support Representative', query: 'Customer Support Representative', avgSearches: 70, formattedAverage: '70/day', trend: 'steady' },
  { id: 'marketing-specialist', label: '📣 Marketing Specialist', query: 'Marketing Specialist', avgSearches: 65, formattedAverage: '65/day', trend: 'steady' },
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
  ...Object.values(INDUSTRY_TAXONOMY).map((industry) => ({
    value: industry.id,
    label: industry.label,
    icon: INDUSTRY_EMOJI[industry.id],
  })),
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
  const {
    formattedCount,
    sourcesCount,
    error: inventoryStatsError,
  } = useJobStats();
  const globalInventorySummary = inventoryStatsError
    ? formattedCount === 'Unavailable'
      ? 'Job feed unavailable'
      : `Last available feed snapshot: ${formattedCount} jobs (refresh failed)`
    : formattedCount === 'Loading'
      ? 'Job feed loading'
      : `${formattedCount} jobs in the current JobNexus feed`;
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
  const [appliedSortBy, setAppliedSortBy] = useState<'relevance' | 'date'>('relevance');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matchingCount, setMatchingCount] = useState(0);
  const [totalAvailableJobs, setTotalAvailableJobs] = useState(0);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [appliedSearchCriteria, setAppliedSearchCriteria] = useState<SearchCriteria>({
    query: '',
    role: '',
    company: '',
    location: '',
    type: '',
    level: '',
    remote: '',
    industry: '',
  });
  const [pendingSearchCriteria, setPendingSearchCriteria] = useState<SearchCriteria | null>(null);
  const [searchError, setSearchError] = useState('');
  const [failedSearch, setFailedSearch] = useState<{
    criteria: SearchCriteria;
    sort: 'relevance' | 'date';
  } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Progressive Chunk Lazy Loading (Infinite Scroll) state
  const JOBS_BATCH_SIZE = 18;
  const [visibleCount, setVisibleCount] = useState(JOBS_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const paginationAbortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Popular Search Pills state (ranked by average searches)
  const [popularPills, setPopularPills] = useState<QuickPill[]>(DEFAULT_POPULAR_PILLS);
  const popularPillsUpdatedAtRef = useRef(0);

  // Suggestions state
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [activeJobSuggestionIndex, setActiveJobSuggestionIndex] = useState(-1);
  const [activeLocationSuggestionIndex, setActiveLocationSuggestionIndex] = useState(-1);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);

  // Refinement Filter Dropdowns state
  const [industry, setIndustry] = useState('');
  const draftSearchCriteria: SearchCriteria = {
    query: query.trim(),
    role: selectedRole.trim(),
    company: company.trim(),
    location: location.trim(),
    type: type.trim(),
    level: level.trim(),
    remote: remote.trim(),
    industry: industry.trim(),
  };
  const hasUnappliedDraft =
    Object.keys(draftSearchCriteria).some((key) => {
      const criterion = key as keyof SearchCriteria;
      return draftSearchCriteria[criterion] !== appliedSearchCriteria[criterion];
    }) || sortBy !== appliedSortBy;
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [roleDropdownPosition, setRoleDropdownPosition] = useState<React.CSSProperties | null>(null);
  const [roleDropdownIsMobile, setRoleDropdownIsMobile] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showWorkplaceDropdown, setShowWorkplaceDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Advanced Refinements Drawer state
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const locBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const headerBackdropRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownMenuRef = useRef<HTMLDivElement>(null);
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
  const clientSearchCacheRef = useRef<Map<string, CachedSearchResult>>(new Map());
  const activeSearchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const catalogWarmupStartedRef = useRef(false);

  useLayoutEffect(() => {
    if (!showRoleDropdown) return;

    const updatePosition = () => {
      const trigger = roleDropdownRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
      if (!trigger) return;

      const viewport = window.visualViewport;
      const mobile = window.matchMedia('(max-width: 640px)').matches;
      setRoleDropdownIsMobile(mobile);

      if (mobile) {
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const viewportOffsetTop = viewport?.offsetTop ?? 0;
        const keyboardOffset = Math.max(0, window.innerHeight - viewportOffsetTop - viewportHeight);
        setRoleDropdownPosition({
          position: 'fixed',
          top: 'auto',
          left: 12,
          right: 12,
          bottom: `calc(${keyboardOffset + 8}px + env(safe-area-inset-bottom, 0px))`,
          width: 'auto',
          maxHeight: Math.max(0, Math.min(560, viewportHeight - 24)),
          zIndex: 1001,
        });
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const desiredHeight = 380;
      const availableBelow = window.innerHeight - rect.bottom - 8;
      const availableAbove = rect.top - 8;
      const placeAbove = availableBelow < Math.min(280, desiredHeight) && availableAbove > availableBelow;
      const availableHeight = Math.max(0, placeAbove ? availableAbove : availableBelow);
      const maxHeight = Math.min(desiredHeight, availableHeight);
      const width = Math.max(0, Math.min(440, Math.max(rect.width, 320), window.innerWidth - 16));
      setRoleDropdownPosition({
        position: 'fixed',
        top: placeAbove ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
        zIndex: 1001,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [showRoleDropdown]);

  useEffect(() => {
    if (!showRoleDropdown || !roleDropdownIsMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showRoleDropdown, roleDropdownIsMobile]);

  useEffect(() => {
    if (isHeroPaused) return;
    const interval = setInterval(() => {
      setHeroWordIndex((prev) => (prev + 1) % HERO_ROTATING_WORDS.length);
    }, 3600);
    return () => clearInterval(interval);
  }, [isHeroPaused]);

  const currentHeroWord = HERO_ROTATING_WORDS[heroWordIndex];

  const applyPopularPills = useCallback((data: { pills?: QuickPill[]; lastUpdated?: string }) => {
    const rolePills = data.pills?.filter(
      (pill) => typeof pill.query === 'string' && pill.query.trim().length > 0
    );
    if (!rolePills?.length) return;

    const updatedAt = data.lastUpdated ? Date.parse(data.lastUpdated) : Date.now();
    if (Number.isFinite(updatedAt) && updatedAt < popularPillsUpdatedAtRef.current) return;
    if (Number.isFinite(updatedAt)) popularPillsUpdatedAtRef.current = updatedAt;

    setPopularPills(rolePills);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const dropdownRefs = [
        roleDropdownRef,
        companyDropdownRef,
        industryDropdownRef,
        workplaceDropdownRef,
        typeDropdownRef,
        levelDropdownRef,
      ];
      const triggerToRestore = dropdownRefs
        .map((ref) => ref.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]'))
        .find((trigger) => Boolean(trigger));

      setShowJobDropdown(false);
      setShowLocDropdown(false);
      setShowRoleDropdown(false);
      setShowCompanyDropdown(false);
      setShowIndustryDropdown(false);
      setShowWorkplaceDropdown(false);
      setShowTypeDropdown(false);
      setShowLevelDropdown(false);
      triggerToRestore?.focus();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const executeSearch = useCallback(
    async (
      criteria: SearchCriteria,
      options: {
        markSearched?: boolean;
        recordPopularity?: boolean;
        syncUrl?: boolean;
        sort?: 'relevance' | 'date';
        forceRefresh?: boolean;
      } = {}
    ) => {
      const normalizedIndustry = normalizeIndustryFilter(criteria.industry);
      const searchCriteria: SearchCriteria = {
        query: criteria.query.trim(),
        role: criteria.role.trim(),
        company: criteria.company.trim(),
        location: criteria.location.trim(),
        type: criteria.type.trim(),
        level: criteria.level.trim(),
        remote: criteria.remote.trim(),
        industry: normalizedIndustry === null ? criteria.industry.trim() : normalizedIndustry,
      };
      const markSearched = options.markSearched !== false;
      const selectedSort = options.sort ?? sortBy;

      if (markSearched) {
        setSearched(true);
      }
      setPendingSearchCriteria(searchCriteria);
      setSearchError('');
      setFailedSearch(null);
      setVisibleCount(JOBS_BATCH_SIZE);
      setIsLoadingMore(false);
      setShowJobDropdown(false);
      setShowLocDropdown(false);
      setShowRoleDropdown(false);
      setShowCompanyDropdown(false);
      setShowIndustryDropdown(false);
      setShowWorkplaceDropdown(false);
      setShowTypeDropdown(false);
      setShowLevelDropdown(false);

      const params = new URLSearchParams();
      if (searchCriteria.query) params.set('query', searchCriteria.query);
      if (searchCriteria.role) params.set('role', searchCriteria.role);
      if (searchCriteria.company) params.set('company', searchCriteria.company);
      if (searchCriteria.location) params.set('location', searchCriteria.location);
      if (searchCriteria.type) params.set('type', searchCriteria.type);
      if (searchCriteria.level) params.set('level', searchCriteria.level);
      if (searchCriteria.remote) params.set('remote', searchCriteria.remote);
      if (searchCriteria.industry && searchCriteria.industry !== 'all') {
        params.set('industry', searchCriteria.industry);
      }
      if (selectedSort === 'date') params.set('sort', selectedSort);

      const canonicalSearch = params.toString();
      const syncSearchUrl = () => {
        if (!markSearched || options.syncUrl === false || typeof window === 'undefined') return;
        const nextUrl = `${window.location.pathname}${canonicalSearch ? `?${canonicalSearch}` : ''}`;
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (nextUrl !== currentUrl) {
          window.history.pushState({ ...window.history.state, searchCriteria }, '', nextUrl);
        }
      };

      params.set('page', '1');
      params.set('pageSize', String(SEARCH_PAGE_SIZE));
      params.set('sort', selectedSort);
      const requestKey = params.toString();
      const cacheKey = getClientSearchCacheKey(params, isAuthenticated);
      const requestParams = new URLSearchParams(requestKey);
      if (options.forceRefresh) requestParams.set('refresh', '1');
      const popularityQuery = searchCriteria.query || searchCriteria.role;
      if (options.recordPopularity && popularityQuery.trim().length >= 2) {
        fetch('/api/jobs/popular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: popularityQuery }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
            const data = await response.json();
            if (data?.success) applyPopularPills(data);
          })
          .catch((error: unknown) => {
            console.warn('[Popular Searches] Unable to record search:', error);
          });
      }

      const requestId = ++searchRequestIdRef.current;
      activeSearchAbortRef.current?.abort();
      activeSearchAbortRef.current = null;
      paginationAbortRef.current = null;

      const cached = clientSearchCacheRef.current.get(cacheKey);
      if (!options.forceRefresh && cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
        syncSearchUrl();
        setJobs(cached.jobs);
        setMatchingCount(cached.count);
        setTotalAvailableJobs(cached.totalAvailable);
        setSearchTruncated(cached.truncated);
        setSearchPage(cached.page);
        setAppliedSearchCriteria(searchCriteria);
        setAppliedSortBy(selectedSort);
        setPendingSearchCriteria(null);
        setFailedSearch(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const abortController = new AbortController();
      activeSearchAbortRef.current = abortController;

      try {
        const res = await fetch(`/api/jobs?${requestParams.toString()}`, {
          cache: options.forceRefresh ? 'no-store' : 'default',
          signal: abortController.signal,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        if (requestId !== searchRequestIdRef.current) return;
        if (!Array.isArray(data.jobs)) {
          throw new Error('Search response did not contain a jobs array');
        }
        if (
          !Number.isSafeInteger(data.count) ||
          !Number.isSafeInteger(data.totalAvailable) ||
          data.totalAvailable < data.count ||
          data.count < data.jobs.length ||
          typeof data.snapshotId !== 'string' ||
          !/^[a-f0-9]{64}$/.test(data.snapshotId) ||
          data.returnedCount !== data.jobs.length ||
          data.page !== 1 ||
          data.pageSize !== SEARCH_PAGE_SIZE ||
          typeof data.hasMore !== 'boolean' ||
          !Number.isSafeInteger(data.providerCoverage?.configured) ||
          !Number.isSafeInteger(data.providerCoverage?.succeeded) ||
          data.providerCoverage.configured < 0 ||
          data.providerCoverage.succeeded < 0 ||
          data.providerCoverage.succeeded > data.providerCoverage.configured ||
          typeof data.providerCoverage?.incomplete !== 'boolean' ||
          typeof data.truncated !== 'boolean' ||
          data.truncated !== data.hasMore
        ) {
          throw new Error('Search response contained invalid result counts');
        }
        if (
          data.providerCoverage.configured === 0 ||
          data.providerCoverage.succeeded === 0
        ) {
          throw new Error('No configured job providers completed the search');
        }

        const count: number = data.count;
        const truncated: boolean = data.truncated;
        syncSearchUrl();
        setJobs(data.jobs);
        setMatchingCount(count);
        setTotalAvailableJobs(data.totalAvailable);
        setSearchTruncated(truncated);
        setSearchPage(data.page);
        setAppliedSearchCriteria(searchCriteria);
        setAppliedSortBy(selectedSort);
        setPendingSearchCriteria(null);
        setFailedSearch(null);
        clientSearchCacheRef.current.set(cacheKey, {
          jobs: data.jobs,
          count,
          totalAvailable: data.totalAvailable,
          snapshotId: data.snapshotId,
          truncated,
          page: data.page,
          timestamp: Date.now(),
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        if (requestId !== searchRequestIdRef.current) return;
        console.error('[Search Error]:', error);
        clientSearchCacheRef.current.delete(cacheKey);
        setJobs([]);
        setMatchingCount(0);
        setTotalAvailableJobs(0);
        setSearchTruncated(false);
        setSearchPage(0);
        setAppliedSearchCriteria(searchCriteria);
        setAppliedSortBy(selectedSort);
        setFailedSearch({ criteria: searchCriteria, sort: selectedSort });
        setSearchError('We could not complete this search. Please try again.');
        setPendingSearchCriteria(null);
      } finally {
        if (requestId === searchRequestIdRef.current && activeSearchAbortRef.current === abortController) {
          setLoading(false);
          activeSearchAbortRef.current = null;
        }
      }
    },
    [isAuthenticated, applyPopularPills, sortBy]
  );

  const loadNextSearchPage = useCallback(async () => {
    if (
      loading ||
      isLoadingMore ||
      paginationAbortRef.current ||
      !searchTruncated ||
      activeView !== 'all'
    ) return;

    const requestId = searchRequestIdRef.current;
    const page = searchPage + 1;
    const params = new URLSearchParams();
    if (appliedSearchCriteria.query) params.set('query', appliedSearchCriteria.query);
    if (appliedSearchCriteria.role) params.set('role', appliedSearchCriteria.role);
    if (appliedSearchCriteria.company) params.set('company', appliedSearchCriteria.company);
    if (appliedSearchCriteria.location) params.set('location', appliedSearchCriteria.location);
    if (appliedSearchCriteria.type) params.set('type', appliedSearchCriteria.type);
    if (appliedSearchCriteria.level) params.set('level', appliedSearchCriteria.level);
    if (appliedSearchCriteria.remote) params.set('remote', appliedSearchCriteria.remote);
    if (appliedSearchCriteria.industry && appliedSearchCriteria.industry !== 'all') {
      params.set('industry', appliedSearchCriteria.industry);
    }
    params.set('sort', appliedSortBy);
    const baseRequestKey = params.toString();
    params.set('page', String(page));
    params.set('pageSize', String(SEARCH_PAGE_SIZE));
    const firstPageParams = new URLSearchParams(baseRequestKey);
    firstPageParams.set('page', '1');
    firstPageParams.set('pageSize', String(SEARCH_PAGE_SIZE));
    const cacheKey = getClientSearchCacheKey(firstPageParams, isAuthenticated);
    const cached = clientSearchCacheRef.current.get(cacheKey);

    const abortController = new AbortController();
    paginationAbortRef.current = abortController;
    activeSearchAbortRef.current = abortController;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/jobs?${params.toString()}`, {
        signal: abortController.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);

      const data = await response.json();
      if (requestId !== searchRequestIdRef.current) return;
      if (
        !Array.isArray(data.jobs) ||
        !Number.isSafeInteger(data.count) ||
        !Number.isSafeInteger(data.totalAvailable) ||
        data.totalAvailable < data.count ||
        data.page !== page ||
        data.pageSize !== SEARCH_PAGE_SIZE ||
        data.count !== matchingCount ||
        data.totalAvailable !== totalAvailableJobs ||
        typeof data.snapshotId !== 'string' ||
        !/^[a-f0-9]{64}$/.test(data.snapshotId) ||
        data.snapshotId !== cached?.snapshotId ||
        data.returnedCount !== data.jobs.length ||
        typeof data.hasMore !== 'boolean' ||
        typeof data.providerCoverage?.incomplete !== 'boolean' ||
        data.truncated !== data.hasMore
      ) {
        throw new Error('The next page did not match the active search result snapshot');
      }

      const mergedJobs = [...(cached?.jobs ?? jobs)];
      const knownIds = new Set(mergedJobs.map((job) => job.id));
      for (const job of data.jobs as Job[]) {
        if (!knownIds.has(job.id)) {
          mergedJobs.push(job);
          knownIds.add(job.id);
        }
      }
      setJobs(mergedJobs);
      setMatchingCount(data.count);
      setTotalAvailableJobs(data.totalAvailable);
      setSearchTruncated(data.hasMore);
      setSearchPage(page);
      setSearchError('');
      clientSearchCacheRef.current.set(cacheKey, {
        jobs: mergedJobs,
        count: data.count,
        totalAvailable: data.totalAvailable,
        snapshotId: data.snapshotId,
        truncated: data.hasMore,
        page,
        timestamp: Date.now(),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (requestId !== searchRequestIdRef.current) return;
      console.error('[Search Pagination Error]:', error);
      setSearchError(
        error instanceof Error && error.message.includes('active search result snapshot')
          ? 'The results changed while loading more jobs. Your current results are still available.'
          : 'We could not load more jobs. Your current results are still available.'
      );
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsLoadingMore(false);
        if (activeSearchAbortRef.current === abortController) {
          activeSearchAbortRef.current = null;
        }
      }
      if (paginationAbortRef.current === abortController) {
        paginationAbortRef.current = null;
      }
    }
  }, [
    activeView,
    appliedSearchCriteria,
    isAuthenticated,
    isLoadingMore,
    jobs,
    loading,
    matchingCount,
    totalAvailableJobs,
    searchPage,
    searchTruncated,
    appliedSortBy,
  ]);

  const resetToDiscovery = useCallback(() => {
    searchRequestIdRef.current += 1;
    activeSearchAbortRef.current?.abort();
    activeSearchAbortRef.current = null;
    paginationAbortRef.current = null;
    setQuery('');
    setCompany('');
    setLocation('');
    setType('');
    setLevel('');
    setSelectedRole('');
    setRemote('');
    setIndustry('');
    setSortBy('relevance');
    setAppliedSortBy('relevance');
    setActiveView('all');
    setShowRoleDropdown(false);
    setShowCompanyDropdown(false);
    setShowIndustryDropdown(false);
    setShowWorkplaceDropdown(false);
    setShowTypeDropdown(false);
    setShowLevelDropdown(false);
    setShowAdvancedFilters(false);
    setShowJobDropdown(false);
    setShowLocDropdown(false);
    setRoleSearchQuery('');
    setCompanySearchQuery('');
    setJobs([]);
    setSearched(false);
    setMatchingCount(0);
    setTotalAvailableJobs(0);
    setSearchTruncated(false);
    setSearchPage(0);
    setIsLoadingMore(false);
    setAppliedSearchCriteria({
      query: '',
      role: '',
      company: '',
      location: '',
      type: '',
      level: '',
      remote: '',
      industry: '',
    });
    setPendingSearchCriteria(null);
    setSearchError('');
    setFailedSearch(null);
    setLoading(false);
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
          void executeSearch(appliedSearchCriteria, { markSearched: searched });
        }
      }
    }
  }, [isAuthenticated, searched, jobs.length, appliedSearchCriteria, executeSearch, resetToDiscovery]);

  // Seamlessly execute any search or application action triggered before login
  useEffect(() => {
    if (isAuthenticated && !intentProcessedRef.current) {
      const intent = consumePendingIntent();
      if (intent) {
        intentProcessedRef.current = true;
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
          };

          resumeApplyAction();
        } else if (intent.type === 'search') {
          const q = intent.query || '';
          const loc = intent.location || '';
          setQuery(q);
          if (loc) setLocation(loc);
        } else if (intent.type === 'pill') {
          const q = intent.query || '';
          setQuery(q);
        } else if (intent.type === 'domain') {
          const q = intent.query || '';
          const loc = intent.location || '';
          const rem = intent.remote || '';
          setQuery(q);
          setLocation(loc);
          setRemote(rem);
        } else if (intent.type === 'workplace') {
          const rem = intent.remote || '';
          setRemote(rem);
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

  // Keep the search trend strip synchronized without polling hidden tabs.
  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const refreshPopularPills = async () => {
      if (!active || requestInFlight || document.visibilityState === 'hidden') return;
      requestInFlight = true;
      try {
        const response = await fetch('/api/jobs/popular?limit=10', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
        const data = await response.json();
        if (active) applyPopularPills(data);
      } catch (error: unknown) {
        console.warn('[Popular Searches] Unable to refresh live searches:', error);
      } finally {
        requestInFlight = false;
      }
    };

    void refreshPopularPills();
    const pollTimer = window.setInterval(() => void refreshPopularPills(), 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshPopularPills();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyPopularPills]);

  // Load the discovery feed once; searches use complete server-filtered results.
  useEffect(() => {
    if (catalogWarmupStartedRef.current) return;
    catalogWarmupStartedRef.current = true;
    const urlParams = new URLSearchParams(window.location.search);
    const criteria = getSearchCriteriaFromUrl(urlParams);
    const initialSort = urlParams.get('sort') === 'date' ? 'date' : 'relevance';
    const hasFilters = hasActiveSearchCriteria(criteria);
    setQuery(criteria.query);
    setSelectedRole(criteria.role);
    setCompany(criteria.company);
    setLocation(criteria.location);
    setType(criteria.type);
    setLevel(criteria.level);
    setRemote(criteria.remote);
    setIndustry(criteria.industry);
    setSortBy(initialSort);
    void executeSearch(criteria, {
      markSearched: hasFilters,
      syncUrl: false,
      sort: initialSort,
    });
  }, [executeSearch]);

  useEffect(() => {
    const restoreSearchFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const criteria = getSearchCriteriaFromUrl(params);
      const restoredSort = params.get('sort') === 'date' ? 'date' : 'relevance';
      setQuery(criteria.query);
      setSelectedRole(criteria.role);
      setCompany(criteria.company);
      setLocation(criteria.location);
      setType(criteria.type);
      setLevel(criteria.level);
      setRemote(criteria.remote);
      setIndustry(criteria.industry);
      setSortBy(restoredSort);
      setActiveView('all');
      setActiveDiscoveryTab('feed');
      void executeSearch(criteria, {
        markSearched: hasActiveSearchCriteria(criteria),
        syncUrl: false,
        sort: restoredSort,
      });
    };

    window.addEventListener('popstate', restoreSearchFromUrl);
    return () => window.removeEventListener('popstate', restoreSearchFromUrl);
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
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(target) &&
        !roleDropdownMenuRef.current?.contains(target)
      ) {
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
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(performScroll);
    });
  }, []);

  const handleDiscoveryTabSelect = useCallback((targetTab: 'feed' | 'tracks') => {
    setActiveDiscoveryTab(targetTab);

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
  }, []);

  const handleSortSelect = useCallback((newSort: 'relevance' | 'date') => {
    setSortBy(newSort);
    if (activeView === 'all' && searched) {
      void executeSearch(appliedSearchCriteria, { sort: newSort });
    }
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
        } catch { }
      }
    }, 45);
  }, [activeView, appliedSearchCriteria, executeSearch, searched]);

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
        } catch { }
      }
    }, 45);
  }, []);

  const updateDraftSearchCriteria = (criteria: SearchCriteria) => {
    setQuery(criteria.query);
    setSelectedRole(criteria.role);
    setCompany(criteria.company);
    setLocation(criteria.location);
    setType(criteria.type);
    setLevel(criteria.level);
    setRemote(criteria.remote);
    setIndustry(criteria.industry);
  };

  const handleDomainClick = (domain: DiscoveryDomain) => {
    const criteria: SearchCriteria = {
      ...appliedSearchCriteria,
      query: '',
      role: '',
      industry: domain.industry ?? '',
    };
    updateDraftSearchCriteria(criteria);
    setActiveView('all');
    setActiveDiscoveryTab('feed');
    void executeSearch(criteria);
    scrollToResults();
  };

  const handleBrowseAllClick = () => {
    clearAllFilters();
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setActiveView('all');
    setActiveDiscoveryTab('feed');
    void executeSearch({
      query,
      role: selectedRole,
      company,
      location,
      type,
      level,
      remote,
      industry,
    }, { recordPopularity: true });
    scrollToResults();
  };

  const handleJobSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowJobDropdown(false);
    setActiveJobSuggestionIndex(-1);
  };

  const handleLocSuggestionClick = (loc: string) => {
    setLocation(loc);
    setShowLocDropdown(false);
    setActiveLocationSuggestionIndex(-1);
  };

  const handleRoleSelect = (roleVal: string) => {
    setSelectedRole(roleVal);
    setShowRoleDropdown(false);
    setRoleSearchQuery('');
    requestAnimationFrame(() => {
      roleDropdownRef.current
        ?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')
        ?.focus();
    });
    if (isRemoteRole(roleVal) && !remote) {
      setRemote('remote');
    }
  };

  const handleClearRole = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedRole('');
    setShowRoleDropdown(false);
    setRoleSearchQuery('');
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

  const appliedRoleLabel = useMemo(() => {
    if (!appliedSearchCriteria.role) return '';
    for (const group of JOB_POST_GROUPS) {
      const match = group.posts.find((post) => post.value === appliedSearchCriteria.role);
      if (match) return match.label;
    }
    return appliedSearchCriteria.role;
  }, [appliedSearchCriteria.role]);

  const appliedWorkplaceObj = useMemo(
    () => WORKPLACE_OPTIONS.find((opt) => opt.value === appliedSearchCriteria.remote) || WORKPLACE_OPTIONS[0],
    [appliedSearchCriteria.remote]
  );
  const appliedTypeObj = useMemo(
    () => TYPE_OPTIONS.find((opt) => opt.value === appliedSearchCriteria.type) || TYPE_OPTIONS[0],
    [appliedSearchCriteria.type]
  );
  const appliedLevelObj = useMemo(
    () => LEVEL_OPTIONS.find((opt) => opt.value === appliedSearchCriteria.level) || LEVEL_OPTIONS[0],
    [appliedSearchCriteria.level]
  );
  const appliedIndustryObj = useMemo(
    () => INDUSTRY_OPTIONS.find((opt) => opt.value === appliedSearchCriteria.industry) || INDUSTRY_OPTIONS[0],
    [appliedSearchCriteria.industry]
  );

  const handleSelectCompany = useCallback(
    (selectedComp: string) => {
      setCompany(selectedComp);
      setShowCompanyDropdown(false);
    },
    []
  );

  const handleSelectIndustry = useCallback(
    (selectedInd: string) => {
      const indVal = normalizeIndustryFilter(selectedInd);
      if (indVal !== null) setIndustry(indVal);
    },
    []
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

  const popularLocationOptions = useMemo(
    () => POPULAR_LOCATION_GROUPS.flatMap((group) => group.locations.map((item) => item.label)),
    []
  );
  const activeLocationOptions = location.trim() ? locationSuggestions : popularLocationOptions;

  const handleWorkplaceCategoryClick = (categoryRemoteParam: string) => {
    const criteria = { ...appliedSearchCriteria, remote: categoryRemoteParam };
    updateDraftSearchCriteria(criteria);
    setActiveView('all');
    setActiveDiscoveryTab('feed');
    void executeSearch(criteria);
    scrollToResults();
  };

  const handleQuickPillClick = (pill: QuickPill) => {
    const criteria: SearchCriteria = {
      ...appliedSearchCriteria,
      query: pill.query ?? '',
      role: '',
      industry: '',
    };
    updateDraftSearchCriteria(criteria);
    setActiveView('all');
    setActiveDiscoveryTab('feed');
    void executeSearch(criteria, { recordPopularity: true });
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
    setShowAdvancedFilters(false);
    setRoleSearchQuery('');
    setCompanySearchQuery('');
    setSortBy('relevance');
    setActiveView('all');
    setActiveDiscoveryTab('feed');
    void executeSearch({
      query: '',
      role: '',
      company: '',
      location: '',
      type: '',
      level: '',
      remote: '',
      industry: '',
    }, { sort: 'relevance' });
  };

  const removeAppliedFilter = (filter: keyof SearchCriteria) => {
    const remainingCriteria = { ...appliedSearchCriteria, [filter]: '' };
    updateDraftSearchCriteria(remainingCriteria);
    setActiveView('all');
    setActiveDiscoveryTab('feed');
    if (filter === 'query' && query === appliedSearchCriteria.query) setQuery('');
    if (filter === 'role' && selectedRole === appliedSearchCriteria.role) setSelectedRole('');
    if (filter === 'company' && company === appliedSearchCriteria.company) setCompany('');
    if (filter === 'location' && location === appliedSearchCriteria.location) setLocation('');
    if (filter === 'type' && type === appliedSearchCriteria.type) setType('');
    if (filter === 'level' && level === appliedSearchCriteria.level) setLevel('');
    if (filter === 'remote' && remote === appliedSearchCriteria.remote) setRemote('');
    if (filter === 'industry' && industry === appliedSearchCriteria.industry) setIndustry('');
    void executeSearch(remainingCriteria);
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
        return timeB - timeA || a.id.localeCompare(b.id);
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
  }, [query, company, location, type, level, selectedRole, remote, industry, sortBy, activeView]);

  // Clean up timer on unmount
  useEffect(() => {
    const timeoutId = loadingMoreTimeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => () => {
    searchRequestIdRef.current += 1;
    activeSearchAbortRef.current?.abort();
    paginationAbortRef.current?.abort();
  }, []);

  // Sliced jobs for progressive chunk lazy loading
  const visibleJobs = useMemo(() => {
    return displayedJobs.slice(0, visibleCount);
  }, [displayedJobs, visibleCount]);

  const hasMore =
    visibleCount < displayedJobs.length ||
    (activeView === 'all' && searchTruncated && !searchError);

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
    if (visibleCount >= displayedJobs.length) {
      void loadNextSearchPage();
      return;
    }

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
  }, [isLoadingMore, hasMore, visibleCount, displayedJobs.length, loadNextSearchPage]);

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
  };

  const handleFooterLocationClick = (locQuery: string, remoteVal = '') => {
    setActiveView('all');
    setLocation(locQuery);
    if (remoteVal) setRemote(remoteVal);
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
              key={searched ? `searched-${matchingCount}` : activeView === 'saved' ? `saved-${savedJobs.length}` : `total-${formattedCount}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`site-header-status ${isScrollingCards ? 'is-scrolling-cards' : ''}`}
              title={
                pendingSearchCriteria
                  ? `Refreshing results for ${getSearchCriteriaSummary(pendingSearchCriteria) || 'all industries'}; prior applied results are hidden.`
                  : isScrollingCards
                  ? `Scrolled through ${animatedElapsedCount} of ${displayedJobs.length.toLocaleString()} loaded matches (${Math.round(progressPercent)} viewed; ${matchingCount.toLocaleString()} total matches)`
                  : searched
                    ? `${matchingCount.toLocaleString()} matches for the current search; ${displayedJobs.length.toLocaleString()} matching jobs loaded. ${globalInventorySummary}`
                    : activeView === 'saved'
                      ? `${savedJobs.length} bookmarked tech opportunities`
                      : globalInventorySummary
              }
            >
              <span className={`site-header-radar ${isScrollingCards ? (isAllViewed ? 'is-complete' : 'is-scrolling') : ''}`} />
              <span>
                <span className="desktop-only">
                  {searched ? (
                    pendingSearchCriteria ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-label">Updating search</span>
                        <span className="count-secondary">{getSearchCriteriaSummary(pendingSearchCriteria) || 'All Industries'}</span>
                      </span>
                    ) : isScrollingCards ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{animatedElapsedCount}</span>
                        <span className="elapsed-counter-of">of</span>
                        <span className="elapsed-counter-total">{displayedJobs.length.toLocaleString()}</span>
                        <span className="elapsed-counter-label">Loaded Matches</span>
                        <span className="elapsed-counter-dot count-secondary">•</span>
                        <span className="elapsed-counter-verified count-secondary">
                          {isAllViewed ? (searchTruncated ? 'All Loaded Roles Viewed' : 'All Roles Viewed') : globalInventorySummary}
                        </span>
                      </span>
                    ) : (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{searchError ? '—' : matchingCount.toLocaleString()}</span>
                        <span className="elapsed-counter-label">{searchError ? 'Search unavailable' : 'Roles Matched'}</span>
                        <span className="elapsed-counter-dot count-secondary">•</span>
                        <span className="elapsed-counter-verified count-secondary">{globalInventorySummary}</span>
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
                      <span className="elapsed-counter-label">Global</span>
                      <span className="count-secondary">Provider Snapshot</span>
                    </span>
                  )}
                </span>
                <span className="mobile-only">
                  {searched ? (
                    pendingSearchCriteria ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-label">Updating</span>
                      </span>
                    ) : isScrollingCards ? (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{animatedElapsedCount}</span>
                        <span className="elapsed-counter-of">/</span>
                        <span className="elapsed-counter-total">{displayedJobs.length.toLocaleString()}</span>
                        <span className="elapsed-counter-label">Loaded</span>
                      </span>
                    ) : (
                      <span className="elapsed-counter-status">
                        <span className="elapsed-counter-num">{searchError ? '—' : matchingCount.toLocaleString()}</span>
                        <span className="elapsed-counter-label">{searchError ? 'Unavailable' : 'Matched'}</span>
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
                                className={`user-dropdown-role-badge ${isPremium
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
            key={searched ? `hero-searched-${matchingCount}` : `hero-total-${formattedCount}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="hero-ats-badge"
          >
            <Sparkles size={14} className="hero-ats-badge-icon" />
            <span className="hero-ats-badge-accent">
              {pendingSearchCriteria
                ? `Updating: ${getSearchCriteriaSummary(pendingSearchCriteria) || 'All Industries'}`
                : searched
                  ? searchError && failedSearch ? 'Search unavailable' : `${matchingCount.toLocaleString()} Matching Jobs`
                  : globalInventorySummary}
            </span>
            <span className="hero-ats-badge-bullet">•</span>
            <span className="hero-ats-badge-secondary">
              {pendingSearchCriteria
                ? `Last applied: ${getSearchCriteriaSummary(appliedSearchCriteria) || 'All Industries'}`
                : searched
                  ? searchError && failedSearch ? 'Search could not be completed' : `${displayedJobs.length.toLocaleString()} Loaded · ${globalInventorySummary}`
                  : `${sourcesCount || '—'} Configured Public Sources`}
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
                  role="combobox"
                  aria-label="Search jobs by role, skills, or company"
                  aria-autocomplete="list"
                  aria-expanded={showJobDropdown && jobSuggestions.length > 0}
                  aria-controls="job-suggestions-listbox"
                  aria-activedescendant={activeJobSuggestionIndex >= 0 ? `job-suggestion-${activeJobSuggestionIndex}` : undefined}
                  placeholder="Search role, skills, or company (e.g. React, Python, Staff)..."
                  value={query}
                  onFocus={() => {
                    setShowJobDropdown(true);
                    setActiveJobSuggestionIndex(-1);
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowJobDropdown(true);
                    setActiveJobSuggestionIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowJobDropdown(false);
                      setActiveJobSuggestionIndex(-1);
                    } else if (jobSuggestions.length > 0 && e.key === 'ArrowDown') {
                      e.preventDefault();
                      setShowJobDropdown(true);
                      setActiveJobSuggestionIndex((index) => Math.min(index + 1, jobSuggestions.length - 1));
                    } else if (jobSuggestions.length > 0 && e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveJobSuggestionIndex((index) => Math.max(index - 1, 0));
                    } else if (e.key === 'Enter' && activeJobSuggestionIndex >= 0) {
                      e.preventDefault();
                      handleJobSuggestionClick(jobSuggestions[activeJobSuggestionIndex]);
                    }
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
                      setActiveJobSuggestionIndex(-1);
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
                      id="job-suggestions-listbox"
                      role="listbox"
                      aria-label="Suggested roles"
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
                          id={`job-suggestion-${i}`}
                          role="option"
                          aria-selected={activeJobSuggestionIndex === i}
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
                            background: activeJobSuggestionIndex === i ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              activeJobSuggestionIndex === i ? 'rgba(99, 102, 241, 0.12)' : 'transparent';
                          }}
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
                  role="combobox"
                  aria-label="Search jobs by city, state, or country"
                  aria-autocomplete="list"
                  aria-expanded={showLocDropdown && activeLocationOptions.length > 0}
                  aria-controls="location-suggestions-listbox"
                  aria-activedescendant={activeLocationSuggestionIndex >= 0 ? `location-suggestion-${activeLocationSuggestionIndex}` : undefined}
                  placeholder="Search by Country or City"
                  value={location}
                  onFocus={() => {
                    setShowLocDropdown(true);
                    setActiveLocationSuggestionIndex(-1);
                  }}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setShowLocDropdown(true);
                    setActiveLocationSuggestionIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowLocDropdown(false);
                      setActiveLocationSuggestionIndex(-1);
                    } else if (activeLocationOptions.length > 0 && e.key === 'ArrowDown') {
                      e.preventDefault();
                      setShowLocDropdown(true);
                      setActiveLocationSuggestionIndex((index) =>
                        Math.min(index + 1, activeLocationOptions.length - 1)
                      );
                    } else if (activeLocationOptions.length > 0 && e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveLocationSuggestionIndex((index) => Math.max(index - 1, 0));
                    } else if (e.key === 'Enter' && activeLocationSuggestionIndex >= 0) {
                      e.preventDefault();
                      handleLocSuggestionClick(activeLocationOptions[activeLocationSuggestionIndex]);
                    }
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
                      setActiveLocationSuggestionIndex(-1);
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
                      id="location-suggestions-listbox"
                      role="listbox"
                      aria-label="Suggested locations"
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
                          <div key={gIdx} role="group" aria-label={group.group}>
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
                              const optionIndex = POPULAR_LOCATION_GROUPS
                                .slice(0, gIdx)
                                .reduce((count, previousGroup) => count + previousGroup.locations.length, 0) + i;
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
                                  id={`location-suggestion-${optionIndex}`}
                                  role="option"
                                  aria-selected={activeLocationSuggestionIndex === optionIndex}
                                  onClick={() => handleLocSuggestionClick(item.label)}
                                  style={{
                                    padding: '0.65rem 0.95rem',
                                    minHeight: roleDropdownIsMobile ? 44 : undefined,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.88rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.55rem',
                                    transition: 'background 0.15s ease',
                                    background: activeLocationSuggestionIndex === optionIndex ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                      activeLocationSuggestionIndex === optionIndex
                                        ? 'rgba(99, 102, 241, 0.12)'
                                        : 'transparent';
                                  }}
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
                                  id={`location-suggestion-${i}`}
                                  role="option"
                                  aria-selected={activeLocationSuggestionIndex === i}
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
                                    background: activeLocationSuggestionIndex === i ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                      activeLocationSuggestionIndex === i
                                        ? 'rgba(99, 102, 241, 0.12)'
                                        : 'transparent';
                                  }}
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
                onClick={scrollToResults}
                disabled={loading}
                aria-busy={loading}
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

            <p style={{ margin: '-0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Your selected criteria apply only after you click Search Jobs.
            </p>

            {/* Search refinements remain visible without an extra filter-toggle step. */}
            <div className="search-refinements">
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
                    {/* Role & Category Custom Dropdown */}
                    <div
                      ref={roleDropdownRef}
                      className="search-refinement-role"
                      style={{
                        position: 'relative',
                        flex: '1.1',
                        minWidth: 160,
                        order: 2,
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

                      {showRoleDropdown && roleDropdownPosition && typeof document !== 'undefined' && createPortal(
                        <>
                          {roleDropdownIsMobile && (
                            <motion.button
                              type="button"
                              aria-label="Close role and category options"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setShowRoleDropdown(false)}
                              style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 1000,
                                border: 0,
                                background: 'rgba(2, 6, 23, 0.48)',
                                touchAction: 'none',
                              }}
                            />
                          )}
                          <motion.div
                            ref={roleDropdownMenuRef}
                            onKeyDown={(event) => {
                              const options = roleDropdownMenuRef.current?.querySelectorAll<HTMLElement>('[data-role-option]');
                              if (!options?.length) return;
                              const activeOption = (event.target as HTMLElement).closest<HTMLElement>('[data-role-option]');
                              const activeIndex = activeOption ? Array.from(options).indexOf(activeOption) : -1;

                              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault();
                                const direction = event.key === 'ArrowDown' ? 1 : -1;
                                const nextIndex = activeIndex < 0
                                  ? (direction > 0 ? 0 : options.length - 1)
                                  : (activeIndex + direction + options.length) % options.length;
                                options[nextIndex]?.focus();
                              } else if (activeOption && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault();
                                activeOption.click();
                              }
                            }}
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
                              minWidth: roleDropdownIsMobile ? 0 : 320,
                              maxWidth: 'min(440px, calc(100vw - 2.5rem))',
                              maxHeight: 380,
                              zIndex: 250,
                              background: 'var(--dropdown-bg)',
                              border: '1px solid var(--border)',
                              boxShadow: 'var(--shadow-lg)',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              textAlign: 'left',
                              borderRadius: roleDropdownIsMobile ? 18 : 12,
                              ...roleDropdownPosition,
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
                                  minHeight: roleDropdownIsMobile ? 44 : undefined,
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
                                  autoFocus={!roleDropdownIsMobile}
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
                            <div
                              role="listbox"
                              aria-label="Job roles and categories"
                              style={{ overflowY: 'auto', minHeight: 0, flex: '1 1 auto', padding: '0.35rem 0' }}
                            >
                              {/* Reset / All Roles Option */}
                              <div
                                role="option"
                                aria-selected={selectedRole === ''}
                                tabIndex={0}
                                data-role-option
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
                                          role="option"
                                          aria-selected={isSelected}
                                          tabIndex={0}
                                          data-role-option
                                          onClick={() => handleRoleSelect(post.value)}
                                          style={{
                                            padding: '0.6rem 0.95rem 0.6rem 1.4rem',
                                            minHeight: roleDropdownIsMobile ? 44 : undefined,
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
                        </>,
                        document.body
                      )}
                    </div>

                    {/* Company Custom Dropdown */}
                    <div
                      ref={companyDropdownRef}
                      className="search-refinement-company"
                      style={{
                        position: 'relative',
                        display: showAdvancedFilters ? 'block' : 'none',
                        flex: showAdvancedFilters ? '1 1 100%' : '0 0 0',
                        minWidth: showAdvancedFilters ? '100%' : 0,
                        order: 6,
                        gridColumn: showAdvancedFilters ? '1 / -1' : undefined,
                      }}
                      id="advanced-company-filter"
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
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCompany('');
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
                        order: 1,
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
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIndustry('');
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
                      aria-hidden="true"
                      style={{
                        display: 'none',
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
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRemote('');
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
                        order: 3,
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
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setType('');
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
                        order: 4,
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
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLevel('');
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

                    <button
                      type="button"
                      aria-expanded={showAdvancedFilters}
                      aria-controls="advanced-company-filter"
                      onClick={() => setShowAdvancedFilters((current) => !current)}
                      style={{
                        order: 5,
                        background: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        color: 'var(--text-secondary)',
                        borderRadius: 10,
                        fontSize: '0.82rem',
                        padding: '0.62rem 0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <SlidersHorizontal size={14} />
                      <span>Advanced filters</span>
                      {company && (
                        <span
                          aria-label="1 active advanced filter"
                          style={{
                            minWidth: 18,
                            height: 18,
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(99, 102, 241, 0.18)',
                            color: 'var(--primary-start)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          1
                        </span>
                      )}
                    </button>

                    {/* Clear Filters CTA if active */}
                    {searched && (appliedSearchCriteria.query || appliedSearchCriteria.company || appliedSearchCriteria.location || appliedSearchCriteria.remote || appliedSearchCriteria.role || appliedSearchCriteria.type || appliedSearchCriteria.level || appliedSearchCriteria.industry) && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="search-refinement-reset"
                        style={{
                          order: 7,
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
            </div>

            {/* Active Filter Chips Bar */}
            {searched && (appliedSearchCriteria.query || appliedSearchCriteria.company || appliedSearchCriteria.location || appliedSearchCriteria.remote || appliedSearchCriteria.role || appliedSearchCriteria.type || appliedSearchCriteria.level || appliedSearchCriteria.industry) && (
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

                {appliedSearchCriteria.query && (
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
                    <span>&ldquo;{appliedSearchCriteria.query}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('query');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove keyword filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.company && (
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
                    <span>{appliedSearchCriteria.company}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('company');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove company filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.location && (
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
                    <span>{appliedSearchCriteria.location}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('location');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove location filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.role && (
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
                    <span>{appliedRoleLabel}</span>
                    <button
                      type="button"
                      onClick={() => removeAppliedFilter('role')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove role filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.remote && (
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
                    <span>{appliedWorkplaceObj.icon}</span>
                    <span>{appliedWorkplaceObj.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('remote');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove workplace filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.type && (
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
                    <span>{appliedTypeObj.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('type');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove employment type filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.level && (
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
                    <span>{appliedLevelObj.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('level');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      title="Remove seniority filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {appliedSearchCriteria.industry && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.22rem 0.6rem',
                      borderRadius: 9999,
                      background: 'var(--badge-cyan-bg)',
                      border: '1px solid var(--badge-cyan-border)',
                      color: 'var(--badge-cyan-text)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>{appliedIndustryObj.icon}</span>
                    <span>{appliedIndustryObj.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAppliedFilter('industry');
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
          {searchError && displayedJobs.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                marginBottom: '0.85rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.65rem',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                background: 'rgba(127, 29, 29, 0.12)',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
              }}
            >
              <span>{searchError} Your loaded results remain available.</span>
              {searchTruncated && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchError('');
                    void loadNextSearchPage();
                  }}
                  disabled={isLoadingMore}
                  style={{
                    marginLeft: '0.6rem',
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    color: 'var(--primary-start)',
                    font: 'inherit',
                    fontWeight: 650,
                    cursor: isLoadingMore ? 'wait' : 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {isLoadingMore ? 'Retrying…' : 'Retry loading more'}
                </button>
              )}
            </div>
          )}

          {(pendingSearchCriteria || inventoryStatsError || (hasUnappliedDraft && !searchError) || (searchTruncated && !pendingSearchCriteria && !searchError)) && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginBottom: '0.85rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                background: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--text-secondary)',
                fontSize: '0.86rem',
              }}
            >
              {pendingSearchCriteria && (
                <p style={{ margin: 0 }}>
                  Updating results for {getSearchCriteriaSummary(pendingSearchCriteria) || 'all industries'}.
                  {jobs.length > 0 && ` Previous results for ${getSearchCriteriaSummary(appliedSearchCriteria) || 'all industries'} are hidden until this search finishes.`}
                </p>
              )}
              {hasUnappliedDraft && !pendingSearchCriteria && !searchError && (
                <p style={{ margin: 0 }}>
                  Draft filters are not applied. The results below still use {getSearchCriteriaSummary(appliedSearchCriteria) || 'all industries'}.
                  Press Search Jobs to apply the selected controls.
                </p>
              )}
              {searchTruncated && !pendingSearchCriteria && !searchError && (
                <p style={{ margin: searchError || pendingSearchCriteria ? '0.35rem 0 0' : 0 }}>
                  {matchingCount.toLocaleString()} matching jobs in this search; {displayedJobs.length.toLocaleString()} are loaded. Scroll or choose “Load more” to continue.
                </p>
              )}
              {inventoryStatsError && (
                <p style={{ margin: '0.35rem 0 0' }}>
                  {globalInventorySummary}
                </p>
              )}
            </div>
          )}

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
                    ) : searchTruncated ? (
                      `Showing ${visibleJobs.length} of ${displayedJobs.length.toLocaleString()} loaded · ${matchingCount.toLocaleString()} matches`
                    ) : (
                      `Showing ${visibleJobs.length} of ${matchingCount.toLocaleString()} matching jobs`
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
                            <span className="count-main">{animatedElapsedCount} viewed · {matchingCount.toLocaleString()} matches</span>
                            <span className="count-secondary"> • {globalInventorySummary}</span>
                          </>
                        ) : (
                          <>
                            <span className="count-main">{matchingCount.toLocaleString()} matching jobs</span>
                            <span className="count-secondary"> • {globalInventorySummary}</span>
                          </>
                        )}
                      </span>
                      <span className="mobile-only">
                        {isScrollingCards
                          ? `${animatedElapsedCount}/${displayedJobs.length.toLocaleString()} viewed`
                          : `${matchingCount.toLocaleString()} matches`}
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
                      aria-checked={appliedSortBy === 'relevance'}
                      onClick={() => handleSortSelect('relevance')}
                      className={`results-sort-btn ${appliedSortBy === 'relevance' ? 'is-active' : ''}`}
                    >
                      <TrendingUp size={12} />
                      <span>Best Match</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={appliedSortBy === 'date'}
                      onClick={() => handleSortSelect('date')}
                      className={`results-sort-btn ${appliedSortBy === 'date' ? 'is-active' : ''}`}
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
                      <span>Browse Jobs</span>
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
                                Load more matching jobs
                              </span>
                            </motion.button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (!searched || activeDiscoveryTab === 'tracks') && !searchError ? (
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

                {/* Canonical industry discovery cards */}
                <div className="discovery-domain-grid">
                  {DISCOVERY_DOMAINS.map((domain) => {
                    const Icon = domain.icon;
                    return (
                      <motion.button
                        key={domain.industry}
                        type="button"
                        whileHover={{ y: -5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleDomainClick(domain)}
                        className="domain-card"
                        aria-label={`Explore ${INDUSTRY_TAXONOMY[domain.industry].label} jobs`}
                        style={{ textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
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
                            Explore jobs
                          </span>
                        </div>

                        <div>
                          <div className="domain-card-title">
                            <span>{INDUSTRY_TAXONOMY[domain.industry].label}</span>
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
                      </motion.button>
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
                      Browse available roles in the current JobNexus feed: {globalInventorySummary}.
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleBrowseAllClick}
                    className="btn-primary"
                    style={{ padding: '0.85rem 1.8rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
                  >
                    <span>Browse All Jobs</span>
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
                      { label: 'Technology Opportunities', icon: <Zap size={13} color="#38bdf8" /> },
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
            ) : searchError ? (
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
                <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Search temporarily unavailable</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                  The search could not be completed. Your search criteria have been kept; please try again.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (failedSearch) {
                      void executeSearch(failedSearch.criteria, {
                        sort: failedSearch.sort,
                        forceRefresh: true,
                      });
                    }
                  }}
                  disabled={!failedSearch || loading}
                  aria-busy={loading}
                  className="btn-primary"
                  style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  <span>{loading ? 'Retrying Search…' : 'Retry Search'}</span>
                </button>
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
                <h3 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>No matching jobs found</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                  No jobs matched {getSearchCriteriaSummary(appliedSearchCriteria) || 'your current search criteria'}. Try broadening your criteria or clearing a filter.
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
                      const criteria = { ...appliedSearchCriteria, remote: 'remote' };
                      updateDraftSearchCriteria(criteria);
                      setActiveView('all');
                      void executeSearch(criteria);
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
                            Load more matching jobs ({displayedJobs.length - visibleJobs.length} loaded)
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
                      <span>All {displayedJobs.length} Matching Jobs Loaded</span>
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
