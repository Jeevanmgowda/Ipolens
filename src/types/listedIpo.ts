export interface ListedIpoItem {
  symbol: string;
  ticker: string; // e.g. 'BAJAJHFL.NS'
  companyName: string;
  series: 'EQ' | 'SME';
  listingDate: string;
  issuePrice: number;
  listingPrice: number;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  listingGainPercent: number;
  totalGainPercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  marketCapCr?: number;
  allotmentRegistrar?: string;
}

export interface IpoChartPoint {
  timestamp: number;
  date: string;
  time?: string;
  price: number;
  volume?: number;
}

export interface IpoChartResponse {
  symbol: string;
  companyName?: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
  range: string;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  issuePrice?: number;
  listingPrice?: number;
  points: IpoChartPoint[];
}
