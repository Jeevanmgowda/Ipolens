import { LiveMarketIpoItem } from '@/types/liveMarket';
import {
  fetchLiveNseIpos,
  calculateRemainingTime,
  isBiddingClosed,
  isListingDatePast,
  findMarketMetadata,
} from './nseIpoService';
import { fetchLiveListedIpos, LISTED_IPOS_REGISTRY } from './listedIpoService';
import { IpoAggregatorService } from '@/lib/services/ipo-aggregator.service';
import { UpstoxIpoService } from '@/lib/services/upstox-ipo.service';

/**
 * Universal evaluator to determine if an IPO is officially listed on the secondary market.
 * Moves IPOs whose listing dates have arrived or passed from closed/past into the listed category.
 */
export function isIpoListed(ipo: {
  symbol?: string;
  companyName?: string;
  status?: string;
  isListed?: boolean;
  listingDate?: string;
  expectedListingDate?: string;
  remainingTime?: string;
  listingPrice?: number | string;
  currentPrice?: number;
  dayChange?: number;
}): boolean {
  if (ipo.status === 'Listed' || ipo.isListed === true) return true;
  const rem = (ipo.remainingTime || '').toLowerCase();
  if (rem.includes('listed')) return true;

  const sym = (ipo.symbol || '').toUpperCase().trim();
  if (sym && LISTED_IPOS_REGISTRY.some((l) => l.symbol.toUpperCase() === sym)) {
    return true;
  }

  // If it has actual trading price / listing price from secondary market
  if (
    (typeof ipo.currentPrice === 'number' && ipo.currentPrice > 0 && ipo.dayChange !== undefined) ||
    (typeof ipo.listingPrice === 'number' && ipo.listingPrice > 0 && ipo.status !== 'Upcoming' && ipo.status !== 'Open')
  ) {
    if (rem.includes('listed') || (ipo.listingDate && isListingDatePast(ipo.listingDate))) {
      return true;
    }
  }

  return false;
}

export interface IPODataProvider {
  name: string;
  getAllIpos(): Promise<LiveMarketIpoItem[]>;
  getUpcomingIpos(): Promise<LiveMarketIpoItem[]>;
  getOpenIpos(): Promise<LiveMarketIpoItem[]>;
  getClosedIpos(): Promise<LiveMarketIpoItem[]>;
  getListedIpos(): Promise<LiveMarketIpoItem[]>;
  getIpoDetails(idOrSymbol: string): Promise<LiveMarketIpoItem | null>;
}

/**
 * Production-Ready Upstox API v2 & Hybrid GMP Primary Market Data Provider
 * Ingests live telemetry from official Upstox Developer API v2 and Grey Market tracker.
 */
export class NSEIPOProvider implements IPODataProvider {
  name = 'Upstox v2 & Hybrid GMP Exchange Pipeline';

