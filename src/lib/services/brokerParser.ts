import Papa from 'papaparse';
import { SupportedBroker, HoldingItem, CsvImportResult, RowParseError } from '@/types/portfolio';
import { resolveIsinOrSymbol } from './isinResolver';

/**
 * Detect the broker format from header keys
 */
export function detectBroker(headers: string[]): SupportedBroker {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const headerStr = normalized.join(' ');

  if (headerStr.includes('instrument') && (headerStr.includes('isin') || headerStr.includes('avgcost'))) {
    return 'zerodha';
  }
  if (headerStr.includes('stockname') || (headerStr.includes('groww') || (headerStr.includes('shares') && headerStr.includes('avgprice')))) {
    return 'groww';
  }
  if (headerStr.includes('scripname') || (headerStr.includes('5paisa') || headerStr.includes('marketrate'))) {
    return '5paisa';
  }
  if (headerStr.includes('isin') && (headerStr.includes('balance') || headerStr.includes('nsdl') || headerStr.includes('cdsl'))) {
    return 'cas';
  }
  return 'generic';
}

/**
 * Clean numeric string from commas, currency symbols, and whitespace
 */
function cleanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[₹,$\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Hash generator for duplicate transaction detection
 */
function createRowFingerprint(symbol: string, isin: string, qty: number, buyPrice: number): string {
  return `${symbol.toUpperCase()}_${isin.toUpperCase()}_${qty.toFixed(2)}_${buyPrice.toFixed(2)}`;
}

/**
 * Check if stock holding appears to have originated from an IPO allotment
 */
function checkIfIpoAllotment(symbol: string, name: string): boolean {
  const s = (symbol + ' ' + name).toUpperCase();
  const knownIpoSymbols = ['BAJAJHFL', 'TATATECH', 'SWIGGY', 'HYUNDAI', 'FIRSTCRY', 'ZOMATO', 'IREDA', 'ATHER', 'NSE', 'SONA'];
  return knownIpoSymbols.some((sym) => s.includes(sym));
}

/**
 * Main parse function for CSV/CAS uploads
 */
export function parseBrokerCsv(csvContent: string, fileName: string = 'holdings.csv'): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields || [];
  const broker = detectBroker(headers);
  const rows = parsed.data;

  const importedHoldings: HoldingItem[] = [];
  const errors: RowParseError[] = [];
  const seenFingerprints = new Set<string>();
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +1 for 0-index, +1 for header line

    let rawSymbol = '';
    let rawIsin = '';
    let rawName = '';
    let quantity = 0;
    let avgBuyPrice = 0;
    let currentPrice = 0;

    // Broker-specific mapping
    if (broker === 'zerodha') {
      rawSymbol = row['Instrument'] || row['instrument'] || '';
      rawIsin = row['ISIN'] || row['isin'] || '';
      quantity = cleanNumber(row['Qty.'] || row['Quantity'] || row['qty']);
      avgBuyPrice = cleanNumber(row['Avg. cost'] || row['Avg cost'] || row['Avg. Price']);
      currentPrice = cleanNumber(row['LTP'] || row['ltp'] || row['Cur. val']);
    } else if (broker === 'groww') {
      rawName = row['Stock Name'] || row['Stock name'] || row['Company Name'] || '';
      rawSymbol = row['Symbol'] || row['Ticker'] || '';
      rawIsin = row['ISIN'] || '';
      quantity = cleanNumber(row['Shares'] || row['Qty'] || row['Quantity']);
      avgBuyPrice = cleanNumber(row['Avg Price'] || row['Buy Price'] || row['Average Price']);
      currentPrice = cleanNumber(row['Market Price'] || row['Current Price'] || row['LTP']);
    } else if (broker === '5paisa') {
      rawName = row['Scrip Name'] || row['Company Name'] || '';
      rawSymbol = row['Symbol'] || row['Scrip Code'] || '';
      rawIsin = row['ISIN'] || '';
      quantity = cleanNumber(row['Quantity'] || row['Qty'] || row['Net Qty']);
      avgBuyPrice = cleanNumber(row['Buy Price'] || row['Rate'] || row['Avg Rate']);
      currentPrice = cleanNumber(row['Market Rate'] || row['LTP'] || row['Current Rate']);
    } else {
      // CAS or generic mapping
      rawIsin = row['ISIN'] || row['isin'] || '';
      rawName = row['Description'] || row['Security Name'] || row['Company Name'] || '';
      rawSymbol = row['Symbol'] || row['Ticker'] || '';
      quantity = cleanNumber(row['Total Balance'] || row['Balance'] || row['Quantity'] || row['Qty']);
      avgBuyPrice = cleanNumber(row['Cost Value'] || row['Buy Price'] || row['Price'] || row['NAV']);
      currentPrice = cleanNumber(row['Market Value'] || row['Current Price'] || row['LTP']);
    }

    // Validation: Quantity must be positive
    if (quantity <= 0) {
      errors.push({
        rowNumber: rowNum,
        rawRow: row,
        reason: `Invalid or non-positive quantity (${quantity}).`,
      });
      return;
    }

    // If buy price is 0, estimate from current price or flag
    if (avgBuyPrice <= 0 && currentPrice > 0) {
      avgBuyPrice = currentPrice;
    } else if (avgBuyPrice <= 0 && currentPrice <= 0) {
      errors.push({
        rowNumber: rowNum,
        rawRow: row,
        reason: 'Missing both buy price and current market price.',
      });
      return;
    }

    if (currentPrice <= 0) {
      currentPrice = avgBuyPrice; // Fallback to break-even if market price not provided
    }

    // Resolve ISIN and clean symbol
    const resolved = resolveIsinOrSymbol(rawIsin, rawSymbol, rawName);

    // Duplicate detection algorithm
    const fingerprint = createRowFingerprint(resolved.symbol, resolved.isin, quantity, avgBuyPrice);
    if (seenFingerprints.has(fingerprint)) {
      duplicateCount++;
      return; // Skip duplicate row
    }
    seenFingerprints.add(fingerprint);

    // Calculate P&L metrics
    const invested = quantity * avgBuyPrice;
    const currentVal = quantity * currentPrice;
    const pnl = currentVal - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    const isIpo = checkIfIpoAllotment(resolved.symbol, resolved.companyName);

    importedHoldings.push({
      id: `hold_${Date.now()}_${index}`,
      symbol: resolved.symbol,
      isin: resolved.isin,
      companyName: resolved.companyName,
      quantity,
      averageBuyPrice: avgBuyPrice,
      currentPrice,
      investedValue: Math.round(invested * 100) / 100,
      currentValue: Math.round(currentVal * 100) / 100,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      unrealizedPnlPercent: Math.round(pnlPercent * 100) / 100,
      isIpoAllotment: isIpo,
      importedFromBroker: broker,
      lastUpdated: new Date().toISOString(),
    });
  });

  return {
    success: importedHoldings.length > 0,
    brokerDetected: broker,
    fileName,
    totalRowsProcessed: rows.length,
    validHoldingsImported: importedHoldings.length,
    duplicateRowsSkipped: duplicateCount,
    rejectedRowsCount: errors.length,
    errors,
    importedHoldings,
  };
}

