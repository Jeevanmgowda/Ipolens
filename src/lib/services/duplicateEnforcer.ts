import { IpoApplication, DuplicateCheckResult } from '@/types/pan';

/**
 * Mask an Indian PAN card number for privacy compliance:
 * e.g., "ABCDE1234F" -> "ABCDE****F"
 */
export function maskPan(pan: string): string {
  const clean = (pan || '').trim().toUpperCase();
  if (clean.length !== 10) return '*****';
  return `${clean.substring(0, 5)}****${clean.substring(9)}`;
}

/**
 * Validate PAN card format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
 */
export function isValidPan(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test((pan || '').trim().toUpperCase());
}

/**
 * SEBI Duplicate Bid Rule Enforcer
 * Under SEBI ICDR regulations, multiple applications submitted under the same PAN
 * in a single IPO will result in technical rejection of ALL applications under that PAN.
 */
export function checkDuplicatePanBid(
  existingApplications: IpoApplication[],
  panId: string,
  ipoSymbol: string,
  panNumber?: string,
  holderName?: string
): DuplicateCheckResult {
  const cleanSymbol = ipoSymbol.trim().toUpperCase();

  // Check if this PAN ID has already been used for this specific IPO
  const duplicate = existingApplications.find(
    (app) => app.ipoSymbol.toUpperCase() === cleanSymbol && app.panId === panId
  );

  if (duplicate) {
    const masked = maskPan(panNumber || duplicate.panNumber);
    return {
      hasDuplicate: true,
      duplicatePan: masked,
      duplicateHolder: holderName || duplicate.holderName,
      existingApplicationId: duplicate.id,
      message: `SEBI Rule Violation: An application for ${cleanSymbol} has already been logged under PAN (${masked}) for ${holderName || duplicate.holderName}. Multiple applications with the same PAN will be rejected by the registrar.`,
    };
  }

  return {
    hasDuplicate: false,
    message: 'Valid: No duplicate PAN bid detected for this issue.',
  };
}
