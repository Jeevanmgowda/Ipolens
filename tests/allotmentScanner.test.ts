import { describe, it, expect } from 'vitest';
import { scanRegistrarText } from '../src/services/allotmentScanner';

describe('Automated Allotment Result Scanner', () => {
  it('should accurately classify positive allotment output from Link Intime', () => {
    const text = `
    Link Intime India Pvt Ltd
    Public Issue: Bajaj Housing Finance Limited
    PAN: ABCDE1234F
    Shares Applied: 214
    Shares Allotted: 214
    Status: Successfully Allotted
    `;

    const result = scanRegistrarText(text);
    expect(result.parsedSuccessfully).toBe(true);
    expect(result.status).toBe('Allotted');
    expect(result.sharesAllotted).toBe(214);
    expect(result.panMatched).toBe('ABCDE1234F');
    expect(result.rawConfidence).toBeGreaterThanOrEqual(0.95);
  });

  it('should accurately classify non-allotment output from KFintech', () => {
    const text = `
    KFin Technologies Limited
    Security: National Stock Exchange of India Ltd
    DP ID / Client ID: 1208160012345678
    Bid Qty: 28
    Allotted Qty: 0
    Status: Non-Allottee / Refund Initiated
    `;

    const result = scanRegistrarText(text);
    expect(result.parsedSuccessfully).toBe(true);
    expect(result.status).toBe('Not Allotted');
    expect(result.sharesAllotted).toBe(0);
    expect(result.rawConfidence).toBeGreaterThanOrEqual(0.95);
  });

  it('should detect technical rejection or duplicate PAN', () => {
    const text = `
    Bigshare Services
    Issue: SpectraA Technology Solutions Ltd
    PAN: ABCDE1234F
    Status: Technical Rejection due to Duplicate PAN Bid
    `;

    const result = scanRegistrarText(text);
    expect(result.status).toBe('Not Allotted');
  });
});
