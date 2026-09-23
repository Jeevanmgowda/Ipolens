'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { IpoGraphPoint } from '@/types/ipo';
import { TrendingUp, Layers } from 'lucide-react';

interface LiveBiddingChartProps {
  graphData: IpoGraphPoint[];
  symbol: string;
  totalBidsReceived?: string;
  biddingDetails?: Record<string, string>;
}

export const LiveBiddingChart: React.FC<LiveBiddingChartProps> = ({
  graphData,
  symbol,
  totalBidsReceived,
  biddingDetails = {},
}) => {
  if (!graphData || graphData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-white/5 rounded-xl text-center">
        <Layers className="w-8 h-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-300 font-medium">No price band bidding curve published yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          NSE live bidding distribution graph is populated once active bidding orders are registered across price points for {symbol}.
        </p>
      </div>
    );
  }

  // Format data for Recharts, highlighting the upper band and Cut-off
  const data = graphData.map((item) => {
    const isCutOff = item.type.toLowerCase().includes('cut');
    return {
      name: isCutOff ? 'Cut-Off' : `₹${item.type}`,
      value: parseFloat(item.value) || 0,
      rawType: item.type,
      sharesCount: biddingDetails[item.type] || 'N/A',
      isCutOff,
    };
  });

  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">Live Bidding Demand Curve (NSE Order Book)</h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Share demand distribution across price band points and non-competitive Cut-Off bids
          </p>
        </div>

        {totalBidsReceived && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Bids Received</span>
            <span className="font-mono text-xs font-bold text-cyan-400">
              {Number(totalBidsReceived).toLocaleString('en-IN')} shares
            </span>
          </div>
        )}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="p-3 bg-slate-950 border border-cyan-500/40 rounded-lg shadow-xl text-xs font-sans">
                      <div className="font-bold text-white mb-1 flex items-center justify-between gap-3">
                        <span>{d.isCutOff ? 'Cut-Off Price' : `Bid Price: ${d.name}`}</span>
                        <span className="text-cyan-400">{d.value.toFixed(2)}% of book</span>
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono">
                        Cumulative Shares: <span className="text-slate-200">{d.sharesCount}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isCutOff ? '#10b981' : entry.value > 10 ? '#06b6d4' : '#3b82f6'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
          <span>Price Band Bids</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" />
          <span>High Demand Cluster</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
          <span>Retail Cut-Off Bids</span>
        </div>
      </div>
    </div>
  );
};
