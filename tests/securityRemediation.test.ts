import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createSession } from '@/lib/security/session';
import { registeredUsersStore, registerOrLoginWithGoogle } from '@/services/authStore';
import { POST as optimizePost } from '@/app/api/pans/optimize-allocation/route';
import { GET as pansGet, POST as pansPost } from '@/app/api/pans/route';
import {
  GET as applicationsGet,
  POST as applicationsPost,
  PATCH as applicationsPatch,
  DELETE as applicationsDelete,
} from '@/app/api/applications/route';
import { DELETE as userDataDelete } from '@/app/api/user/data/route';
import { GET as holdingsGet } from '@/app/api/portfolio/holdings/route';
import { GET as watchlistGet } from '@/app/api/market/watchlist/route';
import { GET as notificationsGet } from '@/app/api/notifications/route';

/**
 * Regression tests for audit findings C2 and C3/H2 (docs/security/AUDIT_2026-11-27.md).
 * Each test fails on main@ebd30a0 and passes after remediation steps R2/R3.
 */

const TEST_EMAILS = /(r2\.alice|r2\.bob|r3\.carol|r3\.dave)@gmail\.com/;

function jsonRequest(url: string, method: string, body?: unknown, sessionToken?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers.cookie = `ipolens_session=${sessionToken}`;
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function sessionFor(email: string): Promise<string> {
  const result = registerOrLoginWithGoogle({ email, name: email.split('@')[0] });
  const { token } = await createSession(result.user!.id, false);
  return token;
}

async function addPan(token: string, name: string, pan: string): Promise<string> {
  const res = await pansPost(jsonRequest('http://localhost/api/pans', 'POST', { name, pan, relationship: 'Self' }, token));
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data.id as string;
}

afterEach(() => {
  for (let i = registeredUsersStore.length - 1; i >= 0; i--) {
    if (TEST_EMAILS.test(registeredUsersStore[i].email)) registeredUsersStore.splice(i, 1);
  }
});

describe('R2 / C2: optimize-allocation is login-only and uses the caller\'s own PANs', () => {
  const optimizeBody = { symbol: 'TESTIPO', price: 100, lotSize: 150, totalBudget: 100000 };

  it('returns 401 without a session', async () => {
    const res = await optimizePost(jsonRequest('http://localhost/api/pans/optimize-allocation', 'POST', optimizeBody));
    expect(res.status).toBe(401);
  });

  it('never returns another user\'s family members', async () => {
    const alice = await sessionFor('r2.alice@gmail.com');
    const bob = await sessionFor('r2.bob@gmail.com');
    await addPan(alice, 'Alice Secret Relative', 'ALIZE1234F');

    const res = await optimizePost(jsonRequest('http://localhost/api/pans/optimize-allocation', 'POST', optimizeBody, bob));
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('Alice Secret Relative');
  });

  it('ignores PAN profiles sent by the client', async () => {
    const bob = await sessionFor('r2.bob@gmail.com');
    const forged = [{ id: 'pan_forged', name: 'Forged Holder', relationship: 'Self', pan: 'FORGE****F', broker: 'X', createdAt: new Date().toISOString() }];

    const res = await optimizePost(
      jsonRequest('http://localhost/api/pans/optimize-allocation', 'POST', { ...optimizeBody, pans: forged }, bob)
    );
    expect(JSON.stringify(await res.json())).not.toContain('Forged Holder');
  });

  it('removes the unauthenticated multi-scan route', () => {
    const routeFile = path.resolve(__dirname, '../src/app/api/allotment/multi-scan/route.ts');
    expect(fs.existsSync(routeFile)).toBe(false);
  });
});

describe('R3 / C3: personal-data routes have no anonymous fallback', () => {
  it('returns 401 for anonymous requests on every per-user route', async () => {
    const anon = (url: string, method = 'GET') => jsonRequest(url, method);
    expect((await pansGet(anon('http://localhost/api/pans'))).status).toBe(401);
    expect((await applicationsGet(anon('http://localhost/api/applications'))).status).toBe(401);
    expect((await holdingsGet(anon('http://localhost/api/portfolio/holdings'))).status).toBe(401);
    expect((await watchlistGet(anon('http://localhost/api/market/watchlist'))).status).toBe(401);
    expect((await notificationsGet(anon('http://localhost/api/notifications'))).status).toBe(401);
    expect((await userDataDelete(anon('http://localhost/api/user/data', 'DELETE'))).status).toBe(401);
  });
});

describe('R3 / H2: application PATCH and DELETE require the owner', () => {
  it('rejects anonymous PATCH and DELETE', async () => {
    const patch = await applicationsPatch(jsonRequest('http://localhost/api/applications', 'PATCH', { id: 'app_x', status: 'Allotted' }));
    expect(patch.status).toBe(401);
    const del = await applicationsDelete(jsonRequest('http://localhost/api/applications?id=app_x', 'DELETE'));
    expect(del.status).toBe(401);
  });

  it('lets the owner update their own application but not another user\'s', async () => {
    const carol = await sessionFor('r3.carol@gmail.com');
    const dave = await sessionFor('r3.dave@gmail.com');
    const panId = await addPan(carol, 'Carol', 'CAROL1234F');

    const created = await (
      await applicationsPost(jsonRequest('http://localhost/api/applications', 'POST', { ipoSymbol: 'R3IPO', panId, panNumber: 'CAROL1234F', bidPrice: 100, lots: 1 }, carol))
    ).json();
    const appId = created.data.id as string;

    const byDave = await applicationsPatch(jsonRequest('http://localhost/api/applications', 'PATCH', { id: appId, status: 'Allotted', allottedShares: 999 }, dave));
    expect(byDave.status).toBe(404);

    const byCarol = await applicationsPatch(jsonRequest('http://localhost/api/applications', 'PATCH', { id: appId, status: 'Allotted', allottedShares: 150 }, carol));
    expect(byCarol.status).toBe(200);
    const carolApps = await (await applicationsGet(jsonRequest('http://localhost/api/applications', 'GET', undefined, carol))).json();
    expect(carolApps.data.find((a: { id: string }) => a.id === appId)?.allottedShares).toBe(150);
  });

  it('erasure removes only the caller\'s own in-memory PANs and applications', async () => {
    const carol = await sessionFor('r3.carol@gmail.com');
    const dave = await sessionFor('r3.dave@gmail.com');
    await addPan(carol, 'Carol Erase', 'CARLE1234F');
    await addPan(dave, 'Dave Keep', 'DAVEK1234F');

    expect((await userDataDelete(jsonRequest('http://localhost/api/user/data', 'DELETE', undefined, carol))).status).toBe(200);

    const carolPans = await (await pansGet(jsonRequest('http://localhost/api/pans', 'GET', undefined, carol))).json();
    expect(carolPans.data).toHaveLength(0);
    const davePans = await (await pansGet(jsonRequest('http://localhost/api/pans', 'GET', undefined, dave))).json();
    expect(davePans.data.map((p: { name: string }) => p.name)).toContain('Dave Keep');
  });
});
