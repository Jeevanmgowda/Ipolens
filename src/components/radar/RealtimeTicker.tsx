'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Pause, Clock } from 'lucide-react';

interface RealtimeTickerProps {
  onTick: () => void;
  isRefreshing: boolean;
  lastSyncTime?: string;
}

export const RealtimeTicker: React.FC<RealtimeTickerProps> = ({
  onTick,
  isRefreshing,
  lastSyncTime,
}) => {
  const [intervalSec, setIntervalSec] = useState<number>(30);
  const [countdown, setCountdown] = useState<number>(30);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [latestSseTick, setLatestSseTick] = useState<{ symbol: string; ltp: number } | null>(null);

  // Connect to SSE Stream
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/market/stream');
      es.onopen = () => setSseConnected(true);
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.symbol && parsed.ltp) {
            setLatestSseTick({ symbol: parsed.symbol, ltp: parsed.ltp });
          }
        } catch {
          // ignore non-json messages (ping)
        }
      };
      es.onerror = () => setSseConnected(false);
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onTick();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSec, isPaused, onTick]);

  const handleIntervalChange = (sec: number) => {
    setIntervalSec(sec);
    setCountdown(sec);
  };

  const progressPercent = Math.round(((intervalSec - countdown) / intervalSec) * 100);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs">
      {/* Left: Status & Sync Countdown */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          </span>
          <span className="font-semibold text-slate-200">
            {isPaused ? 'Auto-Sync Paused' : 'Live Polling Active'}
          </span>
        </div>

        {!isPaused && (
          <div className="flex items-center gap-1.5 font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Next tick in:</span>
            <span className="font-bold text-cyan-300">{countdown}s</span>
          </div>
        )}

        {sseConnected && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SSE Stream</span>
            {latestSseTick && (
              <span className="text-white font-bold ml-1">
                {latestSseTick.symbol}: ₹{latestSseTick.ltp}
              </span>
            )}
          </div>
        )}

        {lastSyncTime && (
          <span className="hidden sm:inline text-slate-500 font-mono text-[11px]">
            Synced: {lastSyncTime}
          </span>
        )}
      </div>

      {/* Right: Interval selector & Manual sync button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-white/5 text-[11px]">
          {[15, 30, 60].map((sec) => (
            <button
              key={sec}
              onClick={() => handleIntervalChange(sec)}
              className={`px-2 py-1 rounded cursor-pointer transition font-mono ${
                intervalSec === sec && !isPaused
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer transition"
          title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        <button
          onClick={() => {
            onTick();
            setCountdown(intervalSec);
          }}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold cursor-pointer transition disabled:opacity-50 text-xs shadow-md shadow-cyan-500/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Now</span>
        </button>
      </div>
    </div>
  );
};