  async getAllIpos(): Promise<LiveMarketIpoItem[]> {
    // 1. Ingest official Upstox Primary Market API feed if active
    let upstoxIpos: LiveMarketIpoItem[] = [];
    try {
      const [openRaw, upcRaw, closedRaw, listedRawUpstox] = await Promise.all([
        UpstoxIpoService.fetchLiveFromUpstox('open'),
        UpstoxIpoService.fetchLiveFromUpstox('upcoming'),
        UpstoxIpoService.fetchLiveFromUpstox('closed'),
        UpstoxIpoService.fetchLiveFromUpstox('listed'),
      ]);
      const allUpstox = [...openRaw, ...upcRaw, ...closedRaw, ...listedRawUpstox];
      if (allUpstox.length > 0) {
        // Collect instrument keys for all listed Upstox IPOs to batch-fetch real-time quotes
        const listedKeys: string[] = [];
        allUpstox.forEach((u) => {
          if (u.status === 'listed') {
            if (u.isin) {
              listedKeys.push(`NSE_EQ|${u.isin}`, `BSE_EQ|${u.isin}`);
            }
            if (u.symbol) {
              listedKeys.push(`NSE_EQ|${u.symbol}`, `BSE_EQ|${u.symbol}`);
            }
          }
        });

        const quotesMap = listedKeys.length > 0 ? await UpstoxIpoService.getMarketQuotes(listedKeys) : {};

        upstoxIpos = await Promise.all(
          allUpstox.map(async (u) => {
            const isListed = u.status === 'listed';
            const isinKeyNse = u.isin ? `NSE_EQ|${u.isin}` : '';
            const isinKeyBse = u.isin ? `BSE_EQ|${u.isin}` : '';
            const symKeyNse = u.symbol ? `NSE_EQ|${u.symbol}` : '';
            const symKeyBse = u.symbol ? `BSE_EQ|${u.symbol}` : '';

            const quote = quotesMap[u.symbol || '']
              || (isinKeyNse ? quotesMap[isinKeyNse] : undefined)
              || (isinKeyBse ? quotesMap[isinKeyBse] : undefined)
              || (symKeyNse ? quotesMap[symKeyNse] : undefined)
              || (symKeyBse ? quotesMap[symKeyBse] : undefined);

            const issuePriceNum = u.cutOffPrice || u.priceBandMax || u.priceBandMin || 100;
            const listingPriceNum = u.listingPrice || quote?.open || issuePriceNum;
            const currentPriceNum = quote?.last_price ?? (isListed ? listingPriceNum : undefined);
            const dayChangeNum = quote?.net_change ?? (isListed ? 0 : undefined);
            const dayChangePercentNum = quote?.day_change_percent ?? (isListed ? 0 : undefined);
            const volumeNum = quote?.volume ?? (isListed ? 0 : undefined);

            const gmp = isListed && currentPriceNum
              ? Math.round(currentPriceNum - issuePriceNum)
              : await IpoAggregatorService.getGmpForSymbol(
                  u.symbol || '',
                  u.priceBandMax || 100,
                  u.issueType || 'regular'
                );
            const maxPrice = u.priceBandMax || issuePriceNum;
            const gmpPercent = isListed && currentPriceNum && issuePriceNum > 0
              ? Number((((currentPriceNum - issuePriceNum) / issuePriceNum) * 100).toFixed(2))
              : (maxPrice > 0 ? Number(((gmp / maxPrice) * 100).toFixed(2)) : 0);

            const statusStr: 'Upcoming' | 'Open' | 'Closed' | 'Listed' =
              u.status === 'open'
                ? 'Open'
                : u.status === 'upcoming'
                ? 'Upcoming'
                : u.status === 'listed'
                ? 'Listed'
                : 'Closed';

            const formattedDates = {
              open: u.openDate || 'TBD',
              close: u.closeDate || 'TBD',
              listing: u.listingDate || (isListed ? 'Recent Listing' : 'TBD'),
            };

            return {
              id: u.id || `${(u.symbol || 'ipo').toLowerCase()}-ipo`,
              symbol: (u.symbol || 'IPO').toUpperCase(),
              companyName: u.companyName || u.symbol || 'Unknown Company',
              status: statusStr,
              series: u.issueType === 'sme' ? 'SME' : 'EQ',
              priceBand:
                u.priceBandMin === u.priceBandMax
                  ? `₹${u.priceBandMax}`
                  : `₹${u.priceBandMin} – ₹${u.priceBandMax}`,
              priceLow: u.priceBandMin || 100,
              priceHigh: u.priceBandMax || 100,
              lotSize: u.lotSize || 14,
              issueSize: u.issueSizeInCrores ? `₹${u.issueSizeInCrores} Cr` : '—',
              openDate: formattedDates.open,
              closeDate: formattedDates.close,
              allotmentDate: formattedDates.listing || formattedDates.close,
              listingDate: formattedDates.listing,
              expectedListingDate: formattedDates.listing,
              registrar: u.registrar || 'Official Registrar',
              gmp,
              gmpPercent,
              currentSubscription: u.subscriptionTotal || 0,
              retailSubscription: u.subscriptionRetail || 0,
              niiSubscription: u.subscriptionHni || 0,
              qibSubscription: u.subscriptionQib || 0,
              issuePrice: issuePriceNum,
              listingPrice: listingPriceNum,
              currentPrice: currentPriceNum,
              dayChange: dayChangeNum,
              dayChangePercent: dayChangePercentNum,
              volume: volumeNum,
              marketStatus: 'OPEN',
            };
          })
        );
      }
    } catch (err: any) {
      console.warn('[NSEIPOProvider] Upstox primary feed notice:', err.message);
    }

    const [liveRaw, listedRaw] = await Promise.all([
      fetchLiveNseIpos(),
      fetchLiveListedIpos(),
    ]);

    const items: LiveMarketIpoItem[] = [...upstoxIpos];
    const seenSymbols = new Set(items.map((i) => i.symbol.toUpperCase()));

    // 1. Process Live, Forthcoming, and Closed issues from NSE
    for (const raw of liveRaw) {
      if (!raw.symbol) continue;
      const symUpper = raw.symbol.toUpperCase();
      if (seenSymbols.has(symUpper)) continue;
      seenSymbols.add(symUpper);

      const meta = findMarketMetadata(raw.symbol) || findMarketMetadata(raw.companyName);
      const isActuallyListed = Boolean(
        raw.isListed ||
        raw.status === 'Listed' ||
        LISTED_IPOS_REGISTRY.some((l) => l.symbol.toUpperCase() === raw.symbol.toUpperCase()) ||
        listedRaw.some((l) => l.symbol.toUpperCase() === raw.symbol.toUpperCase())
      );

      const computedRemainingTime = raw.remainingTime || calculateRemainingTime(raw.issueEndDate);
      const isClosedIssue =
        !isActuallyListed &&
        (raw.status === 'Closed' ||
          computedRemainingTime === 'Bidding Closed' ||
          isBiddingClosed(raw.issueEndDate));

      let status: 'Upcoming' | 'Open' | 'Closed' | 'Listed' = 'Closed';
      if (isActuallyListed) {
        status = 'Listed';
      } else if (isClosedIssue) {
        status = 'Closed';
      } else if (raw.status === 'Active') {
        status = 'Open';
      } else if (raw.status === 'Forthcoming') {
        status = 'Upcoming';
      } else {
        status = 'Closed';
      }

      // Parse price band numbers safely without comma splitting
      const cleanPriceStr = (raw.priceBand || raw.issuePrice || '100').replace(/,/g, '');
      const prices = cleanPriceStr.match(/\d+(?:\.\d+)?/g) || ['100'];
      const priceLow = raw.priceLow !== undefined ? raw.priceLow : (parseFloat(prices[0]) || 100);
      const priceHigh = raw.priceHigh !== undefined ? raw.priceHigh : (parseFloat(prices[prices.length - 1]) || priceLow);
      const lotSize = typeof raw.lotSize === 'number'
        ? raw.lotSize
        : parseInt(String(raw.lotSize || '14').replace(/,/g, ''), 10) || 14;

      const totalSub = typeof raw.noOfTime === 'string'
        ? (parseFloat(raw.noOfTime) || 0)
        : (typeof raw.noOfTime === 'number' ? raw.noOfTime : 0);

      // Real category subscription from verified exchange feeds
      const qibSub = raw.qibSubscription !== undefined ? raw.qibSubscription : 0;
      const niiSub = raw.niiSubscription !== undefined ? raw.niiSubscription : 0;
      const retailSub = raw.retailSubscription !== undefined ? raw.retailSubscription : 0;
      const employeeSub = raw.employeeSubscription !== undefined ? raw.employeeSubscription : 0;

      // Resolve secondary market figures if listed
      const listedMatch = listedRaw.find((l) => l.symbol.toUpperCase() === raw.symbol.toUpperCase()) ||
        LISTED_IPOS_REGISTRY.find((l) => l.symbol.toUpperCase() === raw.symbol.toUpperCase());
      const parsedListPrice = parseFloat(raw.listingPrice?.replace(/[^0-9.]/g, '') || '') || priceHigh;
      const issuePriceVal = isActuallyListed ? (listedMatch?.issuePrice || priceHigh) : priceHigh;
      const listingPriceVal = isActuallyListed ? (listedMatch?.listingPrice || parsedListPrice) : undefined;
      const currentPriceVal = isActuallyListed ? ((listedMatch as any)?.currentPrice || listingPriceVal) : undefined;
      const dayChangeVal = isActuallyListed ? ((listedMatch as any)?.dayChange || 0) : undefined;
      const dayChangePercentVal = isActuallyListed ? ((listedMatch as any)?.dayChangePercent || 0) : undefined;
      const volumeVal = isActuallyListed ? ((listedMatch as any)?.volume || 0) : undefined;

      const isDebt = raw.series === 'DEBT';
      const gmp = isDebt ? 0 : (raw.gmpEstimate || 0);
      const gmpPercent = isDebt ? 0 : (raw.gmpPercent || 0);

      const effectiveRemainingTime = isActuallyListed
        ? 'Listed on Exchange'
        : (isClosedIssue ? 'Bidding Closed' : (computedRemainingTime || 'Upcoming'));

      const issueSizeFormatted = raw.issueSize
        ? (raw.issueSize.includes('Cr')
            ? (raw.issueSize.startsWith('₹') ? raw.issueSize : `₹${raw.issueSize}`)
            : `₹${raw.issueSize} Cr`)
        : '—';

      const minInvestment = raw.minInvestment !== undefined
        ? raw.minInvestment
        : (priceHigh * lotSize);

      items.push({
        id: raw.symbol.toLowerCase(),
        symbol: raw.symbol.toUpperCase(),
        companyName: raw.companyName,
        status,
        series: raw.series || 'EQ',
        priceBand: raw.priceBand || raw.issuePrice || `₹${priceLow} - ₹${priceHigh}`,
        priceLow,
        priceHigh,
        lotSize,
        minInvestment,
        issueSize: issueSizeFormatted,
        openDate: raw.issueStartDate || 'TBD',
        closeDate: raw.issueEndDate || 'TBD',
        allotmentDate: isActuallyListed ? 'Allotted' : (raw.issueEndDate || 'TBD'),
        listingDate: isActuallyListed ? (listedMatch?.listingDate || meta?.listingDate || 'Listed on Exchange') : (meta?.listingDate || 'TBD'),
        expectedListingDate: isActuallyListed ? 'Listed on Exchange' : (meta?.listingDate || (raw.issueEndDate ? 'T+3 Trading Days' : 'TBD')),
        registrar: raw.registrarName || 'Link Intime India Pvt Ltd',
        registrarUrl: raw.registrarUrl,
        gmp,
        gmpPercent,
        currentSubscription: totalSub,
        retailSubscription: retailSub,
        niiSubscription: niiSub,
        qibSubscription: qibSub,
        employeeSubscription: employeeSub,
        remainingTime: effectiveRemainingTime,
        isClosingSoon: status === 'Open' && Boolean(computedRemainingTime?.includes('Hours Left')),
        issuePrice: issuePriceVal,
        listingPrice: listingPriceVal,
        currentPrice: currentPriceVal,
        dayChange: dayChangeVal,
        dayChangePercent: dayChangePercentVal,
        volume: volumeVal,
        marketStatus: 'OPEN',
      });
    }

    // 2. Process Listed IPOs
    for (const l of listedRaw) {
      const existing = items.find((i) => i.symbol === l.symbol.toUpperCase());
      if (existing) {
        existing.status = 'Listed';
        if (l.currentPrice !== undefined && l.currentPrice !== null) existing.currentPrice = l.currentPrice;
        if (l.dayChange !== undefined && l.dayChange !== null) existing.dayChange = l.dayChange;
        if (l.dayChangePercent !== undefined && l.dayChangePercent !== null) existing.dayChangePercent = l.dayChangePercent;
        if (l.volume !== undefined && l.volume !== null && l.volume > 0) existing.volume = l.volume;
        if (l.listingPrice) existing.listingPrice = l.listingPrice;
        if (l.issuePrice) existing.issuePrice = l.issuePrice;
        if (l.listingDate && (!existing.listingDate || existing.listingDate === 'TBD' || existing.listingDate === 'Recent Listing')) {
          existing.listingDate = l.listingDate;
        }
        continue;
      }

      items.push({
        id: l.symbol.toLowerCase(),
        symbol: l.symbol.toUpperCase(),
        companyName: l.companyName,
        status: 'Listed',
        series: l.series || 'EQ',
        priceBand: `₹${l.issuePrice}`,
        priceLow: l.issuePrice,
        priceHigh: l.issuePrice,
        lotSize: l.lotSize || 14,
        minInvestment: l.issuePrice * (l.lotSize || 14),
        issueSize: l.issueSize || '—',
        openDate: 'Past Issue',
        closeDate: 'Past Issue',
        allotmentDate: 'Allotted',
        listingDate: l.listingDate,
        expectedListingDate: l.listingDate,
        registrar: l.allotmentRegistrar || 'Link Intime India Pvt Ltd',
        gmp: Math.round(l.listingPrice - l.issuePrice),
        gmpPercent: l.listingGainPercent,
        currentSubscription: l.subscriptionTotal || 0,
        retailSubscription: l.subscriptionRetail || 0,
        niiSubscription: l.subscriptionNii || 0,
        qibSubscription: l.subscriptionQib || 0,
        employeeSubscription: 0,
        issuePrice: l.issuePrice,
        listingPrice: l.listingPrice,
        currentPrice: l.currentPrice,
        dayChange: l.dayChange,
        dayChangePercent: l.dayChangePercent,
        volume: l.volume,
        marketStatus: 'OPEN',
      });
    }

    return items;
  }

