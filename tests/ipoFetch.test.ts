import { describe, it, expect } from 'vitest';
import { IpoFetchService } from '../src/services/ipoFetchService';

describe('IpoFetchService', () => {
  it('should fetch merged IPO records from multi-source pipeline', async () => {
    const records = await IpoFetchService.getMergedIpos(true);
    console.log(`Fetched ${records.length} merged IPO records.`);
    if (records.length > 0) {
      console.log('Sample record:', JSON.stringify(records[0], null, 2));
    }
    expect(Array.isArray(records)).toBe(true);
  }, 20000);
});
