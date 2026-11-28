/**
 * Outbound requests only go to public company hostnames (no IP literals, localhost or internal
 * suffixes), so logo lookups cannot be steered at internal services (SSRF).
 */
export function isSafePublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(h)) return false; // rejects IPv4/IPv6 literals
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(h);
}