  async getUpcomingIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => !isIpoListed(i) && i.status === 'Upcoming' && i.remainingTime !== 'Bidding Closed');
  }

  async getOpenIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => !isIpoListed(i) && i.status === 'Open' && i.remainingTime !== 'Bidding Closed');
  }

  async getClosedIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => !isIpoListed(i) && (i.status === 'Closed' || i.remainingTime === 'Bidding Closed'));
  }

  async getListedIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => isIpoListed(i));
  }

  async getIpoDetails(idOrSymbol: string): Promise<LiveMarketIpoItem | null> {
    const clean = idOrSymbol.toUpperCase().trim();
    const all = await this.getAllIpos();
    return all.find((i) => i.symbol === clean || i.id === idOrSymbol.toLowerCase()) || null;
  }
}

/**
 * Mock IPO Data Provider for Free-Development Mode
 * Delivers verified realistic demo data matching user specification requirements.
 */
export class MockIPOProvider implements IPODataProvider {
  name = 'Demo IPO Simulator';

  private mockIpos: LiveMarketIpoItem[] = [
    // 1. OPEN IPOs
    {
      id: 'demo-tech',
      symbol: 'DEMOTECH',
      companyName: 'Demo Technologies Ltd',
      status: 'Open',
      series: 'EQ',
      priceBand: '₹450 – ₹475',
      priceLow: 450,
      priceHigh: 475,
      lotSize: 31,
      issueSize: '₹1,850 Cr',
      openDate: '24 Sep 2026',
      closeDate: '26 Sep 2026',
      allotmentDate: '29 Sep 2026',
      listingDate: '03 Oct 2026',
      expectedListingDate: '03 Oct 2026',
      registrar: 'Link Intime India Pvt Ltd',
      registrarUrl: 'https://linkintime.co.in',
      gmp: 72,
      gmpPercent: 15.15,
      currentSubscription: 13.82,
      retailSubscription: 8.42,
      niiSubscription: 14.62,
      qibSubscription: 21.37,
      employeeSubscription: 2.10,
      remainingTime: '6 Hours 42 Mins',
      isClosingSoon: true,
    },
    {
      id: 'helios-green',
      symbol: 'HELIOS',
      companyName: 'Helios Green Energy Limited',
      status: 'Open',
      series: 'EQ',
      priceBand: '₹280 – ₹295',
      priceLow: 280,
      priceHigh: 295,
      lotSize: 50,
      issueSize: '₹3,200 Cr',
      openDate: '25 Sep 2026',
      closeDate: '27 Sep 2026',
      allotmentDate: '30 Sep 2026',
      listingDate: '04 Oct 2026',
      expectedListingDate: '04 Oct 2026',
      registrar: 'KFin Technologies Limited',
      registrarUrl: 'https://kosmic.kfintech.com/ipostatus/',
      gmp: 85,
      gmpPercent: 28.81,
      currentSubscription: 24.15,
      retailSubscription: 16.30,
      niiSubscription: 32.40,
      qibSubscription: 41.20,
      employeeSubscription: 3.50,
      remainingTime: '1 Day 14 Hours',
      isClosingSoon: false,
    },
    // 2. UPCOMING IPOs
    {
      id: 'bharat-mobility',
      symbol: 'BHARATMOB',
      companyName: 'Bharat Mobility Systems Ltd',
      status: 'Upcoming',
      series: 'EQ',
      priceBand: '₹620 – ₹650',
      priceLow: 620,
      priceHigh: 650,
      lotSize: 23,
      issueSize: '₹4,500 Cr',
      openDate: '10 Nov 2026',
      closeDate: '12 Nov 2026',
      allotmentDate: '15 Nov 2026',
      listingDate: '18 Nov 2026',
      expectedListingDate: '18 Nov 2026',
      registrar: 'Link Intime India Pvt Ltd',
      registrarUrl: 'https://linkintime.co.in',
      gmp: 140,
      gmpPercent: 21.54,
      currentSubscription: 0,
      retailSubscription: 0,
      niiSubscription: 0,
      qibSubscription: 0,
    },
    {
      id: 'apex-solar',
      symbol: 'APEXSOLAR',
      companyName: 'Apex Solar Infrastructure Ltd',
      status: 'Upcoming',
      series: 'SME',
      priceBand: '₹115 – ₹122',
      priceLow: 115,
      priceHigh: 122,
      lotSize: 1000,
      issueSize: '₹84 Cr',
      openDate: '16 Nov 2026',
      closeDate: '18 Nov 2026',
      allotmentDate: '20 Nov 2026',
      listingDate: '23 Nov 2026',
      expectedListingDate: '23 Nov 2026',
      registrar: 'Bigshare Services Pvt Ltd',
      registrarUrl: 'https://www.bigshareonline.com',
      gmp: 38,
      gmpPercent: 31.15,
      currentSubscription: 0,
      retailSubscription: 0,
      niiSubscription: 0,
      qibSubscription: 0,
    },
    // 3. CLOSED IPOs (Bidding Closed, Awaiting Allotment & Listing on Exchange)
    {
      id: 'sagility-india',
      symbol: 'SAGILITY',
      companyName: 'Sagility India Limited',
      status: 'Closed',
      series: 'EQ',
      priceBand: '₹28 – ₹30',
      priceLow: 28,
      priceHigh: 30,
      lotSize: 500,
      issueSize: '₹2,106 Cr',
      openDate: '05 Nov 2026',
      closeDate: '07 Nov 2026',
      allotmentDate: '10 Nov 2026',
      listingDate: '12 Nov 2026',
      expectedListingDate: '12 Nov 2026',
      registrar: 'Link Intime India Pvt Ltd',
      registrarUrl: 'https://linkintime.co.in',
      gmp: 0.3,
      gmpPercent: 1.0,
      currentSubscription: 3.20,
      retailSubscription: 4.15,
      niiSubscription: 1.93,
      qibSubscription: 3.52,
      employeeSubscription: 3.75,
      remainingTime: 'Bidding Closed',
    },
    // 4. LISTED IPOs (Listed on Secondary Market)
    {
      id: 'deccan-infra',
      symbol: 'DECCAN',
      companyName: 'Deccan Urban Infrastructure Ltd',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹88 – ₹93',
      priceLow: 88,
      priceHigh: 93,
      lotSize: 160,
      issueSize: '₹340 Cr',
      openDate: '22 Sep 2026',
      closeDate: '24 Sep 2026',
      allotmentDate: '27 Sep 2026',
      listingDate: '01 Oct 2026',
      expectedListingDate: '01 Oct 2026',
      registrar: 'Link Intime India Pvt Ltd',
      registrarUrl: 'https://linkintime.co.in',
      issuePrice: 93,
      listingPrice: 117,
      currentPrice: 124.50,
      dayChange: 7.50,
      dayChangePercent: 6.41,
      volume: 480000,
      gmp: 24,
      gmpPercent: 25.80,
      currentSubscription: 38.45,
      retailSubscription: 18.20,
      niiSubscription: 42.10,
      qibSubscription: 54.80,
      employeeSubscription: 2.10,
      remainingTime: 'Listed on Exchange',
      marketStatus: 'OPEN',
    },
    {
      id: 'solarvision-tech',
      symbol: 'SOLARVISION',
      companyName: 'SolarVision CleanTech Industries Ltd',
      status: 'Listed',
      series: 'SME',
      priceBand: '₹135 – ₹142',
      priceLow: 135,
      priceHigh: 142,
      lotSize: 1000,
      issueSize: '₹95 Cr',
      openDate: '23 Sep 2026',
      closeDate: '25 Sep 2026',
      allotmentDate: '28 Sep 2026',
      listingDate: '03 Oct 2026',
      expectedListingDate: '03 Oct 2026',
      registrar: 'KFin Technologies Limited',
      registrarUrl: 'https://kosmic.kfintech.com/ipostatus/',
      issuePrice: 142,
      listingPrice: 190,
      currentPrice: 198.20,
      dayChange: 8.20,
      dayChangePercent: 4.32,
      volume: 210000,
      gmp: 48,
      gmpPercent: 33.80,
      currentSubscription: 52.10,
      retailSubscription: 31.40,
      niiSubscription: 64.20,
      qibSubscription: 60.50,
      employeeSubscription: 4.20,
      remainingTime: 'Listed on Exchange',
      marketStatus: 'OPEN',
    },
    {
      id: 'waaree-energies',
      symbol: 'WAAREE',
      companyName: 'Waaree Energies Limited',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹1,503',
      priceLow: 1503,
      priceHigh: 1503,
      lotSize: 9,
      issueSize: '₹4,321 Cr',
      openDate: '21 Oct 2024',
      closeDate: '23 Oct 2024',
      allotmentDate: '24 Oct 2024',
      listingDate: '28 Oct 2024',
      registrar: 'Link Intime India Pvt Ltd',
      issuePrice: 1503,
      listingPrice: 2550,
      currentPrice: 2845.50,
      dayChange: 65.20,
      dayChangePercent: 2.34,
      volume: 2450100,
      gmp: 1047,
      gmpPercent: 69.66,
      currentSubscription: 76.34,
      retailSubscription: 10.79,
      niiSubscription: 62.49,
      qibSubscription: 208.63,
      marketStatus: 'OPEN',
    },
    {
      id: 'garuda-const',
      symbol: 'GARUDA',
      companyName: 'Garuda Construction and Eng Ltd',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹95',
      priceLow: 95,
      priceHigh: 95,
      lotSize: 157,
      issueSize: '₹264 Cr',
      openDate: '08 Oct 2024',
      closeDate: '10 Oct 2024',
      allotmentDate: '11 Oct 2024',
      listingDate: '15 Oct 2024',
      registrar: 'Link Intime India Pvt Ltd',
      issuePrice: 95,
      listingPrice: 105,
      currentPrice: 98.40,
      dayChange: -1.20,
      dayChangePercent: -1.21,
      volume: 820300,
      gmp: 10,
      gmpPercent: 10.53,
      currentSubscription: 7.55,
      retailSubscription: 10.81,
      niiSubscription: 9.03,
      qibSubscription: 1.24,
      marketStatus: 'OPEN',
    },
    {
      id: 'swiggy',
      symbol: 'SWIGGY',
      companyName: 'Swiggy Limited',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹371 – ₹390',
      priceLow: 371,
      priceHigh: 390,
      lotSize: 38,
      issueSize: '₹11,327 Cr',
      openDate: '06 Nov 2024',
      closeDate: '08 Nov 2024',
      allotmentDate: '11 Nov 2024',
      listingDate: '13 Nov 2024',
      registrar: 'Link Intime India Pvt Ltd',
      gmp: 30,
      gmpPercent: 7.69,
      currentSubscription: 3.59,
      retailSubscription: 1.14,
      niiSubscription: 0.41,
      qibSubscription: 6.02,
      issuePrice: 390,
      listingPrice: 420,
      currentPrice: 412.50,
      dayChange: 7.50,
      dayChangePercent: 1.85,
      volume: 1425000,
      marketStatus: 'OPEN',
    },
    {
      id: 'bajaj-housing',
      symbol: 'BAJAJHFL',
      companyName: 'Bajaj Housing Finance Limited',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹66 – ₹70',
      priceLow: 66,
      priceHigh: 70,
      lotSize: 214,
      issueSize: '₹6,560 Cr',
      openDate: '09 Sep 2024',
      closeDate: '11 Sep 2024',
      allotmentDate: '12 Sep 2024',
      listingDate: '16 Sep 2024',
      registrar: 'KFin Technologies Limited',
      gmp: 80,
      gmpPercent: 114.28,
      currentSubscription: 63.61,
      retailSubscription: 7.04,
      niiSubscription: 41.51,
      qibSubscription: 209.36,
      issuePrice: 70,
      listingPrice: 150,
      currentPrice: 142.80,
      dayChange: 3.30,
      dayChangePercent: 2.37,
      volume: 4890000,
      marketStatus: 'OPEN',
    },
    {
      id: 'premier-energies',
      symbol: 'PREMIERENE',
      companyName: 'Premier Energies Limited',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹427 – ₹450',
      priceLow: 427,
      priceHigh: 450,
      lotSize: 33,
      issueSize: '₹2,830 Cr',
      openDate: '27 Aug 2024',
      closeDate: '29 Aug 2024',
      allotmentDate: '30 Aug 2024',
      listingDate: '03 Sep 2024',
      registrar: 'KFin Technologies Limited',
      gmp: 490,
      gmpPercent: 108.88,
      currentSubscription: 74.38,
      retailSubscription: 7.44,
      niiSubscription: 50.04,
      qibSubscription: 216.67,
      issuePrice: 450,
      listingPrice: 991,
      currentPrice: 1120.40,
      dayChange: 32.40,
      dayChangePercent: 2.98,
      volume: 875000,
      marketStatus: 'OPEN',
    },
    {
      id: 'krn-heat',
      symbol: 'KRN',
      companyName: 'KRN Heat Exchanger and Refrig Ltd',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹209 – ₹220',
      priceLow: 209,
      priceHigh: 220,
      lotSize: 65,
      issueSize: '₹342 Cr',
      openDate: '25 Sep 2024',
      closeDate: '27 Sep 2024',
      allotmentDate: '30 Sep 2024',
      listingDate: '03 Oct 2024',
      registrar: 'Bigshare Services Pvt Ltd',
      gmp: 270,
      gmpPercent: 122.72,
      currentSubscription: 214.42,
      retailSubscription: 96.74,
      niiSubscription: 431.63,
      qibSubscription: 253.04,
      issuePrice: 220,
      listingPrice: 470,
      currentPrice: 540.60,
      dayChange: 12.60,
      dayChangePercent: 2.39,
      volume: 640000,
      marketStatus: 'OPEN',
    },
    {
      id: 'netweb-tech',
      symbol: 'NETWEB',
      companyName: 'Netweb Technologies India Ltd',
      status: 'Listed',
      series: 'EQ',
      priceBand: '₹475 – ₹500',
      priceLow: 475,
      priceHigh: 500,
      lotSize: 30,
      issueSize: '₹631 Cr',
      openDate: '17 Jul 2023',
      closeDate: '19 Jul 2023',
      allotmentDate: '24 Jul 2023',
      listingDate: '27 Jul 2023',
      registrar: 'Link Intime India Pvt Ltd',
      gmp: 440,
      gmpPercent: 88.0,
      currentSubscription: 90.36,
      retailSubscription: 19.15,
      niiSubscription: 77.21,
      qibSubscription: 228.91,
      issuePrice: 500,
      listingPrice: 947,
      currentPrice: 2650.00,
      dayChange: 60.00,
      dayChangePercent: 2.32,
      volume: 320000,
      marketStatus: 'OPEN',
    },
  ];

