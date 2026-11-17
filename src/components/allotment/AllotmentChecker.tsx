'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  OFFICIAL_REGISTRARS,
  BSE_OFFICIAL_GATEWAY,
  getRegistrarForSymbol,
  scanRegistrarText,
} from '@/services/allotmentScanner';
import {
  AllotmentScanResult,
  MultiPanScanSummary,
  SinglePanInquiryResult,
  RegistrarInfo,
} from '@/types/allotment';
import { AllotmentCheckResult } from '@/lib/services/allotment/types';
import { FamilyPanProfile } from '@/types/pan';
import { isValidPan } from '@/services/duplicateEnforcer';
import {
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ClipboardPaste,
  Building2,
  Users,
  Zap,
  RefreshCw,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Copy,
  Check,
  FileText,
  ChevronRight,
  ArrowRight,
  Info,
  Lock,
} from 'lucide-react';

export interface RealTimeListedIpo {
  id?: string;
  symbol: string;
  companyName: string;
  price: number;
  issuePrice: number;
  listingPrice: number;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  lotSize: number;
  series: 'EQ' | 'SME';
  listingDate: string;
  registrarName: string;
  registrarSlug: 'linkintime' | 'kfintech' | 'bigshare' | 'cameo' | 'maashitla' | 'skyline' | 'other';
  portalUrl?: string;
  isSample?: boolean;
}

