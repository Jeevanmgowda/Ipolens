import { ListedIpoItem, IpoChartResponse, IpoChartPoint } from '../types/listedIpo';

export interface ListedIpoMetadata {
  symbol: string;
  ticker: string;
  companyName: string;
  series: 'EQ' | 'SME';
  listingDate: string;
  issuePrice: number;
  listingPrice: number;
  allotmentRegistrar: string;
}

// Registry of known landmark Indian IPOs with official tickers
export const LISTED_IPOS_REGISTRY: ListedIpoMetadata[] = [
  {
    symbol: 'SWIGGY',
    ticker: 'SWIGGY.NS',
    companyName: 'Swiggy Limited',
    series: 'EQ',
    listingDate: '13-Nov-2024',
    issuePrice: 390,
    listingPrice: 420,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'HYUNDAI',
    ticker: 'HYUNDAI.NS',
    companyName: 'Hyundai Motor India Limited',
    series: 'EQ',
    listingDate: '22-Oct-2024',
    issuePrice: 1960,
    listingPrice: 1934,
    allotmentRegistrar: 'KFin Technologies Limited',
  },
  {
    symbol: 'BAJAJHFL',
    ticker: 'BAJAJHFL.NS',
    companyName: 'Bajaj Housing Finance Limited',
    series: 'EQ',
    listingDate: '16-Sep-2024',
    issuePrice: 70,
    listingPrice: 150,
    allotmentRegistrar: 'KFin Technologies Limited',
  },
  {
    symbol: 'PREMIERENE',
    ticker: 'PREMIERENE.NS',
    companyName: 'Premier Energies Limited',
    series: 'EQ',
    listingDate: '03-Sep-2024',
    issuePrice: 450,
    listingPrice: 991,
    allotmentRegistrar: 'KFin Technologies Limited',
  },
  {
    symbol: 'KRN',
    ticker: 'KRN.NS',
    companyName: 'KRN Heat Exchanger and Refrigeration Limited',
    series: 'EQ',
    listingDate: '03-Oct-2024',
    issuePrice: 220,
    listingPrice: 470,
    allotmentRegistrar: 'Bigshare Services Pvt Ltd',
  },
  {
    symbol: 'NETWEB',
    ticker: 'NETWEB.NS',
    companyName: 'Netweb Technologies India Limited',
    series: 'EQ',
    listingDate: '27-Jul-2023',
    issuePrice: 500,
    listingPrice: 947,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'TATATECH',
    ticker: 'TATATECH.NS',
    companyName: 'Tata Technologies Limited',
    series: 'EQ',
    listingDate: '30-Nov-2023',
    issuePrice: 500,
    listingPrice: 1200,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'IREDA',
    ticker: 'IREDA.NS',
    companyName: 'Indian Renewable Energy Dev Agency Limited',
    series: 'EQ',
    listingDate: '29-Nov-2023',
    issuePrice: 32,
    listingPrice: 50,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'DOMS',
    ticker: 'DOMS.NS',
    companyName: 'DOMS Industries Limited',
    series: 'EQ',
    listingDate: '20-Dec-2023',
    issuePrice: 790,
    listingPrice: 1400,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'JYOTICNC',
    ticker: 'JYOTICNC.NS',
    companyName: 'Jyoti CNC Automation Limited',
    series: 'EQ',
    listingDate: '16-Jan-2024',
    issuePrice: 331,
    listingPrice: 370,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'MANKIND',
    ticker: 'MANKIND.NS',
    companyName: 'Mankind Pharma Limited',
    series: 'EQ',
    listingDate: '09-May-2023',
    issuePrice: 1080,
    listingPrice: 1300,
    allotmentRegistrar: 'KFin Technologies Limited',
  },
  {
    symbol: 'DEEDEV',
    ticker: 'DEEDEV.NS',
    companyName: 'DEE Development Engineers Limited',
    series: 'EQ',
    listingDate: '26-Jun-2024',
    issuePrice: 203,
    listingPrice: 339,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'CONCORDBIO',
    ticker: 'CONCORDBIO.NS',
    companyName: 'Concord Biotech Limited',
    series: 'EQ',
    listingDate: '18-Aug-2023',
    issuePrice: 741,
    listingPrice: 900,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'NORTHARC',
    ticker: 'NORTHARC.NS',
    companyName: 'Northern Arc Capital Limited',
    series: 'EQ',
    listingDate: '24-Sep-2024',
    issuePrice: 263,
    listingPrice: 351,
    allotmentRegistrar: 'KFin Technologies Limited',
  },
  {
    symbol: 'ARKADE',
    ticker: 'ARKADE.NS',
    companyName: 'Arkade Developers Limited',
    series: 'EQ',
    listingDate: '24-Sep-2024',
    issuePrice: 128,
    listingPrice: 175,
    allotmentRegistrar: 'Bigshare Services Pvt Ltd',
  },
  {
    symbol: 'WCIL',
    ticker: 'WCIL.NS',
    companyName: 'Western Carriers (India) Limited',
    series: 'EQ',
    listingDate: '24-Sep-2024',
    issuePrice: 172,
    listingPrice: 177,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'SBFC',
    ticker: 'SBFC.NS',
    companyName: 'SBFC Finance Limited',
    series: 'EQ',
    listingDate: '16-Aug-2023',
    issuePrice: 57,
    listingPrice: 82,
    allotmentRegistrar: 'KFin Technologies Limited',
  },
  {
    symbol: 'KAYNES',
    ticker: 'KAYNES.NS',
    companyName: 'Kaynes Technology India Limited',
    series: 'EQ',
    listingDate: '22-Nov-2022',
    issuePrice: 587,
    listingPrice: 775,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'FIRSTCRY',
    ticker: 'FIRSTCRY.NS',
    companyName: 'Brainbees Solutions Limited (FirstCry)',
    series: 'EQ',
    listingDate: '13-Aug-2024',
    issuePrice: 465,
    listingPrice: 651,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
  {
    symbol: 'OLAELEC',
    ticker: 'OLAELEC.NS',
    companyName: 'Ola Electric Mobility Limited',
    series: 'EQ',
    listingDate: '09-Aug-2024',
    issuePrice: 76,
    listingPrice: 76,
    allotmentRegistrar: 'Link Intime India Pvt Ltd',
  },
];

const CACHE_TTL_MS = 25000; // 25 seconds live cache
let listedIposCache: { timestamp: number; data: ListedIpoItem[] } | null = null;
const chartCache = new Map<string, { timestamp: number; data: IpoChartResponse }>();

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Dynamically extract listed IPOs from the live performance tracker
async function extractLiveListedMetadata(): Promise<ListedIpoMetadata[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://ipowatch.in/ipo-performance-tracker/', {
      headers: COMMON_HEADERS,
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const trs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!trs || trs.length === 0) throw new Error('No rows found');

    const SYMBOL_LOOKUP: Record<string, { symbol: string; series: 'EQ' | 'SME' }> = {
      'swiggy': { symbol: 'SWIGGY', series: 'EQ' },
      'hyundai motor': { symbol: 'HYUNDAI', series: 'EQ' },
      'krn heat exchanger': { symbol: 'KRN', series: 'EQ' },
      'northern arc': { symbol: 'NORTHARC', series: 'EQ' },
      'arkade developers': { symbol: 'ARKADE', series: 'EQ' },
      'western carriers': { symbol: 'WCIL', series: 'EQ' },
      'bajaj housing finance': { symbol: 'BAJAJHFL', series: 'EQ' },
      'premier energies': { symbol: 'PREMIERENE', series: 'EQ' },
      'tata technologies': { symbol: 'TATATECH', series: 'EQ' },
      'netweb technologies': { symbol: 'NETWEB', series: 'EQ' },
      'mankind pharma': { symbol: 'MANKIND', series: 'EQ' },
      'concord biotech': { symbol: 'CONCORDBIO', series: 'EQ' },
      'dee development': { symbol: 'DEEDEV', series: 'EQ' },
      'firstcry': { symbol: 'FIRSTCRY', series: 'EQ' },
      'brainbees': { symbol: 'FIRSTCRY', series: 'EQ' },
      'ola electric': { symbol: 'OLAELEC', series: 'EQ' },
      'sanstar': { symbol: 'SANSTAR', series: 'EQ' },
      'bansal wire': { symbol: 'BANSALWIRE', series: 'EQ' },
      'emcure': { symbol: 'EMCURE', series: 'EQ' },
      'akums drugs': { symbol: 'AKUMS', series: 'EQ' },
      'ceigall': { symbol: 'CEIGALL', series: 'EQ' },
      'ireda': { symbol: 'IREDA', series: 'EQ' },
      'doms': { symbol: 'DOMS', series: 'EQ' },
      'jyoti cnc': { symbol: 'JYOTICNC', series: 'EQ' },
      'sbfc': { symbol: 'SBFC', series: 'EQ' },
      'kaynes': { symbol: 'KAYNES', series: 'EQ' },
    };

    const dynamicallyExtracted: ListedIpoMetadata[] = [];
    const seenSymbols = new Set<string>();

    for (let i = 1; i < trs.length; i++) {
      const cells = trs[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (cells && cells.length >= 4) {
        const rawName = cells[0].replace(/<[^>]+>/g, '').trim();
        const ipoPrice = parseFloat(cells[1].replace(/[^0-9.]/g, '')) || 0;
        const listingPrice = parseFloat(cells[2].replace(/[^0-9.]/g, '')) || 0;

        if (rawName && ipoPrice > 0) {
          const lower = rawName.toLowerCase();
          for (const [key, mapping] of Object.entries(SYMBOL_LOOKUP)) {
            if (lower.includes(key) && !seenSymbols.has(mapping.symbol)) {
              seenSymbols.add(mapping.symbol);
              dynamicallyExtracted.push({
                symbol: mapping.symbol,
                ticker: `${mapping.symbol}.NS`,
                companyName: rawName,
                series: mapping.series,
                listingDate: 'Recent',
                issuePrice: ipoPrice,
                listingPrice: listingPrice > 0 ? listingPrice : ipoPrice,
                allotmentRegistrar: 'Official Exchange Registrar',
              });
              break;
            }
          }
        }
      }
    }

    // Merge dynamically extracted with LISTED_IPOS_REGISTRY so we have all recent and landmark listings
    const mergedMap = new Map<string, ListedIpoMetadata>();
    for (const item of LISTED_IPOS_REGISTRY) {
      mergedMap.set(item.symbol.toUpperCase(), item);
    }
    for (const item of dynamicallyExtracted) {
      mergedMap.set(item.symbol.toUpperCase(), item);
    }
    return Array.from(mergedMap.values());
  } catch (err) {
    console.warn('Dynamic performance tracker scrape notice:', err);
  }

  return LISTED_IPOS_REGISTRY;
}

