import { BROWSER_UA } from '@/lib/ingestion/http';

/**
 * Registrar endpoint configuration. Endpoints, headers and response field names live here so a
 * registrar format change is a config edit, not a code change.
 *
 * These are the registrars' public web endpoints. They are undocumented, can change without
 * notice and may be protected by CAPTCHA or bot rules; direct querying is therefore disabled
 * unless REGISTRAR_DIRECT_QUERY=true, and every failure falls back to the deep link (Path B).
 */

export const ADAPTER_TIMEOUT_MS = 8000;
export const CACHE_TTL_SECONDS = 24 * 3600;
export const LOCK_TTL_MS = 30_000;
export const BREAKER_THRESHOLD = 5;
export const BREAKER_WINDOW_SECONDS = 300;
export const MAX_ATTEMPTS = 40;

export const BASE_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Requested-With': 'XMLHttpRequest',
};

export const REGISTRAR_CONFIG = {
  linkintime: {
    companyListUrl: 'https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/GetDetails',
    searchUrl: 'https://in.mpms.mufg.com/Initial_Offer/IPO.aspx/SearchOnPan',
    referer: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    origin: 'https://in.mpms.mufg.com',
    /** Field names seen in the SearchOnPan payload (case-insensitive). */
    fields: {
      allotted: ['allot', 'alloted', 'allotted', 'shares_allotted', 'alloted_shares'],
      applied: ['shares', 'applied', 'shares_applied', 'appliedqty'],
      applicationNo: ['application_no', 'appno', 'applicationno'],
      dpId: ['dpclid', 'dp_id', 'dpid'],
    },
  },
  kfintech: {
    mirrors: ['https://ipostatus.kfintech.com', 'https://ris.kfintech.com/ipostatus'],
    searchPath: '/api/SearchOnPan',
    companyListPath: '/api/GetIPOCompanies',
    fields: {
      allotted: ['allotted', 'alloted', 'allotedshares', 'shares_allotted', 'allottedshares'],
      applied: ['applied', 'appliedshares', 'shares_applied', 'bidqty'],
      applicationNo: ['applicationno', 'application_no', 'appno'],
      dpId: ['dpid', 'dp_id', 'clientid'],
    },
  },
  bigshare: {
    companyPageUrl: 'https://ipo.bigshareonline.com/IPO_Status.html',
    companyListUrl: 'https://ipo1.bigshareonline.com/Data.aspx/FetchIpodetailsCompany',
    searchUrl: 'https://ipo1.bigshareonline.com/Data.aspx/FetchIpodetails',
    referer: 'https://ipo.bigshareonline.com/IPO_Status.html',
    fields: {
      allotted: ['alloted', 'allotted', 'alloted_shares', 'allotment'],
      applied: ['applied', 'applied_shares', 'appliedqty'],
      applicationNo: ['application_no', 'applicationno'],
      dpId: ['dpid', 'dp_id'],
    },
  },
} as const;
