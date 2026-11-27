import { REGISTRAR_CONFIG, BASE_HEADERS } from './config';
import { AdapterHttpError, companyKey, fetchWithTimeout, manualOutcome, normalizeRecord, readJsonPayload } from './helpers';
import type { AdapterOutcome, RegistrarAdapter } from './types';

const cfg = REGISTRAR_CONFIG.kfintech;

/** Random first mirror, one failover to the other (spec: "try the other once before falling back"). */
export function mirrorOrder(random: () => number = Math.random): string[] {
  const mirrors = [...cfg.mirrors];
  if (random() < 0.5) mirrors.reverse();
  return mirrors;
}

/** KFin Technologies allotment lookup with mirror failover. */
export class KFintechAdapter implements RegistrarAdapter {
  readonly slug = 'kfintech';

  constructor(private readonly random: () => number = Math.random) {}

  async resolveCompanyId(companyName: string): Promise<string | null> {
    for (const base of mirrorOrder(this.random)) {
      try {
        const res = await fetchWithTimeout(`${base}${cfg.companyListPath}`, { headers: BASE_HEADERS });
        const rows = (await readJsonPayload(res)) as Array<Record<string, unknown>>;
        const want = companyKey(companyName);
        const hit = (Array.isArray(rows) ? rows : []).find((r) => {
          const n = companyKey(String(r.name ?? r.companyName ?? r.CompanyName ?? ''));
          return n && (n.startsWith(want) || want.startsWith(n));
        });
        if (hit) return String(hit.id ?? hit.clientId ?? hit.ClientId ?? hit.code);
        return null;
      } catch {
        // try the next mirror
      }
    }
    return null;
  }

  async checkStatus(companyIdentifier: string, panNumber: string): Promise<AdapterOutcome> {
    let lastError: AdapterHttpError | null = null;
    for (const base of mirrorOrder(this.random)) {
      try {
        const res = await fetchWithTimeout(`${base}${cfg.searchPath}`, {
          method: 'POST',
          headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', Referer: `${base}/`, Origin: new URL(base).origin },
          body: JSON.stringify({ clientId: companyIdentifier, pan: panNumber, type: 'PAN' }),
        });
        return normalizeRecord(await readJsonPayload(res), cfg.fields);
      } catch (err) {
        lastError = err instanceof AdapterHttpError ? err : new AdapterHttpError('HTTP_ERROR', (err as Error).message);
        // CAPTCHA/format issues will not be fixed by another mirror only if both share them; still try once.
      }
    }
    return manualOutcome(lastError?.code ?? 'HTTP_ERROR', `KFintech could not be queried (${lastError?.message ?? 'unknown error'}).`);
  }
}
