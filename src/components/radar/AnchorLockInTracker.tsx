'use client';

import React, { useState, useEffect } from 'react';
import { AnchorLockInRecord } from '@/services/anchorLockInService';
import {
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  Building2,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';

export const AnchorLockInTracker: React.FC = () => {
  const [records, setRecords] = useState<AnchorLockInRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/ipos/anchor-lockin');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRecords(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch anchor lock-in data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const displayedRecords =
    selectedSymbol === 'ALL'
      ? records
      : records.filter((r) => r.symbol === selectedSymbol);

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900/90 border border-white/10 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-purple-400" />
              SEBI Statutory Regulatory Rule
            </span>
            <span className="text-[11px] text-slate-400">30-Day & 90-Day Anchor Release Window</span>
          </div>
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <span>Anchor Investor Lock-In Expiry Tracker</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            SEBI mandates 50% anchor shares unlock in 30 days and remaining 50% in 90 days. Monitor large supply overhangs that historically cause secondary listing volatility.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Tracked IPOs ({records.length})</option>
            {records.map((r) => (
              <option key={r.symbol} value={r.symbol}>
                {r.symbol} - {r.companyName.split(' ')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Lock-In Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedRecords.map((item) => {
            return (
              <div
                key={item.symbol}
                className="p-5 rounded-2xl glass-card border border-white/10 hover:border-white/20 transition flex flex-col justify-between space-y-4"
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{item.companyName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-cyan-300 border border-white/10">
                        {item.symbol}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                      <span>Listed: {item.listingDate}</span>
                      <span>•</span>
                      <span>Total Anchor: ₹{item.totalAnchorValueCr.toLocaleString('en-IN')} Cr</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                      item.supplyRiskLevel === 'HIGH'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : item.supplyRiskLevel === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {item.supplyRiskLevel === 'HIGH' || item.supplyRiskLevel === 'MEDIUM' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {item.supplyRiskLevel} Overhang Risk
                  </span>
                </div>

                {/* 30-Day and 90-Day Milestones */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs">
                  {/* 30-Day Window */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Unlock className="w-3 h-3 text-cyan-400" /> 30-Day (50%)
                      </span>
                      <span
                        className={`font-semibold text-[10px] uppercase ${
                          item.anchor30Day.status === 'EXPIRED' ? 'text-slate-500' : 'text-cyan-400'
                        }`}
                      >
                        {item.anchor30Day.status === 'EXPIRED' ? 'Absorbed' : `${item.anchor30Day.daysRemaining}d left`}
                      </span>
                    </div>
                    <div className="font-bold text-white text-xs">
                      ₹{item.anchor30Day.valueCr.toLocaleString('en-IN')} Cr
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {(item.anchor30Day.sharesUnlocked / 100000).toFixed(1)} Lakh shs ({item.anchor30Day.expiryDate})
                    </div>
                  </div>

                  {/* 90-Day Window */}
                  <div className="space-y-1 border-l border-white/10 pl-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-purple-400" /> 90-Day (50%)
                      </span>
                      <span
                        className={`font-semibold text-[10px] uppercase ${
                          item.anchor90Day.status === 'EXPIRED' ? 'text-slate-500' : 'text-purple-400'
                        }`}
                      >
                        {item.anchor90Day.status === 'EXPIRED' ? 'Absorbed' : `${item.anchor90Day.daysRemaining}d left`}
                      </span>
                    </div>
                    <div className="font-bold text-white text-xs">
                      ₹{item.anchor90Day.valueCr.toLocaleString('en-IN')} Cr
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {(item.anchor90Day.sharesUnlocked / 100000).toFixed(1)} Lakh shs ({item.anchor90Day.expiryDate})
                    </div>
                  </div>
                </div>

                {/* Marquee Anchors & Risk Notice */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Marquee Anchors:</span>
                    {item.marqueeAnchors.slice(0, 3).map((anchor, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                      >
                        {anchor}
                      </span>
                    ))}
                    {item.marqueeAnchors.length > 3 && (
                      <span className="text-[10px] text-slate-500">+{item.marqueeAnchors.length - 3} more</span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 italic">
                    &quot;{item.supplyRiskNotice}&quot;
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
