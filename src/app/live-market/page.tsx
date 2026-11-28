'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveIpoQuotes } from '@/hooks/useLiveIpoQuotes';
import { Navbar } from '@/components/Navbar';
import { LiveMarketHeader } from '@/components/live-market/LiveMarketHeader';
import { IpoMarketOverview } from '@/components/live-market/IpoMarketOverview';
import { IpoCategoriesTabs, getEffectiveIpoStatus } from '@/components/live-market/IpoCategoriesTabs';
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
import { getCanonicalSymbol, isSameIpo, isFalseOrDemoSymbol } from '@/lib/utils/ipoDeduplication';
import { predictGmpForIpo } from '@/services/mlListingGainModel';

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
    symbol: 'JIOPLAT',
    companyName: 'Jio Platforms Limited',
    price: 450,
    lotSize: 33,
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

      // Deduplicate by canonical symbol and company name across all category feeds
      const uniqueList: LiveMarketIpoItem[] = [];
      for (const item of allItems) {
        if (isFalseOrDemoSymbol(item.symbol)) continue;
        const canonical = getCanonicalSymbol(item.symbol);
        const dupIdx = uniqueList.findIndex((u) =>
          isSameIpo(u.symbol, u.companyName, canonical, item.companyName)
        );

        const rawPrices = String(item.priceBand || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
        const parsedMax = rawPrices && rawPrices.length > 0 ? parseFloat(rawPrices[rawPrices.length - 1]) : 100;
        const parsedMin = rawPrices && rawPrices.length > 0 ? parseFloat(rawPrices[0]) : parsedMax;
        const pHigh = item.priceHigh || item.issuePrice || item.priceLow || (rawPrices ? parsedMax : 0);
        const pLow = item.priceLow || parsedMin || pHigh;

        const series = item.series === 'DEBT' ? 'DEBT' : (item.series === 'SME' ? 'SME' : 'EQ');
        const lot = series === 'DEBT' ? 1 : (item.lotSize && item.lotSize > 0 ? item.lotSize : 0); // 0 = unknown, shown as —
        const minInv = item.minInvestment || (lot && pHigh ? pHigh * lot : 0);

        const sanitizedItem: LiveMarketIpoItem = {
          ...item,
          symbol: canonical || item.symbol,
          id: (canonical || item.symbol).toLowerCase(),
          priceHigh: pHigh,
          priceLow: pLow,
          series,
          lotSize: lot,
          minInvestment: minInv,
        };

        if (dupIdx === -1) {
          uniqueList.push(sanitizedItem);
        } else {
          // Merge details prioritizing richer record
          const existing = uniqueList[dupIdx];
          const isMergedListed = Boolean(existing.isListed || item.isListed || existing.status === 'Listed' || item.status === 'Listed');
          const chosenSeries = (existing.series === 'SME' || sanitizedItem.series === 'SME') ? 'SME' : (existing.series === 'DEBT' || sanitizedItem.series === 'DEBT' ? 'DEBT' : 'EQ');
          const chosenLot = chosenSeries === 'DEBT' ? 1 : (existing.lotSize > 0 ? existing.lotSize : sanitizedItem.lotSize);
          const chosenMinInv = existing.minInvestment || sanitizedItem.minInvestment || existing.priceHigh * chosenLot;

          uniqueList[dupIdx] = {
            ...existing,
            ...sanitizedItem,
            symbol: canonical || existing.symbol,
            id: (canonical || existing.symbol).toLowerCase(),
            series: chosenSeries,
            lotSize: chosenLot,
            minInvestment: chosenMinInv,
            status: isMergedListed ? 'Listed' : (item.status === 'Open' || existing.status === 'Open' ? 'Open' : (sanitizedItem.status || existing.status)),
            isListed: isMergedListed,
            gmp: (sanitizedItem.gmp && sanitizedItem.gmp > 0) ? sanitizedItem.gmp : existing.gmp,
            gmpPercent: (sanitizedItem.gmpPercent && sanitizedItem.gmpPercent > 0) ? sanitizedItem.gmpPercent : existing.gmpPercent,
            isAiPredictedGmp: sanitizedItem.isAiPredictedGmp ?? existing.isAiPredictedGmp,
          };
        }
      }

      // Guaranteed ML GMP prediction for open and upcoming IPOs
      for (const ipo of uniqueList) {
        const eff = getEffectiveIpoStatus(ipo);
        if (eff !== 'listed' && ipo.series !== 'DEBT' && !ipo.hasGmpData && !ipo.isAiPredictedGmp && (!ipo.gmp || ipo.gmp <= 0) && ipo.priceHigh > 0) {
          const ml = predictGmpForIpo({
            symbol: ipo.symbol,
            companyName: ipo.companyName,
            price: ipo.priceHigh,
            series: ipo.series,
            currentSubscription: ipo.currentSubscription || 0,
            qibSubscription: ipo.qibSubscription || 0,
            retailSubscription: ipo.retailSubscription || 0,
            niiSubscription: ipo.niiSubscription || 0,
            status: eff === 'open' ? 'Open' : 'Upcoming',
          });
          if (ml.predictedGmp > 0) {
            ipo.gmp = ml.predictedGmp;
            ipo.gmpPercent = ml.predictedGainPct;
            ipo.isAiPredictedGmp = true;
            ipo.predictedListingPrice = ml.predictedListingPrice;
          }
        }
      }
      setIpos(uniqueList);

      // Dynamically initialize multi-apply modal with first real open IPO
      const firstOpen = uniqueList.find((i) => i.status === 'Open');
      if (firstOpen) {
        setApplyIpoData({
          symbol: firstOpen.symbol,
          companyName: firstOpen.companyName,
          price: firstOpen.priceHigh || firstOpen.priceLow || 100,
          lotSize: firstOpen.lotSize || 14,
        });
      }

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

  // Live prices for listed IPOs: refresh cards in place.
  useLiveIpoQuotes(ipos, setIpos, watchlist);

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

  // Dynamically compute live KPIs strictly synchronized with deduplicated effective IPO statuses
  const liveOverview = useMemo(() => {
    let upcomingCount = 0;
    let openCount = 0;
    let closedCount = 0;
    let recentlyListedCount = 0;
    let closingSoonCount = 0;

    for (const item of ipos) {
      const eff = getEffectiveIpoStatus(item);
      if (eff === 'open') {
        openCount++;
        if (item.isClosingSoon || (item.remainingTime && item.remainingTime.includes('Hours Left'))) {
          closingSoonCount++;
        }
      } else if (eff === 'upcoming') {
        upcomingCount++;
      } else if (eff === 'closed') {
        closedCount++;
      } else if (eff === 'listed') {
        recentlyListedCount++;
      }
    }

    const listed = ipos.filter((i) => getEffectiveIpoStatus(i) === 'listed');
    const primary = ipos.filter((i) => getEffectiveIpoStatus(i) !== 'listed');

    const validGainers = listed.filter((i) => i.currentPrice && i.dayChangePercent !== undefined);
    const topGainer = validGainers.length > 0
      ? [...validGainers].sort((a, b) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0))[0]
      : listed[0];

    const validSubscribed = primary.filter((i) => (i.currentSubscription || 0) > 0);
    const topSubscribed = validSubscribed.length > 0
      ? [...validSubscribed].sort((a, b) => (b.currentSubscription || 0) - (a.currentSubscription || 0))[0]
      : primary[0];

    const validGmp = primary.filter((i) => (i.gmp || 0) > 0);
    const topGmp = validGmp.length > 0
      ? [...validGmp].sort((a, b) => (b.gmpPercent || 0) - (a.gmpPercent || 0))[0]
      : primary[0];

    return {
      upcomingCount,
      openCount,
      closingSoonCount,
      recentlyListedCount,
      totalTrackedCount: ipos.length,
      topGainer,
      topSubscribed,
      topGmp,
    };
  }, [ipos]);

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100 selection:bg-emerald-500/30 selection:text-white">
      {/* Global Navigation Bar */}
      <Navbar
        activeTab="radar"
        activeIpoCount={liveOverview.openCount}
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
          overview={liveOverview}
          topGainer={liveOverview.topGainer}
          topSubscribed={liveOverview.topSubscribed}
          topGmp={liveOverview.topGmp}
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
                baseGmp={selectedIpoForGmp.gmp ?? 0}
                issuePrice={selectedIpoForGmp.priceHigh || selectedIpoForGmp.priceLow || 100}
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
                  <p className="text-xs text-slate-400">
                    {getEffectiveIpoStatus(selectedIpoForStockChart) === 'listed'
                      ? 'Live Listed Market Feed • Real-Time NSE Exchange Feed'
                      : 'Primary Offering • Secondary Exchange Trading Commences on Listing Day'}
                  </p>
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
                initialPrice={
                  selectedIpoForStockChart.currentPrice ||
                  selectedIpoForStockChart.listingPrice ||
                  selectedIpoForStockChart.priceHigh ||
                  selectedIpoForStockChart.priceLow ||
                  100
                }
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
