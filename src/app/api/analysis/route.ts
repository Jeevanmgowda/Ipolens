import { NextResponse } from 'next/server';
import zlib from 'zlib';
<<<<<<< HEAD
import { analyzeDrhpFiling, answerDrhpQuestion } from '@/services/geminiAnalyst';
=======
import { analyzeDrhpFiling, answerDrhpQuestion } from '@/lib/services/geminiAnalyst';
>>>>>>> origin/main
import { apiErrorResponse } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

function extractPdfText(buffer: Buffer): string {
  const textBlocks: string[] = [];
  const rawString = buffer.toString('binary');

  // 1. Inflate compressed FlateDecode streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let streamCount = 0;

  while ((match = streamRegex.exec(rawString)) !== null && streamCount < 200) {
    streamCount++;
    const streamData = match[1];
    const streamBuffer = Buffer.from(streamData, 'binary');

    let decompressed: string | null = null;
    try {
      decompressed = zlib.inflateSync(streamBuffer).toString('utf-8');
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamBuffer).toString('utf-8');
      } catch {
        // Not a valid zlib block
      }
    }

    if (decompressed && decompressed.length > 10) {
      const tjMatches = decompressed.match(/\(([^()]+)\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const cleaned = m.replace(/\)\s*Tj$/, '').replace(/^\(/, '').trim();
        if (cleaned.length > 2) textBlocks.push(cleaned);
      }

      const tjArrMatches = decompressed.match(/\[([^\]]+)\]\s*TJ/g) || [];
      for (const m of tjArrMatches) {
        const innerStrings = m.match(/\(([^()]+)\)/g) || [];
        const combined = innerStrings.map((s) => s.slice(1, -1)).join('').trim();
        if (combined.length > 2) textBlocks.push(combined);
      }
    }
  }

  // 2. Direct uncompressed stream extraction
  if (textBlocks.length < 20) {
    const directMatches = rawString.match(/\(([^()]{3,})\)Tj/g) || [];
    for (const m of directMatches.slice(0, 3000)) {
      const cleaned = m.slice(1, -3).trim();
      if (cleaned.length > 2 && !/^[\x00-\x1F\x7F]+$/.test(cleaned)) {
        textBlocks.push(cleaned);
      }
    }
  }

  // 3. Fallback: printable runs
  if (textBlocks.length < 20) {
    const asciiChunks = rawString.match(/[A-Za-z0-9\s₹%.,;:/\-()]{20,}/g) || [];
    for (const chunk of asciiChunks.slice(0, 200)) {
      const trimmed = chunk.trim();
      if (!trimmed.includes('xref') && !trimmed.includes('trailer') && !trimmed.includes('startxref')) {
        textBlocks.push(trimmed);
      }
    }
  }

  return textBlocks.join(' ').replace(/\s+/g, ' ').trim();
}

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
    return apiErrorResponse(err, '/api/analysis');
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
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        documentText = extractPdfText(buffer);
        if (documentText.length < 50) {
          documentText = `Prospectus Document: ${file.name} (${Math.round(file.size / 1024)} KB). Extracted binary metadata and stream text.`;
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
    return apiErrorResponse(err, '/api/analysis');
  }
}
