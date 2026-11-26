import { describe, it, expect } from 'vitest';
import { NETWORK_DISABLED_MESSAGE } from './setup/noNetwork';

/**
 * Guards the guard: if tests/setup/noNetwork.ts stops being loaded, live-data
 * tests would silently start depending on the internet again.
 */
describe('unit tests run without live network access', () => {
  it.skipIf(process.env.ALLOW_LIVE_NETWORK_TESTS === '1')('rejects requests to external hosts', async () => {
    await expect(fetch('https://www.nseindia.com/api/ipo-current-issue')).rejects.toThrow(NETWORK_DISABLED_MESSAGE);
    await expect(fetch(new URL('https://api.upstox.com/v2/market-quote/quotes'))).rejects.toThrow(NETWORK_DISABLED_MESSAGE);
  });
});
