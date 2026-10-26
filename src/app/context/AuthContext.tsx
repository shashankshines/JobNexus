'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  provider: 'google';
  initials: string;
}

export interface AuthIntent {
  type: 'search' | 'domain' | 'pill' | 'workplace' | 'apply';
  query?: string;
  location?: string;
  remote?: string;
  domainTitle?: string;
  jobTitle?: string;
  company?: string;
  url?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isAuthModalOpen: boolean;
  authPromptMessage: string | null;
  pendingIntent: AuthIntent | null;
  openAuthModal: (prompt?: string, intent?: AuthIntent) => void;
  closeAuthModal: () => void;
  consumePendingIntent: () => AuthIntent | null;
  loginWithGmail: (customGmail?: string, customName?: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'jobnexus_auth_user_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<AuthIntent | null>(null);

  // Hydrate user from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        if (parsed && parsed.email) {
          setUser(parsed);
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to read stored session:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const openAuthModal = useCallback((prompt?: string, intent?: AuthIntent) => {
    setAuthPromptMessage(prompt || null);
    if (intent) {
      setPendingIntent(intent);
    }
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthPromptMessage(null);
  }, []);

  const consumePendingIntent = useCallback((): AuthIntent | null => {
    const current = pendingIntent;
    setPendingIntent(null);
    return current;
  }, [pendingIntent]);

  const saveUserSession = useCallback((newUser: User) => {
    setUser(newUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } catch (err) {
      console.warn('[AuthContext] Failed to save session:', err);
    }
    closeAuthModal();
  }, [closeAuthModal]);

  const loginWithGmail = useCallback(async (customGmail?: string, customName?: string): Promise<void> => {
    // Small delay to simulate Google OAuth handshake
    await new Promise((resolve) => setTimeout(resolve, 400));

    let email = (customGmail || '').trim().toLowerCase();
    if (!email) {
      email = 'alex.rivera.dev@gmail.com';
    } else if (!email.endsWith('@gmail.com')) {
      email = email.includes('@') ? email : `${email}@gmail.com`;
    }

    let name = (customName || '').trim();
    if (!name) {
      const handle = email.split('@')[0] || 'Developer';
      name = handle
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const gmailUser: User = {
      id: `usr_google_${Date.now()}`,
      name,
      email,
      role: 'Software Engineer',
      provider: 'google',
      initials: getInitials(name),
    };

    saveUserSession(gmailUser);
  }, [saveUserSession]);

  const logout = useCallback(() => {
    setUser(null);
    setPendingIntent(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[AuthContext] Failed to clear session:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isHydrated,
        isAuthModalOpen,
        authPromptMessage,
        pendingIntent,
        openAuthModal,
        closeAuthModal,
        consumePendingIntent,
        loginWithGmail,
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
