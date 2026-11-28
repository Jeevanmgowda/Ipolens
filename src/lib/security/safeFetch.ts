import dns from 'dns';
import https from 'https';
import net from 'net';

/**
 * Outbound HTTPS GET for URLs that are not fully under our control (e.g. icon URLs
 * found in a third-party homepage). Blocks server-side request forgery:
 *  - https only, default port only, no credentials in the URL;
 *  - every resolved address is checked against private, loopback, link-local,
 *    CGNAT, multicast and reserved ranges *inside the socket's DNS lookup*, so a
 *    DNS-rebinding answer cannot slip past an earlier check;
 *  - redirects are followed manually (max 3) and every hop is re-validated;
 *  - response bodies are capped and requests time out.
 * See docs/security/AUDIT_2026-11-27.md (follow-up on /api/ipo-logo).
 */

// IPv4 and IPv6 rules live in separate lists: Node's BlockList also matches IPv4
// lookups against IPv4-mapped IPv6 rules, so a ::ffff:0:0/96 rule would block all of IPv4.
const BLOCKED_V4 = new net.BlockList();
BLOCKED_V4.addSubnet('0.0.0.0', 8, 'ipv4'); // "this" network
BLOCKED_V4.addSubnet('10.0.0.0', 8, 'ipv4'); // private
BLOCKED_V4.addSubnet('100.64.0.0', 10, 'ipv4'); // carrier-grade NAT
BLOCKED_V4.addSubnet('127.0.0.0', 8, 'ipv4'); // loopback
BLOCKED_V4.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local, incl. cloud metadata 169.254.169.254
BLOCKED_V4.addSubnet('172.16.0.0', 12, 'ipv4'); // private
BLOCKED_V4.addSubnet('192.0.0.0', 24, 'ipv4'); // IETF protocol assignments
BLOCKED_V4.addSubnet('192.0.2.0', 24, 'ipv4'); // documentation
BLOCKED_V4.addSubnet('192.168.0.0', 16, 'ipv4'); // private
BLOCKED_V4.addSubnet('198.18.0.0', 15, 'ipv4'); // benchmarking
BLOCKED_V4.addSubnet('198.51.100.0', 24, 'ipv4'); // documentation
BLOCKED_V4.addSubnet('203.0.113.0', 24, 'ipv4'); // documentation
BLOCKED_V4.addSubnet('224.0.0.0', 4, 'ipv4'); // multicast
BLOCKED_V4.addSubnet('240.0.0.0', 4, 'ipv4'); // reserved + broadcast

const BLOCKED_V6 = new net.BlockList();
BLOCKED_V6.addSubnet('64:ff9b::', 96, 'ipv6'); // NAT64 (can map to private IPv4)
BLOCKED_V6.addSubnet('100::', 64, 'ipv6'); // discard
BLOCKED_V6.addSubnet('2001:db8::', 32, 'ipv6'); // documentation
BLOCKED_V6.addSubnet('fc00::', 7, 'ipv6'); // unique local
BLOCKED_V6.addSubnet('fe80::', 10, 'ipv6'); // link-local
BLOCKED_V6.addSubnet('ff00::', 8, 'ipv6'); // multicast

/** Expands an IPv6 address to 8 numeric hextets (handles :: and a trailing dotted IPv4). */
function ipv6Hextets(address: string): number[] {
  let addr = address.toLowerCase();
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    addr = addr.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = addr.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = tail !== undefined ? [...headParts, ...Array(missing).fill('0'), ...tailParts] : headParts;
  return parts.map((p) => parseInt(p || '0', 16));
}

/** True when the address must never be contacted from the server. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true;
  if (family === 4) return BLOCKED_V4.check(address, 'ipv4');

  const h = ipv6Hextets(address);
  if (h.length !== 8 || h.some((x) => Number.isNaN(x))) return true;
  const firstFiveZero = h.slice(0, 5).every((x) => x === 0);
  // ::, ::1 and IPv4-compatible (::a.b.c.d) / IPv4-mapped (::ffff:a.b.c.d, any notation):
  if (firstFiveZero && (h[5] === 0 || h[5] === 0xffff)) {
    if (h[5] === 0 && h[6] === 0) return true; // :: and ::1 (and ::0.0.x.x)
    const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
    return BLOCKED_V4.check(v4, 'ipv4');
  }
  return BLOCKED_V6.check(address, 'ipv6');
}

export class UnsafeUrlError extends Error {}

/** Parses and validates a URL for an outbound request; throws UnsafeUrlError when not allowed. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('Only https URLs are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('Credentials in URLs are not allowed');
  if (url.port && url.port !== '443') throw new UnsafeUrlError('Non-default ports are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedAddress(host)) throw new UnsafeUrlError('Address not allowed');
  if (!net.isIP(host) && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.'))) {
    throw new UnsafeUrlError('Host not allowed');
  }
  return url;
}

/** dns.lookup replacement that refuses blocked addresses (checked at connect time). */
const safeLookup: typeof dns.lookup = ((hostname: string, options: any, callback: any) => {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : options || {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err);
    const list = (addresses as unknown as dns.LookupAddress[]) || [];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return cb(new UnsafeUrlError(`Resolved address for ${hostname} is not allowed`));
    }
    if (opts.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
}) as typeof dns.lookup;

export interface SafeResponse {
  status: number;
  contentType: string;
  body: Buffer;
  finalUrl: string;
}

export interface SafeGetOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

function requestOnce(url: URL, options: Required<Omit<SafeGetOptions, 'maxRedirects'>>): Promise<SafeResponse & { location?: string }> {
  return new Promise((resolve, reject) => {
    // Hard deadline for the whole request (the socket `timeout` only covers idle time).
    const deadline = setTimeout(() => req.destroy(new Error('Request timed out')), options.timeoutMs);
    const done = <T,>(fn: (v: T) => void) => (v: T) => {
      clearTimeout(deadline);
      fn(v);
    };
    resolve = done(resolve);
    reject = done(reject);
    const req = https.get(
      url,
      { headers: options.headers, lookup: safeLookup, timeout: options.timeoutMs },
      (res) => {
        const status = res.statusCode || 0;
        const contentType = String(res.headers['content-type'] || '');
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ status, contentType, body: Buffer.alloc(0), finalUrl: url.toString(), location: res.headers.location });
          return;
        }
        const declared = Number(res.headers['content-length'] || 0);
        if (declared > options.maxBytes) {
          res.destroy();
          reject(new UnsafeUrlError('Response too large'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            res.destroy();
            reject(new UnsafeUrlError('Response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, contentType, body: Buffer.concat(chunks), finalUrl: url.toString() }));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}

/** SSRF-safe HTTPS GET. Rejects on unsafe URLs/addresses, oversize bodies and timeouts. */
export async function safeGet(rawUrl: string, options: SafeGetOptions = {}): Promise<SafeResponse> {
  const settings = {
    timeoutMs: options.timeoutMs ?? 2500,
    maxBytes: options.maxBytes ?? 512 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPOLENS/1.0)', ...(options.headers || {}) },
  };
  const maxRedirects = options.maxRedirects ?? 3;
  let url = assertSafeUrl(rawUrl);
  for (let hop = 0; ; hop++) {
    const res = await requestOnce(url, settings);
    if (!res.location) return res;
    if (hop >= maxRedirects) throw new UnsafeUrlError('Too many redirects');
    url = assertSafeUrl(new URL(res.location, url).toString());
  }
}
