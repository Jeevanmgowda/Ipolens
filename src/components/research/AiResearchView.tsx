'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  FileText,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Send,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { LiveMarketIpoItem } from '@/types/liveMarket';
import type { DrhpAnalysisResult } from '@/lib/services/drhp/analyst.service';

interface AiResearchViewProps {
  initialSymbol?: string;
  initialCompanyName?: string;
  onBackToRadar?: () => void;
}

interface DocRow {
  id: string;
  symbol: string | null;
  companyName: string | null;
  fileName: string | null;
  sourceUrl: string | null;
  pageCount: number;
  chunkCount: number;
  status: 'QUEUED' | 'INDEXING' | 'READY' | 'FAILED';
  error: string | null;
}

interface AnalysisRow {
  id: number;
  status: 'RUNNING' | 'READY' | 'FAILED';
  result: DrhpAnalysisResult | null;
  error: string | null;
}

interface QaItem {
  question: string;
  answer: string;
  found: boolean;
  pages: number[];
}

const QUICK_QUESTIONS = [
  'How will the fresh issue proceeds be used?',
  'What is promoter holding before and after the issue?',
  'How dependent is the company on its top customers?',
  'What material litigation is outstanding?',
  'What are total borrowings and how much will be repaid?',
];

const verdictTone: Record<string, string> = {
  APPLY: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  APPLY_FOR_LISTING_GAINS: 'text-amber-200 border-amber-500/40 bg-amber-500/10',
  AVOID: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
};

const pageRef = (pages: Array<number | null | undefined>) => {
  const p = [...new Set(pages.filter((x): x is number => typeof x === 'number'))].sort((a, b) => a - b);
  return p.length ? `p. ${p.slice(0, 6).join(', ')}` : '';
};

