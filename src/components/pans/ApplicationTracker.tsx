'use client';

import React, { useState, useEffect } from 'react';
import { IpoApplication, ApplicationStatus } from '@/types/pan';
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Trash2,
  FileCheck,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface ApplicationTrackerProps {
  onRefreshTrigger?: number;
}

export const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({ onRefreshTrigger }) => {
  const [applications, setApplications] = useState<IpoApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setApplications(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [onRefreshTrigger]);

  const handleUpdateStatus = async (id: string, newStatus: ApplicationStatus, allottedQty?: number) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, allottedShares: allottedQty }),
      });
      const json = await res.json();
      if (json.success) {
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this application record?')) return;
    try {
      const res = await fetch(`/api/applications?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to delete application:', err);
    }
  };

  if (loading) {
    return <div className="h-40 rounded-xl bg-slate-900/40 animate-pulse border border-white/5" />;
  }

  if (applications.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-slate-900/30 border border-white/5">
        <FileCheck className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-xs text-slate-400">
          No IPO applications recorded yet. Select any live IPO from the Radar to plan and log family bids.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Active & Past Family IPO Applications ({applications.length})
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time status journal across registered family PAN profiles
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-slate-950/40 text-slate-400 uppercase text-[10px] font-semibold">
              <th className="py-3 px-4">IPO Issue</th>
              <th className="py-3 px-4">Applicant Profile</th>
              <th className="py-3 px-4">Category / Lots</th>
              <th className="py-3 px-4">Blocked Outlay</th>
              <th className="py-3 px-4">Allotment Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {applications.map((app) => {
              return (
                <tr key={app.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-white font-mono text-xs">{app.ipoSymbol}</div>
                    <div className="text-[11px] text-slate-400">{app.companyName}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-200">{app.holderName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      PAN: {app.panNumber} ({app.relationship})
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    <span className="text-slate-300 font-medium">{app.category}</span>
                    <div className="text-[11px] text-slate-500">
                      {app.lots} lot ({app.shares} shares)
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    <span className="text-cyan-400 font-bold">
                      ₹{app.blockedAmount.toLocaleString('en-IN')}
                    </span>
                    <div className="text-[10px] text-slate-500">@ ₹{app.bidPrice}/sh</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <select
                      value={app.status}
                      onChange={(e) => handleUpdateStatus(app.id, e.target.value as ApplicationStatus)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer focus:outline-none ${
                        app.status === 'Allotted'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : app.status === 'Not Allotted'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : app.status === 'Mandate Approved'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      <option value="Applied">Applied</option>
                      <option value="Mandate Approved">Mandate Approved</option>
                      <option value="Allotted">Allotted</option>
                      <option value="Not Allotted">Not Allotted</option>
                      <option value="Refunded">Refunded</option>
                    </select>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDelete(app.id)}
                      title="Delete application"
                      className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
