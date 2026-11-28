export type PanRelationship = 'Self' | 'Spouse' | 'Parent' | 'Child' | 'HUF' | 'Other';

export interface FamilyPanProfile {
  id: string;
  /** Owning user (set server-side; used by the in-memory fallback store). */
  userId?: string;
  /** Server-only HMAC of the PAN (never sent to clients). */
  panHash?: string;
  name: string;
  relationship: PanRelationship;
  pan: string; // Stored securely, masked on display e.g. "ABCDE****F"
  broker: string; // e.g. "Zerodha", "Groww", "AngelOne", "Upstox", "5paisa"
  dematId?: string; // DP ID / Client ID
  bankUpi?: string; // UPI ID for ASBA mandate
  createdAt: string;
}

export type ApplicationStatus = 'Applied' | 'Mandate Approved' | 'Allotted' | 'Not Allotted' | 'Refunded';

export interface IpoApplication {
  id: string;
  /** Owning user (set server-side; used by the in-memory fallback store). */
  userId?: string;
  ipoSymbol: string;
  companyName: string;
  panId: string;
  panNumber: string; // Masked
  holderName: string;
  relationship: PanRelationship;
  category: 'Retail' | 'sNII' | 'bNII' | 'Employee';
  lots: number;
  shares: number;
  bidPrice: number;
  blockedAmount: number;
  status: ApplicationStatus;
  allottedShares?: number;
  appliedAt: string;
  registrarSlug?: string;
  registrarUrl?: string;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicatePan?: string;
  duplicateHolder?: string;
  existingApplicationId?: string;
  message: string;
}
