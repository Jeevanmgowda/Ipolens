import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';

export type AllotmentStatus =
  | 'allotted'
  | 'not_allotted'
  | 'pending'
  | 'unavailable'
  | 'technical_rejection';

export interface RegistrarQueryOptions {
  applicationNo?: string;
  dpClientId?: string;
  price?: number;
  lotSize?: number;
}

export interface AllotmentAdapterResult {
  status: AllotmentStatus;
  sharesAllotted: number;
  sharesApplied?: number;
  applicantName?: string;
  applicationNo?: string;
  dpClientId?: string;
  category?: string;
  explanation: string;
  source: string;
  isOfficialGatewayRequired: boolean;
  directPortalUrl: string;
  mirrors: RegistrarServerMirror[];
  checkedAt: string;
}

export interface TrustedIpoInfo {
  symbol: string;
  companyName: string;
  registrarName: string;
  registrarSlug: RegistrarSlug;
  portalUrl: string;
  mirrors: RegistrarServerMirror[];
  priceHigh: number;
  lotSize: number;
  status: string;
  allotmentDate?: string;
}

export interface AllotmentCheckResult {
  symbol: string;
  companyName: string;
  panMasked: string; // Strictly masked (e.g. ABCDE****F), raw PAN is never returned
  status: AllotmentStatus;
  sharesAllotted: number;
  sharesApplied: number;
  lotSize: number;
  bidPrice: number;
  allotmentValue: number;
  refundAmount: number;
  applicantName?: string;
  applicationNo?: string;
  dpClientId?: string;
  category: string;
  registrarName: string;
  registrarSlug: RegistrarSlug;
  explanation: string;
  sourceBadge: string;
  isOfficialGatewayRequired: boolean;
  directPortalUrl: string;
  mirrors: RegistrarServerMirror[];
  checkedAt: string;
}

