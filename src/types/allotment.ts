export type RegistrarSlug =
  | 'linkintime'
  | 'kfintech'
  | 'bigshare'
  | 'cameo'
  | 'maashitla'
  | 'skyline'
  | 'other';

export interface RegistrarServerMirror {
  serverName: string;
  url: string;
  isPrimary?: boolean;
}

export interface RegistrarInfo {
  name: string;
  slug: RegistrarSlug;
  portalUrl: string;
  queryEndpoint?: string;
  queryParamFormat?: string;
  description: string;
  mirrors?: RegistrarServerMirror[];
}

export interface AllotmentScanResult {
  parsedSuccessfully: boolean;
  status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Unknown';
  companyMatched?: string;
  panMatched?: string;
  applicationNo?: string;
  sharesApplied?: number;
  sharesAllotted?: number;
  rawConfidence: number; // 0 to 1
  extractedSnippet: string;
  matchedApplicationId?: string;
}

export interface MultiPanScanResultItem {
  panId: string;
  holderName: string;
  relationship: string;
  panMasked: string;
  broker: string;
  registrarName: string;
  registrarSlug: RegistrarSlug;
  status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Technical Rejection';
  category: string;
  lotsApplied: number;
  sharesApplied: number;
  sharesAllotted: number;
  bidPrice: number;
  allotmentValue: number;
  refundAmount: number;
  applicationNo: string;
  applicationId?: string;
  syncedToDatabase: boolean;
  isSimulation?: boolean;
  sourceBadge?: string;
  registrarUrl?: string;
  message: string;
  scannedAt: string;
}

export interface MultiPanScanSummary {
  symbol: string;
  companyName: string;
  registrarName: string;
  registrarSlug: RegistrarSlug;
  totalPansScanned: number;
  allottedCount: number;
  notAllottedCount: number;
  pendingCount: number;
  totalSharesAllotted: number;
  totalAllotmentValue: number;
  totalRefundAmount: number;
  scannedAt: string;
  items: MultiPanScanResultItem[];
}

export interface SinglePanInquiryResult {
  symbol: string;
  companyName: string;
  pan: string;
  panMasked: string;
  status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Technical Rejection';
  registrarName: string;
  registrarSlug: RegistrarSlug;
  applicantName?: string;
  applicationNo?: string;
  dpClientId?: string;
  category?: string;
  lotsApplied: number;
  sharesApplied: number;
  sharesAllotted: number;
  bidPrice: number;
  allotmentValue: number;
  refundAmount: number;
  message: string;
  sourceBadge: string;
  isSimulation: boolean;
  isOfficialGatewayRequired: boolean;
  directPortalUrl: string;
  mirrors: RegistrarServerMirror[];
  checkedAt: string;
}
