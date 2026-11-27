-- Full-text search column for DRHP chunks (kept outside the Drizzle schema: generated column)
ALTER TABLE "drhp_chunks" ADD COLUMN IF NOT EXISTS "fts" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drhp_chunks_fts_idx" ON "drhp_chunks" USING gin ("fts");--> statement-breakpoint

-- Hybrid retrieval: pgvector cosine similarity + Postgres full-text rank, fused with
-- Reciprocal Rank Fusion (k = 60). Optionally restricted to a set of DRHP sections.
CREATE OR REPLACE FUNCTION drhp_hybrid_search(
  p_document_id varchar,
  p_query_text text,
  p_query_embedding vector(768),
  p_match_count integer DEFAULT 8,
  p_sections text[] DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  chunk_index integer,
  page_start integer,
  page_end integer,
  section varchar,
  content text,
  score double precision
)
LANGUAGE sql STABLE
AS $$
  WITH semantic AS (
    SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> p_query_embedding) AS rank
    FROM drhp_chunks c
    WHERE c.document_id = p_document_id
      AND c.embedding IS NOT NULL
      AND (p_sections IS NULL OR c.section = ANY (p_sections))
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_match_count * 4
  ),
  lexical AS (
    SELECT c.id,
           row_number() OVER (ORDER BY ts_rank_cd(c.fts, websearch_to_tsquery('english', p_query_text)) DESC) AS rank
    FROM drhp_chunks c
    WHERE c.document_id = p_document_id
      AND c.fts @@ websearch_to_tsquery('english', p_query_text)
      AND (p_sections IS NULL OR c.section = ANY (p_sections))
    ORDER BY ts_rank_cd(c.fts, websearch_to_tsquery('english', p_query_text)) DESC
    LIMIT p_match_count * 4
  ),
  fused AS (
    SELECT COALESCE(s.id, l.id) AS id,
           COALESCE(1.0 / (60 + s.rank), 0.0) + COALESCE(1.0 / (60 + l.rank), 0.0) AS score
    FROM semantic s
    FULL OUTER JOIN lexical l ON s.id = l.id
  )
  SELECT c.id, c.chunk_index, c.page_start, c.page_end, c.section, c.content, f.score::double precision
  FROM fused f
  JOIN drhp_chunks c ON c.id = f.id
  ORDER BY f.score DESC
  LIMIT p_match_count;
$$;
