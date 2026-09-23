import { describe, it, expect } from 'vitest';
import { resolveIsinOrSymbol } from '../src/services/isinResolver';

describe('ISIN Resolution Engine', () => {
  it('should resolve standard equity ISINs accurately', () => {
    const reliance = resolveIsinOrSymbol('INE002A01018');
    expect(reliance.symbol).toBe('RELIANCE');
    expect(reliance.companyName).toContain('Reliance Industries');

    const infy = resolveIsinOrSymbol('INE009A01021');
    expect(infy.symbol).toBe('INFY');
  });

  it('should resolve recent IPO ISINs accurately', () => {
    const bajaj = resolveIsinOrSymbol('INE084A01016');
    expect(bajaj.symbol).toBe('BAJAJHFL');

    const tataTech = resolveIsinOrSymbol('INE142M01025');
    expect(tataTech.symbol).toBe('TATATECH');

    const swiggy = resolveIsinOrSymbol('INE000V01018');
    expect(swiggy.symbol).toBe('SWIGGY');
  });

  it('should fallback gracefully to symbol or name when ISIN is unknown', () => {
    const custom = resolveIsinOrSymbol('', 'ZOMATO', 'Zomato Limited');
    expect(custom.symbol).toBe('ZOMATO');
  });
});
