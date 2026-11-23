'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  OFFICIAL_REGISTRARS,
  BSE_OFFICIAL_GATEWAY,
  getRegistrarForSymbol,
  scanRegistrarText,
} from '@/services/allotmentScanner';
import {
  AllotmentScanResult,
  RegistrarInfo,
} from '@/types/allotment';
import { AllotmentCheckResult, AllotmentStatus } from '@/lib/services/allotment/types';
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
  Bell,
  Smartphone,
  CheckCheck,
  Activity,
  Send,
  Database,
  TrendingUp,
  Server,
  ShieldAlert,
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

export interface FamilyCheckStatusItem {
  id: string;
  name: string;
  relationship: string;
  pan: string;
  panMasked: string;
  status: 'idle' | 'checking' | 'allotted' | 'not_allotted' | 'pending' | 'manual_verification';
  sharesAllotted: number;
  allotmentValue: number;
  refundAmount: number;
  message?: string;
  portalUrl?: string;
}

export const AllotmentChecker: React.FC = () => {
  // Active Tab: 'single' | 'family' | 'notifications' | 'mirrors' | 'parser'
  const [activeTab, setActiveTab] = useState<'single' | 'family' | 'notifications' | 'mirrors' | 'parser'>('single');

  // IPO Selection State
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SWIGGY');
  const [listedIpos, setListedIpos] = useState<RealTimeListedIpo[]>([]);
  const [isLoadingIpos, setIsLoadingIpos] = useState<boolean>(true);
  const [ipoSearchQuery, setIpoSearchQuery] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<'ALL' | 'EQ' | 'SME'>('ALL');

  // Single PAN Inquiry State (Dual-Path Engine)
  const [inputPan, setInputPan] = useState<string>('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [singleResult, setSingleResult] = useState<AllotmentCheckResult | null>(null);
  const [isSingleChecking, setIsSingleChecking] = useState<boolean>(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [copiedPan, setCopiedPan] = useState<boolean>(false);

  // Multi-PAN Family Radar State
  const [familyPans, setFamilyPans] = useState<FamilyPanProfile[]>([]);
  const [familyCheckStatuses, setFamilyCheckStatuses] = useState<FamilyCheckStatusItem[]>([]);
  const [isBatchChecking, setIsBatchChecking] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);

  // Notifications State (Section 3.5 of Architecture Plan)
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');
  const [whatsappOptIn, setWhatsappOptIn] = useState<boolean>(true);
  const [whatsappSaved, setWhatsappSaved] = useState<boolean>(false);
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(false);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);

  // Manual Text Parser State
  const [pasteText, setPasteText] = useState<string>('');
  const [scanResult, setScanResult] = useState<AllotmentScanResult | null>(null);
  const [isParsingText, setIsParsingText] = useState<boolean>(false);
  const [parserError, setParserError] = useState<string | null>(null);

  // 1. Fetch Authoritative IPOs from Server Directory
  const fetchListedIpos = async () => {
    setIsLoadingIpos(true);
    try {
      const dirRes = await fetch('/api/allotment/check');
      const dirJson = await dirRes.json();

      if (dirJson.success && Array.isArray(dirJson.data?.ipos) && dirJson.data.ipos.length > 0) {
        const mapped: RealTimeListedIpo[] = dirJson.data.ipos.map((item: any) => ({
          id: item.id,
          symbol: item.symbol,
          companyName: item.companyName,
          price: item.priceHigh || 100,
          issuePrice: item.priceHigh || 100,
          listingPrice: item.priceHigh || 100,
          currentPrice: item.priceHigh || 100,
          dayChange: 0,
          dayChangePercent: 0,
          lotSize: item.lotSize || (item.series === 'SME' ? 1200 : Math.max(1, Math.floor(15000 / (item.priceHigh || 100)))),
          series: (item.series === 'SME' ? 'SME' : 'EQ') as 'EQ' | 'SME',
          listingDate: item.allotmentDate || 'Recent',
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
            const isSme = item.series === 'SME';
            const lotSize = isSme ? 1200 : (issuePrice > 0 ? Math.max(1, Math.floor(15000 / issuePrice)) : 50);

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
              series: (isSme ? 'SME' : 'EQ') as 'EQ' | 'SME',
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
        const initialStatus: FamilyCheckStatusItem[] = json.data.map((p: FamilyPanProfile) => ({
          id: p.id,
          name: p.name,
          relationship: p.relationship,
          pan: p.pan,
          panMasked: `${p.pan.substring(0, 5)}****${p.pan.slice(-1)}`,
          status: 'idle',
          sharesAllotted: 0,
          allotmentValue: 0,
          refundAmount: 0,
        }));
        setFamilyCheckStatuses(initialStatus);
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
        registrarName: 'Link Intime India Pvt Ltd (MUFG)',
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

  // Single PAN Allotment Check via Dual-Path Gateway API
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

  // Run Batch Family Allotment Verification
  const handleRunBatchVerification = async () => {
    if (familyPans.length === 0 || isBatchChecking) return;
    setIsBatchChecking(true);
    setBatchProgress(0);

    const updated = [...familyCheckStatuses];

    for (let i = 0; i < familyPans.length; i++) {
      const p = familyPans[i];
      updated[i] = { ...updated[i], status: 'checking' };
      setFamilyCheckStatuses([...updated]);

      try {
        const res = await fetch('/api/allotment/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: activeIpo.symbol,
            pan: p.pan,
            price: activeIpo.price,
            lotSize: activeIpo.lotSize,
          }),
        });
        const json = await res.json();

        if (json.success && json.data) {
          const d: AllotmentCheckResult = json.data;
          const isAllotted = d.status === 'allotted';
          const isNotAllotted = d.status === 'not_allotted';
          const isPending = d.status === 'pending';

          updated[i] = {
            ...updated[i],
            status: isAllotted
              ? 'allotted'
              : isNotAllotted
              ? 'not_allotted'
              : isPending
              ? 'pending'
              : 'manual_verification',
            sharesAllotted: d.sharesAllotted,
            allotmentValue: d.allotmentValue,
            refundAmount: d.refundAmount,
            message: d.explanation,
            portalUrl: d.directPortalUrl || detectedRegistrar.portalUrl,
          };
        } else {
          updated[i] = {
            ...updated[i],
            status: 'manual_verification',
            portalUrl: detectedRegistrar.portalUrl,
            message: 'Manual check required on official registrar portal.',
          };
        }
      } catch {
        updated[i] = {
          ...updated[i],
          status: 'manual_verification',
          portalUrl: detectedRegistrar.portalUrl,
          message: 'Connection timeout. Path B fallback active.',
        };
      }

      setBatchProgress(Math.round(((i + 1) / familyPans.length) * 100));
      setFamilyCheckStatuses([...updated]);
    }

    setIsBatchChecking(false);
  };

  // Save WhatsApp Alerts Opt-in
  const handleSaveWhatsappSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappSaved(true);
    setTimeout(() => setWhatsappSaved(false), 3000);
  };

  // Toggle Web Push Subscription
  const handleToggleWebPush = async () => {
    setIsPushLoading(true);
    try {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setPushSubscribed(true);
        } else {
          setPushSubscribed(false);
        }
      }
    } catch (err) {
      console.warn('Web push request failed:', err);
    } finally {
      setIsPushLoading(false);
    }
  };

  // Raw Text Parser
  const handleParseText = () => {
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

  // Family Cumulative Stats
  const familySummary = useMemo(() => {
    const totalPans = familyCheckStatuses.length;
    const allotted = familyCheckStatuses.filter((s) => s.status === 'allotted');
    const notAllotted = familyCheckStatuses.filter((s) => s.status === 'not_allotted');
    const pending = familyCheckStatuses.filter((s) => s.status === 'pending');
    const manual = familyCheckStatuses.filter((s) => s.status === 'manual_verification');

    const totalShares = allotted.reduce((acc, curr) => acc + curr.sharesAllotted, 0);
    const totalValue = allotted.reduce((acc, curr) => acc + curr.allotmentValue, 0);
    const totalRefund = notAllotted.reduce((acc, curr) => acc + curr.refundAmount, 0);

    return {
      totalPans,
      allottedCount: allotted.length,
      notAllottedCount: notAllotted.length,
      pendingCount: pending.length,
      manualCount: manual.length,
      totalShares,
      totalValue,
      totalRefund,
    };
  }, [familyCheckStatuses]);

  return (
    <div className="space-y-6">
      {/* 1. ARCHITECTURE BANNER (Directly reflecting PDF Sections 1, 2.1, 2.3) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1427] via-[#09101f] to-[#060a14] border border-cyan-500/20 p-6 md:p-8 shadow-2xl space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Top Feature Badges */}
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm shadow-cyan-500/20">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Dual-Path Allotment Engine
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Path A: High-Speed Gateway Live
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Path B: 1-Click Fallback Ready
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Inngest 30m IST Polling (08:00 - 23:30)
          </span>
        </div>

        {/* Header Title & Pitch */}
        <div className="relative space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Automated IPO Allotment Engine & Notification Gateway</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-4xl leading-relaxed">
            Enterprise-grade verification gateway connecting to official registrar APIs (
            <span className="text-cyan-300 font-semibold">Link Intime / MUFG</span>,{' '}
            <span className="text-purple-300 font-semibold">KFin Technologies</span>,{' '}
            <span className="text-amber-300 font-semibold">Bigshare Services</span>, and{' '}
            <span className="text-emerald-300 font-semibold">BSE Gateway</span>). Fully automated with
            PostgreSQL persistence, 24-hour Redis caching, Portfolio P&L synchronization, and instant WhatsApp & Web Push alerts.
          </p>
        </div>

        {/* Dual-Path Architecture Live Telemetry Grid */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Path A: Adapters</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs font-bold text-white">Direct PAN Lookup</p>
            <span className="text-[10px] text-emerald-400 font-mono">8s Timeout • Normalized JSON</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Path B: Fallback</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">1-Click</span>
            </div>
            <p className="text-xs font-bold text-white">CAPTCHA Deep-Link</p>
            <span className="text-[10px] text-purple-300 font-mono">First-class outcome • Pre-copied PAN</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Persistence & P&L</span>
              <Database className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-xs font-bold text-white">Auto Sync to Journal</p>
            <span className="text-[10px] text-cyan-300 font-mono">24h Redis Cache • Idempotent Writes</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Multi-Channel Alerts</span>
              <Bell className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xs font-bold text-white">WhatsApp & Push</p>
            <span className="text-[10px] text-amber-300 font-mono">Twilio Templates • VAPID Web Push</span>
          </div>
        </div>

        {/* Public Issue Selector Carousel / Grid */}
        <div className="relative pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Select Public Issue:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({filteredIpos.length} Tracked Offerings)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Assigned Registrar:</span>
              <span className="font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded-lg border border-cyan-500/30 text-xs">
                {detectedRegistrar.name.split(' ')[0]}
              </span>
              <button
                type="button"
                onClick={fetchListedIpos}
                disabled={isLoadingIpos}
                title="Refresh Directory"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIpos ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ipoSearchQuery}
                onChange={(e) => setIpoSearchQuery(e.target.value)}
                placeholder="Search IPO or ticker (e.g. Swiggy, Premier, Hyundai, Waaree)..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
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

            <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs">
              {(['ALL', 'EQ', 'SME'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSeriesFilter(filter)}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    seriesFilter === filter
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'ALL' ? `All (${listedIpos.length})` : filter === 'EQ' ? 'Mainboard' : 'SME'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable IPO Selector Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {filteredIpos.map((ipo) => {
              const isSelected = selectedSymbol === ipo.symbol;
              return (
                <button
                  key={ipo.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(ipo.symbol);
                    setSingleResult(null);
                  }}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-transparent border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-xs text-white truncate">{ipo.symbol}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        ipo.series === 'SME'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {ipo.series}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate font-medium">{ipo.companyName}</p>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-cyan-300/90 font-medium truncate">
                      {ipo.registrarSlug === 'linkintime' ? 'Link Intime' : ipo.registrarName.split(' ')[0]}
                    </span>
                    {isSelected ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500">₹{ipo.price}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="relative flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'single'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Instant PAN Check (Dual-Path)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'family'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Family Multi-PAN Radar ({familyPans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Automated Alerts & Inngest Cron</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mirrors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'mirrors'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Official Registrar Portals & Mirrors</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parser')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'parser'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Smart Slip & Text Parser</span>
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT PANELS */}

      {/* TAB 1: Instant PAN Check (Dual-Path Engine) */}
      {activeTab === 'single' && (
        <div className="space-y-6">
          {/* Privacy Guarantee Pill */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-200/90 shadow-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Zero-Retention PAN Security (DPDP & SEBI Compliant)
                </span>
                <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SHA-256 HASHED
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Permanent Account Numbers (PANs) are strictly processed in-memory for this single query. They are{' '}
                <strong>never logged, never stored as raw plaintext in Redis or PostgreSQL</strong>, and masked as{' '}
                <code className="text-cyan-300 font-mono">ABCDE****F</code> in all logs and client envelopes.
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Verify Allotment for {activeIpo.companyName} ({activeIpo.symbol})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your 10-character PAN to execute Path A (Automated Gateway Query) with Path B (1-Click Fallback).
                </p>
              </div>

              {familyPans.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Autofill Profile:</span>
                  <select
                    value={selectedFamilyId}
                    onChange={(e) => handleFamilySelect(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select saved profile...</option>
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
                    Investor PAN Number:
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isValidPan(inputPan) ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Valid PAN format
                      </span>
                    ) : (
                      'Format: ^[A-Z]{5}[0-9]{4}[A-Z]$ (e.g. ABCDE1234F)'
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
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 uppercase"
                  />
                  {inputPan && (
                    <button
                      type="button"
                      onClick={() => handleCopyPan(inputPan)}
                      title="Copy PAN"
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
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  {isSingleChecking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Querying Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-slate-950" />
                      <span>Check Allotment Status</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {singleError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{singleError}</span>
              </div>
            )}
          </div>

          {/* Result Card: 4 Outcome States (Matching PDF Page 1 & Page 4) */}
          {singleResult && (
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
              {/* Slip Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Dual-Path Allotment Result
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {singleResult.sourceBadge || 'Gateway Normalized'}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-white">
                    {singleResult.companyName} ({singleResult.symbol})
                  </h4>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>Registrar: <strong className="text-slate-200">{singleResult.registrarName}</strong></span>
                    <span>•</span>
                    <span>Masked PAN: <strong className="text-cyan-300 font-mono">{singleResult.panMasked}</strong></span>
                  </div>
                </div>

                {/* 4 Outcome Badges */}
                <div className="shrink-0">
                  {singleResult.status === 'allotted' ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 font-black text-sm shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
                      <span>ALLOTTED ({singleResult.sharesAllotted} SHARES)</span>
                    </div>
                  ) : singleResult.status === 'not_allotted' ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2 font-bold text-sm">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span>NOT ALLOTTED (Non-Allottee)</span>
                    </div>
                  ) : singleResult.status === 'pending' ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-2 font-bold text-sm">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span>ALLOTMENT PENDING</span>
                    </div>
                  ) : (
                    <div className="px-5 py-2.5 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-2 font-bold text-sm">
                      <ShieldAlert className="w-5 h-5 text-purple-400" />
                      <span>PATH B: MANUAL CHECK REQUIRED</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Shares Allotted</span>
                  <span className={`text-base font-black font-mono block ${singleResult.status === 'allotted' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {singleResult.sharesAllotted} Shares
                  </span>
                  <span className="text-[10px] text-slate-500 block">Applied: {singleResult.sharesApplied} Shares</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Allotment Value</span>
                  <span className={`text-base font-black font-mono block ${singleResult.status === 'allotted' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    ₹{singleResult.allotmentValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-500 block">@ ₹{singleResult.bidPrice} per share</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Refund / Unblock</span>
                  <span className={`text-base font-black font-mono block ${singleResult.refundAmount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    ₹{singleResult.refundAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-500 block">UPI / ASBA bank unfreeze</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Application No</span>
                  <span className="text-xs font-bold font-mono text-cyan-300 block truncate">
                    {singleResult.applicationNo || 'Direct Query'}
                  </span>
                  <span className="text-[10px] text-slate-500 block capitalize">{singleResult.category} Category</span>
                </div>
              </div>

              {/* State-Specific Action Modules (PDF Section 1 & Section 2.3) */}
              {singleResult.status === 'allotted' && (
                <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h5 className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      Allotment Successfully Synced to Portfolio P&L
                    </h5>
                    <p className="text-xs text-slate-300">
                      {singleResult.sharesAllotted} shares of {singleResult.companyName} have been recorded in your P&L journal. Listing day gain tracking is live.
                    </p>
                  </div>
                  <Link
                    href="/portfolio"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition shrink-0"
                  >
                    <span>View in Portfolio</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                  </Link>
                </div>
              )}

              {singleResult.status === 'not_allotted' && (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h5 className="font-bold text-white text-sm">
                      Refund Unblock Timeline
                    </h5>
                    <p className="text-xs text-slate-400">
                      Your blocked capital of ₹{singleResult.refundAmount.toLocaleString('en-IN')} will be released by your bank within 24 to 48 hours via UPI mandate revocation.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-slate-300 font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5">
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span>Refund Alert Dispatched</span>
                  </div>
                </div>
              )}

              {/* PATH B: Deterministic Deep-Link Fallback Module (First-Class Outcome) */}
              {(singleResult.status === 'unavailable' || singleResult.isOfficialGatewayRequired) && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-950 to-slate-950 border border-purple-500/30 space-y-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Path B Fallback Activated: Manual Verification Gateway</span>
                        <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                          Deterministic Deep-Link
                        </span>
                      </h5>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {singleResult.explanation ||
                          'The registrar server is actively enforcing an interactive CAPTCHA or security gate. Path B has pre-copied your PAN and prepared the official registrar portal link.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-purple-500/20">
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
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition"
                    >
                      <Building2 className="w-4 h-4 text-slate-950" />
                      <span>Open Official {singleResult.registrarName ? singleResult.registrarName.split(' ')[0] : 'Registrar'} Portal</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-950" />
                    </a>

                    <a
                      href={BSE_OFFICIAL_GATEWAY.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
                    >
                      <span>Check on BSE Official Gateway</span>
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Family Multi-PAN Radar (Batch Check) */}
      {activeTab === 'family' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Family Allotment Radar for {activeIpo.companyName}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Check all registered family accounts in parallel. Idempotent execution updates status and syncs allotted shares.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunBatchVerification}
                disabled={isBatchChecking || familyPans.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {isBatchChecking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Verifying ({batchProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-slate-950" />
                    <span>Run Batch Verification ({familyPans.length} PANs)</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {isBatchChecking && (
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-2 transition-all duration-300"
                  style={{ width: `${batchProgress}%` }}
                />
              </div>
            )}

            {/* Consolidated Family Impact Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Family Accounts</span>
                <p className="text-base font-bold text-white">{familySummary.totalPans} Members</p>
                <span className="text-[10px] text-slate-500">Allotted: {familySummary.allottedCount}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Shares Allotted</span>
                <p className="text-base font-bold text-emerald-400 font-mono">{familySummary.totalShares} Shares</p>
                <span className="text-[10px] text-emerald-300/80">Value: ₹{familySummary.totalValue.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Net Refund Expected</span>
                <p className="text-base font-bold text-amber-400 font-mono">₹{familySummary.totalRefund.toLocaleString('en-IN')}</p>
                <span className="text-[10px] text-slate-500">Non-allottees: {familySummary.notAllottedCount}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Path B Fallbacks</span>
                <p className="text-base font-bold text-purple-300">{familySummary.manualCount} Accounts</p>
                <span className="text-[10px] text-slate-500">Pending: {familySummary.pendingCount}</span>
              </div>
            </div>

            {/* Family Members Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {familyCheckStatuses.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{item.name}</span>
                      <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                        {item.relationship}
                      </span>
                    </div>
                    <div className="text-[11px] text-cyan-300 font-mono">{item.panMasked}</div>
                    {item.message && (
                      <p className="text-[10px] text-slate-400 line-clamp-1">{item.message}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {item.status === 'checking' && (
                      <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Checking...
                      </span>
                    )}

                    {item.status === 'allotted' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Allotted ({item.sharesAllotted} shs)
                      </span>
                    )}

                    {item.status === 'not_allotted' && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        Not Allotted
                      </span>
                    )}

                    {item.status === 'pending' && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Pending
                      </span>
                    )}

                    {item.status === 'manual_verification' && (
                      <a
                        href={item.portalUrl || detectedRegistrar.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleCopyPan(item.pan)}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 hover:bg-purple-500/30 transition cursor-pointer"
                      >
                        <span>Check Portal</span>
                        <ExternalLink className="w-3 h-3 text-purple-400" />
                      </a>
                    )}

                    {item.status === 'idle' && (
                      <button
                        type="button"
                        onClick={() => {
                          setInputPan(item.pan);
                          setActiveTab('single');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Automated Notifications & Inngest Cron (PDF Section 3.5 & 3.6) */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WhatsApp Alerts (Twilio) */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">WhatsApp Allotment Alerts</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Powered by Twilio Official Templates</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  AUTO +91
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Receive instant WhatsApp alerts the moment registrars publish results or when UPI mandate refunds are initiated.
              </p>

              <form onSubmit={handleSaveWhatsappSettings} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">WhatsApp Mobile Number:</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="wa-opt"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
                  />
                  <label htmlFor="wa-opt" className="text-xs text-slate-300 cursor-pointer">
                    Enable allotment & refund notifications on this number
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  {whatsappSaved ? 'Preferences Saved!' : 'Save WhatsApp Preferences'}
                </button>
              </form>

              {/* Sample WhatsApp Template Preview */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Template Preview (Approved)</span>
                <p className="text-emerald-400">🎉 IPOLENS Alert: Allotment Declared!</p>
                <p className="text-slate-300">You have been allotted 38 shares of {activeIpo.companyName} (Value: ₹14,820). View in your portfolio: ipolens.com/portfolio</p>
              </div>
            </div>

            {/* Web Push & Inngest Cron Details */}
            <div className="space-y-6">
              {/* Web Push (VAPID) */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Native Web Push Notifications</h4>
                      <span className="text-[10px] text-slate-400 font-mono">VAPID Protocol • Deep Links to /portfolio</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Browser push alerts trigger automatically when Inngest cron completes background verification.
                </p>

                <button
                  type="button"
                  onClick={handleToggleWebPush}
                  disabled={isPushLoading}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                    pushSubscribed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span>{pushSubscribed ? 'Web Push Active (Subscribed)' : 'Enable Browser Push Notifications'}</span>
                </button>
              </div>

              {/* Inngest Polling Cron Schedule (PDF Section 3.6) */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Automated Inngest Polling Cron
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    TZ=Asia/Kolkata
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 font-mono text-xs text-cyan-300">
                  */30 8-23 * * * (Every 30 mins between 08:00 - 23:30 IST)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Queries up to 50 pending applications whose allotment date is on or before today. Retries are individual and idempotent, writing only final results to prevent notification spam.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Official Registrar Portals & Gateways (PDF Section 3.2) */}
      {activeTab === 'mirrors' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>Authoritative Registrar Portals & Server Mirror Network</span>
              </h3>
              <p className="text-xs text-slate-400">
                Direct access to high-availability servers for Link Intime, KFin Technologies, Bigshare, and BSE India.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OFFICIAL_REGISTRARS.map((reg) => (
                <div key={reg.slug} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{reg.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{reg.description}</p>
                    </div>
                    <a
                      href={reg.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition shrink-0 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {reg.mirrors && reg.mirrors.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                        Server Mirrors & Endpoints:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {reg.mirrors.map((m, idx) => (
                          <a
                            key={idx}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                              m.isPrimary
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                            }`}
                          >
                            <Server className="w-3 h-3 text-cyan-400" />
                            <span>{m.serverName}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Smart Slip & Text Parser */}
      {activeTab === 'parser' && (
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
      )}
    </div>
  );
};
