'use client';

import React, { useState, useEffect } from 'react';
import { ListedIpoItem } from '@/types/listedIpo';
import { LiveIpoChartModal } from './LiveIpoChartModal';
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Sparkles,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Award,
  DollarSign,
  Activity,
  Layers,
  LayoutGrid,
} from 'lucide-react';

interface ListedIposTableProps {
  onAnalyzeAi?: (symbol: string, companyName: string) => void;
}

export const ListedIposTable: React.FC<ListedIposTableProps> = ({ onAnalyzeAi }) => {
  const [items, setItems] = useState<ListedIpoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'gain' | 'today' | 'recent' | 'price'>('gain');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<{
    symbol: string;
    companyName: string;
    issuePrice?: number | string;
    listingPrice?: number | string;
  } | null>(null);

  const fetchListed = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/ipos/listed');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (e) {
      console.error('Failed to load listed IPOs:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchListed();
  }, []);

  // Filter & Sort
  const filtered = items.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.companyName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'gain') return b.totalGainPercent - a.totalGainPercent;
    if (sortBy === 'today') return b.dayChangePercent - a.dayChangePercent;
    if (sortBy === 'price') return b.currentPrice - a.currentPrice;
    return 0; // default order
  });

  // Highlight stats
  const topGainer = items.length > 0 ? items.reduce((prev, curr) => (curr.totalGainPercent > prev.totalGainPercent ? curr : prev), items[0]) : null;
  const avgGain = items.length > 0 ? Math.round(items.reduce((acc, curr) => acc + curr.totalGainPercent, 0) / items.length) : 0;

  return (
    <div className="space-y-6">
      {/* Top Highlight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-panel border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Top Post-IPO Outperformer</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-mono font-extrabold text-white">
                {topGainer?.symbol || 'NETWEB'}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                +{topGainer?.totalGainPercent || 832.9}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">
              {topGainer?.companyName || 'Netweb Technologies'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-cyan-500/20 bg-cyan-950/10 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Average Total Return Since IPO</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-mono font-extrabold text-cyan-300">
                +{avgGain}%
              </span>
              <span className="text-[10px] text-slate-400">across {items.length} issues</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live calculated against issue offer price
            </p>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-purple-500/20 bg-purple-950/10 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Active Secondary Market Stream</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-mono font-extrabold text-purple-300">
                {items.length} Listed Stocks
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live NSE/BSE intraday quotes active
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-white/10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search listed IPO by company or NSE ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Dense Terminal Table View"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Visual Chart Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Chart Cards</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px]">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="gain">Total Return Since IPO (High to Low)</option>
              <option value="today">Today's % Change</option>
              <option value="price">Current Market Price (LTP)</option>
            </select>
          </div>

          <button
            onClick={fetchListed}
            disabled={isRefreshing}
            title="Refresh live quotes"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-900/60 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-white/5">
          <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No listed IPOs found</h4>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search query.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/70 text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-3.5 px-4">Company & Ticker</th>
                  <th className="py-3.5 px-4">Listing Date</th>
                  <th className="py-3.5 px-4">Issue Price</th>
                  <th className="py-3.5 px-4">Listing Price</th>
                  <th className="py-3.5 px-4">Live Price (LTP)</th>
                  <th className="py-3.5 px-4">Today&apos;s Change</th>
                  <th className="py-3.5 px-4">Total Gain Since IPO</th>
                  <th className="py-3.5 px-4">52W Range</th>
                  <th className="py-3.5 px-4 text-right">Live Chart & Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((item) => {
                  const isDayPositive = item.dayChange >= 0;
                  const isTotalPositive = item.totalGainPercent >= 0;

                  // 52W range progress percentage
                  const rangeSpan = item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow;
                  const currentPos = rangeSpan > 0 ? Math.min(100, Math.max(0, ((item.currentPrice - item.fiftyTwoWeekLow) / rangeSpan) * 100)) : 50;

                  return (
                    <tr
                      key={item.symbol}
                      className="hover:bg-white/[0.03] transition group cursor-pointer"
                      onClick={() => setSelectedChartSymbol({ symbol: item.symbol, companyName: item.companyName })}
                    >
                      {/* Company Name & Symbol */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm group-hover:text-cyan-400 transition">
                          {item.companyName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-cyan-400 font-semibold">{item.symbol}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            NSE: {item.ticker}
                          </span>
                        </div>
                      </td>

                      {/* Listing Date */}
                      <td className="py-4 px-4 font-mono text-slate-300">
                        {item.listingDate}
                      </td>

                      {/* Issue Price */}
                      <td className="py-4 px-4 font-mono text-slate-300 font-semibold">
                        ₹{item.issuePrice}
                      </td>

                      {/* Listing Price & Listing Day Gain */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-slate-200 font-semibold">₹{item.listingPrice}</span>
                        <span className={`text-[10px] ml-1.5 font-mono ${item.listingGainPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({item.listingGainPercent >= 0 ? '+' : ''}{item.listingGainPercent}%)
                        </span>
                      </td>

                      {/* Live Market Price (LTP) */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono text-base font-extrabold text-white">
                            ₹{item.currentPrice.toFixed(2)}
                          </span>
                        </div>
                      </td>

                      {/* Today's Change */}
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                          isDayPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {isDayPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          <span>
                            {isDayPositive ? '+' : ''}
                            {item.dayChange.toFixed(2)} ({isDayPositive ? '+' : ''}{item.dayChangePercent.toFixed(2)}%)
                          </span>
                        </div>
                      </td>

                      {/* Total Gain Since IPO */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className={`font-mono text-sm font-extrabold ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isTotalPositive ? '+' : ''}{item.totalGainPercent}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {(item.currentPrice / item.issuePrice).toFixed(2)}x Issue Price
                          </span>
                        </div>
                      </td>

                      {/* 52W Range Slider */}
                      <td className="py-4 px-4">
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between text-[9px] font-mono text-slate-400">
                            <span>₹{item.fiftyTwoWeekLow}</span>
                            <span>₹{item.fiftyTwoWeekHigh}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                              style={{ width: `${currentPos}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedChartSymbol({
                              symbol: item.symbol,
                              companyName: item.companyName,
                              issuePrice: item.issuePrice,
                              listingPrice: item.listingPrice,
                            })}
                            title="Open Real-Time Interactive Chart (TradingView & Native)"
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black font-semibold text-xs border border-cyan-500/30 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Live Chart</span>
                          </button>

                          <a
                            href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Official Real-Time Chart on TradingView"
                            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20 transition cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          {onAnalyzeAi && (
                            <button
                              onClick={() => onAnalyzeAi(item.symbol, item.companyName)}
                              title="AI Post-Listing Forensic Analysis"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10 transition cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Chart Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isDayPositive = item.dayChange >= 0;
            const isTotalPositive = item.totalGainPercent >= 0;
            const rangeSpan = item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow;
            const currentPos = rangeSpan > 0 ? Math.min(100, Math.max(0, ((item.currentPrice - item.fiftyTwoWeekLow) / rangeSpan) * 100)) : 50;

            return (
              <div
                key={item.symbol}
                onClick={() => setSelectedChartSymbol({ symbol: item.symbol, companyName: item.companyName })}
                className="group relative p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 hover:border-cyan-500/40 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 shadow-lg hover:shadow-cyan-500/10"
              >
                {/* Header: Company & Ticker */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      NSE: {item.symbol}
                    </span>
                    <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition mt-1.5 line-clamp-1">
                      {item.companyName}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {item.listingDate}
                  </span>
                </div>

                {/* Price & Day Change */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-2xl font-mono font-extrabold text-white">
                        ₹{item.currentPrice.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      Live Market Quote
                    </span>
                  </div>

                  <div className={`inline-flex items-center gap-0.5 font-mono font-bold text-xs px-2.5 py-1 rounded-lg ${
                    isDayPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    {isDayPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{isDayPositive ? '+' : ''}{item.dayChangePercent.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Metrics Matrix */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Offer Price</span>
                    <span className="font-semibold text-slate-200">₹{item.issuePrice}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Gain</span>
                    <span className={`font-bold ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isTotalPositive ? '+' : ''}{item.totalGainPercent}%
                    </span>
                  </div>
                </div>

                {/* 52W Range Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>52W L: ₹{item.fiftyTwoWeekLow}</span>
                    <span>52W H: ₹{item.fiftyTwoWeekHigh}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                      style={{ width: `${currentPos}%` }}
                    />
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedChartSymbol({
                      symbol: item.symbol,
                      companyName: item.companyName,
                      issuePrice: item.issuePrice,
                      listingPrice: item.listingPrice,
                    })}
                    className="flex-1 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black font-bold text-xs border border-cyan-500/30 transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>View Live Chart</span>
                  </button>
                  <a
                    href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="TradingView Real-Time Terminal"
                    className="ml-2 p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Chart Modal */}
      {selectedChartSymbol && (
        <LiveIpoChartModal
          symbol={selectedChartSymbol.symbol}
          companyName={selectedChartSymbol.companyName}
          issuePrice={selectedChartSymbol.issuePrice}
          listingPrice={selectedChartSymbol.listingPrice}
          isOpen={!!selectedChartSymbol}
          onClose={() => setSelectedChartSymbol(null)}
        />
      )}
    </div>
  );
};
