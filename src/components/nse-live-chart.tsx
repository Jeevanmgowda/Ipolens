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
  Sparkles,
  Activity,
} from 'lucide-react';
import { CandleData } from '@/types/ipo';
import { TradingViewChart } from './radar/TradingViewChart';
import { AiStockPrediction } from '@/types/ai-prediction';
import { AiStockPredictionPanel } from './charts/AiStockPredictionPanel';

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
  const initialDisplaySymbol = (symbol || instrumentKey || 'NSE').toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').replace(/^NSE_EQ\|/, '');
  const [activeInstrumentKey, setActiveInstrumentKey] = useState<string>(instrumentKey);
  const [activeDisplaySymbol, setActiveDisplaySymbol] = useState<string>(initialDisplaySymbol);
  const displaySymbol = activeDisplaySymbol;
  const [selectedTf, setSelectedTf] = useState<string>('1D');
  const [chartMode, setChartMode] = useState<'candle' | 'line' | 'tradingview'>('candle');
  const [candles, setCandles] = useState<CandleData[]>([]);

  useEffect(() => {
    setActiveInstrumentKey(instrumentKey);
    setActiveDisplaySymbol(
      (symbol || instrumentKey || 'NSE').toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').replace(/^NSE_EQ\|/, '')
    );
  }, [instrumentKey, symbol]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 700, height });

  // AI Stock Trading & Prediction state
  const [showAiPrediction, setShowAiPrediction] = useState<boolean>(true);
  const [aiPrediction, setAiPrediction] = useState<AiStockPrediction | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [showOverlayLines, setShowOverlayLines] = useState<boolean>(true);

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

  // Fetch AI Trading Prediction
  const fetchAiPrediction = async (currentCandles: CandleData[] = candles, force: boolean = false) => {
    if (currentCandles.length === 0 && !force) return;
    setAiLoading(true);
    try {
      const latestPrice = currentCandles.length > 0 ? currentCandles[currentCandles.length - 1].close : initialPrice || 100;
      const res = await fetch('/api/market/ai-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: displaySymbol,
          companyName: companyName || displaySymbol,
          timeframe: selectedTf,
          currentPrice: latestPrice,
          candles: currentCandles,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAiPrediction(json.data);
      }
    } catch (err) {
      console.error('Error fetching AI prediction in NseLiveChart:', err);
    } finally {
      setAiLoading(false);
    }
  };

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
        `/api/ipos/charts?instrumentKey=${encodeURIComponent(activeInstrumentKey)}&interval=${tfObj.interval}&from=${fromDate}&to=${today}`
      );
      const json = await res.json();

      if (json.success && Array.isArray(json.candles)) {
        setCandles(json.candles);
        fetchAiPrediction(json.candles);
      }
    } catch (err) {
      console.error('Error fetching candles in NseLiveChart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles(selectedTf);
  }, [activeInstrumentKey, selectedTf]);

  // Computed latest price and change
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const firstCandle = candles.length > 0 ? candles[0] : null;
  const currentPrice = latestCandle?.close || initialPrice || 100;
  const previousPrice = firstCandle?.open || currentPrice;
  const priceChange = Number((currentPrice - previousPrice).toFixed(2));
  const priceChangePct = previousPrice > 0 ? Number(((priceChange / previousPrice) * 100).toFixed(2)) : 0;
  const isPositive = priceChange >= 0;

  // Windowed candles for crisp SVG rendering (limit to 55 for 1D for bold readable candles)
  const displayCandles = useMemo(() => {
    if (selectedTf === '1D' && candles.length > 55) {
      return candles.slice(-55);
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
    const rawSpan = Math.max(max - min, 0.5);
    // Dynamic padding ensures candles have breathing room but are never squished flat
    const pad = Math.max(rawSpan * 0.16, 0.4);
    const adjMin = Math.max(0, min - pad);
    const adjMax = max + pad;
    const maxVol = Math.max(...volumes, 1000);

    return {
      minPrice: adjMin,
      maxPrice: adjMax,
      maxVolume: maxVol,
      priceRange: adjMax - adjMin || 1,
    };
  }, [displayCandles]);

  // SVG layout metrics
  const paddingLeft = 14;
  const paddingRight = 75; // Ample room for right-side price axis and AI level badges
  const priceTop = 20;
  const priceHeight = dimensions.height - 145;
  const volTop = dimensions.height - 105;
  const volHeight = 60;
  const chartWidth = Math.max(dimensions.width - paddingLeft - paddingRight, 100);

  const candleCount = displayCandles.length;
  const barWidth = candleCount > 0 ? chartWidth / candleCount : 10;
  const bodyWidth = Math.max(4, Math.min(14, barWidth * 0.72));

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
      {/* Header telemetry & controls */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[#080d1a] border border-white/10 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-bold text-white text-base">NSE:{displaySymbol}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live NSE Exchange Feed
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

          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
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
            <button
              onClick={() => setChartMode('tradingview')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                chartMode === 'tradingview'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>TradingView Live</span>
            </button>
            <button
              onClick={() => setShowAiPrediction(!showAiPrediction)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                showAiPrediction
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-purple-500/25 border border-purple-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-cyan-200 animate-pulse" />
              <span>AI Predictor</span>
            </button>
          </div>
        </div>

        {/* Sub-strip: Timeframe Pills & Refresh */}
        {chartMode !== 'tradingview' && (
          <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-white/5">
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
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden bg-[#060a14] border border-white/10 p-3 sm:p-4 shadow-xl min-h-[360px] flex items-center justify-center"
      >
        {chartMode === 'tradingview' ? (
          <div className="w-full h-full min-h-[420px]">
            <TradingViewChart symbol={displaySymbol} height={dimensions.height || 420} />
          </div>
        ) : loading && candles.length === 0 ? (
          /* Loading Skeleton */
          <div className="w-full h-80 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <div className="space-y-1 text-center font-mono text-xs text-slate-400">
              <p>Connecting to Live NSE Exchange Data Pipeline...</p>
              <p className="text-[10px] text-slate-500">Querying real historical candlestick data for {displaySymbol}</p>
            </div>
          </div>
        ) : candles.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center px-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-semibold text-white">
                Exchange candlesticks unavailable for {displaySymbol}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {`${displaySymbol} is not yet listed on NSE/BSE or has no published exchange candles for this timeframe.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setChartMode('tradingview')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Switch to TradingView Live
              </button>
              <button
                type="button"
                onClick={() => fetchCandles(selectedTf)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Retry
              </button>
            </div>
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

              {/* AI Prediction Target & Stop-Loss Overlay Reference Lines */}
              {showOverlayLines && aiPrediction && (
                <g pointerEvents="none">
                  {/* Target 2 (Breakout) */}
                  {aiPrediction.tradeSetup.target2 >= minPrice && aiPrediction.tradeSetup.target2 <= maxPrice && (
                    <g>
                      <line
                        x1={paddingLeft}
                        y1={getY(aiPrediction.tradeSetup.target2)}
                        x2={paddingLeft + chartWidth}
                        y2={getY(aiPrediction.tradeSetup.target2)}
                        stroke="#06b6d4"
                        strokeWidth={1.2}
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                      />
                      <rect
                        x={paddingLeft + chartWidth + 4}
                        y={getY(aiPrediction.tradeSetup.target2) - 8}
                        width={68}
                        height={16}
                        fill="#083344"
                        rx={3}
                        stroke="#06b6d4"
                        strokeWidth={0.75}
                      />
                      <text
                        x={paddingLeft + chartWidth + 38}
                        y={getY(aiPrediction.tradeSetup.target2) + 4}
                        fill="#cffafe"
                        fontSize={8.5}
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        T2: ₹{aiPrediction.tradeSetup.target2.toFixed(1)}
                      </text>
                    </g>
                  )}

                  {/* Target 1 (Conservative) */}
                  {aiPrediction.tradeSetup.target1 >= minPrice && aiPrediction.tradeSetup.target1 <= maxPrice && (
                    <g>
                      <line
                        x1={paddingLeft}
                        y1={getY(aiPrediction.tradeSetup.target1)}
                        x2={paddingLeft + chartWidth}
                        y2={getY(aiPrediction.tradeSetup.target1)}
                        stroke="#10b981"
                        strokeWidth={1.2}
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                      />
                      <rect
                        x={paddingLeft + chartWidth + 4}
                        y={getY(aiPrediction.tradeSetup.target1) - 8}
                        width={68}
                        height={16}
                        fill="#064e3b"
                        rx={3}
                        stroke="#10b981"
                        strokeWidth={0.75}
                      />
                      <text
                        x={paddingLeft + chartWidth + 38}
                        y={getY(aiPrediction.tradeSetup.target1) + 4}
                        fill="#a7f3d0"
                        fontSize={8.5}
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        T1: ₹{aiPrediction.tradeSetup.target1.toFixed(1)}
                      </text>
                    </g>
                  )}

                  {/* Stop Loss (SL) */}
                  {aiPrediction.tradeSetup.stopLoss >= minPrice && aiPrediction.tradeSetup.stopLoss <= maxPrice && (
                    <g>
                      <line
                        x1={paddingLeft}
                        y1={getY(aiPrediction.tradeSetup.stopLoss)}
                        x2={paddingLeft + chartWidth}
                        y2={getY(aiPrediction.tradeSetup.stopLoss)}
                        stroke="#f43f5e"
                        strokeWidth={1.2}
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                      />
                      <rect
                        x={paddingLeft + chartWidth + 4}
                        y={getY(aiPrediction.tradeSetup.stopLoss) - 8}
                        width={68}
                        height={16}
                        fill="#881337"
                        rx={3}
                        stroke="#f43f5e"
                        strokeWidth={0.75}
                      />
                      <text
                        x={paddingLeft + chartWidth + 38}
                        y={getY(aiPrediction.tradeSetup.stopLoss) + 4}
                        fill="#fecdd3"
                        fontSize={8.5}
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        SL: ₹{aiPrediction.tradeSetup.stopLoss.toFixed(1)}
                      </text>
                    </g>
                  )}
                </g>
              )}

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
                const bodyH = Math.max(3.5, Math.abs(yOpen - yClose));
                const wickTop = Math.min(yHigh, yLow);
                const wickBottom = Math.max(yHigh, yLow);

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
                      y1={wickTop}
                      x2={centerX}
                      y2={Math.max(wickBottom, wickTop + 4)}
                      stroke={color}
                      strokeWidth={1.8}
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
                      strokeWidth={1}
                      rx={1.5}
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
                {/* AI Prediction Target & Stop-Loss Reference Lines for Area View */}
                {showOverlayLines && aiPrediction && (
                  <>
                    <ReferenceLine
                      y={aiPrediction.tradeSetup.target2}
                      stroke="#06b6d4"
                      strokeDasharray="4 4"
                      label={{
                        value: `T2: ₹${aiPrediction.tradeSetup.target2}`,
                        fill: '#06b6d4',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                    <ReferenceLine
                      y={aiPrediction.tradeSetup.target1}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: `T1: ₹${aiPrediction.tradeSetup.target1}`,
                        fill: '#10b981',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                    <ReferenceLine
                      y={aiPrediction.tradeSetup.stopLoss}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: `SL: ₹${aiPrediction.tradeSetup.stopLoss}`,
                        fill: '#f43f5e',
                        fontSize: 10,
                        position: 'insideBottomRight',
                      }}
                    />
                  </>
                )}
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

      {/* AI Stock Trading & Prediction Model Panel */}
      {showAiPrediction && (
        <AiStockPredictionPanel
          prediction={aiPrediction}
          loading={aiLoading}
          onRefresh={() => fetchAiPrediction(candles, true)}
          showOverlayLines={showOverlayLines}
          onToggleOverlayLines={() => setShowOverlayLines(!showOverlayLines)}
        />
      )}
    </div>
  );
};
