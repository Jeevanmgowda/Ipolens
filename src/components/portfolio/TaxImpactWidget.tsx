'use client';

import React, { useState } from 'react';
import { Calculator, ShieldCheck, TrendingUp, AlertCircle, Info, Sparkles, CheckCircle2 } from 'lucide-react';

interface TaxImpactWidgetProps {
  initialGain?: number;
  initialInvested?: number;
}

export const TaxImpactWidget: React.FC<TaxImpactWidgetProps> = ({
  initialGain = 38500,
  initialInvested = 15000,
}) => {
  const [realizedGain, setRealizedGain] = useState<number>(initialGain);
  const [holdingPeriod, setHoldingPeriod] = useState<'STCG' | 'LTCG'>('STCG');
  const [annualLtcgExemptionUsed, setAnnualLtcgExemptionUsed] = useState<number>(0);

  // Indian Tax Rates under Finance (No. 2) Act 2024:
  // STCG on Equity Shares (Section 111A): 20%
  // LTCG on Equity Shares (Section 112A): 12.5% above ₹1,25,000 exemption
  // Health & Education Cess: 4%
  const STCG_RATE = 0.20;
  const LTCG_RATE = 0.125;
  const CESS_RATE = 0.04;
  const LTCG_EXEMPTION_LIMIT = 125000;

  const calculateTax = () => {
    const gain = Math.max(0, realizedGain);

    if (holdingPeriod === 'STCG') {
      const baseTax = gain * STCG_RATE;
      const cess = baseTax * CESS_RATE;
      const totalTax = baseTax + cess;
      const netInHand = gain - totalTax;
      const effectiveRate = gain > 0 ? (totalTax / gain) * 100 : 0;

      return {
        regime: 'STCG (Holding < 12 Months)',
        applicableRateText: '20% + 4% Cess = 20.8%',
        baseTax: Math.round(baseTax),
        cess: Math.round(cess),
        totalTax: Math.round(totalTax),
        netInHand: Math.round(netInHand),
        effectiveRate: Number(effectiveRate.toFixed(1)),
        exemptAmount: 0,
      };
    } else {
      // LTCG (> 12 Months)
      const remainingExemption = Math.max(0, LTCG_EXEMPTION_LIMIT - annualLtcgExemptionUsed);
      const taxableGain = Math.max(0, gain - remainingExemption);
      const baseTax = taxableGain * LTCG_RATE;
      const cess = baseTax * CESS_RATE;
      const totalTax = baseTax + cess;
      const netInHand = gain - totalTax;
      const effectiveRate = gain > 0 ? (totalTax / gain) * 100 : 0;

      return {
        regime: 'LTCG (Holding > 12 Months)',
        applicableRateText: '12.5% above ₹1.25L + 4% Cess',
        baseTax: Math.round(baseTax),
        cess: Math.round(cess),
        totalTax: Math.round(totalTax),
        netInHand: Math.round(netInHand),
        effectiveRate: Number(effectiveRate.toFixed(1)),
        exemptAmount: Math.min(gain, remainingExemption),
      };
    }
  };

  const tax = calculateTax();

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900/90 border border-white/10 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Finance Act 2024 Updated Rules
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Sections 111A & 112A</span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-400" />
            Post-Listing Realized Capital Gains & Net In-Hand Tax Widget
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Estimate your exact in-hand take-home profits after STCG (20%) or LTCG (12.5%) deduction, factoring in the ₹1.25 Lakh exemption threshold and 4% education cess.
          </p>
        </div>

        {/* STCG vs LTCG Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/10 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setHoldingPeriod('STCG')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              holdingPeriod === 'STCG'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Listing / STCG (&lt;12M)
          </button>
          <button
            type="button"
            onClick={() => setHoldingPeriod('LTCG')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              holdingPeriod === 'LTCG'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Long Term / LTCG (&gt;12M)
          </button>
        </div>
      </div>

      {/* Inputs & Computation Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Controls Column */}
        <div className="md:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Simulated IPO Listing Gain / Capital Profit (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="500"
                value={realizedGain}
                onChange={(e) => setRealizedGain(Number(e.target.value) || 0)}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-slate-500">Quick presets:</span>
              {[15000, 35000, 75000, 150000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRealizedGain(preset)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-cyan-300 border border-white/10 transition cursor-pointer"
                >
                  ₹{(preset / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>

          {holdingPeriod === 'LTCG' && (
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Other LTCG Exemption Used This FY:</span>
                <span className="font-mono text-white font-semibold">
                  ₹{annualLtcgExemptionUsed.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={LTCG_EXEMPTION_LIMIT}
                step="5000"
                value={annualLtcgExemptionUsed}
                onChange={(e) => setAnnualLtcgExemptionUsed(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Section 112A provides ₹1,25,000 annual exemption limit for all listed equities combined.
              </span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Tax Optimization Strategy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {holdingPeriod === 'STCG'
                ? 'Selling on listing day attracts 20% STCG. If the company possesses a strong moat, holding for 12+ months lowers capital gains tax to 12.5% and unlocks ₹1.25 Lakh zero-tax exemption.'
                : 'By holding over 12 months, your effective tax rate drops significantly. Unutilized losses from other equity transactions can also be offset against these gains.'}
            </p>
          </div>
        </div>

        {/* Results / KPI Display Column */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Gross Gain Card */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 block font-medium">Gross Listing Profit</span>
            <div className="text-xl font-bold font-mono text-white">
              ₹{realizedGain.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">Pre-tax capital return</span>
          </div>

          {/* Tax Liability Card */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
            <span className="text-[11px] text-rose-300 block font-medium">Total Tax Liability</span>
            <div className="text-xl font-bold font-mono text-rose-400">
              -₹{tax.totalTax.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-rose-300/80 font-mono block">
              Base: ₹{tax.baseTax.toLocaleString('en-IN')} • Cess: ₹{tax.cess.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Net In-Hand Profit Card */}
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-bold block flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Net In-Hand Profit (After All Taxes & Cess)
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold">
                Eff. Rate: {tax.effectiveRate}%
              </span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-300 pt-1">
              ₹{tax.netInHand.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-emerald-500/20">
              <span>Applied Tax Regime: <strong className="text-slate-200">{tax.regime}</strong></span>
              <span>Rate: <code className="text-cyan-300">{tax.applicableRateText}</code></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
