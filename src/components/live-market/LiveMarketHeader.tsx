'use client';

import React, { useState } from 'react';
import {
  Radio,
  RefreshCw,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Flame,
  TrendingUp,
  X,
  ExternalLink,
} from 'lucide-react';
import { MarketStatus, ConnectionStatus, MarketAlertItem } from '@/types/liveMarket';

interface LiveMarketHeaderProps {
  marketStatus: MarketStatus;
  connectionStatus: ConnectionStatus;
  lastUpdated: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  isMock?: boolean;
  alerts?: MarketAlertItem[];
}

export const LiveMarketHeader: React.FC<LiveMarketHeaderProps> = ({
  marketStatus,
  connectionStatus,
  lastUpdated,
  isRefreshing,
  onRefresh,
  isMock,
  alerts = [],
}) => {
  const [showAlertsDropdown, setShowAlertsDropdown] = useState<boolean>(false);
  const [alertList, setAlertList] = useState<MarketAlertItem[]>(alerts);

  const unreadCount = alertList.filter((a) => !a.read).length;

  const markAllRead = () => {
    setAlertList((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  return (
    <div className="relative glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4 bg-gradient-to-r from-[#0b1224] via-[#090f1d] to-[#060913]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
              IPOLENS Live Market
            </h1>

            {/* Connection Status Indicator */}
            {connectionStatus === 'LIVE' ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>🟢 LIVE</span>
              </span>
            ) : connectionStatus === 'DEMO' ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm shadow-amber-500/10">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>🟡 DEMO DATA</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>🔴 DISCONNECTED</span>
              </span>
            )}

            {/* Market Session Status */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                marketStatus === 'OPEN'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  marketStatus === 'OPEN' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>NSE {marketStatus}</span>
            </span>
          </div>

          <p className="text-sm text-slate-400 mt-1.5 font-medium">
            Track IPO subscriptions, GMP trends and live listed-market prices.
          </p>
        </div>

        {/* Action Controls & Telemetry Info */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Last Update Timestamp */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/5 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Last updated:</span>
            <span className="text-slate-200 font-bold">{lastUpdated || 'Just now'}</span>
          </div>

          {/* Sync Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Live Data"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition cursor-pointer text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Market'}</span>
          </button>

          {/* Market Alerts Drawer Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
              title="IPO Market Alerts"
              className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Alerts Dropdown Drawer */}
            {showAlertsDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0c1326] border border-white/15 shadow-2xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-xs text-white">Live Market Alerts</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => setShowAlertsDropdown(false)}
                      className="p-1 rounded-md text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {alertList.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border text-xs transition space-y-1 ${
                        alert.read
                          ? 'bg-slate-900/40 border-white/5 text-slate-400'
                          : 'bg-cyan-950/20 border-cyan-500/25 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-white flex items-center gap-1.5">
                          {alert.type === 'SUBSCRIPTION' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                          {alert.type === 'GMP' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                          {alert.type === 'CLOSING_SOON' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                          {alert.type === 'PRICE_MOVE' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                          {alert.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{alert.timestamp}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
