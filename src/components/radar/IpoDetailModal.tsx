'use client';

import React, { useState, useEffect } from 'react';
import { LiveIpoDetail } from '@/types/ipo';
import { LiveBiddingChart } from './LiveBiddingChart';
import { CategorySubscriptionChart } from './CategorySubscriptionChart';
import { LiveIpoChartModal } from './LiveIpoChartModal';
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
} from 'lucide-react';

interface IpoDetailModalProps {
  symbol: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyWithPans: (symbol: string, companyName: string, price: number, lotSize: number) => void;
  onAnalyzeAi: (symbol: string, companyName: string) => void;
}

export const IpoDetailModal: React.FC<IpoDetailModalProps> = ({
  symbol,
  isOpen,
  onClose,
  onApplyWithPans,
  onAnalyzeAi,
}) => {
  const [detail, setDetail] = useState<LiveIpoDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isChartOpen, setIsChartOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!symbol || !isOpen) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ipos/${encodeURIComponent(symbol)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setDetail(json.data);
        } else {
          setError(json.error || 'Failed to load details from NSE');
        }
      } catch (err: any) {
        setError(err.message || 'Network error fetching NSE details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [symbol, isOpen]);

  if (!isOpen || !symbol) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-[#0b101d] border border-white/10 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
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
                  detail?.status === 'Active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : detail?.status === 'Forthcoming'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/40 text-slate-300 border border-slate-700/50'
                }`}
              >
                {detail?.status === 'Active'
                  ? '● Live Bidding Open'
                  : detail?.status === 'Forthcoming'
                  ? 'Upcoming Issue'
                  : 'Bidding Closed'}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              {detail?.companyName || symbol}
            </h3>

            {detail?.timestamp && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>Exchange Telemetry: {detail.timestamp}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(detail?.isListed || detail?.status === 'Closed') && (
              <button
                onClick={() => setIsChartOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white font-bold text-xs border border-purple-500/30 transition cursor-pointer shadow-sm"
              >
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                <span>Live Market Chart</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-400 font-medium">Fetching real-time order book from NSE India...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {detail && !loading && (
            <>
              {/* Primary Key Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block">Issue Price Band</span>
                  <span className="text-sm font-bold font-mono text-white mt-0.5 block">
                    {detail.issuePrice}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block">Lot Size</span>
                  <span className="text-sm font-bold font-mono text-cyan-400 mt-0.5 block">
                    {detail.lotSize} shares
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block">Min. Retail Outlay</span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                    ₹{detail.minInvestment.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block">Subscription Multiple</span>
                  <span className="text-sm font-bold font-mono text-amber-400 mt-0.5 block">
                    {detail.noOfTimesIssueSubscribed || '0.00'}x
                  </span>
                </div>
              </div>

              {/* Live Charts Section */}
              <div className="grid grid-cols-1 gap-6">
                {/* 1. Category Subscription Telemetry */}
                <CategorySubscriptionChart
                  bidDetails={detail.bidDetails}
                  overallMultiple={detail.noOfTimesIssueSubscribed}
                />

                {/* 2. Live Bidding Demand Curve */}
                <LiveBiddingChart
                  graphData={detail.graphData}
                  symbol={detail.symbol}
                  totalBidsReceived={detail.totalBidReceived}
                  biddingDetails={detail.biddingDetails}
                />
              </div>

              {/* Issue Timetable & Registrar Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Key Issue Dates
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Issue Opens:</span>
                      <span className="text-white font-mono">{detail.issueStartDate || 'TBA'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Issue Closes:</span>
                      <span className="text-white font-mono">{detail.issueEndDate || 'TBA'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-purple-400" /> Designated Registrar
                  </h4>
                  <p className="text-xs text-slate-200 font-semibold">{detail.registrarName}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Official allotment and refund processing agency.</p>
                  <a
                    href={detail.registrarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    <span>Visit Registrar Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        {detail && (
          <div className="p-4 border-t border-white/10 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Apply seamlessly or analyze filing before bidding
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  onAnalyzeAi(detail.symbol, detail.companyName);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium text-xs cursor-pointer transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>AI Prospectus Analysis</span>
              </button>

              {(detail.isListed || detail.status === 'Closed') && (
                <button
                  onClick={() => setIsChartOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/30 font-semibold text-xs cursor-pointer transition shadow-sm"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Live Market Chart</span>
                </button>
              )}

              {detail.status === 'Active' ? (
                <button
                  onClick={() => {
                    onClose();
                    const price = detail.minInvestment / detail.lotSize;
                    onApplyWithPans(detail.symbol, detail.companyName, price, detail.lotSize);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-cyan-500/20"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Apply via Family PANs</span>
                </button>
              ) : detail.status === 'Closed' ? (
                <a
                  href={detail.registrarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-emerald-500/20"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Check Allotment on Registrar</span>
                </a>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    const price = detail.minInvestment / detail.lotSize;
                    onApplyWithPans(detail.symbol, detail.companyName, price, detail.lotSize);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-blue-500/20"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Pre-Bidding Allocation</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Post-Listing Chart Modal */}
      {isChartOpen && detail && (
        <LiveIpoChartModal
          symbol={detail.symbol}
          companyName={detail.companyName}
          isOpen={isChartOpen}
          onClose={() => setIsChartOpen(false)}
        />
      )}
    </div>
  );
};
