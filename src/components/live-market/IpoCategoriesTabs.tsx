'use client';

import React, { useState, useMemo } from 'react';
import {
  LiveMarketIpoItem,
  IpoCategoryTab,
} from '@/types/liveMarket';
import {
  Search,
  Filter,
  Star,
  Flame,
  Calendar,
  Clock,
  TrendingUp,
  BarChart2,
  ExternalLink,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface IpoCategoriesTabsProps {
  ipos: LiveMarketIpoItem[];
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
  onOpenDetails: (ipo: LiveMarketIpoItem) => void;
  onOpenGmpTrend: (ipo: LiveMarketIpoItem) => void;
  onOpenStockChart: (ipo: LiveMarketIpoItem) => void;
}

export const IpoCategoriesTabs: React.FC<IpoCategoriesTabsProps> = ({
  ipos,
  watchlist,
  onToggleWatchlist,
  onOpenDetails,
  onOpenGmpTrend,
  onOpenStockChart,
}) => {
  const [activeTab, setActiveTab] = useState<IpoCategoryTab>('open');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<'all' | 'EQ' | 'SME'>('all');
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'gmp' | 'subscription' | 'issuesize' | 'listingdate' | 'price' | 'change'>('gmp');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Counts by category
  const counts = useMemo(() => {
    return {
      upcoming: ipos.filter((i) => i.status === 'Upcoming').length,
      open: ipos.filter((i) => i.status === 'Open').length,
      closed: ipos.filter((i) => i.status === 'Closed').length,
      listed: ipos.filter((i) => i.status === 'Listed').length,
    };
  }, [ipos]);

  // Filter & Sort
  const filteredIpos = useMemo(() => {
    return ipos
      .filter((ipo) => {
        // Tab matching
        if (activeTab === 'upcoming' && ipo.status !== 'Upcoming') return false;
        if (activeTab === 'open' && ipo.status !== 'Open') return false;
        if (activeTab === 'closed' && ipo.status !== 'Closed') return false;
        if (activeTab === 'listed' && ipo.status !== 'Listed') return false;

        // Series matching
        if (seriesFilter !== 'all' && ipo.series !== seriesFilter) return false;

        // Watchlist filter
        if (watchlistOnly && !watchlist.includes(ipo.symbol.toUpperCase())) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchSym = ipo.symbol.toLowerCase().includes(q);
          const matchName = ipo.companyName.toLowerCase().includes(q);
          if (!matchSym && !matchName) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'gmp') return b.gmpPercent - a.gmpPercent;
        if (sortBy === 'subscription') return b.currentSubscription - a.currentSubscription;
        if (sortBy === 'price') return (b.currentPrice || b.priceHigh) - (a.currentPrice || a.priceHigh);
        if (sortBy === 'change') return (b.dayChangePercent || 0) - (a.dayChangePercent || 0);
        if (sortBy === 'issuesize') return b.priceHigh * b.lotSize - a.priceHigh * a.lotSize;
        return 0;
      });
  }, [ipos, activeTab, seriesFilter, watchlistOnly, searchQuery, sortBy, watchlist]);

  return (
    <div className="space-y-5">
      {/* Category Tabs & Controls Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main 4 Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/5">
            {[
              { id: 'open', label: 'Open for Bidding', count: counts.open, live: true },
              { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
              { id: 'closed', label: 'Closed / Past', count: counts.closed },
              { id: 'listed', label: 'Listed Market', count: counts.listed },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.live && activeTab === tab.id ? (
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                ) : tab.live ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ) : null}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    activeTab === tab.id ? 'bg-slate-950/20 text-slate-950' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Filter Controls: Series, Watchlist, View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Watchlist Toggle */}
            <button
              onClick={() => setWatchlistOnly(!watchlistOnly)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                watchlistOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${watchlistOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Watchlist</span>
              {watchlist.length > 0 && (
                <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-white/10 text-slate-300">
                  {watchlist.length}
                </span>
              )}
            </button>

            {/* Segment Selector (Mainboard vs SME) */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
              <button
                onClick={() => setSeriesFilter('all')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  seriesFilter === 'all' ? 'bg-white/15 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSeriesFilter('EQ')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  seriesFilter === 'EQ' ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mainboard
              </button>
              <button
                onClick={() => setSeriesFilter('SME')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  seriesFilter === 'SME' ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                SME
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Sort Controls Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search IPO or company (e.g. Tata, Swiggy, Premier)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs text-slate-400">
            <span className="shrink-0 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" />
              Sort By:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950/90 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="gmp">Highest GMP (%)</option>
              <option value="subscription">Highest Subscription (x)</option>
              <option value="price">Issue / Current Price</option>
              <option value="change">Day % Change</option>
              <option value="issuesize">Issue Size</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid or Table Listing */}
      {filteredIpos.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl border border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No IPOs match your criteria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query, selecting &quot;All Series&quot;, or clearing the watchlist filter.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredIpos.map((ipo) => {
            const isWatchlisted = watchlist.includes(ipo.symbol.toUpperCase());
            const isOpen = ipo.status === 'Open';
            const isUpcoming = ipo.status === 'Upcoming';
            const isListed = ipo.status === 'Listed';

            return (
              <div
                key={ipo.symbol}
                className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between hover:border-cyan-500/40 transition group relative"
              >
                <div>
                  {/* Card Top: Badges & Watchlist */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">{ipo.symbol}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            ipo.series === 'SME'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {ipo.series}
                        </span>
                      </div>
                      <h4 className="text-xs text-slate-300 font-medium line-clamp-1 group-hover:text-cyan-300 transition">
                        {ipo.companyName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOpen ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Open
                        </span>
                      ) : isUpcoming ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          Upcoming
                        </span>
                      ) : isListed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          Listed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                          Closed
                        </span>
                      )}

                      {/* Watchlist Star Button */}
                      <button
                        onClick={() => onToggleWatchlist(ipo.symbol)}
                        title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                      >
                        <Star className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Dates / Remaining Time */}
                  <div className="flex items-center justify-between text-[11px] font-mono py-1.5 px-2.5 rounded-lg bg-slate-950/50 border border-white/5 mb-3 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      {isUpcoming
                        ? `Opens: ${ipo.openDate}`
                        : isOpen
                        ? `Closes: ${ipo.closeDate}`
                        : `Listed: ${ipo.listingDate}`}
                    </span>
                    {isOpen && ipo.remainingTime && (
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                        {ipo.remainingTime}
                      </span>
                    )}
                  </div>

                  {/* Pricing Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {isListed ? 'Current Price (LTP)' : 'Price Band'}
                      </span>
                      <span className="font-mono text-sm font-extrabold text-white mt-0.5 block truncate">
                        {isListed ? `₹${ipo.currentPrice?.toFixed(2)}` : ipo.priceBand}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {isListed ? 'Today\'s Change' : `Lot Size (${ipo.lotSize} shares)`}
                      </span>
                      {isListed ? (
                        <span
                          className={`font-mono text-sm font-bold mt-0.5 block ${
                            (ipo.dayChange || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {(ipo.dayChange || 0) >= 0 ? '+' : ''}₹{ipo.dayChange?.toFixed(2)} ({ipo.dayChangePercent}%)
                        </span>
                      ) : (
                        <span className="font-mono text-sm font-bold text-cyan-300 mt-0.5 block">
                          ₹{(ipo.priceHigh * ipo.lotSize).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subscription Multiples & GMP Banner */}
                  <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-white/5 mb-4">
                    {/* Subscription multiple */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1">
                          <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                          Subscription
                        </span>
                        <span className="font-mono font-bold text-cyan-300">
                          {ipo.currentSubscription > 0 ? `${ipo.currentSubscription}x` : isUpcoming ? 'Awaiting Open' : '—'}
                        </span>
                      </div>
                      {/* Sub-category pills */}
                      {ipo.currentSubscription > 0 && (
                        <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono text-center">
                          <div className="p-1 rounded bg-white/5">
                            <span className="text-slate-400 block text-[9px]">Retail</span>
                            <span className="text-slate-200 font-semibold">{ipo.retailSubscription}x</span>
                          </div>
                          <div className="p-1 rounded bg-white/5">
                            <span className="text-slate-400 block text-[9px]">NII</span>
                            <span className="text-slate-200 font-semibold">{ipo.niiSubscription}x</span>
                          </div>
                          <div className="p-1 rounded bg-white/5">
                            <span className="text-slate-400 block text-[9px]">QIB</span>
                            <span className="text-slate-200 font-semibold">{ipo.qibSubscription}x</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* GMP Metric */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-purple-400" />
                        Estimated GMP
                      </span>
                      <div className="flex items-center gap-1 font-mono font-bold text-purple-300">
                        <span>+₹{ipo.gmp}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 border border-purple-500/25">
                          +{ipo.gmpPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => onOpenDetails(ipo)}
                    className="py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>Details</span>
                  </button>

                  <button
                    onClick={() => onOpenGmpTrend(ipo)}
                    className="py-2 px-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Flame className="w-3 h-3 text-purple-400" />
                    <span>GMP</span>
                  </button>

                  <button
                    onClick={() => onOpenStockChart(ipo)}
                    className="py-2 px-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <TrendingUp className="w-3 h-3 text-cyan-400" />
                    <span>Chart</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/70 text-slate-400 font-semibold">
                  <th className="py-3 px-4 w-10">★</th>
                  <th className="py-3 px-4">Company & Symbol</th>
                  <th className="py-3 px-4">Price Band</th>
                  <th className="py-3 px-4">
                    {activeTab === 'open' ? 'Subscription (Total / QIB)' : 'Dates'}
                  </th>
                  <th className="py-3 px-4">Estimated GMP</th>
                  <th className="py-3 px-4">Lot Size / Issue</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredIpos.map((ipo) => {
                  const isWatchlisted = watchlist.includes(ipo.symbol.toUpperCase());
                  const isListed = ipo.status === 'Listed';

                  return (
                    <tr key={ipo.symbol} className="hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onToggleWatchlist(ipo.symbol)}
                          title="Watchlist"
                          className="cursor-pointer text-slate-500 hover:text-amber-400"
                        >
                          <Star className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">{ipo.symbol}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-white/5 text-slate-300">
                            {ipo.series}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 max-w-[200px]">
                          {ipo.companyName}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-white">
                        {isListed ? `₹${ipo.currentPrice?.toFixed(2)}` : ipo.priceBand}
                      </td>

                      <td className="py-3.5 px-4">
                        {activeTab === 'open' ? (
                          <div className="font-mono">
                            <span className="text-cyan-300 font-bold block">{ipo.currentSubscription}x Total</span>
                            <span className="text-[10px] text-slate-400 block">QIB: {ipo.qibSubscription}x</span>
                          </div>
                        ) : (
                          <div className="font-mono text-slate-300 text-[11px]">
                            {ipo.openDate} – {ipo.closeDate}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-purple-300">
                          +₹{ipo.gmp} ({ipo.gmpPercent}%)
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="font-mono font-medium block">{ipo.lotSize} shares</span>
                        <span className="text-[10px] text-slate-500 block">{ipo.issueSize}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetails(ipo)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-medium transition cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => onOpenGmpTrend(ipo)}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-[11px] font-medium transition cursor-pointer"
                          >
                            GMP
                          </button>
                          <button
                            onClick={() => onOpenStockChart(ipo)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[11px] font-medium transition cursor-pointer"
                          >
                            Chart
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
    </div>
  );
};
