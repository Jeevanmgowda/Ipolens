/** Shared contracts for the allotment engine (see the Allotment Checker architecture plan). */

export type AllotmentStatus = 'ALLOTTED' | 'NOT_ALLOTTED' | 'PENDING' | 'MANUAL_VERIFICATION_REQUIRED';

/** Final states are the only ones cached or persisted. */
export const FINAL_STATUSES: ReadonlySet<AllotmentStatus> = new Set(['ALLOTTED', 'NOT_ALLOTTED']);

export type AllotmentErrorCode =
  | 'NOT_PUBLISHED'
  | 'DIRECT_QUERY_DISABLED'
  | 'UNSUPPORTED_REGISTRAR'
  | 'COMPANY_NOT_FOUND'
  | 'HTTP_ERROR'
  | 'TIMEOUT'
  | 'CAPTCHA_OR_HTML'
  | 'MALFORMED_RESPONSE'
  | 'CIRCUIT_OPEN'
  | 'LOCKED'
  | 'INVALID_PAN';

export interface AllotmentResult {
  symbol: string;
  /** Always masked (ABCDE****F). Raw PANs never leave the server. */
  panNumber: string;
  status: AllotmentStatus;
  sharesApplied: number;
  sharesAllotted: number;
  applicationNumber?: string;
  dpId?: string;
  message: string;
  /** Registrar portal for one-click manual verification (Path B). */
  fallbackUrl: string;
  registrar: string;
  source: 'registrar' | 'cache' | 'database' | 'fallback';
  errorCode?: AllotmentErrorCode;
  checkedAt: string;
}

/** What an adapter reports; the gateway adds symbol, masking, applied shares and bookkeeping. */
export interface AdapterOutcome {
  status: AllotmentStatus;
  sharesAllotted?: number;
  sharesApplied?: number;
  applicationNumber?: string;
  dpId?: string;
  message: string;
  errorCode?: AllotmentErrorCode;
}

export interface RegistrarAdapter {
  readonly slug: string;
  checkStatus(companyIdentifier: string, panNumber: string): Promise<AdapterOutcome>;
  /** Looks up the registrar's internal company id from the issuer name, when the registrar exposes a list. */
  resolveCompanyId?(companyName: string): Promise<string | null>;
}
