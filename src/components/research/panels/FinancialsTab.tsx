'use client';

import { type DrhpAnalysisResult } from '@/types/ai';
import { BarChart3, TrendingUp } from 'lucide-react';

export interface FinancialsTabProps {
  result: DrhpAnalysisResult;
}

export function FinancialsTab({ result }: FinancialsTabProps) {
  return (
    <div className="space-y-6">
      {/* Business Moat */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
          <TrendingUp className="w-4 h-4" />
          <span>Competitive Moat & Defensibility</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{result.businessMoat}</p>
      </div>

      {/* Financial Metrics Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Key Balance Sheet & P&L Disclosures
          </span>
          <span className="text-[11px] font-mono text-slate-400">Restated Financials</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">3-Yr Revenue CAGR</span>
            <span className="text-xs font-mono font-bold text-white mt-1 block">
              {result.financials.revenueCagr}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">EBITDA Margin</span>
            <span className="text-xs font-mono font-bold text-emerald-400 mt-1 block">
              {result.financials.ebitdaMargin}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">PAT Margin</span>
            <span className="text-xs font-mono font-bold text-white mt-1 block">
              {result.financials.patMargin}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">Debt to Equity</span>
            <span className="text-xs font-mono font-bold text-cyan-300 mt-1 block">
              {result.financials.debtToEquity}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">P/E Multiple</span>
            <span className="text-xs font-mono font-bold text-purple-300 mt-1 block">
              {result.financials.peRatio}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">Industry P/E</span>
            <span className="text-xs font-mono font-bold text-slate-400 mt-1 block">
              {result.financials.industryPe}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
