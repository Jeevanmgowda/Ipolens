import { REGISTRAR_CONFIG, BASE_HEADERS } from './config';
import { AdapterHttpError, companyKey, fetchWithTimeout, manualOutcome, normalizeRecord, readJsonPayload } from './helpers';
import type { AdapterOutcome, RegistrarAdapter } from './types';

const cfg = REGISTRAR_CONFIG.bigshare;
const headers = { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', Referer: cfg.referer };

/** Bigshare Services allotment lookup. */
export class BigshareAdapter implements RegistrarAdapter {
  readonly slug = 'bigshare';

  async resolveCompanyId(companyName: string): Promise<string | null> {
    const res = await fetchWithTimeout(cfg.companyListUrl, { method: 'POST', headers, body: '{}' });
    const payload = await readJsonPayload(res);
    const rows = (Array.isArray(payload) ? payload : []) as Array<Record<string, unknown>>;
    const want = companyKey(companyName);
    const hit = rows.find((r) => {
      const n = companyKey(String(r.CompanyName ?? r.companyname ?? r.Name ?? ''));
      return n && (n.startsWith(want) || want.startsWith(n));
    });
    return hit ? String(hit.CompanyID ?? hit.companyid ?? hit.Id ?? hit.id) : null;
  }

  async checkStatus(companyIdentifier: string, panNumber: string): Promise<AdapterOutcome> {
    try {
      const res = await fetchWithTimeout(cfg.searchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          Applicationno: '',
          Company: companyIdentifier,
          SelectionType: 'PN',
          PanNo: panNumber,
          txtcsdl: '',
          txtDPID: '',
          txtClId: '',
          ddlType: '0',
        }),
      });
      return normalizeRecord(await readJsonPayload(res), cfg.fields);
    } catch (err) {
      if (err instanceof AdapterHttpError) return manualOutcome(err.code, `Bigshare could not be queried (${err.message}).`);
      return manualOutcome('HTTP_ERROR', 'Bigshare could not be queried.');
    }
  }
}
