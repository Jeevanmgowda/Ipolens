import { AllotmentScanResult, RegistrarInfo, RegistrarSlug } from '@/types/allotment';

export const OFFICIAL_REGISTRARS: RegistrarInfo[] = [
  {
    name: 'Link Intime India Pvt Ltd (MUFG)',
    slug: 'linkintime',
    portalUrl: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
    queryEndpoint: 'https://linkintime.co.in/Initial_Offer/IPO.aspx/SearchOnPan',
    queryParamFormat: 'pan',
    description:
      'Premier registrar for major Mainboard IPOs including Tata Technologies, Bajaj Housing Finance, Swiggy, Premier Energies, and Waaree Energies.',
    mirrors: [
      {
        serverName: 'Server 1 (MUFG / Primary Portal)',
        url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (Link Intime Legacy)',
        url: 'https://linkintime.co.in/initial_offer/public-issues.html',
      },
      {
        serverName: 'Server 3 (Web Client Download)',
        url: 'https://web.linkintime.co.in/client-downloads/IPO_Status_Allotment.aspx',
      },
    ],
  },
  {
    name: 'KFin Technologies Limited',
    slug: 'kfintech',
    portalUrl: 'https://kosmic.kfintech.com/ipostatus/',
    queryEndpoint: 'https://kosmic.kfintech.com/ipostatus/IPOStatus',
    queryParamFormat: 'pan',
    description:
      'Official registrar for National Stock Exchange (NSE), Hyundai Motor India, Hero Motors, Ola Electric, and Brainbees Solutions.',
    mirrors: [
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
      {
        serverName: 'Server 4 (Direct Domain)',
        url: 'https://ipostatus.kfintech.com/',
      },
    ],
  },
  {
    name: 'Bigshare Services Pvt Ltd',
    slug: 'bigshare',
    portalUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
    queryEndpoint: 'https://www.bigshareonline.com/AllotmentStatus.aspx',
    queryParamFormat: 'pan',
    description:
      'Leading registrar for high-growth Mainboard and SME public issues including SpectraA, Arkade Developers, and Netweb Technologies.',
    mirrors: [
      {
        serverName: 'Server 1 (Bigshare Main)',
        url: 'https://www.bigshareonline.com/ipo_Allotment.html',
        isPrimary: true,
      },
      {
        serverName: 'Server 2 (IPO Portal)',
        url: 'https://ipo.bigshareonline.com/',
      },
    ],
  },
  {
    name: 'Cameo Corporate Services Ltd',
    slug: 'cameo',
    portalUrl: 'https://ipo.cameoindia.com/',
    queryEndpoint: 'https://ipo.cameoindia.com/AllotmentStatus',
    queryParamFormat: 'pan',
    description: 'Specialized registrar for prominent SME and select Mainboard offerings.',
    mirrors: [
      {
        serverName: 'Server 1 (Cameo India)',
        url: 'https://ipo.cameoindia.com/',
        isPrimary: true,
      },
    ],
  },
  {
    name: 'Maashitla Securities Pvt Ltd',
    slug: 'maashitla',
    portalUrl: 'https://maashitla.com/allotment-status',
    queryEndpoint: 'https://maashitla.com/allotment-status',
    queryParamFormat: 'pan',
    description: 'Leading registrar for NSE Emerge and BSE SME public issues.',
    mirrors: [
      {
        serverName: 'Server 1 (Maashitla Portal)',
        url: 'https://maashitla.com/allotment-status',
        isPrimary: true,
      },
    ],
  },
  {
    name: 'Skyline Financial Services Pvt Ltd',
    slug: 'skyline',
    portalUrl: 'https://www.skylinerta.com/ipo.php',
    queryEndpoint: 'https://www.skylinerta.com/ipo.php',
    queryParamFormat: 'pan',
    description: 'Trusted registrar managing Mainboard and SME public share allotments.',
    mirrors: [
      {
        serverName: 'Server 1 (Skyline RTA)',
        url: 'https://www.skylinerta.com/ipo.php',
        isPrimary: true,
      },
    ],
  },
];

