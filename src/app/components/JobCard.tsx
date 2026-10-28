'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Calendar,
  Building2,
  ExternalLink,
  Share2,
  Check,
  Bookmark,
  Loader2,
  Lock,
  Flame,
  Banknote,
} from 'lucide-react';
import styles from './JobCard.module.css';
import { useAuth } from '../context/AuthContext';
import {
  ANONYMOUS_COMPANY_LABEL,
  ANONYMOUS_SOURCE_LABEL,
  isCompanyMasked,
  isValidApplicationUrl,
  getFallbackApplicationUrl,
} from '@/modules/jobs/domain/job.masking';
import {
  getRoleCategory,
  getContextualTagStyle,
  getWorkplaceBadge,
  getSeniorityBadge,
  getEmploymentTypeBadge,
  getSourceBadge,
  type ContextualPalette,
} from '@/modules/jobs/presentation/job-contextual-styles';

const PALETTE_CLASSES: Record<ContextualPalette, string> = {
  rose: styles.paletteRose,
  cyan: styles.paletteCyan,
  indigo: styles.paletteIndigo,
  purple: styles.palettePurple,
  emerald: styles.paletteEmerald,
  amber: styles.paletteAmber,
  crimson: styles.paletteCrimson,
  teal: styles.paletteTeal,
  sky: styles.paletteSky,
  lime: styles.paletteLime,
  gold: styles.paletteGold,
  india: styles.paletteIndia,
};

interface JobCardProps {
  job: {
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
  };
  index: number;
}

