import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/security/session';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';
import { handleRouteError, jsonError, BadRequestError } from '@/lib/http';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { registerPdf, downloadOfferDocument, indexDocument, listDocuments, MAX_PDF_BYTES } from '@/lib/services/drhp/document.service';
import { runAndStoreAnalysis, latestAnalysis } from '@/lib/services/drhp/analyst.service';
import { inngest, EVENTS, inngestAvailable } from '@/inngest/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UrlBody = z.object({
  symbol: z.string().trim().max(32).optional(),
  url: z.string().url().max(2048).optional(),
  /** Use the RHP/DRHP link recorded for this IPO during ingestion. */
  useIpoProspectus: z.boolean().optional(),
});

/** Lists indexed offer documents for an IPO (prospectuses are public documents). */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const symbol = new URL(request.url).searchParams.get('symbol') || undefined;
    const docs = await listDocuments({ symbol });
    const withAnalysis = await Promise.all(
      docs.map(async (d) => {
        const a = await latestAnalysis(d.id);
        return { ...d, analysis: a ? { id: a.id, status: a.status, error: a.error, updatedAt: a.updatedAt } : null };
      })
    );
    return NextResponse.json({ success: true, data: withAnalysis });
  } catch (err) {
    return handleRouteError(err, 'drhp/documents:GET');
  }
}

/**
 * Adds an offer document from an upload (multipart "file") or an allow-listed URL, then indexes
 * and analyses it (in Inngest when available, inline otherwise).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const limit = await checkDistributedRateLimit(`drhp:${user.id}`, 10, 3600);
    if (!limit.allowed) return jsonError(429, 'You can add up to 10 documents per hour.');

    let bytes: Uint8Array;
    let fileName: string | null = null;
    let sourceUrl: string | null = null;
    let symbol: string | undefined;

    const type = request.headers.get('content-type') || '';
    if (type.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      symbol = (form.get('symbol') as string | null)?.trim() || undefined;
      if (!(file instanceof File)) return jsonError(400, 'Attach the DRHP/RHP PDF as "file".');
      if (file.size > MAX_PDF_BYTES) return jsonError(413, 'PDF is larger than 60 MB.');
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        return jsonError(400, 'Only PDF offer documents are supported.');
      }
      bytes = new Uint8Array(await file.arrayBuffer());
      fileName = file.name.slice(0, 200);
    } else {
      const body = UrlBody.parse(await request.json());
      symbol = body.symbol;
      let url = body.url;
      if (!url && body.useIpoProspectus && symbol) {
        const ipo = await IpoRepository.getBySymbol(symbol);
        url = ipo?.extra.rhpUrl || ipo?.extra.drhpUrl || undefined;
        if (!url) throw new BadRequestError(`No RHP/DRHP link is recorded for ${symbol}. Upload the PDF instead.`);
      }
      if (!url) throw new BadRequestError('Provide a document URL or upload a PDF.');
      const dl = await downloadOfferDocument(url);
      bytes = dl.bytes;
      sourceUrl = dl.finalUrl;
    }

    const ipo = symbol ? await IpoRepository.getBySymbol(symbol) : null;
    const { document, reused } = await registerPdf({
      userId: user.id,
      bytes,
      fileName,
      sourceUrl,
      symbol: ipo?.symbol ?? symbol ?? null,
      companyName: ipo?.companyName ?? null,
    });

    if (reused) {
      return NextResponse.json({ success: true, data: document, reused: true, message: 'This document is already indexed.' });
    }

    if (inngestAvailable()) {
      await inngest.send({ name: EVENTS.indexDrhp, data: { documentId: document.id } });
      return NextResponse.json({ success: true, data: document, queued: true });
    }

    // No background worker configured: index and analyse within this request.
    await indexDocument(document.id);
    await runAndStoreAnalysis(document.id).catch(() => undefined); // failure is recorded on the analysis row
    return NextResponse.json({ success: true, data: { ...document, status: 'READY' }, queued: false });
  } catch (err) {
    return handleRouteError(err, 'drhp/documents:POST');
  }
}
