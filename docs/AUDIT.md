# IPOLENS — Project Audit

Audit date: 2026-11-26 · Baseline commit: `188a8f1`
Scope: full repository (frontend, API routes, services, DB schema, security, tests, docs, blueprint in `docs/IPOLENS_2_Full_Application_Blueprint.docx`).

## Baseline measurements (executed, not assumed)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit -p tsconfig.json` | ✅ 0 errors |
| Unit tests | `npx vitest run` | ✅ 180/180 tests, 25 files |
| Production build | `npx next build` | ✅ succeeds |
| ESLint | `npx eslint` | ❌ 454 problems (257 errors, 197 warnings), mostly `no-explicit-any`; CI runs lint non-blocking |
| E2E / a11y | — | ❌ none exist |
| Migrations | `ls drizzle/` | ❌ no migrations folder; only `db:push` is used |

Status column legend: **Open** · **In progress** · **Fixed** · **Won't fix** (with reason).

---

## A1. Data integrity — simulated values presented as real

| ID | Issue | Root cause | Affected modules | Severity | Recommended fix | Status |
|---|---|---|---|---|---|---|
| I1 | GMP "multi-source consensus" is fabricated: "Chittorgarh" = InvestorGain × 1.02, "IPOWatch" = × 0.98 | Placeholder logic | `src/services/gmpService.ts` (L95-145), `src/services/mlListingGainModel.ts` | Critical | Show only sources actually scraped; each quote stores `source`, `asOf`, `url`. Remove derived sources | Open |
| I2 | GMP history curve is generated from the current value | No ingestion into `ipo_gmp_history` | `gmpService.getGmpHistory`, `/api/ipos/[symbol]/gmp/history`, `LiveGmpTrendChart.tsx` | Critical | Worker persists each scrape; API returns stored points only; chart shows empty state if < 2 points | Open |
| I3 | Portfolio day P&L hardcoded (`currentValue × 0.012`, `1.2 %`) | Placeholder | `src/app/api/portfolio/holdings/route.ts` | Critical | Compute from previous-close quotes, else return `null` → "Unavailable" | Open |
| I4 | "JIOPLAT" (Jio Platforms @ ₹450, lot 33) hardcoded as upcoming IPO and global default selection | Showcase data | `src/app/page.tsx`, `AiResearchView.tsx:70`, `geminiAnalyst.ts:25`, `IpoCategoriesTabs.tsx:124`, `config/ipoDirectory.ts` | Critical | Remove; default to first real open IPO or empty state | Open |
| I5 | Mock market data is the default (`USE_MOCK_MARKET_DATA=true`); `isMock` not surfaced on every view; `Math.random` ticks | No provenance contract | `services/marketDataProvider.ts`, `lib/services/upstox-feed-v3.service.ts`, `LiveStockPriceChart.tsx` | High | Mandatory `Provenance` type + `ProvenanceBadge` on every figure | Open |
| I6 | Hardcoded IPO directory (30 entries) and Gemini "known IPO" profiles | Prototype data | `config/ipoDirectory.ts`, `services/geminiAnalyst.ts` | High | Move to test/dev seed fixtures; production reads `ipos` table only | Open |
| I7 | `data/ipos.json` stale (generated 2026-11-17; 0 open, 1 upcoming, 84 closed) | Manual `npm run scrape` | `data/`, `scripts/scraper/*` | High | Scheduled ingestion into Postgres + freshness labels | Open |
| I8 | "ML listing-gain model" is a hand-weighted heuristic, not a trained model | Naming | `mlListingGainModel.ts`, `lib/services/ai-trading-prediction.service.ts` | Medium | Rename "Heuristic estimate"; backtest on historical listings and publish error | Open |
| I9 | AI price-forecast panel reads as investment advice | Scope creep | `components/charts/AiStockPredictionPanel.tsx`, `/api/market/ai-prediction` | Medium | Reframe as scenario analysis + disclaimer, or feature-flag off (decision needed) | Open |

## A2. Security

