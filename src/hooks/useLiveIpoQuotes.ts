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
 * Refreshes the price fields of listed IPO cards in place from /api/ipos/quotes (exchange price,
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
}
