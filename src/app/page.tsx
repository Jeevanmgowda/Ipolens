'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Navbar, ActiveTab } from '@/components/Navbar';
import { LiveIpoRadar } from '@/components/radar/LiveIpoRadar';
import { AiResearchView } from '@/components/research/AiResearchView';
import { PanManager } from '@/components/pans/PanManager';
import { ApplicationTracker } from '@/components/pans/ApplicationTracker';
import { MultiPanBiddingModal } from '@/components/pans/MultiPanBiddingModal';
import { AllotmentChecker } from '@/components/allotment/AllotmentChecker';
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard';
import { WatchlistView } from '@/components/watchlist/WatchlistView';
import { AnchorLockInTracker } from '@/components/radar/AnchorLockInTracker';

const TABS: ActiveTab[] = ['radar', 'analyst', 'pans', 'allotment', 'portfolio', 'watchlist', 'lockin'];

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const params = useSearchParams();
  const tabParam = params.get('tab') as ActiveTab | null;
  const symbolParam = params.get('symbol');
  const [activeTab, setActiveTab] = useState<ActiveTab>(tabParam && TABS.includes(tabParam) ? tabParam : 'radar');
  const [activeIpoCount, setActiveIpoCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Multi-PAN Bidding Modal State
  const [isMultiApplyOpen, setIsMultiApplyOpen] = useState<boolean>(false);
  const [selectedIpoForApply, setSelectedIpoForApply] = useState<{
    symbol: string;
    companyName: string;
    price: number;
    lotSize: number;
  }>({
    symbol: '',
    companyName: '',
    price: 0,
    lotSize: 0,
  });

  // AI Analyst selection state
  const [selectedIpoForAi, setSelectedIpoForAi] = useState<{
    symbol: string;
    companyName: string;
  }>({
    symbol: symbolParam || '',
    companyName: symbolParam || '',
  });

  const handleApplyWithPans = (
    symbol: string,
    companyName: string,
    price: number,
    lotSize: number
  ) => {
    setSelectedIpoForApply({ symbol, companyName, price, lotSize });
    setIsMultiApplyOpen(true);
  };

  const handleAnalyzeAi = (symbol: string, companyName: string) => {
    setSelectedIpoForAi({ symbol, companyName });
    setActiveTab('analyst');
  };

  const handleGlobalRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100">
      {/* Global Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeIpoCount={activeIpoCount}
        isRefreshing={isRefreshing}
        onRefresh={handleGlobalRefresh}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Module 1: Live IPO Radar */}
        {activeTab === 'radar' && (
          <div className="space-y-6">
            <LiveIpoRadar
              key={refreshKey}
              onApplyWithPans={handleApplyWithPans}
              onAnalyzeAi={handleAnalyzeAi}
              onIposLoaded={(count) => setActiveIpoCount(count)}
            />
          </div>
        )}

        {/* Module 2: AI DRHP Analyst */}
        {activeTab === 'analyst' && (
          <div className="space-y-6">
            <AiResearchView
              initialSymbol={selectedIpoForAi.symbol}
              initialCompanyName={selectedIpoForAi.companyName}
              onBackToRadar={() => setActiveTab('radar')}
            />
          </div>
        )}

        {/* Module 3: Family Multi-PAN Manager & Applications */}
        {activeTab === 'pans' && (
          <div className="space-y-8">
            <PanManager onOpenMultiApply={() => setIsMultiApplyOpen(true)} />
            <ApplicationTracker onRefreshTrigger={refreshKey} />
          </div>
        )}

        {/* Module 4: 1-Click Allotment Checker & Scanner */}
        {activeTab === 'allotment' && (
          <div className="space-y-6">
            <AllotmentChecker />
          </div>
        )}

        {/* Module 5: Demat Portfolio & P&L Tracker */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <PortfolioDashboard />
          </div>
        )}

        {/* Module 6: Watchlist & Custom Alerts */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <WatchlistView />
          </div>
        )}

        {/* Module 7: Anchor Investor Lock-In Expiry Tracker */}
        {activeTab === 'lockin' && (
          <div className="space-y-6">
            <AnchorLockInTracker />
          </div>
        )}
      </main>

      {/* Multi-PAN Bidding Modal */}
      <MultiPanBiddingModal
        isOpen={isMultiApplyOpen}
        onClose={() => setIsMultiApplyOpen(false)}
        defaultSymbol={selectedIpoForApply.symbol}
        defaultCompanyName={selectedIpoForApply.companyName}
        defaultPrice={selectedIpoForApply.price}
        defaultLotSize={selectedIpoForApply.lotSize}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* Institutional Footer */}
      <footer className="border-t border-white/5 py-6 bg-slate-950/80 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" width={1024} height={409} alt="IPOLENS" className="h-6 w-auto object-contain opacity-80" />
            <span>• IPO research, family PAN tracking and allotment checks</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Data: InvestorGain, BSE, Yahoo Finance (delayed) • No broker credentials required • Not investment advice
          </div>
        </div>
      </footer>
    </div>
  );
}