| ID | Issue | Root cause | Affected modules | Severity | Recommended fix | Status |
|---|---|---|---|---|---|---|
| S1 | Unauthenticated AI/compute endpoints (Gemini cost abuse) | Auth not applied | `/api/market/analyze-drhp`, `/api/market/drhp-rag`, `/api/analysis`, `/api/pans/optimize-allocation`, `/api/market/ai-prediction` | Critical | Require session; per-user AI quota (Redis); cache by doc hash + prompt version | Open |
| S2 | No request validation (Zod installed, 0 imports) | Not implemented | All `src/app/api/**` | Critical | `withRoute()` wrapper: auth + Zod schema + error envelope + requestId | Open |
| S3 | `/api/scraper/sync` POST runs Python via `child_process.exec` | Convenience | `src/app/api/scraper/sync/route.ts` | High | Remove HTTP trigger; worker runs ingestion; admin "run now" enqueues a job | Open |
| S4 | Session tokens stored in plaintext (`user_sessions.id`) | Design | `lib/security/session.ts`, `db/schema.ts` | High | Store SHA-256(token); rotate on login/privilege change | Open |
| S5 | Client treats localStorage user profile as auth state | Legacy | `src/context/AuthContext.tsx` | High | Hydrate from `/api/auth/me`; no auth data in localStorage | Open |
| S6 | Silent in-memory fallback for users/sessions/PANs/applications | Resilience shortcut | `services/authStore.ts`, `lib/security/session.ts`, `api/pans`, `api/applications`, `db/index.ts` | High | Fail closed in production; memory adapter only in tests/dev flag | Open |
| S7 | Upstox auto-login stores mobile, PIN, TOTP secret in `.env.local` and drives Puppeteer | Convenience | `scripts/devWithUpstox.mjs`, `scripts/getUpstoxToken.mjs` | High | Dev-only opt-in with risk note; prod uses OAuth code flow + encrypted server token | Open |
| S8 | No Origin / Sec-Fetch-Site requirement on mutating requests lacking an Origin header | Partial CSRF defence | `src/proxy.ts`, `lib/security/cors.ts` | Medium | Require same-origin signal for POST/PUT/PATCH/DELETE | Open |
| S9 | No audit log for sensitive actions | Not built | — | Medium | `audit_events` table + `audit()` helper | Open |
| S10 | No password reset, email verification, or lockout | Not built | auth routes | Medium | Hashed reset tokens (30 min), verification, lockout after N failures | Open |
| S11 | Consent defaulted (`terms_accepted` default `true`) | Schema | `usersTable` | Medium | Explicit `consent_events` | Open |
| S12 | CSV upload lacks size/row caps; export formula-injection risk | Not built | `api/portfolio/upload`, `services/brokerParser.ts` | Medium | 5 MB / 10k rows, MIME check, formula escaping | Open |
| S13 | No log redaction for PAN/email/token/UPI | Not built | `lib/logger.util.ts` | Medium | Redaction layer | Open |

## A3. Database

| ID | Issue | Severity | Recommended fix | Status |
|---|---|---|---|---|
| D1 | No migrations; only `drizzle-kit push` | Critical | `drizzle-kit pull` + diff vs schema → non-destructive `0000_baseline`; reviewed migrations thereafter | Open |
| D2 | `user_id` defaults to `'default_user'` on PANs, applications, holdings | High | Drop default, NOT NULL, FK → `users.id` ON DELETE CASCADE (pre-check for `default_user` rows — report, never delete) | Open |
| D3 | No foreign keys (applications→pans, sessions→users, holdings→users) | High | Add FKs | Open |
| D4 | No indexes on `user_id`, `symbol`, `(symbol, captured_at)` | High | Composite indexes | Open |
| D5 | No uniqueness on (user, PAN) or (PAN, IPO); duplicate-bid rule only in app code | High | `pan_hash` (HMAC) + unique constraints | Open |
| D6 | Applications duplicate masked PAN / holder name / relationship | Medium | Keep FK, join on read | Open |
| D7 | Holdings persist `current_price` (goes stale) | Medium | Join live `market_quotes` at read time | Open |
| D8 | Status/type columns are free `varchar` | Medium | Enums / CHECK constraints | Open |
| D9 | Missing tables | — | `ipo_documents`, `analysis_jobs`, `analysis_results`, `portfolio_imports`, `import_row_errors`, `notification_prefs`, `audit_events`, `job_runs`, `consent_events`, `registrars`, `ipo_events` | Open |

