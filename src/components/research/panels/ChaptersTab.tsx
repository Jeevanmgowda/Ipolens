'use client';

import { type DrhpAnalysisResult } from '@/types/ai';
import { BookOpen } from 'lucide-react';

export interface ChaptersTabProps {
  result: DrhpAnalysisResult;
}

export function ChaptersTab({ result }: ChaptersTabProps) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              DRHP Chapter Browser & Table of Contents
            </h4>
            <p className="text-[11px] text-slate-400">
              Index of official prospectus chapters extracted for {result.companyName}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-cyan-300">
          {result.sections?.length || 0} Chapters Indexed
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(result.sections || []).map((sec) => (
          <div
            key={sec.id}
            className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-2 hover:border-cyan-500/30 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                Chapter {sec.chapterNumber} • {sec.pageRange}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  sec.riskRating === 'LOW'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {sec.riskRating} RISK
              </span>
            </div>

            <h5 className="font-bold text-white text-xs">{sec.title}</h5>
            <p className="text-xs text-slate-400 leading-relaxed">{sec.summary}</p>

            <div className="pt-2 border-t border-white/5 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Key Disclosures:
              </span>
              <ul className="space-y-1 text-[11px] text-slate-300 font-mono">
                {sec.keyFindings.map((kf, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    <span>{kf}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
