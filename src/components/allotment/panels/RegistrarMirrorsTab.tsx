'use client';

import { Building2, ExternalLink, Server } from 'lucide-react';
import { OFFICIAL_REGISTRARS } from '@/lib/services/allotmentScanner';

export function RegistrarMirrorsTab() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span>Authoritative Registrar Portals & Server Mirror Network</span>
          </h3>
          <p className="text-xs text-slate-400">
            Direct access to high-availability servers for Link Intime, KFin Technologies, Bigshare, and BSE India.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFICIAL_REGISTRARS.map((reg) => (
            <div key={reg.slug} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{reg.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{reg.description}</p>
                </div>
                <a
                  href={reg.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition shrink-0 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {reg.mirrors && reg.mirrors.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                    Server Mirrors & Endpoints:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {reg.mirrors.map((m, idx) => (
                      <a
                        key={idx}
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                          m.isPrimary
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        <Server className="w-3 h-3 text-cyan-400" />
                        <span>{m.serverName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
