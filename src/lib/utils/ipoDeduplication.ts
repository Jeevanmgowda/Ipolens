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
  'JPL',
  'JIOPLAT',
  'ZETWERK',
  'MONEYVIEW',
  'RENTOMOJO',
  'NSE',
  'MOMSBELIEF',
  'MAHACOAL',
  'CRYSTALCP',
]);

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
 * Normalizes a company name by removing punctuation, spaces, and legal entity suffixes.
 * Allows comparing company names across heterogeneous feeds (e.g. NSE, Upstox, IPOWatch).
 */
export function normalizeCompanyName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(
      /\b(limited|ltd|pvt|private|india|technologies|technology|solutions|services|holdings|holding|industries|industry|corp|corporation|inc|incorporated)\b/gi,
      ''
    )
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Determines whether two IPO records refer to the same underlying entity.
 * Matches on exact symbol OR matching normalized company name (minimum length 4).
 */
export function isSameIpo(
  symA?: string | null,
  nameA?: string | null,
  symB?: string | null,
  nameB?: string | null
): boolean {
  const sA = (symA || '').toUpperCase().trim();
  const sB = (symB || '').toUpperCase().trim();
  if (sA && sB && sA === sB) return true;

  const nA = normalizeCompanyName(nameA);
  const nB = normalizeCompanyName(nameB);
  if (nA && nB && nA.length >= 4 && nB.length >= 4 && nA === nB) {
    return true;
  }

  return false;
}
