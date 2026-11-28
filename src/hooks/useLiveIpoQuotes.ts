'use client';

import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { LiveMarketIpoItem } from '@/types/liveMarket';

interface LiveQuote {
  ltp: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

function nseOpenNow(): boolean {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return ist.getUTCDay() >= 1 && ist.getUTCDay() <= 5 && mins >= 555 && mins <= 930;
}

/**
 * Live feed for the IPO cards. Active issues get subscription, GMP and calendar from
 * /api/ipos/live-updates (every 60s while NSE is open, 5 min otherwise; the server re-reads stale
 * issues from InvestorGain). Listed issues get their price:
 * refreshes the price fields of listed IPO cards in place from /api/ipos/quotes (exchange price,
 * delayed up to ~15 min): every 30s while NSE is open, every 5 min otherwise. Watchlisted and
 * most recently listed IPOs first, at most 60 per request.
 */
export function useLiveIpoQuotes(
  ipos: LiveMarketIpoItem[],
  setIpos: Dispatch<SetStateAction<LiveMarketIpoItem[]>>,
  watchlist: string[] = []
): void {
  const key = useMemo(() => {
    const listed = ipos
      .filter((i) => i.status === 'Listed' || i.isListed)
      .sort((a, b) => String(b.listingDate).localeCompare(String(a.listingDate)));
    const watched = listed.filter((i) => watchlist.includes(i.symbol));
    return [...new Set([...watched, ...listed].map((i) => i.symbol))].slice(0, 60).join(',');
  }, [ipos, watchlist]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/ipos/quotes?symbols=${encodeURIComponent(key)}`);
        const json = await res.json();
        if (!cancelled && json.success && json.quotes) {
          const quotes = json.quotes as Record<string, LiveQuote>;
          setIpos((prev) =>
            prev.map((i) => {
              const q = quotes[i.symbol];
              return q
                ? {
                    ...i,
                    currentPrice: q.ltp,
                    previousClose: q.previousClose,
                    dayChange: q.change,
                    dayChangePercent: q.changePercent,
                    volume: q.volume,
                    quoteUpdatedAt: q.timestamp,
                  }
                : i;
            })
          );
        }
      } catch {
        // Keep the last prices; the next tick retries.
      }
      if (!cancelled) timer = setTimeout(tick, nseOpenNow() ? 30_000 : 5 * 60_000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, setIpos]);

  // Active issues (open, opening soon, closed awaiting listing): subscription, GMP, dates.
  const activeKey = useMemo(
    () =>
      [...new Set(ipos.filter((i) => i.status !== 'Listed' && !i.isListed).map((i) => i.symbol))].join(','),
    [ipos]
  );

  useEffect(() => {
    if (!activeKey) return;
    const symbols = activeKey.split(',').filter(Boolean);
    const batches: string[][] = [];
    for (let idx = 0; idx < symbols.length; idx += 60) {
      batches.push(symbols.slice(idx, idx + 60));
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      for (const batch of batches) {
        if (cancelled) break;
        try {
          const res = await fetch(`/api/ipos/live-updates?symbols=${encodeURIComponent(batch.join(','))}`);
          const json = await res.json();
          if (!cancelled && json.success && json.updates) {
            const updates = json.updates as Record<string, Partial<LiveMarketIpoItem>>;
            const syncedAt = json.fetchedAt as string;
            setIpos((prev) =>
              prev.map((i) => (updates[i.symbol] ? { ...i, ...updates[i.symbol], liveCheckedAt: syncedAt } : i))
            );
          }
        } catch {
          // Keep the last values; the next tick retries.
        }
      }
      if (!cancelled) timer = setTimeout(tick, nseOpenNow() ? 60_000 : 5 * 60_000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeKey, setIpos]);
}