## A4. Architecture & code quality

| ID | Issue | Severity | Recommended fix | Status |
|---|---|---|---|---|
| Q1 | Entire app is one client `page.tsx` switching tabs via `useState` (no deep links, no SSR) | High | Real App Router routes | Open |
| Q2 | Two parallel service layers (`src/services` 17 files, `src/lib/services` 20) with overlapping IPO logic | High | Consolidate into `src/server/<domain>` | Open |
| Q3 | Oversized components (AiResearchView 1779 LOC, AllotmentChecker 1477, IpoCategoriesTabs 1157, IpoDetailModal 1074, LiveStockPriceChart 951) | Medium | Split into feature components + hooks | Open |
| Q4 | 257 lint errors; lint non-blocking in CI | Medium | Fix, then make blocking | Open |
| Q5 | Duplicate routes `/login`, `/register`; two Upstox callbacks | Low | Consolidate | Open |
| Q6 | Four chart implementations | Medium | One `PriceChart` + one `SeriesChart` | Open |
| Q7 | Ad-hoc `useEffect` fetching, mixed polling + SSE | Medium | TanStack Query + shared SSE hook | Open |
| Q8 | No observability (request IDs, error tracking, job metrics) | Medium | Structured logger, `job_runs`, optional Sentry | Open |
| Q9 | Documentation drift (DEPLOYMENT describes Angel One/Trigger.dev; README env table ≠ `.env.example`) | Medium | Rewrite in Phase 9 | Open |
| Q10 | `vitest.config.ts` ESM/CJS warning | Low | Rename to `.mts` | Open |

## A5. Feature inventory (exists vs. planned)

| Feature | Current state | Gap |
|---|---|---|
| IPO discovery | Built on stale JSON + hardcoded data | DB-backed ingestion, filters, search |
| IPO detail | Modal only | Dedicated route with tabs |
| DRHP/RHP RAG | `drhp-rag.service.ts` | Document store, job queue, page citations, auth, caching |
| AI insights | `geminiAnalyst.ts` w/ hardcoded profiles | Structured Zod output, citations, prompt versioning |
| Subscription tracking | Service | Persisted snapshots + history |
| GMP tracking | Fabricated (I1/I2) | Real snapshots |
| IPO comparison | Missing | Build |
| Listing performance | `listedIpoService` | Persist listing open/close/gain |
| Family PANs | Built, encrypted | PATCH, unique constraints, audit |
| Applications | Built | Edit, state machine, allotment link |
| Allotment | Adapters + compliant official-portal handoff | Write-back to applications, scheduled recheck |
| Portfolio CSV | `brokerParser` | Import history, row errors, CAS, realised P&L |
| Live market | SSE (Upstox/mock) | Provenance, Redis fan-out |
| Watchlist | Built | Alerts |
| Anchor lock-in | Built | Verify data source |
| Notifications | Drawer + API | Preferences, dispatcher, email, reminders |
| Profile/settings | Missing | Build (purge API exists) |
| Onboarding | Missing | Build |

## A6. Integration reality check

| Integration | Real path | Restriction | Transparent fallback |
|---|---|---|---|
| NSE / BSE IPO data | Scrapers → worker | Cookie handshake, blocking | Last good DB copy, labelled stale |
| GMP (InvestorGain) | Scrape + cite | Unofficial, unregulated | "GMP unavailable" — never derived |
| Subscription | NSE bid details | Market hours | Last snapshot + timestamp |
| Upstox | OAuth + Feed v3 | Daily token, rate limits | "Delayed" REST close, or "Simulated" (dev only, badged) |
| Angel One | Documented only | — | Decision needed: drop or second provider |
| Registrars | B2B API only with agreement | Captcha — no bypass | Official portal handoff (already compliant) |
| Gemini | Structured JSON + Zod | Cost / quota | "Analysis unavailable" — no canned text |
| Redis / Postgres | ioredis / Drizzle | — | Memory only in dev/test |
