'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LiveIpoSummary, IpoStatus, IpoSeries } from '@/types/ipo';
import { RealtimeTicker } from './RealtimeTicker';
import { IpoDetailModal } from './IpoDetailModal';
import { LiveIpoChartModal } from './LiveIpoChartModal';
import { ListedIposTable } from './ListedIposTable';
import {
  TrendingUp,
  Sparkles,
  Layers,
  Search,
  ExternalLink,
  Calendar,
  BarChart2,
  RefreshCw,
  LayoutGrid,
  List,
  Flame,
  Clock,
  Building2,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Radio,
} from 'lucide-react';

interface LiveIpoRadarProps {
  onApplyWithPans: (symbol: string, companyName: string, price: number, lotSize: number) => void;
  onAnalyzeAi: (symbol: string, companyName: string) => void;
  onIposLoaded?: (count: number) => void;
}

export const LiveIpoRadar: React.FC<LiveIpoRadarProps> = ({
  onApplyWithPans,
  onAnalyzeAi,
  onIposLoaded,
}) => {
  // Navigation & Sub-views: Primary Market (Live/Upcoming/Closed) vs Secondary Market (Listed Tracker)
  const [marketView, setMarketView] = useState<'primary' | 'listed'>('primary');

  // IPO State
  const [ipos, setIpos] = useState<LiveIpoSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [counts, setCounts] = useState<{ total: number; active: number; forthcoming: number; closed: number }>({
    total: 0,
    active: 0,
    forthcoming: 0,
    closed: 0,
  });

  // Filters & Controls
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Forthcoming' | 'Closed'>('all');
  const [seriesFilter, setSeriesFilter] = useState<'all' | 'EQ' | 'SME'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'multiple' | 'gmp' | 'date' | 'alphabetical'>('multiple');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [selectedDetailSymbol, setSelectedDetailSymbol] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  const [selectedChartIpo, setSelectedChartIpo] = useState<{
    symbol: string;
    companyName: string;
    issuePrice?: number | string;
    listingPrice?: number | string;
  } | null>(null);
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);

  // Fetch live IPO list from API
  const fetchIpos = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    try {
      const res = await fetch('/api/ipos/live');
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setIpos(json.data);
        if (json.counts) {
          setCounts(json.counts);
          if (onIposLoaded) {
            onIposLoaded(json.counts.active || 0);
          }
        } else {
          const activeCount = json.data.filter((item: LiveIpoSummary) => item.status === 'Active').length;
          if (onIposLoaded) {
            onIposLoaded(activeCount);
          }
        }
        setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to load live IPO radar data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [onIposLoaded]);

  useEffect(() => {
    fetchIpos(false);
  }, [fetchIpos]);

  // Helpers to parse price & lot size safely for bidding
  const parseNumericPrice = (priceStr?: string): number => {
    if (!priceStr) return 100;
    const clean = priceStr.replace(/[^\d.]/g, ' ').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const high = parseFloat(parts[parts.length - 1]);
      return isNaN(high) ? 100 : high;
    }
    return 100;
  };

  const parseNumericLotSize = (lotSize?: string | number): number => {
    if (!lotSize) return 14;
    if (typeof lotSize === 'number') return lotSize;
    const clean = lotSize.replace(/[^\d]/g, '');
    const num = parseInt(clean, 10);
    return isNaN(num) || num <= 0 ? 14 : num;
  };

  // Filtered & Sorted IPO List
  const filteredIpos = useMemo(() => {
    return ipos
      .filter((ipo) => {
        // Status filter
        if (statusFilter !== 'all' && ipo.status !== statusFilter) {
          return false;
        }
        // Series filter
        if (seriesFilter !== 'all' && ipo.series !== seriesFilter) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesSym = ipo.symbol.toLowerCase().includes(q);
          const matchesName = ipo.companyName.toLowerCase().includes(q);
          if (!matchesSym && !matchesName) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'multiple') {
          const multA = parseFloat(a.noOfTime || '0') || 0;
          const multB = parseFloat(b.noOfTime || '0') || 0;
          return multB - multA;
        }
        if (sortBy === 'gmp') {
          const gmpA = a.gmpPercent || 0;
          const gmpB = b.gmpPercent || 0;
          return gmpB - gmpA;
        }
        if (sortBy === 'date') {
          return (b.issueStartDate || '').localeCompare(a.issueStartDate || '');
        }
        if (sortBy === 'alphabetical') {
          return a.companyName.localeCompare(b.companyName);
        }
        return 0;
      });
  }, [ipos, statusFilter, seriesFilter, searchQuery, sortBy]);

  // Derived KPI metrics
  const activeCount = counts.active || ipos.filter((i) => i.status === 'Active').length;
  const forthcomingCount = counts.forthcoming || ipos.filter((i) => i.status === 'Forthcoming').length;
  const topGmpIpo = useMemo(() => {
    if (ipos.length === 0) return null;
    return [...ipos].sort((a, b) => (b.gmpPercent || 0) - (a.gmpPercent || 0))[0];
  }, [ipos]);
  const mostSubscribedIpo = useMemo(() => {
    if (ipos.length === 0) return null;
    return [...ipos].sort((a, b) => (parseFloat(b.noOfTime || '0') || 0) - (parseFloat(a.noOfTime || '0') || 0))[0];
  }, [ipos]);

  // Open Details Modal
  const handleOpenDetails = (symbol: string) => {
    setSelectedDetailSymbol(symbol);
    setIsDetailModalOpen(true);
  };

  // Open Chart Modal
  const handleOpenChart = (
    symbol: string,
    companyName: string,
    issuePrice?: number | string,
    listingPrice?: number | string
  ) => {
    setSelectedChartIpo({ symbol, companyName, issuePrice, listingPrice });
    setIsChartModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Real-time Auto-Sync Ticker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
              Live IPO Radar
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              NSE Direct Feed
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time subscription multiples, Grey Market Premium (GMP), and institutional bidding book across Mainboard & SME.
          </p>
        </div>

        {/* View Switcher: Primary Market vs Listed Tracker */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 shrink-0">
          <button
            onClick={() => setMarketView('primary')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              marketView === 'primary'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Primary Market (IPO)</span>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-950 text-cyan-300">
                {activeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMarketView('listed')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              marketView === 'listed'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Post-Listing Tracker</span>
          </button>
        </div>
      </div>

      {/* Render Listed IPOs View if active */}
      {marketView === 'listed' ? (
        <ListedIposTable onAnalyzeAi={onAnalyzeAi} />
      ) : (
        <>
          {/* Realtime Auto-Sync Ticker */}
          <RealtimeTicker
            onTick={() => fetchIpos(true)}
            isRefreshing={isRefreshing}
            lastSyncTime={lastSyncTime}
          />

          {/* Institutional KPI Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Active Bidding */}
            <div className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Live Bidding Open</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 live-pulse" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-mono font-extrabold text-white">{activeCount}</span>
                <span className="text-xs text-emerald-400 font-medium">Issues accepting bids</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Direct broker UPI mandate enabled</p>
            </div>

            {/* KPI 2: Upcoming Pipeline */}
            <div className="glass-card p-4 rounded-xl border border-blue-500/20 bg-blue-950/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Upcoming Issues</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-mono font-extrabold text-white">{forthcomingCount}</span>
                <span className="text-xs text-blue-400 font-medium">Forthcoming</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">SEBI cleared & opening soon</p>
            </div>

            {/* KPI 3: Top Demand / GMP */}
            <div className="glass-card p-4 rounded-xl border border-purple-500/20 bg-purple-950/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Highest GMP Premium</span>
                <Flame className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-mono font-extrabold text-purple-300">
                  +{topGmpIpo?.gmpPercent || 0}%
                </span>
                <span className="text-xs font-mono text-slate-300 truncate max-w-[90px]">
                  {topGmpIpo?.symbol || 'N/A'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Grey market premium estimate</p>
            </div>

            {/* KPI 4: Most Subscribed Issue */}
            <div className="glass-card p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Peak Subscription</span>
                <BarChart2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-mono font-extrabold text-cyan-300">
                  {mostSubscribedIpo?.noOfTime || '0.00'}x
                </span>
                <span className="text-xs font-mono text-slate-300 truncate max-w-[90px]">
                  {mostSubscribedIpo?.symbol || 'N/A'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Overall book multiple</p>
            </div>
          </div>

          {/* Filtering, Search & View Controls Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/5">
                {[
                  { id: 'all', label: 'All Issues', count: ipos.length },
                  { id: 'Active', label: 'Live Bidding', count: activeCount, live: true },
                  { id: 'Forthcoming', label: 'Upcoming', count: forthcomingCount },
                  { id: 'Closed', label: 'Closed / Past', count: counts.closed || ipos.filter((i) => i.status === 'Closed').length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === tab.id
                        ? 'bg-white/10 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {tab.live && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                    <span>{tab.label}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/5 text-slate-400">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Segment (EQ vs SME) Filter */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/5 text-xs">
                  <button
                    onClick={() => setSeriesFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      seriesFilter === 'all'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Series
                  </button>
                  <button
                    onClick={() => setSeriesFilter('EQ')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      seriesFilter === 'EQ'
                        ? 'bg-blue-500/20 text-blue-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mainboard
                  </button>
                  <button
                    onClick={() => setSeriesFilter('SME')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      seriesFilter === 'SME'
                        ? 'bg-purple-500/20 text-purple-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    NSE SME
                  </button>
                </div>

                {/* View Mode Toggle: Grid vs Table */}
                <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/5">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid Card View"
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    title="Compact Table View"
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Search & Sort */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-white/5">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by company or symbol (e.g. NSE, SWIGGY)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs text-slate-400">
                <span className="shrink-0 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Sort By:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Sort IPOs by"
                  className="bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="multiple">Highest Subscribed (x)</option>
                  <option value="gmp">Highest GMP (%)</option>
                  <option value="date">Issue Date (Newest)</option>
                  <option value="alphabetical">Company Name (A-Z)</option>
                </select>

                <button
                  onClick={() => fetchIpos(true)}
                  disabled={isRefreshing}
                  title="Refresh IPO list"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && ipos.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="h-5 w-24 bg-white/10 rounded" />
                      <div className="h-4 w-44 bg-white/5 rounded" />
                    </div>
                    <div className="h-6 w-16 bg-white/10 rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="h-10 bg-white/5 rounded-lg" />
                    <div className="h-10 bg-white/5 rounded-lg" />
                  </div>
                  <div className="h-9 bg-white/10 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredIpos.length === 0 ? (
            /* Empty State */
            <div className="glass-card p-12 rounded-2xl border border-white/5 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No IPOs Matched Your Filters</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Try adjusting your search query, status filters, or series selector to view all primary market offerings.
                </p>
              </div>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSeriesFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition cursor-pointer font-medium"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Card Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredIpos.map((ipo) => {
                const numericPrice = parseNumericPrice(ipo.issuePrice || ipo.priceBand);
                const numericLotSize = parseNumericLotSize(ipo.lotSize);
                const minInvestment = numericPrice * numericLotSize;
                const multiple = parseFloat(ipo.noOfTime || '0') || 0;
                const isLive = ipo.status === 'Active';
                const isUpcoming = ipo.status === 'Forthcoming';

                return (
                  <div
                    key={ipo.symbol}
                    className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between hover:border-cyan-500/30 transition group"
                  >
                    <div>
                      {/* Card Top: Badges & Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-white tracking-wide">
                              {ipo.symbol}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                ipo.series === 'SME'
                                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {ipo.series === 'SME' ? 'SME' : 'Mainboard'}
                            </span>
                          </div>
                          <h3
                            title={ipo.companyName}
                            className="text-xs text-slate-300 font-medium line-clamp-1 group-hover:text-cyan-300 transition"
                          >
                            {ipo.companyName}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isLive ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Live Bidding
                            </span>
                          ) : isUpcoming ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-blue-400" />
                              Upcoming
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                              Closed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Issue Period Dates */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono py-1.5 px-2.5 rounded-lg bg-slate-950/40 border border-white/5 mb-4">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Dates:</span>
                        <span className="text-slate-200">
                          {ipo.issueStartDate || 'TBD'} — {ipo.issueEndDate || 'TBD'}
                        </span>
                      </div>

                      {/* Pricing & Min Investment Grid */}
                      <div className="grid grid-cols-2 gap-2.5 py-1 mb-4">
                        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
                          <span className="text-[10px] text-slate-400 font-medium block">Price Band</span>
                          <span className="font-mono text-sm font-bold text-white mt-0.5 block truncate">
                            {ipo.priceBand || ipo.issuePrice || 'TBD'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Min Investment ({numericLotSize} shares)
                          </span>
                          <span className="font-mono text-sm font-bold text-cyan-300 mt-0.5 block">
                            ₹{minInvestment > 0 ? minInvestment.toLocaleString('en-IN') : 'TBD'}
                          </span>
                        </div>
                      </div>

                      {/* Metrics: Subscription Multiple & GMP */}
                      <div className="space-y-2 mb-4 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                        {/* Overall Subscription */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1">
                              <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
                              Subscription
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                multiple >= 10
                                  ? 'text-emerald-400'
                                  : multiple >= 1
                                  ? 'text-cyan-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {multiple > 0 ? `${multiple.toFixed(2)}x` : isLive ? '0.00x' : 'Pending'}
                            </span>
                          </div>
                          {/* Visual progress bar */}
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                multiple >= 10
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : multiple >= 1
                                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                  : 'bg-slate-600'
                              }`}
                              style={{ width: `${Math.min(100, (multiple / 15) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Grey Market Premium (GMP) */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            Estimated GMP
                          </span>
                          {ipo.gmpPercent && ipo.gmpPercent > 0 ? (
                            <div className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                              <span>+₹{ipo.gmpEstimate || 0}</span>
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30">
                                +{ipo.gmpPercent}%
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-slate-500 text-[11px]">
                              {ipo.gmpEstimate ? `₹${ipo.gmpEstimate}` : 'TBD / Flat'}
                            </span>
                          )}
                        </div>

                        {/* Registrar badge */}
                        {ipo.registrarName && (
                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                            <span>Registrar:</span>
                            <a
                              href={ipo.registrarUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-cyan-400 truncate max-w-[150px] inline-flex items-center gap-1"
                            >
                              {ipo.registrarName.split(' ')[0]}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {/* Row 1: Primary Action - Apply Multi-PAN */}
                      <button
                        onClick={() =>
                          onApplyWithPans(ipo.symbol, ipo.companyName, numericPrice, numericLotSize)
                        }
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-950" />
                        <span>Apply with Family PANs</span>
                      </button>

                      {/* Row 2: Secondary Quick Actions */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => handleOpenDetails(ipo.symbol)}
                          title="Category subscription book & bid curve"
                          className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <BarChart2 className="w-3 h-3 text-cyan-400" />
                          <span>Book</span>
                        </button>

                        <button
                          onClick={() => onAnalyzeAi(ipo.symbol, ipo.companyName)}
                          title="Ask AI DRHP Analyst"
                          className="py-1.5 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 hover:text-purple-200 text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>AI DRHP</span>
                        </button>

                        <button
                          onClick={() => handleOpenChart(ipo.symbol, ipo.companyName, ipo.issuePrice || ipo.priceBand, ipo.listingPrice)}
                          title="View live or listing charts"
                          className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-blue-400" />
                          <span>Chart</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-950/60 text-slate-400 font-medium">
                      <th className="py-3 px-4">Symbol & Company</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Dates</th>
                      <th className="py-3 px-4">Price Band</th>
                      <th className="py-3 px-4">Lot Size / Min Inv</th>
                      <th className="py-3 px-4">Subscription</th>
                      <th className="py-3 px-4">Est. GMP</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredIpos.map((ipo) => {
                      const numericPrice = parseNumericPrice(ipo.issuePrice || ipo.priceBand);
                      const numericLotSize = parseNumericLotSize(ipo.lotSize);
                      const minInvestment = numericPrice * numericLotSize;
                      const multiple = parseFloat(ipo.noOfTime || '0') || 0;
                      const isLive = ipo.status === 'Active';

                      return (
                        <tr key={ipo.symbol} className="hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">
                                {ipo.symbol}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  ipo.series === 'SME'
                                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                    : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {ipo.series === 'SME' ? 'SME' : 'EQ'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1 max-w-[220px]">
                              {ipo.companyName}
                            </p>
                          </td>

                          <td className="py-3.5 px-4">
                            {isLive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live
                              </span>
                            ) : ipo.status === 'Forthcoming' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                Upcoming
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                                Closed
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {ipo.issueStartDate || 'TBD'} — {ipo.issueEndDate || 'TBD'}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-semibold text-white">
                            {ipo.priceBand || ipo.issuePrice || 'TBD'}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-mono text-cyan-300 font-semibold block">
                              ₹{minInvestment > 0 ? minInvestment.toLocaleString('en-IN') : 'TBD'}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {numericLotSize} shares
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`font-mono font-bold ${
                                multiple >= 10
                                  ? 'text-emerald-400'
                                  : multiple >= 1
                                  ? 'text-cyan-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {multiple > 0 ? `${multiple.toFixed(2)}x` : '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {ipo.gmpPercent && ipo.gmpPercent > 0 ? (
                              <span className="font-mono font-bold text-emerald-400">
                                +₹{ipo.gmpEstimate} (+{ipo.gmpPercent}%)
                              </span>
                            ) : (
                              <span className="font-mono text-slate-500 text-[11px]">
                                {ipo.gmpEstimate ? `₹${ipo.gmpEstimate}` : '—'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  onApplyWithPans(ipo.symbol, ipo.companyName, numericPrice, numericLotSize)
                                }
                                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition cursor-pointer"
                              >
                                Apply PANs
                              </button>
                              <button
                                onClick={() => handleOpenDetails(ipo.symbol)}
                                title="Bidding Breakdown"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition cursor-pointer"
                              >
                                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                              </button>
                              <button
                                onClick={() => onAnalyzeAi(ipo.symbol, ipo.companyName)}
                                title="AI DRHP"
                                className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Deep-dive Category Bidding & Subscription Modal */}
      <IpoDetailModal
        symbol={selectedDetailSymbol}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailSymbol(null);
        }}
        onApplyWithPans={onApplyWithPans}
        onAnalyzeAi={onAnalyzeAi}
      />

      {/* Technical / Listing Chart Modal */}
      <LiveIpoChartModal
        symbol={selectedChartIpo?.symbol || null}
        companyName={selectedChartIpo?.companyName}
        issuePrice={selectedChartIpo?.issuePrice}
        listingPrice={selectedChartIpo?.listingPrice}
        isOpen={isChartModalOpen}
        onClose={() => {
          setIsChartModalOpen(false);
          setSelectedChartIpo(null);
        }}
      />
    </div>
  );
};
