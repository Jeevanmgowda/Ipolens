'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FamilyPanProfile } from '@/types/pan';
import {
  OptimizationResult,
  OptimizationStrategy,
  PanAllocationRecommendation,
} from '@/lib/services/allocation-optimizer.service';
import {
  X,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Users,
  Coins,
  ArrowRight,
  Info,
  Layers,
  Zap,
  RefreshCw,
} from 'lucide-react';

interface ActiveIpoOption {
  symbol: string;
  companyName: string;
  price: number;
  lotSize: number;
  gmp: number;
  totalMultiple: number;
  series: string;
}

const FEATURED_IPOS: ActiveIpoOption[] = [
  {
    symbol: 'SWIGGY',
    companyName: 'Swiggy Limited',
    price: 390,
    lotSize: 38,
    gmp: 45,
    totalMultiple: 3.6,
    series: 'EQ',
  },
  {
    symbol: 'HYUNDAI',
    companyName: 'Hyundai Motor India Limited',
    price: 1960,
    lotSize: 7,
    gmp: 65,
    totalMultiple: 2.4,
    series: 'EQ',
  },
  {
    symbol: 'BAJAJHFL',
    companyName: 'Bajaj Housing Finance Limited',
    price: 70,
    lotSize: 214,
    gmp: 82,
    totalMultiple: 64.0,
    series: 'EQ',
  },
  {
    symbol: 'PREMIERENE',
    companyName: 'Premier Energies Limited',
    price: 450,
    lotSize: 33,
    gmp: 380,
    totalMultiple: 74.5,
    series: 'EQ',
  },
];

interface SmartAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
  onApplicationsSubmitted?: () => void;
}

