'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import {
  BarChart2,
  TrendingUp,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import { CandleData } from '@/types/ipo';

interface NseLiveChartProps {
  instrumentKey: string;
  symbol?: string;
  companyName?: string;
  initialPrice?: number;
  height?: number;
}

const TIMEFRAMES = [
  { label: '1D (Intraday)', value: '1D', interval: '1minute' },
  { label: '1W', value: '1W', interval: '30minute' },
  { label: '1M', value: '1M', interval: 'day' },
  { label: '1Y', value: '1Y', interval: 'day' },
];

export const NseLiveChart: React.FC<NseLiveChartProps> = ({
  instrumentKey,
  symbol,
  companyName,
  initialPrice,
  height = 420,
}) => {
  const displaySymbol = (symbol || instrumentKey || 'NSE').toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').replace(/^NSE_EQ\|/, '');
  const [selectedTf, setSelectedTf] = useState<string>('1D');
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 700, height });

  const containerRef = useRef<HTMLDivElement>(null);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: Math.max(containerRef.current.clientWidth, 320),
          height,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  // Fetch candles from /api/ipos/charts
  const fetchCandles = async (tfValue: string) => {
    setLoading(true);
    try {
      const tfObj = TIMEFRAMES.find((t) => t.value === tfValue) || TIMEFRAMES[0];
      const today = new Date().toISOString().split('T')[0];
      let fromDate: string;

      if (tfValue === '1D') {
        fromDate = today;
      } else if (tfValue === '1W') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromDate = d.toISOString().split('T')[0];
      } else if (tfValue === '1M') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDate = d.toISOString().split('T')[0];
      } else {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        fromDate = d.toISOString().split('T')[0];
      }

      const res = await fetch(
        `/api/ipos/charts?instrumentKey=${encodeURIComponent(instrumentKey)}&interval=${tfObj.interval}&from=${fromDate}&to=${today}`
      );
      const json = await res.json();

      if (json.success && Array.isArray(json.candles)) {
        setCandles(json.candles);
      }
    } catch (err) {
      console.error('Error fetching candles in NseLiveChart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles(selectedTf);
  }, [instrumentKey, selectedTf]);

  // Computed latest price and change
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const firstCandle = candles.length > 0 ? candles[0] : null;
  const currentPrice = latestCandle?.close || initialPrice || 100;
  const previousPrice = firstCandle?.open || currentPrice;
  const priceChange = Number((currentPrice - previousPrice).toFixed(2));
  const priceChangePct = previousPrice > 0 ? Number(((priceChange / previousPrice) * 100).toFixed(2)) : 0;
  const isPositive = priceChange >= 0;

  // Windowed candles for crisp SVG rendering (limit to 70 for 1D)
  const displayCandles = useMemo(() => {
    if (selectedTf === '1D' && candles.length > 70) {
      return candles.slice(-70);
    }
    return candles;
  }, [candles, selectedTf]);

  // Price scale
  const { minPrice, maxPrice, maxVolume, priceRange } = useMemo(() => {
    if (displayCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVolume: 1000, priceRange: 100 };
    }
    const lows = displayCandles.map((c) => c.low);
    const highs = displayCandles.map((c) => c.high);
    const volumes = displayCandles.map((c) => c.volume || 0);

    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const margin = Math.max((max - min) * 0.05, 0.5);
    const adjMin = Math.max(0, min - margin);
    const adjMax = max + margin;
    const maxVol = Math.max(...volumes, 1000);

    return {
      minPrice: adjMin,
      maxPrice: adjMax,
      maxVolume: maxVol,
      priceRange: adjMax - adjMin || 1,
    };
  }, [displayCandles]);

  // SVG layout metrics
  const paddingLeft = 12;
  const paddingRight = 65;
  const priceTop = 16;
  const priceHeight = dimensions.height - 140;
  const volTop = dimensions.height - 110;
  const volHeight = 65;
  const chartWidth = Math.max(dimensions.width - paddingLeft - paddingRight, 100);

  const candleCount = displayCandles.length;
  const barWidth = candleCount > 0 ? chartWidth / candleCount : 10;
  const bodyWidth = Math.max(2, Math.min(12, barWidth * 0.72));

  const getY = (val: number) => priceTop + ((maxPrice - val) / priceRange) * priceHeight;
  const getPriceAtY = (y: number) => maxPrice - ((y - priceTop) / priceHeight) * priceRange;

  const priceGridLevels = useMemo(() => {
    const steps = 4;
    const levels: { price: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const p = minPrice + (priceRange / steps) * i;
      levels.push({ price: p, y: getY(p) });
    }
    return levels;
  }, [minPrice, priceRange, maxPrice]);

  const activeCandle = hoverIndex !== null && displayCandles[hoverIndex] ? displayCandles[hoverIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= paddingLeft && x <= paddingLeft + chartWidth) {
      const idx = Math.min(
        candleCount - 1,
        Math.max(0, Math.floor((x - paddingLeft) / barWidth))
      );
      setHoverIndex(idx);
      setMousePos({ x, y });
    } else {
      setHoverIndex(null);
      setMousePos(null);
    }
  };

  return (
    <div className="space-y-3 w-full">
      {/* Header telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#080d1a] border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-white text-base">NSE:{displaySymbol}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Upstox API v2 Live
            </span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              ₹{currentPrice.toFixed(2)}
            </span>
            <div
              className={`flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                isPositive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>
                {isPositive ? '+' : ''}₹{priceChange.toFixed(2)} ({isPositive ? '+' : ''}
                {priceChangePct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Mode & Timeframe Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
            <button
              onClick={() => setChartMode('candle')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                chartMode === 'candle'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              <span>Candles</span>
            </button>
            <button
              onClick={() => setChartMode('line')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                chartMode === 'line'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Line</span>
            </button>
          </div>

          {/* Timeframe Pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTf(tf.value)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  selectedTf === tf.value
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchCandles(selectedTf)}
            disabled={loading}
            title="Refresh Candles"
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden bg-[#060a14] border border-white/10 p-3 sm:p-4 shadow-xl min-h-[360px] flex items-center justify-center"
      >
        {loading && candles.length === 0 ? (
          /* Loading Skeleton */
          <div className="w-full h-80 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <div className="space-y-1 text-center font-mono text-xs text-slate-400">
              <p>Connecting to Upstox API v2 / NSE Exchange Pipeline...</p>
              <p className="text-[10px] text-slate-500">Querying historical candlestick data for {displaySymbol}</p>
            </div>
          </div>
        ) : candles.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
            <span>No candlestick data returned for {displaySymbol}</span>
          </div>
        ) : chartMode === 'candle' ? (
          /* Real-Time SVG Candlestick View */
          <div className="relative w-full">
            {activeCandle && (
              <div className="absolute top-1 left-2 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/15 text-[11px] font-mono text-slate-300 shadow-xl pointer-events-none">
                <span className="text-white font-bold">{activeCandle.time}</span>
                <span>O: ₹{activeCandle.open}</span>
                <span className="text-emerald-400">H: ₹{activeCandle.high}</span>
                <span className="text-rose-400">L: ₹{activeCandle.low}</span>
                <span className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                  C: ₹{activeCandle.close}
                </span>
                <span className="text-cyan-300">Vol: {activeCandle.volume.toLocaleString('en-IN')}</span>
              </div>
            )}

            <svg
              width={dimensions.width}
              height={dimensions.height}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                setHoverIndex(null);
                setMousePos(null);
              }}
              className="overflow-visible block cursor-crosshair"
            >
              {/* Price Grid Lines */}
              {priceGridLevels.map((lvl, i) => (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={lvl.y}
                    x2={paddingLeft + chartWidth}
                    y2={lvl.y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft + chartWidth + 6}
                    y={lvl.y + 4}
                    fill="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    ₹{lvl.price.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Volume Baseline */}
              <line
                x1={paddingLeft}
                y1={volTop}
                x2={paddingLeft + chartWidth}
                y2={volTop}
                stroke="rgba(255,255,255,0.1)"
              />
              <text
                x={paddingLeft + chartWidth + 6}
                y={volTop + 14}
                fill="#475569"
                fontSize={9}
                fontFamily="monospace"
              >
                Vol
              </text>

              {/* Candles & Volume Bars */}
              {displayCandles.map((c, i) => {
                const centerX = paddingLeft + i * barWidth + barWidth / 2;
                const yHigh = getY(c.high);
                const yLow = getY(c.low);
                const yOpen = getY(c.open);
                const yClose = getY(c.close);

                const isUp = c.close >= c.open;
                const color = isUp ? '#10b981' : '#f43f5e';
                const bodyY = Math.min(yOpen, yClose);
                const bodyH = Math.max(1.8, Math.abs(yOpen - yClose));

                const volBarH = Math.max(1, (c.volume / maxVolume) * volHeight);
                const volBarY = volTop + volHeight - volBarH;

                return (
                  <g key={i}>
                    {/* Volume */}
                    <rect
                      x={centerX - bodyWidth / 2}
                      y={volBarY}
                      width={bodyWidth}
                      height={volBarH}
                      fill={color}
                      fillOpacity={0.35}
                      rx={1}
                    />
                    {/* Wick */}
                    <line
                      x1={centerX}
                      y1={yHigh}
                      x2={centerX}
                      y2={yLow}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                    {/* Body */}
                    <rect
                      x={centerX - bodyWidth / 2}
                      y={bodyY}
                      width={bodyWidth}
                      height={bodyH}
                      fill={color}
                      stroke={color}
                      strokeWidth={0.75}
                      rx={1}
                    />
                  </g>
                );
              })}

              {/* Time Labels */}
              {displayCandles.map((c, i) => {
                const step = Math.max(6, Math.floor(candleCount / 6));
                if (i % step !== 0 && i !== candleCount - 1) return null;
                const centerX = paddingLeft + i * barWidth + barWidth / 2;
                return (
                  <text
                    key={`time-${i}`}
                    x={centerX}
                    y={dimensions.height - 10}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {c.time}
                  </text>
                );
              })}

              {/* Hover Crosshair */}
              {mousePos && hoverIndex !== null && displayCandles[hoverIndex] && (
                <g pointerEvents="none">
                  <line
                    x1={paddingLeft + hoverIndex * barWidth + barWidth / 2}
                    y1={priceTop}
                    x2={paddingLeft + hoverIndex * barWidth + barWidth / 2}
                    y2={dimensions.height - 24}
                    stroke="rgba(255,255,255,0.4)"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={paddingLeft}
                    y1={mousePos.y}
                    x2={paddingLeft + chartWidth}
                    y2={mousePos.y}
                    stroke="rgba(255,255,255,0.3)"
                    strokeDasharray="3 3"
                  />
                  <rect
                    x={paddingLeft + chartWidth + 2}
                    y={mousePos.y - 8}
                    width={56}
                    height={16}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={1}
                    rx={2}
                  />
                  <text
                    x={paddingLeft + chartWidth + 30}
                    y={mousePos.y + 4}
                    fill="#38bdf8"
                    fontSize={10}
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ₹{getPriceAtY(mousePos.y).toFixed(1)}
                  </text>
                </g>
              )}
            </svg>
          </div>
        ) : (
          /* Area Line View */
          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={candles}>
                <defs>
                  <linearGradient id="nsePriceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
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
                      const c = payload[0].payload as CandleData;
                      return (
                        <div className="glass-panel p-2.5 rounded-xl border border-white/20 shadow-2xl text-xs space-y-1 font-mono bg-slate-950/90">
                          <p className="text-[10px] text-slate-400">{c.time}</p>
                          <p className="text-sm font-bold text-white">₹{c.close.toFixed(2)}</p>
                          <div className="text-[10px] text-slate-400 grid grid-cols-2 gap-x-2">
                            <span>Open: ₹{c.open}</span>
                            <span>High: ₹{c.high}</span>
                            <span>Low: ₹{c.low}</span>
                            <span>Vol: {c.volume.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={isPositive ? '#10b981' : '#f43f5e'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#nsePriceGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
