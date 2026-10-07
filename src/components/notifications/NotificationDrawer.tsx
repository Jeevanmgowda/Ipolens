'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  TrendingUp,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Sparkles,
  Send,
  Sliders,
  Check,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  symbol?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (unreadCount: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'channels'>('feed');

  // Channel toggles simulation
  const [webPushEnabled, setWebPushEnabled] = useState<boolean>(true);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState<boolean>(true);
  const [telegramHandle, setTelegramHandle] = useState<string>('@investor_desk');

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotifications(json.data);
        const unread = json.data.filter((n: any) => !n.read).length;
        if (onCountChange) onCountChange(unread);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', id }),
      });
      const unread = notifications.filter((n) => n.id !== id && !n.read).length;
      if (onCountChange) onCountChange(unread);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMockAlert = async (type: string) => {
    let alertData = {
      type: 'GMP_JUMP',
      title: 'Grey Market Premium Alert',
      message: 'Swiggy Limited GMP increased to ₹35 with strong grey market buyer demand.',
      symbol: 'SWIGGY',
    };

    if (type === 'SUBSCRIPTION') {
      alertData = {
        type: 'SUBSCRIPTION_MILESTONE',
        title: 'Institutional QIB Surge',
        message: 'Bajaj Housing Finance QIB portion crossed 150x oversubscription!',
        symbol: 'BAJAJHFL',
      };
    } else if (type === 'LOCKIN') {
      alertData = {
        type: 'LOCKIN_EXPIRY',
        title: 'Anchor Share Release Imminent',
        message: 'Waaree Energies 90-day anchor lock-in concludes next week.',
        symbol: 'WAAREE',
      };
    }

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications((prev) => [json.data, ...prev]);
        if (onCountChange) onCountChange(notifications.filter((n) => !n.read).length + 1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md h-full bg-[#080d1a] border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">IPOLENS Notification Engine</h3>
              <p className="text-[11px] text-slate-400">Real-time alerts, GMP spikes & lock-in expiries</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-2 border-b border-white/5 bg-slate-900/60 flex items-center gap-1 text-xs">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
              activeTab === 'feed'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Alerts Feed ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
              activeTab === 'channels'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Channels & Delivery
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'feed' ? (
            <>
              {/* Quick simulation buttons for test demonstration */}
              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-400">Trigger Alert:</span>
                <button
                  onClick={() => handleCreateMockAlert('GMP')}
                  className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer font-medium"
                >
                  + GMP Jump
                </button>
                <button
                  onClick={() => handleCreateMockAlert('SUBSCRIPTION')}
                  className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 cursor-pointer font-medium"
                >
                  + Sub Surge
                </button>
                <button
                  onClick={() => handleCreateMockAlert('LOCKIN')}
                  className="px-2 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 cursor-pointer font-medium"
                >
                  + Lock-In
                </button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-900/60 animate-pulse border border-white/5" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No notifications recorded yet.
                </div>
              ) : (
                notifications.map((notif) => {
                  return (
                    <div
                      key={notif.id}
                      className={`p-3.5 rounded-xl border transition ${
                        notif.read
                          ? 'bg-slate-900/40 border-white/5 text-slate-400'
                          : 'bg-slate-900/90 border-cyan-500/30 text-white shadow-md shadow-cyan-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {notif.type === 'GMP_JUMP' ? (
                            <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                              <TrendingUp className="w-3.5 h-3.5" />
                            </span>
                          ) : notif.type === 'LOCKIN_EXPIRY' ? (
                            <span className="p-1 rounded bg-purple-500/20 text-purple-400">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                              <Sparkles className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <h4 className="text-xs font-bold">{notif.title}</h4>
                        </div>

                        {!notif.read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            title="Mark as read"
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> Mark read
                          </button>
                        )}
                      </div>

                      <p className="text-xs mt-1.5 text-slate-300 leading-relaxed">{notif.message}</p>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-500">
                        {notif.symbol ? (
                          <span className="font-mono text-cyan-400 font-semibold">{notif.symbol}</span>
                        ) : (
                          <span>General</span>
                        )}
                        <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            /* Notification Channels Config */
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">Browser Web Push</h4>
                    <p className="text-[11px] text-slate-400">Instant desktop popups on subscription spikes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={webPushEnabled}
                    onChange={(e) => setWebPushEnabled(e.target.checked)}
                    className="rounded text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">Telegram Direct Bot</h4>
                    <p className="text-[11px] text-slate-400">Send instant allotment & GMP notifications</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="rounded text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </div>
                {telegramEnabled && (
                  <input
                    type="text"
                    value={telegramHandle}
                    onChange={(e) => setTelegramHandle(e.target.value)}
                    placeholder="@your_telegram_username"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-white"
                  />
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white">Institutional Email Digest</h4>
                    <p className="text-[11px] text-slate-400">Daily 5 PM issue close & allotment summary</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertsEnabled}
                    onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                    className="rounded text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Delivery status: Active</span>
          <span className="text-cyan-400 font-mono">SEBI Disclosures Applied</span>
        </div>
      </div>
    </div>
  );
};
