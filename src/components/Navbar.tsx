'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Radio,
  Activity,
  Sparkles,
  Users,
  CheckCircle,
  PieChart,
  ShieldCheck,
  RefreshCw,
  LogIn,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Building2,
} from 'lucide-react';

export type ActiveTab = 'radar' | 'analyst' | 'pans' | 'allotment' | 'portfolio';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeIpoCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  lastUpdatedTime?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeIpoCount,
  isRefreshing,
  onRefresh,
  lastUpdatedTime,
}) => {
  const { user, isAuthenticated, signOut, loginWithDemo } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 bg-[#070b14]/90">
      {/* Top Bar: Market Pulse & Live Feed Indicator */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 border-b border-white/5 py-2 text-xs">
          {/* Market Indices Ticker */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 font-medium">NIFTY 50</span>
              <span className="text-slate-200 font-semibold">25,385.20</span>
              <span className="text-emerald-400 font-medium">+0.48%</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 font-medium">SENSEX</span>
              <span className="text-slate-200 font-semibold">82,912.45</span>
              <span className="text-emerald-400 font-medium">+0.42%</span>
            </div>
            <div className="h-3 w-px bg-white/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 font-medium">NIFTY IPO INDEX</span>
              <span className="text-slate-200 font-semibold">14,240.10</span>
              <span className="text-emerald-400 font-medium">+1.85%</span>
            </div>
          </div>

          {/* Right Side: Live NSE Status & User Authentication */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 live-pulse" />
              <span className="font-semibold tracking-wide uppercase text-[10px]">LIVE NSE INDIA</span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh live data from NSE India"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden md:inline">{isRefreshing ? 'Syncing...' : 'Sync NSE'}</span>
            </button>

            <div className="h-3.5 w-px bg-white/10" />

            {/* User Profile / Auth State */}
            {isAuthenticated && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center text-[10px] font-bold text-black shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium max-w-[100px] truncate hidden md:inline">
                    {user.name}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                    {user.investorCategory || user.role}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl glass-panel border border-white/15 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2.5 border-b border-white/10">
                      <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                          {user.investorCategory} Category
                        </span>
                        {user.primaryPan && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            PAN: {user.primaryPan}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-1 space-y-0.5 border-b border-white/10 my-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 px-2 py-1 block">
                        Switch Demo Profile
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          loginWithDemo('institutional');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>HNI Desk (Arjun)</span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-medium">bNII</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          loginWithDemo('retail');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-purple-400" />
                          <span>Family Office (Priya)</span>
                        </div>
                        <span className="text-[10px] text-purple-400 font-medium">Retail</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/signin"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Sign In</span>
                </Link>

                <Link
                  href="/signup"
                  className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold border border-white/10 transition cursor-pointer"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="flex items-center justify-between py-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 flex items-center">
              <img
                src="/logo.png"
                alt="IPOLENS Logo"
                className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  NSE REAL-TIME
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-1">
                Institutional Primary Market & Portfolio Intelligence
              </p>
            </div>
          </div>

          {/* Module Navigation Tabs */}
          <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10">
            <button
              onClick={() => setActiveTab('radar')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'radar'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live IPO Radar</span>
              {activeIpoCount > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === 'radar' ? 'bg-black/20 text-black' : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  {activeIpoCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analyst')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'analyst'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI DRHP Analyst</span>
            </button>

            <button
              onClick={() => setActiveTab('pans')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'pans'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Family PANs</span>
            </button>

            <button
              onClick={() => setActiveTab('allotment')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'allotment'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>1-Click Allotment</span>
            </button>

            <button
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Demat Portfolio</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
