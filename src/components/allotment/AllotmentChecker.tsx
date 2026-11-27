'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  Users,
  Search,
  ClipboardPaste,
  Bell,
  Copy,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { IpoApplication } from '@/types/pan';
import type { AllotmentResult, AllotmentStatus } from '@/lib/services/allotment/types';
import type { FamilyCheckSummary } from '@/lib/services/allotment/family-check.service';
import { scanRegistrarText, type AllotmentScanResult } from '@/lib/services/allotment/text-parser';

type Tab = 'mine' | 'family' | 'any' | 'paste' | 'alerts';

const STATUS_STYLE: Record<AllotmentStatus, { label: string; cls: string; Icon: React.FC<{ className?: string }> }> = {
  ALLOTTED: { label: 'Allotted', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', Icon: CheckCircle2 },
  NOT_ALLOTTED: { label: 'Not allotted', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30', Icon: XCircle },
  PENDING: { label: 'Pending', cls: 'text-amber-200 bg-amber-500/10 border-amber-500/30', Icon: Clock },
  MANUAL_VERIFICATION_REQUIRED: { label: 'Verify on registrar', cls: 'text-cyan-200 bg-cyan-500/10 border-cyan-500/30', Icon: ExternalLink },
};

const StatusChip: React.FC<{ status: AllotmentStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${s.cls}`}>
      <s.Icon className="w-3 h-3" /> {s.label}
    </span>
  );
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ success: false, error: 'Unexpected response' }));
  if (!j.success) throw new Error(j.error || `Request failed (${r.status})`);
  return j.data as T;
}

/** Manual-verification panel: the one-click deep link (Path B). PANs are never placed in URLs. */
const ManualVerify: React.FC<{ result: AllotmentResult }> = ({ result }) => (
  <div className="text-[11px] text-slate-300 space-y-1">
    <p>{result.message}</p>
    <a href={result.fallbackUrl} target="_blank" rel="noopener noreferrer" className="btn-chip">
      <ExternalLink className="w-3 h-3" /> Open {result.registrar}
    </a>
  </div>
);

export const AllotmentChecker: React.FC = () => {
  const [tab, setTab] = useState<Tab>('mine');
  const [apps, setApps] = useState<IpoApplication[]>([]);
  const [results, setResults] = useState<Record<string, AllotmentResult>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const loadApps = useCallback(async () => {
    const r = await fetch('/api/applications');
    if (r.status === 401) {
      setNeedsLogin(true);
      return;
    }
    const j = await r.json();
    if (j.success) setApps(j.data);
  }, []);

  useEffect(() => {
    (async () => {
      await loadApps();
    })();
  }, [loadApps]);

  const bySymbol = useMemo(() => {
    const m = new Map<string, IpoApplication[]>();
    for (const a of apps) m.set(a.ipoSymbol, [...(m.get(a.ipoSymbol) || []), a]);
    return [...m.entries()];
  }, [apps]);

  const checkOne = async (app: IpoApplication) => {
    setChecking((c) => ({ ...c, [app.id]: true }));
    setError(null);
    try {
      const res = await postJson<AllotmentResult & { transitioned: boolean }>('/api/allotment/check', { applicationId: app.id });
      setResults((r) => ({ ...r, [app.id]: res }));
      if (res.transitioned) loadApps();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking((c) => ({ ...c, [app.id]: false }));
    }
  };

  if (needsLogin) {
    return (
      <div className="p-6 rounded-xl glass-panel border border-white/10 text-sm text-slate-300">
        Sign in to check allotments for your family PAN applications. You can still use the registrar links below without an account.
        <RegistrarLinks />
      </div>
    );
  }

  const TABS: Array<[Tab, string, React.FC<{ className?: string }>]> = [
    ['mine', 'My applications', CheckCircle2],
    ['family', 'Family check', Users],
    ['any', 'Any PAN', Search],
    ['paste', 'Paste result', ClipboardPaste],
    ['alerts', 'Alerts', Bell],
  ];

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-bold text-white">IPO Allotment Checker</h2>
        <p className="text-xs text-slate-400">
          Checks the registrar for each family PAN. When a registrar blocks automated checks, you get a one-click link to verify
          on its official page. Results are saved and synced to your portfolio once final.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              tab === id ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {tab === 'mine' && (
        <section className="space-y-3">
          {bySymbol.length === 0 && (
            <p className="p-4 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-400">
              No applications recorded yet. Add family PANs and record your bids in the PAN tab.
            </p>
          )}
          {bySymbol.map(([symbol, list]) => (
            <div key={symbol} className="p-4 rounded-xl glass-panel border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2">
                {list[0].companyName} <span className="text-slate-400 font-mono text-xs">({symbol})</span>
              </h3>
              <div className="divide-y divide-white/5">
                {list.map((a) => {
                  const r = results[a.id];
                  const status: AllotmentStatus = r?.status ?? (a.allotmentStatus as AllotmentStatus) ?? 'PENDING';
                  return (
                    <div key={a.id} className="py-2 flex flex-wrap items-center gap-3 text-xs">
                      <div className="min-w-[180px]">
                        <p className="text-slate-100 font-medium">{a.holderName}</p>
                        <p className="text-slate-500 font-mono">
                          {a.panNumber} · {a.category} · {a.lots} lot(s) · {inr(a.blockedAmount)}
                        </p>
                      </div>
                      <StatusChip status={status} />
                      {status === 'ALLOTTED' && <span className="font-mono text-emerald-300">{r?.sharesAllotted ?? a.allottedShares} shares</span>}
                      <div className="ml-auto flex gap-2">
                        {(status === 'PENDING' || status === 'MANUAL_VERIFICATION_REQUIRED') && (
                          <button type="button" className="btn-chip" disabled={checking[a.id]} onClick={() => checkOne(a)}>
                            {checking[a.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Check
                          </button>
                        )}
                      </div>
                      {r?.status === 'MANUAL_VERIFICATION_REQUIRED' && (
                        <div className="w-full">
                          <ManualVerify result={r} />
                        </div>
                      )}
                      {r?.status === 'PENDING' && <p className="w-full text-[11px] text-amber-200">{r.message}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'family' && <FamilyCheck symbols={bySymbol.map(([s, l]) => ({ symbol: s, name: l[0].companyName, count: l.length }))} onDone={loadApps} />}
      {tab === 'any' && <AnyPanCheck />}
      {tab === 'paste' && <PasteCheck />}
      {tab === 'alerts' && <AlertSettings />}
    </div>
  );
};

const FamilyCheck: React.FC<{ symbols: Array<{ symbol: string; name: string; count: number }>; onDone: () => void }> = ({ symbols, onDone }) => {
  const [picked, setSymbol] = useState('');
  const symbol = picked || symbols[0]?.symbol || '';
  const [summary, setSummary] = useState<FamilyCheckSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setSummary(await postJson<FamilyCheckSummary>('/api/allotment/check-family', { symbol }));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!symbols.length) {
    return <p className="p-4 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-400">Record family PAN applications first, then check them all at once here.</p>;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="py-2 px-3 rounded-lg bg-slate-900/70 border border-white/10 text-sm text-slate-100">
          {symbols.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.name} ({s.count} PAN{s.count > 1 ? 's' : ''})
            </option>
          ))}
        </select>
        <button type="button" className="btn-chip" disabled={busy || !symbol} onClick={run}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />} Check all family PANs
        </button>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {summary && (
        <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <Stat label="Allotted" value={`${summary.totals.allotted} / ${summary.totals.applications}`} tone="text-emerald-300" />
            <Stat label="Shares allotted" value={String(summary.totals.sharesAllotted)} />
            <Stat label="Invested at issue price" value={inr(summary.totals.investedAtIssuePrice)} />
            <Stat label="Refund due" value={inr(summary.totals.refundDue)} />
          </div>
          {(summary.totals.pending > 0 || summary.totals.manual > 0) && (
            <p className="text-[11px] text-amber-200">
              {summary.totals.pending} pending and {summary.totals.manual} need manual verification
              {summary.allotmentDate ? ` (basis of allotment: ${summary.allotmentDate})` : ''}.
            </p>
          )}
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left font-normal py-1">Member</th>
                <th className="text-left font-normal">PAN</th>
                <th className="text-left font-normal">Status</th>
                <th className="text-right font-normal">Shares</th>
                <th className="text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.members.map((m) => (
                <tr key={m.applicationId} className="border-t border-white/5 align-top">
                  <td className="py-2">
                    {m.holderName}
                    <span className="block text-slate-500">{m.relationship} · {m.category}</span>
                  </td>
                  <td className="font-mono">{m.panNumber}</td>
                  <td>
                    <StatusChip status={m.status} />
                    {m.status === 'PENDING' && <span className="block text-[10px] text-slate-500 mt-0.5">{m.message}</span>}
                  </td>
                  <td className="text-right font-mono">{m.status === 'ALLOTTED' ? m.sharesAllotted : '—'}</td>
                  <td className="text-right">
                    {m.status === 'MANUAL_VERIFICATION_REQUIRED' && (
                      <div className="inline-flex gap-1">
                        <a href={m.fallbackUrl} target="_blank" rel="noopener noreferrer" className="btn-chip">
                          <ExternalLink className="w-3 h-3" /> Verify
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Copy className="w-3 h-3" /> On the registrar page, select the IPO and enter the member&apos;s PAN from your own records. IPOLENS never puts PANs in links.
          </p>
        </div>
      )}
    </section>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
    <p className={`font-mono text-sm font-bold ${tone || 'text-white'}`}>{value}</p>
    <p className="text-slate-500 text-[10px]">{label}</p>
  </div>
);

const AnyPanCheck: React.FC = () => {
  const [ipos, setIpos] = useState<Array<{ symbol: string; companyName: string; status: string }>>([]);
  const [symbol, setSymbol] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState<AllotmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ipos?status=all')
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        const list = (j.data as Array<{ symbol: string; companyName: string; status: string }>).filter((i) => i.status === 'Closed' || i.status === 'Listed');
        setIpos(list);
        if (list[0]) setSymbol(list[0].symbol);
      });
  }, []);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await postJson<AllotmentResult>('/api/allotment/check', { symbol, pan: pan.toUpperCase() }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={run} className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="py-2 px-3 rounded-lg bg-slate-900/70 border border-white/10 text-sm text-slate-100">
          {ipos.map((i) => (
            <option key={i.symbol} value={i.symbol}>
              {i.companyName}
            </option>
          ))}
        </select>
        <input
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="PAN (ABCDE1234F)"
          autoComplete="off"
          className="py-2 px-3 rounded-lg bg-slate-900/70 border border-white/10 text-sm text-slate-100 font-mono w-44"
        />
        <button type="submit" className="btn-chip" disabled={busy || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) || !symbol}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Check
        </button>
      </div>
      <p className="text-[10px] text-slate-500">This PAN is used only for this lookup. It is not stored.</p>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <StatusChip status={result.status} />
            <span className="font-mono text-slate-400">{result.panNumber}</span>
            {result.status === 'ALLOTTED' && <span className="text-emerald-300">{result.sharesAllotted} shares</span>}
          </div>
          {result.status === 'MANUAL_VERIFICATION_REQUIRED' ? <ManualVerify result={result} /> : <p className="text-xs text-slate-400">{result.message}</p>}
        </div>
      )}
    </form>
  );
};

const PasteCheck: React.FC = () => {
  const [text, setText] = useState('');
  const result: AllotmentScanResult | null = text.trim() ? scanRegistrarText(text) : null;
  return (
    <section className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
      <p className="text-xs text-slate-400">Checked on the registrar site? Paste the result text here to read it.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={20000}
        className="w-full p-3 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-slate-100 font-mono"
        placeholder="Paste the allotment status text from the registrar page"
      />
      {result && (
        <div className="text-xs space-y-1">
          <p>
            Status: <strong>{result.status}</strong> ({Math.round(result.rawConfidence * 100)}% confidence)
          </p>
          {result.sharesAllotted !== undefined && <p>Shares allotted: {result.sharesAllotted}</p>}
          {result.panMatched && <p>PAN: {result.panMatched}</p>}
        </div>
      )}
      <RegistrarLinks />
    </section>
  );
};

const RegistrarLinks: React.FC = () => {
  const [regs, setRegs] = useState<Array<{ slug: string; name: string; portalUrl: string }>>([]);
  useEffect(() => {
    fetch('/api/allotment/scan')
      .then((r) => r.json())
      .then((j) => j.success && setRegs(j.registrars));
  }, []);
  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      {regs.map((r) => (
        <a key={r.slug} href={r.portalUrl} target="_blank" rel="noopener noreferrer" className="btn-chip">
          <ExternalLink className="w-3 h-3" /> {r.name}
        </a>
      ))}
    </div>
  );
};

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const AlertSettings: React.FC = () => {
  const [settings, setSettings] = useState<{ phoneMasked: string | null; whatsappOptIn: boolean; pushDevices: number; whatsappConfigured: boolean } | null>(null);
  const [phone, setPhone] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await (await fetch('/api/user/notification-settings')).json();
    if (j.success) {
      setSettings(j.data);
      setOptIn(j.data.whatsappOptIn);
    }
  }, []);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const saveWhatsApp = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/user/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || undefined, whatsappOptIn: optIn }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      setPhone('');
      setMsg('WhatsApp preference saved.');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support push notifications.');
      const cfg = await (await fetch('/api/push/subscribe')).json();
      if (!cfg.configured) throw new Error('Push notifications are not configured on the server (VAPID keys).');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Notification permission was not granted.');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) });
      const r = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      setMsg('Browser alerts enabled on this device.');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid md:grid-cols-2 gap-3">
      <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-2 text-xs">
        <h3 className="text-sm font-semibold text-white">Browser push</h3>
        <p className="text-slate-400">Get a notification on this device when an allotment result is out.</p>
        <p className="text-slate-500">{settings ? `${settings.pushDevices} device(s) subscribed.` : ''}</p>
        <button type="button" className="btn-chip" disabled={busy} onClick={enablePush}>
          <Bell className="w-3.5 h-3.5" /> Enable on this device
        </button>
      </div>
      <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-2 text-xs">
        <h3 className="text-sm font-semibold text-white">WhatsApp</h3>
        {!settings?.whatsappConfigured && <p className="text-amber-200">WhatsApp sending is not configured on the server yet.</p>}
        <p className="text-slate-400">Current number: {settings?.phoneMasked || 'none'}</p>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile number (10 digits)"
          inputMode="tel"
          className="py-1.5 px-2 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100 w-full"
        />
        <label className="flex items-center gap-2 text-slate-300">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} /> Send allotment results on WhatsApp
        </label>
        <button type="button" className="btn-chip" disabled={busy} onClick={saveWhatsApp}>
          Save
        </button>
      </div>
      {msg && <p className="md:col-span-2 text-xs text-slate-300">{msg}</p>}
    </section>
  );
};

export default AllotmentChecker;
