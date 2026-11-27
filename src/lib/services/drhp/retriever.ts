import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { embedTexts } from './gemini';
import { SECTION_LABELS, type DrhpSection } from './document-parsing';

export interface RetrievedChunk {
  id: number;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  section: DrhpSection;
  content: string;
  score: number;
}

interface SearchRow {
  id: number | string;
  chunk_index: number | string;
  page_start: number | string;
  page_end: number | string;
  section: string;
  content: string;
  score: number | string;
}

/** Hybrid (pgvector + full-text, RRF-fused) search inside one document. */
export async function retrieve(
  documentId: string,
  query: string,
  opts: { k?: number; sections?: DrhpSection[]; embedding?: number[] } = {}
): Promise<RetrievedChunk[]> {
  const [vec] = opts.embedding ? [opts.embedding] : await embedTexts([query], 'RETRIEVAL_QUERY');
  const vecLiteral = `[${vec.join(',')}]`;
  const sections = opts.sections?.length ? opts.sections : null;
  const result = (await getDb().execute(sql`
    select * from drhp_hybrid_search(
      ${documentId},
      ${query},
      ${vecLiteral}::vector,
      ${opts.k ?? 8},
      ${sections ? sql`ARRAY[${sql.join(sections.map((s) => sql`${s}`), sql`, `)}]::text[]` : sql`NULL::text[]`}
    )`)) as unknown as { rows?: SearchRow[] } | SearchRow[];
  const rows: SearchRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows.map((r) => ({
    id: Number(r.id),
    chunkIndex: Number(r.chunk_index),
    pageStart: Number(r.page_start),
    pageEnd: Number(r.page_end),
    section: r.section as DrhpSection,
    content: String(r.content),
    score: Number(r.score),
  }));
}

/** Runs several queries and merges unique chunks in page order, for an LLM context window. */
export async function retrieveMany(
  documentId: string,
  queries: string[],
  opts: { kPerQuery?: number; sections?: DrhpSection[]; maxChunks?: number } = {}
): Promise<RetrievedChunk[]> {
  const embeddings = await embedTexts(queries, 'RETRIEVAL_QUERY');
  const seen = new Map<number, RetrievedChunk>();
  for (let i = 0; i < queries.length; i++) {
    const hits = await retrieve(documentId, queries[i], { k: opts.kPerQuery ?? 5, sections: opts.sections, embedding: embeddings[i] });
    for (const h of hits) if (!seen.has(h.id) || seen.get(h.id)!.score < h.score) seen.set(h.id, h);
  }
  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxChunks ?? 14)
    .sort((a, b) => a.pageStart - b.pageStart);
}

export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c) =>
        `[pages ${c.pageStart}${c.pageEnd !== c.pageStart ? `-${c.pageEnd}` : ''} | ${SECTION_LABELS[c.section]}]\n${c.content}`
    )
    .join('\n\n---\n\n');
}
