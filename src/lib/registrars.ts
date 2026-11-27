/**
 * Single catalogue of IPO registrars (RTAs): display names, official allotment portals and
 * mirrors. Client-safe (no secrets, no server imports): used by ingestion, the allotment
 * gateway and the UI deep-link fallback.
 */

export type RegistrarSlug =
  | 'linkintime'
  | 'kfintech'
  | 'bigshare'
  | 'cameo'
  | 'maashitla'
  | 'skyline'
  | 'purva'
  | 'integrated'
  | 'other';

export interface RegistrarInfo {
  slug: RegistrarSlug;
  name: string;
  portalUrl: string;
  mirrors: string[];
  /** Lower-case fragments matched against registrar names / emails / websites. */
  match: string[];
}

export const BSE_ALLOTMENT_URL = 'https://www.bseindia.com/investors/appli_check.aspx';
export const NSE_ALLOTMENT_URL = 'https://www.nseindia.com/products/content/equities/ipos/ipo_login.htm';

export const REGISTRARS: Record<RegistrarSlug, RegistrarInfo> = {
  linkintime: {
    slug: 'linkintime',
    name: 'MUFG Intime India (formerly Link Intime)',
    portalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    mirrors: ['https://linkintime.co.in/initial_offer/public-issues.html'],
    match: ['mufg', 'mpms', 'link intime', 'linkintime', 'intime'],
  },
  kfintech: {
    slug: 'kfintech',
    name: 'KFin Technologies',
    portalUrl: 'https://ipostatus.kfintech.com/',
    mirrors: ['https://ris.kfintech.com/ipostatus/', 'https://kosmic.kfintech.com/ipostatus/'],
    match: ['kfin', 'karvy'],
  },
  bigshare: {
    slug: 'bigshare',
    name: 'Bigshare Services',
    portalUrl: 'https://ipo.bigshareonline.com/IPO_Status.html',
    mirrors: ['https://www.bigshareonline.com/ipo_Allotment.html'],
    match: ['bigshare'],
  },
  cameo: {
    slug: 'cameo',
    name: 'Cameo Corporate Services',
    portalUrl: 'https://ipo.cameoindia.com/',
    mirrors: [],
    match: ['cameo'],
  },
  maashitla: {
    slug: 'maashitla',
    name: 'Maashitla Securities',
    portalUrl: 'https://maashitla.com/allotment-status/public-issues',
    mirrors: [],
    match: ['maashitla'],
  },
  skyline: {
    slug: 'skyline',
    name: 'Skyline Financial Services',
    portalUrl: 'https://www.skylinerta.com/ipo.php',
    mirrors: [],
    match: ['skyline'],
  },
  purva: {
    slug: 'purva',
    name: 'Purva Sharegistry',
    portalUrl: 'https://www.purvashare.com/investor-service/ipo-query',
    mirrors: [],
    match: ['purva'],
  },
  integrated: {
    slug: 'integrated',
    name: 'Integrated Registry Management Services',
    portalUrl: 'https://ipostatus.integratedregistry.in/',
    mirrors: [],
    match: ['integrated registry', 'integratedindia', 'integratedregistry'],
  },
  other: {
    slug: 'other',
    name: 'Registrar (BSE allotment status)',
    portalUrl: BSE_ALLOTMENT_URL,
    mirrors: [NSE_ALLOTMENT_URL],
    match: [],
  },
};

/** Maps any registrar name, email or website to a known slug ('other' when unknown). */
export function resolveRegistrarSlug(...hints: Array<string | null | undefined>): RegistrarSlug {
  const hay = hints.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return 'other';
  for (const info of Object.values(REGISTRARS)) {
    if (info.match.some((m) => hay.includes(m))) return info.slug;
  }
  return 'other';
}

export function getRegistrar(slug: string | null | undefined): RegistrarInfo {
  return REGISTRARS[(slug as RegistrarSlug) || 'other'] || REGISTRARS.other;
}

/** The one-click deep link shown when automated checking is not possible. */
export function fallbackAllotmentUrl(slug: string | null | undefined): string {
  return getRegistrar(slug).portalUrl;
}
