export type SupportedBroker = 'zerodha' | 'groww' | '5paisa' | 'cas' | 'generic';

export interface HoldingItem {
  id: string;
  symbol: string;
  isin: string;
  companyName: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  dayChange?: number;
  dayChangePercent?: number;
  isIpoAllotment: boolean;
  importedFromBroker?: string;
  lastUpdated: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  totalHoldingsCount: number;
  ipoAllotmentCount: number;
  dayPnl: number;
  dayPnlPercent: number;
}

export interface RowParseError {
  rowNumber: number;
  rawRow: Record<string, string>;
  reason: string;
}

export interface CsvImportResult {
  success: boolean;
  brokerDetected: SupportedBroker;
  fileName: string;
  totalRowsProcessed: number;
  validHoldingsImported: number;
  duplicateRowsSkipped: number;
  rejectedRowsCount: number;
  errors: RowParseError[];
  importedHoldings: HoldingItem[];
}