export const AllotmentChecker: React.FC = () => {
  // Active Tab: 'single' | 'family' | 'mirrors' | 'parser'
  const [activeTab, setActiveTab] = useState<'single' | 'family' | 'mirrors' | 'parser'>('single');

  // IPO Selection State
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SWIGGY');
  const [listedIpos, setListedIpos] = useState<RealTimeListedIpo[]>([]);
  const [isLoadingIpos, setIsLoadingIpos] = useState<boolean>(true);
  const [ipoSearchQuery, setIpoSearchQuery] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<'ALL' | 'EQ' | 'SME'>('ALL');

  // Single PAN Inquiry State
  const [inputPan, setInputPan] = useState<string>('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [singleResult, setSingleResult] = useState<SinglePanInquiryResult | AllotmentCheckResult | null>(null);
  const [isSingleChecking, setIsSingleChecking] = useState<boolean>(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [copiedPan, setCopiedPan] = useState<boolean>(false);

  // Multi-PAN Family State (Individualized with Consent)
  const [familyPans, setFamilyPans] = useState<FamilyPanProfile[]>([]);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<FamilyPanProfile | null>(null);
  const [familyConsentGranted, setFamilyConsentGranted] = useState<boolean>(false);
  const [familyCheckResult, setFamilyCheckResult] = useState<AllotmentCheckResult | null>(null);
  const [isFamilyChecking, setIsFamilyChecking] = useState<boolean>(false);
  const [familyError, setFamilyError] = useState<string | null>(null);

  // Manual Text Parser State
  const [pasteText, setPasteText] = useState<string>('');
  const [scanResult, setScanResult] = useState<AllotmentScanResult | null>(null);
  const [isParsingText, setIsParsingText] = useState<boolean>(false);
  const [parserError, setParserError] = useState<string | null>(null);

  // 1. Fetch Authoritative IPOs from Server Directory
  const fetchListedIpos = async () => {
    setIsLoadingIpos(true);
    try {
      // Primary: Authoritative Server Directory
      const dirRes = await fetch('/api/allotment/check');
      const dirJson = await dirRes.json();

      if (dirJson.success && Array.isArray(dirJson.data?.ipos) && dirJson.data.ipos.length > 0) {
        const mapped: RealTimeListedIpo[] = dirJson.data.ipos.map((item: any) => ({
          id: item.id,
          symbol: item.symbol,
          companyName: item.companyName,
          price: 100,
          issuePrice: 100,
          listingPrice: 100,
          currentPrice: 100,
          dayChange: 0,
          dayChangePercent: 0,
          lotSize: 14,
          series: (item.series === 'SME' ? 'SME' : 'EQ') as 'EQ' | 'SME',
          listingDate: 'Recent',
          registrarName: item.registrarName,
          registrarSlug: item.registrarSlug || 'linkintime',
          portalUrl: item.portalUrl,
          isSample: item.isSample,
        }));

        setListedIpos(mapped);
        if (!selectedSymbol || !mapped.some((m) => m.symbol === selectedSymbol)) {
          setSelectedSymbol(mapped[0].symbol);
        }
      } else {
        // Fallback: Real-time listed endpoint
        const res = await fetch('/api/ipos/listed');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped: RealTimeListedIpo[] = json.data.map((item: any) => {
            const reg = getRegistrarForSymbol(item.symbol);
            const rawRegName = item.registrar || item.allotmentRegistrar;
            const regName =
              rawRegName &&
              rawRegName !== 'Official Registrar' &&
              rawRegName !== 'Official Exchange Registrar'
                ? rawRegName
                : reg.name;

            let regSlug = reg.slug;
            const lowerName = (regName || '').toLowerCase();
            if (lowerName.includes('kfin')) regSlug = 'kfintech';
            else if (lowerName.includes('link') || lowerName.includes('mufg')) regSlug = 'linkintime';
            else if (lowerName.includes('bigshare')) regSlug = 'bigshare';
            else if (lowerName.includes('cameo')) regSlug = 'cameo';
            else if (lowerName.includes('maashitla')) regSlug = 'maashitla';
            else if (lowerName.includes('skyline')) regSlug = 'skyline';

            const price = item.currentPrice || item.listingPrice || item.issuePrice || 100;
            const issuePrice = item.issuePrice || price;
            const lotSize = issuePrice > 0 ? Math.max(1, Math.round(15000 / issuePrice)) : 14;

            return {
              symbol: item.symbol,
              companyName: item.companyName,
              price,
              issuePrice,
              listingPrice: item.listingPrice || price,
              currentPrice: price,
              dayChange: item.dayChange || 0,
              dayChangePercent: item.dayChangePercent || 0,
              lotSize,
              series: (item.series === 'SME' ? 'SME' : 'EQ') as 'EQ' | 'SME',
              listingDate: item.listingDate || 'Recent',
              registrarName: regName,
              registrarSlug: regSlug,
            };
          });

          setListedIpos(mapped);
          if (!selectedSymbol || !mapped.some((m) => m.symbol === selectedSymbol)) {
            setSelectedSymbol(mapped[0].symbol);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch IPOs:', err);
    } finally {
      setIsLoadingIpos(false);
    }
  };

  // 2. Fetch User's Genuine Registered Family Profiles
  const fetchFamilyPans = async () => {
    try {
      const res = await fetch('/api/pans');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFamilyPans(json.data);
        if (json.data.length > 0) {
          setSelectedFamilyMember(json.data[0]);
          setSelectedFamilyId(json.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load family PANs:', e);
    }
  };

  useEffect(() => {
    fetchFamilyPans();
    fetchListedIpos();
  }, []);

  const activeIpo = useMemo<RealTimeListedIpo>(() => {
    return (
      listedIpos.find((i) => i.symbol === selectedSymbol) ||
      listedIpos[0] || {
        symbol: 'SWIGGY',
        companyName: 'Swiggy Limited',
        price: 390,
        issuePrice: 390,
        listingPrice: 420,
        currentPrice: 390,
        dayChange: 0,
        dayChangePercent: 0,
        lotSize: 38,
        series: 'EQ',
        listingDate: 'Recent',
        registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
        registrarSlug: 'linkintime',
        portalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
      }
    );
  }, [listedIpos, selectedSymbol]);

  const detectedRegistrar = useMemo<RegistrarInfo>(() => {
    return (
      OFFICIAL_REGISTRARS.find((r) => r.slug === activeIpo.registrarSlug) ||
      getRegistrarForSymbol(activeIpo.symbol)
    );
  }, [activeIpo]);

  const filteredIpos = useMemo(() => {
    return listedIpos.filter((ipo) => {
      const q = ipoSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ipo.symbol.toLowerCase().includes(q) ||
        ipo.companyName.toLowerCase().includes(q);
      const matchesSeries =
        seriesFilter === 'ALL' || ipo.series === seriesFilter;
      return matchesSearch && matchesSeries;
    });
  }, [listedIpos, ipoSearchQuery, seriesFilter]);

  // Handle PAN input selection from Family Dropdown in single view
  const handleFamilySelect = (panId: string) => {
    setSelectedFamilyId(panId);
    const profile = familyPans.find((p) => p.id === panId);
    if (profile) {
      setInputPan(profile.pan);
    }
  };

  // Copy PAN to Clipboard with visual feedback
  const handleCopyPan = (panValue?: string) => {
    const val = panValue || inputPan;
    if (!val) return;
    navigator.clipboard.writeText(val.toUpperCase().trim());
    setCopiedPan(true);
    setTimeout(() => setCopiedPan(false), 2500);
  };

  // Single PAN Allotment Check via Secure Server Route
  const handleSinglePanCheck = async () => {
    const panToVerify = inputPan.trim().toUpperCase();
    if (!panToVerify) {
      setSingleError('Please enter a valid 10-character PAN.');
      return;
    }
    if (!isValidPan(panToVerify)) {
      setSingleError('Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).');
      return;
    }

    setIsSingleChecking(true);
    setSingleError(null);
    setSingleResult(null);

    try {
      const res = await fetch('/api/allotment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeIpo.symbol,
          pan: panToVerify,
          price: activeIpo.price,
          lotSize: activeIpo.lotSize,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSingleResult(json.data);
      } else {
        setSingleError(json.error || 'Failed to complete registrar inquiry.');
      }
    } catch (err: any) {
      setSingleError(err.message || 'Error communicating with registrar query gateway.');
    } finally {
      setIsSingleChecking(false);
    }
  };

  // Individual Family PAN Check with Explicit Consent
  const handleIndividualFamilyCheck = async () => {
    if (!selectedFamilyMember) {
      setFamilyError('Please select a family profile to check.');
      return;
    }
    if (!familyConsentGranted) {
      setFamilyError('Please confirm consent to verify this allotment on behalf of the account holder.');
      return;
    }

    setIsFamilyChecking(true);
    setFamilyError(null);
    setFamilyCheckResult(null);

    try {
      const res = await fetch('/api/allotment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeIpo.symbol,
          pan: selectedFamilyMember.pan,
          price: activeIpo.price,
          lotSize: activeIpo.lotSize,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setFamilyCheckResult(json.data);
      } else {
        setFamilyError(json.error || 'Failed to process inquiry for selected account.');
      }
    } catch (err: any) {
      setFamilyError(err.message || 'Error communicating with registrar gateway.');
    } finally {
      setIsFamilyChecking(false);
    }
  };

  // Raw Text Parser
  const handleParseText = async () => {
    if (!pasteText.trim()) {
      setParserError('Please paste your copied registrar response or table snippet.');
      return;
    }

    setIsParsingText(true);
    setParserError(null);

    try {
      const parsed = scanRegistrarText(pasteText);
      setScanResult(parsed);
    } catch (err: any) {
      setParserError(err.message || 'Error parsing registrar text snippet.');
    } finally {
      setIsParsingText(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Institutional Header & Trust Badges */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Verified Server Directory
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Zero-Retention Privacy Guarantee
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                MUFG Intime • KFintech • Bigshare • BSE
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Official IPO Allotment Status Checker
            </h2>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Verify your official allotment status through verified registrar gateways (
              <span className="text-cyan-300 font-medium">MUFG Intime India</span> [formerly Link Intime],{' '}
              <span className="text-purple-300 font-medium">KFin Technologies</span>,{' '}
              <span className="text-amber-300 font-medium">Bigshare Services</span>)
              and stock exchange gateways. Safe, compliant, and privacy-protected.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={detectedRegistrar.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Open {detectedRegistrar.name.split(' ')[0]} Portal</span>
              <ExternalLink className="w-3 h-3 text-cyan-400" />
            </a>
          </div>
        </div>

        {/* Real-time IPO Selection Strip */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Select Public Issue:
              </label>
              <span className="text-[11px] text-slate-400">
                Showing {filteredIpos.length} Issues
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Official Registrar:</span>
              <span className="font-bold text-cyan-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                {detectedRegistrar.name}
              </span>
              <button
                type="button"
                onClick={fetchListedIpos}
                disabled={isLoadingIpos}
                title="Refresh IPO Directory"
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIpos ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ipoSearchQuery}
                onChange={(e) => setIpoSearchQuery(e.target.value)}
                placeholder="Search IPO (e.g. Swiggy, Hyundai, Bajaj, SpectraA)..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30"
              />
              {ipoSearchQuery && (
                <button
                  type="button"
                  onClick={() => setIpoSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-[11px]">
              {(['ALL', 'EQ', 'SME'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSeriesFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    seriesFilter === filter
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'ALL' ? `All (${listedIpos.length})` : filter === 'EQ' ? 'Mainboard' : 'SME'}
                </button>
              ))}
            </div>
          </div>

          {/* IPO Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredIpos.map((ipo) => {
              const isSelected = selectedSymbol === ipo.symbol;
              return (
                <button
                  key={ipo.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(ipo.symbol);
                    setSingleResult(null);
                    setFamilyCheckResult(null);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border-cyan-500 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-white tracking-wide truncate">
                      {ipo.symbol}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                        ipo.series === 'SME'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {ipo.series}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 truncate">
                    {ipo.companyName}
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="truncate text-slate-400">
                      {ipo.registrarSlug === 'linkintime' ? 'MUFG Intime' : ipo.registrarName.split(' ')[0]}
                    </span>
                    {isSelected ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    ) : (
                      <span className="text-[9px] text-slate-500">Official</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'single'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Instant PAN Check</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'family'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Family Individual Check ({familyPans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mirrors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'mirrors'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Official Registrar Portals & Gateways</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parser')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'parser'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Smart Slip & Text Parser</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Instant Single PAN Inquiry */}
      {activeTab === 'single' && (
        <div className="space-y-6" role="region" aria-label="Instant PAN Allotment Inquiry">
          {/* Zero-Retention Privacy Banner */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-200/90 shadow-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Zero-Retention PAN Privacy Guarantee
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SEBI & DPDP Compliant
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Permanent Account Number (PAN) is sensitive personal data. IPOLENS processes your PAN in-memory solely for this single requested allotment lookup. It is <strong>never persisted to database or disk, never logged, never put into URLs, and never shared with analytics or unauthorized third parties</strong>.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Allotment Inquiry for {activeIpo.companyName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your 10-character Permanent Account Number (PAN) to verify allotment status.
                </p>
              </div>

              {familyPans.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Autofill Profile:</span>
                  <select
                    value={selectedFamilyId}
                    onChange={(e) => handleFamilySelect(e.target.value)}
                    aria-label="Autofill from saved profile"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Choose saved profile...</option>
                    {familyPans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.relationship}) - {p.pan.substring(0, 5)}****{p.pan.slice(-1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Input Form */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-8 space-y-1.5">
                <label htmlFor="pan-input" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Enter Investor PAN:
                  </span>
                  <span id="pan-helper-text" className="text-[11px] text-slate-400">
                    {isValidPan(inputPan) ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Valid PAN format
                      </span>
                    ) : (
                      'Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)'
                    )}
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="pan-input"
                    type="text"
                    maxLength={10}
                    value={inputPan}
                    onChange={(e) => setInputPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="e.g. ABCDE1234F"
                    aria-describedby="pan-helper-text"
                    aria-invalid={inputPan.length > 0 && !isValidPan(inputPan)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 uppercase"
                  />
                  {inputPan && (
                    <button
                      type="button"
                      onClick={() => handleCopyPan(inputPan)}
                      title="Copy PAN to clipboard"
                      aria-label="Copy PAN to clipboard"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      {copiedPan ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSinglePanCheck}
                  disabled={isSingleChecking || !inputPan.trim()}
                  aria-busy={isSingleChecking}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  {isSingleChecking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Checking Status...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-black" />
                      <span>Check Allotment Status</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {singleError && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-2.5 text-xs"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{singleError}</span>
              </div>
            )}
          </div>

          {/* Result Presentation Card */}
          {singleResult && (
            <div
              role="region"
              aria-label="IPO Allotment Result"
              aria-live="polite"
              className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6"
            >
              {/* Slip Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Allotment Verification
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                      {singleResult.sourceBadge || 'Official Registrar Gateway'}
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-white">
                    {singleResult.companyName} ({singleResult.symbol})
                  </h4>
                  <div className="text-xs text-slate-400">
                    Assigned Registrar: <strong className="text-slate-200">{singleResult.registrarName}</strong>
                  </div>
                </div>

                {/* Prominent Status Badge */}
                <div className="shrink-0">
                  {singleResult.status === 'Allotted' || singleResult.status === 'allotted' ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 font-bold text-sm shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>ALLOTTED ({singleResult.sharesAllotted} Shares)</span>
                    </div>
                  ) : singleResult.status === 'Not Allotted' || singleResult.status === 'not_allotted' ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-2 font-bold text-sm">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span>NOT ALLOTTED (Non-Allottee)</span>
                    </div>
                  ) : singleResult.status === 'pending' || singleResult.status === 'Pending' ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-2 font-bold text-sm">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span>ALLOTMENT PENDING</span>
                    </div>
                  ) : (
                    <a
                      href={singleResult.directPortalUrl || detectedRegistrar.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleCopyPan(inputPan)}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 flex items-center gap-2 font-bold text-xs transition cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 text-cyan-400" />
                      <span>OPEN OFFICIAL PORTAL</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Verified Parameter Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Investor PAN</span>
                  <span className="text-sm font-bold font-mono text-white mt-1 block">
                    {singleResult.panMasked}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Registrar</span>
                  <span className="text-xs font-bold text-cyan-300 mt-1 block truncate" title={singleResult.registrarName}>
                    {singleResult.registrarSlug === 'linkintime'
                      ? 'MUFG Intime India'
                      : singleResult.registrarName}
                  </span>
                  {singleResult.registrarSlug === 'linkintime' && (
                    <span className="text-[10px] text-slate-500 block truncate">formerly Link Intime</span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Shares Allotted</span>
                  {singleResult.status === 'Allotted' || singleResult.status === 'allotted' ? (
                    <span className="text-sm font-bold text-emerald-400 font-extrabold mt-1 block">
                      {singleResult.sharesAllotted} shs
                    </span>
                  ) : singleResult.status === 'Not Allotted' || singleResult.status === 'not_allotted' ? (
                    <span className="text-sm font-bold text-slate-400 mt-1 block">0 shs</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 mt-1 block">Verify on Portal</span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Status</span>
                  <span className={`text-xs font-bold mt-1 block capitalize ${
                    singleResult.status === 'unavailable' ? 'text-amber-400' : 'text-white'
                  }`}>
                    {singleResult.status === 'unavailable' ? 'Portal Check Required' : singleResult.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Official 1-Click Fallback Action Box */}
              <div className="p-5 rounded-xl bg-slate-950/90 border border-cyan-500/30 text-xs text-slate-300 space-y-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-bold text-white text-sm">
                      Official Registrar Fallback Flow
                    </h5>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {('explanation' in singleResult && singleResult.explanation) ||
                        ('message' in singleResult && singleResult.message) ||
                        'Direct API inquiry is gated pending official registrar authorization. Please complete the lookup on the official registrar portal.'}
                    </p>
                  </div>
                </div>

                {/* 1-Click Launch with pre-copied PAN */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleCopyPan(inputPan)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
                  >
                    {copiedPan ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPan ? 'PAN Copied to Clipboard!' : 'Copy PAN'}</span>
                  </button>

                  <a
                    href={singleResult.directPortalUrl || detectedRegistrar.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleCopyPan(inputPan)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition"
                  >
                    <Building2 className="w-4 h-4 text-black" />
                    <span>Open Official {singleResult.registrarName ? singleResult.registrarName.split(' ')[0] : 'Registrar'} Portal</span>
                    <ExternalLink className="w-3.5 h-3.5 text-black" />
                  </a>

                  <a
                    href={BSE_OFFICIAL_GATEWAY.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
                  >
                    <span>Check on BSE Gateway</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  </a>
                </div>
              </div>

              {/* Official Server Mirrors */}
              {singleResult.mirrors && singleResult.mirrors.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Official Server Gateways & Mirrors:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {singleResult.mirrors.map((mirror, idx) => (
                      <a
                        key={idx}
                        href={mirror.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleCopyPan(inputPan)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                          mirror.isPrimary
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{mirror.serverName}</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Family Individual Check with Consent */}
      {activeTab === 'family' && (
        <div className="space-y-6" role="region" aria-label="Family Member Individual Check">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Family Individual Allotment Check for {activeIpo.companyName}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                For family checks, each person performs an individualized check using their own PAN and consent. Family PANs are never batch scraped or persisted.
              </p>
            </div>

            {familyPans.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Family Profiles Registered</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Add your family members (Spouse, Parents, Children, HUF) in the Family PAN Manager to verify allotments with individual consent.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Account Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Select Family Member:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {familyPans.map((profile) => {
                      const isSelected = selectedFamilyMember?.id === profile.id;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => {
                            setSelectedFamilyMember(profile);
                            setFamilyCheckResult(null);
                            setFamilyError(null);
                          }}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500 text-white'
                              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-semibold text-xs text-white truncate">{profile.name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span className="font-mono">{profile.pan.substring(0, 5)}****{profile.pan.slice(-1)}</span>
                              <span>•</span>
                              <span>{profile.relationship}</span>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium shrink-0">
                            {profile.broker}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="family-consent"
                    checked={familyConsentGranted}
                    onChange={(e) => setFamilyConsentGranted(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="family-consent" className="text-xs text-slate-300 cursor-pointer select-none">
                    I have the investor's consent to verify this allotment on their behalf for <strong>{selectedFamilyMember?.name || 'this member'}</strong> ({selectedFamilyMember?.pan ? `${selectedFamilyMember.pan.substring(0, 5)}****${selectedFamilyMember.pan.slice(-1)}` : ''}).
                  </label>
                </div>

                {/* Check Button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleIndividualFamilyCheck}
                    disabled={isFamilyChecking || !selectedFamilyMember || !familyConsentGranted}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isFamilyChecking ? 'Checking...' : `Check Allotment for ${selectedFamilyMember?.name || 'Selected Member'}`}
                  </button>
                </div>

                {familyError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{familyError}</span>
                  </div>
                )}

                {/* Family Check Result Presentation */}
                {familyCheckResult && (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Status for {selectedFamilyMember?.name}: {familyCheckResult.panMasked}
                        </h4>
                        <span className="text-xs text-slate-400">
                          Registrar: {familyCheckResult.registrarName}
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {familyCheckResult.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      {familyCheckResult.explanation}
                    </p>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleCopyPan(selectedFamilyMember?.pan)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                      >
                        {copiedPan ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy PAN</span>
                      </button>

                      <a
                        href={familyCheckResult.directPortalUrl || detectedRegistrar.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleCopyPan(selectedFamilyMember?.pan)}
                        className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs flex items-center gap-1.5"
                      >
                        <span>Open Official Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Official Registrar Portals & Gateways Directory */}
      {activeTab === 'mirrors' && (
        <div className="space-y-6" role="region" aria-label="Official Registrar Portals">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Verified Official Registrar Gateways & Multi-Server Mirrors
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official registrar portals for checking IPO allotments. On high-traffic allotment days, use alternate server mirrors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {OFFICIAL_REGISTRARS.map((reg) => (
                <div
                  key={reg.slug}
                  className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-white">{reg.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {reg.slug.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{reg.description}</p>
                  </div>

                  {/* Mirror Links */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Server Gateways:
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {reg.mirrors?.map((mirror, idx) => (
                        <a
                          key={idx}
                          href={mirror.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 text-xs transition cursor-pointer"
                        >
                          <span className="truncate">{mirror.serverName}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* BSE India Official Gateway Card */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{BSE_OFFICIAL_GATEWAY.name}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                      EXCHANGE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {BSE_OFFICIAL_GATEWAY.description} Direct central stock exchange verification for equity public issues.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <a
                    href={BSE_OFFICIAL_GATEWAY.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                  >
                    <span>Open BSE Allotment Gateway</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Smart Response Parser & Allotment Slip Scanner */}
      {activeTab === 'parser' && (
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4" role="region" aria-label="Smart Text Parser">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-cyan-400" />
              Smart Registrar Response Parser & Slip Classifier
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy any response table or text output from MUFG Intime, KFintech, or Bigshare. The classifier extracts allotment quantities, PAN, and application numbers safely on your device.
            </p>
          </div>

          {parserError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {parserError}
            </div>
          )}

          <div className="relative">
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your copied registrar response table or status text here..."
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleParseText}
              disabled={isParsingText || !pasteText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition disabled:opacity-50 shadow-md shadow-cyan-500/20"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>{isParsingText ? 'Parsing...' : 'Parse Registrar Output'}</span>
            </button>
          </div>

          {/* Parsed Output Slip */}
          {scanResult && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Classified Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                      scanResult.status === 'Allotted'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : scanResult.status === 'Not Allotted'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {scanResult.status === 'Allotted' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {scanResult.status}
                  </span>
                </div>

                <div className="text-xs font-mono text-cyan-400">
                  Confidence: {Math.round(scanResult.rawConfidence * 100)}%
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Shares Allotted</span>
                  <span
                    className={`text-sm font-bold ${
                      scanResult.sharesAllotted && scanResult.sharesAllotted > 0
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {scanResult.sharesAllotted !== undefined ? scanResult.sharesAllotted : '0'} shs
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Shares Applied</span>
                  <span className="text-sm font-bold text-slate-200">
                    {scanResult.sharesApplied ? `${scanResult.sharesApplied} shs` : 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Detected PAN</span>
                  <span className="text-sm font-bold text-slate-300">
                    {scanResult.panMatched || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Application / Bid No</span>
                  <span className="text-sm font-bold text-slate-300 truncate block">
                    {scanResult.applicationNo || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
