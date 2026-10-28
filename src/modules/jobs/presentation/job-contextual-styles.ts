import React from 'react';
import {
  Palette,
  PenTool,
  Code2,
  Terminal,
  Server,
  Cpu,
  Database,
  Brain,
  Sparkles,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Compass,
  Target,
  Briefcase,
  Clock,
  Globe,
  Wifi,
  Building2,
  Building,
  GitFork,
  Users,
  Headphones,
  TrendingUp,
  Megaphone,
  Zap,
  Flame,
  Crown,
  Award,
  Star,
  GraduationCap,
  CheckCircle2,
  Layers,
  Tag,
  Hash,
  Boxes,
  Cloud,
  FileCode,
  type LucideIcon,
} from 'lucide-react';

export type ContextualPalette =
  | 'rose'
  | 'cyan'
  | 'indigo'
  | 'purple'
  | 'emerald'
  | 'amber'
  | 'crimson'
  | 'teal'
  | 'sky'
  | 'lime'
  | 'gold'
  | 'india';

export interface ContextualRoleInfo {
  category: string;
  label: string;
  icon: LucideIcon;
  palette: ContextualPalette;
}

export interface ContextualTagInfo {
  text: string;
  icon: LucideIcon;
  palette: ContextualPalette;
}

export interface ContextualBadgeInfo {
  label: string;
  icon: LucideIcon;
  palette: ContextualPalette;
  title?: string;
}

/**
 * Deterministically categorize a job into a high-demand professional domain
 * based on its title and tags.
 */
