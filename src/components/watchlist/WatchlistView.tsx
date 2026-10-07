'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  Trash2,
  TrendingUp,
  TrendingDown,
  Bell,
  Sparkles,
  Search,
  ExternalLink,
  Plus,
  Flame,
} from 'lucide-react';

interface WatchlistItem {
  symbol: string;
  companyName: string;
  currentPrice: number;
  issuePrice?: number;
  gmp?: number;
  dayChangePercent: number;
  status: 'Open' | 'Upcoming' | 'Listed' | 'Closed';
}

const DEFAULT_WATCHLIST_DATA: WatchlistItem[] = [
  {
    symbol: 'SWIGGY',
    companyName: 'Swiggy Limited',
    currentPrice: 284.05,
    issuePrice: 390,
    gmp: 25,
    dayChangePercent: 5.01,
    status: 'Listed',
  },
  {
    symbol: 'BAJAJHFL',
    companyName: 'Bajaj Housing Finance Ltd',
    currentPrice: 132.4,
    issuePrice: 70,
    gmp: 78,
    dayChangePercent: -1.25,
    status: 'Listed',
  },
  {
    symbol: 'NSE',
    companyName: 'National Stock Exchange of India Ltd',
    currentPrice: 2450.0,
    issuePrice: 1785,
    gmp: 680,
    dayChangePercent: 2.45,
    status: 'Upcoming',
  },
  {
    symbol: 'HYUNDAI',
    companyName: 'Hyundai Motor India Ltd',
    currentPrice: 1820.5,
    issuePrice: 1960,
    gmp: 45,
    dayChangePercent: 0.85,
    status: 'Listed',
  },
];

export const WatchlistView: React.FC = () => {
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST_DATA);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [alertThresholds, setAlertThresholds] = useState<Record<string, number>>({
    SWIGGY: 300,
    NSE: 2600,
  });

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/market/watchlist');
      const json = await res.json();
      if (json.success && Array.isArray(json.symbols)) {
        setWatchlistSymbols(json.symbols);
      }
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleToggle = async (symbol: string) => {
    try {
      const res = await fetch('/api/market/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      if (json.success) {
        if (!json.watchlisted) {
          setItems((prev) => prev.filter((i) => i.symbol !== symbol));
          setWatchlistSymbols((prev) => prev.filter((s) => s !== symbol));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSymbol = () => {
    if (!newSymbolInput.trim()) return;
    const sym = newSymbolInput.toUpperCase().trim();
    if (!items.some((i) => i.symbol === sym)) {
      const newItem: WatchlistItem = {
        symbol: sym,
        companyName: `${sym} Primary Equity`,
        currentPrice: 485.5,
        issuePrice: 450,
        gmp: 65,
        dayChangePercent: 2.1,
        status: 'Open',
      };
      setItems([newItem, ...items]);
      handleToggle(sym);
    }
    setNewSymbolInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            Institutional IPO & Stock Watchlist
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Personal tracked issues with price alerts and grey market momentum triggers.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Add symbol (e.g. ZOMATO, TATA)"
            value={newSymbolInput}
            onChange={(e) => setNewSymbolInput(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white uppercase font-mono placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-cyan-500 w-full sm:w-48"
          />
          <button
            onClick={handleAddSymbol}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Track</span>
          </button>
        </div>
      </div>

      {/* Watchlist Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const isPositive = item.dayChangePercent >= 0;
          return (
            <div
              key={item.symbol}
              className="p-5 rounded-2xl glass-card border border-white/10 hover:border-white/20 transition flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{item.symbol}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        item.status === 'Open'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : item.status === 'Upcoming'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/5 text-slate-300 border border-white/10'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px]">{item.companyName}</p>
                </div>

                <button
                  onClick={() => handleToggle(item.symbol)}
                  title="Remove from watchlist"
                  className="p-1.5 rounded-lg text-amber-400 hover:bg-white/5 transition cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-amber-400" />
                </button>
              </div>

              {/* Price & GMP Metrics */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Current Price</span>
                  <span className="text-sm font-bold text-white">₹{item.currentPrice.toFixed(2)}</span>
                  <div className={`text-[10px] font-semibold mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? '+' : ''}{item.dayChangePercent.toFixed(2)}%
                  </div>
                </div>

                <div className="border-l border-white/10 pl-2">
                  <span className="text-[10px] text-slate-400 font-sans block flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" /> GMP Rate
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    {item.gmp ? `+₹${item.gmp}` : 'N/A'}
                  </span>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Est. {item.gmp && item.issuePrice ? `${((item.gmp / item.issuePrice) * 100).toFixed(0)}% gain` : 'Live'}
                  </div>
                </div>
              </div>

              {/* Alert Hook Trigger */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Bell className="w-3 h-3 text-cyan-400" />
                  <span>Alert: &gt; ₹{alertThresholds[item.symbol] || Math.round(item.currentPrice * 1.15)}</span>
                </div>
                <span className="text-emerald-400 font-medium">Tracking Active</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
