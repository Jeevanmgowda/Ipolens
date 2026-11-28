import { describe, it, expect, afterEach, vi } from 'vitest';
import dns from 'dns';
import { assertSafeUrl, isBlockedAddress, safeGet, UnsafeUrlError } from '@/lib/security/safeFetch';

/** SSRF guard used by /api/ipo-logo (docs/security/AUDIT_2026-11-27.md, ipo-logo follow-up). */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '255.255.255.255', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::a9fe:a9fe', 'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '142.250.183.100', '2606:4700:4700::1111'])('allows public %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it.each([
    'http://example.com/logo.png',
    'ftp://example.com/x',
    'file:///etc/passwd',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://169.254.169.254/latest/meta-data/',
    'https://localhost/',
    'https://intranet/',
    'https://db.internal/',
    'https://printer.local/',
    'https://user:pw@example.com/',
    'https://example.com:8443/',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(UnsafeUrlError);
  });

  it('accepts a public https URL', () => {
    expect(assertSafeUrl('https://example.com/favicon.ico').hostname).toBe('example.com');
  });
});

describe('safeGet', () => {
  it('refuses a hostname whose DNS answer is a private or metadata address (rebinding)', async () => {
    vi.spyOn(dns, 'lookup').mockImplementation(((_host: string, _opts: unknown, cb: (...args: unknown[]) => void) => {
      cb(null, [{ address: '169.254.169.254', family: 4 }]);
    }) as unknown as typeof dns.lookup);
    await expect(safeGet('https://metadata.attacker.example/')).rejects.toThrow(/not allowed/);
  });

  it('refuses when any of several DNS answers is private', async () => {
    vi.spyOn(dns, 'lookup').mockImplementation(((_host: string, _opts: unknown, cb: (...args: unknown[]) => void) => {
      cb(null, [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    }) as unknown as typeof dns.lookup);
    await expect(safeGet('https://mixed.attacker.example/')).rejects.toThrow(/not allowed/);
  });

  it('refuses unsafe URLs before any network activity', async () => {
    const lookup = vi.spyOn(dns, 'lookup');
    await expect(safeGet('http://example.com/')).rejects.toThrow(UnsafeUrlError);
    await expect(safeGet('https://127.0.0.1/')).rejects.toThrow(UnsafeUrlError);
    expect(lookup).not.toHaveBeenCalled();
  });
});