/**
 * Generate sample CSV template for testing
 */
export function getSampleCsv(broker: SupportedBroker): string {
  if (broker === 'zerodha') {
    return `Instrument,ISIN,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.
BAJAJHFL,INE084A01016,214,70.00,128.50,27499.00,12519.00,83.57%
TATATECH,INE142M01025,30,500.00,945.00,28350.00,13350.00,89.00%
INFY,INE009A01021,50,1520.00,1890.00,94500.00,18500.00,24.34%
RELIANCE,INE002A01018,40,2450.00,2980.00,119200.00,21200.00,21.63%
SWIGGY,INE000V01018,38,390.00,480.00,18240.00,3420.00,23.08%`;
  } else if (broker === 'groww') {
    return `Stock Name,Symbol,Shares,Avg Price,Market Price,Invested,Current Value
Tata Technologies Ltd,TATATECH,30,500.00,945.00,15000,28350
Bajaj Housing Finance Ltd,BAJAJHFL,214,70.00,128.50,14980,27499
HDFC Bank Ltd,HDFCBANK,45,1480.00,1720.00,66600,77400
Zomato Ltd,ZOMATO,200,140.00,265.00,28000,53000`;
  }
  return `ISIN,Description,Total Balance,Cost Value,Market Value
INE084A01016,BAJAJ HOUSING FINANCE LIMITED,214,70.00,128.50
INE142M01025,TATA TECHNOLOGIES LIMITED,30,500.00,945.00
INE002A01018,RELIANCE INDUSTRIES LIMITED,40,2450.00,2980.00`;
}
