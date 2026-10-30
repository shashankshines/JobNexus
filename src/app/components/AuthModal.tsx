'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, AuthMode } from '../context/AuthContext';
import {
  validatePassword,
  validateCredentialsSignIn,
  validateCredentialsSignUp,
  validatePasswordResetRequest,
  validatePasswordResetExecution,
} from '@/modules/jobs/domain/auth.validation';
import JobNexusLogo from './JobNexusLogo';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authMode,
    setAuthMode,
    authPromptMessage,
    closeAuthModal,
    pendingIntent,
    loginWithGoogle,
    loginWithCredentials,
    signUpWithCredentials,
    requestPasswordReset,
    resetPasswordWithCode,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthMode>(authMode || 'signin');
  const signinRef = useRef<HTMLDivElement>(null);
  const signupRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | 'auto'>('auto');

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Loading & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Privacy Policy & Terms Modal state
  const [showTermsModal, setShowTermsModal] = useState<'terms' | 'privacy' | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setActiveTab(authMode || 'signin');
      setError(null);
      setSuccessMessage(null);
      setIsSubmitting(false);
      setIsGoogleLoading(false);
      setForgotStep('request');
    }
  }, [isAuthModalOpen, authMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        if (showTermsModal) {
          setShowTermsModal(null);
        } else {
          closeAuthModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal, showTermsModal]);

  // Measure active tab height for smooth height transitions during sliding
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthModalOpen) return;

    const measureHeight = () => {
      const target = activeTab === 'signin' ? signinRef.current : signupRef.current;
      if (target && target.offsetHeight > 0) {
        setContainerHeight(target.offsetHeight);
      }
    };

    measureHeight();
    const rafId = requestAnimationFrame(measureHeight);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        measureHeight();
      });

      if (signinRef.current) ro.observe(signinRef.current);
      if (signupRef.current) ro.observe(signupRef.current);

      return () => {
        cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }

    return () => cancelAnimationFrame(rafId);
  }, [isAuthModalOpen, activeTab, error, successMessage, signUpPassword]);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const isGoogleOAuthConfigured = Boolean(
    googleClientId &&
    !googleClientId.includes('your-google-client-id') &&
    !googleClientId.includes('placeholder')
  );

  if (!isAuthModalOpen) return null;

  const handleTabSwitch = (newTab: AuthMode) => {
    setActiveTab(newTab);
    setAuthMode(newTab);
    setError(null);
    setSuccessMessage(null);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(newTab === 'signin' ? '#signin-email' : '#signup-name');
      input?.focus();
    }, 50);
  };

  // Google Sign-In click handler
  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      if (isGoogleOAuthConfigured) {
        if (pendingIntent && typeof window !== 'undefined') {
          sessionStorage.setItem('jn_pending_intent', JSON.stringify(pendingIntent));
        }
        // Direct OAuth 2.0 authorization code flow — bypasses Chrome FedCM AbortError completely
        window.location.href = '/api/auth/google';
        return;
      }

      await loginWithGoogle({ isDevDemo: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google authentication failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Credentials Sign In handler
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validation = validateCredentialsSignIn({
      usernameOrEmail: signInEmail,
      password: signInPassword,
    });

    if (!validation.valid || !validation.normalizedIdentifier) {
      setError(validation.error || 'Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithCredentials(validation.normalizedIdentifier, signInPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Credentials Sign Up handler
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validation = validateCredentialsSignUp({
      name: signUpName,
      usernameOrEmail: signUpEmail,
      password: signUpPassword,
      confirmPassword: signUpConfirmPassword,
    });

    if (!validation.valid || !validation.normalizedIdentifier) {
      setError(validation.error || 'Please review your registration details.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUpWithCredentials({
        name: validation.sanitizedName,
        usernameOrEmail: validation.normalizedIdentifier,
        password: signUpPassword,
        confirmPassword: signUpConfirmPassword,
        role: validation.role,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Forgot password request handler
  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validation = validatePasswordResetRequest(forgotEmail);
    if (!validation.valid || !validation.normalizedIdentifier) {
      setError(validation.error || 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(validation.normalizedIdentifier);
      setSuccessMessage(res.message);
      setForgotStep('verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send recovery code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset password execution handler
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validation = validatePasswordResetExecution({
      email: forgotEmail,
      code: recoveryCode,
      newPassword,
      confirmPassword: confirmNewPassword,
    });

    if (!validation.valid) {
      setError(validation.error || 'Please check code and matching passwords.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordWithCode(forgotEmail, recoveryCode, newPassword, confirmNewPassword);
      setSuccessMessage(res.message);
      setSignInEmail(forgotEmail);
      setTimeout(() => {
        handleTabSwitch('signin');
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please check your recovery code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passStrength = validatePassword(signUpPassword).strength;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          backgroundColor: 'var(--modal-backdrop, rgba(0, 0, 0, 0.65))',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeAuthModal();
        }}
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: 460,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--modal-bg, #111827)',
            border: '1px solid var(--modal-border, rgba(255, 255, 255, 0.12))',
            borderRadius: 22,
            boxShadow: 'var(--shadow-lg), 0 0 50px rgba(99, 102, 241, 0.2)',
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
              height: 3,
              background: 'linear-gradient(90deg, transparent, #6366f1, #38bdf8, transparent)',
            }}
          />

          {/* Back button when in forgot-password */}
          {activeTab === 'forgot-password' && (
            <button
              type="button"
              onClick={() => handleTabSwitch('signin')}
              aria-label="Back to sign in"
              style={{
                position: 'absolute',
                top: 18,
                left: 18,
                background: 'var(--tag-bg, rgba(255, 255, 255, 0.06))',
                border: '1px solid var(--tag-border, rgba(255, 255, 255, 0.1))',
                borderRadius: 10,
                padding: '0.4rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              background: 'var(--tag-bg, rgba(255, 255, 255, 0.06))',
              border: '1px solid var(--tag-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              zIndex: 10,
            }}
          >
            <X size={16} />
          </button>

          <div style={{ padding: '2.4rem 2rem 2rem' }}>
            {/* JobNexus Logo & Branding */}
            <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: 'none',
                  filter: 'none',
                }}
              >
                <JobNexusLogo variant="mark" size={40} priority />
              </div>

              {/* Exact Heading & Supporting Text styled with official JobNexus branding */}
              <h2
                id="auth-modal-title"
                style={{
                  fontSize: '1.55rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #ffffff)',
                  marginBottom: '0.3rem',
                  letterSpacing: '-0.025em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>Welcome to</span>
                <span className="auth-modal-brand-name" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span>Job</span>
                  <span className="text-gradient">Nexus</span>
                </span>
              </h2>
              <p
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #94a3b8)',
                  margin: '0 auto 0.6rem',
                }}
              >
                Discover • Apply • Grow
              </p>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  lineHeight: 1.45,
                  maxWidth: 320,
                  margin: '0 auto',
                }}
              >
                Sign in to save jobs and manage your job search.
              </p>
            </div>

            {/* Context Prompt Alert if triggered from gated action (e.g. Save Job) */}
            {authPromptMessage && activeTab !== 'forgot-password' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(99, 102, 241, 0.14)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: 12,
                  padding: '0.72rem 0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '1.25rem',
                }}
              >
                <Lock size={16} color="#818cf8" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary, #ffffff)', fontWeight: 500, lineHeight: 1.35 }}>
                  {authPromptMessage}
                </span>
              </motion.div>
            )}

            {/* Error Message Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 12,
                  padding: '0.75rem 0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '1.25rem',
                  color: '#ef4444',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.35 }}>{error}</span>
              </motion.div>
            )}

            {/* Success Message Alert */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 12,
                  padding: '0.75rem 0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '1.25rem',
                  color: '#34d399',
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.35 }}>{successMessage}</span>
              </motion.div>
            )}

            {activeTab !== 'forgot-password' ? (
              <>
                {/* Official Google Sign-In Button complying with Google Identity Services Guidelines */}
                <button
                  type="button"
                  id="google-signin-btn"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  style={{
                    width: '100%',
                    height: 46,
                    padding: '0 1.25rem',
                    borderRadius: 12,
                    background: '#ffffff',
                    color: '#1f2937',
                    border: '1px solid #dadce0',
                    fontWeight: 600,
                    fontSize: '0.94rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    cursor: isGoogleLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                    transition: 'all 0.18s ease',
                    userSelect: 'none',
                    opacity: isGoogleLoading ? 0.75 : 1,
                  }}
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" color="#4285F4" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      {/* Official Google Multi-Colored G SVG */}
                      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23.8c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16.7C3.5 20.6 7.4 23.8 12 23.8z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.6 7.2C.6 9.2 0 10.5 0 12.4s.6 3.2 1.6 5.2l3.7-2.9z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {!isGoogleOAuthConfigured && (
                  <div
                    style={{
                      marginTop: '0.45rem',
                      fontSize: '0.74rem',
                      color: 'var(--text-muted, #94a3b8)',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
                    <span>Dev Sandbox ready (1-click test). Add Google credentials to .env.local for live OAuth.</span>
                  </div>
                )}

                {/* Divider between Google and Email authentication */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '1.4rem 0',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: 'var(--border, rgba(255, 255, 255, 0.12))' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    or continue with email
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border, rgba(255, 255, 255, 0.12))' }} />
                </div>

                {/* Accessible Tab Switcher (Sign In vs Sign Up) with Smooth Sliding Indicator */}
                <div
                  role="tablist"
                  aria-label="Authentication mode"
                  style={{
                    display: 'flex',
                    position: 'relative',
                    background: 'var(--surface-solid, rgba(255, 255, 255, 0.05))',
                    padding: 4,
                    borderRadius: 12,
                    marginBottom: '1.25rem',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    id="tab-signin"
                    aria-selected={activeTab === 'signin'}
                    aria-controls="panel-signin"
                    onClick={() => handleTabSwitch('signin')}
                    style={{
                      flex: 1,
                      position: 'relative',
                      padding: '0.6rem 0.5rem',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: activeTab === 'signin' ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                      transition: 'color 0.2s ease',
                      zIndex: 1,
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {activeTab === 'signin' && (
                      <motion.div
                        layoutId="activeAuthTabPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, var(--primary, #6366f1), #4f46e5)',
                          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
                          zIndex: -1,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 36,
                        }}
                      />
                    )}
                    Sign In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-signup"
                    aria-selected={activeTab === 'signup'}
                    aria-controls="panel-signup"
                    onClick={() => handleTabSwitch('signup')}
                    style={{
                      flex: 1,
                      position: 'relative',
                      padding: '0.6rem 0.5rem',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: activeTab === 'signup' ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                      transition: 'color 0.2s ease',
                      zIndex: 1,
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {activeTab === 'signup' && (
                      <motion.div
                        layoutId="activeAuthTabPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, var(--primary, #6366f1), #4f46e5)',
                          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
                          zIndex: -1,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 36,
                        }}
                      />
                    )}
                    Create Account
                  </button>
                </div>

                {/* Continuous Smooth Horizontal Sliding Panels Container */}
                <motion.div
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    width: '100%',
                  }}
                  animate={{
                    height: containerHeight,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 36,
                    mass: 0.8,
                  }}
                >
                  <motion.div
                    style={{
                      display: 'flex',
                      width: '200%',
                      alignItems: 'flex-start',
                    }}
                    animate={{
                      x: activeTab === 'signin' ? '0%' : '-50%',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 34,
                      mass: 0.9,
                    }}
                  >
                    {/* Panel 1: Sign In */}
                    <div
                      ref={signinRef}
                      style={{
                        width: '50%',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        paddingRight: '0.4rem',
                      }}
                      inert={activeTab !== 'signin' ? true : undefined}
                      aria-hidden={activeTab !== 'signin'}
                    >
                      <form id="panel-signin" role="tabpanel" aria-labelledby="tab-signin" onSubmit={handleSignInSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                          <label htmlFor="signin-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                            Email or Username
                          </label>
                          <input
                            id="signin-email"
                            type="text"
                            required
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                            placeholder="you@domain.com or username"
                            style={{
                              width: '100%',
                              padding: '0.72rem 0.95rem',
                              borderRadius: 10,
                              background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                              border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                              color: 'var(--text-primary, #ffffff)',
                              fontSize: '0.9rem',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: '0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <label htmlFor="signin-password" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Password
                            </label>
                            <button
                              type="button"
                              onClick={() => handleTabSwitch('forgot-password')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary, #6366f1)',
                                fontSize: '0.78rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input
                              id="signin-password"
                              type={showSignInPassword ? 'text' : 'password'}
                              required
                              value={signInPassword}
                              onChange={(e) => setSignInPassword(e.target.value)}
                              placeholder="••••••••"
                              style={{
                                width: '100%',
                                padding: '0.72rem 2.6rem 0.72rem 0.95rem',
                                borderRadius: 10,
                                background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                                border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                                color: 'var(--text-primary, #ffffff)',
                                fontSize: '0.9rem',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignInPassword(!showSignInPassword)}
                              aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                              style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary, #94a3b8)',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                            >
                              {showSignInPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || isGoogleLoading}
                          className="btn-primary"
                          style={{
                            width: '100%',
                            padding: '0.82rem',
                            marginTop: '1rem',
                            borderRadius: 12,
                            fontSize: '0.94rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              <span>Signing In...</span>
                            </>
                          ) : (
                            <span>Sign In</span>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Panel 2: Create Account (Sign Up) */}
                    <div
                      ref={signupRef}
                      style={{
                        width: '50%',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        paddingLeft: '0.4rem',
                      }}
                      inert={activeTab !== 'signup' ? true : undefined}
                      aria-hidden={activeTab !== 'signup'}
                    >
                      <form id="panel-signup" role="tabpanel" aria-labelledby="tab-signup" onSubmit={handleSignUpSubmit}>
                        <div style={{ marginBottom: '0.85rem' }}>
                          <label htmlFor="signup-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                            Full Name
                          </label>
                          <input
                            id="signup-name"
                            type="text"
                            value={signUpName}
                            onChange={(e) => setSignUpName(e.target.value)}
                            placeholder="Alex Rivera"
                            style={{
                              width: '100%',
                              padding: '0.7rem 0.95rem',
                              borderRadius: 10,
                              background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                              border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                              color: 'var(--text-primary, #ffffff)',
                              fontSize: '0.9rem',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: '0.85rem' }}>
                          <label htmlFor="signup-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                            Email or Username
                          </label>
                          <input
                            id="signup-email"
                            type="text"
                            required
                            value={signUpEmail}
                            onChange={(e) => setSignUpEmail(e.target.value)}
                            placeholder="you@domain.com or username"
                            style={{
                              width: '100%',
                              padding: '0.7rem 0.95rem',
                              borderRadius: 10,
                              background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                              border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                              color: 'var(--text-primary, #ffffff)',
                              fontSize: '0.9rem',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: '0.85rem' }}>
                          <label htmlFor="signup-password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                            Password (min 6 characters)
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              id="signup-password"
                              type={showSignUpPassword ? 'text' : 'password'}
                              required
                              value={signUpPassword}
                              onChange={(e) => setSignUpPassword(e.target.value)}
                              placeholder="••••••••"
                              style={{
                                width: '100%',
                                padding: '0.7rem 2.6rem 0.7rem 0.95rem',
                                borderRadius: 10,
                                background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                                border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                                color: 'var(--text-primary, #ffffff)',
                                fontSize: '0.9rem',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                              aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                              style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary, #94a3b8)',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                            >
                              {showSignUpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

                          {/* Password strength indicator */}
                          {signUpPassword.length > 0 && (
                            <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden', display: 'flex' }}>
                                <div
                                  style={{
                                    width: passStrength === 'weak' ? '33%' : passStrength === 'medium' ? '66%' : '100%',
                                    background: passStrength === 'weak' ? '#ef4444' : passStrength === 'medium' ? '#f59e0b' : '#10b981',
                                    transition: 'all 0.25s ease',
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: passStrength === 'weak' ? '#ef4444' : passStrength === 'medium' ? '#f59e0b' : '#10b981',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {passStrength}
                              </span>
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: '0.85rem' }}>
                          <label htmlFor="signup-confirm-password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                            Confirm Password
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              id="signup-confirm-password"
                              type={showSignUpConfirmPassword ? 'text' : 'password'}
                              required
                              value={signUpConfirmPassword}
                              onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              style={{
                                width: '100%',
                                padding: '0.7rem 2.6rem 0.7rem 0.95rem',
                                borderRadius: 10,
                                background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                                border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                                color: 'var(--text-primary, #ffffff)',
                                fontSize: '0.9rem',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                              aria-label={showSignUpConfirmPassword ? 'Hide password' : 'Show password'}
                              style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary, #94a3b8)',
                                cursor: 'pointer',
                                padding: 4,
                              }}
                            >
                              {showSignUpConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || isGoogleLoading}
                          className="btn-primary"
                          style={{
                            width: '100%',
                            padding: '0.82rem',
                            borderRadius: 12,
                            fontSize: '0.94rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              <span>Creating Account...</span>
                            </>
                          ) : (
                            <span>Create Free Account</span>
                          )}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </motion.div>
        </>
      ) : (
              /* Tab 3: Forgot Password View */
              <div>
                {forgotStep === 'request' ? (
                  <form onSubmit={handleForgotRequestSubmit}>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem', lineHeight: 1.45 }}>
                      Enter your account email to receive a 6-digit recovery code.
                    </p>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="forgot-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                        Account Email
                      </label>
                      <input
                        id="forgot-email"
                        type="text"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@domain.com"
                        style={{
                          width: '100%',
                          padding: '0.72rem 0.95rem',
                          borderRadius: 10,
                          background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                          border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                          color: 'var(--text-primary, #ffffff)',
                          fontSize: '0.9rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        padding: '0.82rem',
                        borderRadius: 12,
                        fontSize: '0.94rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <span>Send Recovery Code</span>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPasswordSubmit}>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem', lineHeight: 1.45 }}>
                      We sent a 6-digit verification code to <strong>{forgotEmail}</strong>. Enter the code and set your new password.
                    </p>
                    <div style={{ marginBottom: '0.85rem' }}>
                      <label htmlFor="recovery-code" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        6-Digit Recovery Code
                      </label>
                      <input
                        id="recovery-code"
                        type="text"
                        maxLength={6}
                        required
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        placeholder="123456"
                        style={{
                          width: '100%',
                          padding: '0.7rem 0.95rem',
                          borderRadius: 10,
                          background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                          border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                          color: 'var(--text-primary, #ffffff)',
                          fontSize: '1.1rem',
                          letterSpacing: '0.2em',
                          textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '0.85rem' }}>
                      <label htmlFor="reset-new-password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        New Password
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="reset-new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '0.7rem 2.6rem 0.7rem 0.95rem',
                            borderRadius: 10,
                            background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                            border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                            color: 'var(--text-primary, #ffffff)',
                            fontSize: '0.9rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary, #94a3b8)',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="reset-confirm-password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        Confirm New Password
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="reset-confirm-password"
                          type={showConfirmNewPassword ? 'text' : 'password'}
                          required
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{
                            width: '100%',
                            padding: '0.7rem 2.6rem 0.7rem 0.95rem',
                            borderRadius: 10,
                            background: 'var(--input-bg, rgba(255, 255, 255, 0.06))',
                            border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                            color: 'var(--text-primary, #ffffff)',
                            fontSize: '0.9rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary, #94a3b8)',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                        >
                          {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        padding: '0.82rem',
                        borderRadius: 12,
                        fontSize: '0.94rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <span>Update Password</span>}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Legal Links (Terms of Service & Privacy Policy) */}
            <div
              style={{
                marginTop: '1.4rem',
                textAlign: 'center',
                fontSize: '0.76rem',
                color: 'var(--text-muted, #64748b)',
                lineHeight: 1.5,
              }}
            >
              By continuing, you agree to <strong style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 600 }}>Job<span className="text-gradient">Nexus</span></strong>&apos;{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal('terms')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #6366f1)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal('privacy')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #6366f1)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                Privacy Policy
              </button>
              .
            </div>

            {/* Security Trust Indicator */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.9rem',
                borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                color: 'var(--text-muted, #64748b)',
                fontSize: '0.74rem',
              }}
            >
              <ShieldCheck size={14} color="#10b981" />
              <span>256-bit Encrypted • HttpOnly Session Security</span>
            </div>
          </div>
        </motion.div>

        {/* Modal for Terms of Service or Privacy Policy */}
        {showTermsModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
            onClick={() => setShowTermsModal(null)}
          >
            <div
              style={{
                maxWidth: 500,
                background: 'var(--surface-solid, #1e293b)',
                padding: '2rem',
                borderRadius: 16,
                border: '1px solid var(--border)',
                maxHeight: '80vh',
                overflowY: 'auto',
                color: 'var(--text-primary)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {showTermsModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {showTermsModal === 'terms' ? (
                  <>
                    <strong style={{ color: 'var(--text-primary)' }}>Job<span className="text-gradient">Nexus</span></strong> provides a verified ATS career discovery engine. By creating an account or signing in with Google, you agree to access verified job boards responsibly, respect employer direct application gateways, and keep your account credentials secure.
                  </>
                ) : (
                  <>
                    Your privacy is protected. <strong style={{ color: 'var(--text-primary)' }}>Job<span className="text-gradient">Nexus</span></strong> never sells candidate information or stores OAuth tokens in vulnerable client-side storage. Authenticated sessions are managed via secure httpOnly cookies, and saved jobs are kept strictly confidential to your account.
                  </>
                )}
              </p>
              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(null)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.2rem', borderRadius: 8 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
