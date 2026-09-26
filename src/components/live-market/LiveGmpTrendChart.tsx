'use client';

import React, { useState, useEffect } from 'react';
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
import { Flame, TrendingUp, Info, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { GmpTrendResponse } from '@/types/liveMarket';

interface LiveGmpTrendChartProps {
  symbol: string;
  companyName?: string;
  baseGmp?: number;
  issuePrice?: number;
}

const TIMEFRAMES = [
  { label: '1D', value: '1D' },
  { label: '7D', value: '7D' },
  { label: '1M', value: '1M' },
  { label: 'All', value: 'All' },
];

export const LiveGmpTrendChart: React.FC<LiveGmpTrendChartProps> = ({
  symbol,
  companyName = symbol,
  baseGmp = 75,
  issuePrice = 450,
}) => {
  const [timeframe, setTimeframe] = useState<'1D' | '7D' | '1M' | 'All'>('7D');
  const [data, setData] = useState<GmpTrendResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<{ gmp: number; date: string } | null>(null);

  const fetchGmpTrend = async (tf: '1D' | '7D' | '1M' | 'All') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ipos/${encodeURIComponent(symbol)}/gmp/history?timeframe=${tf}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (e) {
      console.error('Failed to load GMP history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGmpTrend(timeframe);
  }, [symbol, timeframe]);

  const isGmpPositive = (data?.gmpChange ?? 0) >= 0;
  const currentGmp = hoveredPoint ? hoveredPoint.gmp : data?.currentGmp ?? baseGmp;
  const estListingPrice = issuePrice + currentGmp;
  const estGainPercent = issuePrice > 0 ? Number(((currentGmp / issuePrice) * 100).toFixed(1)) : 0;

  const points = data?.points || [];
  const gmpValues = points.map((p) => p.gmp);
  const minGmp = gmpValues.length > 0 ? Math.floor(Math.min(...gmpValues) * 0.9) : 0;
  const maxGmp = gmpValues.length > 0 ? Math.ceil(Math.max(...gmpValues) * 1.1) : 100;

  return (
    <div className="space-y-4">
      {/* Top Header & Timeframe Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold text-white">Grey Market Premium (GMP) Live Trend</h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
              Unofficial Indicator
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time Grey Market bid expectations before secondary exchange listing.
          </p>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 self-start sm:self-auto text-xs">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value as any)}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                timeframe === tf.value
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Highlight Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <span className="text-[11px] text-slate-400 font-medium block">Current GMP</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg font-mono font-extrabold text-purple-300">
              +₹{currentGmp}
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              (+{estGainPercent}%)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Est. Listing: ₹{estListingPrice}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <span className="text-[11px] text-slate-400 font-medium block">Timeframe Change</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-lg font-mono font-extrabold ${isGmpPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isGmpPositive ? '+' : ''}₹{data?.gmpChange ?? 0}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Over selected {timeframe}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <span className="text-[11px] text-slate-400 font-medium block">Highest GMP ({timeframe})</span>
          <span className="text-lg font-mono font-extrabold text-white mt-0.5 block">
            ₹{data?.highestGmp ?? baseGmp}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Peak demand point</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <span className="text-[11px] text-slate-400 font-medium block">Lowest GMP ({timeframe})</span>
          <span className="text-lg font-mono font-extrabold text-white mt-0.5 block">
            ₹{data?.lowestGmp ?? baseGmp}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Base support level</span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full p-2 rounded-2xl bg-[#060a14] border border-white/10">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Loading GMP historical timeline...</span>
          </div>
        ) : points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No GMP trend points recorded yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              onMouseMove={(e: any) => {
                if (e?.activePayload && e.activePayload.length > 0) {
                  const p = e.activePayload[0].payload;
                  setHoveredPoint({ gmp: p.gmp, date: p.date });
                }
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="gmpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                domain={[minGmp, maxGmp]}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v}`}
                orientation="right"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="glass-panel p-2.5 rounded-xl border border-purple-500/30 shadow-2xl text-xs space-y-1">
                        <p className="text-[10px] text-slate-400 font-mono">{d.date} {d.time || ''}</p>
                        <p className="text-sm font-mono font-bold text-purple-300">GMP: +₹{d.gmp}</p>
                        {d.estimatedListingPrice && (
                          <p className="text-[10px] text-slate-300 font-mono">
                            Est. Listing: ₹{d.estimatedListingPrice} ({d.gmpPercent}%)
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="gmp"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#gmpGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mandatory SEBI / Legal Disclaimer Banner */}
      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25 flex items-start gap-2.5 text-xs text-purple-300/90 leading-relaxed">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">Official Disclosure:</strong>
          {data?.disclaimer ||
            'Grey Market Premium (GMP) is an unofficial, unregulated market indicator. It does NOT represent an official exchange price or a guaranteed listing price.'}
        </div>
      </div>
    </div>
  );
};
