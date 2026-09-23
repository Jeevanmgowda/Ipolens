'use client';

import React, { useState, useEffect } from 'react';
import { IpoChartResponse, IpoChartPoint } from '@/types/listedIpo';
import { TradingViewChart } from './TradingViewChart';
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Maximize2,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Activity,
  Layers,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface LiveIpoChartModalProps {
  symbol: string | null;
  companyName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const TIMEFRAMES = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: 'MAX', value: 'max' },
];

export const LiveIpoChartModal: React.FC<LiveIpoChartModalProps> = ({
  symbol,
  companyName,
  isOpen,
  onClose,
}) => {
  const [chartMode, setChartMode] = useState<'tradingview' | 'native'>('tradingview');
  const [range, setRange] = useState<string>('1mo');
  const [chartData, setChartData] = useState<IpoChartResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ price: number; date: string } | null>(null);

  const cleanSymbol = (symbol || '').toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');

  const fetchChart = async (sym: string, r: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ipos/chart?symbol=${encodeURIComponent(sym)}&range=${r}`);
      const json = await res.json();
      if (json.success && json.data) {
        setChartData(json.data);
      } else {
        setError(json.error || 'Failed to load live chart');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading live chart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!symbol || !isOpen) return;
    fetchChart(symbol, range);
  }, [symbol, range, isOpen]);

  if (!isOpen || !symbol) return null;

  const isPositive = (chartData?.change ?? 0) >= 0;
  const strokeColor = isPositive ? '#10b981' : '#f43f5e';

  // Calculate min & max for Y-axis domain
  const prices = chartData?.points.map((p) => p.price) || [];
  const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices) * 0.98) : 'auto';
  const maxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices) * 1.02) : 'auto';

  // Compute IPO multiplier if issuePrice exists
  const ipoMultiplier =
    chartData?.issuePrice && chartData.issuePrice > 0 && chartData.currentPrice
      ? (chartData.currentPrice / chartData.issuePrice).toFixed(2)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-[#080d1a] border border-white/10 shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/80">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                NSE:{cleanSymbol}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                OFFICIAL REAL-TIME EXCHANGE FEED
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {chartData?.companyName || companyName || cleanSymbol}
            </h3>

            {/* Current Price & Change */}
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
                ₹{hoveredPoint ? hoveredPoint.price.toFixed(2) : (chartData?.currentPrice.toFixed(2) ?? '—')}
              </span>

              {chartData && (
                <div
                  className={`flex items-center gap-1 text-xs sm:text-sm font-mono font-semibold px-2 py-0.5 rounded-lg ${
                    isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>
                    {isPositive ? '+' : ''}
                    {chartData.change.toFixed(2)} ({isPositive ? '+' : ''}
                    {chartData.changePercent.toFixed(2)}%)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal ml-1 hidden sm:inline">Live Change</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Engine Switcher */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setChartMode('tradingview')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  chartMode === 'tradingview'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>TradingView Live</span>
              </button>
              <button
                onClick={() => setChartMode('native')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  chartMode === 'native'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Technical Stream</span>
              </button>
            </div>

            <button
              onClick={() => fetchChart(symbol, range)}
              disabled={loading}
              title="Refresh live exchange data"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              title="Close chart modal"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Official Direct Links Bar */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-white/5 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Connect directly to official market terminals:</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://in.tradingview.com/chart/?symbol=NSE:${cleanSymbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/10 transition flex items-center gap-1 text-[11px]"
            >
              <span>TradingView Terminal</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={`https://www.google.com/finance/quote/${cleanSymbol}:NSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 transition flex items-center gap-1 text-[11px]"
            >
              <span>Google Finance Live</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={`https://www.nseindia.com/get-quotes/equity?symbol=${cleanSymbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 transition flex items-center gap-1 text-[11px]"
            >
              <span>NSE India Official</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Timeframe Selector & Quick Stats Bar (Only when Native is active) */}
        {chartMode === 'native' && (
          <div className="px-5 sm:px-6 py-3 border-b border-white/5 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
            {/* Timeframe Buttons */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-white/10 text-xs">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setRange(tf.value)}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    range === tf.value
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Quick Metrics */}
            {chartData && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>Prev Close:</span>
                  <span className="text-white font-semibold">₹{chartData.previousClose.toFixed(2)}</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                  <span>Day Range:</span>
                  <span className="text-white font-semibold">
                    ₹{chartData.dayLow.toFixed(2)} – ₹{chartData.dayHigh.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Chart Canvas Area */}
        <div className="p-4 sm:p-6 bg-[#060913]">
          {chartMode === 'tradingview' ? (
            /* Mode 1: Official TradingView Interactive Live Real-Time Chart */
            <div className="space-y-2">
              <TradingViewChart symbol={cleanSymbol} height={480} />
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                <span>Official TradingView real-time feed for NSE India. Switch timeframes & technical indicators above.</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Tick Stream Active
                </span>
              </div>
            </div>
          ) : (
            /* Mode 2: Native Stream Chart */
            <div>
              {loading && !chartData ? (
                <div className="h-[320px] flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                  <span className="text-xs text-slate-400 font-mono">Loading real-time candle points from exchange...</span>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  {error}
                </div>
              ) : chartData && chartData.points.length > 0 ? (
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData.points}
                      onMouseMove={(e: any) => {
                        if (e?.activePayload && e.activePayload.length > 0) {
                          const p = e.activePayload[0].payload;
                          setHoveredPoint({ price: p.price, date: p.date });
                        }
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
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
                            const data = payload[0].payload;
                            return (
                              <div className="glass-panel p-2.5 rounded-xl border border-white/20 shadow-2xl text-xs space-y-1">
                                <p className="text-[10px] text-slate-400 font-mono">{data.date} {data.time || ''}</p>
                                <p className="text-sm font-mono font-bold text-white">₹{data.price.toFixed(2)}</p>
                                {data.volume > 0 && (
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    Vol: {Number(data.volume).toLocaleString('en-IN')}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {chartData.previousClose && (
                        <ReferenceLine
                          y={chartData.previousClose}
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                          strokeOpacity={0.4}
                          label={{
                            value: 'Prev Close',
                            fill: '#94a3b8',
                            fontSize: 9,
                            position: 'insideBottomRight',
                          }}
                        />
                      )}
                      {chartData.issuePrice && (
                        <ReferenceLine
                          y={chartData.issuePrice}
                          stroke="#06b6d4"
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                          label={{
                            value: `IPO: ₹${chartData.issuePrice}`,
                            fill: '#06b6d4',
                            fontSize: 9,
                            position: 'insideTopLeft',
                          }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={strokeColor}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs">
                  No historical price points available for this range.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Performance Footer Grid */}
        {chartData && (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 text-[11px] block">IPO Offer Price</span>
              <span className="text-sm font-mono font-bold text-slate-200">
                {chartData.issuePrice ? `₹${chartData.issuePrice}` : 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 text-[11px] block">Listing Day Price</span>
              <span className="text-sm font-mono font-bold text-slate-200">
                {chartData.listingPrice ? `₹${chartData.listingPrice}` : 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 text-[11px] block">Total Gain Since IPO</span>
              <span className={`text-sm font-mono font-bold ${
                (chartData.issuePrice && chartData.currentPrice >= chartData.issuePrice)
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}>
                {chartData.issuePrice
                  ? `${(((chartData.currentPrice - chartData.issuePrice) / chartData.issuePrice) * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 text-[11px] block">IPO Return Multiplier</span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {ipoMultiplier ? `${ipoMultiplier}x` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
