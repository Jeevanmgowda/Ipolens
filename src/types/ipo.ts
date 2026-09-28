export type IpoStatus = 'upcoming' | 'open' | 'closed' | 'listed' | 'Active' | 'Forthcoming' | 'Closed' | 'Listed';
export type IssueType = 'regular' | 'sme';
export type IpoSeries = 'EQ' | 'SME';

export interface UnifiedIPO {
  id: string;
  symbol: string;
  companyName: string;
  issueType: IssueType;
  status: 'upcoming' | 'open' | 'closed' | 'listed';
  priceBandMin: number;
  priceBandMax: number;
  lotSize: number;
  openDate: string;
  closeDate: string;
  listingDate?: string;
  issueSizeInCrores?: number;
  subscriptionTotal?: number;
  subscriptionRetail?: number;
  subscriptionHni?: number;
  subscriptionQib?: number;
  registrar?: string;
  instrumentKey?: string; // e.g. NSE_EQ|INE... for listed stocks
  // Hybrid GMP Layer
  gmp: number;
  expectedListingGainPct: number; // Formula: (gmp / priceBandMax) * 100
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveIpoSummary {
  symbol: string;
  companyName: string;
  series: IpoSeries;
  status: IpoStatus;
  issueStartDate: string;
  issueEndDate: string;
  issuePrice: string;
  priceBand?: string;
  lotSize?: string | number;
  issueSize?: string;
  noOfSharesOffered?: string;
  noOfsharesBid?: string;
  noOfTime?: string; // Overall subscription multiple e.g. "1.16"
  isBse?: string;
  gmpEstimate?: number; // Estimated GMP in INR
  gmpPercent?: number;  // Estimated gain %
  registrarName?: string;
  registrarUrl?: string;
  isListed?: boolean;
  listingPrice?: string;
}

export interface BidCategoryDetail {
  category: string;
  noOfSharesOffered: string;
  noOfTime: string; // Subscription multiplier e.g. "0.22"
  noOfsharesBid: string;
  srNo?: string;
}

export interface PricePointBid {
  price: string;
  shares: string;
  percentage?: number;
}

export interface IpoGraphPoint {
  type: string; // Price point e.g. "1785" or "Cut-off"
  value: string; // Percentage / share weight
}

export interface LiveIpoDetail {
  symbol: string;
  companyName: string;
  series: IpoSeries;
  status: IpoStatus;
  issueStartDate: string;
  issueEndDate: string;
  issuePrice: string;
  lotSize: number;
  minInvestment: number;
  issueSizeShares?: string;
  issueSizeCr?: number;
  totalBidReceived?: string;
  timestamp?: string;
  noOfTimesIssueSubscribed?: string;
  bidDetails: BidCategoryDetail[];
  biddingDetails: Record<string, string>;
  graphData: IpoGraphPoint[];
  registrarName: string;
  registrarUrl: string;
  registrarSlug: 'linkintime' | 'kfintech' | 'bigshare' | 'other';
  isListed?: boolean;
  listingPrice?: number | string;
}
