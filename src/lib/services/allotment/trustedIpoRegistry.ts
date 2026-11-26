import { TrustedIpoInfo } from './types';
import { getDirectoryIpo, getAllDirectoryIpos } from '@/config/ipoDirectory';
import { getRegistrarForSymbol, OFFICIAL_REGISTRARS } from '@/lib/services/allotmentScanner';
import { findMarketMetadata } from '@/lib/services/nseIpoService';
import { IpoService } from '@/lib/services/ipoService';

export class TrustedIpoRegistry {
  /**
   * Validates that the requested symbol corresponds to a genuine IPO offering,
   * resolving verified registrar portals and mirrors strictly on the server side.
   * Rejects fabricated or arbitrary client targets.
   */
  static async validateAndResolveIpo(symbolOrId: string): Promise<TrustedIpoInfo | null> {
    if (!symbolOrId || typeof symbolOrId !== 'string') return null;

    const cleanSymbol = symbolOrId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanSymbol.length < 2) return null;

    // 1. Authoritative check in SERVER_IPO_DIRECTORY (src/config/ipoDirectory.ts)
    const directoryEntry = getDirectoryIpo(cleanSymbol);
    if (directoryEntry) {
      return {
        id: directoryEntry.id,
        symbol: directoryEntry.symbol,
        companyName: directoryEntry.displayName,
        registrarName: directoryEntry.registrarName,
        registrarSlug: directoryEntry.registrarSlug,
        portalUrl: directoryEntry.officialPortalUrl,
        mirrors: directoryEntry.officialMirrors || [],
        bseAllotmentUrl: directoryEntry.bseAllotmentUrl,
        priceHigh: directoryEntry.issuePrice || 500,
        lotSize: directoryEntry.lotSize || 14,
        status: directoryEntry.status,
        allotmentDate: directoryEntry.allotmentDate,
        isSample: directoryEntry.isSample,
      };
    }

    // 2. Secondary check in NSE market metadata
    const nseMeta = findMarketMetadata(cleanSymbol);
    if (nseMeta) {
      const reg = getRegistrarForSymbol(cleanSymbol);
      return {
        symbol: cleanSymbol,
        companyName: nseMeta.companyName || cleanSymbol,
        registrarName: nseMeta.registrar || reg.name,
        registrarSlug: reg.slug,
        portalUrl: nseMeta.registrarUrl || reg.portalUrl,
        mirrors: reg.mirrors || [],
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
        const reg = getRegistrarForSymbol(cleanSymbol);
        const cleanRegName =
          match.registrar &&
          match.registrar !== 'Official Registrar' &&
          match.registrar !== 'Official Exchange Registrar'
            ? match.registrar
            : reg.name;

        return {
          symbol: cleanSymbol,
          companyName: match.companyName || cleanSymbol,
          registrarName: cleanRegName,
          registrarSlug: reg.slug,
          portalUrl: reg.portalUrl,
          mirrors: reg.mirrors || [],
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
  static getTrustedIposList(): Array<{
    id: string;
    symbol: string;
    companyName: string;
    registrarName: string;
    registrarSlug: string;
    status: string;
    series: string;
    portalUrl: string;
    isSample?: boolean;
  }> {
    return getAllDirectoryIpos().map((entry) => ({
      id: entry.id,
      symbol: entry.symbol,
      companyName: entry.displayName,
      registrarName: entry.registrarName,
      registrarSlug: entry.registrarSlug,
      status: entry.status,
      series: entry.series,
      portalUrl: entry.officialPortalUrl,
      isSample: entry.isSample,
    }));
  }
}
