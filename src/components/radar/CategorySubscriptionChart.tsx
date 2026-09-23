'use client';

import React from 'react';
import { BidCategoryDetail } from '@/types/ipo';
import { Users, CheckCircle2, ShieldAlert } from 'lucide-react';

interface CategorySubscriptionChartProps {
  bidDetails: BidCategoryDetail[];
  overallMultiple?: string;
}

export const CategorySubscriptionChart: React.FC<CategorySubscriptionChartProps> = ({
  bidDetails,
  overallMultiple = '0.00',
}) => {
  if (!bidDetails || bidDetails.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-slate-900/50 border border-white/5 text-center text-slate-400 text-xs">
        Detailed category-wise bidding data not yet reported by exchange.
      </div>
    );
  }

  // Extract core categories
  const qib = bidDetails.find((b) => b.category.toLowerCase().includes('qualified') || b.category.toLowerCase().includes('qib'));
  const nii = bidDetails.find((b) => b.category.toLowerCase().includes('non institutional') || b.category.toLowerCase().includes('nii'));
  const rii = bidDetails.find((b) => b.category.toLowerCase().includes('retail') || b.category.toLowerCase().includes('rii'));
  const total = bidDetails.find((b) => b.category.toLowerCase().includes('total'));

  const categories = [
    {
      label: 'QIB (Institutions)',
      detail: qib,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    },
    {
      label: 'NII / HNI (High Networth)',
      detail: nii,
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      label: 'Retail (RII Individual)',
      detail: rii,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    },
    {
      label: 'Total Issue Subscription',
      detail: total,
      color: 'bg-amber-400',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/30',
    },
  ];

  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Live Category Subscription Telemetry
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">Real-time demand multiple per investor classification</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-xs text-slate-300 font-medium">Overall Book:</span>
          <span className="text-sm font-bold font-mono text-amber-400">
            {overallMultiple}x
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((cat, idx) => {
          const times = cat.detail ? parseFloat(cat.detail.noOfTime) || 0 : 0;
          const offered = cat.detail ? Number(cat.detail.noOfSharesOffered || 0) : 0;
          const bid = cat.detail ? Number(cat.detail.noOfsharesBid || 0) : 0;
          const progressPercent = Math.min(100, Math.round(times * 100));
          const isOverSubscribed = times >= 1.0;

          return (
            <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                  <span className="font-medium text-slate-200">{cat.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  {isOverSubscribed ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Fully Subscribed
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">In Progress</span>
                  )}
                  <span className={`text-sm font-bold ${cat.textColor}`}>
                    {times.toFixed(2)}x
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${cat.color} transition-all duration-700 ease-out`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Sub-metrics */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Offered: {offered > 0 ? offered.toLocaleString('en-IN') : 'N/A'}</span>
                <span>Bids Placed: {bid > 0 ? bid.toLocaleString('en-IN') : 'N/A'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
