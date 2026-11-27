# IPOLENS deployment and operations

## Components

| Piece | Where it runs | Notes |
| --- | --- | --- |
| Next.js app (UI + API routes) | Vercel or any Node 20+ host | `npm run build && npm start` |
| Postgres + pgvector | Supabase | Required. All data lives here. |
| Redis | Upstash | Recommended: cache, locks, circuit breaker, rate limits across instances. Falls back to per-instance memory only in tests. |
| Background jobs and cron | Inngest | Served from `/api/inngest`. |
| Gemini | Google AI Studio | DRHP embeddings (`gemini-embedding-001`, 768 dims) and analysis. |
| Notifications | Web Push (VAPID), Twilio WhatsApp | Both optional; in-app notifications always work. |

## First-time setup

1. Copy `.env.example` to `.env.local` and fill in at least `DATABASE_URL`, `PAN_ENCRYPTION_KEY`, `PAN_HASH_SECRET`, `NEXTAUTH_SECRET`, `CRON_SECRET` and `GEMINI_API_KEY`.
2. Apply the migrations in `drizzle/`:
   - **New database:** `npm run db:migrate`.
   - **Existing database created earlier with `db:push`:** the tables in `0000_baseline.sql` already exist. Apply only `0001_allotment_rag_live_data.sql` and `0002_drhp_hybrid_search.sql` (Supabase SQL editor or the Supabase MCP). Then record the baseline as applied in `drizzle.__drizzle_migrations` before using `db:migrate` again.
   - `0001` enables `vector`, adds columns (no existing column changes) and new tables. `0002` adds full-text search and the `drhp_hybrid_search` function.
3. Run locally with two terminals:
   - `npm run dev:direct` (Next.js)
   - `npm run inngest:dev`, then set `INNGEST_DEV=1` in `.env.local`
4. Populate IPO data: trigger the `ipo-ingestion` function from the Inngest dev UI, or call `POST /api/scraper/sync` with `Authorization: Bearer $CRON_SECRET`.

## Scheduled jobs (Inngest)

| Function | Schedule (Asia/Kolkata) | What it does |
| --- | --- | --- |
| `ipo-ingestion` | Every 15 min 09:00–18:59 on weekdays; hourly otherwise | InvestorGain live report + per-IPO detail, cross-checked with the BSE public-issue list; upserts `ipos`, subscription and GMP history; refreshes AI GMP predictions |
| `gmp-model-refit` | 02:30 daily | Refits the listing-gain ridge model on listed IPOs (needs 12+ with subscription data) |
| `allotment-cron` | `*/30 8-23 * * *` | Checks up to 50 PENDING applications past their allotment date, oldest first; notifies on final outcomes |
| `drhp-index` / `drhp-analyze` | On upload | Chunk + embed an offer document, then run the 4-factor analysis |

Without Inngest configured, uploads and manual sync run inline in the request (`maxDuration` 300 s).

## Data sources and their limits

- **InvestorGain:** IPO list, issue details, registrar, prospectus links, category-wise bids and daily GMP. These are unofficial public pages, so ingestion keeps request volume low (about 25 detail fetches per run, 3 at a time).
- **BSE public-issue API:** official dates and price bands, used for cross-checking.
- **NSE:** its API resets connections from non-browser clients, so it is not used.
- **Yahoo Finance chart API:** delayed prices for listed IPOs. Responses are labelled as delayed; when it has no data the API returns an error, never a synthetic price.
- **GMP:** an informal, unregulated grey-market indication. It is always shown with its source and time, and never mixed with the AI estimate.

## Allotment checker

- **Path B (default):** `MANUAL_VERIFICATION_REQUIRED` with the official registrar page. It always works.
- **Path A:** direct registrar lookups, enabled by `REGISTRAR_DIRECT_QUERY=true` or by authorized B2B keys.
  - The endpoints are undocumented, may use CAPTCHA, and their terms may restrict automated access.
  - Each lookup is bounded by an 8 s timeout, a 24 h cache of final results, a 30 s lock per PAN, and a per-registrar circuit breaker (opens after 5 failures for 5 minutes).

### Runbook: a registrar changed its format

1. Symptoms: the circuit breaker opens for one registrar, and `last_error_code` on `ipo_applications` shows `MALFORMED_RESPONSE` or `CAPTCHA_OR_HTML`.
2. Capture one real response by checking your own PAN on the registrar site with browser devtools open. Save it under `tests/fixtures/registrars.ts`, with the PAN replaced.
3. Update the endpoint, headers or field names in `src/lib/services/allotment/config.ts`. The parsers are config-driven.
4. Run `npx vitest run tests/allotmentAdapters.test.ts` and deploy. While it is broken, users still get the one-click registrar link.

## Pre-launch checklist

- Start WhatsApp template approval in Twilio early; it can take days. Web Push works without it.
- Generate VAPID keys: `npx web-push generate-vapid-keys`.
- Set `PAN_ENCRYPTION_KEY` before storing real PANs. Changing it later makes stored PANs unreadable.
- Run `npm run typecheck`, `npm test` and `npm run build`.