// Fetch real-time secondary market quotes for all listed IPOs
export async function fetchLiveListedIpos(): Promise<ListedIpoItem[]> {
  const now = Date.now();
  if (listedIposCache && now - listedIposCache.timestamp < CACHE_TTL_MS) {
    return listedIposCache.data;
  }

  // 1. Get dynamic metadata from live feed
  const iposMetadata = await extractLiveListedMetadata();

  // 2. Fetch live real-time quotes directly from exchange gateway
  const results: ListedIpoItem[] = [];

  const promises = iposMetadata.map(async (meta) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${meta.ticker}?interval=1d&range=5d`,
        {
          headers: COMMON_HEADERS,
          signal: controller.signal,
          next: { revalidate: 20 },
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = json.chart?.result?.[0];
      const m = result?.meta;

      if (m && typeof m.regularMarketPrice === 'number') {
        const currentPrice = Number(m.regularMarketPrice.toFixed(2));
        const prevClose = typeof m.chartPreviousClose === 'number' ? m.chartPreviousClose : currentPrice;
        const dayChange = Number((currentPrice - prevClose).toFixed(2));
        const dayChangePercent = prevClose > 0 ? Number(((dayChange / prevClose) * 100).toFixed(2)) : 0;
        const listingGainPercent = Number((((meta.listingPrice - meta.issuePrice) / meta.issuePrice) * 100).toFixed(1));
        const totalGainPercent = Number((((currentPrice - meta.issuePrice) / meta.issuePrice) * 100).toFixed(1));

        return {
          symbol: meta.symbol,
          ticker: meta.ticker,
          companyName: meta.companyName,
          series: meta.series,
          listingDate: meta.listingDate,
          issuePrice: meta.issuePrice,
          listingPrice: meta.listingPrice,
          currentPrice,
          dayChange,
          dayChangePercent,
          listingGainPercent,
          totalGainPercent,
          dayHigh: typeof m.regularMarketDayHigh === 'number' ? Number(m.regularMarketDayHigh.toFixed(2)) : currentPrice,
          dayLow: typeof m.regularMarketDayLow === 'number' ? Number(m.regularMarketDayLow.toFixed(2)) : currentPrice,
          fiftyTwoWeekHigh: typeof m.fiftyTwoWeekHigh === 'number' ? Number(m.fiftyTwoWeekHigh.toFixed(2)) : currentPrice,
          fiftyTwoWeekLow: typeof m.fiftyTwoWeekLow === 'number' ? Number(m.fiftyTwoWeekLow.toFixed(2)) : currentPrice,
          volume: typeof m.regularMarketVolume === 'number' ? m.regularMarketVolume : 0,
          allotmentRegistrar: meta.allotmentRegistrar,
        };
      }
    } catch {
      // If temporary quote fetch fails, fallback with original issue data
    }

    const listingGain = Number((((meta.listingPrice - meta.issuePrice) / meta.issuePrice) * 100).toFixed(1));
    return {
      symbol: meta.symbol,
      ticker: meta.ticker,
      companyName: meta.companyName,
      series: meta.series,
      listingDate: meta.listingDate,
      issuePrice: meta.issuePrice,
      listingPrice: meta.listingPrice,
      currentPrice: meta.listingPrice,
      dayChange: 0,
      dayChangePercent: 0,
      listingGainPercent: listingGain,
      totalGainPercent: listingGain,
      dayHigh: meta.listingPrice,
      dayLow: meta.listingPrice,
      fiftyTwoWeekHigh: meta.listingPrice,
      fiftyTwoWeekLow: meta.issuePrice,
      volume: 0,
      allotmentRegistrar: meta.allotmentRegistrar,
    };
  });

  const settled = await Promise.allSettled(promises);
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value) {
      results.push(s.value);
    }
  }

  // Sort by highest total gain percentage by default
  results.sort((a, b) => b.totalGainPercent - a.totalGainPercent);

  listedIposCache = { timestamp: now, data: results };
  return results;
}

// Fetch live historical/intraday chart points for any IPO
export async function fetchIpoLiveChart(
  symbolInput: string,
  rangeInput: string = '1mo'
): Promise<IpoChartResponse | null> {
  const cleanSymbol = symbolInput.toUpperCase().trim();
  const meta = LISTED_IPOS_REGISTRY.find(
    (m) => m.symbol.toUpperCase() === cleanSymbol || m.ticker.toUpperCase().startsWith(cleanSymbol)
  );

  const ticker = meta ? meta.ticker : `${cleanSymbol}.NS`;
  const validRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', 'max'];
  const range = validRanges.includes(rangeInput.toLowerCase()) ? rangeInput.toLowerCase() : '1mo';

  let interval = '1d';
  if (range === '1d') interval = '5m';
  else if (range === '5d') interval = '15m';
  else if (range === '1mo' || range === '3mo' || range === '6mo') interval = '1d';
  else if (range === '1y') interval = '1d';
  else if (range === 'max') interval = '1wk';

  const cacheKey = `${ticker}_${range}`;
  const now = Date.now();
  const cached = chartCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`,
      {
        headers: COMMON_HEADERS,
        signal: controller.signal,
        next: { revalidate: 20 },
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) return null;

    const m = result.meta;
    const quote = result.indicators.quote[0];
    const timestamps: number[] = result.timestamp;

    const points: IpoChartPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const priceVal = quote.close?.[i];
      if (typeof priceVal === 'number' && !isNaN(priceVal)) {
        const t = timestamps[i];
        const d = new Date(t * 1000);
        const dateStr =
          range === '1d'
            ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

        points.push({
          timestamp: t,
          date: dateStr,
          time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          price: Number(priceVal.toFixed(2)),
          volume: quote.volume?.[i] || 0,
        });
      }
    }

    const currentPrice = m.regularMarketPrice ? Number(m.regularMarketPrice.toFixed(2)) : (points[points.length - 1]?.price || 0);
    const prevClose = m.chartPreviousClose ? Number(m.chartPreviousClose.toFixed(2)) : currentPrice;
    const change = Number((currentPrice - prevClose).toFixed(2));
    const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    const chartResponse: IpoChartResponse = {
      symbol: meta?.symbol || cleanSymbol,
      companyName: meta?.companyName || m.shortName || cleanSymbol,
      currentPrice,
      change,
      changePercent,
      previousClose: prevClose,
      currency: m.currency || 'INR',
      range,
      dayHigh: typeof m.regularMarketDayHigh === 'number' ? Number(m.regularMarketDayHigh.toFixed(2)) : currentPrice,
      dayLow: typeof m.regularMarketDayLow === 'number' ? Number(m.regularMarketDayLow.toFixed(2)) : currentPrice,
      fiftyTwoWeekHigh: typeof m.fiftyTwoWeekHigh === 'number' ? Number(m.fiftyTwoWeekHigh.toFixed(2)) : currentPrice,
      fiftyTwoWeekLow: typeof m.fiftyTwoWeekLow === 'number' ? Number(m.fiftyTwoWeekLow.toFixed(2)) : currentPrice,
      issuePrice: meta?.issuePrice,
      listingPrice: meta?.listingPrice,
      points,
    };

    chartCache.set(cacheKey, { timestamp: now, data: chartResponse });
    return chartResponse;
  } catch (err) {
    console.error(`Error fetching chart for ${ticker}:`, err);
    return null;
  }
}

export const fetchLiveIpoChart = fetchIpoLiveChart;
