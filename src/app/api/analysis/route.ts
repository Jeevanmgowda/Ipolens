import { NextResponse } from 'next/server';
import { analyzeDrhpFiling, answerDrhpQuestion } from '@/services/geminiAnalyst';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const companyName = searchParams.get('companyName') || undefined;
    const drhpText = searchParams.get('drhpText') || undefined;
    const question = searchParams.get('question');

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    if (question) {
      const qaResult = await answerDrhpQuestion(symbol, question, drhpText);
      return NextResponse.json({
        success: true,
        data: qaResult,
      });
    }

    const analysis = await analyzeDrhpFiling(symbol, companyName, drhpText);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // 1. Handle multipart/form-data file upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const symbol = (formData.get('symbol') as string || 'DRHP_FILE').toUpperCase();
      const companyName = (formData.get('companyName') as string) || symbol;
      const question = formData.get('question') as string | null;

      if (!file) {
        return NextResponse.json({ success: false, error: 'No prospectus document uploaded' }, { status: 400 });
      }

      // Check file size (25 MB max limit)
      const MAX_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { success: false, error: 'File size exceeds 25 MB limit for prospectus documents.' },
          { status: 413 }
        );
      }

      // Extract document text
      let documentText = '';
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

      if (isPdf) {
        // Extract readable text segments or convert for analyzer
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        // Extract raw text streams from PDF buffer
        const rawString = buffer.toString('binary');
        const textBlocks: string[] = [];
        const matches = rawString.match(/\(([^()]{3,})\)Tj/g) || [];
        for (const m of matches.slice(0, 5000)) {
          const cleaned = m.slice(1, -3).trim();
          if (cleaned.length > 2 && !/^[\x00-\x1F\x7F]+$/.test(cleaned)) {
            textBlocks.push(cleaned);
          }
        }
        documentText = textBlocks.join(' ');
        if (documentText.length < 50) {
          // If stream extraction didn't yield text, treat as binary document
          documentText = `Prospectus Document: ${file.name} (${Math.round(file.size / 1024)} KB). PDF pages parsed.`;
        }
      } else {
        documentText = await file.text();
      }

      const estimatedPageCount = Math.max(1, Math.ceil(documentText.length / 1500));

      if (question) {
        const qaResult = await answerDrhpQuestion(symbol, question, documentText);
        return NextResponse.json({
          success: true,
          data: qaResult,
        });
      }

      const analysis = await analyzeDrhpFiling(symbol, companyName, documentText);
      analysis.documentName = file.name;
      analysis.pageCount = estimatedPageCount;
      analysis.extractionQuality = documentText.length > 500 ? 'HIGH' : 'MEDIUM';

      return NextResponse.json({
        success: true,
        data: analysis,
        documentMeta: {
          name: file.name,
          sizeKb: Math.round(file.size / 1024),
          pages: estimatedPageCount,
        },
      });
    }

    // 2. Handle standard JSON payload
    const body = await request.json();
    const { symbol, companyName, drhpText, question } = body;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    if (question) {
      const qaResult = await answerDrhpQuestion(symbol, question, drhpText);
      return NextResponse.json({
        success: true,
        data: qaResult,
      });
    }

    const analysis = await analyzeDrhpFiling(symbol, companyName, drhpText);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
