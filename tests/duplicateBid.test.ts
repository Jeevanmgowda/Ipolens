import { describe, it, expect } from 'vitest';
import { checkDuplicatePanBid, maskPan, isValidPan } from '../src/services/duplicateEnforcer';
import { IpoApplication } from '../src/types/pan';

describe('SEBI Duplicate Bid Rule Enforcer', () => {
  it('should validate PAN card format correctly', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(true);
    expect(isValidPan('ABC1234F')).toBe(false);
    expect(isValidPan('12345ABCDE')).toBe(false);
  });

  it('should mask PAN cards to standard format ABCDE****F', () => {
    expect(maskPan('ABCDE1234F')).toBe('ABCDE****F');
  });

  it('should block multiple applications under the same PAN for the same IPO', () => {
    const existing: IpoApplication[] = [
      {
        id: 'app_1',
        ipoSymbol: 'NSE',
        companyName: 'National Stock Exchange',
        panId: 'pan_self',
        panNumber: 'ABCDE****F',
        holderName: 'Jeevan M',
        relationship: 'Self',
        category: 'Retail',
        lots: 1,
        shares: 14,
        bidPrice: 1785,
        blockedAmount: 24990,
        status: 'Applied',
        appliedAt: new Date().toISOString(),
      },
    ];

    // Attempting to apply again with pan_self for NSE
    const violation = checkDuplicatePanBid(existing, 'pan_self', 'NSE', 'ABCDE1234F', 'Jeevan M');
    expect(violation.hasDuplicate).toBe(true);
    expect(violation.message).toContain('SEBI Rule Violation');

    // Applying with a different family PAN for the same IPO should be allowed
    const validFamilyBid = checkDuplicatePanBid(existing, 'pan_spouse', 'NSE', 'XYZPK9876M', 'Spouse Name');
    expect(validFamilyBid.hasDuplicate).toBe(false);

    // Applying with the same PAN for a different IPO should be allowed
    const differentIpoBid = checkDuplicatePanBid(existing, 'pan_self', 'SONA', 'ABCDE1234F', 'Jeevan M');
    expect(differentIpoBid.hasDuplicate).toBe(false);
  });
});
