import { REGISTRAR_CONFIG, BASE_HEADERS } from './config';
import { AdapterHttpError, companyKey, fetchWithTimeout, manualOutcome, normalizeRecord, readJsonPayload } from './helpers';
import type { AdapterOutcome, RegistrarAdapter } from './types';

const cfg = REGISTRAR_CONFIG.linkintime;
const headers = { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', Referer: cfg.referer, Origin: cfg.origin };

/** MUFG Intime (formerly Link Intime) public-issue allotment lookup. */
export class LinkIntimeAdapter implements RegistrarAdapter {
  readonly slug = 'linkintime';

  async resolveCompanyId(companyName: string): Promise<string | null> {
    const res = await fetchWithTimeout(cfg.companyListUrl, { method: 'POST', headers, body: '{}' });
    const payload = await readJsonPayload(res);
    const rows = Array.isArray(payload) ? payload : [];
    const want = companyKey(companyName);
    for (const r of rows as Array<Record<string, unknown>>) {
      const name = String(r.companyname ?? r.CompanyName ?? r.company_name ?? '');
      const id = r.company_id ?? r.clientid ?? r.CompanyID ?? r.id;
      if (name && id && (companyKey(name).startsWith(want) || want.startsWith(companyKey(name)))) return String(id);
    }
    return null;
  }

  async checkStatus(companyIdentifier: string, panNumber: string): Promise<AdapterOutcome> {
    try {
      const res = await fetchWithTimeout(cfg.searchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientid: companyIdentifier, PAN: panNumber, IFSC: '', CHKVAL: '1', token: '' }),
      });
      return normalizeRecord(await readJsonPayload(res), cfg.fields);
    } catch (err) {
      if (err instanceof AdapterHttpError) return manualOutcome(err.code, `MUFG Intime could not be queried (${err.message}).`);
      return manualOutcome('HTTP_ERROR', 'MUFG Intime could not be queried.');
    }
  }
}
