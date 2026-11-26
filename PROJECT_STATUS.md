# IPOLENS — Project Status

_Last updated: 2026-11-26 · Branch: `claude/eloquent-turing-0pjt3g`_

## Current phase
**Phase 1 (Discovery & audit) — complete.** Next: Phase 2 (architecture foundation) and Phase 6 integrity fixes (I1–I4, S1).

## Health baseline (executed 2026-11-26)
| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ pass |
| `vitest run` | ✅ 180/180 (25 files) |
| `next build` | ✅ pass |
| `eslint` | ❌ 257 errors, 197 warnings |
| E2E / a11y | not present |

## Feature completion
| Module | Status |
|---|---|
| Auth (email, Google, sessions) | 🟡 Works; needs hardening (S4, S5, S10) |
| IPO discovery | 🟡 Works on stale/hardcoded data (I4, I6, I7) |
| IPO detail | 🟡 Modal only |
| DRHP/RHP AI analysis | 🟡 Service exists; unauthenticated, no citations/storage (S1) |
| Subscription tracking | 🟡 Live fetch; no history |
| GMP tracking | 🔴 Partly fabricated (I1, I2) |
| IPO comparison | 🔴 Not built |
| Family PANs | 🟢 Built, encrypted; needs PATCH + constraints |
| Applications | 🟡 Built; no state machine / allotment link |
| Allotment | 🟢 Compliant registrar handoff; write-back missing |
| Portfolio | 🟡 CSV import works; day P&L fake (I3); no CAS/import history |
| Live market | 🟡 SSE works; mock by default (I5) |
| Notifications | 🟡 Inbox only; no preferences/dispatcher |
| Settings / onboarding | 🔴 Not built |
| Figma design system | 🔴 Blocked (View seat) |

## Session log
### 2026-11-26 — Session 1
- **Inspected:** full repo, 53-commit history, schema, all API routes, auth/security libs, services, tests, CI, README/DEPLOYMENT, blueprint docx.
- **Ran:** tsc, vitest, next build, eslint (results above).
- **Changed:** documentation only — `docs/AUDIT.md`, `PROJECT_STATUS.md`, `DEVELOPMENT_ROADMAP.md`, `TECHNICAL_DECISIONS.md`, `KNOWN_ISSUES.md`. No application code changed.
- **Blockers:** Figma edit access; DB/Redis/Gemini/Upstox credentials; pending decisions PD-1..PD-4 (TECHNICAL_DECISIONS.md).

## Exact next task
1. Phase 2: add `src/server/http/withRoute.ts` (auth + Zod + error envelope + requestId) with tests.
2. Apply it to the five unauthenticated AI/compute routes (S1).
3. Remove fabricated GMP sources/history (I1, I2), hardcoded day P&L (I3), JIOPLAT default (I4) — one commit each, tests updated.
