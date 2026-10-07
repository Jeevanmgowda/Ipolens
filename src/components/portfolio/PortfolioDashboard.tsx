'use client';

import React, { useState, useEffect } from 'react';
import { HoldingItem, PortfolioSummary } from '@/types/portfolio';
import { CsvUploadModal } from './CsvUploadModal';
import { TaxImpactWidget } from './TaxImpactWidget';
import {
  PieChart,
  UploadCloud,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Award,
  Calculator,
} from 'lucide-react';

export const PortfolioDashboard: React.FC = () => {
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [filterIpoOnly, setFilterIpoOnly] = useState<boolean>(false);
  const [showTaxWidget, setShowTaxWidget] = useState<boolean>(true);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/portfolio/holdings');
      const json = await res.json();
      if (json.success && json.data) {
        setHoldings(json.data.holdings || []);
        setSummary(json.data.summary || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleDeleteHolding = async (id: string) => {
    try {
      const res = await fetch(`/api/portfolio/holdings?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchPortfolio();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all imported portfolio holdings?')) return;
    try {
      const res = await fetch('/api/portfolio/holdings?id=all', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchPortfolio();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const displayedHoldings = filterIpoOnly
    ? holdings.filter((h) => h.isIpoAllotment)
    : holdings;

  return (
    <div className="space-y-6">
      {/* Portfolio Header Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-cyan-400" />
            Safe Demat Portfolio & P&L Intelligence
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Credential-free demat holdings tracking with ISIN matching and IPO allotment origin linkage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTaxWidget(!showTaxWidget)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
              showTaxWidget
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>{showTaxWidget ? 'Tax Widget Active' : 'Tax Impact Calculator'}</span>
          </button>

          {holdings.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-semibold cursor-pointer border border-white/10 transition"
            >
              Clear All
            </button>
          )}

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-cyan-500/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Broker CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && holdings.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl glass-card">
            <span className="text-xs text-slate-400 block">Total Portfolio Value</span>
            <span className="text-xl font-bold font-mono text-white mt-1 block">
              ₹{summary.totalCurrentValue.toLocaleString('en-IN')}
            </span>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Invested: ₹{summary.totalInvested.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-card">
            <span className="text-xs text-slate-400 block">Total Unrealized P&L</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xl font-bold font-mono ${
                  summary.totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.totalUnrealizedPnl >= 0 ? '+' : ''}
                ₹{summary.totalUnrealizedPnl.toLocaleString('en-IN')}
              </span>
              <span
                className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                  summary.totalUnrealizedPnl >= 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {summary.totalUnrealizedPnlPercent.toFixed(2)}%
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">Absolute Return</div>
          </div>

          <div className="p-4 rounded-2xl glass-card">
            <span className="text-xs text-slate-400 block">IPO Allotment Stocks</span>
            <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">
              {summary.ipoAllotmentCount} holdings
            </span>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Out of {summary.totalHoldingsCount} total portfolio scrips
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-card">
            <span className="text-xs text-slate-400 block">Est. Day's Drift</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">
                +₹{summary.dayPnl.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-bold font-mono text-emerald-500">
                (+{summary.dayPnlPercent}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">Active market movement</div>
          </div>
        </div>
      )}

      {/* Post-Listing Capital Gains Tax Impact Widget (Section 111A / 112A) */}
      {showTaxWidget && (
        <TaxImpactWidget
          initialGain={summary?.totalUnrealizedPnl && summary.totalUnrealizedPnl > 0 ? summary.totalUnrealizedPnl : 38500}
          initialInvested={summary?.totalInvested || 15000}
        />
      )}

      {/* Filter / Toggle Bar */}
      {holdings.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterIpoOnly(false)}
              className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${
                !filterIpoOnly ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Holdings ({holdings.length})
            </button>
            <button
              onClick={() => setFilterIpoOnly(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium cursor-pointer transition ${
                filterIpoOnly ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              <span>IPO Allotments Only ({summary?.ipoAllotmentCount || 0})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Target ISIN Matching Accuracy: ≥95%
          </div>
        </div>
      )}

      {/* Holdings Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-900/40 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-white/5">
          <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No Portfolio Holdings Imported</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Upload your Zerodha Kite, Groww, 5paisa, or CAS statement to track real-time P&L and analyze your IPO listing gains.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-cyan-500/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Your Broker CSV</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold">
                  <th className="py-3.5 px-4">Instrument</th>
                  <th className="py-3.5 px-4">ISIN Code</th>
                  <th className="py-3.5 px-4">Quantity & Avg Buy</th>
                  <th className="py-3.5 px-4">Current Price</th>
                  <th className="py-3.5 px-4">Current Value</th>
                  <th className="py-3.5 px-4">Unrealized P&L</th>
                  <th className="py-3.5 px-4">Origin</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedHoldings.map((h) => {
                  const isProfit = h.unrealizedPnl >= 0;
                  return (
                    <tr key={h.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm font-sans">{h.symbol}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{h.companyName}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-400 text-[11px]">{h.isin}</span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-slate-200 font-medium">{h.quantity} shares</div>
                        <div className="text-[11px] text-slate-500">@ ₹{h.averageBuyPrice.toFixed(2)}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-slate-200 font-semibold">₹{h.currentPrice.toFixed(2)}</span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-white font-bold">₹{h.currentValue.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-slate-500">
                          Inv: ₹{h.investedValue.toLocaleString('en-IN')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}₹{h.unrealizedPnl.toLocaleString('en-IN')}
                        </div>
                        <div className={`text-[11px] ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isProfit ? '+' : ''}{h.unrealizedPnlPercent.toFixed(2)}%
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {h.isIpoAllotment ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Award className="w-3 h-3 text-cyan-400" />
                            IPO Allotment
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Secondary</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteHolding(h.id)}
                          title="Remove holding"
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <CsvUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={fetchPortfolio}
      />
    </div>
  );
};