export function getRoleCategory(title: string, tags: string[] = []): ContextualRoleInfo {
  const titleLower = title.toLowerCase();
  const text = `${title} ${tags.join(' ')}`.toLowerCase();

  // 1. Direct Title-Based Role Classification (Priority)
  if (titleLower.includes('interior')) {
    return { category: 'architecture', label: 'Interior & Space', icon: Layers, palette: 'rose' };
  }
  if (titleLower.includes('graphic')) {
    return { category: 'graphics', label: 'Graphic Design', icon: PenTool, palette: 'rose' };
  }
  if (
    titleLower.includes('product manager') ||
    titleLower.includes('product management') ||
    titleLower.includes('product lead') ||
    titleLower.includes('product owner') ||
    titleLower.includes('head of product') ||
    titleLower.includes('group product')
  ) {
    return { category: 'product', label: 'Product Strategy', icon: Target, palette: 'purple' };
  }
  if (
    titleLower.includes('full-stack') ||
    titleLower.includes('fullstack') ||
    titleLower.includes('full stack')
  ) {
    return { category: 'fullstack', label: 'Full-Stack Dev', icon: Terminal, palette: 'indigo' };
  }
  if (
    titleLower.includes('frontend') ||
    titleLower.includes('front-end') ||
    titleLower.includes('ui engineer')
  ) {
    return { category: 'frontend', label: 'Frontend Dev', icon: Code2, palette: 'cyan' };
  }
  if (
    titleLower.includes('security') ||
    titleLower.includes('infosec') ||
    titleLower.includes('cyber') ||
    titleLower.includes('secops')
  ) {
    return { category: 'security', label: 'Security & Trust', icon: Shield, palette: 'crimson' };
  }
  if (
    titleLower.includes('ai ') ||
    titleLower.includes('machine learning') ||
    titleLower.includes('data scientist') ||
    titleLower.includes('ml scientist') ||
    titleLower.includes('data science')
  ) {
    return { category: 'ai_data', label: 'AI & Data Science', icon: Brain, palette: 'emerald' };
  }
  if (
    titleLower.includes('cloud') ||
    titleLower.includes('devops') ||
    titleLower.includes('sre') ||
    titleLower.includes('infrastructure') ||
    titleLower.includes('platform engineer')
  ) {
    return { category: 'cloud_infra', label: 'Cloud & Infrastructure', icon: Cloud, palette: 'sky' };
  }
  if (
    titleLower.includes('design') ||
    titleLower.includes('ux') ||
    titleLower.includes('visual designer')
  ) {
    return { category: 'design', label: 'Design & UX', icon: Palette, palette: 'rose' };
  }

  // 2. Secondary Comprehensive Text Scan (Title + Tags)
  if (
    text.includes('design') ||
    text.includes('ux') ||
    text.includes('ui/') ||
    text.includes('/ui') ||
    text.includes('ui designer') ||
    text.includes('figma') ||
    text.includes('creative') ||
    text.includes('visual')
  ) {
    return { category: 'design', label: 'Design & UX', icon: Palette, palette: 'rose' };
  }

  if (
    text.includes('product') ||
    text.includes('roadmap') ||
    text.includes('scrum') ||
    text.includes('edtech')
  ) {
    return { category: 'product', label: 'Product Strategy', icon: Target, palette: 'purple' };
  }

  if (
    text.includes('security') ||
    text.includes('infosec') ||
    text.includes('cyber') ||
    text.includes('secops') ||
    text.includes('compliance') ||
    text.includes('identity') ||
    text.includes('crypto')
  ) {
    return { category: 'security', label: 'Security & Trust', icon: Shield, palette: 'crimson' };
  }

  if (
    text.includes('ai ') ||
    text.includes('machine learning') ||
    text.includes('ml ') ||
    text.includes('llm') ||
    text.includes('nlp') ||
    text.includes('deep learning') ||
    text.includes('data science') ||
    text.includes('data engineer') ||
    text.includes('data analyst') ||
    text.includes('pytorch') ||
    text.includes('tensorflow')
  ) {
    return { category: 'ai_data', label: 'AI & Data Science', icon: Brain, palette: 'emerald' };
  }

  if (
    text.includes('devops') ||
    text.includes('sre') ||
    text.includes('cloud') ||
    text.includes('infrastructure') ||
    text.includes('kubernetes') ||
    text.includes('aws') ||
    text.includes('gcp') ||
    text.includes('terraform') ||
    text.includes('platform')
  ) {
    return { category: 'cloud_infra', label: 'Cloud & Infrastructure', icon: Cloud, palette: 'sky' };
  }

  if (
    text.includes('full-stack') ||
    text.includes('fullstack') ||
    text.includes('full stack')
  ) {
    return { category: 'fullstack', label: 'Full-Stack Dev', icon: Terminal, palette: 'indigo' };
  }

  if (
    text.includes('frontend') ||
    text.includes('front-end') ||
    text.includes('react') ||
    text.includes('next.js') ||
    text.includes('typescript') ||
    text.includes('javascript') ||
    text.includes('vue') ||
    text.includes('angular') ||
    text.includes('web developer')
  ) {
    return { category: 'frontend', label: 'Frontend Dev', icon: Code2, palette: 'cyan' };
  }

  if (
    text.includes('backend') ||
    text.includes('back-end') ||
    text.includes('golang') ||
    text.includes('python') ||
    text.includes('rust') ||
    text.includes('java ') ||
    text.includes('node') ||
    text.includes('database') ||
    text.includes('distributed systems') ||
    text.includes('kafka')
  ) {
    return { category: 'backend', label: 'Backend & Systems', icon: Server, palette: 'indigo' };
  }

  if (
    text.includes('marketing') ||
    text.includes('growth') ||
    text.includes('sales') ||
    text.includes('seo') ||
    text.includes('content') ||
    text.includes('copywriter') ||
    text.includes('social media')
  ) {
    return { category: 'marketing', label: 'Growth & Marketing', icon: TrendingUp, palette: 'amber' };
  }

  if (
    text.includes('support') ||
    text.includes('customer') ||
    text.includes('success') ||
    text.includes('operations') ||
    text.includes('client') ||
    text.includes('community')
  ) {
    return { category: 'support', label: 'Support & Success', icon: Headphones, palette: 'lime' };
  }

  if (
    text.includes('director') ||
    text.includes('vp') ||
    text.includes('vice president') ||
    text.includes('chief') ||
    text.includes('head of')
  ) {
    return { category: 'leadership', label: 'Executive Leadership', icon: Crown, palette: 'gold' };
  }

  return { category: 'tech', label: 'Tech & Engineering', icon: Zap, palette: 'indigo' };
}

/**
 * Deterministically match any tag with a contextual icon and vibrant colorway.
 */
