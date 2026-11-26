'use client';

import { type AllotmentTab, type FamilyCheckStatusItem, type FamilySummary, type RealTimeListedIpo } from '../allotmentTypes';
import { type FamilyPanProfile } from '@/types/pan';
import { type RegistrarInfo } from '@/types/allotment';
import { CheckCircle2, Clock, ExternalLink, RefreshCw, Users, XCircle, Zap } from 'lucide-react';

export interface FamilyRadarTabProps {
  activeIpo: RealTimeListedIpo;
  batchProgress: number;
  detectedRegistrar: RegistrarInfo;
  familyCheckStatuses: FamilyCheckStatusItem[];
  familyPans: FamilyPanProfile[];
  familySummary: FamilySummary;
  handleCopyPan: (panValue?: string) => void;
  handleRunBatchVerification: () => void | Promise<void>;
  isBatchChecking: boolean;
  setActiveTab: (tab: AllotmentTab) => void;
  setInputPan: (value: string) => void;
}

export function FamilyRadarTab({ activeIpo, batchProgress, detectedRegistrar, familyCheckStatuses, familyPans, familySummary, handleCopyPan, handleRunBatchVerification, isBatchChecking, setActiveTab, setInputPan }: FamilyRadarTabProps) {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Family Allotment Radar for {activeIpo.companyName}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Check all registered family accounts in parallel. Idempotent execution updates status and syncs allotted shares.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunBatchVerification}
            disabled={isBatchChecking || familyPans.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
          >
            {isBatchChecking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Verifying ({batchProgress}%)...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-slate-950" />
                <span>Run Batch Verification ({familyPans.length} PANs)</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {isBatchChecking && (
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
            <div
              className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-2 transition-all duration-300"
              style={{ width: `${batchProgress}%` }}
            />
          </div>
        )}

        {/* Consolidated Family Impact Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Family Accounts</span>
            <p className="text-base font-bold text-white">{familySummary.totalPans} Members</p>
            <span className="text-[10px] text-slate-500">Allotted: {familySummary.allottedCount}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Shares Allotted</span>
            <p className="text-base font-bold text-emerald-400 font-mono">{familySummary.totalShares} Shares</p>
            <span className="text-[10px] text-emerald-300/80">Value: ₹{familySummary.totalValue.toLocaleString('en-IN')}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Net Refund Expected</span>
            <p className="text-base font-bold text-amber-400 font-mono">₹{familySummary.totalRefund.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-slate-500">Non-allottees: {familySummary.notAllottedCount}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Path B Fallbacks</span>
            <p className="text-base font-bold text-purple-300">{familySummary.manualCount} Accounts</p>
            <span className="text-[10px] text-slate-500">Pending: {familySummary.pendingCount}</span>
          </div>
        </div>

        {/* Family Members Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {familyCheckStatuses.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">{item.name}</span>
                  <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                    {item.relationship}
                  </span>
                </div>
                <div className="text-[11px] text-cyan-300 font-mono">{item.panMasked}</div>
                {item.message && (
                  <p className="text-[10px] text-slate-400 line-clamp-1">{item.message}</p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {item.status === 'checking' && (
                  <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Checking...
                  </span>
                )}

                {item.status === 'allotted' && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Allotted ({item.sharesAllotted} shs)
                  </span>
                )}

                {item.status === 'not_allotted' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    Not Allotted
                  </span>
                )}

                {item.status === 'pending' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Pending
                  </span>
                )}

                {item.status === 'manual_verification' && (
                  <a
                    href={item.portalUrl || detectedRegistrar.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleCopyPan(item.pan)}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 hover:bg-purple-500/30 transition cursor-pointer"
                  >
                    <span>Check Portal</span>
                    <ExternalLink className="w-3 h-3 text-purple-400" />
                  </a>
                )}

                {item.status === 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputPan(item.pan);
                      setActiveTab('single');
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
                  >
                    Inspect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
