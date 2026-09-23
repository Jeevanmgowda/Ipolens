import { describe, it, expect } from 'vitest';
import { parseBrokerCsv, detectBroker } from '../src/services/brokerParser';

describe('Broker CSV Parser & Deduplication Engine', () => {
  it('should correctly detect Zerodha format from headers', () => {
    const headers = ['Instrument', 'ISIN', 'Qty.', 'Avg. cost', 'LTP', 'Cur. val', 'P&L'];
    expect(detectBroker(headers)).toBe('zerodha');
  });

  it('should correctly detect Groww format from headers', () => {
    const headers = ['Stock Name', 'Symbol', 'Shares', 'Avg Price', 'Market Price', 'Invested', 'Current Value'];
    expect(detectBroker(headers)).toBe('groww');
  });

  it('should parse valid Zerodha holdings and compute accurate P&L', () => {
    const csv = `Instrument,ISIN,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.
BAJAJHFL,INE084A01016,214,70.00,128.50,27499.00,12519.00,83.57%
TATATECH,INE142M01025,30,500.00,945.00,28350.00,13350.00,89.00%`;

    const result = parseBrokerCsv(csv, 'zerodha_test.csv');
    expect(result.success).toBe(true);
    expect(result.validHoldingsImported).toBe(2);
    expect(result.duplicateRowsSkipped).toBe(0);

    const holding1 = result.importedHoldings.find((h) => h.symbol === 'BAJAJHFL');
    expect(holding1).toBeDefined();
    expect(holding1?.quantity).toBe(214);
    expect(holding1?.averageBuyPrice).toBe(70);
    expect(holding1?.investedValue).toBe(14980);
    expect(holding1?.currentValue).toBe(27499);
    expect(holding1?.unrealizedPnl).toBe(12519);
    expect(holding1?.isIpoAllotment).toBe(true);
  });

  it('should deduplicate identical transaction rows', () => {
    const csvWithDuplicates = `Instrument,ISIN,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.
INFY,INE009A01021,50,1500.00,1800.00,90000.00,15000.00,20.00%
INFY,INE009A01021,50,1500.00,1800.00,90000.00,15000.00,20.00%
TCS,INE467B01029,20,3400.00,3800.00,76000.00,8000.00,11.76%`;

    const result = parseBrokerCsv(csvWithDuplicates, 'dedup_test.csv');
    expect(result.validHoldingsImported).toBe(2);
    expect(result.duplicateRowsSkipped).toBe(1);
  });

  it('should reject invalid non-positive quantity rows and record error reason', () => {
    const corruptedCsv = `Instrument,ISIN,Qty.,Avg. cost,LTP
RELIANCE,INE002A01018,0,2400.00,2900.00
HDFCBANK,INE040A01034,-5,1400.00,1650.00
WIPRO,INE075A01022,10,450.00,520.00`;

    const result = parseBrokerCsv(corruptedCsv, 'corrupted.csv');
    expect(result.validHoldingsImported).toBe(1);
    expect(result.rejectedRowsCount).toBe(2);
    expect(result.errors[0].reason).toContain('Invalid or non-positive quantity');
  });
});
