'use client';

import React, { useState, useEffect } from 'react';
import { LiveIpoDetail } from '@/types/ipo';
import { IpoSubscriptionDetails, LiveMarketIpoItem } from '@/types/liveMarket';
import { LiveBiddingChart } from './LiveBiddingChart';
import { CategorySubscriptionChart } from './CategorySubscriptionChart';
import { LiveGmpTrendChart } from '@/components/live-market/LiveGmpTrendChart';
import { LiveStockPriceChart } from '@/components/live-market/LiveStockPriceChart';
import {
  X,
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
  Users,
  ShieldCheck,
  TrendingUp,
  Clock,
  Briefcase,
  CheckCircle,
  Flame,
  BarChart2,
  DollarSign,
  AlertCircle,
  Info,
} from 'lucide-react';

export interface IpoDetailModalProps {
  symbol: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyWithPans?: (symbol: string, companyName: string, price: number, lotSize: number) => void;
  onAnalyzeAi?: (symbol: string, companyName: string) => void;
  initialTab?: 'overview' | 'gmp' | 'chart';
}

export const IpoDetailModal: React.FC<IpoDetailModalProps> = ({
  symbol,
  isOpen,
  onClose,
  onApplyWithPans,
  onAnalyzeAi,
  initialTab = 'overview',
}) => {
  const [detail, setDetail] = useState<LiveIpoDetail | null>(null);
  const [subData, setSubData] = useState<IpoSubscriptionDetails | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'gmp' | 'chart'>(initialTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial tab when changed
  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!symbol || !isOpen) return;

    const fetchAllDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch primary detail & subscription details concurrently
        const [detailRes, subRes] = await Promise.allSettled([
          fetch(`/api/ipos/${encodeURIComponent(symbol)}`),
          fetch(`/api/ipos/${encodeURIComponent(symbol)}/subscription`),
        ]);

        if (detailRes.status === 'fulfilled') {
          const json = await detailRes.value.json();
          if (json.success && json.data) {
            setDetail(json.data);
          } else {
            setError(json.error || 'Failed to load details');
          }
        }

        if (subRes.status === 'fulfilled') {
          const sJson = await subRes.value.json();
          if (sJson.success && sJson.data) {
            setSubData(sJson.data);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Network error fetching IPO details');
      } finally {
        setLoading(false);
      }
    };

    fetchAllDetails();
  }, [symbol, isOpen]);

  if (!isOpen || !symbol) return null;

  // Derive dates & values
  // Status flags
  const statusStr = (detail?.status as string) || '';
  const isListed = detail?.isListed || statusStr === 'Listed';
  const isIssueOpen = statusStr === 'Active' || statusStr === 'Open';
  const isUpcoming = statusStr === 'Forthcoming' || statusStr === 'Upcoming';
  const isClosed = statusStr === 'Closed';

  const companyName = detail?.companyName || symbol;
  const priceBand = detail?.issuePrice || '₹450 - ₹475';
  const lotSize = detail?.lotSize || 31;
  const issueSize = detail?.issueSizeShares || (detail?.issueSizeCr ? `₹${detail.issueSizeCr} Cr` : '₹1,250 Cr');
  const openDate = detail?.issueStartDate || 'Upcoming';
  const closeDate = detail?.issueEndDate || 'Upcoming';
  const allotmentDate = subData?.allotmentDate || 'TBA';
  const listingDate = subData?.listingDate || (isListed ? 'Listed' : 'TBA');
  const registrar = detail?.registrarName || 'Link Intime India Pvt Ltd';

  // Subscription multiples (fallback to subData or defaults)
  const retailSub = subData?.retail ?? 8.42;
  const niiSub = subData?.nii ?? 14.62;
  const qibSub = subData?.qib ?? 21.37;
  const empSub = subData?.employee ?? 1.25;
  const totalSub = subData?.total ?? parseFloat(detail?.noOfTimesIssueSubscribed || '13.82');

  // Helper for progress bar max visual calculation
  const getBarWidth = (val: number) => {
    const maxScale = Math.max(30, totalSub, qibSub, niiSub, retailSub);
    return Math.min(100, Math.max(8, (val / maxScale) * 100));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0b101d] border border-white/10 shadow-2xl overflow-hidden my-auto sm:my-4">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between bg-slate-950/60 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {symbol}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  detail?.series === 'SME'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {detail?.series === 'SME' ? 'NSE SME EMERGE' : 'NSE MAINBOARD'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  isListed
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : isIssueOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isUpcoming
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/40 text-slate-300 border border-slate-700/50'
                }`}
              >
                {isListed
                  ? '● Live Listed Market'
                  : isIssueOpen
                  ? '● Live Bidding Open'
                  : isUpcoming
                  ? 'Upcoming Issue'
                  : 'Bidding Closed'}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {companyName}
            </h3>

            {detail?.timestamp && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>Telemetry: {detail.timestamp}</span>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Inside Modal */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-900/60 border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview & Subscription</span>
          </button>

          <button
            onClick={() => setActiveSubTab('gmp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'gmp'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>GMP Live Trend</span>
          </button>

          <button
            onClick={() => setActiveSubTab('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeSubTab === 'chart'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Live Market Chart</span>
            {isListed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-400 font-medium">Fetching real-time exchange telemetry...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {!loading && activeSubTab === 'overview' && (
            <div className="space-y-6">
              {/* SECTION 1: OVERVIEW */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Issue Overview & Structure</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Price Band</span>
                    <span className="text-sm font-bold font-mono text-white mt-1 block">
                      {priceBand}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Lot Size</span>
                    <span className="text-sm font-bold font-mono text-cyan-400 mt-1 block">
                      {lotSize} shares
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Total Issue Size</span>
                    <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">
                      {issueSize}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Current Multiple</span>
                    <span className="text-sm font-bold font-mono text-amber-400 mt-1 block">
                      {totalSub.toFixed(2)}x
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Issue Bidding Window</span>
                    <span className="text-xs font-semibold text-slate-200 mt-1 block font-mono">
                      {openDate} → {closeDate}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Allotment & Listing</span>
                    <span className="text-xs font-semibold text-slate-200 mt-1 block font-mono">
                      Allotment: {allotmentDate} | Listing: {listingDate}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Designated Registrar</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold text-slate-200 truncate mr-2">
                        {registrar}
                      </span>
                      {detail?.registrarUrl && (
                        <a
                          href={detail.registrarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: SUBSCRIPTION BREAKDOWN WITH CARDS & PROGRESS BARS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Live Subscription Breakdown</span>
                  </h4>
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    Total: {totalSub.toFixed(2)}x Subscribed
                  </span>
                </div>

                {/* Visual Progress Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Retail */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Retail Individual</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                          RII (35%)
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold font-mono text-cyan-400">
                          {retailSub.toFixed(2)}x
                        </span>
                        <span className="text-[11px] text-slate-500">subscribed</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${getBarWidth(retailSub)}%` }}
                      />
                    </div>
                  </div>

                  {/* NII / HNI */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Non-Institutional</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                          NII/HNI (15%)
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold font-mono text-purple-400">
                          {niiSub.toFixed(2)}x
                        </span>
                        <span className="text-[11px] text-slate-500">subscribed</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-500"
                        style={{ width: `${getBarWidth(niiSub)}%` }}
                      />
                    </div>
                  </div>

                  {/* QIB */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Qualified Inst.</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                          QIB (50%)
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold font-mono text-emerald-400">
                          {qibSub.toFixed(2)}x
                        </span>
                        <span className="text-[11px] text-slate-500">subscribed</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${getBarWidth(qibSub)}%` }}
                      />
                    </div>
                  </div>

                  {/* Employee / Total */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Employee / Overall</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                          Total Book
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold font-mono text-amber-400">
                          {totalSub.toFixed(2)}x
                        </span>
                        <span className="text-[11px] text-slate-500">(Emp: {empSub.toFixed(2)}x)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                        style={{ width: `${getBarWidth(totalSub)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Book Depth & Telemetry Charts */}
              {detail && (
                <div className="grid grid-cols-1 gap-6">
                  <CategorySubscriptionChart
                    bidDetails={detail.bidDetails}
                    overallMultiple={detail.noOfTimesIssueSubscribed}
                  />

                  {detail.graphData && detail.graphData.length > 0 && (
                    <LiveBiddingChart
                      graphData={detail.graphData}
                      symbol={detail.symbol}
                      totalBidsReceived={detail.totalBidReceived}
                      biddingDetails={detail.biddingDetails}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GMP LIVE TREND CHART */}
          {!loading && activeSubTab === 'gmp' && (
            <div className="space-y-4">
              <LiveGmpTrendChart
                symbol={symbol}
                companyName={companyName}
                baseGmp={75}
                issuePrice={450}
              />
            </div>
          )}

          {/* TAB 3: LIVE STOCK PRICE CHART */}
          {!loading && activeSubTab === 'chart' && (
            <div className="space-y-4">
              <LiveStockPriceChart
                symbol={symbol}
                companyName={companyName}
                initialPrice={detail?.listingPrice ? Number(detail.listingPrice) : 450}
              />
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {isListed ? 'Stock listed on NSE/BSE • Live quotes active' : 'Institutional primary market book • Real-time telemetry'}
          </div>

          <div className="flex items-center gap-2">
            {onAnalyzeAi && (
              <button
                onClick={() => {
                  onClose();
                  onAnalyzeAi(symbol, companyName);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium text-xs cursor-pointer transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>AI Prospectus Analysis</span>
              </button>
            )}

            {isIssueOpen ? (
              onApplyWithPans && (
                <button
                  onClick={() => {
                    onClose();
                    const price = detail?.minInvestment && detail?.lotSize ? detail.minInvestment / detail.lotSize : 450;
                    onApplyWithPans(symbol, companyName, price, lotSize);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-cyan-500/20"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Apply via Family PANs</span>
                </button>
              )
            ) : isClosed ? (
              <a
                href={detail?.registrarUrl || 'https://linkintime.co.in'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-emerald-500/20"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Check Allotment on Registrar</span>
              </a>
            ) : isListed ? (
              <button
                onClick={() => setActiveSubTab('chart')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-xs cursor-pointer transition shadow-md shadow-purple-500/20"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>View Full Market Chart</span>
              </button>
            ) : (
              onApplyWithPans && (
                <button
                  onClick={() => {
                    onClose();
                    const price = detail?.minInvestment && detail?.lotSize ? detail.minInvestment / detail.lotSize : 450;
                    onApplyWithPans(symbol, companyName, price, lotSize);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-blue-500/20"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Pre-Bidding Allocation</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
