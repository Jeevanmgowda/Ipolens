'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DrhpAnalysisResult, QaInteraction } from '@/types/ai';
import { getEffectiveIpoStatus } from '@/components/live-market/IpoCategoriesTabs';
import { LiveMarketIpoItem, IpoCategoryTab } from '@/types/liveMarket';
import { isSameIpo } from '@/lib/utils/ipoDeduplication';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Copy,
  Check,
  FileText,
  Zap,
  Upload,
  FileUp,
  MessageSquare,
  BookOpen,
  Scale,
  Radio,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { LiveTelemetryCard } from './panels/LiveTelemetryCard';
import { OverviewTab } from './panels/OverviewTab';
import { CopilotTab } from './panels/CopilotTab';
import { ForensicTab } from './panels/ForensicTab';
import { ChaptersTab } from './panels/ChaptersTab';
import { FinancialsTab } from './panels/FinancialsTab';

interface AiResearchViewProps {
  initialSymbol?: string;
  initialCompanyName?: string;
  onBackToRadar?: () => void;
}

type InputMode = 'live' | 'upload' | 'paste';
type TabView = 'overview' | 'copilot' | 'forensic' | 'chapters' | 'financials';

export const AiResearchView: React.FC<AiResearchViewProps> = ({
  initialSymbol = 'JIOPLAT',
  initialCompanyName = 'Jio Platforms Limited',
  onBackToRadar,
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('live');
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [companyName, setCompanyName] = useState<string>(initialCompanyName);
  const [customDrhpText, setCustomDrhpText] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [result, setResult] = useState<DrhpAnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [liveIpos, setLiveIpos] = useState<LiveMarketIpoItem[]>([]);
  const [radarCategory, setRadarCategory] = useState<IpoCategoryTab>('open');
  const [seriesFilter, setSeriesFilter] = useState<'all' | 'EQ' | 'SME'>('all');
  const [tickerSearch, setTickerSearch] = useState<string>('');
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Q&A Copilot State
  const [questionInput, setQuestionInput] = useState<string>('');
  const [isAskingQuestion, setIsAskingQuestion] = useState<boolean>(false);
  const [qaHistory, setQaHistory] = useState<QaInteraction[]>([]);
  const [qaError, setQaError] = useState<string | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exact same category counting logic as in IpoCategoriesTabs
  const counts = useMemo(() => {
    let upcoming = 0;
    let open = 0;
    let closed = 0;
    let listed = 0;
    for (const ipo of liveIpos) {
      const eff = getEffectiveIpoStatus(ipo);
      if (eff === 'open') open++;
      else if (eff === 'upcoming') upcoming++;
      else if (eff === 'closed') closed++;
      else if (eff === 'listed') listed++;
    }
    return { upcoming, open, closed, listed };
  }, [liveIpos]);

  // Exact same category and series filtering as in IpoCategoriesTabs with optional search filter
  const categorizedIpos = useMemo(() => {
    return liveIpos
      .filter((ipo) => {
        const eff = getEffectiveIpoStatus(ipo);
        if (eff !== radarCategory) return false;
        if (seriesFilter !== 'all' && ipo.series !== seriesFilter) return false;
        if (tickerSearch.trim()) {
          const q = tickerSearch.trim().toLowerCase();
          return (
            ipo.symbol.toLowerCase().includes(q) ||
            ipo.companyName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (b.gmpPercent || 0) - (a.gmpPercent || 0));
  }, [liveIpos, radarCategory, seriesFilter, tickerSearch]);

  // Fetch live IPOs directly from Live IPO Radar (Open, Upcoming, Closed, Listed)
  useEffect(() => {
    async function loadLiveRadarIpos() {
      try {
        const [liveMarketRes, openRes, upcomingRes, closedRes, listedRes] = await Promise.allSettled([
          fetch('/api/live-market'),
          fetch('/api/ipos/open'),
          fetch('/api/ipos/upcoming'),
          fetch('/api/ipos/closed'),
          fetch('/api/ipos/listed'),
        ]);

        const allRadarItems: LiveMarketIpoItem[] = [];
        if (liveMarketRes.status === 'fulfilled') {
          const lm = await liveMarketRes.value.json();
          if (lm.success && Array.isArray(lm.data?.ipos)) {
            allRadarItems.push(...lm.data.ipos);
          }
        }
        if (openRes.status === 'fulfilled') {
          const j = await openRes.value.json();
          if (j.success && Array.isArray(j.data)) allRadarItems.push(...j.data);
        }
        if (upcomingRes.status === 'fulfilled') {
          const j = await upcomingRes.value.json();
          if (j.success && Array.isArray(j.data)) allRadarItems.push(...j.data);
        }
        if (closedRes.status === 'fulfilled') {
          const j = await closedRes.value.json();
          if (j.success && Array.isArray(j.data)) allRadarItems.push(...j.data);
        }
        if (listedRes.status === 'fulfilled') {
          const j = await listedRes.value.json();
          if (j.success && Array.isArray(j.data)) allRadarItems.push(...j.data);
        }

        if (allRadarItems.length > 0) {
          // Deduplicate by symbol and filter out DEBT
          const uniqueMap = new Map<string, LiveMarketIpoItem>();
          allRadarItems
            .filter((item) => item.series !== 'DEBT')
            .forEach((item) => {
              if (!uniqueMap.has(item.symbol.toUpperCase())) {
                uniqueMap.set(item.symbol.toUpperCase(), item);
              }
            });
          setLiveIpos(Array.from(uniqueMap.values()));
        }
      } catch (err) {
        console.warn('Failed to load live IPO radar issues:', err);
      }
    }

    loadLiveRadarIpos();
  }, []);

  // Auto-fetch analysis on mount or when initialSymbol changes
  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
      if (initialCompanyName) setCompanyName(initialCompanyName);
      fetchAnalysis(initialSymbol, initialCompanyName);
    }
  }, [initialSymbol, initialCompanyName]);

  const fetchAnalysis = async (sym: string, name?: string, customText?: string) => {
    setLoading(true);
    setError(null);
    const symToFetch = (sym || symbol).trim().toUpperCase();
    const nameToFetch = name || companyName;

    // Match with Live IPO Radar issues to enrich
    const radarMatch = liveIpos.find((c) =>
      isSameIpo(c.symbol, c.companyName, symToFetch, nameToFetch)
    );

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
        const enriched: DrhpAnalysisResult = { ...json.data };
        // Hydrate from Live IPO Radar when available
        if (radarMatch) {
          enriched.liveTelemetry = {
            status: radarMatch.status || enriched.liveTelemetry?.status,
            priceBand: radarMatch.priceBand || enriched.liveTelemetry?.priceBand || 'TBD',
            issueSizeCr: radarMatch.issueSizeCr || enriched.liveTelemetry?.issueSizeCr || 0,
            lotSize: radarMatch.lotSize || enriched.liveTelemetry?.lotSize || 0,
            minInvestment: radarMatch.minInvestment || enriched.liveTelemetry?.minInvestment || 0,
            subscriptionTotal: radarMatch.currentSubscription ?? enriched.liveTelemetry?.subscriptionTotal,
            subscriptionRetail: radarMatch.retailSubscription ?? enriched.liveTelemetry?.subscriptionRetail,
            subscriptionNii: radarMatch.niiSubscription ?? enriched.liveTelemetry?.subscriptionNii,
            subscriptionQib: radarMatch.qibSubscription ?? enriched.liveTelemetry?.subscriptionQib,
            gmpEstimate: radarMatch.gmp ?? enriched.liveTelemetry?.gmpEstimate,
            expectedListingGainPct: radarMatch.gmpPercent ?? enriched.liveTelemetry?.expectedListingGainPct,
            registrarName: radarMatch.registrar || enriched.liveTelemetry?.registrarName,
            registrarUrl: radarMatch.registrarUrl || enriched.liveTelemetry?.registrarUrl,
            issueDates:
              radarMatch.openDate && radarMatch.closeDate
                ? `${radarMatch.openDate} – ${radarMatch.closeDate}`
                : enriched.liveTelemetry?.issueDates,
            openDate: radarMatch.openDate || enriched.liveTelemetry?.openDate,
            closeDate: radarMatch.closeDate || enriched.liveTelemetry?.closeDate,
            listingDate: radarMatch.listingDate || enriched.liveTelemetry?.listingDate,
            allotmentDate: radarMatch.allotmentDate || enriched.liveTelemetry?.allotmentDate,
            series: radarMatch.series || enriched.liveTelemetry?.series,
            currentPrice: radarMatch.currentPrice ?? enriched.liveTelemetry?.currentPrice,
            listingPrice: radarMatch.listingPrice ?? enriched.liveTelemetry?.listingPrice,
            issuePrice: radarMatch.issuePrice ?? enriched.liveTelemetry?.issuePrice,
            dayChange: radarMatch.dayChange ?? enriched.liveTelemetry?.dayChange,
            dayChangePercent: radarMatch.dayChangePercent ?? enriched.liveTelemetry?.dayChangePercent,
            tradedVolume: radarMatch.volume ?? enriched.liveTelemetry?.tradedVolume,
          };
          if (radarMatch.issueSizeCr) {
            enriched.issueStructure = {
              freshIssueCr: enriched.issueStructure?.freshIssueCr || Math.round(radarMatch.issueSizeCr * 0.7),
              ofsCr: enriched.issueStructure?.ofsCr || Math.round(radarMatch.issueSizeCr * 0.3),
              totalSizeCr: radarMatch.issueSizeCr,
            };
          }
        }
        setResult(enriched);
        if (json.data.qaHistory && Array.isArray(json.data.qaHistory)) {
          setQaHistory(json.data.qaHistory);
        }
      } else {
        setError(json.error || 'Failed to synthesize DRHP analysis');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with analysis service');
    } finally {
      setLoading(false);
    }
  };

  // Re-hydrate live telemetry when liveIpos loads in the background
  useEffect(() => {
    if (!result || liveIpos.length === 0) return;
    const symToMatch = (result.symbol || symbol).trim().toUpperCase();
    const nameToMatch = result.companyName || companyName;
    const match = liveIpos.find((c) =>
      isSameIpo(c.symbol, c.companyName, symToMatch, nameToMatch)
    );
    if (!match) return;

    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        liveTelemetry: {
          ...prev.liveTelemetry,
          status: match.status || prev.liveTelemetry?.status,
          priceBand: match.priceBand || prev.liveTelemetry?.priceBand || 'TBD',
          issueSizeCr: match.issueSizeCr || prev.liveTelemetry?.issueSizeCr || 0,
          lotSize: match.lotSize || prev.liveTelemetry?.lotSize || 0,
          minInvestment: match.minInvestment || prev.liveTelemetry?.minInvestment || 0,
          subscriptionTotal: match.currentSubscription ?? prev.liveTelemetry?.subscriptionTotal,
          subscriptionRetail: match.retailSubscription ?? prev.liveTelemetry?.subscriptionRetail,
          subscriptionNii: match.niiSubscription ?? prev.liveTelemetry?.subscriptionNii,
          subscriptionQib: match.qibSubscription ?? prev.liveTelemetry?.subscriptionQib,
          gmpEstimate: match.gmp ?? prev.liveTelemetry?.gmpEstimate,
          expectedListingGainPct: match.gmpPercent ?? prev.liveTelemetry?.expectedListingGainPct,
          registrarName: match.registrar || prev.liveTelemetry?.registrarName,
          registrarUrl: match.registrarUrl || prev.liveTelemetry?.registrarUrl,
          issueDates: match.openDate && match.closeDate ? `${match.openDate} – ${match.closeDate}` : prev.liveTelemetry?.issueDates,
          openDate: match.openDate || prev.liveTelemetry?.openDate,
          closeDate: match.closeDate || prev.liveTelemetry?.closeDate,
          listingDate: match.listingDate || prev.liveTelemetry?.listingDate,
          allotmentDate: match.allotmentDate || prev.liveTelemetry?.allotmentDate,
          series: match.series || prev.liveTelemetry?.series,
          currentPrice: match.currentPrice ?? prev.liveTelemetry?.currentPrice,
          listingPrice: match.listingPrice ?? prev.liveTelemetry?.listingPrice,
          issuePrice: match.issuePrice ?? prev.liveTelemetry?.issuePrice,
          dayChange: match.dayChange ?? prev.liveTelemetry?.dayChange,
          dayChangePercent: match.dayChangePercent ?? prev.liveTelemetry?.dayChangePercent,
          tradedVolume: match.volume ?? prev.liveTelemetry?.tradedVolume,
        },
      };
    });
  }, [liveIpos, symbol, companyName]);

  const handleFileUpload = async (file: File) => {
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError('File size exceeds the 25 MB limit for DRHP prospectuses.');
      return;
    }

    setFileError(null);
    setUploadedFile(file);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('symbol', symbol || file.name.split('.')[0].toUpperCase().slice(0, 10));
      formData.append('companyName', companyName || file.name.replace(/\.[^/.]+$/, ''));

      const res = await fetch('/api/analysis', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data) {
        setResult(json.data);
        if (json.data.qaHistory && Array.isArray(json.data.qaHistory)) {
          setQaHistory(json.data.qaHistory);
        }
      } else {
        setError(json.error || 'Failed to parse and analyze uploaded DRHP prospectus');
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading prospectus document');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e?: React.FormEvent, customQ?: string) => {
    if (e) e.preventDefault();
    const queryToAsk = (customQ || questionInput).trim();
    if (!queryToAsk) return;

    setIsAskingQuestion(true);
    setQaError(null);

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          question: queryToAsk,
          drhpText: customDrhpText || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setQaHistory((prev) => [
          ...prev,
          {
            question: queryToAsk,
            answer: json.data.answer,
            pageCitations: json.data.pageCitations || [],
            retrievedChunks: json.data.retrievedChunks || [],
            notFound: json.data.notFound,
          },
        ]);
        setQuestionInput('');
        // Expand chunks of newest question automatically
        setExpandedChunks((prev) => ({ ...prev, [qaHistory.length]: true }));
      } else {
        setQaError(json.error || 'Failed to retrieve answer from prospectus copilot');
      }
    } catch (err: any) {
      setQaError(err.message || 'Error querying prospectus copilot');
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleQuickSelect = (chip: LiveMarketIpoItem) => {
    setSymbol(chip.symbol);
    setCompanyName(chip.companyName);
    setCustomDrhpText('');
    setUploadedFile(null);
    fetchAnalysis(chip.symbol, chip.companyName);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    fetchAnalysis(symbol.trim().toUpperCase(), companyName.trim() || undefined, customDrhpText.trim() || undefined);
  };

  const handleCopyReport = () => {
    if (!result) return;
    const text =
      `📊 IPOLENS AI DRHP Report: ${result.companyName} (${result.symbol})\n` +
      `Verdict: ${result.verdict} | Conviction: ${result.confidenceScore}%\n` +
      `Executive Summary: ${result.verdictReason}\n` +
      `Business Moat: ${result.businessMoat}\n` +
      `Financials: 3-Yr CAGR ${result.financials.revenueCagr} | EBITDA ${result.financials.ebitdaMargin} | Debt/Equity ${result.financials.debtToEquity}\n` +
      `Grounded in SEBI DRHP filing via IPOLENS RAG Pipeline.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSampleDrhp = (type: 'tech' | 'fintech' | 'manufacturing') => {
    if (type === 'tech') {
      setSymbol('TECHCORP');
      setCompanyName('TechCorp Infrastructure Limited');
      setCustomDrhpText(
        'Draft Red Herring Prospectus extract:\nTechCorp delivers mission-critical enterprise Kubernetes infrastructure and AI cloud platforms across 14 countries. Total revenue grew at 42.5% CAGR from FY22 (₹280 Cr) to FY24 (₹570 Cr). EBITDA margin expanded from 18% to 26.5% with positive free cash flows. Working capital cycle is negative 18 days. The company has zero bank debt. Top 5 customers account for 38% of total revenue.'
      );
    } else if (type === 'fintech') {
      setSymbol('FINPAY');
      setCompanyName('FinPay Technologies Limited');
      setCustomDrhpText(
        'Draft Red Herring Prospectus extract:\nFinPay is a digital payment aggregator and UPI terminal provider for tier-2/3 retail merchants. Payment volume reached ₹1.2 lakh crore in FY24. Revenue grew 65% YoY but operating EBITDA remains negative (-6.2%) due to customer acquisition cashbacks. Net cash on balance sheet is ₹850 Cr. Regulatory risk: subject to RBI Payment Aggregator licensing guidelines.'
      );
    } else {
      setSymbol('AEROPREC');
      setCompanyName('AeroPrecision Aerospace Limited');
      setCustomDrhpText(
        'Draft Red Herring Prospectus extract:\nAeroPrecision is a tier-1 supplier of titanium machined assemblies for global defense and commercial aerospace aircraft. Order book stands at ₹1,450 Cr (3.8x FY24 revenue). Operating margin is steady at 19.4% with RoCE of 21.2%. Debt-to-equity ratio is 0.45. Key risk: long lead times for specialized imported alloys and customer qualification cycles exceeding 18 months.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header matching Dark Institutional Dashboard */}
      <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-purple-400" />
              GOOGLE GEMINI 3.0 FLASH ENGINE ACTIVE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              LIVE IPO RADAR TELEMETRY SYNCED
            </span>
            {onBackToRadar && (
              <button
                onClick={onBackToRadar}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 flex items-center gap-1 transition cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Live Radar</span>
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">SEBI Institutional Forensic Pipeline</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              AI DRHP Prospectus Forensic Analyst
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Automated institutional deep dive analysis of Draft Red Herring Prospectus filings powered by real time
              primary market telemetry from Live IPO Radar.
            </p>
          </div>

          {/* Input Mode Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-white/10 text-xs shrink-0">
            <button
              onClick={() => setInputMode('live')}
              className={`px-3 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                inputMode === 'live'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Live Radar Ticker</span>
            </button>
            <button
              onClick={() => setInputMode('upload')}
              className={`px-3 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                inputMode === 'upload'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload DRHP</span>
            </button>
            <button
              onClick={() => setInputMode('paste')}
              className={`px-3 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                inputMode === 'paste'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Text</span>
            </button>
          </div>
        </div>
      </div>

      {/* Input Mode 1: Live Ticker & Search with Ticker Cloud */}
      {inputMode === 'live' && (
        <div className="space-y-4">
          {/* Categorized IPO Lists strictly matching IpoCategoriesTabs */}
          <div className="p-4 rounded-2xl bg-[#0b101d] border border-white/10 space-y-3.5 shadow-xl">
            {/* Category Tabs & Series Filters Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/5 pb-3">
              {/* Main 4 Category Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/5">
                {[
                  { id: 'open', label: 'Open for Bidding', count: counts.open, live: true },
                  { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
                  { id: 'closed', label: 'Closed / Past', count: counts.closed },
                  { id: 'listed', label: 'Listed Market', count: counts.listed },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setRadarCategory(tab.id as IpoCategoryTab);
                      if (carouselRef.current) carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                      radarCategory === tab.id
                        ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-md shadow-cyan-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.live && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          radarCategory === tab.id ? 'bg-slate-950 animate-ping' : 'bg-emerald-400 animate-pulse'
                        }`}
                      />
                    )}
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        radarCategory === tab.id ? 'bg-slate-950/20 text-slate-950' : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Filter & Series Filter: All, Mainboard, SME */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Quick filter..."
                    value={tickerSearch}
                    onChange={(e) => setTickerSearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1 rounded-xl bg-slate-950 border border-white/10 text-[11px] text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500 w-28 sm:w-36 transition"
                  />
                  {tickerSearch && (
                    <button
                      type="button"
                      onClick={() => setTickerSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
                  {(['all', 'EQ', 'SME'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeriesFilter(s)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition cursor-pointer ${
                        seriesFilter === s ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s === 'all' ? 'All Series' : s === 'EQ' ? 'Mainboard' : 'SME'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Categorized Chips Carousel with Nav Controls */}
            {categorizedIpos.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 font-mono">
                No IPOs found in {radarCategory} category matching criteria.
              </div>
            ) : (
              <div className="relative flex items-center">
                {/* Left Scroll Button */}
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  className="shrink-0 mr-1.5 w-7 h-7 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-purple-500/40 flex items-center justify-center shadow-md transition cursor-pointer z-10"
                  title="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Horizontal Scroll Carousel Track */}
                <div
                  ref={carouselRef}
                  className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-1 scrollbar-none flex-1"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {categorizedIpos.map((chip) => {
                    const isSelected = symbol === chip.symbol;
                    const effStatus = getEffectiveIpoStatus(chip);
                    const isListed = effStatus === 'listed';
                    const isOpen = effStatus === 'open';
                    const isUpcoming = effStatus === 'upcoming';
                    const gmpVal = chip.gmp ?? 0;
                    const gmpPct = chip.gmpPercent ?? 0;
                    const dayChangePct = chip.dayChangePercent;

                    return (
                      <button
                        key={chip.symbol}
                        type="button"
                        onClick={() => handleQuickSelect(chip)}
                        className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold cursor-pointer transition flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-purple-400 shadow-md shadow-purple-600/40 ring-1 ring-purple-400'
                            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/5 hover:border-purple-500/40'
                        }`}
                        title={`${chip.companyName} (${chip.series || 'EQ'}) • Click to analyze DRHP`}
                      >
                        <span>{chip.symbol}</span>
                        {chip.series === 'SME' && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            SME
                          </span>
                        )}
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOpen
                              ? 'bg-emerald-400 animate-pulse'
                              : isUpcoming
                              ? 'bg-blue-400'
                              : isListed
                              ? 'bg-cyan-400'
                              : 'bg-slate-500'
                          }`}
                        />
                        {isListed && dayChangePct !== undefined ? (
                          <span
                            className={`text-[10px] font-sans font-semibold ${
                              isSelected ? 'text-white' : dayChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {dayChangePct >= 0 ? '+' : ''}{dayChangePct}%
                          </span>
                        ) : gmpPct > 0 ? (
                          <span className={`text-[10px] font-sans font-semibold ${isSelected ? 'text-white' : 'text-emerald-400'}`}>
                            +{gmpPct.toFixed(0)}%
                          </span>
                        ) : gmpVal > 0 ? (
                          <span className={`text-[10px] font-sans font-semibold ${isSelected ? 'text-white' : 'text-emerald-400'}`}>
                            +₹{gmpVal}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Right Scroll Button */}
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  className="shrink-0 ml-1.5 w-7 h-7 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-purple-500/40 flex items-center justify-center shadow-md transition cursor-pointer z-10"
                  title="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Search & Analyze DRHP Action Bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Live IPO Radar ticker or company name (e.g. JIOPLAT, SWIGGY, HYUNDAI, BAJAJHFL, HDFP, ACMEIND)..."
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !symbol.trim()}
              className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-600/30"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Analyzing...' : 'Analyze DRHP'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Input Mode 2: Upload DRHP Document (PDF / Text) */}
      {inputMode === 'upload' && (
        <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileUp className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Upload Draft Red Herring Prospectus (PDF / Text up to 25 MB)
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">SEBI Standard Formats</span>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-8 border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 rounded-xl bg-slate-950/50 flex flex-col items-center justify-center text-center cursor-pointer transition group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">
              {uploadedFile ? uploadedFile.name : 'Click to select or drag & drop DRHP PDF'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports official SEBI DRHP PDFs and text extracts up to 25 MB.
            </p>
          </div>

          {fileError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}
        </div>
      )}

      {/* Input Mode 3: Direct Excerpt Input */}
      {inputMode === 'paste' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Direct DRHP Excerpt Input
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">Load Benchmark DRHP:</span>
              <button
                type="button"
                onClick={() => loadSampleDrhp('tech')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10"
              >
                Tech
              </button>
              <button
                type="button"
                onClick={() => loadSampleDrhp('fintech')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10"
              >
                Fintech
              </button>
              <button
                type="button"
                onClick={() => loadSampleDrhp('manufacturing')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10"
              >
                Defense
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-1">Company / Issuer Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Solar Industries Limited"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-1">Ticker / Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. ACMEIND"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          <textarea
            rows={5}
            placeholder="Paste raw text from the SEBI DRHP filing (e.g. revenue, margins, debt, customer concentration, competitive strengths)..."
            value={customDrhpText}
            onChange={(e) => setCustomDrhpText(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500 transition"
          />

          <button
            type="button"
            onClick={() =>
              fetchAnalysis(
                symbol.trim().toUpperCase(),
                companyName.trim() || undefined,
                customDrhpText.trim() || undefined
              )
            }
            disabled={loading || !customDrhpText.trim()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer transition disabled:opacity-50"
          >
            {loading ? 'Analyzing with RAG...' : 'Index & Analyze DRHP'}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-purple-500/20 space-y-4 shadow-xl">
          <div className="relative w-12 h-12 mx-auto">
            <div className="w-12 h-12 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
            <Sparkles className="w-5 h-5 text-purple-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Institutional RAG Engine Ingesting DRHP...</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Building semantic vector index, extracting balance sheet disclosures, promoter integrity, peer valuations, and SEBI regulatory risk matrix.
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

      {/* RAG-Powered DRHP Terminal UI */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Executive Verdict Banner */}
          <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden bg-slate-900/60 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    NSE/BSE:{result.symbol}
                  </span>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    {result.source}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    RAG Grounded Model
                  </span>
                  {result.pageCount && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {result.pageCount} Pages Ingested
                    </span>
                  )}
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

                {/* Institutional Conviction Meter */}
                {(() => {
                  const scoreVal = Math.min(100, Math.max(10, Math.round(result.confidenceScore || 75)));
                  const tierLabel =
                    scoreVal >= 80 ? 'High Conviction' : scoreVal >= 65 ? 'Moderate' : 'Cautious';
                  const tierColor =
                    scoreVal >= 80 ? 'text-emerald-400' : scoreVal >= 65 ? 'text-amber-400' : 'text-rose-400';
                  const barGradient =
                    scoreVal >= 80
                      ? 'from-emerald-500 to-teal-400'
                      : scoreVal >= 65
                      ? 'from-amber-500 to-yellow-400'
                      : 'from-rose-500 to-red-400';

                  return (
                    <div className="hidden sm:flex flex-col items-end px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 shadow-inner">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Conviction Score
                        </span>
                        <span className={`text-[10px] font-bold ${tierColor}`}>
                          ({tierLabel})
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 mt-1">
                        <div className="w-20 h-2 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-white/5">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-500`}
                            style={{ width: `${scoreVal}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono font-extrabold text-white">
                          {scoreVal}%
                        </span>
                      </div>
                    </div>
                  );
                })()}

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

          {/* Deep Live IPO Radar Telemetry Integration Card */}
          {result.liveTelemetry && <LiveTelemetryCard result={result} />}

          {/* RAG Sub-Tab Navigation Bar */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-white/10 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Executive Brief</span>
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'copilot'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
              <span>RAG Prospectus Copilot</span>
              {qaHistory.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/30 text-purple-200">
                  {qaHistory.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('forensic')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'forensic'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-amber-300" />
              <span>SEBI Forensic Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('chapters')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'chapters'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
              <span>DRHP Chapters TOC</span>
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'financials'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Financials & Moat</span>
            </button>
          </div>

          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && <OverviewTab result={result} />}

          {/* TAB 2: INTERACTIVE RAG PROSPECTUS COPILOT */}
          {activeTab === 'copilot' && (
            <CopilotTab
              qaHistory={qaHistory}
              qaError={qaError}
              questionInput={questionInput}
              setQuestionInput={setQuestionInput}
              isAskingQuestion={isAskingQuestion}
              handleAskQuestion={handleAskQuestion}
              expandedChunks={expandedChunks}
              setExpandedChunks={setExpandedChunks}
            />
          )}

          {/* TAB 3: SEBI FORENSIC RISK MATRIX */}
          {activeTab === 'forensic' && <ForensicTab result={result} />}

          {/* TAB 4: DRHP CHAPTERS & TABLE OF CONTENTS */}
          {activeTab === 'chapters' && <ChaptersTab result={result} />}

          {/* TAB 5: FINANCIALS & MOAT */}
          {activeTab === 'financials' && <FinancialsTab result={result} />}

          {/* Regulatory SEBI Compliance Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 text-[11px] text-slate-500 leading-relaxed font-sans">
            {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};
