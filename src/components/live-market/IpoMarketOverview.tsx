'use client';

import React from 'react';
import {
  Calendar,
  Flame,
  Clock,
  TrendingUp,
  Layers,
  ArrowUpRight,
  BarChart2,
  Award,
  Sparkles,
} from 'lucide-react';
import { LiveMarketIpoItem, LiveMarketOverviewResponse } from '@/types/liveMarket';

interface IpoMarketOverviewProps {
  overview?: {
    upcomingCount: number;
    openCount: number;
    closingSoonCount: number;
    recentlyListedCount: number;
    totalTrackedCount: number;
  };
  data?: LiveMarketOverviewResponse | null;
  loading?: boolean;
  topGainer?: LiveMarketIpoItem;
  topSubscribed?: LiveMarketIpoItem;
  topGmp?: LiveMarketIpoItem;
  onSelectIpo?: (ipo: any) => void;
}

export const IpoMarketOverview: React.FC<IpoMarketOverviewProps> = ({
  overview,
  data,
  loading = false,
  topGainer,
  topSubscribed,
  topGmp,
  onSelectIpo,
}) => {
  const activeOverview = data?.overview || overview || {
    upcomingCount: 0,
    openCount: 0,
    closingSoonCount: 0,
    recentlyListedCount: 0,
    totalTrackedCount: 0,
  };

  const activeTopGainer = topGainer || data?.topGainer;
  const activeTopSubscribed = topSubscribed || data?.topSubscribed;
  const activeTopGmp = topGmp || data?.topGmp;
  return (
    <div className="space-y-4">
      {/* 5 Core Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Currently Open IPOs */}
        <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex flex-col justify-between hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Currently Open</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 live-pulse" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {activeOverview.openCount}
            </span>
            <span className="text-xs text-emerald-400 block font-medium mt-0.5">Bidding Active</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">SEBI ASBA/UPI enabled</p>
        </div>

        {/* Card 2: Upcoming IPOs */}
        <div className="glass-card p-4 rounded-2xl border border-blue-500/20 bg-blue-950/10 flex flex-col justify-between hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Upcoming IPOs</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {activeOverview.upcomingCount}
            </span>
            <span className="text-xs text-blue-400 block font-medium mt-0.5">In Pipeline</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">SEBI cleared & scheduled</p>
        </div>

        {/* Card 3: Closing Soon */}
        <div className="glass-card p-4 rounded-2xl border border-rose-500/20 bg-rose-950/10 flex flex-col justify-between hover:border-rose-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Closing Soon</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {activeOverview.closingSoonCount}
            </span>
            <span className="text-xs text-rose-400 block font-medium mt-0.5">Final 24 Hours</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Mandate cutoff approaching</p>
        </div>

        {/* Card 4: Recently Listed */}
        <div className="glass-card p-4 rounded-2xl border border-purple-500/20 bg-purple-950/10 flex flex-col justify-between hover:border-purple-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Recently Listed</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {activeOverview.recentlyListedCount}
            </span>
            <span className="text-xs text-purple-400 block font-medium mt-0.5">Secondary Trading</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Live NSE quotes active</p>
        </div>

        {/* Card 5: Total IPOs Tracked */}
        <div className="glass-card p-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/10 flex flex-col justify-between hover:border-cyan-500/40 transition col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Tracked</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {activeOverview.totalTrackedCount}
            </span>
            <span className="text-xs text-cyan-400 block font-medium mt-0.5">Primary Issues</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Mainboard & SME Emerge</p>
        </div>
      </div>

      {/* Top Standout Highlights: Top Gainer, Peak Subscription, Top GMP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {activeTopGainer && (
          <div
            onClick={() => onSelectIpo && onSelectIpo(activeTopGainer)}
            className="p-3.5 rounded-xl glass-panel border border-emerald-500/25 bg-emerald-950/20 flex items-center justify-between cursor-pointer hover:border-emerald-500/50 transition"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                Top Secondary Market Performer
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-extrabold text-white text-base">{activeTopGainer.symbol}</span>
                <span className="font-mono font-bold text-xs text-emerald-400">
                  +{activeTopGainer.dayChangePercent}% today
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{activeTopGainer.companyName}</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-bold text-white block">₹{activeTopGainer.currentPrice?.toFixed(2)}</span>
              <span className="text-[10px] text-emerald-300 font-mono">
                +₹{activeTopGainer.dayChange?.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {activeTopSubscribed && (
          <div
            onClick={() => onSelectIpo && onSelectIpo(activeTopSubscribed)}
            className="p-3.5 rounded-xl glass-panel border border-cyan-500/25 bg-cyan-950/20 flex items-center justify-between cursor-pointer hover:border-cyan-500/50 transition"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                Peak Subscription Multiple
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-extrabold text-white text-base">{activeTopSubscribed.symbol}</span>
                <span className="font-mono font-bold text-xs text-cyan-300">
                  {activeTopSubscribed.currentSubscription}x Subscribed
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{activeTopSubscribed.companyName}</p>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                QIB: {activeTopSubscribed.qibSubscription}x
              </span>
            </div>
          </div>
        )}

        {activeTopGmp && (
          <div
            onClick={() => onSelectIpo && onSelectIpo(activeTopGmp)}
            className="p-3.5 rounded-xl glass-panel border border-purple-500/25 bg-purple-950/20 flex items-center justify-between cursor-pointer hover:border-purple-500/50 transition"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-purple-400" />
                Highest Estimated GMP
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-extrabold text-white text-base">{activeTopGmp.symbol}</span>
                <span className="font-mono font-bold text-xs text-purple-300">
                  +{activeTopGmp.gmpPercent}% Premium
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{activeTopGmp.companyName}</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-bold text-purple-300 block">+₹{activeTopGmp.gmp}</span>
              <span className="text-[10px] text-slate-400 font-mono">Unofficial GMP</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
