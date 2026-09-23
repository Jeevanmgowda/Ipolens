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
  loginWithDemo: (type: 'institutional' | 'retail') => Promise<void>;
}

const STORAGE_KEY = 'ipolens_user_session';

export const DEMO_USERS: Record<'institutional' | 'retail', User> = {
  institutional: {
    id: 'usr_inst_01',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@ipolens.in',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'institutional',
    investorCategory: 'bNII',
    primaryPan: 'AAAPM1234F',
    panCount: 6,
    dematCount: 4,
    createdAt: '2025-01-15T00:00:00.000Z',
  },
  retail: {
    id: 'usr_ret_02',
    name: 'Priya Sharma',
    email: 'priya.sharma@investor.in',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'retail',
    investorCategory: 'Retail',
    primaryPan: 'ABFPS5678K',
    panCount: 3,
    dematCount: 2,
    createdAt: '2025-03-01T00:00:00.000Z',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse auth session from localStorage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveUserSession = (userProfile: User) => {
    setUser(userProfile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
    } catch (e) {
      console.error('Failed to save auth session:', e);
    }
  };

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
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during sign in' };
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
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during sign up' };
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
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during Google authentication' };
    }
  };

  const loginWithDemo = async (type: 'institutional' | 'retail'): Promise<void> => {
    const demoUser = DEMO_USERS[type];
    saveUserSession(demoUser);
  };

  const signOut = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
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
        loginWithDemo,
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
