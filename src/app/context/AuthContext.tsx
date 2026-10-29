'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  validatePasswordResetRequest,
  validatePasswordResetExecution,
  getInitials,
} from '@/modules/jobs/domain/auth.validation';
import type { UserEntitlement } from '@/modules/billing/domain/subscription.types';

export type AuthStatus = 'initializing' | 'anonymous' | 'authenticated' | 'error';
export type AuthMode = 'signin' | 'signup' | 'forgot-password';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  picture?: string;
  provider: 'google' | 'credentials';
  initials: string;
  createdAt?: string;
  savedJobsCount?: number;
  isAdmin?: boolean;
}

export interface SavedJob {
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
  savedAt?: string;
}

export interface PendingAction {
  type: 'save-job' | 'search' | 'domain' | 'apply' | 'pill' | 'workplace';
  job?: Partial<SavedJob> & { id: string; title: string; company?: string; url?: string; [key: string]: unknown };
  jobId?: string;
  query?: string;
  location?: string;
  remote?: string;
  domainTitle?: string;
  jobTitle?: string;
  company?: string;
  url?: string;
  payload?: Record<string, unknown>;
}

// Backwards compatibility alias for AuthIntent
export type AuthIntent = PendingAction;

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface AuthContextType {
  status: AuthStatus;
  authStatus: AuthStatus;
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  authPromptMessage: string | null;
  pendingIntent: PendingAction | null;
  savedJobs: SavedJob[];
  savedJobIds: Set<string>;
  entitlement: UserEntitlement | null;
  isPremium: boolean;
  isAdmin: boolean;
  isPremiumOfferOpen: boolean;
  openPremiumOfferModal: () => void;
  closePremiumOfferModal: () => void;
  refreshEntitlement: () => Promise<UserEntitlement | null>;
  toast: ToastMessage | null;
  openAuthModal: (prompt?: string, intent?: PendingAction, mode?: AuthMode) => void;
  setAuthMode: (mode: AuthMode) => void;
  closeAuthModal: () => void;
  consumePendingIntent: () => PendingAction | null;
  loginWithGoogle: (credentialOrProfile?: string | Record<string, unknown>) => Promise<void>;
  loginWithCredentials: (usernameOrEmail: string, password: string) => Promise<void>;
  signUpWithCredentials: (data: {
    name?: string;
    usernameOrEmail: string;
    password: string;
    confirmPassword?: string;
    role?: string;
  }) => Promise<void>;
  requestPasswordReset: (usernameOrEmail: string) => Promise<{ success: boolean; message: string; normalizedEmail: string }>;
  resetPasswordWithCode: (
    email: string,
    code: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  saveJob: (job: Partial<SavedJob> & { id: string; title: string; company?: string; url?: string; [key: string]: unknown }) => Promise<boolean>;
  removeSavedJob: (jobId: string) => Promise<boolean>;
  toggleSaveJob: (job: Partial<SavedJob> & { id: string; title: string; company?: string; url?: string; [key: string]: unknown }) => Promise<boolean>;
  isJobSaved: (jobId: string) => boolean;
  clearToast: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { getInitials };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingAction | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [entitlement, setEntitlement] = useState<UserEntitlement | null>(null);
  const [isPremiumOfferOpen, setIsPremiumOfferOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const isPremium = useMemo(() => {
    return Boolean(entitlement?.isPremium);
  }, [entitlement]);

  const isAdmin = useMemo(() => {
    return Boolean(
      user?.isAdmin &&
      user?.email?.toLowerCase().trim() === 'shashankshines@gmail.com'
    );
  }, [user]);

  const openPremiumOfferModal = useCallback(() => {
    setIsPremiumOfferOpen(true);
  }, []);

  const closePremiumOfferModal = useCallback(() => {
    setIsPremiumOfferOpen(false);
  }, []);

  const refreshEntitlement = useCallback(async (): Promise<UserEntitlement | null> => {
    try {
      const res = await fetch('/api/billing/status', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.entitlement) {
          setEntitlement(data.entitlement);
          return data.entitlement;
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to fetch billing status:', err);
    }
    return null;
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, type, message, title });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4200);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const savedJobIds = useMemo(() => {
    return new Set(savedJobs.map((j) => j.id));
  }, [savedJobs]);

  const isJobSaved = useCallback((jobId: string) => {
    return savedJobIds.has(jobId);
  }, [savedJobIds]);

  // Load saved jobs from backend
  const fetchSavedJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/saved-jobs', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.savedJobs)) {
          setSavedJobs(data.savedJobs);
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to fetch saved jobs:', err);
    }
  }, []);

  // Restore session from server cookie on mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const res = await fetch('/api/auth/session', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            setStatus('authenticated');
            // Fetch user's saved jobs
            fetchSavedJobs();
            // Fetch user's billing entitlement
            const userEntitlement = await refreshEntitlement();

            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              if (urlParams.get('auth_success') === 'google') {
                showToast(`Welcome back, ${data.user.name}!`, 'success');
                window.history.replaceState({}, document.title, window.location.pathname);
                if (!userEntitlement?.isPremium) {
                  setIsPremiumOfferOpen(true);
                }
              }
              const savedIntentStr = sessionStorage.getItem('jn_pending_intent');
              if (savedIntentStr) {
                sessionStorage.removeItem('jn_pending_intent');
                try {
                  const savedIntent = JSON.parse(savedIntentStr);
                  if (savedIntent.type === 'save-job' && savedIntent.job) {
                    fetch('/api/saved-jobs', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ job: savedIntent.job }),
                    }).then(() => fetchSavedJobs());
                    showToast(`"${savedIntent.job.title}" saved automatically to your collection!`, 'success');
                  } else if (savedIntent.type === 'apply' && savedIntent.url) {
                    window.open(savedIntent.url, '_blank', 'noopener,noreferrer');
                  }
                } catch (e) {
                  console.error('Failed to restore pending intent:', e);
                }
              }
            }
            return;
          }
        }

        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const authError = urlParams.get('auth_error');
          if (authError) {
            showToast(`Authentication not completed: ${authError.replace(/_/g, ' ')}`, 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }

        setUser(null);
        setStatus('anonymous');
      } catch (err) {
        console.warn('[AuthContext] Session check failed, starting in anonymous mode:', err);
        if (isMounted) {
          setUser(null);
          setStatus('anonymous');
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [fetchSavedJobs, refreshEntitlement, showToast]);

  const openAuthModal = useCallback((prompt?: string, intent?: PendingAction, mode?: AuthMode) => {
    setAuthPromptMessage(prompt || null);
    if (intent) {
      setPendingIntent(intent);
    }
    if (mode) {
      setAuthMode(mode);
    }
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthPromptMessage(null);
  }, []);

  const consumePendingIntent = useCallback((): PendingAction | null => {
    const current = pendingIntent;
    setPendingIntent(null);
    return current;
  }, [pendingIntent]);

  // Direct save job API call (requires authentication)
  const saveJob = useCallback(
    async (
      job: Partial<SavedJob> & { id: string; title: string; company?: string; url?: string; [key: string]: unknown }
    ): Promise<boolean> => {
      if (!user) {
        openAuthModal('Sign in to save this job to your collection.', {
          type: 'save-job',
          job,
        });
        return false;
      }

      try {
        const res = await fetch('/api/saved-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.savedJobs) {
            setSavedJobs(data.savedJobs);
          }
          showToast(`Saved "${job.title}" to your collection!`, 'success');
          return true;
        } else {
          const errData = await res.json();
          showToast(errData.error || 'Failed to save job.', 'error');
          return false;
        }
      } catch (err) {
        console.error('[AuthContext] saveJob error:', err);
        showToast('Unable to save job. Please try again.', 'error');
        return false;
      }
    },
    [user, openAuthModal, showToast]
  );

  // Remove saved job API call
  const removeSavedJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const res = await fetch(`/api/saved-jobs?id=${encodeURIComponent(jobId)}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.savedJobs) {
            setSavedJobs(data.savedJobs);
          }
          showToast('Job removed from your saved collection.', 'info');
          return true;
        } else {
          showToast('Failed to remove saved job.', 'error');
          return false;
        }
      } catch (err) {
        console.error('[AuthContext] removeSavedJob error:', err);
        showToast('Unable to remove job.', 'error');
        return false;
      }
    },
    [user, showToast]
  );

  const toggleSaveJob = useCallback(
    async (
      job: Partial<SavedJob> & { id: string; title: string; company?: string; url?: string; [key: string]: unknown }
    ): Promise<boolean> => {
      if (isJobSaved(job.id)) {
        return removeSavedJob(job.id);
      } else {
        return saveJob(job);
      }
    },
    [isJobSaved, removeSavedJob, saveJob]
  );

  // Execute post-login pending action (e.g. auto-save job without second click)
  const handlePostAuthAction = useCallback(
    async (loggedInUser: User) => {
      if (loggedInUser) {
        setUser(loggedInUser);
      }
      closeAuthModal();

      // Refresh saved jobs
      try {
        const res = await fetch('/api/saved-jobs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.savedJobs)) {
            setSavedJobs(data.savedJobs);
          }
        }
      } catch (err) {
        console.warn('Failed to refresh saved jobs post auth:', err);
      }

      // Check if user had a pending action waiting
      if (pendingIntent) {
        const action = pendingIntent;

        if (action.type === 'save-job' && action.job) {
          setPendingIntent(null);
          try {
            const saveRes = await fetch('/api/saved-jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ job: action.job }),
            });
            if (saveRes.ok) {
              const data = await saveRes.json();
              if (data.savedJobs) {
                setSavedJobs(data.savedJobs);
              }
              showToast(`"${action.job.title}" saved automatically to your collection!`, 'success');
            }
          } catch (err) {
            console.error('Failed to auto-save pending job:', err);
          }
        } else if (action.type === 'apply' && action.url) {
          setPendingIntent(null);
          try {
            if (typeof window !== 'undefined') {
              window.open(action.url, '_blank', 'noopener,noreferrer');
              showToast(`Resuming application for ${action.jobTitle || 'job'}!`, 'success');
            }
          } catch (err) {
            console.error('Failed to resume application link:', err);
          }
        }
      }

      // Authoritative Entitlement Check: Non-subscribers immediately see the Premium offer modal
      try {
        const ent = await refreshEntitlement();
        if (!ent?.isPremium) {
          setIsPremiumOfferOpen(true);
        } else {
          setIsPremiumOfferOpen(false);
        }
      } catch (err) {
        console.warn('Failed to evaluate entitlement post auth:', err);
      }
    },
    [pendingIntent, closeAuthModal, refreshEntitlement, showToast]
  );

  // Google Sign-In handler
  const loginWithGoogle = useCallback(
    async (credentialOrProfile?: string | Record<string, unknown>): Promise<void> => {
      setStatus('initializing');
      try {
        let payload: Record<string, unknown> = {};
        if (typeof credentialOrProfile === 'string') {
          payload = { credential: credentialOrProfile };
        } else if (credentialOrProfile && typeof credentialOrProfile === 'object') {
          if ('credential' in credentialOrProfile && credentialOrProfile.credential) {
            payload = { credential: credentialOrProfile.credential };
          } else if ('isDevDemo' in credentialOrProfile || 'devMode' in credentialOrProfile) {
            payload = { ...credentialOrProfile };
          } else {
            payload = { profile: credentialOrProfile };
          }
        } else {
          payload = {};
        }

        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Google authentication failed.');
        }

        const data = await res.json();
        setUser(data.user);
        setStatus('authenticated');
        if (data.isDevDemo) {
          showToast('Signed in with Google (Dev Mode). Add credentials to .env.local for live accounts.', 'info');
        } else {
          showToast(`Welcome back, ${data.user.name}!`, 'success');
        }
        await handlePostAuthAction(data.user);
      } catch (err: unknown) {
        setStatus('anonymous');
        throw err;
      }
    },
    [handlePostAuthAction, showToast]
  );

  // Credentials Sign-In handler
  const loginWithCredentials = useCallback(
    async (usernameOrEmail: string, password: string): Promise<void> => {
      const res = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'signin', usernameOrEmail, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid credentials.');
      }

      const data = await res.json();
      setUser(data.user);
      setStatus('authenticated');
      showToast(
        `Welcome back, ${data.user.name}! Full company details and direct ATS application links are unlocked.`,
        'success',
        'Welcome Back'
      );
      await handlePostAuthAction(data.user);
    },
    [handlePostAuthAction, showToast]
  );

  // Credentials Sign-Up handler
  const signUpWithCredentials = useCallback(
    async (data: {
      name?: string;
      usernameOrEmail: string;
      password: string;
      confirmPassword?: string;
      role?: string;
    }): Promise<void> => {
      const res = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'signup', ...data }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Registration failed.');
      }

      const resData = await res.json();
      setUser(resData.user);
      setStatus('authenticated');
      showToast(
        `Welcome to JobNexus, ${resData.user.name}! Your account is ready and direct ATS application links are unlocked.`,
        'success',
        'Account Created'
      );
      await handlePostAuthAction(resData.user);
    },
    [handlePostAuthAction, showToast]
  );

  // Password reset request handler connecting to backend
  const requestPasswordReset = useCallback(
    async (usernameOrEmail: string): Promise<{ success: boolean; message: string; normalizedEmail: string }> => {
      const val = validatePasswordResetRequest(usernameOrEmail);
      if (!val.valid || !val.normalizedIdentifier) {
        throw new Error(val.error || 'Please enter a valid username or email address.');
      }

      const res = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'request-reset', usernameOrEmail: val.normalizedIdentifier }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send password recovery code.');
      }

      const data = await res.json();
      return {
        success: true,
        message: data.message || `Recovery code sent to ${val.normalizedIdentifier}.`,
        normalizedEmail: val.normalizedIdentifier,
      };
    },
    []
  );

  // Password reset execution handler connecting to backend
  const resetPasswordWithCode = useCallback(
    async (
      email: string,
      code: string,
      newPassword: string,
      confirmPassword: string
    ): Promise<{ success: boolean; message: string }> => {
      const val = validatePasswordResetExecution({
        email,
        code,
        newPassword,
        confirmPassword,
      });
      if (!val.valid) {
        throw new Error(val.error || 'Unable to reset password. Please check your recovery code.');
      }

      const res = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'reset-password',
          email,
          code,
          newPassword,
          confirmPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Unable to reset password. Please verify code and password.');
      }

      const data = await res.json();
      return {
        success: true,
        message: data.message || 'Password successfully reset! You can now sign in with your new password.',
      };
    },
    []
  );

  // Sign out handler
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch (err) {
      console.warn('[AuthContext] Server logout call failed:', err);
    }
    setUser(null);
    setSavedJobs([]);
    setEntitlement(null);
    setIsPremiumOfferOpen(false);
    setStatus('anonymous');
    setPendingIntent(null);
    if (typeof window !== 'undefined') {
      const cleanPath = window.location.pathname.split('?')[0] || '/';
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, cleanPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    showToast(
      'Browsing in guest mode. Company names and direct application links are now masked.',
      'info',
      'Signed Out'
    );
  }, [showToast]);

  return (
    <AuthContext.Provider
      value={{
        status,
        authStatus: status,
        user,
        isAuthenticated: status === 'authenticated' && !!user,
        isHydrated: status !== 'initializing',
        isAuthModalOpen,
        authMode,
        authPromptMessage,
        pendingIntent,
        savedJobs,
        savedJobIds,
        entitlement,
        isPremium,
        isAdmin,
        isPremiumOfferOpen,
        openPremiumOfferModal,
        closePremiumOfferModal,
        refreshEntitlement,
        toast,
        openAuthModal,
        setAuthMode,
        closeAuthModal,
        consumePendingIntent,
        loginWithGoogle,
        loginWithCredentials,
        signUpWithCredentials,
        requestPasswordReset,
        resetPasswordWithCode,
        saveJob,
        removeSavedJob,
        toggleSaveJob,
        isJobSaved,
        clearToast,
        showToast,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
