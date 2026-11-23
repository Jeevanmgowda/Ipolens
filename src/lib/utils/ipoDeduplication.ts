/**
 * IPO Data Deduplication and Authenticity Filter
 * Ensures zero duplicate or synthetic/false IPO records across all data feeds.
 */

export const FALSE_OR_DEMO_SYMBOLS = new Set<string>([
  'DEMOTECH',
  'DEMOSME',
  'DEMODEBT',
  'DEMOCLOSED',
  'DEMOLISTED',
  'ZETWERK',
  'MONEYVIEW',
  'RENTOMOJO',
  'NSE',
  'MOMSBELIEF',
  'MAHACOAL',
  'CRYSTALCP',
  'WATRANRENT',
]);

/**
 * Known canonical mappings between raw feed tickers, scraped symbols, and official NSE symbols
 */
export const KNOWN_SYMBOL_ALIASES: Record<string, string[]> = {
  WATRANRENT: ['WATRANA'],
  WATRANA: ['WATRANRENT'],
  CRYSTALCP: ['CRYSTCP'],
  CRYSTCP: ['CRYSTALCP'],
  MAHACOAL: ['MAHANACOAL'],
  MAHANACOAL: ['MAHACOAL'],
  JIOPLAT: ['JIOFIN', 'JPL'],
  JIOFIN: ['JIOPLAT', 'JPL'],
  ZINKA: ['BLACKBUCK'],
  BLACKBUCK: ['ZINKA'],
  ENVIRO: ['EIEL'],
  EIEL: ['ENVIRO'],
};

/**
 * Returns canonical exchange symbol for any aliased or legacy ticker
 */
export function getCanonicalSymbol(symbol?: string | null): string {
  if (!symbol) return '';
  const clean = symbol.toUpperCase().trim();
  const canonicalMap: Record<string, string> = {
    WATRANRENT: 'WATRANA',
    CRYSTALCP: 'CRYSTCP',
    MAHACOAL: 'MAHANACOAL',
    ZINKA: 'BLACKBUCK',
    ENVIRO: 'EIEL',
  };
  return canonicalMap[clean] || clean;
}

/**
 * Checks whether a given symbol is a demo, synthetic, or known false IPO.
 */
export function isFalseOrDemoSymbol(symbol?: string | null): boolean {
  if (!symbol) return false;
  const sym = symbol.toUpperCase().trim();
  if (sym.startsWith('DEMO')) return true;
  return FALSE_OR_DEMO_SYMBOLS.has(sym);
}

/**
 * Normalizes a company name by removing punctuation, spaces, and legal/offering entity suffixes.
 * Allows comparing company names across heterogeneous feeds (e.g. NSE, Upstox, IPOWatch).
 */
export function normalizeCompanyName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(
      /\b(limited|ltd|pvt|private|india|technologies|technology|solutions|services|holdings|holding|industries|industry|corp|corporation|inc|incorporated|ipo|issue|offering|public|shares|share|equity)\b/gi,
      ''
    )
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Determines whether two IPO records refer to the same underlying entity.
 * Matches on exact symbol, known alias, normalized company name, or high-confidence name containment.
 */
export function isSameIpo(
  symA?: string | null,
  nameA?: string | null,
  symB?: string | null,
  nameB?: string | null
): boolean {
  const sA = (symA || '').toUpperCase().trim();
  const sB = (symB || '').toUpperCase().trim();
  if (sA && sB) {
    if (sA === sB) return true;
    if (KNOWN_SYMBOL_ALIASES[sA]?.includes(sB) || KNOWN_SYMBOL_ALIASES[sB]?.includes(sA)) {
      return true;
    }
  }

  const nA = normalizeCompanyName(nameA);
  const nB = normalizeCompanyName(nameB);
  if (nA && nB) {
    if (nA.length >= 4 && nB.length >= 4 && nA === nB) {
      return true;
    }
    // High-confidence containment/prefix match for root corporate names (e.g. "watrana" and "watranarentals")
    if (nA.length >= 6 && nB.length >= 6 && (nA.startsWith(nB) || nB.startsWith(nA) || nA.includes(nB) || nB.includes(nA))) {
      return true;
    }
  }

  return false;
}
