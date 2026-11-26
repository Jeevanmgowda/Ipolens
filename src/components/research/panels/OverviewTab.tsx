'use client';

import { type DrhpAnalysisResult } from '@/types/ai';
import { AlertTriangle, BookOpen, FileText, ShieldCheck } from 'lucide-react';

export interface OverviewTabProps {
  result: DrhpAnalysisResult;
}

export function OverviewTab({ result }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Strengths & Risks Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/20 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Top Institutional Strengths</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {result.topStrengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-rose-500/20 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Forensic Red Flags & Risks</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {result.topRisks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Grounded Citations List */}
      {result.citations && result.citations.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3.5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs border-b border-white/5 pb-2.5">
            <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              Grounded DRHP Prospectus Citations
            </span>
            <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Filing: {result.documentName || `SEBI_${result.symbol}_DRHP_Filing.pdf`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {result.citations.map((c, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-white/10 hover:border-purple-500/40 space-y-2 transition shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-200 text-xs leading-snug">
                    {c.claim}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Page {c.pageNumber}
                  </span>
                </div>
                <blockquote className="text-[11px] text-slate-300 font-mono italic leading-relaxed border-l-2 border-purple-500/60 pl-2.5 py-1 bg-purple-500/5 rounded-r">
                  &quot;{c.excerpt}&quot;
                </blockquote>
                {c.section && (
                  <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 pt-1">
                    <span className="text-slate-500 font-mono">SEBI Chapter:</span>
                    <span className="text-slate-300">{c.section}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
