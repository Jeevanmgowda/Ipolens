/** Shared types for the AllotmentChecker component and its tab panels. */

export interface RealTimeListedIpo {
  id?: string;
  symbol: string;
  companyName: string;
  price: number;
  issuePrice: number;
  listingPrice: number;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  lotSize: number;
  series: 'EQ' | 'SME';
  listingDate: string;
  registrarName: string;
  registrarSlug: 'linkintime' | 'kfintech' | 'bigshare' | 'cameo' | 'maashitla' | 'skyline' | 'other';
  portalUrl?: string;
  isSample?: boolean;
}

export interface FamilyCheckStatusItem {
  id: string;
  name: string;
  relationship: string;
  pan: string;
  panMasked: string;
  status: 'idle' | 'checking' | 'allotted' | 'not_allotted' | 'pending' | 'manual_verification';
  sharesAllotted: number;
  allotmentValue: number;
  refundAmount: number;
  message?: string;
  portalUrl?: string;
}

export type AllotmentTab = 'single' | 'family' | 'notifications' | 'mirrors' | 'parser';

export interface FamilySummary {
  totalPans: number;
  allottedCount: number;
  notAllottedCount: number;
  pendingCount: number;
  manualCount: number;
  totalShares: number;
  totalValue: number;
  totalRefund: number;
}
