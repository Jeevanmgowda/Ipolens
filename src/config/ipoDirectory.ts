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
  // ─── 2024-25 Mainboard IPOs ───────────────────────────────────────────────
  FIRSTCRY: {
    id: 'firstcry-2024',
    symbol: 'FIRSTCRY',
    displayName: 'Brainbees Solutions Limited (FirstCry)',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 465,
    lotSize: 32,
    allotmentDate: '2024-08-05',
    listingDate: '2024-08-13',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
      { serverName: 'Server 3 (KPrism Mirror)', url: 'https://kprism.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  OLAELEC: {
    id: 'olaelec-2024',
    symbol: 'OLAELEC',
    displayName: 'Ola Electric Mobility Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 76,
    lotSize: 195,
    allotmentDate: '2024-08-05',
    listingDate: '2024-08-09',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
      { serverName: 'Server 3 (KPrism Mirror)', url: 'https://kprism.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  SAGILITY: {
    id: 'sagility-2024',
    symbol: 'SAGILITY',
    displayName: 'Sagility India Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 30,
    lotSize: 500,
    allotmentDate: '2024-11-04',
    listingDate: '2024-11-12',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  KRN: {
    id: 'krn-2024',
    symbol: 'KRN',
    displayName: 'KRN Heat Exchanger and Refrigeration Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 220,
    lotSize: 68,
    allotmentDate: '2024-09-20',
    listingDate: '2024-09-24',
    registrarSlug: 'bigshare',
    registrarName: 'Bigshare Services Pvt Ltd',
    officialPortalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    officialMirrors: [
      { serverName: 'Server 1 (Bigshare Main)', url: 'https://www.bigshareonline.com/ipo_Allotment.html', isPrimary: true },
      { serverName: 'Server 2 (IPO Dedicated Mirror)', url: 'https://ipo.bigshareonline.com/' },
      { serverName: 'Server 3 (High-Traffic Mirror)', url: 'https://ipo2.bigshareonline.com/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  NETWEB: {
    id: 'netweb-2023',
    symbol: 'NETWEB',
    displayName: 'Netweb Technologies India Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 500,
    lotSize: 30,
    allotmentDate: '2023-07-14',
    listingDate: '2023-07-17',
    registrarSlug: 'bigshare',
    registrarName: 'Bigshare Services Pvt Ltd',
    officialPortalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    officialMirrors: [
      { serverName: 'Server 1 (Bigshare Main)', url: 'https://www.bigshareonline.com/ipo_Allotment.html', isPrimary: true },
      { serverName: 'Server 2 (IPO Dedicated Mirror)', url: 'https://ipo.bigshareonline.com/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  AFCONS: {
    id: 'afcons-2024',
    symbol: 'AFCONS',
    displayName: 'Afcons Infrastructure Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 463,
    lotSize: 32,
    allotmentDate: '2024-10-28',
    listingDate: '2024-10-30',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
      { serverName: 'Server 3 (Legacy Redirect Mirror)', url: 'https://linkintime.co.in/initial_offer/public-issues.html' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  ACMESOLAR: {
    id: 'acmesolar-2024',
    symbol: 'ACMESOLAR',
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
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  IREDA: {
    id: 'ireda-2023',
    symbol: 'IREDA',
    displayName: 'Indian Renewable Energy Development Agency Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 32,
    lotSize: 460,
    allotmentDate: '2023-11-21',
    listingDate: '2023-11-29',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  ZINKA: {
    id: 'zinka-2024',
    symbol: 'ZINKA',
    displayName: 'Zinka Logistics Solutions Limited (BlackBuck)',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 273,
    lotSize: 54,
    allotmentDate: '2024-11-18',
    listingDate: '2024-11-22',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  ENVIRO: {
    id: 'enviro-2024',
    symbol: 'ENVIRO',
    displayName: 'Enviro Infra Engineers Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 148,
    lotSize: 101,
    allotmentDate: '2024-11-25',
    listingDate: '2024-11-27',
    registrarSlug: 'bigshare',
    registrarName: 'Bigshare Services Pvt Ltd',
    officialPortalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    officialMirrors: [
      { serverName: 'Server 1 (Bigshare Main)', url: 'https://www.bigshareonline.com/ipo_Allotment.html', isPrimary: true },
      { serverName: 'Server 2 (IPO Dedicated Mirror)', url: 'https://ipo.bigshareonline.com/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  DOMS: {
    id: 'doms-2023',
    symbol: 'DOMS',
    displayName: 'DOMS Industries Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 790,
    lotSize: 18,
    allotmentDate: '2023-12-15',
    listingDate: '2023-12-20',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  JYOTICNC: {
    id: 'jyoticnc-2024',
    symbol: 'JYOTICNC',
    displayName: 'Jyoti CNC Automation Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 331,
    lotSize: 45,
    allotmentDate: '2024-01-22',
    listingDate: '2024-01-25',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  MANKIND: {
    id: 'mankind-2023',
    symbol: 'MANKIND',
    displayName: 'Mankind Pharma Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 1080,
    lotSize: 13,
    allotmentDate: '2023-04-28',
    listingDate: '2023-05-09',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  CONCORDBIO: {
    id: 'concordbio-2023',
    symbol: 'CONCORDBIO',
    displayName: 'Concord Biotech Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 741,
    lotSize: 20,
    allotmentDate: '2023-08-11',
    listingDate: '2023-08-18',
    registrarSlug: 'bigshare',
    registrarName: 'Bigshare Services Pvt Ltd',
    officialPortalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    officialMirrors: [
      { serverName: 'Server 1 (Bigshare Main)', url: 'https://www.bigshareonline.com/ipo_Allotment.html', isPrimary: true },
      { serverName: 'Server 2 (IPO Dedicated Mirror)', url: 'https://ipo.bigshareonline.com/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  NORTHARC: {
    id: 'northarc-2024',
    symbol: 'NORTHARC',
    displayName: 'Northern Arc Capital Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 263,
    lotSize: 57,
    allotmentDate: '2024-09-20',
    listingDate: '2024-09-24',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  SBFC: {
    id: 'sbfc-2023',
    symbol: 'SBFC',
    displayName: 'SBFC Finance Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 57,
    lotSize: 263,
    allotmentDate: '2023-08-07',
    listingDate: '2023-08-16',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  KAYNES: {
    id: 'kaynes-2022',
    symbol: 'KAYNES',
    displayName: 'Kaynes Technology India Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 587,
    lotSize: 25,
    allotmentDate: '2022-11-18',
    listingDate: '2022-11-22',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  WAAREEENER: {
    id: 'waareeener-2024',
    symbol: 'WAAREEENER',
    displayName: 'Waaree Energies Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 1503,
    lotSize: 9,
    allotmentDate: '2024-10-28',
    listingDate: '2024-10-28',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
      { serverName: 'Server 3 (Legacy Redirect Mirror)', url: 'https://linkintime.co.in/initial_offer/public-issues.html' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  DEEDEV: {
    id: 'deedev-2024',
    symbol: 'DEEDEV',
    displayName: 'Dee Development Engineers Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 203,
    lotSize: 73,
    allotmentDate: '2024-06-24',
    listingDate: '2024-06-26',
    registrarSlug: 'linkintime',
    registrarName: 'MUFG Intime India Pvt Ltd (formerly Link Intime)',
    officialPortalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    officialMirrors: [
      { serverName: 'Server 1 (MUFG Intime Primary)', url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html', isPrimary: true },
      { serverName: 'Server 2 (Dedicated Investor Gateway)', url: 'https://idia.in.mpms.mufg.com' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
  },
  WCIL: {
    id: 'wcil-2024',
    symbol: 'WCIL',
    displayName: 'Western Carriers (India) Limited',
    series: 'EQ',
    status: 'Listed',
    issuePrice: 172,
    lotSize: 87,
    allotmentDate: '2024-09-25',
    listingDate: '2024-09-27',
    registrarSlug: 'kfintech',
    registrarName: 'KFin Technologies Limited',
    officialPortalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    officialMirrors: [
      { serverName: 'Server 1 (Kosmic Primary)', url: 'https://kosmic.kfintech.com/ipostatus/', isPrimary: true },
      { serverName: 'Server 2 (RIS KFintech)', url: 'https://ris.kfintech.com/ipostatus/' },
    ],
    bseAllotmentUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
    isSample: false,
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
