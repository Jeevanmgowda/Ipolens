'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleAuthPayload, InvestorCategory } from '@/types/auth';
import { X, Check, User as UserIcon, Plus, Shield, Sparkles, ExternalLink } from 'lucide-react';
import { isValidEmail } from '@/lib/security/sanitize';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (payload: GoogleAuthPayload) => Promise<void>;
  isLoading?: boolean;
  mode?: 'signup' | 'signin';
  defaultInvestorCategory?: InvestorCategory;
  defaultPrimaryPan?: string;
}

interface MockGoogleAccount {
  name: string;
  email: string;
  avatarUrl: string;
}

const DEFAULT_GOOGLE_ACCOUNTS: MockGoogleAccount[] = [
  {
    name: 'Jeevan M Gowda',
    email: 'jeevan.gowda@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Primary Family Desk',
    email: 'investor.family@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
];

function parseGoogleJwt(token: string): { name?: string; email?: string; picture?: string; sub?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to parse Google JWT:', err);
    return null;
  }
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  isLoading = false,
  mode = 'signup',
  defaultInvestorCategory = 'Retail',
  defaultPrimaryPan = '',
}) => {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const hasRealGoogleApi = Boolean(
    googleClientId &&
    !googleClientId.includes('your_') &&
    googleClientId.includes('.apps.googleusercontent.com')
  );

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [selectedEmail, setSelectedEmail] = useState<string>(DEFAULT_GOOGLE_ACCOUNTS[0].email);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<InvestorCategory>(defaultInvestorCategory);
  const [customPan, setCustomPan] = useState<string>(defaultPrimaryPan);
  const [error, setError] = useState<string | null>(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState<boolean>(false);
  const [signInNonce, setSignInNonce] = useState<string | null>(null);

  // One-time nonce bound to this browser via an HttpOnly cookie; Google embeds it in
  // the ID token so a captured token cannot be replayed elsewhere.
  useEffect(() => {
    if (!isOpen || !hasRealGoogleApi) return;
    let cancelled = false;
    fetch('/api/auth/google/nonce', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.nonce) setSignInNonce(json.nonce);
      })
      .catch(() => {
        if (!cancelled) setError('Could not start Google sign-in. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasRealGoogleApi]);

  // Dynamically load Google Identity Services script
  useEffect(() => {
    if (!isOpen) return;

    if (window.google?.accounts?.id) {
      setIsGsiLoaded(true);
      return;
    }

    const scriptId = 'google-identity-services-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => setIsGsiLoaded(true);
      document.body.appendChild(script);
    } else {
      setIsGsiLoaded(true);
    }
  }, [isOpen]);

  // Initialize Google Identity Services when script and Client ID are ready
  useEffect(() => {
    if (!isOpen || !hasRealGoogleApi || !isGsiLoaded || !signInNonce || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        nonce: signInNonce,
        callback: async (response: any) => {
          if (response?.credential) {
            const payload = parseGoogleJwt(response.credential);
            if (payload?.email) {
              await onSelectAccount({
                name: payload.name || payload.email.split('@')[0],
                email: payload.email,
                avatarUrl: payload.picture,
                googleId: payload.sub,
                credential: response.credential,
                investorCategory: defaultInvestorCategory,
                primaryPan: defaultPrimaryPan ? defaultPrimaryPan.trim().toUpperCase() : undefined,
              });
            } else {
              setError('Google identity verification failed: No email returned.');
            }
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 360,
        });
      }

      // Prompt One-Tap
      window.google.accounts.id.prompt();
    } catch (err: any) {
      console.warn('Google Identity Services init notice:', err);
    }
  }, [isOpen, hasRealGoogleApi, isGsiLoaded, signInNonce, googleClientId, mode, defaultInvestorCategory, defaultPrimaryPan, onSelectAccount]);

  if (!isOpen) return null;

  const handleContinue = async () => {
    setError(null);
    if (isCustomMode) {
      if (!customName.trim()) {
        setError('Please enter your Google account name.');
        return;
      }
      if (!customEmail.trim() || !isValidEmail(customEmail.trim())) {
        setError('Please enter a valid Google email address.');
        return;
      }

      await onSelectAccount({
        name: customName.trim(),
        email: customEmail.trim(),
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(customName.trim())}`,
        investorCategory: customCategory,
        primaryPan: customPan.trim() ? customPan.trim().toUpperCase() : undefined,
      });
    } else {
      const account = DEFAULT_GOOGLE_ACCOUNTS.find((a) => a.email === selectedEmail) || DEFAULT_GOOGLE_ACCOUNTS[0];
      await onSelectAccount({
        name: account.name,
        email: account.email,
        avatarUrl: account.avatarUrl,
        investorCategory: defaultInvestorCategory,
        primaryPan: defaultPrimaryPan ? defaultPrimaryPan.trim().toUpperCase() : undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0f172a] border border-white/15 p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Google Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Official Google G Logo */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md p-2 shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
              </h3>
              <p className="text-xs text-slate-400">
                {hasRealGoogleApi ? 'Official Google Identity Services' : 'Choose an account to continue to IPOLENS'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Real Google Identity Services API Button (When NEXT_PUBLIC_GOOGLE_CLIENT_ID is active) */}
        {hasRealGoogleApi ? (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold">Live Google OAuth Active</strong>
                <span>Click the official Google button below to select your Google Account with authentic 1-click verification.</span>
              </div>
            </div>

            <div className="flex justify-center py-2">
              <div ref={googleBtnContainerRef} className="min-h-[44px] flex items-center justify-center" />
            </div>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#0f172a] px-2 text-slate-500">Or use test account</span>
              </div>
            </div>
          </div>
        ) : (
          /* Notice informing how to connect real Google Cloud Client ID */
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-900 border border-cyan-500/20 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Live Google API Integration Ready
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                OAuth 2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              To trigger the authentic Google account chooser popup, add <code className="text-cyan-300">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your <code className="text-slate-200">.env.local</code>. Below are instant simulated profiles for development.
            </p>
          </div>
        )}

        {!isCustomMode ? (
          <div className="space-y-2">
            {DEFAULT_GOOGLE_ACCOUNTS.map((account) => {
              const isSelected = selectedEmail === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setSelectedEmail(account.email)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={account.avatarUrl}
                      alt={account.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/20"
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">{account.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{account.email}</p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                      isSelected
                        ? 'bg-cyan-400 border-cyan-400 text-black'
                        : 'border-white/20 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </button>
              );
            })}

            {/* Option to use another account */}
            <button
              type="button"
              onClick={() => setIsCustomMode(true)}
              className="w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-cyan-400/50 bg-slate-900/40 hover:bg-cyan-500/5 flex items-center gap-3 text-left transition cursor-pointer text-xs text-slate-300 hover:text-white"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-white">Use another Google account</p>
                <p className="text-slate-400">Sign in with any Gmail or Workspace address</p>
              </div>
            </button>
          </div>
        ) : (
          /* Custom Account Form */
          <div className="space-y-3.5 p-4 rounded-xl bg-slate-900/70 border border-white/10">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-semibold text-cyan-300">Custom Google Account Details</span>
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Back to saved accounts
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Google Account Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Google Email Address</label>
              <input
                type="email"
                placeholder="name@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">Investor Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as InvestorCategory)}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="Retail">Retail (≤ ₹2L)</option>
                    <option value="sNII">sNII (₹2L - 10L)</option>
                    <option value="bNII">bNII (&gt; ₹10L)</option>
                    <option value="Institutional">Institutional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">PAN (Optional)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={customPan}
                    onChange={(e) => setCustomPan(e.target.value.toUpperCase())}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-xs text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security & Data Sharing Notice */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            To continue, Google will share your verified name, email address, and profile picture with IPOLENS.
            No broker passwords or Google credentials are ever saved.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          {!hasRealGoogleApi && (
            <button
              type="button"
              onClick={handleContinue}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-bold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Authorizing Google...</span>
                </>
              ) : (
                <span>Continue with Google</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