export default function JobCard({ job, index }: JobCardProps) {
  const { isAuthenticated, isJobSaved, toggleSaveJob, openAuthModal, showToast } = useAuth();
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>(job.url || '');
  const [resolvedCompany, setResolvedCompany] = useState<string>(job.company || '');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const isSaved = isJobSaved(job.id);

  // Keep state synchronized with parent prop updates (e.g., when auth status unmasks or masks jobs)
  useEffect(() => {
    if (!isAuthenticated) {
      setResolvedUrl('');
      setResolvedCompany(job.company || '');
    } else {
      if (job.url !== resolvedUrl) {
        setResolvedUrl(job.url || '');
      }
      if (job.company !== resolvedCompany) {
        setResolvedCompany(job.company || '');
      }
    }
  }, [job.url, job.company, isAuthenticated, resolvedUrl, resolvedCompany]);

  const effectiveUrl = isAuthenticated ? (resolvedUrl || job.url || '') : '';
  const isUrlValid = isValidApplicationUrl(effectiveUrl);

  // Mask company name on client as defense-in-depth, even though API boundary also shapes it
  const displayedCompany = isAuthenticated
    ? resolvedCompany && !isCompanyMasked(resolvedCompany)
      ? resolvedCompany
      : job.company && !isCompanyMasked(job.company)
        ? job.company
        : job.company || 'Not specified'
    : ANONYMOUS_COMPANY_LABEL;

  // Compute contextual visual tokens
  const roleCategory = useMemo(
    () => getRoleCategory(job.title, job.tags),
    [job.title, job.tags]
  );
  const RoleIcon = roleCategory.icon;

  const workplaceBadge = useMemo(
    () => getWorkplaceBadge(job.workplaceType, job.isRemote),
    [job.workplaceType, job.isRemote]
  );
  const WorkplaceIcon = workplaceBadge.icon;

  const seniorityBadge = useMemo(
    () => getSeniorityBadge(job.title, job.tags),
    [job.title, job.tags]
  );
  const SeniorityIcon = seniorityBadge ? seniorityBadge.icon : null;

  const employmentBadge = useMemo(
    () => getEmploymentTypeBadge(job.type),
    [job.type]
  );
  const EmploymentIcon = employmentBadge.icon;

  const sourceBadge = useMemo(
    () => getSourceBadge(job.source),
    [job.source]
  );
  const SourceIcon = sourceBadge.icon;

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(job.date);
      return isNaN(d.getTime())
        ? 'Recently'
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  }, [job.date]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      openAuthModal('🔒 Sign in to your account to reveal and copy direct ATS application links.', {
        type: 'apply',
        job,
        jobId: job.id,
        jobTitle: job.title,
        company: displayedCompany,
        url: effectiveUrl,
      });
      return;
    }

    let urlToCopy = effectiveUrl;
    if (!isValidApplicationUrl(urlToCopy) && job.id) {
      try {
        const res = await fetch(`/api/jobs?id=${encodeURIComponent(job.id)}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.job?.url && isValidApplicationUrl(data.job.url)) {
            urlToCopy = data.job.url;
            setResolvedUrl(urlToCopy);
            if (data.job.company) {
              setResolvedCompany(data.job.company);
            }
          }
        }
      } catch (err) {
        console.error('[JobCard] Failed to resolve URL for copy:', err);
      }
    }

    if (!isValidApplicationUrl(urlToCopy)) {
      urlToCopy = getFallbackApplicationUrl({
        title: job.title,
        company: displayedCompany,
        source: job.source,
        url: effectiveUrl,
      });
    }

    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      showToast('Application link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      showToast('Could not access clipboard.', 'error');
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaveJob(job);
  };

  const handleApplyClick = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. If not authenticated, open authentication modal with apply intent
    if (!isAuthenticated) {
      openAuthModal(
        '🔒 Sign in to your account to reveal employer details and direct ATS application.',
        {
          type: 'apply',
          job,
          jobId: job.id,
          jobTitle: job.title,
          company: displayedCompany,
          url: effectiveUrl,
        }
      );
      return;
    }

    // 2. If direct URL is already present and valid, open immediately
    if (isUrlValid) {
      window.open(effectiveUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // 3. Open a tab synchronously on user click to prevent popup blockers, then resolve URL
    const newTab = window.open('about:blank', '_blank');
    setIsResolving(true);

    try {
      let targetUrl = '';
      if (job.id) {
        const res = await fetch(`/api/jobs?id=${encodeURIComponent(job.id)}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.job?.url && isValidApplicationUrl(data.job.url)) {
            targetUrl = data.job.url;
            setResolvedUrl(targetUrl);
            if (data.job.company) {
              setResolvedCompany(data.job.company);
            }
          }
        }
      }

      if (targetUrl && isValidApplicationUrl(targetUrl)) {
        if (newTab) {
          newTab.location.href = targetUrl;
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
        showToast(`Opening application for "${job.title}"...`, 'success');
      } else {
        // Fall back to verified employer source portal rather than dead-end alert
        const fallbackUrl = getFallbackApplicationUrl({
          title: job.title,
          company: displayedCompany,
          source: job.source,
          url: effectiveUrl,
        });
        if (newTab) {
          newTab.location.href = fallbackUrl;
        } else {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }
        showToast(`Opening verified ${job.source || 'ATS'} application portal...`, 'info');
      }
    } catch (err) {
      console.error('[JobCard] URL resolution error:', err);
      const fallbackUrl = getFallbackApplicationUrl({
        title: job.title,
        company: displayedCompany,
        source: job.source,
        url: effectiveUrl,
      });
      if (newTab) {
        newTab.location.href = fallbackUrl;
      } else {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      }
      showToast(`Opening ${job.source || 'ATS'} portal...`, 'info');
    } finally {
      setIsResolving(false);
    }
  };

  const isFresh = Boolean(job.isFresh);
  const isInitialBatch = index < 18;

  return (
    <motion.div
      initial={isInitialBatch ? { opacity: 0, y: 16 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, delay: isInitialBatch ? Math.min((index % 18) * 0.03, 0.3) : 0, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5, scale: 1.01 }}
      className={styles.card}
      data-job-card-index={index + 1}
      onMouseMove={handleMouseMove}
    >
      {/* 1. Contextual Top Bar: Domain Pill (Left) & Actions (Right) */}
      <div className={styles.topBar}>
        <div className={`${styles.domainPill} ${PALETTE_CLASSES[roleCategory.palette]}`}>
          <span className={styles.domainIcon}>
            <RoleIcon size={12} strokeWidth={2.4} />
          </span>
          <span>{roleCategory.label}</span>
        </div>

        <div className={styles.topBarActions}>
          {isFresh && (
            <span className={styles.freshBadge} title="Published recently — Verified Active Role">
              <span className={styles.freshDot} />
              <Flame size={12} strokeWidth={2.4} />
              <span>FRESH</span>
            </span>
          )}

          {/* Bookmark / Save Job Button */}
          <button
            type="button"
            onClick={handleBookmarkClick}
            className={styles.iconBtn}
            aria-label={isSaved ? `Remove ${job.title} from saved jobs` : `Save ${job.title} to collection`}
            title={isSaved ? 'Job saved to your collection (Click to remove)' : 'Save job to your collection'}
            style={{
              color: isSaved ? '#10b981' : 'var(--text-secondary)',
              borderColor: isSaved ? 'rgba(16, 185, 129, 0.4)' : undefined,
              background: isSaved ? 'rgba(16, 185, 129, 0.12)' : undefined,
            }}
          >
            <motion.div
              key={isSaved ? 'saved' : 'unsaved'}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Bookmark
                size={16}
                strokeWidth={2.2}
                fill={isSaved ? '#10b981' : 'none'}
                color={isSaved ? '#10b981' : 'currentColor'}
              />
            </motion.div>
          </button>
        </div>
      </div>

      {/* 2. Header: Title & Company */}
      <div className={styles.header}>
        <h3 className={styles.title}>{job.title}</h3>
        {isAuthenticated ? (
          <div
            className={styles.company}
            title={displayedCompany ? `Company: ${displayedCompany}` : 'Company'}
            aria-label={displayedCompany ? `Company: ${displayedCompany}` : 'Company'}
          >
            <span className={styles.companyIconWrapper}>
              <Building2 size={13} strokeWidth={2.2} />
            </span>
            <span>{displayedCompany}</span>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => openAuthModal('🔒 Sign in to reveal employer details.')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openAuthModal('🔒 Sign in to reveal employer details.');
              }
            }}
            className={`${styles.company} ${styles.companyMaskedBtn}`}
            title="Sign in to reveal employer details"
            aria-label="Company hidden. Sign in to reveal employer."
          >
            <span className={`${styles.companyIconWrapper} ${styles.companyIconStealth}`}>
              <Lock size={12} strokeWidth={2.2} />
            </span>
            <div className={styles.companyMaskedContent}>
              <span className={styles.companyHiddenLabel}>Company hidden</span>
              <span className={styles.companyRevealPrompt}>Sign in to reveal employer</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Contextual Badges Row: Workplace, India, Seniority, Employment */}
      <div className={styles.badgesRow}>
        {/* Workplace Badge */}
        <span
          className={`${styles.contextualBadge} ${PALETTE_CLASSES[workplaceBadge.palette]}`}
          title={workplaceBadge.title}
        >
          <span className={styles.badgeIcon}>
            <WorkplaceIcon size={12} strokeWidth={2.2} />
          </span>
          <span>{workplaceBadge.label}</span>
        </span>

        {/* India Eligibility Badge */}
        {job.isIndiaEligible && (
          <span
            className={`${styles.contextualBadge} ${styles.paletteIndia}`}
            title="Open to applicants and engineers located in India"
          >
            <span style={{ fontSize: '0.82rem' }}>🇮🇳</span>
            <span>India Eligible</span>
          </span>
        )}

        {/* Seniority / Leadership Badge */}
        {seniorityBadge && SeniorityIcon && (
          <span
            className={`${styles.contextualBadge} ${PALETTE_CLASSES[seniorityBadge.palette]}`}
            title={seniorityBadge.title}
          >
            <span className={styles.badgeIcon}>
              <SeniorityIcon size={12} strokeWidth={2.2} />
            </span>
            <span>{seniorityBadge.label}</span>
          </span>
        )}

        {/* Employment Type Badge */}
        <span
          className={`${styles.contextualBadge} ${PALETTE_CLASSES[employmentBadge.palette]}`}
          title={employmentBadge.title}
        >
          <span className={styles.badgeIcon}>
            <EmploymentIcon size={12} strokeWidth={2.2} />
          </span>
          <span>{employmentBadge.label}</span>
        </span>

        {/* Verified Compensation / Salary Badge */}
        {job.salary && (
          <span
            className={`${styles.contextualBadge} ${styles.paletteEmerald}`}
            title={`Compensation: ${job.salary}`}
            style={{ fontWeight: 700 }}
          >
            <span className={styles.badgeIcon}>
              <Banknote size={12} strokeWidth={2.4} />
            </span>
            <span>{job.salary}</span>
          </span>
        )}
      </div>

      {/* 4. Metadata: Location & Date with Micro-Icon Wrappers */}
      <div className={styles.meta}>
        <div className={styles.metaItem} title={`Location: ${job.location}`}>
          <span className={styles.metaIconWrapper}>
            <MapPin size={12} strokeWidth={2.2} />
          </span>
          <span>{job.location}</span>
        </div>

        <div className={styles.metaItem} title="Publication date">
          <span className={styles.metaIconWrapper}>
            <Calendar size={12} strokeWidth={2.2} />
          </span>
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* 5. Contextual Tags with Tailored Icons and Distinct Contextual Colors */}
      <div className={styles.tags}>
        {job.tags &&
          job.tags.slice(0, 4).map((tag, i) => {
            const tagStyle = getContextualTagStyle(tag);
            const TagIcon = tagStyle.icon;
            return (
              <span
                key={i}
                className={`${styles.contextualTag} ${PALETTE_CLASSES[tagStyle.palette]}`}
                title={`Topic: ${tag}`}
              >
                <TagIcon size={11} strokeWidth={2.2} />
                <span>{tag}</span>
              </span>
            );
          })}
      </div>

      {/* 6. Footer Actions: Branded Source Badge & Apply Actions */}
      <div className={styles.actions}>
        {isAuthenticated ? (
          <div
            className={`${styles.sourceBadge} ${PALETTE_CLASSES[sourceBadge.palette]}`}
            title={sourceBadge.title}
          >
            <SourceIcon size={13} strokeWidth={2.2} />
            <span>{sourceBadge.label}</span>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => openAuthModal('🔒 Sign in to reveal verified job source and provider details.')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openAuthModal('🔒 Sign in to reveal verified job source and provider details.');
              }
            }}
            className={`${styles.sourceBadge} ${styles.sourceBadgeMasked}`}
            title="Sign in to reveal job source"
            aria-label={`${ANONYMOUS_SOURCE_LABEL}. Sign in to reveal source.`}
          >
            <Lock size={11} strokeWidth={2.2} />
            <span>{ANONYMOUS_SOURCE_LABEL}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Share / Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={styles.iconBtn}
            title={isAuthenticated ? 'Copy direct application link' : 'Sign in to copy application link'}
            aria-label={isAuthenticated ? 'Copy job link' : 'Sign in to copy job link'}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <Check size={16} strokeWidth={2.5} color="#10b981" />
                </motion.div>
              ) : (
                <motion.div
                  key="share"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <Share2 size={15} strokeWidth={2} />
                </motion.div>
              )}
            </AnimatePresence>
            {copied && <span className={styles.tooltip}>Copied!</span>}
          </button>

          {/* Gated ATS Apply Link */}
          {isAuthenticated && isUrlValid ? (
            <motion.a
              href={effectiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
              title="Apply directly on employer ATS portal"
              aria-label={`Apply directly for ${job.title}`}
            >
              <span>Apply</span>
              <ExternalLink size={13} strokeWidth={2.2} />
            </motion.a>
          ) : (
            <motion.button
              type="button"
              onClick={handleApplyClick}
              disabled={isResolving}
              className="btn-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: isResolving ? 'wait' : 'pointer',
                border: 'none',
                opacity: isResolving ? 0.75 : 1,
              }}
              title={isAuthenticated ? 'Open official application' : 'Sign in to apply on employer ATS portal'}
              aria-label={`Apply for ${job.title}`}
            >
              {isResolving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Opening...</span>
                </>
              ) : (
                <>
                  <span>Apply</span>
                  <ExternalLink size={13} strokeWidth={2.2} />
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
