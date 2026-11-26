# IPOLENS baseline security audit

- **Date:** 2026-11-26
- **Scope:** the whole codebase on `main` (`47577c6`): 45 API route files (55 handlers), the proxy, auth, data layer, AI integrations, dependencies and config.
- **Method:** read-only code review, targeted runtime measurements and `npm audit`. Nothing was changed while auditing.

**Not verified:**
- the live production deployment;
- database role permissions;
- reverse-proxy or hosting configuration;
- third-party sites, because this session can't reach them.

**Remediation status:** all 20 findings plus 2 found during the fixes (N1, N2) are fixed on `main` (commits `aec8875`…`39bdde7`), with regression tests. See §7. L5 is partly fixed.

**Earlier fixes this session (already on `main`):**
- the shared `default_user` data bucket;
- forged Google sign-in;
- `PATCH`/`DELETE /api/applications` with no auth;
- the PAN encryption key fallback;
- leaked error details;
- Upstox OAuth XSS and login CSRF;
- the CORS same-origin fix.

## 1. Architecture and trust boundaries
- **Browser → Next.js app.**
  - Pages are React client components.
  - About 50 route handlers sit under `src/app/api`.
  - `src/proxy.ts` handles CORS, rate limiting and the admin-path check.
  - Sessions use an HttpOnly cookie, `ipolens_session`.
- **Server → data.**
  - Postgres via Drizzle when `DATABASE_URL` is set; otherwise in-memory stores. Several in-memory stores are global across users.
  - Redis is optional.
- **Server → outside services.**
  - Upstox and Angel One for market data;
  - NSE and BSE scraping;
  - registrar portals;
  - Google Gemini, called by four AI routes;
  - the Google sign-in key list.
  - A Python scraper runs as a child process.
- **Untrusted inputs:**
  - every request body, query string and upload;
  - DRHP text that gets sent to Gemini;
  - responses from registrars and exchanges.

