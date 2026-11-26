# IPOLENS — Known Issues

Full details, root causes and fixes: `docs/AUDIT.md`. Update status here as items close.

## Critical
- **I1** GMP multi-source consensus is synthesised (×1.02 / ×0.98) — `src/services/gmpService.ts`
- **I2** GMP history is generated, not stored — `gmpService.getGmpHistory`
- **I3** Portfolio day P&L hardcoded at 1.2 % — `src/app/api/portfolio/holdings/route.ts`
- **I4** Speculative "JIOPLAT" IPO hardcoded as default — `page.tsx`, `AiResearchView.tsx`, `geminiAnalyst.ts`
- **S1** AI/compute endpoints unauthenticated — `/api/market/analyze-drhp`, `/api/market/drhp-rag`, `/api/analysis`, `/api/pans/optimize-allocation`, `/api/market/ai-prediction`
- **S2** No request validation on any API route (Zod unused)
- **D1** No database migrations; `db:push` only

## High
- **I5** Mock market data default; provenance not shown everywhere
- **I6** Hardcoded IPO directory and Gemini profiles
- **I7** `data/ipos.json` stale (0 open IPOs)
- **S3** `/api/scraper/sync` uses `child_process.exec`
- **S4** Session tokens stored in plaintext
- **S5** Auth state cached in localStorage
- **S6** Silent in-memory persistence fallback
- **S7** Upstox PIN/TOTP stored in `.env.local` for headless login
- **D2–D5** `default_user` defaults, no FKs, no indexes, no uniqueness constraints
- **Q1** Single-page tab app, no routes
- **Q2** Duplicate service layers

## Medium / Low
I8, I9, S8–S13, D6–D8, Q3–Q10 — see `docs/AUDIT.md`.

## External blockers
- Figma: account has a **View** seat on Starter plan — cannot create/edit design files.
- No `DATABASE_URL`, `REDIS_URL`, `GEMINI_API_KEY`, Upstox credentials available in the dev environment.
- Registrar B2B API agreements (long-term; handoff flow is the compliant default).
