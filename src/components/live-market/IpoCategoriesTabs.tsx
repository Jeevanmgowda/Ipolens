'use client';

import React, { useMemo, useState } from 'react';
import { LiveMarketIpoItem, IpoCategoryTab } from '@/types/liveMarket';
import { Search, Star, Flame, Calendar, BarChart2, Sparkles, LineChart, Info, Brain, ExternalLink } from 'lucide-react';

interface IpoCategoriesTabsProps {
  ipos: LiveMarketIpoItem[];
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
  onOpenDetails: (ipo: LiveMarketIpoItem) => void;
  onOpenGmpTrend: (ipo: LiveMarketIpoItem) => void;
  onOpenStockChart: (ipo: LiveMarketIpoItem) => void;
  onAnalyzeAi?: (symbol: string, companyName: string) => void;
}

/** Status comes from the server (derived from the issue calendar); this only maps it to a tab id. */
export function getEffectiveIpoStatus(ipo: LiveMarketIpoItem): IpoCategoryTab {
  return ipo.status.toLowerCase() as IpoCategoryTab;
}

const TABS: Array<{ id: IpoCategoryTab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Closed' },
  { id: 'listed', label: 'Listed' },
];

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtX = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}x`);
const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

type SortKey = 'default' | 'gmp' | 'subscription' | 'issuesize';

export const IpoCategoriesTabs: React.FC<IpoCategoriesTabsProps> = ({
  ipos,
  watchlist,
  onToggleWatchlist,
  onOpenDetails,
  onOpenGmpTrend,
  onOpenStockChart,
  onAnalyzeAi,
}) => {
  const [activeTab, setActiveTab] = useState<IpoCategoryTab>('open');
  const [series, setSeries] = useState<'all' | 'EQ' | 'SME'>('all');
  const [query, setQuery] = useState('');
  const [watchOnly, setWatchOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('default');

  const counts = useMemo(() => {
    const c: Record<IpoCategoryTab, number> = { open: 0, upcoming: 0, closed: 0, listed: 0 };
    ipos.forEach((i) => c[getEffectiveIpoStatus(i)]++);
    return c;
  }, [ipos]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const val = (v: number | null | undefined) => (v === null || v === undefined ? -Infinity : v);
    return ipos
      .filter((i) => getEffectiveIpoStatus(i) === activeTab)
      .filter((i) => series === 'all' || i.series === series)
      .filter((i) => !watchOnly || watchlist.includes(i.symbol))
      .filter((i) => !q || i.symbol.toLowerCase().includes(q) || i.companyName.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === 'gmp') return val(b.gmpPercent) - val(a.gmpPercent);
        if (sortBy === 'subscription') return val(b.currentSubscription) - val(a.currentSubscription);
        if (sortBy === 'issuesize') return val(b.issueSizeCr) - val(a.issueSizeCr);
        const key = activeTab === 'listed' ? 'listingDate' : 'openDate';
        return activeTab === 'upcoming'
          ? (a[key] || '').localeCompare(b[key] || '')
          : (b[key] || '').localeCompare(a[key] || '');
      });
  }, [ipos, activeTab, series, watchOnly, watchlist, query, sortBy]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              activeTab === t.id
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            {t.label} <span className="ml-1 font-mono text-slate-400">{counts[t.id]}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or company"
              className="pl-7 pr-2 py-1.5 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-slate-200 w-52"
            />
          </div>
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value as typeof series)}
            className="py-1.5 px-2 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-slate-200"
            aria-label="Board"
          >
            <option value="all">All boards</option>
            <option value="EQ">Mainboard</option>
            <option value="SME">SME</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="py-1.5 px-2 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-slate-200"
            aria-label="Sort"
          >
            <option value="default">By date</option>
            <option value="subscription">Subscription</option>
            <option value="gmp">Market GMP %</option>
            <option value="issuesize">Issue size</option>
          </select>
          <button
            type="button"
            onClick={() => setWatchOnly((v) => !v)}
            className={`flex items-center gap-1 py-1.5 px-2 rounded-lg border text-xs cursor-pointer ${
              watchOnly ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/5 text-slate-300'
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Watchlist
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="p-8 rounded-xl border border-white/10 bg-slate-900/40 text-center text-sm text-slate-400">
          {ipos.length === 0
            ? 'No IPO data yet. The live ingestion job populates this list; ask an admin to run a sync if it stays empty.'
            : `No ${activeTab} IPOs match these filters.`}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((ipo) => (
            <IpoCard
              key={ipo.id}
              ipo={ipo}
              watched={watchlist.includes(ipo.symbol)}
              onToggleWatchlist={onToggleWatchlist}
              onOpenDetails={onOpenDetails}
              onOpenGmpTrend={onOpenGmpTrend}
              onOpenStockChart={onOpenStockChart}
              onAnalyzeAi={onAnalyzeAi}
            />
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-500 flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        Market GMP is an informal grey-market indication from third-party trackers, not an official price. The AI estimate
        is a statistical model trained on past listings. Neither is investment advice.
      </p>
    </section>
  );
};

const IpoCard: React.FC<{
  ipo: LiveMarketIpoItem;
  watched: boolean;
  onToggleWatchlist: (s: string) => void;
  onOpenDetails: (i: LiveMarketIpoItem) => void;
  onOpenGmpTrend: (i: LiveMarketIpoItem) => void;
  onOpenStockChart: (i: LiveMarketIpoItem) => void;
  onAnalyzeAi?: (symbol: string, companyName: string) => void;
}> = ({ ipo, watched, onToggleWatchlist, onOpenDetails, onOpenGmpTrend, onOpenStockChart, onAnalyzeAi }) => {
  const listed = ipo.status === 'Listed';
  const ai = ipo.aiGmp;
  return (
    <article className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
      <header className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onOpenDetails(ipo)} className="text-left cursor-pointer">
          <h3 className="text-sm font-semibold text-white leading-tight">{ipo.companyName}</h3>
          <p className="text-[11px] text-slate-400 font-mono">
            {ipo.symbol} · {ipo.series === 'SME' ? 'SME' : 'Mainboard'}
            {ipo.sector ? ` · ${ipo.sector}` : ''}
          </p>
        </button>
        <button
          type="button"
          aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
          onClick={() => onToggleWatchlist(ipo.symbol)}
          className="p-1 rounded hover:bg-white/10 cursor-pointer"
        >
          <Star className={`w-4 h-4 ${watched ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-slate-400">Price band</dt>
        <dd className="text-right font-mono text-slate-100">{ipo.priceBand}</dd>
        <dt className="text-slate-400">Lot size</dt>
        <dd className="text-right font-mono text-slate-100">{ipo.lotSize ?? '—'}</dd>
        <dt className="text-slate-400">Issue size</dt>
        <dd className="text-right font-mono text-slate-100">{ipo.issueSize}</dd>
        {ipo.ofsPercent !== null && ipo.ofsPercent !== undefined && (
          <>
            <dt className="text-slate-400">OFS share</dt>
            <dd className={`text-right font-mono ${ipo.ofsPercent > 50 ? 'text-amber-300' : 'text-slate-100'}`}>{ipo.ofsPercent}%</dd>
          </>
        )}
        <dt className="text-slate-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {listed ? 'Listed' : 'Dates'}
        </dt>
        <dd className="text-right font-mono text-slate-100">
          {listed ? fmtDate(ipo.listingDate) : `${fmtDate(ipo.openDate)} – ${fmtDate(ipo.closeDate)}`}
        </dd>
        {!listed && ipo.allotmentDate && (
          <>
            <dt className="text-slate-400">Allotment</dt>
            <dd className="text-right font-mono text-slate-100">{fmtDate(ipo.allotmentDate)}</dd>
          </>
        )}
      </dl>

      {listed ? (
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 text-[11px] grid grid-cols-2 gap-1">
          <span className="text-slate-400">Issue price</span>
          <span className="text-right font-mono">{ipo.issuePrice ? `₹${ipo.issuePrice}` : '—'}</span>
          <span className="text-slate-400">Listing price</span>
          <span className="text-right font-mono">{ipo.listingPrice ? `₹${ipo.listingPrice}` : '—'}</span>
          <span className="text-slate-400">Listing gain</span>
          <span
            className={`text-right font-mono font-semibold ${
              (ipo.listingGainPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {ipo.listingGainPct !== null && ipo.listingGainPct !== undefined ? `${ipo.listingGainPct > 0 ? '+' : ''}${ipo.listingGainPct}%` : '—'}
          </span>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <BarChart2 className="w-3 h-3 text-cyan-400" /> Subscription
            </span>
            <span className="font-mono text-cyan-200">
              {fmtX(ipo.currentSubscription)}
              {ipo.subscriptionUpdatedAt && <span className="text-slate-500 ml-1">({timeAgo(ipo.subscriptionUpdatedAt)})</span>}
            </span>
          </div>
          {ipo.currentSubscription !== null && (
            <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
              <span className="p-1 rounded bg-white/5">Retail {fmtX(ipo.retailSubscription)}</span>
              <span className="p-1 rounded bg-white/5">NII {fmtX(ipo.niiSubscription)}</span>
              <span className="p-1 rounded bg-white/5">QIB {fmtX(ipo.qibSubscription)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-white/5 pt-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Flame className="w-3 h-3 text-purple-400" /> Market GMP
            </span>
            <span className="font-mono text-purple-200">
              {ipo.gmp !== null ? `₹${ipo.gmp}${ipo.gmpPercent !== null ? ` (${ipo.gmpPercent}%)` : ''}` : 'not reported'}
            </span>
          </div>
          {ipo.gmpSource && (
            <p className="text-[9px] text-slate-500 text-right">
              {ipo.gmpSource} · {timeAgo(ipo.gmpUpdatedAt)}
            </p>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> AI estimate
            </span>
            <span className="font-mono text-cyan-200" title={ai ? `Model ${ai.modelVersion}` : undefined}>
              {ai
                ? `${ai.predictedGainPct > 0 ? '+' : ''}${ai.predictedGainPct}%${ai.predictedGmp !== null ? ` (₹${ai.predictedGmp})` : ''}`
                : 'needs subscription data'}
            </span>
          </div>
          {ai && (
            <p className="text-[9px] text-slate-500 text-right">
              range {ai.lowerPct}% to {ai.upperPct}% · drivers: {ai.drivers.slice(0, 2).map((d) => d.feature).join(', ')}
            </p>
          )}
        </div>
      )}

      <footer className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onOpenDetails(ipo)} className="btn-chip">
          <Info className="w-3 h-3" /> Details
        </button>
        {!listed && ipo.gmp !== null && (
          <button type="button" onClick={() => onOpenGmpTrend(ipo)} className="btn-chip">
            <Flame className="w-3 h-3" /> GMP trend
          </button>
        )}
        {listed && (
          <button type="button" onClick={() => onOpenStockChart(ipo)} className="btn-chip">
            <LineChart className="w-3 h-3" /> Chart
          </button>
        )}
        {onAnalyzeAi && (
          <button type="button" onClick={() => onAnalyzeAi(ipo.symbol, ipo.companyName)} className="btn-chip">
            <Brain className="w-3 h-3" /> DRHP analysis
          </button>
        )}
        {ipo.rhpUrl && (
          <a href={ipo.rhpUrl} target="_blank" rel="noopener noreferrer" className="btn-chip">
            <ExternalLink className="w-3 h-3" /> RHP
          </a>
        )}
      </footer>
    </article>
  );
};

export default IpoCategoriesTabs;
