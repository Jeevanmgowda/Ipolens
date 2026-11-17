import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';

export interface DirectoryIpoEntry {
  id: string;
  symbol: string;
  displayName: string;
  series: 'EQ' | 'SME';
  status: 'Upcoming' | 'Open' | 'Closed' | 'Allotment_Out' | 'Listed';
  issuePrice?: number;
  lotSize?: number;
  allotmentDate?: string;
  listingDate?: string;
  registrarSlug: RegistrarSlug;
  registrarName: string;
  officialPortalUrl: string;
  officialMirrors: RegistrarServerMirror[];
  bseAllotmentUrl: string;
  isSample?: boolean;
}

/**
 * Authoritative Server-Side IPO Directory for IPOLENS
 * 
 * Rules:
 * 1. The client browser NEVER supplies registrar URLs or names. All lookup destinations
 *    are resolved exclusively against this server-side registry.
 * 2. Official portals reflect updated registrar domains:
 *    - MUFG Intime India: https://in.mpms.mufg.com/Initial_Offer/public-issues.html
 *    - KFin Technologies: https://kosmic.kfintech.com/ipostatus/
 *    - Bigshare Services: https://www.bigshareonline.com/ipo_Allotment.html
 *    - BSE India Gateway: https://www.bseindia.com/investors/appli_check.aspx
 * 3. Verified public issues are listed below. Sample/test entries are flagged with `isSample: true`.
 */
