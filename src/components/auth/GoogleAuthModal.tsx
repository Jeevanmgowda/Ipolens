'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleAuthPayload, InvestorCategory } from '@/types/auth';
import { X, Shield } from 'lucide-react';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: Record<string, unknown>): void;
      renderButton(el: HTMLElement, options: Record<string, unknown>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
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

/**
 * Official Google Identity Services sign-in. The ID token (credential) is sent to the server,
 * which verifies it with Google before creating a session. There is no simulated account picker.
 */
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
  const isConfigured = googleClientId.endsWith('.apps.googleusercontent.com');

  const buttonRef = useRef<HTMLDivElement>(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GIS may already be on the page (opened before); then it counts as loaded without waiting.
  const gsiReady = isGsiLoaded || (typeof window !== 'undefined' && Boolean(window.google?.accounts?.id));

  useEffect(() => {
    if (!isOpen || !isConfigured || window.google?.accounts?.id) return;
    const id = 'google-identity-services-script';
    const existing = document.getElementById(id);
    if (existing) {
      const onLoad = () => setIsGsiLoaded(true);
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGsiLoaded(true);
    script.onerror = () => setError('Could not load Google Identity Services.');
    document.body.appendChild(script);
  }, [isOpen, isConfigured]);

  useEffect(() => {
    if (!isOpen || !isConfigured || !gsiReady || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential?: string }) => {
        if (!response?.credential) {
          setError('Google did not return a credential.');
          return;
        }
        await onSelectAccount({
          email: '',
          name: '',
          credential: response.credential,
          investorCategory: defaultInvestorCategory,
          primaryPan: defaultPrimaryPan ? defaultPrimaryPan.trim().toUpperCase() : undefined,
        });
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    if (buttonRef.current) {
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: mode === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        width: 320,
      });
    }
  }, [isOpen, isConfigured, gsiReady, googleClientId, mode, defaultInvestorCategory, defaultPrimaryPan, onSelectAccount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0f172a] border border-white/15 p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
            </h3>
            <p className="text-xs text-slate-400">Your Google ID token is verified on our server.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>
        )}

        {isConfigured ? (
          <div className="flex justify-center py-2">
            <div ref={buttonRef} className="min-h-[44px] flex items-center justify-center" />
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
            Google sign-in is not configured. Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in <code>.env.local</code>, or
            use email and password.
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5" /> No Google password is ever seen or stored by IPOLENS.
        </p>
      </div>
    </div>
  );
};

export default GoogleAuthModal;
