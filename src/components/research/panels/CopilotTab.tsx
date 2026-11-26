'use client';

import type React from 'react';
import { type QaInteraction } from '@/types/ai';
import { AlertTriangle, ChevronDown, ChevronUp, Database, MessageSquare, RefreshCw, Send, Sparkles } from 'lucide-react';

const QUICK_QUESTIONS = [
  'Objects of the Offer & Capex Allocation',
  'Promoter Holding & Post-IPO Dilution',
  'Top 5 Customer Revenue Concentration',
  'Outstanding Litigations & Tax Proceedings',
  'Total Debt & Financial Leverage Profile',
  'Anchor Investor 30/90-Day Lock-in Schedule',
];

export interface CopilotTabProps {
  qaHistory: QaInteraction[];
  qaError: string | null;
  questionInput: string;
  setQuestionInput: (value: string) => void;
  isAskingQuestion: boolean;
  handleAskQuestion: (e?: React.FormEvent, customQ?: string) => void | Promise<void>;
  expandedChunks: Record<number, boolean>;
  setExpandedChunks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export function CopilotTab({ qaHistory, qaError, questionInput, setQuestionInput, isAskingQuestion, handleAskQuestion, expandedChunks, setExpandedChunks }: CopilotTabProps) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-purple-500/30 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              RAG Prospectus Forensic Copilot
            </h4>
            <p className="text-[11px] text-slate-400">
              Hybrid BM25 + Semantic Passage Retrieval grounded to official SEBI filing
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
          Vector Retrieval Active
        </span>
      </div>

      {/* Quick Prompt Chips */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
          Quick Institutional Queries:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAskQuestion(undefined, q)}
              disabled={isAskingQuestion}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Q&A Chat History Stream with Retrieved Chunks */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {qaHistory.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-white/10 space-y-2">
            <MessageSquare className="w-8 h-8 text-purple-400/60 mx-auto" />
            <p className="text-xs font-semibold text-white">Ask anything about the prospectus</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Click any quick query above or type your question below. The RAG model will retrieve the exact chapter passages and verify facts.
            </p>
          </div>
        ) : (
          qaHistory.map((qa, i) => (
            <div key={i} className="space-y-2.5 text-xs">
              {/* User Question */}
              <div className="flex items-start gap-2.5 text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  Q
                </div>
                <span className="font-semibold text-white mt-0.5">{qa.question}</span>
              </div>

              {/* RAG Grounded Answer */}
              <div className="flex items-start gap-2.5 text-slate-300 bg-purple-950/30 p-4 rounded-xl border border-purple-500/20">
                <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                  A
                </div>
                <div className="space-y-3 flex-1">
                  <p className="leading-relaxed text-slate-200">{qa.answer}</p>

                  {/* Page Citations */}
                  {qa.pageCitations && qa.pageCitations.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-mono">Grounded Citations:</span>
                      {qa.pageCitations.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        >
                          Page {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Retrieved Source Passages Accordion */}
                  {qa.retrievedChunks && qa.retrievedChunks.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedChunks((prev) => ({ ...prev, [i]: !prev[i] }))
                        }
                        className="flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200 font-semibold cursor-pointer"
                      >
                        {expandedChunks[i] ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {expandedChunks[i] ? 'Hide' : 'Inspect'} {qa.retrievedChunks.length} Retrieved Source Passages
                        </span>
                      </button>

                      {expandedChunks[i] && (
                        <div className="space-y-2 pt-1">
                          {qa.retrievedChunks.map((chunk, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-3 rounded-lg bg-slate-950/80 border border-white/5 text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-semibold text-purple-300">{chunk.section}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">Page {chunk.pageNumber}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-mono">
                                    {Math.round(chunk.score * 100)}% match
                                  </span>
                                </div>
                              </div>
                              <p className="text-slate-300 italic font-mono leading-relaxed">
                                &quot;{chunk.snippet}&quot;
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Question Input Form */}
      <form onSubmit={handleAskQuestion} className="flex gap-2 pt-2 border-t border-white/5">
        <input
          type="text"
          placeholder="Ask anything about the DRHP (e.g. debt repayment, promoter litigation, anchor lock-in)..."
          value={questionInput}
          onChange={(e) => setQuestionInput(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
        />
        <button
          type="submit"
          disabled={isAskingQuestion || !questionInput.trim()}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-purple-600/30"
        >
          {isAskingQuestion ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isAskingQuestion ? 'Retrieving...' : 'Ask RAG'}</span>
        </button>
      </form>

      {qaError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{qaError}</span>
        </div>
      )}
    </div>
  );
}
