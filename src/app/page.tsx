'use client';

import React, { useState } from 'react';
import { Navbar, ActiveTab } from '@/components/Navbar';
import { LiveIpoRadar } from '@/components/radar/LiveIpoRadar';
import { AiResearchView } from '@/components/research/AiResearchView';
import { PanManager } from '@/components/pans/PanManager';
import { ApplicationTracker } from '@/components/pans/ApplicationTracker';
import { MultiPanBiddingModal } from '@/components/pans/MultiPanBiddingModal';
import { AllotmentChecker } from '@/components/allotment/AllotmentChecker';
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard';
import { Shield, Sparkles, Layers, Activity } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('radar');
  const [activeIpoCount, setActiveIpoCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Sync tab and symbol from URL parameters if navigated from /live-market
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as ActiveTab | null;
      if (tab && ['radar', 'analyst', 'pans', 'allotment', 'portfolio'].includes(tab)) {
        setActiveTab(tab);
      }
      const sym = params.get('symbol');
      if (sym) {
        setSelectedIpoForAi({ symbol: sym, companyName: sym });
      }
    }
  }, []);

  // Multi-PAN Bidding Modal State
  const [isMultiApplyOpen, setIsMultiApplyOpen] = useState<boolean>(false);
  const [selectedIpoForApply, setSelectedIpoForApply] = useState<{
    symbol: string;
    companyName: string;
    price: number;
    lotSize: number;
  }>({
    symbol: 'NSE',
    companyName: 'National Stock Exchange of India Ltd',
    price: 1785,
    lotSize: 14,
  });

  // AI Analyst selection state
  const [selectedIpoForAi, setSelectedIpoForAi] = useState<{
    symbol: string;
    companyName: string;
  }>({
    symbol: 'NSE',
    companyName: 'National Stock Exchange of India Ltd',
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
            <img src="/logo.png" alt="IPOLENS" className="h-6 w-auto object-contain opacity-80" />
            <span>• Production-Ready Primary Market & Portfolio Platform</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Direct Feeds from NSE India • Zero Broker Credentials Required • SEBI Rule Compliant
          </div>
        </div>
      </footer>
    </div>
  );
}
