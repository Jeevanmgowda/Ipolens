# IPOLENS — Technical Decisions (ADR log)

Format: ID · Date · Status (Proposed / Accepted / Superseded) · Decision · Rationale · Consequences.

## ADR-001 · 2026-11-26 · Accepted — Keep the core stack
Next.js 16 App Router, React 19, TypeScript, Tailwind 4, PostgreSQL + Drizzle, Redis (ioredis), SSE, Gemini (`@google/genai`), Vitest. All build and test green today; replacing any of them adds risk without benefit.

## ADR-002 · 2026-11-26 · Accepted — Keep first-party DB session auth (no Supabase Auth migration)
The blueprint suggests Supabase Auth. The existing implementation (random 256-bit tokens, HttpOnly/SameSite=Lax cookies, PBKDF2-SHA512, Google ID-token verification) is sound. Hardening instead of migrating: hash stored tokens (S4), remove localStorage auth state (S5), add reset/verify/lockout (S10). Revisit only if RLS-based multi-tenant access becomes a requirement.

## ADR-003 · 2026-11-26 · Accepted — Data provenance is mandatory
Every market/IPO figure carries `{ source, asOf, status, url? }`. The UI must render a `ProvenanceBadge` with every figure. Simulated data is allowed only in dev/test and always labelled. Derived or synthesised "sources" are forbidden (fixes I1/I2).

## ADR-004 · 2026-11-26 · Proposed — Postgres-backed job queue
Use a `jobs` table with `SELECT … FOR UPDATE SKIP LOCKED`, run by the existing `workers/` process, with `job_runs` history. Avoids a new paid dependency. Inngest/Trigger.dev remain alternatives if scheduling needs outgrow this.

## ADR-005 · 2026-11-26 · Proposed — Client data with TanStack Query
Replaces ad-hoc `useEffect` fetching and duplicated polling (Q7). Server components handle read-heavy, SEO-relevant pages.

## ADR-006 · 2026-11-26 · Proposed — Radix primitives (shadcn/ui pattern) for accessible components
Dialogs, menus, tabs, comboboxes need correct focus/keyboard behaviour; Radix provides it without a heavy UI kit. Components are copied into `src/components/ui` and themed by our tokens.

## ADR-007 · 2026-11-26 · Proposed — Playwright for E2E, axe-core for a11y
Uses the pre-installed Chromium in CI/dev environments.

## ADR-008 · 2026-11-26 · Accepted — Single route wrapper `withRoute()`
All API handlers go through one wrapper providing auth, Zod validation, rate tier, standard error envelope and request IDs (fixes S1/S2, Q8).

## ADR-009 · 2026-11-26 · Accepted — Migrations only; no `db:push` against shared/production databases
Baseline produced from introspection; all subsequent changes are reviewed, additive-first migrations. Destructive steps require explicit sign-off.

## ADR-010 · 2026-11-26 · Accepted — No registrar captcha bypass
Direct allotment checks only via authorised B2B APIs. Otherwise the official-portal handoff (already implemented) is the product behaviour, not a fallback to hide.

## Pending decisions (need product owner)
- **PD-1:** Angel One — drop, or keep as second market-data provider behind `MarketDataProvider`?
- **PD-2:** AI price-prediction panel (I9) — reframe as scenario analysis, or feature-flag off?
- **PD-3:** Upstox headless auto-login (S7) — keep as dev-only opt-in or remove?
- **PD-4:** Email provider for alerts (Resend / SMTP / none for now).
