# IPOLENS

IPO research and family-PAN tracking for Indian primary markets:

- **Live IPO radar:** upcoming, open, closed and listed issues from live sources, stored in Postgres. There is no mock data.
- **DRHP AI analyst:** a Gemini-powered RAG over the actual RHP/DRHP that applies a 4-factor checklist and gives a rating out of 10 with page citations.
- **Allotment checker:** a registrar check (or one-click registrar link) for each family PAN, with results persisted, synced to the portfolio and notified.
- **Market GMP vs AI GMP:** the scraped grey-market premium (source and time shown) next to an independent model estimate.

Setup, jobs, data-source limits and runbooks are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Quick start

```bash
cp .env.example .env.local   # fill in DATABASE_URL, GEMINI_API_KEY and the secrets
npm install
npm run dev:direct           # app on http://localhost:3000
npm run inngest:dev          # cron + background jobs (set INNGEST_DEV=1)
```

Then sign up, trigger IPO ingestion (see DEPLOYMENT.md), add family PANs in the PAN tab, and record applications.

## Architecture

```
InvestorGain (list + detail) ─┐
BSE public issues ────────────┼─> ingestion job (Inngest cron) ─> Postgres: ipos, ipo_subscription, ipo_gmp_history
                              │                                        │
                              │                       IpoRepository ───┴─> /api/ipos/**, /api/live-market (one shape, nulls not defaults)
Yahoo Finance (delayed) ─────────> MarketService ─> /api/market/[symbol]/{quote,ohlc}, /api/market/stream

RHP/DRHP PDF (upload or BSE/SEBI link) ─> unpdf (per page) ─> section tagging + chunking ─> Gemini embeddings
   ─> pgvector + full-text (RRF hybrid search) ─> 4 targeted extractions (Gemini, JSON schema) ─> deterministic scorecard

ipo_applications ─> AllotmentGatewayService (cache → lock → breaker → registrar adapter | deep link)
   ─> idempotent persist ─> P&L journal + holdings ─> notifications (in-app, Web Push, WhatsApp)
```

Key code:

- **Ingestion:** `src/lib/ingestion/`, read path in `src/lib/repositories/ipo.repository.ts`.
- **AI GMP:** `src/lib/services/gmp-prediction.service.ts`. A ridge regression trained on real listings; it does not use market GMP as an input.
- **DRHP analyst:** `src/lib/services/drhp/`. Scoring lives in `scoring.ts` and is pure code; the LLM writes only the narrative.
- **Allotment:**
  - `src/lib/services/allotment/` (types, config, helpers, three adapters, gateway, family check)
  - `src/lib/services/notification.service.ts`
  - `src/lib/services/pnl.service.ts`
- **Jobs:** `src/inngest/functions/`.

## The DRHP checklist

| Factor (2.5 pts each) | What is extracted (with page citations) | How it is scored |
| --- | --- | --- |
| OFS vs fresh issue | Fresh issue, OFS, selling shareholders, objects of the issue | Lower OFS share scores higher; majority OFS and promoter selling are penalised |
| Cash flow & P&L | 3 years of revenue, EBITDA, PAT, operating cash flow, debt, net worth | Profitability, PAT trend, revenue CAGR, positive CFO, cash conversion, leverage |
| Valuation | EPS, P/E at upper band, listed peers from "Basis for Offer Price" | Issue P/E vs peer median |
| DRHP overview | Risks (rated), growth drivers, litigation, concentration | Deductions for high and medium risks, litigation and concentration |

Verdict: 7 or more → Apply; 5 to 7 → Apply only for listing gains or with caution; below 5 → Avoid. This is educational analysis, not investment advice.

## Allotment API

| Route | Body | Notes |
| --- | --- | --- |
| `POST /api/allotment/check` | `{ applicationId }` | Your application. Persisted once final; notifies |
| `POST /api/allotment/check` | `{ symbol, pan }` | Ad-hoc check, not stored |
| `POST /api/allotment/check-family` | `{ symbol }` | Every family PAN you applied with, plus totals and refunds |
| `POST/DELETE /api/push/subscribe` | Push subscription | Web Push devices |
| `GET/PUT /api/user/notification-settings` | `{ phone, whatsappOptIn }` | WhatsApp alerts |

All four outcomes return HTTP 200:

- `ALLOTTED`
- `NOT_ALLOTTED`
- `PENDING`
- `MANUAL_VERIFICATION_REQUIRED`, which includes `fallbackUrl`

Other responses:

- 400: invalid body
- 401: signed out
- 404: not found or not yours
- 429: more than 10 checks per minute

## Testing

```bash
npm run typecheck
npm test        # runs against an in-process Postgres (PGlite + pgvector) with all migrations applied
npm run build
```

Tests never call Gemini or registrars. Ingestion parsers are tested against real captured InvestorGain and BSE responses in `tests/fixtures/ingestion/`.

## Disclaimer

IPOLENS is not a SEBI-registered investment adviser or research analyst. GMP figures are unofficial, and AI outputs can be wrong. Nothing here is investment advice.
