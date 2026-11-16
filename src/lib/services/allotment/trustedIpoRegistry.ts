import { TrustedIpoInfo } from './types';
import { getRegistrarForSymbol, OFFICIAL_REGISTRARS } from '@/services/allotmentScanner';
import { findMarketMetadata } from '@/services/nseIpoService';
import { IpoService } from '@/services/ipoService';

// Fallback registry of known Indian IPO issues for server-side validation
const KNOWN_IPO_DIRECTORY: Record<string, Partial<TrustedIpoInfo>> = {
  SWIGGY: {
    symbol: 'SWIGGY',
    companyName: 'Swiggy Limited',
    priceHigh: 390,
    lotSize: 38,
    status: 'Listed',
  },
  JIOPLAT: {
    symbol: 'JIOPLAT',
    companyName: 'Jio Platforms Limited',
    priceHigh: 185,
    lotSize: 80,
    status: 'Upcoming',
  },
  HYUNDAI: {
    symbol: 'HYUNDAI',
    companyName: 'Hyundai Motor India Limited',
    priceHigh: 1960,
    lotSize: 7,
    status: 'Listed',
  },
  BAJAJHFL: {
    symbol: 'BAJAJHFL',
    companyName: 'Bajaj Housing Finance Limited',
    priceHigh: 70,
    lotSize: 214,
    status: 'Listed',
  },
  NTPCGREEN: {
    symbol: 'NTPCGREEN',
    companyName: 'NTPC Green Energy Limited',
    priceHigh: 108,
    lotSize: 138,
    status: 'Listed',
  },
  ACME: {
    symbol: 'ACME',
    companyName: 'Acme Solar Holdings Limited',
    priceHigh: 289,
    lotSize: 51,
    status: 'Listed',
  },
  SPECTRAA: {
    symbol: 'SPECTRAA',
    companyName: 'SpectraA Technology Solutions Limited',
    priceHigh: 85,
    lotSize: 1600,
    status: 'Listed',
  },
  ARKADE: {
    symbol: 'ARKADE',
    companyName: 'Arkade Developers Limited',
    priceHigh: 128,
    lotSize: 110,
    status: 'Listed',
  },
  TATATECH: {
    symbol: 'TATATECH',
    companyName: 'Tata Technologies Limited',
    priceHigh: 500,
    lotSize: 30,
    status: 'Listed',
  },
  NETWEB: {
    symbol: 'NETWEB',
    companyName: 'Netweb Technologies India Limited',
    priceHigh: 500,
    lotSize: 30,
    status: 'Listed',
  },
  OLAELEC: {
    symbol: 'OLAELEC',
    companyName: 'Ola Electric Mobility Limited',
    priceHigh: 76,
    lotSize: 195,
    status: 'Listed',
  },
  FIRSTCRY: {
    symbol: 'FIRSTCRY',
    companyName: 'Brainbees Solutions Limited (FirstCry)',
    priceHigh: 465,
    lotSize: 32,
    status: 'Listed',
  },
  PREMIERENE: {
    symbol: 'PREMIERENE',
    companyName: 'Premier Energies Limited',
    priceHigh: 450,
    lotSize: 33,
    status: 'Listed',
  },
  HDFP: {
    symbol: 'HDFP',
    companyName: 'HD Fire Protect Limited',
    priceHigh: 420,
    lotSize: 35,
    status: 'Closed',
  },
  BLSPOLY: {
    symbol: 'BLSPOLY',
    companyName: 'BLS Polymers Limited',
    priceHigh: 272,
    lotSize: 55,
    status: 'Listed',
  },
};

export class TrustedIpoRegistry {
  /**
   * Validates that the requested symbol corresponds to a genuine IPO offering,
   * resolving verified registrar portals and mirrors strictly on the server side.
   * Rejects fabricated or arbitrary client targets.
   */
  static async validateAndResolveIpo(symbol: string): Promise<TrustedIpoInfo | null> {
    if (!symbol || typeof symbol !== 'string') return null;

    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanSymbol.length < 2) return null;

    // 1. Check verified KNOWN_IPO_DIRECTORY
    const known = KNOWN_IPO_DIRECTORY[cleanSymbol];
    const registrar = getRegistrarForSymbol(cleanSymbol);

    if (known) {
      return {
        symbol: cleanSymbol,
        companyName: known.companyName || cleanSymbol,
        registrarName: registrar.name,
        registrarSlug: registrar.slug,
        portalUrl: registrar.portalUrl,
        mirrors: registrar.mirrors || [],
        priceHigh: known.priceHigh || 500,
        lotSize: known.lotSize || 14,
        status: known.status || 'Closed',
        allotmentDate: known.allotmentDate,
      };
    }

    // 2. Check NSE market metadata
    const nseMeta = findMarketMetadata(cleanSymbol);
    if (nseMeta) {
      return {
        symbol: cleanSymbol,
        companyName: nseMeta.companyName || cleanSymbol,
        registrarName: nseMeta.registrar || registrar.name,
        registrarSlug: registrar.slug,
        portalUrl: nseMeta.registrarUrl || registrar.portalUrl,
        mirrors: registrar.mirrors || [],
        priceHigh: nseMeta.priceHigh || 500,
        lotSize: nseMeta.lotSize || 14,
        status: 'Closed',
        allotmentDate: nseMeta.allotmentDate,
      };
    }

    // 3. Check live IPO service if available
    try {
      const allIpos = await IpoService.getAllIpos();
      const match = allIpos.find(
        (i) => i.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanSymbol
      );
      if (match) {
        const cleanRegName =
          match.registrar &&
          match.registrar !== 'Official Registrar' &&
          match.registrar !== 'Official Exchange Registrar'
            ? match.registrar
            : registrar.name;

        return {
          symbol: cleanSymbol,
          companyName: match.companyName || cleanSymbol,
          registrarName: cleanRegName,
          registrarSlug: registrar.slug,
          portalUrl: registrar.portalUrl,
          mirrors: registrar.mirrors || [],
          priceHigh: match.priceHigh || 500,
          lotSize: match.lotSize || 14,
          status: match.status || 'Closed',
          allotmentDate: match.allotmentDate,
        };
      }
    } catch {
      // Offline fallback
    }

    // Symbol is not an authorized or recognized IPO
    return null;
  }

  /**
   * Returns list of trusted IPOs available for allotment inquiry
   */
  static getTrustedIposList(): Array<{ symbol: string; companyName: string; registrarName: string }> {
    return Object.values(KNOWN_IPO_DIRECTORY).map((item) => {
      const reg = getRegistrarForSymbol(item.symbol || '');
      return {
        symbol: item.symbol || '',
        companyName: item.companyName || '',
        registrarName: reg.name,
      };
    });
  }
}
