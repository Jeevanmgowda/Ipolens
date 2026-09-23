'use client';

import React, { useState, useEffect } from 'react';
import { DrhpAnalysisResult, AnalystVerdict } from '@/types/ai';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Building2,
  Search,
  Layers,
  Copy,
  Check,
  FileText,
  Zap,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AiResearchViewProps {
  initialSymbol?: string;
  initialCompanyName?: string;
}

interface LiveIpoChip {
  symbol: string;
  companyName: string;
  status: string;
}

export const AiResearchView: React.FC<AiResearchViewProps> = ({
  initialSymbol = 'NSE',
  initialCompanyName = 'National Stock Exchange of India Ltd',
}) => {
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [companyName, setCompanyName] = useState<string>(initialCompanyName);
  const [customDrhpText, setCustomDrhpText] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [result, setResult] = useState<DrhpAnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [liveIpos, setLiveIpos] = useState<LiveIpoChip[]>([]);

  // Fetch list of active & upcoming IPOs for quick picker
  useEffect(() => {
    fetch('/api/ipos/live')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setLiveIpos(
            json.data.slice(0, 8).map((item: any) => ({
              symbol: item.symbol,
              companyName: item.companyName,
              status: item.status,
            }))
          );
        }
      })
      .catch(() => {
        // fallback chips
        setLiveIpos([
          { symbol: 'SWIGGY', companyName: 'Swiggy Limited', status: 'Closed' },
          { symbol: 'HYUNDAI', companyName: 'Hyundai Motor India Limited', status: 'Closed' },
          { symbol: 'BAJAJHFL', companyName: 'Bajaj Housing Finance Limited', status: 'Closed' },
          { symbol: 'PREMIERENE', companyName: 'Premier Energies Limited', status: 'Closed' },
          { symbol: 'KRN', companyName: 'KRN Heat Exchanger Limited', status: 'Closed' },
          { symbol: 'TATATECH', companyName: 'Tata Technologies Limited', status: 'Closed' },
          { symbol: 'NETWEB', companyName: 'Netweb Technologies Limited', status: 'Closed' },
          { symbol: 'IREDA', companyName: 'Indian Renewable Energy Dev Agency', status: 'Closed' },
        ]);
      });
  }, []);

  const fetchAnalysis = async (symToFetch: string, nameToFetch?: string, customText?: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symToFetch,
          companyName: nameToFetch || symToFetch,
          drhpText: customText || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setResult(json.data);
      } else {
        setError(json.error || 'Failed to synthesize DRHP analysis');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with analysis service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
      setCompanyName(initialCompanyName || initialSymbol);
      fetchAnalysis(initialSymbol, initialCompanyName);
    }
  }, [initialSymbol, initialCompanyName]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    fetchAnalysis(symbol.trim().toUpperCase(), companyName.trim() || undefined, customDrhpText.trim() || undefined);
  };

  const handleQuickSelect = (chip: LiveIpoChip) => {
    setSymbol(chip.symbol);
    setCompanyName(chip.companyName);
    setCustomDrhpText('');
    fetchAnalysis(chip.symbol, chip.companyName);
  };

  const handleCopyReport = () => {
    if (!result) return;
    const text = `📊 IPOLENS AI DRHP Report: ${result.companyName} (${result.symbol})\n` +
      `Verdict: ${result.verdict.toUpperCase()} (Confidence: ${result.confidenceScore}%)\n` +
      `Rationale: ${result.verdictReason}\n\n` +
      `Key Strengths:\n${result.topStrengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
      `Critical Risks:\n${result.topRisks.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n` +
      `Financials: Revenue CAGR: ${result.financials.revenueCagr}, EBITDA: ${result.financials.ebitdaMargin}, P/E: ${result.financials.peRatio}\n` +
      `Moat: ${result.businessMoat}\n\n` +
      `Source: ${result.source}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSampleDrhp = (type: 'tech' | 'fintech' | 'manufacturing') => {
    if (type === 'tech') {
      setSymbol('TECHCORP');
      setCompanyName('TechCorp Cloud Infrastructure Ltd');
      setCustomDrhpText(
        'Draft Red Herring Prospectus extract:\nTechCorp delivers mission-critical enterprise Kubernetes infrastructure and AI cloud platforms across 14 countries. Total revenue grew at 42.5% CAGR from FY22 (₹280 Cr) to FY24 (₹570 Cr). EBITDA margin expanded from 18% to 26.5% with positive free cash flows. Working capital cycle is negative 18 days. The company has zero bank debt. Top 5 customers account for 38% of total revenue.'
      );
    } else if (type === 'fintech') {
      setSymbol('FINPAY');
      setCompanyName('FinPay Digital Payments Ltd');
      setCustomDrhpText(
        'Draft Red Herring Prospectus extract:\nFinPay is a digital payment aggregator and UPI terminal provider for tier-2/3 retail merchants. Payment volume reached ₹1.2 lakh crore in FY24. Revenue grew 65% YoY but operating EBITDA remains negative (-6.2%) due to customer acquisition cashbacks. Net cash on balance sheet is ₹850 Cr. Regulatory risk: subject to RBI Payment Aggregator licensing guidelines.'
      );
    } else {
      setSymbol('AEROPREC');
      setCompanyName('AeroPrecision Aerospace Components Ltd');
      setCustomDrhpText(
        'Draft Red Herring Prospectus extract:\nAeroPrecision is a tier-1 supplier of titanium machined assemblies for global defense and commercial aerospace aircraft. Order book stands at ₹1,450 Cr (3.8x FY24 revenue). Operating margin is steady at 19.4% with RoCE of 21.2%. Debt-to-equity ratio is 0.45. Key risk: long lead times for specialized imported alloys and customer qualification cycles exceeding 18 months.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Prompt Selection Bar */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
              GEMINI 2.5 FLASH ENGINE ACTIVE
            </span>
            <span className="text-[11px] text-slate-400 font-mono">SEBI Institutional Forensic Pipeline</span>
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            AI DRHP Prospectus Forensic Analyst
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Automated deep-dive analysis of Draft Red Herring Prospectus filings: Subscribe/Avoid/Neutral conviction, forensic watchouts, competitive moats, and valuation safety margins.
          </p>
        </div>

        {/* Action Toggle */}
        <button
          onClick={() => setShowCustomInput(!showCustomInput)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-2 border ${
            showCustomInput
              ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{showCustomInput ? 'Hide Prospectus Input' : 'Paste Custom DRHP Text'}</span>
          {showCustomInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Live IPO Quick Selection Bar */}
      {liveIpos.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1 mr-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Quick Select Live Issue:
          </span>
          {liveIpos.map((chip) => (
            <button
              key={chip.symbol}
              onClick={() => handleQuickSelect(chip)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition flex items-center gap-1.5 ${
                symbol === chip.symbol
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
            >
              <span>{chip.symbol}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  chip.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Custom DRHP Prospectus Inspector (Collapsible) */}
      {showCustomInput && (
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Direct DRHP Prospectus Input
              </h4>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400">Load sample:</span>
              <button
                type="button"
                onClick={() => loadSampleDrhp('tech')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 cursor-pointer"
              >
                Tech Cloud
              </button>
              <button
                type="button"
                onClick={() => loadSampleDrhp('fintech')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 cursor-pointer"
              >
                FinTech
              </button>
              <button
                type="button"
                onClick={() => loadSampleDrhp('manufacturing')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 cursor-pointer"
              >
                Aerospace
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Company Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Cloud Infrastructure Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Proposed Ticker Symbol
              </label>
              <input
                type="text"
                placeholder="e.g. ACME"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
              Prospectus Excerpt (Financials, Growth, Risks, Moat)
            </label>
            <textarea
              rows={4}
              placeholder="Paste raw text from the SEBI DRHP filing (e.g. revenue, margins, debt, customer concentration, competitive strengths)..."
              value={customDrhpText}
              onChange={(e) => setCustomDrhpText(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500 resize-y"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => fetchAnalysis(symbol.trim() || 'CUSTOM', companyName.trim() || undefined, customDrhpText.trim() || undefined)}
              disabled={loading || !customDrhpText.trim()}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-2 shadow-md shadow-purple-600/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Synthesizing with Gemini 2.5 Flash...' : 'Run Gemini 2.5 Flash Synthesis'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Standard Search Bar */}
      {!showCustomInput && (
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Enter any NSE symbol or company name (e.g. NSE, SWIGGY, HYUNDAI, BAJAJHFL, TATATECH)..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !symbol.trim()}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-purple-600/25"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Analyzing...' : 'Analyze DRHP'}</span>
          </button>
        </form>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-purple-500/20 space-y-4 shadow-xl">
          <div className="relative w-12 h-12 mx-auto">
            <div className="w-12 h-12 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
            <Sparkles className="w-5 h-5 text-purple-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Google Gemini 2.5 Flash Ingestion in Progress...</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Extracting balance sheet health, promoter integrity, peer valuations, anchor book quality, and regulatory watchouts.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Analysis Result Card */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden bg-slate-900/60 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    NSE:{result.symbol}
                  </span>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    {result.source}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {result.companyName}
                </h3>
              </div>

              {/* Verdict & Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyReport}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs"
                  title="Copy executive brief"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Brief'}</span>
                </button>

                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                    Conviction Score
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {result.confidenceScore}% / 100%
                  </span>
                </div>

                <div
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-sm tracking-wide uppercase border flex items-center gap-2 shadow-lg ${
                    result.verdict === 'Subscribe'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/15'
                      : result.verdict === 'Avoid'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/15'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/15'
                  }`}
                >
                  {result.verdict === 'Subscribe' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {result.verdict === 'Avoid' && <XCircle className="w-4 h-4 text-rose-400" />}
                  {result.verdict === 'Neutral' && <HelpCircle className="w-4 h-4 text-amber-400" />}
                  <span>{result.verdict}</span>
                </div>
              </div>
            </div>

            {/* Verdict Rationale */}
            <p className="text-xs sm:text-sm text-slate-300 mt-4 leading-relaxed p-4 rounded-xl bg-slate-950/70 border border-white/5">
              <strong className="text-white font-bold">Executive Rationale: </strong>
              {result.verdictReason}
            </p>
          </div>

          {/* Top 3 Strengths & Top 3 Risks Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Top 3 Key Competitive Strengths & Moats
              </h4>
              <div className="space-y-2.5">
                {result.topStrengths.map((str, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-500/20 flex items-start gap-3 text-xs text-slate-200"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[10px] font-mono">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{str}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Factors */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Top 3 Critical Risk Factors & Watchouts
              </h4>
              <div className="space-y-2.5">
                {result.topRisks.map((risk, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-rose-500/20 flex items-start gap-3 text-xs text-slate-200"
                  >
                    <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 font-bold flex items-center justify-center shrink-0 text-[10px] font-mono">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Financial Health Scorecard */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Financial Health & Valuation Metrics
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 block">Revenue Growth</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block">
                  {result.financials.revenueCagr}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 block">EBITDA Margin</span>
                <span className="text-sm font-bold text-cyan-400 mt-1 block">
                  {result.financials.ebitdaMargin}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 block">PAT Margin</span>
                <span className="text-sm font-bold text-slate-200 mt-1 block">
                  {result.financials.patMargin}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 block">Debt to Equity</span>
                <span className="text-sm font-bold text-amber-400 mt-1 block">
                  {result.financials.debtToEquity}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 block">Offer P/E Multiple</span>
                <span className="text-sm font-bold text-purple-400 mt-1 block">
                  {result.financials.peRatio}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5">
                <span className="text-[10px] text-slate-500 block">Industry Peer P/E</span>
                <span className="text-sm font-bold text-slate-300 mt-1 block">
                  {result.financials.industryPe}
                </span>
              </div>
            </div>

            {/* Business Moat */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 text-xs">
              <span className="font-bold text-cyan-300">Core Competitive Moat: </span>
              <span className="text-slate-300">{result.businessMoat}</span>
            </div>
          </div>

          {/* Regulatory SEBI Compliance Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-[11px] text-slate-500 leading-relaxed font-sans">
            {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};