export function getContextualTagStyle(tag: string): ContextualTagInfo {
  const t = tag.trim();
  const lower = t.toLowerCase();

  // Design / UX / Creative
  if (
    lower.includes('design') ||
    lower.includes('ux') ||
    lower.includes('ui') ||
    lower.includes('figma') ||
    lower.includes('art') ||
    lower.includes('creative') ||
    lower.includes('graphic') ||
    lower.includes('brand')
  ) {
    return { text: t, icon: Palette, palette: 'rose' };
  }

  // Remote / Distributed / WFH
  if (
    lower.includes('remote') ||
    lower.includes('distributed') ||
    lower.includes('wfh') ||
    lower.includes('anywhere') ||
    lower.includes('telecommute')
  ) {
    return { text: t, icon: Globe, palette: 'teal' };
  }

  // Product / Strategy / Agile
  if (
    lower.includes('product') ||
    lower.includes('scrum') ||
    lower.includes('agile') ||
    lower.includes('strategy') ||
    lower.includes('roadmap') ||
    lower.includes('edtech') ||
    lower.includes('fintech')
  ) {
    return { text: t, icon: Target, palette: 'purple' };
  }

  // Engineering / Frontend / Code
  if (
    lower.includes('program') ||
    lower.includes('code') ||
    lower.includes('frontend') ||
    lower.includes('react') ||
    lower.includes('next.js') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('css') ||
    lower.includes('html') ||
    lower.includes('vue') ||
    lower.includes('angular')
  ) {
    return { text: t, icon: Code2, palette: 'cyan' };
  }

  // Backend / Systems / Node / Go / Python
  if (
    lower.includes('backend') ||
    lower.includes('node') ||
    lower.includes('python') ||
    lower.includes('golang') ||
    lower.includes('go') ||
    lower.includes('rust') ||
    lower.includes('java') ||
    lower.includes('c++') ||
    lower.includes('sql') ||
    lower.includes('postgres') ||
    lower.includes('mongodb')
  ) {
    return { text: t, icon: Server, palette: 'indigo' };
  }

  // Security / Privacy / Compliance
  if (
    lower.includes('security') ||
    lower.includes('auth') ||
    lower.includes('cyber') ||
    lower.includes('infosec') ||
    lower.includes('privacy') ||
    lower.includes('crypto')
  ) {
    return { text: t, icon: Shield, palette: 'crimson' };
  }

  // Cloud / DevOps / Infra
  if (
    lower.includes('cloud') ||
    lower.includes('aws') ||
    lower.includes('gcp') ||
    lower.includes('azure') ||
    lower.includes('docker') ||
    lower.includes('kubernetes') ||
    lower.includes('k8s') ||
    lower.includes('devops') ||
    lower.includes('ci/cd')
  ) {
    return { text: t, icon: Cloud, palette: 'sky' };
  }

  // AI / ML / Data
  if (
    lower.includes('ai') ||
    lower.includes('ml') ||
    lower.includes('data') ||
    lower.includes('deep learning') ||
    lower.includes('llm') ||
    lower.includes('gpt') ||
    lower.includes('pytorch') ||
    lower.includes('analytics')
  ) {
    return { text: t, icon: Brain, palette: 'emerald' };
  }

  // Support / Customer / Operations
  if (
    lower.includes('support') ||
    lower.includes('customer') ||
    lower.includes('success') ||
    lower.includes('help') ||
    lower.includes('operations') ||
    lower.includes('service')
  ) {
    return { text: t, icon: Headphones, palette: 'lime' };
  }

  // Marketing / Sales / Growth
  if (
    lower.includes('market') ||
    lower.includes('growth') ||
    lower.includes('sales') ||
    lower.includes('seo') ||
    lower.includes('social') ||
    lower.includes('content')
  ) {
    return { text: t, icon: TrendingUp, palette: 'amber' };
  }

  // Fallback: Deterministic hashing into 8 vibrant palettes so NO tag is ever dull grey
  const PALETTES: ContextualPalette[] = [
    'cyan',
    'purple',
    'rose',
    'emerald',
    'amber',
    'indigo',
    'teal',
    'sky',
  ];
  let hash = 0;
  for (let i = 0; i < t.length; i++) {
    hash = (hash << 5) - hash + t.charCodeAt(i);
    hash |= 0;
  }
  const chosen = PALETTES[Math.abs(hash) % PALETTES.length];

  return {
    text: t,
    icon: Hash,
    palette: chosen,
  };
}

/**
 * Returns a contextual workplace badge (Remote, Hybrid, On-site).
 */
export function getWorkplaceBadge(
  workplaceType?: string,
  isRemote?: boolean
): ContextualBadgeInfo {
  const type = (workplaceType || '').toLowerCase();
  if (type === 'hybrid') {
    return {
      label: 'Hybrid',
      icon: GitFork,
      palette: 'purple',
      title: 'Flexible hybrid workplace (office + remote)',
    };
  }
  if (type === 'onsite' || type === 'on-site') {
    return {
      label: 'On-site',
      icon: Building,
      palette: 'sky',
      title: 'On-site presence required at office location',
    };
  }
  // Default to Remote if flagged
  return {
    label: 'Remote',
    icon: Globe,
    palette: 'teal',
    title: 'Work remotely with geographic flexibility',
  };
}

/**
 * Extracts seniority / leadership level if present in title or tags.
 */
