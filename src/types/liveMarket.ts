export type IpoCategoryTab = 'upcoming' | 'open' | 'closed' | 'listed';
export type MarketStatus = 'OPEN' | 'CLOSED';
export type ConnectionStatus = 'LIVE' | 'DEMO' | 'DISCONNECTED';

export type IpoLifecycleStatus = 'Upcoming' | 'Open' | 'Closed' | 'Listed';

export interface AiGmpPrediction {
  predictedGainPct: number;
  predictedGmp: number | null;
  lowerPct: number;
  upperPct: number;
  modelVersion: string;
  drivers: Array<{ feature: string; contributionPct: number }>;
  createdAt: string;
}

/** The one API shape for every IPO endpoint. Unknown values are null, never defaulted. */
export interface LiveMarketIpoItem {
  id: string;
  symbol: string;
  companyName: string;
  status: IpoLifecycleStatus;
  series: 'EQ' | 'SME' | 'DEBT';
  priceBand: string;
  priceLow: number | null;
  priceHigh: number | null;
  lotSize: number | null;
  minInvestment?: number | null;
  issueSize: string;
  issueSizeCr?: number | null;
  freshIssueCr?: number | null;
  ofsCr?: number | null;
  ofsPercent?: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  listingDate: string | null;
  registrar: string | null;
  registrarSlug?: string | null;
  exchange?: string | null;
  registrarUrl?: string;
  peRatio?: number | null;
  sector?: string | null;
  rhpUrl?: string | null;
  drhpUrl?: string | null;
  anchorLockin30?: string | null;
  anchorLockin90?: string | null;
  source?: string | null;
  lastUpdated?: string | null;

  // Market GMP (informal grey-market indication, with source + time) and the separate AI prediction
  gmp: number | null;
  gmpPercent: number | null;
  gmpSource?: string | null;
  gmpUpdatedAt?: string | null;
  aiGmp?: AiGmpPrediction | null;

  // Subscription breakdown (latest snapshot)
  currentSubscription: number | null;
  retailSubscription: number | null;
  niiSubscription: number | null;
  qibSubscription: number | null;
  employeeSubscription?: number | null;
  subscriptionUpdatedAt?: string | null;
  listingGainPct?: number | null;
  remainingTime?: string;
  isClosingSoon?: boolean;

  // Secondary market metrics (when listed)
  isListed?: boolean;
  issuePrice?: number | null;
  listingPrice?: number | null;
  currentPrice?: number;
  previousClose?: number;
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

export interface GmpSourceBreakdown {
  sourceName: string;
  gmp: number;
  lastUpdated: string;
  reliability: 'HIGH' | 'MEDIUM' | 'UNOFFICIAL';
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
  sources?: GmpSourceBreakdown[];
  consensusConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceSpreadPct?: number;
  freshnessLabel?: string;
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
