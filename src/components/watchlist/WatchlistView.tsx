'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Star, Plus, Flame, Sparkles, Loader2 } from 'lucide-react';
import type { LiveMarketIpoItem } from '@/types/liveMarket';

/** The signed-in user's watchlist, joined with live IPO data from the database. */
export const WatchlistView: React.FC = () => {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [ipos, setIpos] = useState<LiveMarketIpoItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [w, l] = await Promise.all([fetch('/api/market/watchlist'), fetch('/api/ipos?status=all')]);
        if (w.status === 401) {
          setError('Sign in to keep a watchlist.');
          return;
        }
        const [wj, lj] = await Promise.all([w.json(), l.json()]);
        if (wj.success) setSymbols(wj.symbols);
        if (lj.success) setIpos(lj.data);
      } catch {
        setError('Could not load your watchlist.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bySymbol = useMemo(() => new Map(ipos.map((i) => [i.symbol, i])), [ipos]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ipos.filter((i) => !symbols.includes(i.symbol) && (i.symbol.toLowerCase().includes(q) || i.companyName.toLowerCase().includes(q))).slice(0, 6);
  }, [ipos, symbols, query]);

  const toggle = async (symbol: string, companyName?: string) => {
    const res = await fetch('/api/market/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, companyName }),
    });
    const json = await res.json();
    if (!json.success) return setError(json.error || 'Could not update the watchlist.');
    setSymbols((prev) => (json.watchlisted ? [symbol, ...prev] : prev.filter((s) => s !== symbol)));
    setQuery('');
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" /> Watchlist
          </h3>
          <p className="text-xs text-slate-400 mt-1">IPOs you are tracking, with the latest subscription, market GMP and AI estimate.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search an IPO to track"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500 w-full"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl bg-slate-950 border border-white/15 shadow-xl">
              {suggestions.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    onClick={() => toggle(s.symbol, s.companyName)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" /> {s.companyName} <span className="text-slate-500 font-mono">{s.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {loading && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </p>
      )}
      {!loading && !error && symbols.length === 0 && (
        <p className="p-4 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-400">
          Nothing tracked yet. Search above, or use the star on any IPO card in the radar.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {symbols.map((symbol) => {
          const ipo = bySymbol.get(symbol);
          return (
            <div key={symbol} className="p-5 rounded-2xl glass-card border border-white/10 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{symbol}</span>
                    {ipo && <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-white/5 text-slate-300 border border-white/10">{ipo.status}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 truncate max-w-[220px]">{ipo?.companyName ?? 'Not in the current IPO directory'}</p>
                </div>
                <button type="button" onClick={() => toggle(symbol)} title="Remove from watchlist" className="p-1.5 rounded-lg text-amber-400 hover:bg-white/5 cursor-pointer">
                  <Star className="w-4 h-4 fill-amber-400" />
                </button>
              </div>
              {ipo && (
                <dl className="grid grid-cols-2 gap-y-1 text-xs font-mono p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <dt className="text-slate-400 font-sans">Price band</dt>
                  <dd className="text-right">{ipo.priceBand}</dd>
                  <dt className="text-slate-400 font-sans">Subscription</dt>
                  <dd className="text-right">{ipo.currentSubscription !== null ? `${ipo.currentSubscription}x` : '—'}</dd>
                  <dt className="text-slate-400 font-sans flex items-center gap-1">
                    <Flame className="w-3 h-3 text-purple-400" /> Market GMP
                  </dt>
                  <dd className="text-right">{ipo.gmp !== null ? `₹${ipo.gmp}` : '—'}</dd>
                  <dt className="text-slate-400 font-sans flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> AI estimate
                  </dt>
                  <dd className="text-right">{ipo.aiGmp ? `${ipo.aiGmp.predictedGainPct}%` : '—'}</dd>
                  {ipo.status === 'Listed' && (
                    <>
                      <dt className="text-slate-400 font-sans">Listing gain</dt>
                      <dd className="text-right">{ipo.listingGainPct !== null && ipo.listingGainPct !== undefined ? `${ipo.listingGainPct}%` : '—'}</dd>
                    </>
                  )}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WatchlistView;
