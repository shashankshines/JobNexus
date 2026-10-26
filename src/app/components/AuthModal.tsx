'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, ArrowRight, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authPromptMessage,
    closeAuthModal,
    loginWithGmail,
  } = useAuth();

  const [customEmail, setCustomEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isAuthModalOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isAuthModalOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async (emailOverride?: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await loginWithGmail(emailOverride);
    } catch {
      setError('Unable to authenticate with Google. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim();
    if (!cleanEmail) {
      setError('Please provide your Gmail address.');
      return;
    }
    if (!cleanEmail.includes('@') && !cleanEmail.includes('.')) {
      handleGoogleSignIn(`${cleanEmail}@gmail.com`);
      return;
    }
    if (!cleanEmail.toLowerCase().endsWith('@gmail.com') && !cleanEmail.toLowerCase().endsWith('@googlemail.com')) {
      setError('Please provide a valid @gmail.com address.');
      return;
    }
    handleGoogleSignIn(cleanEmail);
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.2rem',
          backgroundColor: 'var(--modal-backdrop)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeAuthModal();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: 440,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--modal-bg)',
            border: '1px solid var(--modal-border)',
            borderRadius: 22,
            boxShadow: 'var(--shadow-lg), 0 0 35px rgba(99, 102, 241, 0.18)',
            position: 'relative',
          }}
        >
          {/* Subtle Top Glowing Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #ea4335, #4285f4, #34a853, transparent)',
            }}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
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
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--tag-bg)';
            }}
          >
            <X size={16} />
          </button>

          <div style={{ padding: '2.2rem 2.2rem 2rem', textAlign: 'center' }}>
            {/* Google G Logo Badge */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--tag-bg)',
                border: '1px solid var(--tag-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.6 7.2C.6 9.2 0 10.5 0 12.4s.6 3.2 1.6 5.2l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.8c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16.7C3.5 20.6 7.4 23.8 12 23.8z"
                />
              </svg>
            </div>

            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.45rem', lineHeight: 1.2 }}>
              Sign In with Google
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 340, margin: '0 auto 1.5rem' }}>
              Connect your Gmail account to access verified tech roles and direct ATS application links.
            </p>

            {/* Context Prompt Alert if triggered from gated action */}
            {authPromptMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  borderRadius: 12,
                  padding: '0.75rem 0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                }}
              >
                <ShieldCheck size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--primary)', lineHeight: 1.45, fontWeight: 500 }}>
                  {authPromptMessage}
                </span>
              </motion.div>
            )}

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 10,
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.82rem',
                  color: '#fca5a5',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  textAlign: 'left',
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </motion.div>
            )}

            {/* Primary Google / Gmail Sign-In CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleGoogleSignIn()}
              style={{
                width: '100%',
                padding: '0.92rem 1.4rem',
                borderRadius: 14,
                background: '#ffffff',
                color: '#1f2937',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.98rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.18s ease',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" color="#1f2937" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.6 7.2C.6 9.2 0 10.5 0 12.4s.6 3.2 1.6 5.2l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.8c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16.7C3.5 20.6 7.4 23.8 12 23.8z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight size={16} color="#6b7280" />
                </>
              )}
            </motion.button>

            {/* Custom Gmail Address Accordion Toggle */}
            <div style={{ marginTop: '1.25rem' }}>
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Use a specific @gmail.com address
                </button>
              ) : (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  onSubmit={handleCustomSubmit}
                  style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    textAlign: 'left',
                  }}
                >
                  <label htmlFor="gmail-input" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Enter your Gmail address:
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: 12,
                      padding: '0 0.85rem',
                    }}
                  >
                    <Mail size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                    <input
                      id="gmail-input"
                      type="text"
                      placeholder="username@gmail.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        padding: '0.75rem 0.6rem',
                        fontSize: '0.88rem',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                    style={{ padding: '0.65rem', fontSize: '0.86rem', borderRadius: 10 }}
                  >
                    <span>Sign In with This Gmail</span>
                    <ArrowRight size={14} />
                  </button>
                </motion.form>
              )}
            </div>

            {/* Verified Google Trust Footer */}
            <div
              style={{
                marginTop: '1.8rem',
                paddingTop: '1.2rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
              }}
            >
              <ShieldCheck size={14} color="#10b981" />
              <span>Direct Google OAuth verification • Zero passwords required</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
