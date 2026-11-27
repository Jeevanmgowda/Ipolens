'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Layers,
  Activity,
  BarChart2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Cpu,
  Compass,
} from 'lucide-react';
import { AiStockPrediction } from '@/types/ai-prediction';

interface AiStockPredictionPanelProps {
  prediction: AiStockPrediction | null;
  loading: boolean;
  onRefresh: () => void;
  showOverlayLines?: boolean;
  onToggleOverlayLines?: () => void;
}

export const AiStockPredictionPanel: React.FC<AiStockPredictionPanelProps> = ({
  prediction,
  loading,
  onRefresh,
  showOverlayLines = true,
  onToggleOverlayLines,
}) => {
  const [showDeepAnalysis, setShowDeepAnalysis] = useState<boolean>(false);

  if (loading && !prediction) {
    return (
      <div className="w-full rounded-2xl bg-[#080d1a] border border-cyan-500/20 p-6 flex flex-col items-center justify-center gap-3.5 shadow-2xl animate-pulse">
        <div className="flex items-center gap-2 text-cyan-400">
          <Sparkles className="w-5 h-5 animate-spin" />
          <span className="font-mono text-sm font-bold tracking-wide">
            Synthesizing AI Trading Prediction Model...
          </span>
        </div>
        <p className="text-xs text-slate-400 font-mono text-center max-w-md">
          Calculating RSI(14), MACD, EMAs, dynamic Fibonacci pivots, and querying Google Gemini 2.5 Flash technical engine...
        </p>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="w-full rounded-2xl bg-[#080d1a] border border-white/10 p-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">AI Stock Trading & Prediction Engine</h4>
            <p className="text-xs text-slate-400">Generate high-precision trade setups, entry targets, and stop-loss levels</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Analyze with AI</span>
        </button>
      </div>
    );
  }

  const {
    signal,
    convictionScore,
    actionSummary,
    technicalTelemetry,
    tradeSetup,
    institutionalAnalysis,
    engineModel,
  } = prediction;

  const isBuy = signal === 'BUY' || signal === 'STRONG BUY';
  const isSell = signal === 'SELL / AVOID' || signal === 'TRIM / TAKE PROFIT';

  const signalBadgeColor =
    signal === 'STRONG BUY'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/15'
      : signal === 'BUY'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10'
      : signal === 'HOLD / ACCUMULATE'
      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 shadow-cyan-500/10'
      : signal === 'TRIM / TAKE PROFIT'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-amber-500/10'
      : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-500/15';

  return (
    <div className="w-full rounded-2xl bg-[#070b16] border border-cyan-500/30 p-4 sm:p-5 shadow-2xl space-y-4">
      {/* Top Bar: Engine Status & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>{engineModel}</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-xs font-mono font-medium">
            <Compass className="w-3.5 h-3.5" />
            <span>{tradeSetup.recommendedHorizon}</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pattern: {technicalTelemetry.detectedPattern}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleOverlayLines && (
            <button
              onClick={onToggleOverlayLines}
              title={showOverlayLines ? 'Hide Target & SL lines on chart' : 'Show Target & SL lines on chart'}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 border ${
                showOverlayLines
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {showOverlayLines ? <Eye className="w-3 h-3 text-cyan-400" /> : <EyeOff className="w-3 h-3" />}
              <span>{showOverlayLines ? 'Chart Levels: ON' : 'Chart Levels: OFF'}</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Recalculate AI Trading Forecast"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Hero Signal & Conviction Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        <div className="md:col-span-8 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#0c1427] to-[#0a1020] border border-white/10 flex flex-col justify-between gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold border shadow-lg flex items-center gap-1.5 tracking-wide ${signalBadgeColor}`}
              >
                {isBuy ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : isSell ? (
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                )}
                <span>{signal}</span>
              </span>

              <span className="text-xs text-slate-400 font-mono">
                Entry Range: <strong className="text-white">₹{tradeSetup.entryRange.low} - ₹{tradeSetup.entryRange.high}</strong>
              </span>
            </div>

            {/* Conviction Gauge */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10">
              <span className="text-[11px] text-slate-400 font-mono">Conviction:</span>
              <span className="text-xs font-bold font-mono text-cyan-300">{convictionScore}%</span>
              <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
                  style={{ width: `${convictionScore}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-sans font-medium">
            {actionSummary}
          </p>
        </div>

        {/* Risk-to-Reward & Invalidation Card */}
        <div className="md:col-span-4 p-3.5 rounded-xl bg-[#0c1427] border border-white/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Risk / Reward</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
              {tradeSetup.riskRewardRatio}
            </span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span>Trigger Point:</span>
              <span className="text-slate-200 text-[11px] max-w-[170px] truncate text-right">
                ₹{tradeSetup.entryRange.high}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Structural Floor:</span>
              <span className="text-rose-400 text-xs font-bold">₹{tradeSetup.stopLoss}</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Defined Risk Setup</span>
          </div>
        </div>
      </div>

      {/* Target & Stop Loss Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Entry */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Entry Zone</span>
            <Target className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-base sm:text-lg font-mono font-bold text-white">
            ₹{tradeSetup.entryRange.low}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">Up to ₹{tradeSetup.entryRange.high}</p>
        </div>

        {/* Target 1 */}
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-mono">
            <span>Target 1 (T1)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20">
              +{tradeSetup.target1GainPct}%
            </span>
          </div>
          <p className="text-base sm:text-lg font-mono font-bold text-emerald-400">
            ₹{tradeSetup.target1.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">Conservative Profit</p>
        </div>

        {/* Target 2 */}
        <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-cyan-400 font-mono">
            <span>Target 2 (T2)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20">
              +{tradeSetup.target2GainPct}%
            </span>
          </div>
          <p className="text-base sm:text-lg font-mono font-bold text-cyan-300">
            ₹{tradeSetup.target2.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">Breakout Extension</p>
        </div>

        {/* Stop Loss */}
        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-rose-400 font-mono">
            <span>Stop-Loss (SL)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20">
              {tradeSetup.stopLossRiskPct}%
            </span>
          </div>
          <p className="text-base sm:text-lg font-mono font-bold text-rose-400">
            ₹{tradeSetup.stopLoss.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">Capital Protection</p>
        </div>
      </div>

      {/* Technical Indicators Telemetry Bar */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-slate-300 font-bold">
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            Quantitative Indicators Telemetry
          </span>
          <span>Timeframe: {tradeSetup.timeframe}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {/* RSI */}
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>RSI (14)</span>
              <span
                className={`font-bold ${
                  technicalTelemetry.rsiCondition === 'Oversold'
                    ? 'text-emerald-400'
                    : technicalTelemetry.rsiCondition === 'Overbought'
                    ? 'text-rose-400'
                    : 'text-cyan-400'
                }`}
              >
                {technicalTelemetry.rsiCondition}
              </span>
            </div>
            <p className="text-sm font-bold text-white">{technicalTelemetry.rsi14}</p>
          </div>

          {/* MACD */}
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>MACD</span>
              <span
                className={`font-bold ${
                  technicalTelemetry.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {technicalTelemetry.macd.histogram >= 0 ? '+' : ''}
                {technicalTelemetry.macd.histogram}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-200 truncate">
              {technicalTelemetry.macd.trend}
            </p>
          </div>

          {/* EMA Stack */}
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>EMA Trend</span>
              <span className="text-slate-300">9/21/50</span>
            </div>
            <p
              className={`text-xs font-semibold truncate ${
                technicalTelemetry.emaStructure.alignment === 'Bullish Stack'
                  ? 'text-emerald-400'
                  : technicalTelemetry.emaStructure.alignment === 'Bearish Stack'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {technicalTelemetry.emaStructure.alignment}
            </p>
          </div>

          {/* Volume */}
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Volume Spike</span>
              <span className="text-cyan-400 font-bold">{technicalTelemetry.volumeRatio}x Avg</span>
            </div>
            <p className="text-xs font-semibold text-slate-200 truncate">
              {technicalTelemetry.volumeTrend}
            </p>
          </div>
        </div>

        {/* Dynamic Horizontal Pivots */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-slate-400">
          <span className="text-slate-500">Key Levels:</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            S1: ₹{technicalTelemetry.supportLevels[0]}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
            Pivot: ₹{technicalTelemetry.pivotPoint}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            R1: ₹{technicalTelemetry.resistanceLevels[0]}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            R2: ₹{technicalTelemetry.resistanceLevels[1]}
          </span>
        </div>
      </div>

      {/* Execution Playbook (Trigger & Risk Note) */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-cyan-300 font-bold font-mono">
          <Target className="w-3.5 h-3.5" />
          <span>Institutional Trade Execution Playbook</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              Trigger Condition
            </span>
            <p className="text-slate-200 leading-snug">{tradeSetup.triggerCondition}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              Risk Management & Trailing Rule
            </span>
            <p className="text-slate-200 leading-snug">{tradeSetup.riskManagementNote}</p>
          </div>
        </div>
      </div>

      {/* Expandable Institutional Deep Dive */}
      <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-900/40">
        <button
          onClick={() => setShowDeepAnalysis(!showDeepAnalysis)}
          className="w-full p-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Deep Institutional Forensic Commentary & Confluence Breakdown</span>
          </div>
          {showDeepAnalysis ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showDeepAnalysis && (
          <div className="p-4 border-t border-white/10 space-y-3.5 text-xs bg-black/40">
            <div className="space-y-1">
              <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Market Structure & Price Action
              </span>
              <p className="text-slate-300 leading-relaxed font-sans">
                {institutionalAnalysis.priceActionNarrative}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Key Confluence Factors
                </span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {institutionalAnalysis.confluenceFactors.map((factor, idx) => (
                    <li key={idx} className="leading-snug">{factor}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="font-mono text-[11px] text-rose-400 uppercase tracking-wider font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Risk & Invalidation Factors
                </span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  {institutionalAnalysis.riskFactors.map((risk, idx) => (
                    <li key={idx} className="leading-snug">{risk}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200">
              <span className="font-mono font-bold text-[10px] uppercase tracking-wider block mb-0.5">
                Institutional Verdict:
              </span>
              <p className="leading-relaxed">{institutionalAnalysis.institutionalVerdict}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legal & Educational Disclaimer */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
        <span>Quantitative AI Forecast • Updated in Real-Time</span>
        <span>For educational & analytical research only • Not SEBI investment advice</span>
      </div>
    </div>
  );
};