export const AiResearchView: React.FC<AiResearchViewProps> = ({ initialSymbol, onBackToRadar }) => {
  const [ipos, setIpos] = useState<LiveMarketIpoItem[]>([]);
  const [symbol, setSymbol] = useState<string>(initialSymbol || '');
  const [docs, setDocs] = useState<Array<DocRow & { analysis: { status: string } | null }>>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [qa, setQa] = useState<QaItem[]>([]);
  const [asking, setAsking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ipo = useMemo(() => ipos.find((i) => i.symbol === symbol) || null, [ipos, symbol]);

  useEffect(() => {
    fetch('/api/ipos?status=all')
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        const list: LiveMarketIpoItem[] = j.data;
        setIpos(list);
        if (!initialSymbol || !list.some((i) => i.symbol === initialSymbol)) {
          const first = list.find((i) => i.status === 'Open') || list.find((i) => i.status === 'Upcoming') || list[0];
          if (first) setSymbol(first.symbol);
        }
      })
      .catch(() => setError('Could not load the IPO list.'));
  }, [initialSymbol]);

  // Follow a new symbol chosen elsewhere (e.g. "DRHP analysis" on the radar) without an effect.
  const [seenInitial, setSeenInitial] = useState(initialSymbol);
  if (initialSymbol !== seenInitial) {
    setSeenInitial(initialSymbol);
    if (initialSymbol) setSymbol(initialSymbol);
  }

  const loadDocs = useCallback(async (sym: string) => {
    if (!sym) return;
    const r = await fetch(`/api/drhp/documents?symbol=${encodeURIComponent(sym)}`);
    const j = await r.json();
    if (r.status === 401) {
      setError('Sign in to use the DRHP analyst.');
      return;
    }
    if (j.success) {
      setDocs(j.data);
      setActiveDocId(j.data[0]?.id ?? null);
    }
  }, []);

  // Reset per-IPO state when the selected IPO changes (during render, not in an effect).
  const [docsFor, setDocsFor] = useState(symbol);
  if (docsFor !== symbol) {
    setDocsFor(symbol);
    setDocs([]);
    setActiveDocId(null);
    setDoc(null);
    setAnalysis(null);
    setQa([]);
    setError(null);
  }

  useEffect(() => {
    (async () => {
      await loadDocs(symbol);
    })();
  }, [symbol, loadDocs]);

  // Poll the active document until indexing and analysis settle.
  useEffect(() => {
    if (!activeDocId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/drhp/${activeDocId}`);
        const j = await r.json();
        if (stop || !j.success) return;
        setDoc(j.data.document);
        setAnalysis(j.data.analysis);
        const pending =
          ['QUEUED', 'INDEXING'].includes(j.data.document.status) ||
          j.data.analysis?.status === 'RUNNING' ||
          (j.data.document.status === 'READY' && !j.data.analysis);
        if (pending) timer = setTimeout(tick, 4000);
      } catch {
        if (!stop) timer = setTimeout(tick, 8000);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [activeDocId]);

  const submit = async (init: RequestInit, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const r = await fetch('/api/drhp/documents', { method: 'POST', ...init });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Upload failed');
      setActiveDocId(j.data.id);
      await loadDocs(symbol);
      setActiveDocId(j.data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const useProspectus = () =>
    submit(
      { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, useIpoProspectus: true }) },
      'Downloading the offer document…'
    );

  const uploadFile = (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    if (symbol) fd.append('symbol', symbol);
    submit({ body: fd }, 'Uploading and reading the PDF…');
  };

  const rerun = async () => {
    if (!activeDocId) return;
    setBusy('Re-running analysis…');
    setError(null);
    const r = await fetch(`/api/drhp/${activeDocId}/analyze`, { method: 'POST' });
    const j = await r.json();
    if (!j.success) setError(j.error);
    setBusy(null);
    setActiveDocId(null);
    setTimeout(() => setActiveDocId(activeDocId), 50);
  };

  const ask = async (q: string) => {
    if (!activeDocId || !q.trim()) return;
    setAsking(true);
    try {
      const r = await fetch(`/api/drhp/${activeDocId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      setQa((prev) => [{ question: q, ...j.data }, ...prev]);
      setQuestion('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const result = analysis?.status === 'READY' ? analysis.result : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBackToRadar && (
            <button type="button" onClick={onBackToRadar} className="btn-chip">
              <ArrowLeft className="w-3.5 h-3.5" /> Radar
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-cyan-400" /> DRHP AI Analyst
            </h2>
            <p className="text-xs text-slate-400">
              The 4-factor checklist: OFS vs fresh issue, cash flow and P&amp;L, valuation vs peers, DRHP risks. Every figure
              is cited to a page of the offer document.
            </p>
          </div>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="py-2 px-3 rounded-lg bg-slate-900/70 border border-white/10 text-sm text-slate-100 max-w-xs"
          aria-label="IPO"
        >
          {ipos.length === 0 && <option value="">No IPOs loaded</option>}
          {(['Open', 'Upcoming', 'Closed', 'Listed'] as const).map((st) => (
            <optgroup key={st} label={st}>
              {ipos
                .filter((i) => i.status === st)
                .map((i) => (
                  <option key={i.id} value={i.symbol}>
                    {i.companyName} ({i.symbol})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <section className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" /> Offer document
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-chip"
            disabled={!!busy || !(ipo?.rhpUrl || ipo?.drhpUrl)}
            onClick={useProspectus}
            title={ipo?.rhpUrl || ipo?.drhpUrl || 'No prospectus link recorded for this IPO'}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Use the {ipo?.rhpUrl ? 'RHP' : 'DRHP'} from {ipo?.rhpUrl ? 'BSE' : 'SEBI'}
          </button>
          <button type="button" className="btn-chip" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> Upload PDF
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = '';
            }}
          />
          {docs.length > 1 && (
            <select
              value={activeDocId ?? ''}
              onChange={(e) => setActiveDocId(e.target.value)}
              className="py-1 px-2 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-slate-200"
            >
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName || d.sourceUrl?.split('/').pop() || d.id} · {d.status}
                </option>
              ))}
            </select>
          )}
        </div>
        {busy && (
          <p className="text-xs text-cyan-200 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}
          </p>
        )}
        {doc && (
          <p className="text-xs text-slate-400 flex items-center gap-2">
            {doc.status === 'READY' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : doc.status === 'FAILED' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {doc.status === 'READY'
              ? `Indexed ${doc.pageCount} pages into ${doc.chunkCount} searchable passages.`
              : doc.status === 'FAILED'
              ? `Indexing failed: ${doc.error}`
              : `Indexing ${doc.pageCount} pages…`}
            {analysis?.status === 'RUNNING' && ' Running the checklist analysis…'}
            {analysis?.status === 'FAILED' && <span className="text-rose-300"> Analysis failed: {analysis.error}</span>}
          </p>
        )}
        {!doc && !busy && docs.length === 0 && symbol && (
          <p className="text-xs text-slate-500">No offer document analysed for {symbol} yet. Use the official RHP/DRHP link or upload the PDF.</p>
        )}
      </section>

      {result && <Scorecard result={result} onRerun={rerun} busy={!!busy} />}

      {doc?.status === 'READY' && (
        <section className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
          <h3 className="text-sm font-semibold text-white">Ask the DRHP</h3>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} type="button" className="btn-chip" disabled={asking} onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder="Ask anything answered in the offer document"
              className="flex-1 py-2 px-3 rounded-lg bg-slate-900/70 border border-white/10 text-sm text-slate-100"
            />
            <button type="submit" disabled={asking || question.trim().length < 3} className="btn-chip">
              {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Ask
            </button>
          </form>
          <ul className="space-y-2">
            {qa.map((item, i) => (
              <li key={i} className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs space-y-1">
                <p className="font-semibold text-slate-200">{item.question}</p>
                <p className={item.found ? 'text-slate-300' : 'text-amber-200'}>{item.answer}</p>
                {item.pages.length > 0 && <p className="text-slate-500">Source: {pageRef(item.pages)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const Scorecard: React.FC<{ result: DrhpAnalysisResult; onRerun: () => void; busy: boolean }> = ({ result, onRerun, busy }) => {
  const { scorecard, narrative, financials, valuation, overview, offer } = result;
  return (
    <section className="space-y-4">
      <div className="p-5 rounded-xl glass-panel border border-white/10 flex flex-wrap items-center gap-5">
        <div className="text-center">
          <p className="text-4xl font-extrabold text-white font-mono">{scorecard.total}</p>
          <p className="text-xs text-slate-400">out of 10</p>
        </div>
        <div className="flex-1 min-w-[240px] space-y-2">
          <span className={`inline-block px-2.5 py-1 rounded-lg border text-xs font-bold ${verdictTone[scorecard.verdict]}`}>
            {scorecard.verdictLabel}
          </span>
          <p className="text-sm text-slate-300">{narrative.summary}</p>
        </div>
        <button type="button" onClick={onRerun} disabled={busy} className="btn-chip self-start">
          <RefreshCw className="w-3.5 h-3.5" /> Re-run
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {scorecard.factors.map((f) => (
          <div key={f.key} className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">{f.label}</h4>
              <span className="font-mono text-sm text-cyan-200">
                {f.score} / {f.max}
              </span>
            </div>
            <div className="h-1.5 rounded bg-white/5 overflow-hidden">
              <div className="h-full bg-cyan-500/70" style={{ width: `${(f.score / f.max) * 100}%` }} />
            </div>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
              {f.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-500">
              {f.key === 'offer' && pageRef(offer.citations)}
              {f.key === 'financials' && pageRef(financials.citations)}
              {f.key === 'valuation' && pageRef(valuation.citations)}
              {f.key === 'drhp' && pageRef(overview.citations)}
            </p>
          </div>
        ))}
      </div>

      {financials.periods.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 overflow-x-auto">
          <h4 className="text-sm font-semibold text-white mb-2">Restated financials (₹ crore)</h4>
          <table className="w-full text-xs font-mono">
            <thead className="text-slate-400">
              <tr>
                {['Period', 'Revenue', 'EBITDA', 'PAT', 'Op. cash flow', 'Borrowings', 'Net worth', 'RoNW %'].map((h) => (
                  <th key={h} className="text-right first:text-left py-1 pr-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {financials.periods.map((p) => (
                <tr key={p.label} className="border-t border-white/5">
                  <td className="py-1 pr-3">{p.label}</td>
                  {[p.revenueCr, p.ebitdaCr, p.patCr, p.cfoCr, p.totalDebtCr, p.netWorthCr, p.ronwPct].map((v, i) => (
                    <td key={i} className={`text-right pr-3 ${typeof v === 'number' && v < 0 ? 'text-rose-300' : ''}`}>
                      {v ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {valuation.peers.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
          <h4 className="text-sm font-semibold text-white mb-2">Listed peers (from Basis for Offer Price)</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {valuation.peers.map((p) => (
              <div key={p.name} className="p-2 rounded bg-white/5 flex justify-between">
                <span className="text-slate-300 truncate mr-2">{p.name}</span>
                <span className="font-mono">{p.peRatio !== null ? `${p.peRatio}x` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <List title="Pros" tone="text-emerald-300" items={narrative.pros.map((p) => ({ text: p.point, page: p.page }))} />
        <List
          title="Risks"
          tone="text-rose-300"
          items={[
            ...overview.risks.map((r) => ({ text: `${r.title} (${r.severity}): ${r.detail}`, page: r.page })),
            ...narrative.cons.map((c) => ({ text: c.point, page: c.page })),
          ].slice(0, 10)}
        />
      </div>

      <p className="text-[10px] text-slate-500 flex gap-1">
        <Info className="w-3 h-3 shrink-0" /> {result.disclaimer} Model {result.model}, generated{' '}
        {new Date(result.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.
      </p>
    </section>
  );
};

const List: React.FC<{ title: string; tone: string; items: Array<{ text: string; page: number | null }> }> = ({ title, tone, items }) => (
  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
    <h4 className={`text-sm font-semibold mb-2 ${tone}`}>{title}</h4>
    <ul className="space-y-1.5 text-xs text-slate-300">
      {items.map((it, i) => (
        <li key={i}>
          {it.text} {it.page ? <span className="text-slate-500">(p. {it.page})</span> : null}
        </li>
      ))}
      {items.length === 0 && <li className="text-slate-500">None identified.</li>}
    </ul>
  </div>
);

export default AiResearchView;
