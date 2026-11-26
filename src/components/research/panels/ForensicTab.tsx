'use client';

import { type DrhpAnalysisResult } from '@/types/ai';
import { Scale } from 'lucide-react';

export interface ForensicTabProps {
  result: DrhpAnalysisResult;
}

export function ForensicTab({ result }: ForensicTabProps) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              SEBI Institutional Forensic Risk Matrix
            </h4>
            <p className="text-[11px] text-slate-400">
              Multi-factor forensic audit across 5 mandatory prospectus disclosure pillars
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Traffic-Light Radar</span>
      </div>

      <div className="space-y-3">
        {(result.forensicRiskMatrix || []).map((risk, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{risk.category}</span>
                {risk.section && (
                  <span className="text-[10px] text-slate-500 font-mono">({risk.section})</span>
                )}
                {risk.citationPage && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Page {risk.citationPage}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{risk.detail}</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Safety Score</span>
                <span className="font-mono font-bold text-xs text-slate-200">{risk.score}/100</span>
              </div>
              <div
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                  risk.rating === 'LOW'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : risk.rating === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {risk.rating} RISK
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
