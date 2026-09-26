export type IpoCategoryTab = 'upcoming' | 'open' | 'closed' | 'listed';
export type MarketStatus = 'OPEN' | 'CLOSED';
export type ConnectionStatus = 'LIVE' | 'DEMO' | 'DISCONNECTED';

export interface LiveMarketIpoItem {
  id: string;
  symbol: string;
  companyName: string;
  status: 'Upcoming' | 'Open' | 'Closed' | 'Listed';
  series: 'EQ' | 'SME';
  priceBand: string;
  priceRange?: string; // alias for priceBand
  priceLow: number;
  priceHigh: number;
  lotSize: number;
  minInvestment?: number;
  issueSize: string;
  issueSizeCr?: number;
  openDate: string;
  closeDate: string;
  allotmentDate: string;
  listingDate: string;
  expectedListingDate?: string;
  registrar: string;
  registrarUrl?: string;
  lastUpdated?: string;

  // GMP metrics
  gmp: number;
  gmpPercent: number;

  // Subscription breakdown
  currentSubscription: number;
  retailSubscription: number;
  niiSubscription: number;
  qibSubscription: number;
  employeeSubscription?: number;
  remainingTime?: string;
  isClosingSoon?: boolean;

  // Secondary market metrics (when listed)
  issuePrice?: number;
  listingPrice?: number;
  currentPrice?: number;
  dayChange?: number;
  dayChangePercent?: number;
  volume?: number;
  marketStatus?: 'OPEN' | 'CLOSED';
  isWatchlisted?: boolean;
}

export interface IpoSubscriptionDetails {
  symbol: string;
  companyName: string;
  retail: number;
  nii: number;
  qib: number;
  employee?: number;
  total: number;
  totalSharesBid?: number;
  allotmentDate?: string;
  listingDate?: string;
  recordedAt: string;
}

export interface GmpHistoryPoint {
  date: string;
  time?: string;
  timestamp: number;
  gmp: number;
  gmpPercent?: number;
  estimatedListingPrice?: number;
}

export interface GmpTrendResponse {
  symbol: string;
  companyName: string;
  currentGmp: number;
  gmpChange: number;
  highestGmp: number;
  lowestGmp: number;
  timeframe: '1D' | '7D' | '1M' | 'All';
  points: GmpHistoryPoint[];
  history: GmpHistoryPoint[]; // alias to points
  disclaimer: string;
}

export interface MarketQuoteData {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: string;
  isMock?: boolean;
}

export interface MarketOhlcCandle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveMarketOverviewResponse {
  success: boolean;
  marketStatus: MarketStatus;
  connectionStatus: ConnectionStatus;
  isMock: boolean;
  lastUpdated: string;
  overview: {
    upcomingCount: number;
    openCount: number;
    closingSoonCount: number;
    recentlyListedCount: number;
    totalTrackedCount: number;
  };
  topGainer?: LiveMarketIpoItem;
  topSubscribed?: LiveMarketIpoItem;
  topGmp?: LiveMarketIpoItem;
  alerts?: MarketAlertItem[];
}

export interface MarketAlertItem {
  id: string;
  type: 'SUBSCRIPTION' | 'GMP' | 'CLOSING_SOON' | 'ALLOTMENT' | 'LISTED' | 'PRICE_MOVE';
  title: string;
  message: string;
  symbol: string;
  timestamp: string;
  read: boolean;
}