export const SmartAllocationModal: React.FC<SmartAllocationModalProps> = ({
  isOpen,
  onClose,
  defaultSymbol = 'NSE',
  onApplicationsSubmitted,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(defaultSymbol);
  const [profiles, setProfiles] = useState<FamilyPanProfile[]>([]);
  const [budget, setBudget] = useState<number>(350000);
  const [strategy, setStrategy] = useState<OptimizationStrategy>('max_probability');

  const [loading, setLoading] = useState<boolean>(false);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dynamic available IPOs
  const [availableIpos, setAvailableIpos] = useState<ActiveIpoOption[]>(FEATURED_IPOS);

  // Selected IPO details
  const activeIpo = useMemo(() => {
    return (
      availableIpos.find((i) => i.symbol === selectedSymbol) ||
      availableIpos[0] ||
      FEATURED_IPOS[0]
    );
  }, [availableIpos, selectedSymbol]);

  // Load registered PANs and live active IPOs on modal open
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/pans')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setProfiles(json.data);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    // Fetch live market IPOs to optimize on actual open or forthcoming offerings
    fetch('/api/ipos/live')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const liveActive = json.data
            .filter((i: any) => i.status === 'Active' || i.status === 'Forthcoming')
            .slice(0, 8)
            .map((item: any) => {
              const match = (item.issuePrice || '100').match(/(\d+(?:\.\d+)?)/g);
              const price = match ? parseFloat(match[match.length - 1]) : 100;
              const lotSize = item.lotSize ? Number(item.lotSize) : (item.series === 'SME' ? 1200 : 14);
              return {
                symbol: item.symbol,
                companyName: item.companyName,
                price,
                lotSize,
                gmp: item.gmpEstimate || 35,
                totalMultiple: parseFloat(item.noOfTime || '1.0'),
                series: item.series,
              };
            });

          if (liveActive.length > 0) {
            setAvailableIpos(liveActive);
            if (!defaultSymbol || defaultSymbol === 'NSE') {
              setSelectedSymbol(liveActive[0].symbol);
            }
          }
        }
      })
      .catch(() => {});
  }, [isOpen, defaultSymbol]);

  // Trigger optimization whenever IPO, budget, strategy, or profiles change
  useEffect(() => {
    if (!isOpen) return;

    setOptimizing(true);
    setError(null);

    fetch('/api/pans/optimize-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: activeIpo.symbol,
        companyName: activeIpo.companyName,
        price: activeIpo.price,
        lotSize: activeIpo.lotSize,
        gmp: activeIpo.gmp,
        totalBudget: budget,
        strategy,
        pans: profiles,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setResult(json.data);
        } else {
          setError(json.error || 'Optimization failed');
        }
      })
      .catch((err) => {
        setError(err.message || 'Error reaching optimization engine');
      })
      .finally(() => setOptimizing(false));
  }, [isOpen, selectedSymbol, budget, strategy, profiles, activeIpo]);

  if (!isOpen) return null;

  const handleExecuteBids = async () => {
    if (!result || result.allocations.length === 0) return;

    const activeAllocations = result.allocations.filter((a) => a.category !== 'Skip');
    if (activeAllocations.length === 0) {
      setError('No active allocations to submit. Please increase budget or register PANs.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    let submittedCount = 0;
    const errors: string[] = [];

    for (const alloc of activeAllocations) {
      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ipoSymbol: result.symbol,
            companyName: result.companyName,
            panId: alloc.panId,
            panNumber: alloc.panMasked,
            holderName: alloc.holderName,
            relationship: alloc.relationship,
            category: alloc.category,
            lots: alloc.lots,
            shares: alloc.shares,
            bidPrice: result.price,
            blockedAmount: alloc.blockedCapital,
          }),
        });

        const json = await res.json();
        if (json.success) {
          submittedCount++;
        } else {
          errors.push(`${alloc.holderName}: ${json.error}`);
        }
      } catch (err: any) {
        errors.push(`${alloc.holderName}: ${err.message}`);
      }
    }

    setSubmitting(false);

    if (errors.length > 0) {
      setError(`Submitted ${submittedCount} bids. Alerts: ${errors.join(', ')}`);
    } else {
      setSuccessMessage(
        `Successfully scheduled ${submittedCount} optimal bids across your family PANs! Track status in Application Tracker.`
      );
      if (onApplicationsSubmitted) {
        onApplicationsSubmitted();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 bg-slate-900/60 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Smart Multi-PAN Allocation Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                SEBI Allotment Probability Maximizer • Combinatorial Multi-Lot Optimization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-xs sm:text-sm">
          {/* Step 1: Active IPO Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              1. Select Active IPO for Optimization
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {availableIpos.map((ipo) => {
                const isSelected = selectedSymbol === ipo.symbol;
                return (
                  <button
                    key={ipo.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(ipo.symbol)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/10 text-white'
                        : 'bg-slate-900/40 border-white/5 hover:border-white/20 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{ipo.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                        {ipo.series}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      ₹{ipo.price} • Lot: {ipo.lotSize}
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                      <span className="text-emerald-400 font-semibold">
                        GMP +₹{ipo.gmp}
                      </span>
                      <span className="text-purple-400 font-medium">
                        {ipo.totalMultiple}x Total
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Subscription Telemetry Ribbon */}
          {result?.telemetrySnapshot && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-slate-200">
                  Live Exchange Telemetry:
                </span>
              </div>
              <div className="flex items-center gap-3 sm:gap-6">
                <div>
                  <span className="text-slate-400">Retail (RII): </span>
                  <span className="font-bold text-cyan-400">
                    {result.telemetrySnapshot.retailMultiple}x
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Small NII (sNII): </span>
                  <span className="font-bold text-emerald-400">
                    {result.telemetrySnapshot.sNiiMultiple}x
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Big NII (bNII): </span>
                  <span className="font-bold text-purple-400">
                    {result.telemetrySnapshot.bNiiMultiple}x
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">QIB: </span>
                  <span className="font-bold text-slate-300">
                    {result.telemetrySnapshot.qibMultiple}x
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Budget & Optimization Strategy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Budget */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  2. Total Available Capital Budget
                </label>
                <span className="text-sm font-bold text-white">
                  ₹{budget.toLocaleString('en-IN')}
                </span>
              </div>

              <input
                type="range"
                min={25000}
                max={1500000}
                step={25000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />

              <div className="flex flex-wrap gap-1.5">
                {[50000, 150000, 350000, 500000, 1000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBudget(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                      budget === preset
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    ₹{(preset / 100000).toFixed(1)}L
                  </button>
                ))}
              </div>
            </div>

            {/* Optimization Strategy */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                3. Mathematical Objective
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStrategy('max_probability')}
                  className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                    strategy === 'max_probability'
                      ? 'bg-purple-500/20 border-purple-500/50 text-white font-semibold'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs">🎯 Max Odds</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">At least 1 win</div>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('max_expected_profit')}
                  className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                    strategy === 'max_expected_profit'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-semibold'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs">💰 Max Profit</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Highest ₹ Return</div>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('capital_efficient')}
                  className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                    strategy === 'capital_efficient'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-white font-semibold'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs">⚡ 1-Lot Retail</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Min Blocked Cash</div>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                {strategy === 'max_probability' &&
                  'Balances sNII vs Retail multiples to maximize probability of getting at least one allotment ($1 - \\prod(1 - P_i)$).'}
                {strategy === 'max_expected_profit' &&
                  'Prioritizes sNII/bNII where winning awards multiple lots, maximizing total listing gains based on live GMP.'}
                {strategy === 'capital_efficient' &&
                  'Applies 1 lot Retail across all available family PANs. Never bids >1 lot per Retail PAN, preventing wasted capital under SEBI lottery rules.'}
              </p>
            </div>
          </div>

          {/* Step 3: Probability Uplift Comparison Hero Card */}
          {result && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-purple-950/40 border border-cyan-500/30 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                    Mathematical Advantage Analysis
                  </span>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    Combined Allotment Probability: {(result.smartStrategy.allotmentProbability * 100).toFixed(1)}%
                  </h4>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
                  <TrendingUp className="w-4 h-4" />
                  <span>+{result.smartStrategy.probabilityUpliftPercent}% Probability Boost</span>
                </div>
              </div>

              {/* Progress Odds Comparison Visual */}
              <div className="space-y-3 pt-2">
                {/* Naive Baseline */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Single-PAN Retail Lottery (Standard):</span>
                    <span className="font-semibold text-slate-300">
                      {(result.naiveStrategy.allotmentProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(3, result.naiveStrategy.allotmentProbability * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Smart Multi-PAN Diversified */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-cyan-300 font-semibold">
                      IPOLENS Smart Multi-PAN Allocation:
                    </span>
                    <span className="font-bold text-cyan-400">
                      {(result.smartStrategy.allotmentProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 rounded-full transition-all duration-700 shadow-md shadow-cyan-500/50"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, result.smartStrategy.allotmentProbability * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Financial Metrics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-white/10">
                <div className="p-2.5 rounded-xl bg-white/5">
                  <div className="text-slate-400 text-[10px]">Capital Blocked</div>
                  <div className="text-white font-bold mt-0.5">
                    ₹{result.totalCapitalBlocked.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5">
                  <div className="text-slate-400 text-[10px]">Unutilized Cash</div>
                  <div className="text-slate-300 font-bold mt-0.5">
                    ₹{result.unutilizedCapital.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5">
                  <div className="text-slate-400 text-[10px]">Expected Allotted Lots</div>
                  <div className="text-purple-300 font-bold mt-0.5">
                    {result.smartStrategy.expectedLots} Lots
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5">
                  <div className="text-slate-400 text-[10px]">Expected Listing Gain</div>
                  <div className="text-emerald-400 font-bold mt-0.5">
                    +₹{result.smartStrategy.expectedGains.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Strategic Rationale Explanation */}
          {result?.recommendationRationale && result.recommendationRationale.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                <Info className="w-4 h-4" />
                <span>Optimization Logic & SEBI Rules Applied:</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-1 leading-relaxed">
                {result.recommendationRationale.map((rationale, idx) => (
                  <li key={idx}>
                    <span className="text-slate-300">{rationale}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 4: Per-PAN Allocation Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                4. Recommended Family PAN Distribution ({result?.allocations.length || 0} PANs)
              </label>
              {profiles.length === 0 && (
                <span className="text-[11px] text-amber-400">
                  Tip: Add family PANs in Family PAN Manager to apply!
                </span>
              )}
            </div>

            {profiles.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-dashed border-white/10 space-y-2">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-slate-300 font-medium">No Family PANs Registered</p>
                <p className="text-slate-500 text-xs">
                  Register your family accounts (Self, Spouse, Parents, Children) in the Family PAN Manager to automatically optimize and submit coordinated bids.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-3">Family Member</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Lots</th>
                      <th className="p-3">Blocked Outlay</th>
                      <th className="p-3">Lottery Odds</th>
                      <th className="p-3">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-950/40">
                    {result?.allocations.map((alloc) => {
                      const isSkip = alloc.category === 'Skip';
                      return (
                        <tr
                          key={alloc.panId}
                          className={isSkip ? 'opacity-40 bg-white/[0.01]' : 'hover:bg-white/[0.02]'}
                        >
                          <td className="p-3">
                            <div className="font-semibold text-white">
                              {alloc.holderName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {alloc.relationship} • {alloc.panMasked} ({alloc.broker})
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                alloc.category === 'sNII'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : alloc.category === 'bNII'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                  : alloc.category === 'Retail'
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {alloc.category}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-white">
                            {alloc.lots > 0 ? `${alloc.lots} Lots` : '—'}
                          </td>
                          <td className="p-3 font-bold text-slate-200">
                            {alloc.blockedCapital > 0
                              ? `₹${alloc.blockedCapital.toLocaleString('en-IN')}`
                              : '—'}
                          </td>
                          <td className="p-3">
                            <span className="text-cyan-300 font-medium">
                              {alloc.oddsRatioText}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-slate-400 max-w-xs">
                            {alloc.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Feedback / Alert Banners */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>SEBI ICDR compliant. Automatically audits and prevents duplicate bids per PAN.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition cursor-pointer"
            >
              Close
            </button>

            {profiles.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteBids}
                disabled={submitting || optimizing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Family Bids...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Execute Optimal Family Bids</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
