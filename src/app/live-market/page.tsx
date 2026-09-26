'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveMarketHeader } from '@/components/live-market/LiveMarketHeader';
import { IpoMarketOverview } from '@/components/live-market/IpoMarketOverview';
import { IpoCategoriesTabs } from '@/components/live-market/IpoCategoriesTabs';
import { IpoDetailModal } from '@/components/radar/IpoDetailModal';
import { LiveGmpTrendChart } from '@/components/live-market/LiveGmpTrendChart';
import { LiveStockPriceChart } from '@/components/live-market/LiveStockPriceChart';
import { MultiPanBiddingModal } from '@/components/pans/MultiPanBiddingModal';
import {
  LiveMarketIpoItem,
  LiveMarketOverviewResponse,
  MarketAlertItem,
} from '@/types/liveMarket';
import {
  X,
  TrendingUp,
  Flame,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LiveMarketPage() {
  const router = useRouter();

  // Dashboard state
  const [overviewData, setOverviewData] = useState<LiveMarketOverviewResponse | null>(null);
  const [ipos, setIpos] = useState<LiveMarketIpoItem[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<MarketAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Active Modals state
  const [selectedIpoForDetail, setSelectedIpoForDetail] = useState<LiveMarketIpoItem | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'overview' | 'gmp' | 'chart'>('overview');
  const [selectedIpoForGmp, setSelectedIpoForGmp] = useState<LiveMarketIpoItem | null>(null);
  const [selectedIpoForStockChart, setSelectedIpoForStockChart] = useState<LiveMarketIpoItem | null>(null);

  // Multi-PAN Apply Modal
  const [isMultiApplyOpen, setIsMultiApplyOpen] = useState<boolean>(false);
  const [applyIpoData, setApplyIpoData] = useState<{
    symbol: string;
    companyName: string;
    price: number;
    lotSize: number;
  }>({
    symbol: 'DEMOTECH',
    companyName: 'Demo Technologies Ltd',
    price: 475,
    lotSize: 31,
  });

  // Fetch initial live market data
  const fetchMarketData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    setErrorNotice(null);

    try {
      const [overviewRes, watchlistRes] = await Promise.allSettled([
        fetch('/api/live-market'),
        fetch('/api/market/watchlist'),
      ]);

      if (overviewRes.status === 'fulfilled') {
        const json: LiveMarketOverviewResponse = await overviewRes.value.json();
        if (json.success) {
          setOverviewData(json);
          setLastUpdated(json.lastUpdated || new Date().toLocaleTimeString('en-IN'));
          if (json.alerts) {
            setAlerts(json.alerts);
          }
        }
      } else {
        setErrorNotice('Live market feed temporarily unavailable. Displaying cached telemetry.');
      }

      // Fetch all categorized IPOs
      const [upcomingRes, openRes, closedRes, listedRes] = await Promise.allSettled([
        fetch('/api/ipos/upcoming'),
        fetch('/api/ipos/open'),
        fetch('/api/ipos/closed'),
        fetch('/api/ipos/listed'),
      ]);

      const allItems: LiveMarketIpoItem[] = [];

      if (upcomingRes.status === 'fulfilled') {
        const uJson = await upcomingRes.value.json();
        if (uJson.success && Array.isArray(uJson.data)) allItems.push(...uJson.data);
      }
      if (openRes.status === 'fulfilled') {
        const oJson = await openRes.value.json();
        if (oJson.success && Array.isArray(oJson.data)) allItems.push(...oJson.data);
      }
      if (closedRes.status === 'fulfilled') {
        const cJson = await closedRes.value.json();
        if (cJson.success && Array.isArray(cJson.data)) allItems.push(...cJson.data);
      }
      if (listedRes.status === 'fulfilled') {
        const lJson = await listedRes.value.json();
        if (lJson.success && Array.isArray(lJson.data)) allItems.push(...lJson.data);
      }

      // Deduplicate by symbol
      const uniqueMap = new Map<string, LiveMarketIpoItem>();
      allItems.forEach((item) => {
        if (!uniqueMap.has(item.symbol)) {
          uniqueMap.set(item.symbol, item);
        }
      });
      setIpos(Array.from(uniqueMap.values()));

      // Load watchlist
      if (watchlistRes.status === 'fulfilled') {
        const wJson = await watchlistRes.value.json();
        if (wJson.success && Array.isArray(wJson.symbols)) {
          setWatchlist(wJson.symbols);
        }
      }
    } catch (err: any) {
      console.error('Error fetching live market telemetry:', err);
      setErrorNotice('Live market connection interrupted. Displaying most recent available cache.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load & periodic background refresh
  useEffect(() => {
    fetchMarketData();

    // Auto-sync market overview every 60 seconds
    const interval = setInterval(() => {
      fetchMarketData(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Watchlist Toggle
  const handleToggleWatchlist = async (symbol: string) => {
    const isWatched = watchlist.includes(symbol);
    const updated = isWatched ? watchlist.filter((s) => s !== symbol) : [...watchlist, symbol];
    setWatchlist(updated);

    try {
      await fetch('/api/market/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: isWatched ? 'remove' : 'add' }),
      });
    } catch (e) {
      console.error('Failed to update watchlist on server:', e);
    }
  };

  // Open Details Modal with specific sub-tab
  const handleOpenDetails = (ipo: LiveMarketIpoItem, tab: 'overview' | 'gmp' | 'chart' = 'overview') => {
    setSelectedIpoForDetail(ipo);
    setDetailModalTab(tab);
  };

  const handleApplyWithPans = (
    symbol: string,
    companyName: string,
    price: number,
    lotSize: number
  ) => {
    setApplyIpoData({ symbol, companyName, price, lotSize });
    setIsMultiApplyOpen(true);
  };

  const handleAnalyzeAi = (symbol: string, companyName: string) => {
    router.push(`/?tab=analyst&symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100 selection:bg-emerald-500/30 selection:text-white">
      {/* Global Navigation Bar */}
      <Navbar
        activeTab="radar"
        activeIpoCount={overviewData?.overview.openCount || ipos.filter((i) => i.status === 'Open').length}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchMarketData(false)}
        lastUpdatedTime={lastUpdated}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error / Fallback Banner if API drops */}
        {errorNotice && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button
              onClick={() => fetchMarketData(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold cursor-pointer transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 1. LIVE MARKET HEADER */}
        <LiveMarketHeader
          marketStatus={overviewData?.marketStatus || 'OPEN'}
          lastUpdated={lastUpdated || 'Syncing...'}
          isRefreshing={isRefreshing}
          connectionStatus={overviewData?.connectionStatus || (overviewData?.isMock ? 'DEMO' : 'LIVE')}
          isMock={overviewData?.isMock ?? true}
          alerts={alerts}
          onRefresh={() => fetchMarketData(false)}
        />

        {/* 2. IPO MARKET OVERVIEW STATS */}
        <IpoMarketOverview
          data={overviewData}
          loading={loading && !overviewData}
          onSelectIpo={(ipo) => handleOpenDetails(ipo, 'overview')}
        />

        {/* 3. IPO CATEGORIES, SEARCH, FILTERS, AND DATA GRID */}
        <IpoCategoriesTabs
          ipos={ipos}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
          onOpenDetails={(ipo) => handleOpenDetails(ipo, 'overview')}
          onOpenGmpTrend={(ipo) => setSelectedIpoForGmp(ipo)}
          onOpenStockChart={(ipo) => setSelectedIpoForStockChart(ipo)}
        />
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-6 bg-slate-950/80 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="IPOLENS" className="h-6 w-auto object-contain opacity-80" />
            <span>• Live IPO Market & Real-Time Trading Intelligence</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px] text-center sm:text-right">
            Upstox Market Feed V3 Architecture • Direct NSE Order Book • SEBI Regulatory Disclaimer Compliant
          </div>
        </div>
      </footer>

      {/* EXTENDED IPO DETAILS MODAL (Requirement 4, 5, 6) */}
      {selectedIpoForDetail && (
        <IpoDetailModal
          symbol={selectedIpoForDetail.symbol}
          isOpen={!!selectedIpoForDetail}
          onClose={() => setSelectedIpoForDetail(null)}
          onApplyWithPans={handleApplyWithPans}
          onAnalyzeAi={handleAnalyzeAi}
          initialTab={detailModalTab}
        />
      )}

      {/* DEDICATED GMP LIVE TREND MODAL */}
      {selectedIpoForGmp && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0b101d] border border-white/10 shadow-2xl overflow-hidden my-auto sm:my-4">
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {selectedIpoForGmp.companyName} ({selectedIpoForGmp.symbol})
                  </h3>
                  <p className="text-xs text-slate-400">Grey Market Premium Real-Time Telemetry</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIpoForGmp(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <LiveGmpTrendChart
                symbol={selectedIpoForGmp.symbol}
                companyName={selectedIpoForGmp.companyName}
                baseGmp={selectedIpoForGmp.gmp || 75}
                issuePrice={selectedIpoForGmp.priceHigh || 450}
              />
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED LIVE STOCK PRICE CHART MODAL */}
      {selectedIpoForStockChart && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0b101d] border border-white/10 shadow-2xl overflow-hidden my-auto sm:my-4">
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {selectedIpoForStockChart.companyName} ({selectedIpoForStockChart.symbol})
                  </h3>
                  <p className="text-xs text-slate-400">Live Listed Market Feed • Upstox / NSE Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIpoForStockChart(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <LiveStockPriceChart
                symbol={selectedIpoForStockChart.symbol}
                companyName={selectedIpoForStockChart.companyName}
                initialPrice={selectedIpoForStockChart.currentPrice || selectedIpoForStockChart.listingPrice || 450}
              />
            </div>
          </div>
        </div>
      )}

      {/* MULTI-PAN BIDDING MODAL */}
      <MultiPanBiddingModal
        isOpen={isMultiApplyOpen}
        onClose={() => setIsMultiApplyOpen(false)}
        defaultSymbol={applyIpoData.symbol}
        defaultCompanyName={applyIpoData.companyName}
        defaultPrice={applyIpoData.price}
        defaultLotSize={applyIpoData.lotSize}
        onSuccess={() => {
          fetchMarketData(true);
        }}
      />
    </div>
  );
}
