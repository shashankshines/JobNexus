'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Filter, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import JobCard from './components/JobCard';
import { getSuggestions } from '@/utils/suggestions';
import { motion, AnimatePresence } from 'framer-motion';

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
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);

  // Debounced suggestion update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        setSuggestions(getSuggestions(query));
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);
    setSuggestions([]); // hide suggestions

    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (location) params.append('location', location);
      if (type) params.append('type', type);
      if (level) params.append('level', level);

      const res = await fetch(`/api/jobs?${params.toString()}`);
      const data = await res.json();

      if (data.jobs) {
        setJobs(data.jobs);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error(error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (s: string) => {
    setQuery(s);
    // trigger search immediately/soon? Better let user click btn
    setSuggestions([]);
  };

  return (
    <main className="container" style={{ minHeight: '100vh', paddingBottom: '4rem' }}>

      {/* Header */}
      <header style={{ padding: '2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary-start), var(--primary-end))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles color="white" size={24} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Job<span className="text-gradient">Nexus</span>
          </h1>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <a href="#" className="btn-secondary" style={{ border: 'none', background: 'transparent' }}>For Employers</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{ margin: '4rem 0', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.1 }}
        >
          Find your next <br />
          <span className="text-gradient">career defining role</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 600, margin: '0 auto 3rem' }}
        >
          Access global opportunities from trusted sources. No logins, no paywalls, just jobs.
        </motion.p>

        {/* Search Bar */}
        <motion.form
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSearch}
          className="glass-panel"
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: '1rem',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            position: 'relative' // For absolute positioning of suggestions
          }}
        >
          <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0 1rem' }}>
            <Search size={20} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Job title, keywords, or company"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '1rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '1rem'
              }}
            />
            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="glass-panel" style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                width: '100%',
                zIndex: 100,
                background: '#1e293b',
                flexDirection: 'column',
                display: 'flex',
                overflow: 'hidden'
              }}>
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      transition: '0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0 1rem' }}>
            <MapPin size={20} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="City, country, or remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '1rem',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ flex: 0.5, minWidth: 150, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0 0.5rem' }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', padding: '1rem 0.5rem', color: 'var(--text-secondary)', outline: 'none' }}
            >
              <option value="" style={{ background: '#1e293b' }}>Any Type</option>
              <option value="full time" style={{ background: '#1e293b' }}>Full Time</option>
              <option value="contract" style={{ background: '#1e293b' }}>Contract</option>
              <option value="part time" style={{ background: '#1e293b' }}>Part Time</option>
              <option value="freelance" style={{ background: '#1e293b' }}>Freelance</option>
              <option value="internship" style={{ background: '#1e293b' }}>Internship</option>
            </select>
          </div>

          <div style={{ flex: 0.5, minWidth: 150, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0 0.5rem' }}>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', padding: '1rem 0.5rem', color: 'var(--text-secondary)', outline: 'none' }}
            >
              <option value="" style={{ background: '#1e293b' }}>Any Level</option>
              <option value="entry" style={{ background: '#1e293b' }}>Entry Level</option>
              <option value="mid" style={{ background: '#1e293b' }}>Mid Level</option>
              <option value="senior" style={{ background: '#1e293b' }}>Senior</option>
              <option value="lead" style={{ background: '#1e293b' }}>Lead / Manager</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ height: 50, padding: '0 2rem' }}>
            {loading ? <Loader2 className="animate-spin" /> : 'Search'}
          </button>
        </motion.form>
      </section>

      {/* Results Section */}
      <div style={{ minHeight: 400 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <Loader2 size={48} className="animate-spin" color="var(--primary-start)" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Scanning trusted networks...</p>
          </div>
        ) : searched && jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem' }} className="animate-fade-in">
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', display: 'inline-flex', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <AlertCircle size={32} color="var(--error)" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>No active public listings found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>We couldn't verify any active public links for your criteria from our trusted sources.</p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => { setQuery(''); setLocation(''); }} className="btn-secondary">Clear Filters</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <AnimatePresence>
              {jobs.map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </main>
  );
}
