'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  BarChart2,
  TrendingUp,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import { MarketQuoteData, MarketOhlcCandle } from '@/types/liveMarket';
import { TradingViewChart } from '../radar/TradingViewChart';

interface LiveStockPriceChartProps {
  symbol: string;
  companyName?: string;
  initialPrice?: number;
}

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1H' },
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
];

export const LiveStockPriceChart: React.FC<LiveStockPriceChartProps> = ({
  symbol,
  companyName = symbol,
  initialPrice,
}) => {
  const [chartType, setChartType] = useState<'line' | 'candle' | 'tradingview'>('line');
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [quote, setQuote] = useState<MarketQuoteData | null>(null);
  const [candles, setCandles] = useState<MarketOhlcCandle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sseActive, setSseActive] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string>('');

  const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

  // 1. Fetch Quote & OHLC candles
  const fetchMarketData = async (sym: string, tf: string) => {
    setLoading(true);
    try {
      const [quoteRes, ohlcRes] = await Promise.all([
        fetch(`/api/market/${encodeURIComponent(sym)}/quote`),
        fetch(`/api/market/${encodeURIComponent(sym)}/ohlc?timeframe=${tf}`),
      ]);

      const quoteJson = await quoteRes.json();
      const ohlcJson = await ohlcRes.json();

      if (quoteJson.success && quoteJson.data) {
        setQuote(quoteJson.data);
      }
      if (ohlcJson.success && Array.isArray(ohlcJson.data)) {
        setCandles(ohlcJson.data);
      }
    } catch (err) {
      console.error('Error fetching stock price chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData(cleanSymbol, timeframe);
  }, [cleanSymbol, timeframe]);

  // 2. Real-Time WebSocket / SSE Streaming
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/market/stream');
      eventSource.onopen = () => setSseActive(true);
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.symbol && parsed.symbol.toUpperCase() === cleanSymbol && parsed.ltp) {
            const tickLtp = Number(parsed.ltp);

            setQuote((prev) => {
              const prevClose = prev?.previousClose || tickLtp;
              const newChange = Number((tickLtp - prevClose).toFixed(2));
              const newChangePercent = Number(((newChange / prevClose) * 100).toFixed(2));
              return {
                symbol: cleanSymbol,
                ltp: tickLtp,
                open: prev?.open || tickLtp,
                high: Math.max(prev?.high || tickLtp, tickLtp),
                low: Math.min(prev?.low || tickLtp, tickLtp),
                previousClose: prevClose,
                volume: (prev?.volume || 0) + Math.floor(Math.random() * 50 + 5),
                change: newChange,
                changePercent: newChangePercent,
                timestamp: new Date().toISOString(),
                isMock: prev?.isMock ?? false,
              };
            });

            // Live Real-Time Chart Candlestick/Line Animation
            setCandles((prevCandles) => {
              if (!prevCandles || prevCandles.length === 0) {
                return [
                  {
                    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: Date.now(),
                    open: tickLtp,
                    high: tickLtp,
                    low: tickLtp,
                    close: tickLtp,
                    volume: 100,
                  },
                ];
              }

              const last = prevCandles[prevCandles.length - 1];
              const updatedLast: MarketOhlcCandle = {
                ...last,
                close: tickLtp,
                high: Math.max(last.high, tickLtp),
                low: Math.min(last.low, tickLtp),
                volume: (last.volume || 0) + 15,
              };

              return [...prevCandles.slice(0, -1), updatedLast];
            });

            setLastTickTime(new Date().toLocaleTimeString('en-IN'));
          }
        } catch {
          // ignore non-json ping keepalives
        }
      };
      eventSource.onerror = () => setSseActive(false);
    } catch {
      setSseActive(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [cleanSymbol]);

  const currentPrice = quote?.ltp ?? initialPrice ?? 100;
  const isPositive = (quote?.change ?? 0) >= 0;
  const strokeColor = isPositive ? '#10b981' : '#f43f5e';

  // Compute min/max for scale
  const candlePrices = candles.flatMap((c) => [c.low, c.high]);
  const minPrice = candlePrices.length > 0 ? Math.floor(Math.min(...candlePrices) * 0.98) : 'auto';
  const maxPrice = candlePrices.length > 0 ? Math.ceil(Math.max(...candlePrices) * 1.02) : 'auto';

  return (
    <div className="space-y-4">
      {/* Top Header: Price & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[#080d1a] border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-white text-base">NSE:{cleanSymbol}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {sseActive ? 'Real-Time Tick Stream' : 'Live Polling'}
            </span>
            {quote?.isMock && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Demo
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              ₹{currentPrice.toFixed(2)}
            </span>
            {quote && (
              <div
                className={`flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                  isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>
                  {isPositive ? '+' : ''}₹{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chart View Switcher: Line vs Candle vs TradingView */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                chartType === 'line'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                chartType === 'candle'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Candle
            </button>
            <button
              onClick={() => setChartType('tradingview')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                chartType === 'tradingview'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>TradingView</span>
            </button>
          </div>

          <button
            onClick={() => fetchMarketData(cleanSymbol, timeframe)}
            disabled={loading}
            title="Refresh Quotes"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Timeframe Selector (Only for Native Line & Candle Charts) */}
      {chartType !== 'tradingview' && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/5 text-xs">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  timeframe === tf.value
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Real-time OHLC Bar */}
          {quote && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
              <span>O: <strong className="text-white">₹{quote.open}</strong></span>
              <span>H: <strong className="text-emerald-400">₹{quote.high}</strong></span>
              <span>L: <strong className="text-rose-400">₹{quote.low}</strong></span>
              <span>Prev: <strong className="text-slate-300">₹{quote.previousClose}</strong></span>
              <span>Vol: <strong className="text-cyan-300">{quote.volume.toLocaleString('en-IN')}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="rounded-2xl overflow-hidden bg-[#060a14] border border-white/10 p-3 sm:p-4">
        {chartType === 'tradingview' ? (
          <TradingViewChart symbol={cleanSymbol} height={480} />
        ) : loading && candles.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Fetching live exchange ticks...</span>
          </div>
        ) : chartType === 'line' ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={candles}>
                <defs>
                  <linearGradient id="priceLineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={strokeColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[minPrice, maxPrice]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                  orientation="right"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const c = payload[0].payload;
                      return (
                        <div className="glass-panel p-2.5 rounded-xl border border-white/20 shadow-2xl text-xs space-y-1 font-mono">
                          <p className="text-[10px] text-slate-400">{c.time}</p>
                          <p className="text-sm font-bold text-white">₹{c.close}</p>
                          <div className="text-[10px] text-slate-400 grid grid-cols-2 gap-x-2">
                            <span>Open: ₹{c.open}</span>
                            <span>High: ₹{c.high}</span>
                            <span>Low: ₹{c.low}</span>
                            <span>Vol: {c.volume}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {quote?.previousClose && (
                  <ReferenceLine
                    y={quote.previousClose}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#priceLineGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Candlestick / Bar View */
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={candles}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[minPrice, maxPrice]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                  orientation="right"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const c = payload[0].payload;
                      const isUp = c.close >= c.open;
                      return (
                        <div className="glass-panel p-2.5 rounded-xl border border-white/20 shadow-2xl text-xs space-y-1 font-mono">
                          <p className="text-[10px] text-slate-400">{c.time}</p>
                          <p className={`text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ₹{c.close} ({isUp ? '+' : ''}{((c.close - c.open) / c.open * 100).toFixed(2)}%)
                          </p>
                          <div className="text-[10px] text-slate-400 grid grid-cols-2 gap-x-2">
                            <span>Open: ₹{c.open}</span>
                            <span>High: ₹{c.high}</span>
                            <span>Low: ₹{c.low}</span>
                            <span>Vol: {c.volume}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="close"
                  fill="#06b6d4"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
