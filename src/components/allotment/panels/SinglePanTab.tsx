'use client';

import { type AllotmentCheckResult } from '@/lib/services/allotment/types';
import { type FamilyPanProfile } from '@/types/pan';
import { type RealTimeListedIpo } from '../allotmentTypes';
import { type RegistrarInfo } from '@/types/allotment';
import { AlertTriangle, ArrowRight, Building2, Check, CheckCheck, CheckCircle2, Clock, Copy, ExternalLink, Lock, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, XCircle, Zap } from 'lucide-react';
import { BSE_OFFICIAL_GATEWAY } from '@/lib/services/allotmentScanner';
import { isValidPan } from '@/lib/services/duplicateEnforcer';
import Link from 'next/link';

export interface SinglePanTabProps {
  activeIpo: RealTimeListedIpo;
  copiedPan: boolean;
  detectedRegistrar: RegistrarInfo;
  familyPans: FamilyPanProfile[];
  handleCopyPan: (panValue?: string) => void;
  handleFamilySelect: (panId: string) => void;
  handleSinglePanCheck: () => void | Promise<void>;
  inputPan: string;
  isSingleChecking: boolean;
  selectedFamilyId: string;
  setInputPan: (value: string) => void;
  singleError: string | null;
  singleResult: AllotmentCheckResult | null;
}

