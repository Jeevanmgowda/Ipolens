'use client';

import { type AllotmentScanResult } from '@/types/allotment';
import { ClipboardPaste } from 'lucide-react';

export interface TextParserTabProps {
  handleParseText: () => void;
  isParsingText: boolean;
  parserError: string | null;
  pasteText: string;
  scanResult: AllotmentScanResult | null;
  setPasteText: (value: string) => void;
}

export function TextParserTab({ handleParseText, isParsingText, parserError, pasteText, scanResult, setPasteText }: TextParserTabProps) {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4 text-cyan-400" />
            <span>Smart Registrar Slip & SMS Parser</span>
          </h3>
          <p className="text-xs text-slate-400">
            Paste copied text snippets, table rows, or SMS messages from Link Intime, KFintech, or Bigshare.
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste registrar status snippet, e.g. 'Application No: 202411032, PAN: ABCDE1234F, Shares Applied: 38, Shares Allotted: 38'..."
            className="w-full p-4 bg-slate-950 border border-slate-700 rounded-2xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleParseText}
              disabled={isParsingText || !pasteText.trim()}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {isParsingText ? 'Parsing Snippet...' : 'Extract Allotment Data'}
            </button>

            {parserError && (
              <span className="text-xs text-rose-400">{parserError}</span>
            )}
          </div>
        </div>

        {scanResult && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Extraction Result</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Status: {scanResult.status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Company Matched</span>
                <span className="text-white font-bold">{scanResult.companyMatched || 'Auto'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <span className="text-[10px] text-slate-400 block">PAN Matched</span>
                <span className="text-cyan-300 font-bold">{scanResult.panMatched || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Shares Allotted</span>
                <span className="text-emerald-400 font-bold">{scanResult.sharesAllotted ?? 0} shs</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Confidence</span>
                <span className="text-purple-300 font-bold">{Math.round((scanResult.rawConfidence || 1) * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
