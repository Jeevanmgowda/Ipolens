import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { BROWSER_UA } from '@/lib/ingestion/http';
import { BadRequestError } from '@/lib/http';
import { chunkPages, extractPdfPages, tagSections } from './document-parsing';
import { embedTexts } from './gemini';

/**
 * DRHP/RHP document lifecycle: accept a PDF (upload or allow-listed URL), store page text,
 * chunk by section, embed with Gemini and persist into pgvector.
 */

export const MAX_PDF_BYTES = 60 * 1024 * 1024;
const ALLOWED_HOSTS = ['sebi.gov.in', 'bseindia.com', 'nseindia.com'];

export type DrhpDocument = typeof schema.drhpDocumentsTable.$inferSelect;

function hostAllowed(url: URL): boolean {
  return url.protocol === 'https:' && ALLOWED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

/** Downloads an offer document. SEBI filing pages embed the PDF; follow that link. */
export async function downloadOfferDocument(rawUrl: string, depth = 0): Promise<{ bytes: Uint8Array; finalUrl: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError('Invalid document URL.');
  }
  if (!hostAllowed(url)) throw new BadRequestError(`Only offer documents hosted on ${ALLOWED_HOSTS.join(', ')} can be fetched.`);

  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/pdf,text/html;q=0.9' },
    signal: AbortSignal.timeout(90000),
    redirect: 'follow',
  });
  if (!res.ok) throw new BadRequestError(`Could not download the document (HTTP ${res.status}).`);
  const finalUrl = new URL(res.url || url.toString());
  if (!hostAllowed(finalUrl)) throw new BadRequestError('The document redirected to a host that is not allowed.');

  const type = res.headers.get('content-type') || '';
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_PDF_BYTES) throw new BadRequestError('Document is larger than 60 MB.');

  if (type.includes('html')) {
    if (depth > 0) throw new BadRequestError('No PDF found at that link.');
    const html = await res.text();
    const match =
      /file=(https?:\/\/[^"'&\s]+\.pdf)/i.exec(html) || /(https?:\/\/[^"'\s]+\.pdf)/i.exec(html) || /src="([^"]+\.pdf)"/i.exec(html);
    if (!match) throw new BadRequestError('No PDF link was found on that page.');
    return downloadOfferDocument(new URL(match[1], finalUrl).toString(), depth + 1);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_PDF_BYTES) throw new BadRequestError('Document is larger than 60 MB.');
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) {
    throw new BadRequestError('The downloaded file is not a PDF.');
  }
  return { bytes: buf, finalUrl: finalUrl.toString() };
}

export async function getDocument(id: string): Promise<DrhpDocument | null> {
  const rows = await getDb().select().from(schema.drhpDocumentsTable).where(eq(schema.drhpDocumentsTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listDocuments(filter: { symbol?: string; userId?: string }) {
  const t = schema.drhpDocumentsTable;
  const conds = [];
  if (filter.symbol) conds.push(eq(t.symbol, filter.symbol.toUpperCase()));
  if (filter.userId) conds.push(eq(t.userId, filter.userId));
  return getDb()
    .select()
    .from(t)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.createdAt))
    .limit(25);
}

async function setStatus(id: string, status: string, extra: Partial<DrhpDocument> = {}) {
  await getDb()
    .update(schema.drhpDocumentsTable)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(schema.drhpDocumentsTable.id, id));
}

/**
 * Registers a PDF and stores its page text. Identical files (same SHA-256) that are already
 * indexed are reused instead of being embedded again.
 */
export async function registerPdf(input: {
  userId: string;
  bytes: Uint8Array;
  fileName?: string | null;
  sourceUrl?: string | null;
  symbol?: string | null;
  companyName?: string | null;
}): Promise<{ document: DrhpDocument; reused: boolean }> {
  const sha256 = crypto.createHash('sha256').update(input.bytes).digest('hex');
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.drhpDocumentsTable)
    .where(and(eq(schema.drhpDocumentsTable.sha256, sha256), eq(schema.drhpDocumentsTable.status, 'READY')))
    .limit(1);
  if (existing[0]) return { document: existing[0], reused: true };

  let pages: string[];
  try {
    pages = await extractPdfPages(input.bytes);
  } catch {
    throw new BadRequestError('The PDF could not be read. It may be scanned, encrypted or corrupted.');
  }
  const textChars = pages.reduce((s, p) => s + p.trim().length, 0);
  if (textChars < 2000) {
    throw new BadRequestError('This PDF has almost no extractable text (it may be a scanned image). Upload the text-based RHP/DRHP.');
  }

  const id = `drhp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const [doc] = await db
    .insert(schema.drhpDocumentsTable)
    .values({
      id,
      userId: input.userId,
      symbol: input.symbol ? input.symbol.toUpperCase() : null,
      companyName: input.companyName || null,
      sourceUrl: input.sourceUrl || null,
      fileName: input.fileName || null,
      sha256,
      pageCount: pages.length,
      status: 'QUEUED',
    })
    .returning();

  const BATCH = 100;
  for (let i = 0; i < pages.length; i += BATCH) {
    await db.insert(schema.drhpPagesTable).values(
      pages.slice(i, i + BATCH).map((text, j) => ({ documentId: id, pageNumber: i + j + 1, text: text.slice(0, 50000) }))
    );
  }
  return { document: doc, reused: false };
}

/** Chunks and embeds a registered document. Idempotent: clears previous chunks first. */
export async function indexDocument(id: string): Promise<{ chunks: number }> {
  const db = getDb();
  await setStatus(id, 'INDEXING', { error: null });
  try {
    const pageRows = await db
      .select()
      .from(schema.drhpPagesTable)
      .where(eq(schema.drhpPagesTable.documentId, id))
      .orderBy(schema.drhpPagesTable.pageNumber);
    const tagged = tagSections(pageRows.map((p) => p.text));
    const chunks = chunkPages(tagged);
    await db.delete(schema.drhpChunksTable).where(eq(schema.drhpChunksTable.documentId, id));

    const BATCH = 50;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vectors = await embedTexts(slice.map((c) => c.content), 'RETRIEVAL_DOCUMENT');
      await db.insert(schema.drhpChunksTable).values(
        slice.map((c, j) => ({
          documentId: id,
          chunkIndex: c.chunkIndex,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          section: c.section,
          content: c.content,
          embedding: vectors[j],
        }))
      );
    }
    await setStatus(id, 'READY', { chunkCount: chunks.length });
    return { chunks: chunks.length };
  } catch (err) {
    await setStatus(id, 'FAILED', { error: (err as Error).message.slice(0, 1000) });
    throw err;
  }
}
