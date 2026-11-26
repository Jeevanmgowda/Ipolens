# IPOLENS — Development Roadmap

Source of truth for multi-session development. Issue IDs (I*, S*, D*, Q*) refer to `docs/AUDIT.md`.
Every phase ends with: `tsc`, `eslint`, `vitest`, `next build` green → update status docs → commit.

## Target architecture

```
src/
  app/                       routes only (thin)
    (marketing)/page.tsx     landing
    (auth)/signin, signup, onboarding, reset
    (app)/layout.tsx         AppShell + server-side auth gate
      dashboard, ipos, ipos/[symbol]/{page,analysis,documents},
      tracker, compare, family, applications, allotment,
      portfolio, market, notifications, settings
    api/…                    route handlers → withRoute() → server services
  features/<domain>/         components, hooks (TanStack Query), shared Zod schemas
  components/ui/             design-system primitives (Radix-based)
  server/
    <domain>/service.ts      business rules
    <domain>/repository.ts   Drizzle queries (always user-scoped)
    <domain>/adapters/       NSE, BSE, InvestorGain, Upstox, registrars, Gemini
    http/withRoute.ts        auth + zod + error envelope + requestId + rate tier
    jobs/                    ingestion, snapshots, allotment, notifications
  db/ schema/*.ts + migrations/
workers/                     single process: scheduler + market feed
```

Domains: `ipo`, `market`, `gmp`, `subscription`, `documents`, `analysis`, `family`, `applications`, `allotment`, `portfolio`, `notifications`, `users`, `admin`.

### Contracts
- Error: `{ error: { code, message, fieldErrors?, requestId, retryable } }`
- Success: `{ data, meta?: { provenance, page } }`
- Provenance: `{ source, asOf, status: live|delayed|stale|simulated|unavailable, url? }`
- Staleness: quote > 60 s · subscription > 30 min (market hours) · GMP > 24 h · IPO master > 24 h
- Cache (Redis): `ipo:list:{status}` 5 min · `quote:{sym}` 15 s · `gmp:{sym}` 30 min · `analysis:{docHash}:{promptVer}` permanent
- Real-time: worker → Redis pub/sub → one subscriber per instance → SSE fan-out, 20 s heartbeat

### Background jobs (`job_runs` recorded; Postgres queue via `FOR UPDATE SKIP LOCKED`)
| Job | Schedule | Writes |
|---|---|---|
| `ipo.sync` | 30 min, 08:00–20:00 IST | `ipos`, `ipo_events` |
| `subscription.snapshot` | 15 min while open, market hours | `ipo_subscription` |
| `gmp.snapshot` | 2 h | `ipo_gmp_history` |
| `listing.capture` | listing day 10:05 + close | `ipos.listing_*` |
| `quotes.feed` | continuous WS | Redis, `market_quotes` |
| `allotment.recheck` | hourly × 24 after allotment date | applications, notifications |
| `notifications.dispatch` | 5 min | in-app, email |
| `documents.ingest`, `analysis.run` | on demand | `ipo_documents`, `analysis_*` |
| `upstox.token.refresh` | daily | encrypted token store |

