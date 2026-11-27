import { IpoRepository, todayIst } from '@/lib/repositories/ipo.repository';

/**
 * Anchor investor lock-in schedule (SEBI ICDR: 50% of anchor shares locked for 30 days and the
 * remaining 50% for 90 days from allotment). Computed from ingested issue data only.
 */

export interface AnchorLockInRecord {
  symbol: string;
  companyName: string;
  listingDate: string;
  issuePrice: number;
  currentPrice: number | null;
  totalAnchorShares: number;
  totalAnchorValueCr: number;
  anchor30Day: LockInTranche;
  anchor90Day: LockInTranche;
  marqueeAnchors: string[];
  supplyRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  supplyRiskNotice: string;
}

interface LockInTranche {
  expiryDate: string;
  daysRemaining: number;
  sharesUnlocked: number;
  valueCr: number;
  status: 'EXPIRED' | 'IMMINENT' | 'UPCOMING';
}

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000);

function tranche(expiry: string, shares: number, price: number, today: string): LockInTranche {
  const daysRemaining = Math.max(0, daysBetween(today, expiry));
  return {
    expiryDate: expiry,
    daysRemaining,
    sharesUnlocked: shares,
    valueCr: Math.round(((shares * price) / 1e7) * 100) / 100,
    status: expiry < today ? 'EXPIRED' : daysRemaining <= 7 ? 'IMMINENT' : 'UPCOMING',
  };
}

export async function getAnchorLockInSchedule(symbol?: string): Promise<AnchorLockInRecord[]> {
  const today = todayIst();
  const records = await IpoRepository.listAll();
  const out: AnchorLockInRecord[] = [];
  for (const r of records) {
    if (symbol && r.symbol !== symbol.toUpperCase()) continue;
    const { anchorShares, anchorLockin30, anchorLockin90 } = r.extra;
    const price = r.issuePrice ?? r.priceHigh;
    if (!anchorShares || !anchorLockin30 || !anchorLockin90 || !price || r.status !== 'Listed') continue;
    if (anchorLockin90 < todayIst(new Date(Date.now() - 30 * 86400000))) continue; // long past

    const half = Math.floor(anchorShares / 2);
    const t30 = tranche(anchorLockin30, half, price, today);
    const t90 = tranche(anchorLockin90, anchorShares - half, price, today);
    const next = [t30, t90].find((t) => t.status !== 'EXPIRED');
    const gain = r.listingPrice ? (r.listingPrice - price) / price : null;
    const risk: AnchorLockInRecord['supplyRiskLevel'] =
      next?.status === 'IMMINENT' ? (gain !== null && gain > 0.2 ? 'HIGH' : 'MEDIUM') : next ? 'LOW' : 'LOW';

    out.push({
      symbol: r.symbol,
      companyName: r.companyName,
      listingDate: r.listingDate || '',
      issuePrice: price,
      currentPrice: r.listingPrice,
      totalAnchorShares: anchorShares,
      totalAnchorValueCr: Math.round(((anchorShares * price) / 1e7) * 100) / 100,
      anchor30Day: t30,
      anchor90Day: t90,
      marqueeAnchors: [],
      supplyRiskLevel: risk,
      supplyRiskNotice: next
        ? `${(next.sharesUnlocked / 1e5).toFixed(1)} lakh anchor shares (₹${next.valueCr} Cr at issue price) unlock on ${next.expiryDate}.` +
          (gain !== null && gain > 0.2 ? ' Shares listed well above issue price, so anchors may book profits.' : '')
        : 'All anchor lock-in periods have ended.',
    });
  }
  return out.sort((a, b) => a.anchor90Day.expiryDate.localeCompare(b.anchor90Day.expiryDate));
}
