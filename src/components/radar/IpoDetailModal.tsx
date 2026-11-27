'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, ExternalLink, Brain, Users, Flame, LineChart, Info, Sparkles } from 'lucide-react';
import type { LiveMarketIpoItem, IpoSubscriptionDetails } from '@/types/liveMarket';
import { LiveGmpTrendChart } from '@/components/live-market/LiveGmpTrendChart';
import { LiveStockPriceChart } from '@/components/live-market/LiveStockPriceChart';

export interface IpoDetailModalProps {
  symbol: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyWithPans?: (symbol: string, companyName: string, price: number, lotSize: number) => void;
  onAnalyzeAi?: (symbol: string, companyName: string) => void;
  initialTab?: 'overview' | 'financials' | 'ml_prediction' | 'gmp' | 'chart';
}

type Detail = LiveMarketIpoItem & {
  subscription: IpoSubscriptionDetails | null;
  gmpHistory: Array<{ date: string; gmp: number; gmpPercent: number | null; source: string }>;
};

type Tab = 'overview' | 'gmp' | 'chart';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const cr = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `₹${v.toLocaleString('en-IN')} Cr`);

export const IpoDetailModal: React.FC<IpoDetailModalProps> = ({
  symbol,
  isOpen,
  onClose,
  onApplyWithPans,
  onAnalyzeAi,
  initialTab = 'overview',
}) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab === 'gmp' || initialTab === 'chart' ? initialTab : 'overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol || !isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await (await fetch(`/api/ipos/${encodeURIComponent(symbol)}`)).json();
        if (cancelled) return;
        if (json.success) setDetail(json.data);
        else setError(json.error || 'Could not load IPO details.');
      } catch {
        if (!cancelled) setError('Network error while loading IPO details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, isOpen]);

  if (!isOpen || !symbol) return null;

  const d = detail;
  const listed = d?.status === 'Listed';
  const sub = d?.subscription;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0b1222] border border-white/15 shadow-2xl text-slate-100">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5 border-b border-white/10 bg-[#0b1222]">
          <div>
            <h2 className="text-lg font-bold">{d?.companyName || symbol}</h2>
            <p className="text-xs text-slate-400 font-mono">
              {symbol} {d ? `· ${d.series === 'SME' ? 'SME' : 'Mainboard'} · ${d.status}` : ''}
              {d?.exchange ? ` · ${d.exchange}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </header>

        <nav className="flex gap-2 px-5 pt-4">
          {(['overview', 'gmp', 'chart'] as Tab[])
            .filter((t) => t !== 'chart' || listed)
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  tab === t ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                {t === 'overview' ? 'Overview' : t === 'gmp' ? 'GMP history' : 'Price chart'}
              </button>
            ))}
        </nav>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}

          {d && tab === 'overview' && (
            <>
              <section className="grid sm:grid-cols-2 gap-4">
                <InfoTable
                  title="Issue details"
                  rows={[
                    ['Price band', d.priceBand],
                    ['Lot size', d.lotSize ? `${d.lotSize} shares` : '—'],
                    ['Minimum investment', d.minInvestment ? `₹${d.minInvestment.toLocaleString('en-IN')}` : '—'],
                    ['Issue size', cr(d.issueSizeCr)],
                    ['Fresh issue', cr(d.freshIssueCr)],
                    ['Offer for sale', cr(d.ofsCr)],
                    ['OFS share of issue', d.ofsPercent !== null && d.ofsPercent !== undefined ? `${d.ofsPercent}%` : '—'],
                    ['Issue P/E', d.peRatio ? `${d.peRatio}x` : '—'],
                    ['Registrar', d.registrar || '—'],
                  ]}
                />
                <InfoTable
                  title="Timeline"
                  rows={[
                    ['Opens', fmtDate(d.openDate)],
                    ['Closes', fmtDate(d.closeDate)],
                    ['Allotment', fmtDate(d.allotmentDate)],
                    ['Listing', fmtDate(d.listingDate)],
                    ['Anchor 30-day lock-in ends', fmtDate(d.anchorLockin30)],
                    ['Anchor 90-day lock-in ends', fmtDate(d.anchorLockin90)],
                    ...(listed
                      ? ([
                          ['Listing price', d.listingPrice ? `₹${d.listingPrice}` : '—'],
                          ['Listing gain', d.listingGainPct !== null && d.listingGainPct !== undefined ? `${d.listingGainPct}%` : '—'],
                        ] as Array<[string, string]>)
                      : []),
                  ]}
                />
              </section>

              {d.ofsPercent !== null && d.ofsPercent !== undefined && d.ofsPercent > 50 && (
                <p className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  {d.ofsPercent}% of this issue is an offer for sale: most of the money goes to selling shareholders, not
                  to the company.
                </p>
              )}

              <section className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" /> Subscription
                  {sub && <span className="text-[10px] text-slate-500 font-normal">as of {new Date(sub.recordedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>}
                </h3>
                {sub ? (
                  <div className="space-y-2">
                    {(
                      [
                        ['QIB', sub.qib],
                        ['NII', sub.nii],
                        ['Retail', sub.retail],
                        ...(sub.employee ? ([['Employee', sub.employee]] as Array<[string, number]>) : []),
                        ['Total', sub.total],
                      ] as Array<[string, number]>
                    ).map(([label, v]) => (
                      <div key={label} className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-slate-400">{label}</span>
                        <div className="flex-1 h-2 rounded bg-white/5 overflow-hidden">
                          <div className="h-full bg-cyan-500/70" style={{ width: `${Math.min(100, (v / Math.max(sub.total, 1, ...[sub.qib, sub.nii, sub.retail])) * 100)}%` }} />
                        </div>
                        <span className="w-16 text-right font-mono">{v}x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Subscription figures are published once bidding opens.</p>
                )}
              </section>

              <section className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/25 text-xs space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-purple-400" /> Market GMP
                  </h3>
                  <p className="font-mono text-lg">{d.gmp !== null ? `₹${d.gmp}${d.gmpPercent !== null ? ` (${d.gmpPercent}%)` : ''}` : 'not reported'}</p>
                  <p className="text-slate-500">{d.gmpSource ? `${d.gmpSource}, unofficial grey-market indication` : 'No tracker has reported a GMP.'}</p>
                </div>
                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/25 text-xs space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" /> AI listing estimate
                  </h3>
                  {d.aiGmp ? (
                    <>
                      <p className="font-mono text-lg">
                        {d.aiGmp.predictedGainPct > 0 ? '+' : ''}
                        {d.aiGmp.predictedGainPct}%{d.aiGmp.predictedGmp !== null ? ` (₹${d.aiGmp.predictedGmp})` : ''}
                      </p>
                      <p className="text-slate-400">
                        80% range {d.aiGmp.lowerPct}% to {d.aiGmp.upperPct}%. Main drivers:{' '}
                        {d.aiGmp.drivers.map((x) => `${x.feature} (${x.contributionPct > 0 ? '+' : ''}${x.contributionPct} pts)`).join(', ')}.
                      </p>
                      <p className="text-slate-500">Model {d.aiGmp.modelVersion}, trained on past listings; it does not use market GMP.</p>
                    </>
                  ) : (
                    <p className="text-slate-400">Available once live subscription data exists and the model has enough listing history.</p>
                  )}
                </div>
              </section>

              <footer className="flex flex-wrap gap-2">
                {!listed && d.priceHigh && d.lotSize && onApplyWithPans && (
                  <button type="button" className="btn-chip" onClick={() => onApplyWithPans(d.symbol, d.companyName, d.priceHigh!, d.lotSize!)}>
                    <Users className="w-3.5 h-3.5" /> Apply with family PANs
                  </button>
                )}
                {onAnalyzeAi && (
                  <button type="button" className="btn-chip" onClick={() => onAnalyzeAi(d.symbol, d.companyName)}>
                    <Brain className="w-3.5 h-3.5" /> DRHP AI analysis
                  </button>
                )}
                {d.rhpUrl && (
                  <a className="btn-chip" href={d.rhpUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" /> RHP
                  </a>
                )}
                {d.drhpUrl && (
                  <a className="btn-chip" href={d.drhpUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" /> DRHP (SEBI)
                  </a>
                )}
                {d.registrarUrl && (
                  <a className="btn-chip" href={d.registrarUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" /> Registrar allotment page
                  </a>
                )}
              </footer>
              <p className="text-[10px] text-slate-500 flex gap-1">
                <Info className="w-3 h-3 shrink-0" /> Data source: {d.source || '—'}
                {d.lastUpdated ? `, refreshed ${new Date(d.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST` : ''}. Educational information, not investment advice.
              </p>
            </>
          )}

          {d && tab === 'gmp' && (
            <LiveGmpTrendChart symbol={d.symbol} companyName={d.companyName} baseGmp={d.gmp ?? undefined} issuePrice={d.priceHigh ?? undefined} />
          )}
          {d && tab === 'chart' && listed && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <LineChart className="w-3.5 h-3.5" /> Delayed prices
              </p>
              <LiveStockPriceChart symbol={d.symbol} companyName={d.companyName} initialPrice={d.listingPrice ?? undefined} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoTable: React.FC<{ title: string; rows: Array<[string, string]> }> = ({ title, rows }) => (
  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
    <h3 className="text-sm font-semibold mb-2">{title}</h3>
    <dl className="grid grid-cols-2 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-slate-400">{k}</dt>
          <dd className="text-right font-mono">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
);

export default IpoDetailModal;
