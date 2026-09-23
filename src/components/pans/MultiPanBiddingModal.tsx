'use client';

import React, { useState, useEffect } from 'react';
import { FamilyPanProfile } from '@/types/pan';
import { maskPan } from '@/services/duplicateEnforcer';
import {
  X,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Users,
  CreditCard,
  Building2,
  ShieldCheck,
} from 'lucide-react';

interface MultiPanBiddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
  defaultCompanyName?: string;
  defaultPrice?: number;
  defaultLotSize?: number;
  onSuccess?: () => void;
}

export const MultiPanBiddingModal: React.FC<MultiPanBiddingModalProps> = ({
  isOpen,
  onClose,
  defaultSymbol = 'NSE',
  defaultCompanyName = 'National Stock Exchange of India Ltd',
  defaultPrice = 1785,
  defaultLotSize = 14,
  onSuccess,
}) => {
  const [profiles, setProfiles] = useState<FamilyPanProfile[]>([]);
  const [selectedPanIds, setSelectedPanIds] = useState<string[]>([]);
  const [symbol, setSymbol] = useState<string>(defaultSymbol);
  const [companyName, setCompanyName] = useState<string>(defaultCompanyName);
  const [price, setPrice] = useState<number>(defaultPrice);
  const [lotSize, setLotSize] = useState<number>(defaultLotSize);
  const [lots, setLots] = useState<number>(1);
  const [category, setCategory] = useState<'Retail' | 'sNII' | 'bNII'>('Retail');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSymbol) setSymbol(defaultSymbol);
    if (defaultCompanyName) setCompanyName(defaultCompanyName);
    if (defaultPrice) setPrice(defaultPrice);
    if (defaultLotSize) setLotSize(defaultLotSize);
  }, [defaultSymbol, defaultCompanyName, defaultPrice, defaultLotSize]);

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/pans')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setProfiles(json.data);
          // Default select all available profiles
          setSelectedPanIds(json.data.map((p: FamilyPanProfile) => p.id));
        }
      })
      .catch((e) => console.error(e));
  }, [isOpen]);

  if (!isOpen) return null;

  const sharesPerMember = lots * lotSize;
  const amountPerMember = sharesPerMember * price;
  const totalBlockedOutlay = amountPerMember * selectedPanIds.length;

  const togglePanSelection = (id: string) => {
    if (selectedPanIds.includes(id)) {
      setSelectedPanIds(selectedPanIds.filter((p) => p !== id));
    } else {
      setSelectedPanIds([...selectedPanIds, id]);
    }
  };

  const handleBatchSubmit = async () => {
    if (selectedPanIds.length === 0) {
      setError('Please select at least one family PAN profile.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    let createdCount = 0;
    const errors: string[] = [];

    for (const panId of selectedPanIds) {
      const profile = profiles.find((p) => p.id === panId);
      if (!profile) continue;

      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ipoSymbol: symbol,
            companyName,
            panId: profile.id,
            panNumber: profile.pan,
            holderName: profile.name,
            relationship: profile.relationship,
            category,
            lots,
            shares: sharesPerMember,
            bidPrice: price,
            blockedAmount: amountPerMember,
          }),
        });

        const json = await res.json();
        if (json.success) {
          createdCount++;
        } else {
          errors.push(json.error || `Failed for ${profile.name}`);
        }
      } catch (err: any) {
        errors.push(err.message || `Network error for ${profile.name}`);
      }
    }

    setLoading(false);

    if (errors.length > 0) {
      setError(errors.join(' | '));
    }

    if (createdCount > 0) {
      setSuccessMessage(
        `Successfully logged ${createdCount} IPO application(s) for ${symbol}. Total blocked outlay: ₹${(
          amountPerMember * createdCount
        ).toLocaleString('en-IN')}.`
      );
      if (onSuccess) onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0d1322] border border-white/10 p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {symbol}
              </span>
              <h3 className="text-base font-bold text-white">Multi-PAN Bidding & ASBA Planner</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">{companyName}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Bidding Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 p-4 rounded-xl bg-slate-950/60 border border-white/5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Bidding Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Retail">Retail (Max ₹2 Lakhs)</option>
              <option value="sNII">sNII (₹2L to ₹10L)</option>
              <option value="bNII">bNII (&gt; ₹10 Lakhs)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Lots per Account</label>
            <input
              type="number"
              min={1}
              max={100}
              value={lots}
              onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
            >
            </input>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Cut-Off Bid Price (₹)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Select Family Profiles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              Select Family Accounts ({selectedPanIds.length} of {profiles.length} selected)
            </span>
            <button
              onClick={() => {
                if (selectedPanIds.length === profiles.length) setSelectedPanIds([]);
                else setSelectedPanIds(profiles.map((p) => p.id));
              }}
              className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
            >
              {selectedPanIds.length === profiles.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {profiles.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/40 border border-white/5 text-center text-xs text-slate-400">
              No family PAN profiles added yet. Please add profiles in the Family PANs tab first.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {profiles.map((p) => {
                const isSelected = selectedPanIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePanSelection(p.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {p.relationship}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          PAN: {maskPan(p.pan)} • {p.broker}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-cyan-400 font-bold block">
                        ₹{amountPerMember.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {sharesPerMember} shares ({lots} lot)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outlay Summary Card */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-cyan-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Total Family ASBA Blocked Outlay</span>
            <span className="text-lg font-bold font-mono text-emerald-400 block mt-0.5">
              ₹{totalBlockedOutlay.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="text-right text-xs font-mono text-slate-400">
            <div>{selectedPanIds.length} Applications</div>
            <div className="text-slate-500">{sharesPerMember * selectedPanIds.length} Total Shares</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleBatchSubmit}
            disabled={loading || selectedPanIds.length === 0}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{loading ? 'Submitting & Auditing...' : 'Log Coordinated Bids'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