## API target (all routes via `withRoute`)
| Endpoint | Methods | Auth | Change |
|---|---|---|---|
| `/api/auth/{signup,signin,signout,me,google}` | existing | public/user | Zod, hashed sessions, lockout, consent |
| `/api/auth/{reset,verify}` | POST | public | new |
| `/api/auth/demo` | POST | dev only | keep gated |
| `/api/auth/upstox/*` | — | admin | merge duplicate callback, encrypted token |
| `/api/ipos?status=&q=&platform=&sort=&page=` | GET | public | replaces open/upcoming/closed/listed/live (aliases for one release) |
| `/api/ipos/[symbol]` | GET | public | DB-backed + provenance |
| `/api/ipos/[symbol]/subscription[/history]` | GET | public | stored snapshots |
| `/api/ipos/[symbol]/gmp[/history]` | GET | public | real points only |
| `/api/ipos/[symbol]/documents` | GET, POST | user (POST) | new |
| `/api/ipos/[symbol]/analysis` | GET, POST | user | new; replaces analysis/analyze-drhp/drhp-rag; POST → 202 + jobId |
| `/api/documents/[id]/ask` | POST | user | new, cited RAG Q&A, quota |
| `/api/compare?symbols=` | GET | public | new |
| `/api/market/[symbol]/{quote,ohlc,stream}` | GET | public | Redis fan-out; absorbs `ipos/chart(s)`, `market/charts/[symbol]` |
| `/api/market/ai-prediction` | POST | user | flag-gated (I9) |
| `/api/market/watchlist` | GET, POST, DELETE | user | Zod |
| `/api/pans`, `/api/pans/[id]` | GET, POST, PATCH, DELETE | user | PATCH, `pan_hash`, audit |
| `/api/pans/optimize-allocation` | POST | user | add auth |
| `/api/applications`, `/[id]` | GET, POST, PATCH, DELETE | user | state machine, FK |
| `/api/allotment/check` | POST | user | merges scan/multi-scan; writes back to applications |
| `/api/registrars` | GET | public | new |
| `/api/portfolio/holdings` | GET, DELETE | user | real day P&L |
| `/api/portfolio/imports[/id]` | GET, POST | user | replaces `portfolio/upload` |
| `/api/notifications`, `/[id]` | GET, PATCH | user | no user-authored notifications |
| `/api/settings/notifications` | GET, PUT | user | new |
| `/api/user/data` | GET (export), DELETE | user | add export |
| `/api/admin/jobs[/name/run]` | GET, POST | admin | replaces `scraper/sync` |
| `/api/health` | GET | public | new |

## Design system (Figma → Tailwind `@theme`)
- **Direction:** research terminal — dense but calm; no gradients, no glassmorphism, no decorative motion.
- **Colour (light / dark):** bg slate-50 / #0B0F17 · surface white / #111827 · surface-2 slate-100 / #161E2E · border slate-200 / #243044 · text slate-900 / slate-100 · muted slate-500 / slate-400 · accent indigo-600 / indigo-400 · gain emerald-600 / 400 · loss rose-600 / 400 · warning amber-600 / 400 · info sky-600 / 400 · `simulated` = amber dashed outline + label. WCAG AA for all pairs.
- **Type:** Inter (UI), JetBrains Mono tabular numerals (figures). Scale 12/13/14/16/20/24/32/40; weights 400/500/600.
- **Spacing:** 4 px base. **Radius:** 6 input, 10 card, 14 dialog. **Elevation:** 0, 1, overlay.
- **Grid:** 4 col @360, 8 @768, 12 @1024/1440; max width 1320.
- **Motion:** 150 ms UI, 250 ms panels; respects `prefers-reduced-motion`.
- **Components:** AppShell, Sidebar, TopBar, MobileBottomNav, Breadcrumbs · MetricTile, Delta, ProvenanceBadge, StatusPill, IpoCard, IpoRow, DataTable, Timeline, SubscriptionBar, Sparkline, PriceChart, SeriesChart · Button, Input, Select, Combobox, DatePicker, Checkbox, Switch, Segmented, FilterBar, SearchCommand (⌘K) · Dialog, Drawer, Toast, InlineAlert, Skeleton, EmptyState, ErrorState · PanChip, ApplicationRow, AllotmentResultCard, AiInsightBlock (claim + citation chips), DocumentViewer, NotificationItem, PreferenceRow. All with default/hover/focus/active/disabled/loading/error/empty states.
- **Screens (1440/768/360 + all states):** Landing · Auth & onboarding · Dashboard · Discovery `/ipos` · IPO detail · AI analysis · Document analysis · Tracker (subscription + GMP) · Compare · Family PANs · Applications · Allotment · Portfolio (incl. import flow) · Live market · Notifications · Settings.
- **Workflow:** design-system file (variables, styles, components) → app file (screens, prototypes) → Code Connect → implement via `get_design_context`. Frame IDs tracked in `docs/design/FRAMES.md`.

## Phases

### Phase 1 — Discovery & audit ✅ (2026-11-26)
- [x] Audit register `docs/AUDIT.md`
- [x] Handover docs: PROJECT_STATUS, DEVELOPMENT_ROADMAP, TECHNICAL_DECISIONS, KNOWN_ISSUES
- [x] Baseline metrics recorded