  async getAllIpos(): Promise<LiveMarketIpoItem[]> {
    return this.mockIpos.map((ipo) => {
      if (isIpoListed(ipo)) {
        return {
          ...ipo,
          status: 'Listed' as const,
          remainingTime: 'Listed on Exchange',
        };
      }
      const isClosed = isBiddingClosed(ipo.closeDate) || ipo.remainingTime === 'Bidding Closed';
      if (isClosed) {
        return {
          ...ipo,
          status: 'Closed' as const,
          remainingTime: 'Bidding Closed',
        };
      }
      return ipo;
    });
  }

  async getUpcomingIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => !isIpoListed(i) && i.status === 'Upcoming' && i.remainingTime !== 'Bidding Closed');
  }

  async getOpenIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => !isIpoListed(i) && i.status === 'Open' && i.remainingTime !== 'Bidding Closed');
  }

  async getClosedIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => !isIpoListed(i) && (i.status === 'Closed' || i.remainingTime === 'Bidding Closed'));
  }

  async getListedIpos(): Promise<LiveMarketIpoItem[]> {
    const all = await this.getAllIpos();
    return all.filter((i) => isIpoListed(i));
  }

  async getIpoDetails(idOrSymbol: string): Promise<LiveMarketIpoItem | null> {
    const clean = idOrSymbol.toUpperCase().trim();
    return this.mockIpos.find((i) => i.symbol === clean || i.id === idOrSymbol.toLowerCase()) || null;
  }
}
