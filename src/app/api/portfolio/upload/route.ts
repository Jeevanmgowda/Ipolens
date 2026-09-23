import { NextResponse } from 'next/server';
import { parseBrokerCsv } from '@/services/brokerParser';
import { HoldingItem } from '@/types/portfolio';

// Server-side holdings store (clean slate, populated only via user CSV import)
export let userHoldingsStore: HoldingItem[] = [];

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let csvText = '';
    let fileName = 'holdings.csv';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
      }
      fileName = file.name;
      csvText = await file.text();
    } else {
      const body = await request.json();
      csvText = body.csvContent || '';
      fileName = body.fileName || 'holdings.csv';
    }

    if (!csvText.trim()) {
      return NextResponse.json({ success: false, error: 'CSV content is empty' }, { status: 400 });
    }

    const importResult = parseBrokerCsv(csvText, fileName);

    if (importResult.validHoldingsImported > 0) {
      // Merge new holdings, replacing or updating existing symbols
      const existingMap = new Map<string, HoldingItem>(userHoldingsStore.map((h) => [h.symbol, h]));
      for (const h of importResult.importedHoldings) {
        existingMap.set(h.symbol, h);
      }
      userHoldingsStore = Array.from(existingMap.values());
    }

    return NextResponse.json({
      success: importResult.validHoldingsImported > 0,
      data: importResult,
      totalHoldingsCount: userHoldingsStore.length,
      message: `Parsed ${importResult.totalRowsProcessed} rows from ${importResult.brokerDetected.toUpperCase()} export. Imported ${importResult.validHoldingsImported} holdings, skipped ${importResult.duplicateRowsSkipped} duplicates.`,
    });
  } catch (err: any) {
    console.error('Error in /api/portfolio/upload:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