## 2. Findings summary
| ID | Vulnerability (guide #) | Severity | Status |
|---|---|---|---|
| C1 | Any visitor can read every user's family PAN profiles (#1, #2) | **Critical** | Fixed (`aec8875`) |
| C2 | Next.js 16.3.5: remote code execution advisory and others (#28) | **Critical** (advisory) / High (effective) | Fixed (`aec8875`) |
| H1 | Anyone can overwrite the shared DRHP index; a GET changes state (#1, #19) | **High** | Fixed (`4b02df9`) |
| H2 | PDF "decompression bomb" crashes the server, no login needed (#12, #16) | **High** | Fixed (`4b02df9`) |
| H3 | Slow regular expression in the email check, no login needed (#25, #16) | **High** | Fixed (`01ad1bf`) |
| H4 | Free, unauthenticated access to the paid Gemini API; prompt injection (#10, #16) | **High** | Fixed (`4b02df9`) |
| H5 | Rate limits bypassed by faking the `X-Forwarded-For` header (#16, #9) | **High** | Fixed (`01ad1bf`) |
| H6 | Vulnerable dependencies: zod, axios 0.20, serialize-javascript and more (#28) | **High** | Fixed (`aec8875`) |
| M1 | Allotment lookup for any PAN without login (#2) | Medium (becomes High once live lookups are on) | Fixed (`d52088c`) |
| M2 | Sign-in reveals which emails have accounts; weak password rule (#9) | Medium | Fixed (`01ad1bf`) |
| M3 | Production CSP allows inline scripts (#11, #30) | Medium | Fixed (`761e6d3`) |
| M4 | Live-data stream with no limit on symbols or connections (#16, #26) | Medium | Fixed (`e420d01`) |
| M5 | Missing input validation and protected-field checks on applications; no Zod anywhere (#5, #29) | Medium | Fixed (`01d04e3`) |
| M6 | No request-size limits on JSON routes (#16) | Medium | Fixed (`01ad1bf`) |
| L1 | Anyone can start the server's Upstox login; the status endpoint reveals config (#23, #30) | Low | Fixed (`80abe41`) |
| L2 | CORS trusts every `*.ipolens.in` subdomain with cookies (#20) | Low | Fixed (`80abe41`) |
| L3 | Scraper runs a shell command built from a string (#30) | Low | Fixed (`80abe41`) |
| L4 | Google sign-in has no one-time nonce (#23) | Low | Fixed (`80abe41`) |
| L5 | Sessions last 30 days by default with no idle timeout (#22) | Low | Partly fixed (`80abe41`): no idle timeout yet |
| L6 | Secret-like token in a test file (#13) | Low | Fixed (`80abe41`) |
| N1 | Primary PAN stored in plain text and sent to the browser (found during R8) (#13, #29) | Medium | Fixed (`d52088c`) |
| N2 | `/api/auth/me` returned the password salt (found during R8) (#30) | Low | Fixed (`d52088c`) |

## 3. Findings in detail

### C1: Any visitor can read every user's family PAN profiles
- **Severity:** Critical
- **Affected files:**
  - `src/app/api/pans/optimize-allocation/route.ts:14-62`
  - `src/app/api/allotment/multi-scan/route.ts:9-45`
  - `src/lib/services/allocation-optimizer.service.ts:176-178`
  - `src/lib/services/registrar-scanner.service.ts:332-334`
- **Description:** Neither route checks login. When the request names no PANs, both fall back to `getUserPansStore()`, the in-memory store holding **every user's** PAN profiles. It is mirrored even in database mode, by `DbRepositoryService.savePan`.
- **Evidence:** `profiles = getUserPansStore();` (optimize-allocation `:40`, multi-scan `:26`). The optimizer copies `holderName: p.name, panMasked: p.pan` into the response.
- **Impact:**
  - Any internet user can list every customer's family members' names, relationships and masked PANs.
  - `multi-scan` with `autoSyncDatabase` also changes the status of other users' applications.
  - Both routes accept a `pans` array from the client.
- **Recommended fix:**
  - Require login.
  - Load only the caller's PANs with `DbRepositoryService.getPans(user.id)`.
  - Ignore `pans` sent by the client.
  - Remove `multi-scan`; Part A's gateway replaces it.
- **Test result:** Confirmed by code review. A regression test will reproduce it, then prove the fix.
- **Status:** Fixed; see §7

### C2: Next.js 16.3.5 security advisories
- **Severity:** Critical in the advisory; High in practice.
- **Affected file:** `package.json` (`next: 16.3.5`)
- **Evidence:** `npm audit`:
  - GHSA-vcvr-r3jv-pc5j, critical: remote code execution in `next/og` `ImageResponse`;
  - GHSA-4jqv-mc3x-m676: SSG/ISR cache poisoning on self-hosted apps;
  - GHSA-3w37-wq28-93x7: Draft Mode leak.
- **Impact:** the app doesn't import `next/og`, so the RCE probably can't be triggered today. The cache-poisoning issue does apply to self-hosting.
- **Recommended fix:** upgrade `next` and `eslint-config-next` to **16.4.6** or later.
- **Status:** Fixed; see §7

### H1: Anyone can overwrite the shared DRHP index
- **Severity:** High
- **Affected files:**
  - `src/app/api/market/drhp-rag/route.ts:50-62`
  - `src/app/api/analysis/route.ts:74-94` (GET) and `:105-187` (POST)
  - `src/lib/services/drhp-rag.service.ts:189-191, 423-479`
- **Description:** Text supplied without login (`customText`, the `drhpText` query parameter, or an uploaded file) is indexed under a ticker symbol in the **single store every user shares**.
- **Evidence:** `this.indexDocument(sym, customText, …)`. The GET handler also indexes `drhpText`, so even an `<img src>` link pointing at it changes state.
- **Impact:** an attacker can replace JIOPLAT's DRHP that every user sees with invented "facts", which then feed verdicts and answers. That's misinformation in a financial product.
- **Recommended fix:**
  - Require login.
  - Keep user-supplied text in that user's own index only.
  - Let only server-side official sources write the shared index (Part B M1/M2).
  - Remove `drhpText` from GET.
- **Status:** Fixed; see §7

### H2: PDF decompression bomb, no login needed
- **Severity:** High
- **Affected file:** `src/app/api/analysis/route.ts:8-40, 132-137`
- **Evidence:** `zlib.inflateSync(streamBuffer)` with no `maxOutputLength`, on up to 200 streams per file, for files up to 25 MB, with no login. A regex also scans the whole file as one binary string.
- **Impact:** one crafted PDF a few MB in size can expand to gigabytes and take the server down.
- **Recommended fix:**
  - Require login.
  - Set `maxOutputLength` and a total decompressed-size cap.
  - Then replace this reader with `unpdf` running in a worker thread with time and memory limits (Part B M1).
- **Status:** Fixed; see §7

### H3: Slow regular expression in the email check
- **Severity:** High
- **Affected files:** `src/lib/services/authStore.ts` (email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, used by sign-up and Google sign-in) and `src/lib/security/sanitize.ts:89`
- **Evidence (measured):** the input `a@` followed by N dots takes 16 ms at 5,000 characters, 216 ms at 20,000 and 867 ms at 40,000. That's quadratic growth. With no body limit (M6), a 1 MB email field blocks Node's single event loop for minutes.
- **Impact:** one unauthenticated request stalls the whole server.
- **Recommended fix:** cap lengths first (email ≤ 254), then use a simple linear-time check: split on `@` and validate the parts.
- **Status:** Fixed; see §7

### H4: Free unauthenticated access to paid Gemini, and prompt injection
- **Severity:** High
- **Affected files:**
  - `src/app/api/market/analyze-drhp/route.ts`
  - `src/app/api/market/drhp-rag/route.ts`
  - `src/app/api/analysis/route.ts`
  - `src/app/api/market/ai-prediction/route.ts`
  - `src/lib/services/prospectus-analyzer.service.ts`
  - `src/lib/services/ai-trading-prediction.service.ts:428-477`
  - `src/lib/services/geminiAnalyst.ts:159-210`
- **Description:** text an attacker controls (`drhpSummary`, `customText`, uploads) is placed straight into Gemini prompts, with no login and only a per-IP limit that H5 bypasses.
- **Impact:**
  - People can run Gemini on your API key and your bill.
  - Injected instructions can steer the "verdict" output shown to users.
  - No model tools are exposed, so it can't trigger actions.
- **Recommended fix:**
  - Require login and set a per-user AI quota.
  - Cap input length.
  - Wrap untrusted text in delimiters and tell the model to treat it as data.
  - Validate model output against a strict schema.
  - Part B removes Gemini from the analyst entirely.
- **Status:** Fixed; see §7

### H5: Rate limits bypassed by faking `X-Forwarded-For`
- **Severity:** High
- **Affected file:** `src/lib/security/rateLimiter.ts:52-57`
- **Evidence:** `getClientIp` trusts the **first** `X-Forwarded-For` value, which the client controls.
- **Impact:** every limit can be dodged by sending a random header per request, including the 10/min sign-in limit, which opens the door to password guessing and to H3 and H4.
- **Recommended fix:**
  - Read the client IP from a trusted source: a `TRUSTED_PROXY_HOPS` setting, using the right-most untrusted hop or the platform's own header.
  - Add login throttling **per account (email)** that doesn't depend on IP.
- **Status:** Fixed; see §7

### H6: Vulnerable dependencies
- **Severity:** High
- **Affected file:** `package.json`
- **Evidence:** `npm audit --omit=dev` reports 1 critical, 7 high and 6 moderate.
  - `zod` < 4.6.6: memory exhaustion (GHSA-mrhx-c7xc-m3w5).
  - `smartapi-javascript` brings in `axios@0.20` (server-side request forgery and credential leakage, GHSA-jr5f-v2jv-69x6) and, as **runtime** dependencies, `mocha` and `serialize-javascript` (remote code execution, GHSA-5c6j-r48x-rmvq).
  - `follow-redirects`, `sharp` and `source-map-js` also have high advisories, all fixable.
- **Impact:** known exploitable code ships in production. `smartapi-javascript` is only used by `workers/market-feed-worker.ts`.
- **Recommended fix:**
  - Upgrade `zod` and run `npm audit fix` for the transitive packages.
  - Move the Angel One worker into its own package, or replace `smartapi-javascript` with a small `ws` client, so the web app doesn't ship axios 0.20 or mocha.
  - Make high and critical advisories fail CI.
- **Status:** Fixed; see §7

### M1: Allotment lookup for any PAN without login
- **Severity:** Medium
- **Affected files:** `src/app/api/allotment/check/route.ts` (POST) and `src/lib/services/allotment/allotment.service.ts:96-101`
- **Description:** no login is required and any PAN is accepted. The service also searches **all** users' applications by PAN. That match currently never succeeds, because it compares a masked PAN with a full one.
- **Impact:** a privacy risk today. Once live registrar lookups exist, it becomes a way to look up anyone's allotment by PAN, and the cross-user match is waiting to start leaking data.
- **Recommended fix:** login required, and only PANs that belong to the user (Part A).
- **Status:** Fixed; see §7

### M2: Sign-in reveals accounts; weak password rule
- **Severity:** Medium
- **Affected file:** `src/lib/services/authStore.ts`: `'No account found…'` (l.153) vs `'Incorrect password…'` (l.164); minimum length 6 (l.183).
- **Impact:** attackers can confirm which emails have accounts, and with H5, guess weak passwords.
- **Recommended fix:**
  - One generic "Invalid email or password" message.
  - Minimum 10 characters, a maximum of 128, and a common-password block list.
- **Status:** Fixed; see §7

### M3: Production CSP allows inline scripts
- **Severity:** Medium
- **Affected file:** `next.config.ts:39-41` (`script-src 'self' 'unsafe-inline' …`)
- **Impact:** if any XSS bug appears later, the CSP won't stop it.
- **Recommended fix:** a nonce-based CSP set in `src/proxy.ts`, which Next 16 supports, then drop `'unsafe-inline'` for scripts.
- **Status:** Fixed; see §7

### M4: Live-data stream with no symbol or connection limit
- **Severity:** Medium
- **Affected file:** `src/app/api/market/stream/route.ts:10, 49-106`
- **Description:** the `symbols` parameter has no limit, and there's no cap on connections per IP or on how long a connection stays open. Every tick fetches quotes for every symbol requested.
- **Impact:** a few clients can exhaust server resources and upstream API quotas.
- **Recommended fix:** at most 20 symbols, matching a symbol pattern; at most 3 connections per IP; a 30-minute maximum lifetime.
- **Status:** Fixed; see §7

### M5: Missing input validation and protected-field checks
- **Severity:** Medium
- **Affected files:**
  - `src/app/api/applications/route.ts`:
    - PATCH accepts any `status` string and any `allottedShares`;
    - POST lets `shares` and `blockedAmount` be negative (`Number(shares) || …`).
  - No route uses Zod.
- **Impact:** users can corrupt their own records. Once Part A's P&L sync lands, that becomes fake portfolio holdings.
- **Recommended fix:** Zod schemas on every route that changes data: enum statuses, positive integers with upper bounds, and explicit allowed fields.
- **Status:** Fixed; see §7

### M6: No request-size limits on JSON routes
- **Severity:** Medium
- **Affected file:** all routes except `analysis` and `allotment/check`.
- **Impact:** large bodies use up memory, and they make H3 worse.
- **Recommended fix:** a `Content-Length` limit in `src/proxy.ts`: 64 KB for JSON routes, with explicit exceptions for upload routes.
- **Status:** Fixed; see §7

### L1–L6: lower-severity findings
- **L1 (Upstox OAuth).** Anyone can start `/api/auth/upstox`; the callback writes the token into the server's `.env.local`, though only when that file exists, i.e. in development. `/api/auth/upstox/status` shows config state publicly.
  - **Fix:** admin only.
- **L2 (CORS).** `src/lib/security/cors.ts` trusts every `origin.endsWith('.ipolens.in')` with credentials.
  - **Fix:** an explicit list of origins.
- **L3 (scraper command).** `src/app/api/scraper/sync/route.ts:107` runs `exec` on an interpolated string. It's safe today because `monthsBack` is clamped to an integer.
  - **Fix:** use `execFile` with an argument array.
- **L4 (Google nonce).** Google sign-in sends no `nonce`, so a captured ID token could be replayed within its validity window.
  - **Fix:** a one-time nonce stored in a cookie and checked on the server.
- **L5 (sessions).** Sign-up and Google sign-in default to "remember me" (30 days); there's no idle timeout; sessions are in memory when there's no database.
  - **Fix:** 7 days by default, a 30-day opt-in, and a 24-hour idle timeout.
- **L6 (token in a test).** `tests/upstoxLiveIntegration.test.ts:187` contains a JWT-shaped string. It decodes to HS256 with only a `userId` claim and no expiry, so it's probably a mock.
  - **Fix:** confirm it's synthetic. If it was ever real, revoke it. Replace it with an obviously fake value.

## 4. All 30 categories
| # | Category | Result |
|---|---|---|
| 1 | Broken access control | **Findings:** C1, H1, M1, L1 |
| 2 | IDOR / BOLA | **Findings:** C1, M1 (earlier `default_user` and application IDOR already fixed) |
| 3 | Exposed API keys | Pass: only `NEXT_PUBLIC_GOOGLE_CLIENT_ID` reaches the browser, and it's public by design |
| 4 | Price manipulation | Not applicable: no payments or checkout |
| 5 | Negative quantity | **Finding:** M5 (application shares and amounts) |
| 6 | Fake payment | Not applicable: no payment integration |
| 7 | Coupon and reward abuse | Not applicable |
| 8 | Privilege escalation | Pass: roles are set on the server; the only `admin` is a demo seed, off in production; the self-chosen "Institutional" category grants nothing extra |
| 9 | Auth and OTP bypass | **Findings:** M2, H5. There is no OTP flow and no password-reset backend; the sign-in page's "forgot password" box has no backend |
| 10 | Prompt injection | **Finding:** H4 |
| 11 | XSS | Pass on code: no `dangerouslySetInnerHTML`, and server HTML is escaped. **Finding:** M3 (CSP) |
| 12 | Malicious file upload | **Finding:** H2. Uploads aren't stored, only parsed in memory |
| 13 | Environment variable exposure | Pass: `.env*` never committed (only `.env.example`). **Unverified:** L6. The other secret-like strings are a localhost placeholder (`drizzle.config.ts:35`) and `${…}` references (`DEPLOYMENT.md:186-187`) |
| 14 | SQL / NoSQL injection | Pass: Drizzle uses parameterised queries everywhere, with no raw SQL |
| 15 | JWT | Pass: the app issues no JWTs; Google ID tokens are fully verified (signature, aud, iss, exp, email_verified) |
| 16 | Rate-limit bypass and DoS | **Findings:** H2, H3, H5, M4, M6 |
| 17 | Row-level security | Not applicable / unverified: the browser never talks to the database directly; the database role's permissions couldn't be checked |
| 18 | Predictable tokens | Pass: sessions use `crypto.randomBytes(32)`; IDs use `crypto.randomUUID()` |
| 19 | CSRF | Pass: SameSite=Lax cookie plus an Origin check. **Finding:** H1 (a GET that changes state) |
| 20 | CORS | Pass: allowlist plus same-origin. **Finding:** L2 |
| 21 | SSRF | Pass: every outbound URL is fixed in code, with only encoded parameters from users. Part A and Part B add allowlists for new fetchers and Web Push |
| 22 | Session management | Pass: HttpOnly, Secure in production, Lax, sign-out destroys the session. **Finding:** L5 |
| 23 | OAuth / SSO | Pass: Google tokens verified; Upstox `state` checked. **Findings:** L1, L4 |
| 24 | Prototype pollution | Pass: `sanitizeObject` skips `__proto__`, `constructor` and `prototype`; JSON object spreads are safe |
| 25 | ReDoS | **Finding:** H3; the PDF-stream regex is covered by H2 |
| 26 | WebSocket hijacking | No WebSocket server (SSE only). **Finding:** M4 |
| 27 | Server-side template injection | Not applicable: no template engine; inline HTML pages are escaped |
| 28 | Dependency vulnerabilities | **Findings:** C2, H6 |
| 29 | Mass assignment | **Finding:** M5. Other routes destructure explicit fields |
| 30 | Security misconfiguration | **Findings:** M3, L1, L3. Good already: HSTS, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy are set, `poweredByHeader` is off, and errors are generic in production |

## 5. Remediation plan (needs your approval before any code changes)
Ordered by risk. Each step ships with regression tests that fail before the fix and pass after.

| Step | Fixes | Change |
|---|---|---|
| R1 | C1 | Login plus "only your own PANs" on `optimize-allocation`; client-sent `pans` ignored; `multi-scan` removed (Part A's gateway replaces it). |
| R2 | C2, H6 | Upgrade `next` and `eslint-config-next` to 16.4.6 or later and `zod` to 4.6.6 or later; `npm audit fix`; move the Angel One worker into `workers/package.json` (or a small `ws` client) so axios 0.20, mocha and serialize-javascript leave the app's runtime. |
| R3 | H1 | Login on `drhp-rag` and `analysis`; user-supplied text kept in that user's own index; `drhpText` removed from GET; the shared index writable only from server-side official sources. |
| R4 | H2 | Login on uploads; `maxOutputLength` and a total decompressed cap now. Replaced by the worker-thread `unpdf` in Part B M1. |
| R5 | H3, M6 | Length caps and a linear-time email check; request-size limit in `src/proxy.ts`. |
| R6 | H4 | Login and a per-user daily AI quota on the 4 AI routes; input caps; untrusted text delimited; model output schema-validated. |
| R7 | H5, M2 | Trusted-proxy IP detection (`TRUSTED_PROXY_HOPS`); per-account login throttling; a generic sign-in error; the stronger password rule. |
| R8 | M1 | Login and own-PAN-only on the allotment check. Done as part of Part A. |
| R9 | M3 | Nonce-based CSP via `src/proxy.ts`; no `'unsafe-inline'` for scripts in production. |
| R10 | M4 | Stream limits: symbols, connections per IP, lifetime. |
| R11 | M5 | Zod schemas on all routes that change data, starting with applications, PANs, notifications, watchlist and portfolio. |
| R12 | L1–L6 | Upstox OAuth and status admin-only; explicit CORS list; `execFile`; Google nonce; session defaults; replace the test token. |
| R13 | All | CI fails on high or critical `npm audit` findings and runs the security test files; a route auth-matrix test covering every route. |

**Then** Part A (allotment checker) and Part B (DRHP model) proceed under the per-phase security checks in the plan.

All steps R1–R13 are done; see §7.

## 6. Pre-deployment checklist (current state)
- [x] All API endpoints have appropriate authorization: every handler is classified and tested (`tests/routeAccessMatrix.test.ts`).
- [x] Resource ownership is validated (C1, M1, M5 fixed; cross-user tests).
- [x] No confidential API keys are exposed.
- [x] Prices and payments are verified server-side: not applicable.
- [x] Authentication is secured: per-account throttling, generic errors, password policy, Google nonce.
- [x] User inputs are validated on the backend: Zod schemas, body limits, no ReDoS.
- [x] Database queries are protected against injection.
- [x] File uploads are handled securely: login required, magic-byte check, decompression caps. Worker-thread isolation comes with Part B M1.
- [x] Session security (no app JWTs): yes, with L5 improvements to come.
- [x] Rate limiting and resource protection are enabled: trusted-proxy IPs, per-account and per-user AI limits, stream caps. **Requires** a reverse proxy and a correct `TRUSTED_PROXY_HOPS` in production.
- [ ] Database access policies are verified: **unverified**.
- [x] AI tools have restricted permissions: no tools; routes need login and a quota; untrusted text is delimited; output is schema-checked.
- [x] Dependencies are scanned: 0 production advisories, and CI fails on high or critical.
- [x] Production configuration is hardened: nonce CSP, API deny-all CSP, admin-only Upstox routes.
- [x] Security regression tests pass: 244 tests in total, including `tests/securityRemediation.test.ts` and `tests/routeAccessMatrix.test.ts`.

Completing this checklist doesn't guarantee the app is secure. The live deployment, hosting and database permissions still need checking on your side.

## 7. Remediation results
| Step | Commit | What changed | Regression tests (`tests/securityRemediation.test.ts` unless noted) |
|---|---|---|---|
| R1 | `aec8875` | Login and own-PANs-only on `optimize-allocation`; `multi-scan` removed | R1 suite: 401 when not signed in; no cross-user names; client PAN list ignored. Confirmed failing on the old code. |
| R2 | `aec8875` | Next.js 16.4.6, zod 4.6.7, `npm audit fix`; `smartapi-javascript` moved to `workers/package.json` | `npm audit --omit=dev` shows 0 vulnerabilities; CI blocks high and critical |
| R3 | `4b02df9` | User DRHP text kept in a private per-user slot; no GET writes | private-to-user test; GET-ignored test; login required |
| R4 | `4b02df9` | `pdfText.ts`: per-stream and total inflate caps, linear scan, `%PDF-` check | real 200 MB deflate bomb; 300k stream markers in under 2 s |
| R5 | `01ad1bf` | Capped `isValidEmail`; per-route body limits in the proxy; 28 MB proxy buffer | 200k-char email under 100 ms; 413 and 411 through the real proxy |
| R6 | `4b02df9` | `requireAiAccess` (login and 30/hour per user); Zod inputs; `promptSafety.ts`; schema-checked Gemini output; no "SEBI-registered" claim | 401s; 400 on malformed input; 31st call gets 429; delimiter test |
| R7 | `01ad1bf` | `TRUSTED_PROXY_HOPS` IP selection; per-account sign-in throttle; generic error with equal timing; password policy | spoofed XFF ignored; 11th guess with rotating IPs gets 429; timing and message tests; policy tests |
| R8 | `d52088c` | Allotment check needs login and an own PAN; service scoped to the caller | 401, 403 for a stranger's PAN, owner allowed |
| N1 | `d52088c` | Primary PAN masked, HMAC `primary_pan_hash`, lazy migration; `family_pans.pan_hash`; `drizzle/0001_pan_hashes.sql` | stored-masked test; no raw PAN in `/api/auth/me` |
| N2 | `d52088c` | `toPublicUser()` allowlist for every user object | `/api/auth/me` has no salt, hash or PAN hash |
| R9 | `761e6d3` | Per-request nonce CSP with `'strict-dynamic'`; API deny-all CSP; tighter `connect-src`; TradingView frames allowed | nonce test; Chromium check of 6 pages: they render, 0 CSP violations |
| R10 | `e420d01` | Stream: up to 20 symbols, 3 per IP, 500 total, 30-minute lifetime; dedicated Redis subscriber | 400s; 4th stream gets 429; slot freed on disconnect |
| R11 | `01d04e3` | Zod schemas; applications take holder, PAN and relationship from the caller's own profile; exact-hash duplicate check | negative values, bad status and bad UPI give 400; another user's `panId` gives 404; spoofed holder ignored |
| R12 | `80abe41` | Admin-only Upstox routes in production; `CORS_ALLOWED_ORIGINS`; `execFile`; Google nonce; 1-day default sessions; fake test token | L1–L6 tests |
| R13 | `8cccbb7` | `tests/routeAccessMatrix.test.ts`; CI audit gate and security-test step | the route matrix (every handler classified; 27 protected handlers refuse requests without a session) |

**Other bugs fixed along the way:**
- **25 MB DRHP uploads were being silently cut off** at the proxy's default 10 MB buffer.
- **The live stream broke Redis.** It put the shared Redis client into subscriber mode, which breaks caching and rate limiting, and unsubscribed every stream whenever one client left.
- **The PAN duplicate check compared masked prefixes,** so it missed real duplicates and flagged different PANs as duplicates.

**Accepted or remaining risks, and what still needs checking on your side:**
- **L5 (partly fixed):** there's no idle-session timeout yet.
- **Database migration not applied:** `drizzle/0001_pan_hashes.sql` hasn't been run against a real Postgres. Run `npm run db:push` or apply the SQL, then confirm plain-text `primary_pan` rows are masked after each user's next sign-in.
- **Proxy configuration:** rate limiting depends on a reverse proxy that appends the client IP to `X-Forwarded-For`, plus the right `TRUSTED_PROXY_HOPS` value.
- **Not tested live:** real Google sign-in with the nonce, a real Redis, a real registrar, and Gemini with a real key.
- **Family Radar:** the allotment checker's Family Radar sends masked PANs and has never worked. It gets rebuilt in Part A with server-side PAN decryption.
- **GMP display:** kept, as you decided. SEBI's restriction on publishing GMP is an accepted business risk.
- **Research-analyst rules:** Subscribe/Avoid verdicts and ratings may need SEBI RA registration. This is your decision, and it comes up again at Part B M4.
- **Lint:** 254 older lint errors remain (mostly `any`). They're unrelated to security and lint stays non-blocking in CI.
- **Review process:** the plan's per-phase `/security-review` skill wasn't run. Every fix was reviewed by hand and covered by the regression tests listed above, each written to fail on the vulnerable behaviour.

