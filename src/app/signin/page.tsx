'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GoogleAuthPayload } from '@/types/auth';
import { GoogleAuthModal } from '@/components/auth/GoogleAuthModal';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  TrendingUp,
  Activity,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowLeft,
} from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, loginWithDemo, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAccountSelect = async (payload: GoogleAuthPayload) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await signInWithGoogle(payload);
      if (res.success) {
        setIsGoogleModalOpen(false);
        router.push('/');
      } else {
        setError(res.error || 'Google sign-in failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Google authorization error.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // If already logged in, show quick welcome banner or allow jumping back
  const handleDemoLogin = async (type: 'institutional' | 'retail') => {
    setError(null);
    setLoading(true);
    try {
      await loginWithDemo(type);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn({ email, password, rememberMe });
      if (res.success) {
        router.push('/');
      } else {
        setError(res.error || 'Invalid email or password.');
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
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                TERMINAL
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
              href="/signup"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/10 transition cursor-pointer"
            >
              Create Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Institutional Value Highlights (visible on lg screens) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 pr-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium w-fit">
              <Activity className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>Direct NSE India Exchange Gateway</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Institutional IPO Intelligence & <br />
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                Multi-PAN Execution
              </span>
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed">
              Real-time exchange telemetry, automated SEBI-compliant family bidding, 1-click registrar allotment scans, and AI DRHP financial risk analysis in a unified terminal.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">Live Bidding Demand Curves</h2>
                  <p className="text-[11px] text-slate-400">Institutional QIB, sNII, bNII, and Retail subscription tracking.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">SEBI Multi-PAN Application Engine</h2>
                  <p className="text-[11px] text-slate-400">Coordinate family bidding without duplicate bid rejections.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">AI DRHP Forensic Summaries</h2>
                  <p className="text-[11px] text-slate-400">Gemini-powered valuation scrutiny and anchor investor analysis.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero broker credentials required • AES-256 local encryption</span>
            </div>
          </div>

          {/* Right Column: Sign In Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="glass-panel border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
              {/* Header */}
              <div className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Sign In to IPOLENS</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your credentials to access your terminal session.
                </p>
              </div>

              {/* Instant 1-Click Demo Buttons for Fast Evaluation */}
              <div className="mb-6 p-3 rounded-xl bg-slate-900/90 border border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Quick 1-Click Demo Access
                  </span>
                  <span className="text-[10px] text-slate-400">Test instantly</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('institutional')}
                    disabled={loading}
                    className="flex flex-col items-start p-2 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/40 transition cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white group-hover:text-cyan-300">
                      <Building2 className="w-3 h-3 text-cyan-400" />
                      <span>HNI Desk</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5">Arjun Mehta (bNII)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoLogin('retail')}
                    disabled={loading}
                    className="flex flex-col items-start p-2 rounded-lg bg-white/5 hover:bg-purple-500/15 border border-white/10 hover:border-purple-500/40 transition cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white group-hover:text-purple-300">
                      <Users className="w-3 h-3 text-purple-400" />
                      <span>Family Office</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5">Priya Sharma (Retail)</span>
                  </button>
                </div>
              </div>

              {/* Google Sign-In Quick Action */}
              <div className="mb-4">
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
                  <span>{googleLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-[#0c1326] px-2 text-slate-400">Or enter credentials</span>
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
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-900/90 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-slate-900 border-white/20 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400">Remember this terminal session</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-semibold text-sm transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Terminal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Card Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 text-center text-xs text-slate-400">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 ml-1 transition"
                >
                  Sign Up for Free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-2">Reset Password</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your registered institutional email to receive secure password recovery instructions.
            </p>

            {forgotSent ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Password reset email dispatched!
                </div>
                <p className="text-[11px] text-slate-300">
                  If an account exists for {forgotEmail || 'this email'}, you will receive a recovery token shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSent(false);
                  }}
                  className="w-full py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (forgotEmail) setForgotSent(true);
                }}
                className="space-y-4"
              >
                <input
                  type="email"
                  required
                  placeholder="investor@domain.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg cursor-pointer transition"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Google Authentication Modal */}
      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSelectAccount={handleGoogleAccountSelect}
        isLoading={googleLoading}
        mode="signin"
      />
    </div>
  );
}
