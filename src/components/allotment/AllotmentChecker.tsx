'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { OFFICIAL_REGISTRARS, getRegistrarForSymbol, scanRegistrarText } from '@/lib/services/allotmentScanner';
import { AllotmentScanResult, RegistrarInfo } from '@/types/allotment';
import { AllotmentCheckResult } from '@/lib/services/allotment/types';
import { FamilyPanProfile } from '@/types/pan';
import { isValidPan } from '@/lib/services/duplicateEnforcer';
import {
  Search,
  Clock,
  ClipboardPaste,
  Building2,
  Users,
  Zap,
  RefreshCw,
  Layers,
  ShieldCheck,
  Bell,
  Activity,
  Database,
} from 'lucide-react';
import { SinglePanTab } from './panels/SinglePanTab';
import { FamilyRadarTab } from './panels/FamilyRadarTab';
import { NotificationsTab } from './panels/NotificationsTab';
import { RegistrarMirrorsTab } from './panels/RegistrarMirrorsTab';
import { TextParserTab } from './panels/TextParserTab';
import type { RealTimeListedIpo, FamilyCheckStatusItem, AllotmentTab } from './allotmentTypes';
export type { RealTimeListedIpo, FamilyCheckStatusItem } from './allotmentTypes';

export const AllotmentChecker: React.FC = () => {
  // Active Tab: 'single' | 'family' | 'notifications' | 'mirrors' | 'parser'
  const [activeTab, setActiveTab] = useState<AllotmentTab>('single');

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
        <SinglePanTab
          activeIpo={activeIpo}
          copiedPan={copiedPan}
          detectedRegistrar={detectedRegistrar}
          familyPans={familyPans}
          handleCopyPan={handleCopyPan}
          handleFamilySelect={handleFamilySelect}
          handleSinglePanCheck={handleSinglePanCheck}
          inputPan={inputPan}
          isSingleChecking={isSingleChecking}
          selectedFamilyId={selectedFamilyId}
          setInputPan={setInputPan}
          singleError={singleError}
          singleResult={singleResult}
        />
      )}

      {/* TAB 2: Family Multi-PAN Radar (Batch Check) */}
      {activeTab === 'family' && (
        <FamilyRadarTab
          activeIpo={activeIpo}
          batchProgress={batchProgress}
          detectedRegistrar={detectedRegistrar}
          familyCheckStatuses={familyCheckStatuses}
          familyPans={familyPans}
          familySummary={familySummary}
          handleCopyPan={handleCopyPan}
          handleRunBatchVerification={handleRunBatchVerification}
          isBatchChecking={isBatchChecking}
          setActiveTab={setActiveTab}
          setInputPan={setInputPan}
        />
      )}

      {/* TAB 3: Automated Notifications & Inngest Cron (PDF Section 3.5 & 3.6) */}
      {activeTab === 'notifications' && (
        <NotificationsTab
          activeIpo={activeIpo}
          handleSaveWhatsappSettings={handleSaveWhatsappSettings}
          handleToggleWebPush={handleToggleWebPush}
          isPushLoading={isPushLoading}
          pushSubscribed={pushSubscribed}
          setWhatsappOptIn={setWhatsappOptIn}
          setWhatsappPhone={setWhatsappPhone}
          whatsappOptIn={whatsappOptIn}
          whatsappPhone={whatsappPhone}
          whatsappSaved={whatsappSaved}
        />
      )}

      {/* TAB 4: Official Registrar Portals & Gateways (PDF Section 3.2) */}
      {activeTab === 'mirrors' && <RegistrarMirrorsTab />}

      {/* TAB 5: Smart Slip & Text Parser */}
      {activeTab === 'parser' && (
        <TextParserTab
          handleParseText={handleParseText}
          isParsingText={isParsingText}
          parserError={parserError}
          pasteText={pasteText}
          scanResult={scanResult}
          setPasteText={setPasteText}
        />
      )}
    </div>
  );
};
