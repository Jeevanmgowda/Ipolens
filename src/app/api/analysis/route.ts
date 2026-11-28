import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeDrhpFiling, answerDrhpQuestion } from '@/services/geminiAnalyst';
import { apiErrorResponse } from '@/lib/security/apiError';
import { extractPdfText } from '@/lib/services/pdfText';
import { requireAiAccess } from '@/lib/security/aiGuard';
import { CompanyNameSchema, DrhpTextSchema, QuestionSchema, SymbolSchema, firstIssue } from '@/lib/security/schemas';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const AnalysisQuerySchema = z.object({
  symbol: SymbolSchema,
  companyName: CompanyNameSchema.optional(),
  question: QuestionSchema.optional(),
});

const AnalysisBodySchema = AnalysisQuerySchema.extend({
  drhpText: DrhpTextSchema.optional(),
});

/**
 * Read-only analysis of the shared DRHP index. DRHP text is no longer accepted on
 * GET: indexing is a state change and only happens via authenticated POST (H1).
 */
export async function GET(request: Request) {
  try {
    const access = await requireAiAccess(request);
    if ('response' in access) return access.response;

    const { searchParams } = new URL(request.url);
    const parsed = AnalysisQuerySchema.safeParse({
      symbol: searchParams.get('symbol') ?? undefined,
      companyName: searchParams.get('companyName') ?? undefined,
      question: searchParams.get('question') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { symbol, companyName, question } = parsed.data;

    if (question) {
      const qaResult = await answerDrhpQuestion(symbol, question, undefined, access.user.id);
      return NextResponse.json({ success: true, data: qaResult });
    }

    const analysis = await analyzeDrhpFiling(symbol, companyName, undefined, access.user.id);
    return NextResponse.json({ success: true, data: analysis });
  } catch (err: any) {
    return apiErrorResponse(err, '/api/analysis');
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAiAccess(request);
    if ('response' in access) return access.response;
    const userId = access.user.id;

    const contentType = request.headers.get('content-type') || '';

    // 1. Multipart file upload
    if (contentType.includes('multipart/form-data')) {
      const declaredLength = Number(request.headers.get('content-length') || 0);
      if (declaredLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
        return NextResponse.json({ success: false, error: 'File size exceeds 25 MB limit for prospectus documents.' }, { status: 413 });
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'No prospectus document uploaded' }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ success: false, error: 'File size exceeds 25 MB limit for prospectus documents.' }, { status: 413 });
      }

      const fields = AnalysisQuerySchema.safeParse({
        symbol: (formData.get('symbol') as string) || file.name.split('.')[0].replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'DRHPFILE',
        companyName: (formData.get('companyName') as string) || undefined,
        question: (formData.get('question') as string) || undefined,
      });
      if (!fields.success) {
        return NextResponse.json({ success: false, error: firstIssue(fields.error) }, { status: 400 });
      }
      const { symbol, question } = fields.data;
      const companyName = fields.data.companyName || symbol;

      // Accept PDFs by content (magic bytes), plain text otherwise; never trust the filename alone.
      const buffer = Buffer.from(await file.arrayBuffer());
      const isPdf = buffer.subarray(0, 5).toString('latin1') === '%PDF-';
      const looksBinary = !isPdf && buffer.subarray(0, 4096).includes(0);
      if (looksBinary) {
        return NextResponse.json({ success: false, error: 'Unsupported file type. Upload a PDF or a text file.' }, { status: 415 });
      }

      let documentText = isPdf ? extractPdfText(buffer) : buffer.toString('utf-8');
      if (isPdf && documentText.length < 50) {
        documentText = `Prospectus Document: ${file.name.slice(0, 120)} (${Math.round(file.size / 1024)} KB). Extracted binary metadata and stream text.`;
      }
      documentText = documentText.slice(0, 2_000_000);

      const estimatedPageCount = Math.max(1, Math.ceil(documentText.length / 1500));

      if (question) {
        const qaResult = await answerDrhpQuestion(symbol, question, documentText, userId);
        return NextResponse.json({ success: true, data: qaResult });
      }

      const analysis = await analyzeDrhpFiling(symbol, companyName, documentText, userId);
      analysis.documentName = file.name.slice(0, 200);
      analysis.pageCount = estimatedPageCount;
      analysis.extractionQuality = documentText.length > 500 ? 'HIGH' : 'MEDIUM';

      return NextResponse.json({
        success: true,
        data: analysis,
        documentMeta: {
          name: file.name.slice(0, 200),
          sizeKb: Math.round(file.size / 1024),
          pages: estimatedPageCount,
        },
      });
    }

    // 2. JSON payload
    const parsed = AnalysisBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { symbol, companyName, drhpText, question } = parsed.data;

    if (question) {
      const qaResult = await answerDrhpQuestion(symbol, question, drhpText, userId);
      return NextResponse.json({ success: true, data: qaResult });
    }

    const analysis = await analyzeDrhpFiling(symbol, companyName, drhpText, userId);
    return NextResponse.json({ success: true, data: analysis });
  } catch (err: any) {
    return apiErrorResponse(err, '/api/analysis');
  }
}
