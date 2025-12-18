'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Building2, ExternalLink } from 'lucide-react';
import styles from './JobCard.module.css';

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
    };
    index: number;
}

export default function JobCard({ job, index }: JobCardProps) {
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`${styles.card} glass-panel`}
            onMouseMove={handleMouseMove}
        >
            <div className={styles.header}>
                <div>
                    <h3 className={styles.title}>{job.title}</h3>
                    <div className={styles.company}>
                        <Building2 size={14} />
                        {job.company}
                    </div>
                </div>
                <span className={styles.tag} style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border)'
                }}>
                    {job.type}
                </span>
            </div>

            <div className={styles.meta}>
                <div className={styles.metaItem}>
                    <MapPin size={14} />
                    {job.location}
                </div>
                <div className={styles.metaItem}>
                    <Calendar size={14} />
                    {new Date(job.date).toLocaleDateString()}
                </div>
            </div>

            <div className={styles.tags}>
                {job.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className={styles.tag}>{tag}</span>
                ))}
            </div>

            <div className={styles.actions}>
                <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{
                        fontSize: '0.9rem',
                        padding: '0.5rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        textDecoration: 'none'
                    }}
                >
                    Apply on {job.source}
                    <ExternalLink size={14} />
                </a>
            </div>
        </motion.div>
    );
}