export const SERVER_IPO_DIRECTORY: Record<string, DirectoryIpoEntry> = {
  SWIGGY: {
    id: 'swiggy-2024',
    symbol: 'SWIGGY',
    displayName: 'Swiggy Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 390,
    lotSize: 38,
    allotmentDate: '2024-11-11',
    listingDate: '2024-11-13',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      {
        serverName: 'Server 1 (MUFG Intime Primary)',
        url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (Dedicated Investor Gateway)',
        url: 'https://idia.in.mpms.mufg.com',
      },
      {
        serverName: 'Server 3 (Legacy Redirect Mirror)',
        url: 'https://linkintime.co.in/initial_offer/public-issues.html',
      },
      {
        serverName: 'Server 4 (Web Client Mirror)',
        url: 'https://web.linkintime.co.in/client-downloads/IPO_Status_Allotment.aspx',
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  HYUNDAI: {
    id: 'hyundai-2024',
    symbol: 'HYUNDAI',
    displayName: 'Hyundai Motor India Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 1960,
    lotSize: 7,
    allotmentDate: '2024-10-18',
    listingDate: '2024-10-22',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      {
        serverName: 'Server 1 (Kosmic Primary)',
        url: 'https://kosmic.kfintech.com/ipostatus/',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (RIS KFintech)',
        url: 'https://ris.kfintech.com/ipostatus/',
      },
      {
        serverName: 'Server 3 (KPrism Mirror)',
        url: 'https://kprism.kfintech.com/ipostatus/',
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  BAJAJHFL: {
    id: 'bajajhfl-2024',
    symbol: 'BAJAJHFL',
    displayName: 'Bajaj Housing Finance Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 70,
    lotSize: 214,
    allotmentDate: '2024-09-12',
    listingDate: '2024-09-16',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      {
        serverName: 'Server 1 (MUFG Intime Primary)',
        url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (Dedicated Investor Gateway)',
        url: 'https://idia.in.mpms.mufg.com',
      },
      {
        serverName: 'Server 3 (Legacy Redirect Mirror)',
        url: 'https://linkintime.co.in/initial_offer/public-issues.html',
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  NTPCGREEN: {
    id: 'ntpcgreen-2024',
    symbol: 'NTPCGREEN',
    displayName: 'NTPC Green Energy Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 108,
    lotSize: 138,
    allotmentDate: '2024-11-25',
    listingDate: '2024-11-27',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      {
        serverName: 'Server 1 (Kosmic Primary)',
        url: 'https://kosmic.kfintech.com/ipostatus/',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (RIS KFintech)',
        url: 'https://ris.kfintech.com/ipostatus/',
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  SPECTRAA: {
    id: 'spectraa-2024',
    symbol: 'SPECTRAA',
    displayName: 'SpectraA Technology Solutions Limited',
    series: 'SME',
    status: 'Listed',
    issuePrice: 85,
    lotSize: 1600,
    allotmentDate: '2024-10-15',
    listingDate: '2024-10-18',
    registrarSlug: 'bigshare',
    registrarName: 'Bigshare Services Pvt Ltd',
    officialPortalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    officialMirrors: [
      {
        serverName: 'Server 1 (Bigshare Main)',
        url: 'https://www.bigshareonline.com/ipo_Allotment.html',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (IPO Dedicated Mirror)',
        url: 'https://ipo.bigshareonline.com/',
      },
      {
        serverName: 'Server 3 (High-Traffic Mirror)',
        url: 'https://ipo2.bigshareonline.com/',
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  TATATECH: {
    id: 'tatatech-2023',
    symbol: 'TATATECH',
    displayName: 'Tata Technologies Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 500,
    lotSize: 30,
    allotmentDate: '2023-11-28',
    listingDate: '2023-11-30',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      {
        serverName: 'Server 1 (MUFG Intime Primary)',
        url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (Dedicated Investor Gateway)',
        url: 'https://idia.in.mpms.mufg.com',
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  ACME: {
    id: 'acme-2024',
    symbol: 'ACME',
    displayName: 'Acme Solar Holdings Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 289,
    lotSize: 51,
    allotmentDate: '2024-11-11',
    listingDate: '2024-11-13',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      {
        serverName: 'Server 1 (Kosmic Primary)',
        url: 'https://kosmic.kfintech.com/ipostatus/',
        isPrimary: true,
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  PREMIERENE: {
    id: 'premierene-2024',
    symbol: 'PREMIERENE',
    displayName: 'Premier Energies Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 450,
    lotSize: 33,
    allotmentDate: '2024-09-02',
    listingDate: '2024-09-04',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      {
        serverName: 'Server 1 (Kosmic Primary)',
        url: 'https://kosmic.kfintech.com/ipostatus/',
        isPrimary: true,
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  ARKADE: {
    id: 'arkade-2024',
    symbol: 'ARKADE',
    displayName: 'Arkade Developers Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 128,
    lotSize: 110,
    allotmentDate: '2024-09-20',
    listingDate: '2024-09-24',
    registrarSlug: 'bigshare',
    registrarName: 'Bigshare Services Pvt Ltd',
    officialPortalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    officialMirrors: [
      {
        serverName: 'Server 1 (Bigshare Main)',
        url: 'https://www.bigshareonline.com/ipo_Allotment.html',
        isPrimary: true,
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  // Sample upcoming issue clearly marked with instructions for updating
  JIOPLAT: {
    id: 'jioplat-sample',
    symbol: 'JIOPLAT',
    displayName: 'Jio Platforms Limited (Sample Issue)',
    series: 'EQ',
    status: 'Upcoming',
    issuePrice: 450,
    lotSize: 33,
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      {
        serverName: 'Server 1 (MUFG Intime Primary)',
        url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
        isPrimary: true,
      },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: true,
  },
};

/**
 * Normalizes input symbol/ID for safe directory lookup
 */
function normalizeSymbol(symbolOrId: string): string {
  return (symbolOrId || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Looks up an IPO entry from the trusted server-side directory.
 * Matches by exact symbol or by matching the entry's `id`.
 */
export function getDirectoryIpo(symbolOrId: string): DirectoryIpoEntry | null {
  if (!symbolOrId || typeof symbolOrId !== 'string') return null;

  const clean = normalizeSymbol(symbolOrId);
  if (!clean) return null;

  // Direct match by symbol
  if (SERVER_IPO_DIRECTORY[clean]) {
    return SERVER_IPO_DIRECTORY[clean];
  }

  // Secondary match by ID or symbol in values
  const entries = Object.values(SERVER_IPO_DIRECTORY);
  for (const entry of entries) {
    if (
      normalizeSymbol(entry.symbol) === clean ||
      normalizeSymbol(entry.id) === clean
    ) {
      return entry;
    }
  }

  return null;
}

/**
 * Returns all active/tracked IPO directory entries formatted for client consumption.
 * Does not expose internal administrative parameters.
 */
export function getAllDirectoryIpos(): DirectoryIpoEntry[] {
  return Object.values(SERVER_IPO_DIRECTORY);
}

/**
 * Programmatic helper to register or update an IPO-to-registrar mapping.
 */
export function registerIpoMapping(entry: DirectoryIpoEntry): void {
  const cleanSymbol = normalizeSymbol(entry.symbol);
  if (!cleanSymbol) throw new Error('Cannot register IPO entry with invalid symbol.');
  SERVER_IPO_DIRECTORY[cleanSymbol] = entry;
}
