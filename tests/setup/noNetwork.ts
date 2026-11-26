/**
 * Unit tests never touch the real internet.
 *
 * Several services call live NSE / BSE / InvestorGain / Upstox / Google endpoints
 * and fall back to built-in registry data when those calls fail. Without this guard,
 * test results depended on whether the machine had network access and on what the
 * exchanges happened to list that day (e.g. CI failed once HDFP dropped off the live
 * list, while offline runs passed). Blocking outbound fetches makes every run use
 * the deterministic offline path.
 *
 * Local addresses still work. Set ALLOW_LIVE_NETWORK_TESTS=1 to run against live
 * services on purpose.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const NETWORK_DISABLED_MESSAGE = 'network disabled in unit tests';

if (process.env.ALLOW_LIVE_NETWORK_TESTS !== '1') {
  const realFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      // Relative or malformed URL: let the real fetch raise its own error.
    }
    if (host && !LOCAL_HOSTS.has(host)) {
      throw new TypeError(`${NETWORK_DISABLED_MESSAGE}: ${host} (set ALLOW_LIVE_NETWORK_TESTS=1 to allow)`);
    }
    return realFetch(input, init);
  }) as typeof fetch;
}