export const BSE_OFFICIAL_GATEWAY = {
  name: 'BSE India Official Allotment Gateway',
  portalUrl: 'https://www.bseindia.com/investors/appli_check.aspx',
  description: 'Official stock exchange portal to verify allotment for any BSE-listed public issue.',
};

/**
 * Resolves the primary official registrar for a given IPO ticker symbol
 */
export function getRegistrarForSymbol(symbol: string): RegistrarInfo {
  const sym = (symbol || '').toUpperCase().trim();

  // 1. Link Intime / MUFG
  if (
    sym.includes('TATA') ||
    sym.includes('SONA') ||
    sym.includes('BAJAJ') ||
    sym.includes('BAJAJHFL') ||
    sym.includes('PREMIER') ||
    sym.includes('SWIGGY') ||
    sym.includes('WESTERN') ||
    sym.includes('WAAREE') ||
    sym.includes('AFCONS') ||
    sym.includes('ACME') ||
    sym.includes('MANKIND') ||
    sym.includes('JIO') ||
    sym.includes('JPL')
  ) {
    return OFFICIAL_REGISTRARS[0]; // Link Intime
  }

  // 2. KFin Technologies
  if (
    sym.includes('NSE') ||
    sym.includes('HYUNDAI') ||
    sym.includes('HERO') ||
    sym.includes('KRN') ||
    sym.includes('AXIOM') ||
    sym.includes('OLAELEC') ||
    sym.includes('NTPCGREEN') ||
    sym.includes('BRAINBEES') ||
    sym.includes('FIRSTCRY') ||
    sym.includes('IXIGO') ||
    sym.includes('EMCURE') ||
    sym.includes('AWL')
  ) {
    return OFFICIAL_REGISTRARS[1]; // KFin Technologies
  }

  // 3. Bigshare Services
  if (
    sym.includes('SPECTRAA') ||
    sym.includes('ARKADE') ||
    sym.includes('NETWEB') ||
    sym.includes('DOMS') ||
    sym.includes('TRAXCN') ||
    sym.includes('IDEAFORGE') ||
    sym.includes('DEE')
  ) {
    return OFFICIAL_REGISTRARS[2]; // Bigshare Services
  }

  // 4. Cameo
  if (sym.includes('CAMEO') || sym.includes('VISHNU') || sym.includes('RELIABLE')) {
    return OFFICIAL_REGISTRARS[3]; // Cameo
  }

  // 5. Maashitla
  if (sym.includes('MAASHITLA') || sym.includes('CELLECOR') || sym.includes('VISHWAS')) {
    return OFFICIAL_REGISTRARS[4]; // Maashitla
  }

  // 6. Skyline
  if (sym.includes('SKYLINE') || sym.includes('KAY') || sym.includes('BASILIC')) {
    return OFFICIAL_REGISTRARS[5]; // Skyline
  }

  return OFFICIAL_REGISTRARS[0]; // Default Link Intime
}

/**
 * Resolves registrar by slug
 */
export function getRegistrarBySlug(slug: RegistrarSlug): RegistrarInfo {
  return OFFICIAL_REGISTRARS.find((r) => r.slug === slug) || OFFICIAL_REGISTRARS[0];
}

/**
 * Automated Allotment Result Scanner (NLP / Pattern-Matching Engine)
 * Parses raw copied text/HTML output from Link Intime, KFintech, or Bigshare
 * and classifies allotment status (Allotted vs Not Allotted) with target >=95% accuracy.
 */
