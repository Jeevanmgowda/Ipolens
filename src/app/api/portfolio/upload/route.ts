import { NextResponse } from 'next/server';
import { parseBrokerCsv } from '@/services/brokerParser';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser } from '@/lib/security/session';

export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);
    const userId = authUser ? authUser.id : 'default_user';

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

    let totalHoldingsCount = 0;
    if (importResult.validHoldingsImported > 0) {
      await DbRepositoryService.saveHoldings(importResult.importedHoldings, userId);
      const allHoldings = await DbRepositoryService.getHoldings(userId);
      totalHoldingsCount = allHoldings.length;
    } else {
      const currentHoldings = await DbRepositoryService.getHoldings(userId);
      totalHoldingsCount = currentHoldings.length;
    }

    return NextResponse.json({
      success: importResult.validHoldingsImported > 0,
      data: importResult,
      totalHoldingsCount,
      message: `Parsed ${importResult.totalRowsProcessed} rows from ${importResult.brokerDetected.toUpperCase()} export. Imported ${importResult.validHoldingsImported} holdings, skipped ${importResult.duplicateRowsSkipped} duplicates.`,
    });
  } catch (err: any) {
    console.error('Error in /api/portfolio/upload:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