export function getSeniorityBadge(title: string, tags: string[] = []): ContextualBadgeInfo | null {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();

  if (text.includes('principal')) {
    return { label: 'Principal', icon: Crown, palette: 'gold', title: 'Principal / Staff level role' };
  }
  if (text.includes('staff')) {
    return { label: 'Staff', icon: Crown, palette: 'gold', title: 'Staff engineer level role' };
  }
  if (text.includes('lead') || text.includes('tech lead')) {
    return { label: 'Lead', icon: Crown, palette: 'gold', title: 'Leadership / Lead role' };
  }
  if (text.includes('director') || text.includes('vp') || text.includes('head of')) {
    return { label: 'Director', icon: Award, palette: 'purple', title: 'Director / Executive level role' };
  }
  if (text.includes('senior') || text.includes('sr.') || text.includes('sr ')) {
    return { label: 'Senior', icon: Star, palette: 'indigo', title: 'Senior level engineering role' };
  }
  if (text.includes('junior') || text.includes('jr.') || text.includes('entry') || text.includes('associate')) {
    return { label: 'Junior', icon: GraduationCap, palette: 'emerald', title: 'Entry / Associate level role' };
  }
  if (text.includes('intern') || text.includes('internship')) {
    return { label: 'Intern', icon: GraduationCap, palette: 'cyan', title: 'Internship position' };
  }
  return null;
}

/**
 * Returns contextual employment type badge (Full Time, Contract, Part Time, etc.).
 */
export function getEmploymentTypeBadge(typeString: string): ContextualBadgeInfo {
  const t = (typeString || 'Full Time').toLowerCase();
  if (t.includes('contract') || t.includes('freelance')) {
    return { label: 'Contract', icon: Zap, palette: 'amber', title: 'Contract or freelance position' };
  }
  if (t.includes('part') || t.includes('part-time')) {
    return { label: 'Part Time', icon: Clock, palette: 'purple', title: 'Part-time opportunity' };
  }
  if (t.includes('intern')) {
    return { label: 'Internship', icon: GraduationCap, palette: 'cyan', title: 'Internship position' };
  }
  return { label: 'Full Time', icon: Briefcase, palette: 'indigo', title: 'Permanent full-time role' };
}

/**
 * Returns contextual source / ATS branding badge.
 */
export function getSourceBadge(sourceName: string): ContextualBadgeInfo {
  const s = (sourceName || 'ATS').toLowerCase();

  if (s.includes('hidden') || s.includes('undisclosed')) {
    return {
      label: 'Job source hidden',
      icon: Lock,
      palette: 'amber',
      title: 'Sign in to reveal job source and verified provider details',
    };
  }

  if (s.includes('ashby')) {
    return {
      label: 'Ashby ATS',
      icon: CheckCircle2,
      palette: 'purple',
      title: 'Verified direct employer ATS listing via Ashby',
    };
  }
  if (s.includes('greenhouse')) {
    return {
      label: 'Greenhouse ATS',
      icon: ShieldCheck,
      palette: 'emerald',
      title: 'Verified direct employer ATS listing via Greenhouse',
    };
  }
  if (s.includes('we work remotely') || s.includes('weworkremotely') || s.includes('wwr')) {
    return {
      label: 'We Work Remotely',
      icon: Globe,
      palette: 'teal',
      title: 'Verified public remote listing via We Work Remotely',
    };
  }
  if (s.includes('remoteok') || s.includes('remote ok')) {
    return {
      label: 'RemoteOK',
      icon: Zap,
      palette: 'indigo',
      title: 'Verified public tech listing via RemoteOK',
    };
  }
  if (s.includes('himalayas')) {
    return {
      label: 'Himalayas',
      icon: Compass,
      palette: 'amber',
      title: 'Verified remote opportunity via Himalayas',
    };
  }
  if (s.includes('arbeitnow')) {
    return {
      label: 'Arbeitnow',
      icon: Briefcase,
      palette: 'rose',
      title: 'Verified European / Global tech listing via Arbeitnow',
    };
  }
  if (s.includes('jobicy')) {
    return {
      label: 'Jobicy',
      icon: Sparkles,
      palette: 'purple',
      title: 'Verified remote role via Jobicy',
    };
  }
  if (s.includes('remotive')) {
    return {
      label: 'Remotive',
      icon: Compass,
      palette: 'sky',
      title: 'Verified tech listing via Remotive',
    };
  }
  if (s.includes('national career service') || s.includes('ncs')) {
    return {
      label: 'National Career Service',
      icon: ShieldCheck,
      palette: 'emerald',
      title: 'Verified Indian Government & PSU vacancy via National Career Service (NCS)',
    };
  }

  return {
    label: sourceName || 'Verified Source',
    icon: ShieldCheck,
    palette: 'emerald',
    title: `Verified listing from ${sourceName}`,
  };
}