export function scanRegistrarText(rawText: string): AllotmentScanResult {
  const text = (rawText || '').trim();
  if (!text) {
    return {
      parsedSuccessfully: false,
      status: 'Unknown',
      rawConfidence: 0,
      extractedSnippet: '',
    };
  }

  const lower = text.toLowerCase();

  // 1. Detect Allotted vs Not Allotted
  let status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Unknown' = 'Unknown';
  let confidence = 0.5;

  // Patterns indicating successful allotment
  const positivePatterns = [
    /shares?\s*allotted[:\s]+([1-9]\d*)/i,
    /allotted\s*qty[:\s]+([1-9]\d*)/i,
    /allotment\s*status[:\s]+allotted/i,
    /status[:\s]+allotted/i,
    /successfully\s*allotted/i,
    /allotted\s*shares[:\s]+([1-9]\d*)/i,
    /shares\s*credited[:\s]+([1-9]\d*)/i,
  ];

  // Patterns indicating no allotment / rejection
  const negativePatterns = [
    /shares?\s*allotted[:\s]+0\b/i,
    /allotted\s*qty[:\s]+0\b/i,
    /not\s*allotted/i,
    /non-allotted/i,
    /status[:\s]+non[\s-]*allottee/i,
    /status[:\s]+not\s*allotted/i,
    /unsuccessful/i,
    /technical\s*rejection/i,
    /duplicate\s*pan/i,
    /refund\s*initiated/i,
  ];

  let sharesAllotted = 0;
  let sharesApplied = 0;

  // Check negative matches first or positive
  let negativeMatched = false;
  for (const pattern of negativePatterns) {
    if (pattern.test(text)) {
      negativeMatched = true;
      status = 'Not Allotted';
      confidence = 0.96;
      break;
    }
  }

  if (!negativeMatched) {
    for (const pattern of positivePatterns) {
      const m = text.match(pattern);
      if (m) {
        status = 'Allotted';
        confidence = 0.98;
        if (m[1]) {
          sharesAllotted = parseInt(m[1], 10);
        }
        break;
      }
    }
  }

  // Extract shares applied
  const appliedMatch = text.match(/(?:shares?\s*applied|applied\s*qty|bid\s*qty)[:\s]+(\d+)/i);
  if (appliedMatch && appliedMatch[1]) {
    sharesApplied = parseInt(appliedMatch[1], 10);
  }

  // If shares allotted wasn't captured from pattern but status is Allotted
  if (status === 'Allotted' && sharesAllotted === 0) {
    const qtyMatch = text.match(/(\d+)\s*(?:shares|equity\s*shares)/i);
    if (qtyMatch && qtyMatch[1]) {
      sharesAllotted = parseInt(qtyMatch[1], 10);
    }
  }

  // Extract PAN snippet if present
  const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/i);
  const panMatched = panMatch ? panMatch[0].toUpperCase() : undefined;

  // Extract Application No
  const appNoMatch = text.match(/(?:app(?:lication)?\s*(?:no|number)|bid\s*no)[:\s]+([A-Z0-9_-]+)/i);
  const applicationNo = appNoMatch ? appNoMatch[1] : undefined;

  // Extract Company Name
  const companyMatch = text.match(/(?:company|issue|security)(?:\s*name)?[:\s]+([^\n\r,]+)/i);
  const companyMatched = companyMatch ? companyMatch[1].trim() : undefined;

  // If still unknown, check for general keywords
  if (status === 'Unknown') {
    if (lower.includes('allotted') && !lower.includes('not allotted')) {
      status = 'Allotted';
      confidence = 0.75;
    } else if (lower.includes('refund') || lower.includes('zero')) {
      status = 'Not Allotted';
      confidence = 0.85;
    } else if (lower.includes('under process') || lower.includes('bidding in progress')) {
      status = 'Pending';
      confidence = 0.9;
    }
  }

  return {
    parsedSuccessfully: status !== 'Unknown',
    status,
    sharesApplied: sharesApplied || undefined,
    sharesAllotted: status === 'Not Allotted' ? 0 : sharesAllotted || undefined,
    panMatched,
    applicationNo,
    companyMatched,
    rawConfidence: confidence,
    extractedSnippet: text.slice(0, 160) + (text.length > 160 ? '...' : ''),
  };
}
