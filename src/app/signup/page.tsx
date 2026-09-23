'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { InvestorCategory, GoogleAuthPayload } from '@/types/auth';
import { GoogleAuthModal } from '@/components/auth/GoogleAuthModal';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  User as UserIcon,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Building2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, signUpWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [investorCategory, setInvestorCategory] = useState<InvestorCategory>('Retail');
  const [primaryPan, setPrimaryPan] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAccountSelect = async (payload: GoogleAuthPayload) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await signUpWithGoogle(payload);
      if (res.success) {
        setIsGoogleModalOpen(false);
        router.push('/');
      } else {
        setError(res.error || 'Google sign-up failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Google authorization error.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Compute password strength
  const getPasswordStrength = (pass: string): { score: number; label: string; color: string } => {
    if (!pass) return { score: 0, label: '', color: 'bg-transparent' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 3) return { score: 2, label: 'Good', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full legal name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (primaryPan.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(primaryPan.trim().toUpperCase())) {
        setError('Invalid PAN format. PAN must be 10 alphanumeric characters (e.g. ABCDE1234F).');
        return;
      }
    }

    if (!termsAccepted) {
      setError('You must accept the terms of service and SEBI disclosures.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        investorCategory,
        primaryPan: primaryPan.trim() ? primaryPan.trim().toUpperCase() : undefined,
        termsAccepted,
      });

      if (res.success) {
        router.push('/');
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100 selection:bg-cyan-500/30">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-[#070b14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="IPOLENS Logo"
              className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-transform group-hover:scale-105"
            />
            <div className="hidden sm:block">
              <span className="font-bold text-sm tracking-wide text-white">IPOLENS</span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                REGISTRATION
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            <Link
              href="/signin"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition cursor-pointer"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Benefits & Trust Highlights */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-center space-y-6 pr-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium w-fit">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Free Institutional-Grade Access</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Join Leading Investors & Desk Analysts on <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                IPOLENS Platform
              </span>
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed">
              Empower your primary market investments with high-speed exchange data, multi-PAN family bidding coordination, and automated allotment tracking.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  ✓
                </div>
                <span>Zero broker credentials or Demat passwords needed</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  ✓
                </div>
                <span>SEBI Duplicate Bid Rule automated prevention</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  ✓
                </div>
                <span>Instant registrar allotment scanner (KFintech, Link Intime)</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  ✓
                </div>
                <span>Gemini-powered AI DRHP balance sheet scrutiny</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Regulatory Safety Guaranteed</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All PAN and demographic data is locally encrypted in memory. We never route UPI mandates without your broker or banking app approval.
              </p>
            </div>
          </div>

          {/* Right Column: Registration Form Card */}
          <div className="lg:col-span-7 w-full max-w-lg mx-auto">
            <div className="glass-panel border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
              {/* Header */}
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <UserIcon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Create your IPOLENS Account</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Start tracking IPO demand, family allocations, and demat holdings.
                </p>
              </div>

              {/* Google Sign-Up Quick Action */}
              <div className="mb-5 space-y-4">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(true)}
                  disabled={loading || googleLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 border border-slate-200"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                  <span>{googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-[#0b101e] px-2.5 text-slate-400 font-medium">Or register with email</span>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Legal Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="investor@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>

                {/* Password & Strength Meter */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                        <div
                          className={`h-full transition-all duration-300 ${
                            strength.score >= 1 ? strength.color : 'bg-transparent'
                          }`}
                          style={{ width: '33%' }}
                        />
                        <div
                          className={`h-full transition-all duration-300 ${
                            strength.score >= 2 ? strength.color : 'bg-transparent'
                          }`}
                          style={{ width: '33%' }}
                        />
                        <div
                          className={`h-full transition-all duration-300 ${
                            strength.score >= 3 ? strength.color : 'bg-transparent'
                          }`}
                          style={{ width: '34%' }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{strength.label}</span>
                    </div>
                  )}
                </div>

                {/* Investor Category & Optional PAN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Investor Category
                    </label>
                    <select
                      value={investorCategory}
                      onChange={(e) => setInvestorCategory(e.target.value as InvestorCategory)}
                      className="w-full px-3 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Retail">Retail (≤ ₹2 Lakh)</option>
                      <option value="sNII">sNII (₹2 - 10 Lakh)</option>
                      <option value="bNII">bNII (&gt; ₹10 Lakh)</option>
                      <option value="Institutional">Institutional (QIB)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Primary PAN <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="ABCDE1234F"
                        value={primaryPan}
                        onChange={(e) => setPrimaryPan(e.target.value.toUpperCase())}
                        className="w-full pl-8 pr-3 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono tracking-wider transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 rounded bg-slate-900 border-white/20 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 leading-relaxed">
                      I agree to the SEBI single-bid compliance terms and platform privacy policy.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Creating Terminal Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Card Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 text-center text-xs text-slate-400">
                Already have an account?{' '}
                <Link
                  href="/signin"
                  className="font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 ml-1 transition"
                >
                  Sign In to Terminal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Google Authentication Modal */}
      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSelectAccount={handleGoogleAccountSelect}
        isLoading={googleLoading}
        mode="signup"
        defaultInvestorCategory={investorCategory}
        defaultPrimaryPan={primaryPan}
      />
    </div>
  );
}
