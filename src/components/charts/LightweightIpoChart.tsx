'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  type IChartApi,
  type UTCTimestamp,
  ColorType,
} from 'lightweight-charts';
import { BarChart2, TrendingUp, RefreshCw, Activity } from 'lucide-react';

export interface LightweightCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface LightweightIpoChartProps {
  symbol: string;
  companyName?: string;
  isPreListing?: boolean;
  gmp?: number;
  gmpPercent?: number;
  subscriptionMultiple?: number;
  openDate?: string;
  closeDate?: string;
  listingDate?: string;
}

const TIMEFRAMES = ['1D', '1W', '1M', '1Y'] as const;

export const LightweightIpoChart: React.FC<LightweightIpoChartProps> = ({
  symbol,
  companyName,
  isPreListing = false,
  gmp,
  gmpPercent,
  subscriptionMultiple,
  openDate,
  closeDate,
  listingDate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('1M');
  const [mode, setMode] = useState<'candle' | 'line'>('candle');
  const [candles, setCandles] = useState<LightweightCandle[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [ltp, setLtp] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isPreListing) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [chartRes, quoteRes] = await Promise.all([
          fetch(`/api/market/charts/${encodeURIComponent(symbol)}?timeframe=${timeframe}`),
          fetch(`/api/market/quote?symbols=${encodeURIComponent(symbol)}`),
        ]);
        const chartJson = await chartRes.json();
        const quoteJson = await quoteRes.json();
        if (cancelled) return;
        if (chartJson.success && Array.isArray(chartJson.candles)) {
          setCandles(chartJson.candles);
          setProvider(chartJson.provider || '');
        } else {
          setCandles([]);
        }
        const q = quoteJson?.quotes?.[symbol.toUpperCase()];
        if (q && typeof q.ltp === 'number') {
          setLtp(q.ltp);
          setChangePct(typeof q.changePercent === 'number' ? q.changePercent : null);
        }
      } catch {
        if (!cancelled) setCandles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, isPreListing]);

  useEffect(() => {
    if (isPreListing || !containerRef.current || candles.length === 0) return;

    const el = containerRef.current;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: '#060a14' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: timeframe === '1D' || timeframe === '1W',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });
    chartRef.current = chart;

    if (mode === 'candle') {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#f43f5e',
        borderUpColor: '#10b981',
        borderDownColor: '#f43f5e',
        wickUpColor: '#10b981',
        wickDownColor: '#f43f5e',
      });
      series.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: '#22d3ee',
        topColor: 'rgba(34, 211, 238, 0.35)',
        bottomColor: 'rgba(34, 211, 238, 0.02)',
      });
      series.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
      );
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, mode, timeframe, isPreListing]);

  if (isPreListing) {
    return (
      <div className="rounded-2xl bg-[#060a14] border border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-2 text-cyan-300 text-sm font-semibold">
          <Activity className="w-4 h-4" />
          <span>Pre-Listing Summary — {companyName || symbol}</span>
        </div>
        <p className="text-xs text-slate-400">
          Secondary-market candlesticks begin on listing day. Below is the latest primary-market telemetry:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-slate-400 block text-[10px]">GMP</span>
            <span className="font-mono font-bold text-purple-300">
              {typeof gmp === 'number' && gmp > 0 ? `+₹${gmp} (${gmpPercent ?? 0}%)` : '—'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-slate-400 block text-[10px]">Subscription</span>
            <span className="font-mono font-bold text-cyan-300">
              {typeof subscriptionMultiple === 'number' && subscriptionMultiple > 0 ? `${subscriptionMultiple}x` : '—'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-slate-400 block text-[10px]">Open / Close</span>
            <span className="font-mono text-slate-200">{openDate || 'TBD'} – {closeDate || 'TBD'}</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-slate-400 block text-[10px]">Listing Date</span>
            <span className="font-mono text-slate-200">{listingDate || 'TBD'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#060a14] border border-white/10 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {ltp !== null && (
            <span className="font-mono font-extrabold text-lg text-white">
              ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {changePct !== null && (
            <span className={`font-mono text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
          {provider && (
            <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400">
              Source: {provider}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-white/10">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition ${
                  timeframe === tf ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setMode('candle')}
              className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                mode === 'candle' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              Candles
            </button>
            <button
              type="button"
              onClick={() => setMode('line')}
              className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                mode === 'line' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Line
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[360px] flex items-center justify-center text-xs font-mono text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Loading live OHLCV chart for {symbol}...</span>
        </div>
      ) : candles.length === 0 ? (
        <div className="h-[360px] flex items-center justify-center text-xs font-mono text-slate-500">
          No OHLCV data available for {symbol} ({timeframe}).
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-[360px]" />
      )}
    </div>
  );
};
