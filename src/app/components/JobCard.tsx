'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Building2, ExternalLink, Share2, Check, ShieldCheck, Zap, Lock } from 'lucide-react';
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
  const { user, openAuthModal } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleApplyClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal(
        `🔒 Sign in with your Gmail account to apply directly to ${job.title} at ${job.company}.`,
        {
          type: 'apply',
          jobTitle: job.title,
          company: job.company,
          url: job.url,
        }
      );
    }
  };

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

    if (!user) {
      openAuthModal(
        `🔒 Sign in with your Gmail account to copy and share direct ATS links.`,
        {
          type: 'apply',
          jobTitle: job.title,
          company: job.company,
          url: job.url,
        }
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(job.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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

        <div className={styles.badges}>
          {isFresh && (
            <span
              style={{
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#f472b6',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                padding: '0.2rem 0.55rem',
                borderRadius: 9999,
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Zap size={11} color="#f472b6" />
              New
            </span>
          )}

          <span
            className={styles.tag}
            style={{
              background: isRemote
                ? 'rgba(16, 185, 129, 0.14)'
                : isHybrid
                ? 'rgba(217, 70, 239, 0.14)'
                : 'rgba(245, 158, 11, 0.14)',
              color: isRemote ? '#34d399' : isHybrid ? '#e879f9' : '#fbbf24',
              borderColor: isRemote
                ? 'rgba(16, 185, 129, 0.35)'
                : isHybrid
                ? 'rgba(217, 70, 239, 0.35)'
                : 'rgba(245, 158, 11, 0.35)',
              fontWeight: 600,
              fontSize: '0.78rem',
            }}
          >
            {isRemote
              ? job.isIndiaEligible &&
                (job.location.toLowerCase().includes('india') ||
                  job.location.toLowerCase().includes('worldwide'))
                ? job.location.toLowerCase().includes('india')
                  ? '🇮🇳 Remote'
                  : '🌍 Remote'
                : '🏠 Remote'
              : isHybrid
              ? '🔄 Hybrid'
              : '🏢 On-site'}
          </span>

          <span
            className={styles.tag}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            {job.type}
          </span>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <MapPin size={14} color="var(--text-muted)" />
          <span>{job.location}</span>
        </div>
        <div className={styles.metaItem}>
          <Calendar size={14} color="var(--text-muted)" />
          <span>{job.date ? new Date(job.date).toLocaleDateString() : 'Active'}</span>
        </div>
      </div>

      <div className={styles.tags}>
        {job.tags.slice(0, 4).map((tag, i) => (
          <motion.span
            key={i}
            whileHover={{ scale: 1.05 }}
            className={styles.tag}
          >
            {tag}
          </motion.span>
        ))}
      </div>

      <div className={styles.actions}>
        <div className={styles.sourceBadge} title={`Verified public feed from ${job.source}`}>
          <ShieldCheck size={13} color="var(--accent-emerald)" />
          <span>{job.source}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleCopyLink}
            className={styles.iconBtn}
            title={!user ? 'Sign in with Gmail to share direct ATS link' : 'Copy application link'}
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

          {user ? (
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
          ) : (
            <motion.button
              type="button"
              className="btn-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleApplyClick}
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.9))',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
              }}
              title="Sign in with your Gmail account to unlock direct ATS application"
            >
              <span>Apply (Sign In)</span>
              <Lock size={13} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