export function SinglePanTab({ activeIpo, copiedPan, detectedRegistrar, familyPans, handleCopyPan, handleFamilySelect, handleSinglePanCheck, inputPan, isSingleChecking, selectedFamilyId, setInputPan, singleError, singleResult }: SinglePanTabProps) {
  return (
    <div className="space-y-6">
      {/* Privacy Guarantee Pill */}
      <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-200/90 shadow-lg">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              Zero-Retention PAN Security (DPDP & SEBI Compliant)
            </span>
            <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              SHA-256 HASHED
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Permanent Account Numbers (PANs) are strictly processed in-memory for this single query. They are{' '}
            <strong>never logged, never stored as raw plaintext in Redis or PostgreSQL</strong>, and masked as{' '}
            <code className="text-cyan-300 font-mono">ABCDE****F</code> in all logs and client envelopes.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Verify Allotment for {activeIpo.companyName} ({activeIpo.symbol})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your 10-character PAN to execute Path A (Automated Gateway Query) with Path B (1-Click Fallback).
            </p>
          </div>

          {familyPans.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Autofill Profile:</span>
              <select
                value={selectedFamilyId}
                onChange={(e) => handleFamilySelect(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">Select saved profile...</option>
                {familyPans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relationship}) - {p.pan.substring(0, 5)}****{p.pan.slice(-1)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-8 space-y-1.5">
            <label htmlFor="pan-input" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Investor PAN Number:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {isValidPan(inputPan) ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Valid PAN format
                  </span>
                ) : (
                  'Format: ^[A-Z]{5}[0-9]{4}[A-Z]$ (e.g. ABCDE1234F)'
                )}
              </span>
            </label>
            <div className="relative">
              <input
                id="pan-input"
                type="text"
                maxLength={10}
                value={inputPan}
                onChange={(e) => setInputPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. ABCDE1234F"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 uppercase"
              />
              {inputPan && (
                <button
                  type="button"
                  onClick={() => handleCopyPan(inputPan)}
                  title="Copy PAN"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  {copiedPan ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSinglePanCheck}
              disabled={isSingleChecking || !inputPan.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
            >
              {isSingleChecking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Querying Gateway...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>Check Allotment Status</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {singleError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{singleError}</span>
          </div>
        )}
      </div>

      {/* Result Card: 4 Outcome States (Matching PDF Page 1 & Page 4) */}
      {singleResult && (
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
          {/* Slip Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Dual-Path Allotment Result
                </span>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {singleResult.sourceBadge || 'Gateway Normalized'}
                </span>
              </div>
              <h4 className="text-xl font-black text-white">
                {singleResult.companyName} ({singleResult.symbol})
              </h4>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Registrar: <strong className="text-slate-200">{singleResult.registrarName}</strong></span>
                <span>•</span>
                <span>Masked PAN: <strong className="text-cyan-300 font-mono">{singleResult.panMasked}</strong></span>
              </div>
            </div>

            {/* 4 Outcome Badges */}
            <div className="shrink-0">
              {singleResult.status === 'allotted' ? (
                <div className="px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 font-black text-sm shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
                  <span>ALLOTTED ({singleResult.sharesAllotted} SHARES)</span>
                </div>
              ) : singleResult.status === 'not_allotted' ? (
                <div className="px-5 py-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2 font-bold text-sm">
                  <XCircle className="w-5 h-5 text-rose-400" />
                  <span>NOT ALLOTTED (Non-Allottee)</span>
                </div>
              ) : singleResult.status === 'pending' ? (
                <div className="px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-2 font-bold text-sm">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span>ALLOTMENT PENDING</span>
                </div>
              ) : (
                <div className="px-5 py-2.5 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-purple-400" />
                  <span>PATH B: MANUAL CHECK REQUIRED</span>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Shares Allotted</span>
              <span className={`text-base font-black font-mono block ${singleResult.status === 'allotted' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {singleResult.sharesAllotted} Shares
              </span>
              <span className="text-[10px] text-slate-500 block">Applied: {singleResult.sharesApplied} Shares</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Allotment Value</span>
              <span className={`text-base font-black font-mono block ${singleResult.status === 'allotted' ? 'text-emerald-400' : 'text-slate-400'}`}>
                ₹{singleResult.allotmentValue.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 block">@ ₹{singleResult.bidPrice} per share</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Refund / Unblock</span>
              <span className={`text-base font-black font-mono block ${singleResult.refundAmount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                ₹{singleResult.refundAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 block">UPI / ASBA bank unfreeze</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Application No</span>
              <span className="text-xs font-bold font-mono text-cyan-300 block truncate">
                {singleResult.applicationNo || 'Direct Query'}
              </span>
              <span className="text-[10px] text-slate-500 block capitalize">{singleResult.category} Category</span>
            </div>
          </div>

          {/* State-Specific Action Modules (PDF Section 1 & Section 2.3) */}
          {singleResult.status === 'allotted' && (
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h5 className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Allotment Successfully Synced to Portfolio P&L
                </h5>
                <p className="text-xs text-slate-300">
                  {singleResult.sharesAllotted} shares of {singleResult.companyName} have been recorded in your P&L journal. Listing day gain tracking is live.
                </p>
              </div>
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition shrink-0"
              >
                <span>View in Portfolio</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
              </Link>
            </div>
          )}

          {singleResult.status === 'not_allotted' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h5 className="font-bold text-white text-sm">
                  Refund Unblock Timeline
                </h5>
                <p className="text-xs text-slate-400">
                  Your blocked capital of ₹{singleResult.refundAmount.toLocaleString('en-IN')} will be released by your bank within 24 to 48 hours via UPI mandate revocation.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-slate-300 font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5">
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Refund Alert Dispatched</span>
              </div>
            </div>
          )}

          {/* PATH B: Deterministic Deep-Link Fallback Module (First-Class Outcome) */}
          {(singleResult.status === 'unavailable' || singleResult.isOfficialGatewayRequired) && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-950 to-slate-950 border border-purple-500/30 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Path B Fallback Activated: Manual Verification Gateway</span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                      Deterministic Deep-Link
                    </span>
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {singleResult.explanation ||
                      'The registrar server is actively enforcing an interactive CAPTCHA or security gate. Path B has pre-copied your PAN and prepared the official registrar portal link.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-purple-500/20">
                <button
                  type="button"
                  onClick={() => handleCopyPan(inputPan)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
                >
                  {copiedPan ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPan ? 'PAN Copied to Clipboard!' : 'Copy PAN'}</span>
                </button>

                <a
                  href={singleResult.directPortalUrl || detectedRegistrar.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleCopyPan(inputPan)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition"
                >
                  <Building2 className="w-4 h-4 text-slate-950" />
                  <span>Open Official {singleResult.registrarName ? singleResult.registrarName.split(' ')[0] : 'Registrar'} Portal</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-950" />
                </a>

                <a
                  href={BSE_OFFICIAL_GATEWAY.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
                >
                  <span>Check on BSE Official Gateway</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
