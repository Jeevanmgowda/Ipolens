import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

/**
 * Deny-by-default regression for every API handler (docs/security/AUDIT_2026-11-27.md, R18).
 *
 * Every exported handler under src/app/api must be classified here. A new route that
 * is not listed fails this test, so nothing ships without a deliberate access decision.
 * Protected handlers are called without a session and must refuse (401/403).
 */

type Access = 'public' | 'user' | 'admin-or-cron' | 'admin-in-production';

const MATRIX: Record<string, Access> = {
  // Public market data and reference information (read-only, no user data, no paid APIs)
  'GET /api/ipos': 'public',
  'GET /api/ipos/[symbol]': 'public',
  'GET /api/ipos/[symbol]/gmp': 'public',
  'GET /api/ipos/[symbol]/gmp/history': 'public',
  'GET /api/ipos/[symbol]/subscription': 'public',
  'GET /api/ipos/anchor-lockin': 'public',
  'GET /api/ipos/chart': 'public',
  'GET /api/ipos/charts': 'public',
  'GET /api/ipos/closed': 'public',
  'GET /api/ipos/listed': 'public',
  'GET /api/ipos/live': 'public',
  'GET /api/ipos/open': 'public',
  'GET /api/ipos/upcoming': 'public',
  'GET /api/ipo-logo': 'public',
  'GET /api/live-market': 'public',
  'GET /api/market/[symbol]/ohlc': 'public',
  'GET /api/market/[symbol]/quote': 'public',
  'GET /api/market/charts/[symbol]': 'public',
  'GET /api/market/stream': 'public', // capped per IP and in total (R14)
  'GET /api/health': 'public', // booleans only, no configuration values
  'GET /api/ipo-logo': 'public', // company logo images (proxied third-party fetch; see audit follow-up)
  'GET /api/market/drhp-rag': 'public', // read-only shared index sections
  'GET /api/analysis/ml-prediction': 'public', // local model maths, no paid API
  'POST /api/analysis/ml-prediction': 'public',
  'GET /api/allotment/check': 'public', // list of supported IPOs
  'GET /api/allotment/scan': 'public', // registrar directory
  'POST /api/allotment/scan': 'public', // pure text classifier over pasted text, nothing stored
  'GET /api/scraper/sync': 'public', // feed freshness status only

  // Authentication endpoints (must be reachable before sign-in)
  'POST /api/auth/signin': 'public',
  'POST /api/auth/signup': 'public',
  'POST /api/auth/google': 'public',
  'GET /api/auth/google/nonce': 'public',
  'POST /api/auth/signout': 'public',
  'GET /api/auth/upstox/callback': 'public', // redirect alias to the guarded callback

  // Signed-in user only
  'GET /api/auth/me': 'user',
  'GET /api/analysis': 'user',
  'POST /api/analysis': 'user',
  'GET /api/applications': 'user',
  'POST /api/applications': 'user',
  'PATCH /api/applications': 'user',
  'DELETE /api/applications': 'user',
  'POST /api/allotment/check': 'user',
  'POST /api/market/ai-prediction': 'user',
  'POST /api/market/analyze-drhp': 'user',
  'POST /api/market/drhp-rag': 'user',
  'GET /api/market/watchlist': 'user',
  'POST /api/market/watchlist': 'user',
  'GET /api/notifications': 'user',
  'POST /api/notifications': 'user',
  'GET /api/pans': 'user',
  'POST /api/pans': 'user',
  'DELETE /api/pans': 'user',
  'POST /api/pans/optimize-allocation': 'user',
  'GET /api/portfolio/holdings': 'user',
  'DELETE /api/portfolio/holdings': 'user',
  'POST /api/portfolio/upload': 'user',
  'DELETE /api/user/data': 'user',

  // Administrative
  'POST /api/scraper/sync': 'admin-or-cron',
  'GET /api/auth/upstox': 'admin-in-production',
  'GET /api/auth/upstox/status': 'admin-in-production',
  'GET /api/auth/callback/upstox': 'admin-in-production',
};

const API_DIR = path.resolve(__dirname, '../src/app/api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function discoverHandlers(): Array<{ key: string; file: string; method: string; route: string }> {
  const out: Array<{ key: string; file: string; method: string; route: string }> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') {
        const route = '/api' + path.relative(API_DIR, dir).split(path.sep).map((s) => (s ? `/${s}` : '')).join('');
        const src = fs.readFileSync(full, 'utf8');
        for (const m of METHODS) {
          if (new RegExp(`export (async )?function ${m}\\b`).test(src)) {
            out.push({ key: `${m} ${route}`, file: full, method: m, route });
          }
        }
      }
    }
  };
  walk(API_DIR);
  return out;
}

function unauthenticatedRequest(method: string, route: string): NextRequest {
  const url = `http://localhost${route.replace(/\[(\w+)\]/g, 'TEST')}?symbol=SWIGGY&id=app_x`;
  const hasBody = method !== 'GET' && method !== 'DELETE';
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.10' },
    body: hasBody ? JSON.stringify({ symbol: 'SWIGGY', question: 'debt', pan: 'ABCDE1234F' }) : undefined,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('API route access matrix', () => {
  const handlers = discoverHandlers();

  it('classifies every API handler (deny by default for new routes)', () => {
    const unclassified = handlers.map((h) => h.key).filter((k) => !(k in MATRIX));
    expect(unclassified).toEqual([]);
    const stale = Object.keys(MATRIX).filter((k) => !handlers.some((h) => h.key === k));
    expect(stale).toEqual([]);
  });

  it.each(handlers.filter((h) => MATRIX[h.key] === 'user' || MATRIX[h.key] === 'admin-or-cron').map((h) => [h.key, h]))(
    '%s refuses unauthenticated requests',
    async (_key, h) => {
      const mod = await import(/* @vite-ignore */ h.file);
      const res: Response = await mod[h.method](unauthenticatedRequest(h.method, h.route), { params: Promise.resolve({}) });
      expect([401, 403]).toContain(res.status);
    }
  );

  it.each(handlers.filter((h) => MATRIX[h.key] === 'admin-in-production').map((h) => [h.key, h]))(
    '%s refuses unauthenticated requests in production',
    async (_key, h) => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('PAN_ENCRYPTION_KEY', 'test-production-pan-key');
      const mod = await import(/* @vite-ignore */ h.file);
      const res: Response = await mod[h.method](unauthenticatedRequest(h.method, h.route));
      expect([401, 403]).toContain(res.status);
    }
  );
});
