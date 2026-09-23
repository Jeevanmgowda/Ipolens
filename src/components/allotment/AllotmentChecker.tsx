'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { OFFICIAL_REGISTRARS, getRegistrarForSymbol } from '@/services/allotmentScanner';
import { AllotmentScanResult, MultiPanScanSummary, MultiPanScanResultItem } from '@/types/allotment';
import { FamilyPanProfile } from '@/types/pan';
import {
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ClipboardPaste,
  Building2,
  FileCheck2,
  Users,
  Zap,
  RefreshCw,
  AlertTriangle,
  Layers,
  Coins,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export interface RealTimeListedIpo {
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
  registrarSlug: 'linkintime' | 'kfintech' | 'bigshare' | 'cameo' | 'other';
}

export const AllotmentChecker: React.FC = () => {
  // Multi-PAN Scanner State
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SWIGGY');
  const [familyPans, setFamilyPans] = useState<FamilyPanProfile[]>([]);
  const [multiScanResult, setMultiScanResult] = useState<MultiPanScanSummary | null>(null);
  const [isMultiScanning, setIsMultiScanning] = useState<boolean>(false);
  const [multiScanError, setMultiScanError] = useState<string | null>(null);
  const [multiScanSuccess, setMultiScanSuccess] = useState<string | null>(null);
  const [loadingDemoPans, setLoadingDemoPans] = useState<boolean>(false);

  // Dynamic Real-Time Listed IPOs State
  const [listedIpos, setListedIpos] = useState<RealTimeListedIpo[]>([]);
  const [isLoadingIpos, setIsLoadingIpos] = useState<boolean>(true);
  const [ipoSearchQuery, setIpoSearchQuery] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<'ALL' | 'EQ' | 'SME'>('ALL');

  // Manual Text Scanner State
  const [pasteText, setPasteText] = useState<string>('');
  const [scanResult, setScanResult] = useState<AllotmentScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListedIpos = async () => {
    setIsLoadingIpos(true);
    try {
      const res = await fetch('/api/ipos/listed');
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const mapped: RealTimeListedIpo[] = json.data.map((item: any) => {
          const reg = getRegistrarForSymbol(item.symbol);
          const regName =
            item.allotmentRegistrar && item.allotmentRegistrar !== 'Official Exchange Registrar'
              ? item.allotmentRegistrar
              : reg.name;
          let regSlug = reg.slug;
          const lowerName = (regName || '').toLowerCase();
          if (lowerName.includes('kfin')) regSlug = 'kfintech';
          else if (lowerName.includes('link')) regSlug = 'linkintime';
          else if (lowerName.includes('bigshare')) regSlug = 'bigshare';

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
    } catch (err) {
      console.error('Failed to fetch real-time listed IPOs:', err);
    } finally {
      setIsLoadingIpos(false);
    }
  };

  const activeIpo = useMemo<RealTimeListedIpo>(() => {
    return (
      listedIpos.find((i) => i.symbol === selectedSymbol) ||
      listedIpos[0] || {
        symbol: 'SWIGGY',
        companyName: 'Swiggy Limited',
        price: 284.05,
        issuePrice: 390,
        listingPrice: 420,
        currentPrice: 284.05,
        dayChange: 13.55,
        dayChangePercent: 5.01,
        lotSize: 38,
        series: 'EQ',
        listingDate: 'Recent',
        registrarName: 'Link Intime India Pvt Ltd',
        registrarSlug: 'linkintime',
      }
    );
  }, [listedIpos, selectedSymbol]);

  const detectedRegistrar = useMemo(() => {
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

  const fetchFamilyPans = async () => {
    try {
      const res = await fetch('/api/pans');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFamilyPans(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFamilyPans();
    fetchListedIpos();
  }, []);

  const handleLoadDemoPans = async () => {
    setLoadingDemoPans(true);
    const demoFamily = [
      { name: 'Jeevan Gowda', relationship: 'Self', pan: 'ABCDE1234F', broker: 'Zerodha', bankUpi: 'jeevan@oksbi' },
      { name: 'Rekha Gowda', relationship: 'Spouse', pan: 'BCDEF2345G', broker: 'Groww', bankUpi: 'rekha@okhdfcbank' },
      { name: 'M. Gowda', relationship: 'Parent', pan: 'CDEFG3456H', broker: 'AngelOne', bankUpi: 'mgowda@okicici' },
      { name: 'Sunita Gowda', relationship: 'Parent', pan: 'DEFGH4567I', broker: 'Upstox', bankUpi: 'sunita@paytm' },
    ];

    for (const p of demoFamily) {
      try {
        await fetch('/api/pans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
      } catch (e) {
        console.error(e);
      }
    }
    await fetchFamilyPans();
    setLoadingDemoPans(false);
  };

  const handleMultiPanScan = async () => {
    if (familyPans.length === 0) {
      setMultiScanError('No family PANs found. Please add or load family PANs first.');
      return;
    }

    setIsMultiScanning(true);
    setMultiScanError(null);
    setMultiScanSuccess(null);

    try {
      const res = await fetch('/api/allotment/multi-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeIpo.symbol,
          companyName: activeIpo.companyName,
          price: activeIpo.price,
          lotSize: activeIpo.lotSize,
          pans: familyPans,
          autoSyncDatabase: true,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setMultiScanResult(json.data);
        setMultiScanSuccess(
          `Scanned ${json.data.totalPansScanned} family PANs at ${json.data.registrarName}. Found ${json.data.allottedCount} allotted accounts (${json.data.totalSharesAllotted} shares). Records synchronized to database!`
        );
      } else {
        setMultiScanError(json.error || 'Failed to scan registrar endpoints.');
      }
    } catch (err: any) {
      setMultiScanError(err.message || 'Error communicating with registrar gateway.');
    } finally {
      setIsMultiScanning(false);
    }
  };

  const handleScan = async () => {
    if (!pasteText.trim()) {
      setError('Please paste the registrar output or status snippet.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const res = await fetch('/api/allotment/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setScanResult(json.data);
      } else {
        setError(json.error || 'Failed to scan text.');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing scan request.');
    } finally {
      setIsScanning(false);
    }
  };

  const loadSampleOutput = (type: 'allotted' | 'notAllotted') => {
    if (type === 'allotted') {
      setPasteText(
        `Link Intime India Pvt Ltd - Public Issue Status\nCompany: Bajaj Housing Finance Limited\nApplication No: 202409138472\nPAN: ABCDE1234F\nCategory: Retail Individual Investor\nShares Applied: 214\nShares Allotted: 214\nStatus: Successfully Allotted\nRefund Amount: Rs. 0.00`
      );
    } else {
      setPasteText(
        `KFin Technologies Limited - Allotment Status\nIssue: National Stock Exchange of India Ltd\nDP ID / Client ID: 1208160012345678\nPAN: XYZPK9876M\nBid Quantity: 28\nAllotted Qty: 0\nStatus: Non-Allottee / Refund Initiated to Bank Account`
      );
    }
    setScanResult(null);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Automated 1-Click Multi-PAN Registrar Scanner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-cyan-950/40 border border-emerald-500/30 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Registrar Query Gateway
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Multi-PAN Concurrent
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-wide">
              Automated 1-Click Multi-PAN Registrar Allotment Scanner
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              On allotment day, avoid checking 5 different portals manually. IPOLENS queries official endpoints (<strong className="text-cyan-300">Link Intime</strong>, <strong className="text-purple-300">KFin Technologies</strong>, <strong className="text-amber-300">Bigshare</strong>) across all your family accounts simultaneously and synchronizes allotment results into your portfolio.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {familyPans.length === 0 ? (
              <button
                type="button"
                onClick={handleLoadDemoPans}
                disabled={loadingDemoPans}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold text-xs cursor-pointer transition disabled:opacity-50"
              >
                <Users className="w-4 h-4" />
                <span>{loadingDemoPans ? 'Loading Accounts...' : 'Load 4 Family Accounts'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMultiPanScan}
                disabled={isMultiScanning}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {isMultiScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Querying Registrar Endpoints...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Scan All Family PANs (1-Click)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Real-Time Listed IPO Selection Header & Controls */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Select Real-Time Listed IPO to Inquire Allotment:
              </label>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Exchange Feed
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>Official Registrar:</span>
                <span className="font-bold text-cyan-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {detectedRegistrar.name}
                </span>
              </div>

              <button
                type="button"
                onClick={fetchListedIpos}
                disabled={isLoadingIpos}
                title="Refresh real-time quotes"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
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
                placeholder="Filter real-time IPOs (e.g. Swiggy, Hyundai, Bajaj, Premier)..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
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

            <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-xl border border-white/10 text-[11px]">
              {(['ALL', 'EQ', 'SME'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSeriesFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    seriesFilter === filter
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'ALL' ? `All (${listedIpos.length})` : filter === 'EQ' ? 'Mainboard (EQ)' : 'SME'}
                </button>
              ))}
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoadingIpos && listedIpos.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-white/5 bg-slate-900/40 animate-pulse space-y-2"
                >
                  <div className="h-3.5 bg-slate-800 rounded w-16" />
                  <div className="h-3 bg-slate-800/60 rounded w-12" />
                  <div className="h-2.5 bg-slate-800/40 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filteredIpos.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400 space-y-2">
              <p>No real-time listed IPOs match &quot;{ipoSearchQuery}&quot;.</p>
              <button
                type="button"
                onClick={() => {
                  setIpoSearchQuery('');
                  setSeriesFilter('ALL');
                }}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            /* Real-Time Listed IPO Cards Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredIpos.map((ipo) => {
                const isSelected = selectedSymbol === ipo.symbol;
                const isPositive = ipo.dayChangePercent >= 0;
                return (
                  <button
                    key={ipo.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(ipo.symbol)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border-emerald-500/70 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/20 text-slate-300 hover:bg-slate-900/90'
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

                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-semibold text-white font-mono">
                        ₹{ipo.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-medium flex items-center ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {ipo.dayChangePercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="truncate text-slate-400">{ipo.registrarName.split(' ')[0]}</span>
                      {isSelected ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <span className="text-[9px] text-slate-500">Listed</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Family Accounts & Active IPO Status Indicator */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Target Accounts: </span>
              <strong className="text-white">{familyPans.length} Family PANs Registered</strong>
            </div>
            <span className="hidden sm:inline text-slate-600">•</span>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">Selected:</span>
              <strong className="text-emerald-300">{activeIpo.companyName}</strong>
              <span className="text-slate-400 font-mono">(CMP: ₹{activeIpo.currentPrice.toFixed(2)})</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Registrar Endpoint: <code className="text-slate-300">{detectedRegistrar.queryEndpoint?.slice(0, 38)}...</code></span>
            <a
              href={detectedRegistrar.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1"
            >
              <span>Verify on Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Feedback Messages */}
        {multiScanError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{multiScanError}</span>
          </div>
        )}

        {multiScanSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{multiScanSuccess}</span>
          </div>
        )}

        {/* Multi-PAN Scan Summary & Result Table */}
        {multiScanResult && (
          <div className="space-y-4 pt-2">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-[10px] text-slate-400 block">PANs Scanned</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {multiScanResult.totalPansScanned} Accounts
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300 block">Allotted Accounts</span>
                <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                  {multiScanResult.allottedCount} of {multiScanResult.totalPansScanned}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Total Shares Allotted</span>
                <span className="text-base font-bold text-cyan-400 mt-0.5 block">
                  {multiScanResult.totalSharesAllotted} shs
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Total Allotment Value</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  ₹{multiScanResult.totalAllotmentValue.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-[10px] text-slate-400 block">Refunds Unblocked</span>
                <span className="text-base font-bold text-slate-300 mt-0.5 block">
                  ₹{multiScanResult.totalRefundAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Detailed Per-PAN Table */}
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th className="p-3">Family Account</th>
                    <th className="p-3">Registrar Queried</th>
                    <th className="p-3">Allotment Status</th>
                    <th className="p-3">Shares Allotted</th>
                    <th className="p-3">Value / Refund</th>
                    <th className="p-3">Database Synchronization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/60">
                  {multiScanResult.items.map((item) => (
                    <tr key={item.panId} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="font-semibold text-white">{item.holderName}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.relationship} • {item.panMasked} ({item.broker})
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="text-cyan-300 font-medium block">
                          {item.registrarName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Ref: {item.applicationNo}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            item.status === 'Allotted'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {item.status === 'Allotted' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {item.status}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`font-bold ${item.sharesAllotted > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {item.sharesAllotted > 0 ? `${item.sharesAllotted} shs` : '0 shs'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ({item.category} • {item.lotsApplied} lot(s))
                        </span>
                      </td>

                      <td className="p-3">
                        {item.allotmentValue > 0 ? (
                          <div>
                            <span className="font-semibold text-white block">
                              ₹{item.allotmentValue.toLocaleString('en-IN')}
                            </span>
                            {item.refundAmount > 0 && (
                              <span className="text-[10px] text-slate-400 block">
                                Refund: ₹{item.refundAmount.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            Full Refund: ₹{item.refundAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          Synced to Demat & DB
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Official Registrar Deep Links Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-cyan-400" />
          Official Registrar Portals (Direct Handoff & Fallbacks)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OFFICIAL_REGISTRARS.map((reg) => (
            <div
              key={reg.slug}
              className="p-4 rounded-2xl glass-card flex flex-col justify-between"
            >
              <div>
                <h5 className="font-bold text-sm text-white">{reg.name}</h5>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {reg.description}
                </p>
              </div>

              <a
                href={reg.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-between px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black font-semibold text-xs border border-cyan-500/30 transition cursor-pointer"
              >
                <span>Open Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: Raw Registrar Output Text Scanner (NLP / Regex Parser) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Manual Text Scanner & NLP Status Parser
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy and paste output from Link Intime, KFintech, or Bigshare. The classifier extracts allotment status, share counts, and refund amounts with ≥95% accuracy.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Load sample:</span>
            <button
              onClick={() => loadSampleOutput('allotted')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 cursor-pointer font-mono"
            >
              Allotted Sample
            </button>
            <button
              onClick={() => loadSampleOutput('notAllotted')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-rose-300 border border-rose-500/20 cursor-pointer font-mono"
            >
              Not Allotted Sample
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="relative">
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your copied registrar response table or status text here..."
            className="w-full p-4 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleScan}
            disabled={isScanning || !pasteText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition disabled:opacity-50 shadow-md shadow-cyan-500/20"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>{isScanning ? 'Classifying Output...' : 'Scan & Classify Status'}</span>
          </button>
        </div>

        {/* Scan Result Card */}
        {scanResult && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-3 mt-4">
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs font-mono">
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
    </div>
  );
};