### Phase 2 — Architecture foundation
- [ ] `src/server/http/withRoute.ts` (auth, Zod, error envelope, requestId, rate tier)
- [ ] Structured logger with redaction (S13)
- [ ] `Provenance` type + Zod schema (shared)
- [ ] Rename `vitest.config.ts` → `.mts` (Q10)

### Phase 3 — Figma design system & screens (blocked: needs Figma edit access)
- [ ] Design-system file: variables, text styles, components
- [ ] Approval gate: design system + Dashboard + Discovery + IPO detail
- [ ] Remaining 13 screens, prototypes, Code Connect

### Phase 4 — Frontend implementation
- [ ] Tokens in `globals.css`, primitives in `components/ui`
- [ ] `(app)` layout with server auth gate; remove localStorage auth (S5)
- [ ] Route split (Q1) with `?tab=` redirects
- [ ] Screens in order: Discovery → IPO detail → Dashboard → Family → Applications → Allotment → Portfolio → AI/Documents → Tracker → Compare → Market → Notifications → Settings → Onboarding → Landing (split components Q3, TanStack Query Q7, provenance badges)
- [ ] Chart consolidation (Q6)
- [ ] Responsive QA 360/768/1024/1440 + keyboard + screen reader

### Phase 5 — Backend, database, API
- [ ] `drizzle-kit pull` + diff → non-destructive baseline (D1) — needs `DATABASE_URL`
- [ ] Additive migrations D2–D5, D8; new tables D9
- [ ] Hash session tokens (S4) — one-time re-login
- [ ] Consolidate service layers (Q2)
- [ ] Endpoints per API target; aliases for old routes
- [ ] Fail-closed persistence in production (S6)

### Phase 6 — Pending features
- [ ] Integrity fixes I1–I7
- [ ] Worker + job queue + `job_runs` + admin jobs page
- [ ] Document registry → PDF parse with page numbers → embeddings → structured analysis with `[{docId,page}]` citations, cached
- [ ] Subscription/GMP history charts, Compare, listing-performance table
- [ ] Application PATCH + state machine (Applied → Mandate approved → Allotted/Not allotted → Refunded/Listed) + allotment write-back
- [ ] Portfolio imports + row errors, CAS parser, realised P&L journal, IPO-holding linkage, real day P&L
- [ ] Notification preferences, rules (closing day, subscription milestone, GMP move > X %, allotment out, listing tomorrow, lock-in expiry), dispatcher, email
- [ ] Settings: profile, sessions/revoke, export, delete account

### Phase 7 — Security & performance
- [ ] S1, S3, S7–S13; AI quotas; `/security-review`; CSP; `npm audit`
- [ ] Server components for read-heavy pages; lazy charts; bundle budget; D4 indexes; Redis TTLs; shared SSE
- [ ] Targets: LCP < 2.5 s, INP < 200 ms (mid-range mobile)

### Phase 8 — Testing
- [ ] Lint to 0 errors, blocking in CI (Q4)
- [ ] Unit: parsers, P&L, allocation, staleness, state machine, redaction
- [ ] Contract: every route; auth matrix (anon / user / other user / admin)
- [ ] Integration: Postgres service container in CI (migrations, ownership isolation, queue)
- [ ] Adapter fixtures (no network) for NSE, BSE, InvestorGain, Upstox, Gemini
- [ ] Playwright: register/login, dashboard, discovery, IPO detail, document analysis (stubbed Gemini), subscription/GMP, add PAN, application, allotment, portfolio import
- [ ] axe a11y per page; visual snapshots × 3 widths

### Phase 9 — Documentation & readiness
- [ ] README, `docs/ENV.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/TESTING.md`, DEPLOYMENT.md
- [ ] Terms, privacy, risk disclosure, GMP disclaimer, "not investment advice"
- [ ] Go/no-go: zero critical issues, backup restore tested, monitoring live, provenance on every data surface

## Session protocol
- **Start:** read PROJECT_STATUS → KNOWN_ISSUES → this file → `git log` since last entry → run baseline checks.
- **End:** update all four docs (inspected, changed, fixed, implemented, remaining, tests run + results, blockers, exact next task) → commit → push.
