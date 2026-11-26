'use client';

import type React from 'react';
import { type RealTimeListedIpo } from '../allotmentTypes';
import { Bell, Clock, Smartphone } from 'lucide-react';

export interface NotificationsTabProps {
  activeIpo: RealTimeListedIpo;
  handleSaveWhatsappSettings: (e: React.FormEvent) => void;
  handleToggleWebPush: () => void | Promise<void>;
  isPushLoading: boolean;
  pushSubscribed: boolean;
  setWhatsappOptIn: (value: boolean) => void;
  setWhatsappPhone: (value: string) => void;
  whatsappOptIn: boolean;
  whatsappPhone: string;
  whatsappSaved: boolean;
}

export function NotificationsTab({ activeIpo, handleSaveWhatsappSettings, handleToggleWebPush, isPushLoading, pushSubscribed, setWhatsappOptIn, setWhatsappPhone, whatsappOptIn, whatsappPhone, whatsappSaved }: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WhatsApp Alerts (Twilio) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">WhatsApp Allotment Alerts</h4>
                <span className="text-[10px] text-slate-400 font-mono">Powered by Twilio Official Templates</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              AUTO +91
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Receive instant WhatsApp alerts the moment registrars publish results or when UPI mandate refunds are initiated.
          </p>

          <form onSubmit={handleSaveWhatsappSettings} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">WhatsApp Mobile Number:</label>
              <div className="relative">
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wa-opt"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
              />
              <label htmlFor="wa-opt" className="text-xs text-slate-300 cursor-pointer">
                Enable allotment & refund notifications on this number
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              {whatsappSaved ? 'Preferences Saved!' : 'Save WhatsApp Preferences'}
            </button>
          </form>

          {/* Sample WhatsApp Template Preview */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Template Preview (Approved)</span>
            <p className="text-emerald-400">🎉 IPOLENS Alert: Allotment Declared!</p>
            <p className="text-slate-300">You have been allotted 38 shares of {activeIpo.companyName} (Value: ₹14,820). View in your portfolio: ipolens.com/portfolio</p>
          </div>
        </div>

        {/* Web Push & Inngest Cron Details */}
        <div className="space-y-6">
          {/* Web Push (VAPID) */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Native Web Push Notifications</h4>
                  <span className="text-[10px] text-slate-400 font-mono">VAPID Protocol • Deep Links to /portfolio</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Browser push alerts trigger automatically when Inngest cron completes background verification.
            </p>

            <button
              type="button"
              onClick={handleToggleWebPush}
              disabled={isPushLoading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                pushSubscribed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{pushSubscribed ? 'Web Push Active (Subscribed)' : 'Enable Browser Push Notifications'}</span>
            </button>
          </div>

          {/* Inngest Polling Cron Schedule (PDF Section 3.6) */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Automated Inngest Polling Cron
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                TZ=Asia/Kolkata
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5 font-mono text-xs text-cyan-300">
              */30 8-23 * * * (Every 30 mins between 08:00 - 23:30 IST)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Queries up to 50 pending applications whose allotment date is on or before today. Retries are individual and idempotent, writing only final results to prevent notification spam.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
