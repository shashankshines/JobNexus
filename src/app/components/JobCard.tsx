'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Calendar,
  Building2,
  ExternalLink,
  Share2,
  Check,
  ShieldCheck,
  Zap,
  Bookmark,
} from 'lucide-react';
import styles from './JobCard.module.css';
import { useAuth } from '../context/AuthContext';

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
  };
  index: number;
}

export default function JobCard({ job, index }: JobCardProps) {
  const { isJobSaved, toggleSaveJob } = useAuth();
  const [copied, setCopied] = useState(false);
  const isSaved = isJobSaved(job.id);

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

    try {
      await navigator.clipboard.writeText(job.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaveJob(job);
  };

  const isRemote = job.isRemote || job.workplaceType === 'remote';
  const isHybrid = job.workplaceType === 'hybrid';
  const isFresh = Boolean(job.isFresh);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5, scale: 1.01 }}
      className={styles.card}
      onMouseMove={handleMouseMove}
    >
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{job.title}</h3>
          <div className={styles.company}>
            <Building2 size={15} color="var(--primary-start)" />
            <span>{job.company}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {isFresh && (
            <span className={styles.freshBadge} title="Published within 48 hours">
              <Zap size={12} />
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
                fill={isSaved ? '#10b981' : 'none'}
                color={isSaved ? '#10b981' : 'currentColor'}
              />
            </motion.div>
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <MapPin size={14} />
          <span>{job.location}</span>
          {isRemote && <span className={`${styles.badge} ${styles.badgeRemote}`}>Remote</span>}
          {isHybrid && <span className={`${styles.badge} ${styles.badgeHybrid}`}>Hybrid</span>}
          {job.isIndiaEligible && (
            <span className={`${styles.badge} ${styles.badgeIndia}`} title="Open to engineers based in India">
              🇮🇳 India
            </span>
          )}
        </div>

        <div className={styles.metaItem}>
          <Calendar size={14} />
          <span>
            {(() => {
              try {
                const d = new Date(job.date);
                return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              } catch {
                return 'Recently';
              }
            })()}
          </span>
          <span className={styles.dot}>•</span>
          <span>{job.type}</span>
        </div>
      </div>

      <div className={styles.tags}>
        {job.tags &&
          job.tags.slice(0, 4).map((tag, i) => (
            <span key={i} className={styles.tag}>
              {tag}
            </span>
          ))}
      </div>

      <div className={styles.actions}>
        <div className={styles.sourceBadge} title={`Verified public feed from ${job.source}`}>
          <ShieldCheck size={13} color="var(--accent-emerald)" />
          <span>{job.source}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Share / Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={styles.iconBtn}
            title="Copy direct application link"
            aria-label="Copy job link"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <Check size={16} color="#10b981" />
                </motion.div>
              ) : (
                <motion.div
                  key="share"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <Share2 size={15} />
                </motion.div>
              )}
            </AnimatePresence>
            {copied && <span className={styles.tooltip}>Copied!</span>}
          </button>

          {/* Direct ATS Apply Link - Available to all users without forced login */}
          <motion.a
            href={job.url}
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
          >
            <span>Apply</span>
            <ExternalLink size={13} />
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
}
