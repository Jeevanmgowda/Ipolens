'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SignInCredentials, SignUpCredentials, GoogleAuthPayload } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (creds: SignInCredentials) => Promise<{ success: boolean; error?: string }>;
  signUp: (creds: SignUpCredentials) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: (payload: GoogleAuthPayload) => Promise<{ success: boolean; error?: string }>;
  signUpWithGoogle: (payload: GoogleAuthPayload) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // The server session (HttpOnly cookie) is the source of truth; ask it who we are.
  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      setUser(res.ok && data?.success ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, []);

  const saveUserSession = (userProfile: User) => setUser(userProfile);

  const signIn = async (creds: SignInCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Authentication failed' };
      }

      saveUserSession(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Network error during sign in' };
    }
  };

  const signUp = async (creds: SignUpCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      saveUserSession(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Network error during sign up' };
    }
  };

  const authenticateWithGoogle = async (payload: GoogleAuthPayload): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Google authentication failed' };
      }

      saveUserSession(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Network error during Google authentication' };
    }
  };

  const signOut = () => {
    setUser(null);
    try {
      fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle: authenticateWithGoogle,
        signUpWithGoogle: authenticateWithGoogle,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
