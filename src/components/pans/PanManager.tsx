'use client';

import React, { useState, useEffect } from 'react';
import { FamilyPanProfile, PanRelationship } from '@/types/pan';
import { maskPan, isValidPan } from '@/services/duplicateEnforcer';
import { SmartAllocationModal } from './SmartAllocationModal';
import {
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Sparkles,
  Zap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface PanManagerProps {
  onOpenMultiApply: () => void;
}

export const PanManager: React.FC<PanManagerProps> = ({ onOpenMultiApply }) => {
  const [profiles, setProfiles] = useState<FamilyPanProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSmartOptimizerOpen, setIsSmartOptimizerOpen] = useState<boolean>(false);
  const [loadingSample, setLoadingSample] = useState<boolean>(false);

  // Form inputs
  const [name, setName] = useState<string>('');
  const [relationship, setRelationship] = useState<PanRelationship>('Self');
  const [pan, setPan] = useState<string>('');
  const [broker, setBroker] = useState<string>('Zerodha');
  const [dematId, setDematId] = useState<string>('');
  const [bankUpi, setBankUpi] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/pans');
      const json = await res.json();
      if (json.success) {
        setProfiles(json.data || []);
      }
    } catch (e) {
      console.error('Error fetching PAN profiles:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleAddPan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPan = pan.trim().toUpperCase();
    if (!isValidPan(cleanPan)) {
      setError('Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          relationship,
          pan: cleanPan,
          broker,
          dematId: dematId.trim() || undefined,
          bankUpi: bankUpi.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setName('');
        setPan('');
        setDematId('');
        setBankUpi('');
        fetchProfiles();
      } else {
        setError(json.error || 'Failed to add PAN profile');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePan = async (id: string, profileName: string) => {
    if (!confirm(`Are you sure you want to remove the profile for ${profileName}?`)) return;
    try {
      const res = await fetch(`/api/pans?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchProfiles();
      }
    } catch (err) {
      console.error('Failed to delete PAN:', err);
    }
  };

  const handleLoadSamplePans = async () => {
    setLoadingSample(true);
    const demoFamily = [
      { name: 'Jeevan Gowda', relationship: 'Self' as PanRelationship, pan: 'ABCDE1234F', broker: 'Zerodha', bankUpi: 'jeevan@oksbi' },
      { name: 'Rekha Gowda', relationship: 'Spouse' as PanRelationship, pan: 'BCDEF2345G', broker: 'Groww', bankUpi: 'rekha@okhdfcbank' },
      { name: 'M. Gowda', relationship: 'Parent' as PanRelationship, pan: 'CDEFG3456H', broker: 'AngelOne', bankUpi: 'mgowda@okicici' },
      { name: 'Sunita Gowda', relationship: 'Parent' as PanRelationship, pan: 'DEFGH4567I', broker: 'Upstox', bankUpi: 'sunita@paytm' },
    ];

    for (const p of demoFamily) {
      try {
        await fetch('/api/pans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
      } catch (e) {
        console.error(e);
      }
    }
    await fetchProfiles();
    setLoadingSample(false);
  };

  return (
    <div className="space-y-6">
      {/* SEBI Compliance Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-300">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-200">
            SEBI ICDR Duplicate Bid Rule Enforcement
          </p>
          <p className="text-amber-300/80 leading-relaxed">
            Under SEBI regulations, an investor cannot submit multiple bids under the same PAN in a single IPO across any broker. Multiple bids lead to automatic technical rejection by registrars. IPOLENS automatically audits all family applications and enforces single-bid integrity per PAN.
          </p>
        </div>
      </div>

      {/* Probability Maximizer Feature Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900/80 to-cyan-950/50 border border-purple-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Smart Multi-PAN Allocation Engine
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live NSE/BSE Telemetry
            </span>
          </div>

          <h3 className="text-lg font-bold text-white tracking-wide">
            Maximize Allotment Odds with Live Exchange Bidding Multiples
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            SEBI allocates Retail and Small NII (sNII) lots strictly by computerized lottery. IPOLENS solves the combinatorial probability equation <code className="text-cyan-300">1 - Π(1 - P_i)</code> to distribute lots across your family PANs (Retail 1-Lot vs. sNII vs. bNII) for up to <strong className="text-emerald-400">+350% higher allotment probability</strong> before bidding closes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsSmartOptimizerOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>Launch Probability Maximizer</span>
          </button>
        </div>
      </div>

      {/* Header with Add Button and Multi-Apply Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-white/10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Family PAN & Multi-Account Registry
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Manage demat accounts across family members (Self, Spouse, Parent, Child) for coordinated IPO applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsSmartOptimizerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold text-xs border border-purple-500/30 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Probability Maximizer</span>
          </button>

          {profiles.length > 0 && (
            <button
              onClick={onOpenMultiApply}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition shadow-md shadow-cyan-500/20"
            >
              Multi-PAN Bidding Planner
            </button>
          )}

          <button
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/10 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Family PAN</span>
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-900/40 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-white/5">
          <Users className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No Family PANs Added Yet</h4>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add First Family PAN</span>
            </button>
            <button
              onClick={handleLoadSamplePans}
              disabled={loadingSample}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold text-xs border border-purple-500/30 cursor-pointer transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>{loadingSample ? 'Loading Demo Profiles...' : 'Load 4 Demo Family Accounts'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="p-5 rounded-2xl glass-card relative overflow-hidden group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {profile.relationship}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2">{profile.name}</h4>
                </div>

                <button
                  onClick={() => handleDeletePan(profile.id, profile.name)}
                  title="Remove Profile"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Masked PAN:</span>
                  <span className="text-slate-200 font-bold tracking-wider">
                    {maskPan(profile.pan)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Primary Broker:</span>
                  <span className="text-slate-200 font-medium flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-cyan-400" />
                    {profile.broker}
                  </span>
                </div>

                {profile.dematId && (
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Demat / DP ID:</span>
                    <span className="text-slate-300">{profile.dematId}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add PAN Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1322] border border-white/10 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Add Family PAN Profile</h3>
            <p className="text-xs text-slate-400 mb-4">
              Registered PAN details are validated and masked to ensure compliance and privacy.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleAddPan} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Investor Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Gowda"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as PanRelationship)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Self">Self</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="HUF">HUF</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Primary Broker</label>
                  <select
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Zerodha">Zerodha Kite</option>
                    <option value="Groww">Groww</option>
                    <option value="AngelOne">AngelOne</option>
                    <option value="Upstox">Upstox</option>
                    <option value="5paisa">5paisa</option>
                    <option value="HDFC Sky">HDFC Sky</option>
                    <option value="ICICI Direct">ICICI Direct</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Permanent Account Number (PAN)</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono uppercase tracking-widest placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Demat Client ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="12081600..."
                    value={dematId}
                    onChange={(e) => setDematId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">UPI ID for ASBA (Optional)</label>
                  <input
                    type="text"
                    placeholder="username@okhdfcbank"
                    value={bankUpi}
                    onChange={(e) => setBankUpi(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Register Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Probability Maximizer Modal */}
      <SmartAllocationModal
        isOpen={isSmartOptimizerOpen}
        onClose={() => setIsSmartOptimizerOpen(false)}
        onApplicationsSubmitted={() => fetchProfiles()}
      />
    </div>
  );
};
