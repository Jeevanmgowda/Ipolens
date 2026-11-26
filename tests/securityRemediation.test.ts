import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createSession } from '@/lib/security/session';
import { registeredUsersStore, registerOrLoginWithGoogle } from '@/lib/services/authStore';
import { POST as pansPost } from '@/app/api/pans/route';
import { POST as optimizePost } from '@/app/api/pans/optimize-allocation/route';

/**
 * Regression tests for docs/security/BASELINE_AUDIT.md findings (R1–R13).
 * Each test fails on the pre-fix code and passes after the fix.
 */

const TEST_EMAIL = /@remediation\.test$/;

function jsonRequest(url: string, method: string, body?: unknown, sessionToken?: string, extraHeaders: Record<string, string> = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (sessionToken) headers.cookie = `ipolens_session=${sessionToken}`;
  return new Request(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

async function sessionFor(local: string): Promise<string> {
  const result = registerOrLoginWithGoogle({ email: `${local}@remediation.test`, name: local });
  const { token } = await createSession(result.user!.id, false);
  return token;
}

afterAll(() => {
  for (let i = registeredUsersStore.length - 1; i >= 0; i--) {
    if (TEST_EMAIL.test(registeredUsersStore[i].email)) registeredUsersStore.splice(i, 1);
  }
});

describe('R1 / C1: family PAN profiles are never exposed across users', () => {
  it('rejects unauthenticated allocation optimisation', async () => {
    const res = await optimizePost(jsonRequest('http://localhost/api/pans/optimize-allocation', 'POST', { symbol: 'SWIGGY', price: 390 }));
    expect(res.status).toBe(401);
  });

  it("only optimises over the caller's own PANs and ignores client-supplied PAN lists", async () => {
    const alice = await sessionFor('alice.r1');
    const bob = await sessionFor('bob.r1');
    await pansPost(jsonRequest('http://localhost/api/pans', 'POST', { name: 'Alice Secret Mother', pan: 'AAAPA1111A', relationship: 'Parent', broker: 'Zerodha' }, alice));
    await pansPost(jsonRequest('http://localhost/api/pans', 'POST', { name: 'Bob Self', pan: 'BBBPB2222B', relationship: 'Self', broker: 'Groww' }, bob));

    const forgedPans = [{ id: 'x', name: 'Injected Victim', pan: 'ZZZPZ9999Z', relationship: 'Self', broker: 'Zerodha', createdAt: '' }];
    const res = await optimizePost(
      jsonRequest('http://localhost/api/pans/optimize-allocation', 'POST', { symbol: 'SWIGGY', price: 390, lotSize: 38, pans: forgedPans }, bob)
    );
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('Bob Self');
    expect(text).not.toContain('Alice Secret Mother');
    expect(text).not.toContain('Injected Victim');
  });

  it('the cross-user multi-scan route no longer exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../src/app/api/allotment/multi-scan/route.ts'))).toBe(false);
  });
});
