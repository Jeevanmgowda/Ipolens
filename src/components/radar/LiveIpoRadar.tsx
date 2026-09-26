'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LiveIpoSummary } from '@/types/ipo';
import {
  LiveMarketIpoItem,
  LiveMarketOverviewResponse,
  MarketAlertItem,
} from '@/types/liveMarket';
import { LiveMarketHeader } from '@/components/live-market/LiveMarketHeader';
import { IpoMarketOverview } from '@/components/live-market/IpoMarketOverview';
import { IpoCategoriesTabs } from '@/components/live-market/IpoCategoriesTabs';
import { IpoDetailModal } from './IpoDetailModal';
import { LiveGmpTrendChart } from '@/components/live-market/LiveGmpTrendChart';
import { LiveStockPriceChart } from '@/components/live-market/LiveStockPriceChart';
import {
  X,
  TrendingUp,
  Flame,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface LiveIpoRadarProps {
  onApplyWithPans: (symbol: string, companyName: string, price: number, lotSize: number) => void;
  onAnalyzeAi: (symbol: string, companyName: string) => void;
  onIposLoaded?: (count: number) => void;
}

export const LiveIpoRadar: React.FC<LiveIpoRadarProps> = ({
  onApplyWithPans,
  onAnalyzeAi,
  onIposLoaded,
}) => {
  // Live Market State
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

  // Fetch initial and updated live market telemetry
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
          if (onIposLoaded && json.overview) {
            onIposLoaded(json.overview.openCount || 0);
          }
        }
      } else {
        setErrorNotice('Live market feed temporarily unavailable. Displaying cached telemetry.');
      }

      // Fetch all categorized IPOs (Upcoming, Open, Closed, Listed)
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
        if (oJson.success && Array.isArray(oJson.data)) {
          allItems.push(...oJson.data);
          if (onIposLoaded && (!overviewData || !overviewData.overview)) {
            onIposLoaded(oJson.data.length);
          }
        }
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
  }, [onIposLoaded, overviewData]);

  // Initial load & periodic background refresh
  useEffect(() => {
    fetchMarketData();

    // Auto-sync market telemetry every 60 seconds
    const interval = setInterval(() => {
      fetchMarketData(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="space-y-6">
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

      {/* 1. LIVE MARKET HEADER TELEMETRY */}
      <LiveMarketHeader
        marketStatus={overviewData?.marketStatus || 'OPEN'}
        lastUpdated={lastUpdated || 'Syncing...'}
        isRefreshing={isRefreshing}
        connectionStatus={overviewData?.connectionStatus || (overviewData?.isMock ? 'DEMO' : 'LIVE')}
        isMock={overviewData?.isMock ?? true}
        alerts={alerts}
        onRefresh={() => fetchMarketData(false)}
      />

      {/* 2. IPO MARKET OVERVIEW SUMMARY CARDS */}
      <IpoMarketOverview
        data={overviewData}
        loading={loading && !overviewData}
        onSelectIpo={(ipo) => handleOpenDetails(ipo, 'overview')}
      />

      {/* 3. IPO CATEGORIES (Upcoming, Open, Closed, Listed), SEARCH, FILTERS, WATCHLIST */}
      <IpoCategoriesTabs
        ipos={ipos}
        watchlist={watchlist}
        onToggleWatchlist={handleToggleWatchlist}
        onOpenDetails={(ipo) => handleOpenDetails(ipo, 'overview')}
        onOpenGmpTrend={(ipo) => setSelectedIpoForGmp(ipo)}
        onOpenStockChart={(ipo) => setSelectedIpoForStockChart(ipo)}
      />

      {/* EXTENDED IPO DETAILS MODAL (Overview, Subscription progress bars, embedded GMP & Stock Charts) */}
      {selectedIpoForDetail && (
        <IpoDetailModal
          symbol={selectedIpoForDetail.symbol}
          isOpen={!!selectedIpoForDetail}
          onClose={() => setSelectedIpoForDetail(null)}
          onApplyWithPans={onApplyWithPans}
          onAnalyzeAi={onAnalyzeAi}
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
    </div>
  );
};
