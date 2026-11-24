import { IpoStatus } from '@/types/ipo';

/**
 * Robust parser for diverse Indian financial dates (e.g. "15-Oct-2026", "13 Oct - 15 Oct 2026", "15-10-2026")
 */
export function parseIpoDateMs(dateStr: string, isClosingTime = true): number | null {
  if (!dateStr || dateStr === 'TBD' || dateStr === '—' || dateStr === '-') return null;
  const lower = dateStr.toLowerCase();
  if (
    lower.includes('past') ||
    lower.includes('closed') ||
    lower.includes('bidding closed') ||
    lower.includes('allotted') ||
    lower.includes('listed')
  ) {
    return 1; // Sentinel past timestamp (Jan 1, 1970)
  }

  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  // Check standard ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const isoParsed = Date.parse(dateStr);
    if (!isNaN(isoParsed)) return isoParsed;
  }

  // Regex to extract date tokens like "15-Oct-2026", "15 Oct 2026", "15-Oct", "15/10/2026"
  const regex = /(\d{1,2})[-/ ]([a-zA-Z]{3,9})(?:[-/ ](\d{2,4}))?/g;
  let match: RegExpExecArray | null;
  const matches: { day: number; month: number; year: number }[] = [];

  while ((match = regex.exec(dateStr)) !== null) {
    const day = parseInt(match[1], 10);
    const mStr = match[2].toLowerCase().slice(0, 3);
    let year = match[3] ? parseInt(match[3], 10) : 2026;
    if (year < 100) year += 2000;
    const month = months[mStr];
    if (month !== undefined && day >= 1 && day <= 31) {
      matches.push({ day, month, year });
    }
  }

  if (matches.length > 0) {
    const target = isClosingTime ? matches[matches.length - 1] : matches[0];
    // 5:00 PM IST = 11:30 UTC for close time, 10:00 AM IST = 04:30 UTC for open time
    const [h, m] = isClosingTime ? [11, 30] : [4, 30];
    return Date.UTC(target.year, target.month, target.day, h, m, 0);
  }

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) return parsed;

  return null;
}

/**
 * Calculate remaining time until 5:00 PM IST on issue close date
 */
export function calculateRemainingTime(closeDateStr: string): string {
  if (!closeDateStr || closeDateStr === 'TBD' || closeDateStr === '—') {
    return 'Upcoming';
  }
  if (isBiddingClosed(closeDateStr)) {
    return 'Bidding Closed';
  }
  const closeTimeMs = parseIpoDateMs(closeDateStr, true);
  if (!closeTimeMs) return 'Open for Bidding';

  const diffMs = closeTimeMs - Date.now();
  if (diffMs <= 0) {
    return 'Bidding Closed';
  }

  const hoursTotal = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hoursTotal / 24);
  const remainingHours = hoursTotal % 24;

  if (days === 0) {
    if (hoursTotal === 0) {
      const minutes = Math.floor(diffMs / (1000 * 60));
      return `${minutes} Mins Left`;
    }
    return `${hoursTotal} Hours Left`;
  }
  if (days === 1) {
    return `1 Day, ${remainingHours} Hours`;
  }
  return `${days} Days, ${remainingHours} Hours`;
}

/**
 * Helper to determine if an IPO bidding period has concluded
 */
export function isBiddingClosed(closeDateStr: string): boolean {
  if (!closeDateStr || closeDateStr === 'TBD' || closeDateStr === '—') return false;
  const lower = closeDateStr.toLowerCase();
  if (
    lower.includes('past') ||
    lower.includes('closed') ||
    lower.includes('bidding closed') ||
    lower.includes('allotted') ||
    lower.includes('listed')
  ) {
    return true;
  }
  const closeTimeMs = parseIpoDateMs(closeDateStr, true);
  if (closeTimeMs !== null) {
    return Date.now() >= closeTimeMs;
  }
  return false;
}

/**
 * Helper to determine if an IPO bidding period has commenced
 */
export function isBiddingStarted(openDateStr: string): boolean {
  if (!openDateStr || openDateStr === 'TBD' || openDateStr === '—') return false;
  const lower = openDateStr.toLowerCase();
  if (lower.includes('past') || lower.includes('closed') || lower.includes('allotted') || lower.includes('listed')) {
    return true;
  }
  const openTimeMs = parseIpoDateMs(openDateStr, false);
  if (openTimeMs !== null) {
    return Date.now() >= openTimeMs;
  }
  return false;
}

/**
 * Helper to determine if an IPO listing date has arrived or passed
 */
export function isListingDatePast(dateStr?: string | null): boolean {
  if (!dateStr || dateStr === 'TBD' || dateStr === '—' || dateStr === '-' || dateStr.toLowerCase().includes('t+3')) {
    return false;
  }
  const lower = dateStr.toLowerCase();
  if (lower.includes('listed') || lower.includes('past')) {
    return true;
  }
  const ms = parseIpoDateMs(dateStr, false);
  if (ms !== null && ms > 0) {
    return Date.now() >= ms;
  }
  return false;
}

/**
 * Deterministically resolves the lifecycle status of any IPO based on dates
 */
export function resolveIpoLifecycleStatus(
  openDateStr: string,
  closeDateStr: string,
  isExplicitListed = false,
  listingDateStr?: string
): IpoStatus {
  if (isExplicitListed) return 'Listed';
  if (listingDateStr && isListingDatePast(listingDateStr)) return 'Listed';
  if (isBiddingClosed(closeDateStr)) return 'Closed';
  if (isBiddingStarted(openDateStr)) return 'Active';
  return 'Forthcoming';
}
