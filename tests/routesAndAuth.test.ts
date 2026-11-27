import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { globalMemoryFallback } from '@/lib/redis';
import { POST as checkRoute } from '@/app/api/allotment/check/route';
import { POST as familyRoute } from '@/app/api/allotment/check-family/route';
import { GET as getPans, POST as postPan } from '@/app/api/pans/route';
import { POST as postApp, PATCH as patchApp } from '@/app/api/applications/route';
import { validateAndRegisterUser, validateSignInCredentials, registerOrLoginWithGoogle } from '@/services/authStore';
import { validateSession, getAuthenticatedUser } from '@/lib/security/session';
import { formatIndianWhatsApp } from '@/lib/services/notification.service';
import { createTestDatabase } from './helpers/testDb';
import { seedUser, seedIpo, seedApplication } from './helpers/seed';

const req = (url: string, body: unknown, cookie?: string, method = 'POST') =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('API routes: auth, validation, ownership, rate limits', () => {
  let close: () => Promise<void>;
  let cookie: string;
  let userId: string;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
    globalMemoryFallback.flushall();
    ({ cookie, id: userId } = await seedUser());
    await seedIpo();
  });
  afterEach(async () => close());

  it('401 without a session', async () => {
    expect((await checkRoute(req('/api/allotment/check', { applicationId: 'x' }))).status).toBe(401);
    expect((await getPans(new Request('http://localhost/api/pans'))).status).toBe(401);
  });

  it('400 on an invalid body', async () => {
    expect((await checkRoute(req('/api/allotment/check', { applicationId: '' }, cookie))).status).toBe(400);
    expect((await checkRoute(req('/api/allotment/check', { symbol: 'TESTIPO', pan: 'BAD' }, cookie))).status).toBe(400);
  });

  it('404 when the application belongs to someone else', async () => {
    const other = await seedUser('usr_other', 'other@example.com');
    await seedApplication(other.id, { id: 'theirs', pan: 'ZZZZZ9999Z' });
    expect((await checkRoute(req('/api/allotment/check', { applicationId: 'theirs' }, cookie))).status).toBe(404);
  });

  it('200 with the registrar deep link when direct checks are disabled', async () => {
    await seedApplication(userId, { id: 'mine', pan: 'ABCDE1234F' });
    const res = await checkRoute(req('/api/allotment/check', { applicationId: 'mine' }, cookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(['MANUAL_VERIFICATION_REQUIRED', 'PENDING']).toContain(json.data.status);
    expect(json.data.fallbackUrl).toMatch(/^https:\/\//);
    expect(JSON.stringify(json)).not.toContain('ABCDE1234F');
  });

  it('429 after 10 checks per minute', async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await checkRoute(req('/api/allotment/check', { applicationId: 'nope' }, cookie))).status;
    expect(last).toBe(429);
  });

  it('family check 404s when no family applications exist', async () => {
    expect((await familyRoute(req('/api/allotment/check-family', { symbol: 'TESTIPO' }, cookie))).status).toBe(404);
  });

  it('records applications with server-side lot size and price band; blocks client-set allotment', async () => {
    const created = await (await postPan(req('/api/pans', { name: 'Self', relationship: 'Self', pan: 'ABCDE1234F' }, cookie))).json();
    expect(created.data.pan).toBe('ABCDE****F');
    expect((await postPan(req('/api/pans', { name: 'Dup', relationship: 'Self', pan: 'ABCDE1234F' }, cookie))).status).toBe(409);

    const appRes = await (await postApp(req('/api/applications', { ipoSymbol: 'TESTIPO', panId: created.data.id, lots: 2 }, cookie))).json();
    expect(appRes.data.shares).toBe(300);
    expect(appRes.data.blockedAmount).toBe(30000);
    expect((await postApp(req('/api/applications', { ipoSymbol: 'TESTIPO', panId: created.data.id, lots: 1 }, cookie))).status).toBe(409);
    expect((await postApp(req('/api/applications', { ipoSymbol: 'TESTIPO', panId: created.data.id, lots: 1, bidPrice: 500 }, cookie))).status).toBe(409);

    const patch = await patchApp(req('/api/applications', { id: appRes.data.id, status: 'Allotted' }, cookie, 'PATCH'));
    expect(patch.status).toBe(400);
  });
});

describe('Database-backed authentication', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
  });
  afterEach(async () => close());

  it('registers, signs in, and rejects wrong passwords with a generic message', async () => {
    const reg = await validateAndRegisterUser({ name: 'Asha', email: 'Asha@Example.com', password: 'longenough1', investorCategory: 'Retail', termsAccepted: true });
    expect(reg.valid).toBe(true);
    expect((await validateAndRegisterUser({ name: 'Asha', email: 'asha@example.com', password: 'longenough1', investorCategory: 'Retail', termsAccepted: true })).valid).toBe(false);
    expect((await validateSignInCredentials({ email: 'asha@example.com', password: 'longenough1' })).valid).toBe(true);
    const bad = await validateSignInCredentials({ email: 'asha@example.com', password: 'nope' });
    expect(bad.valid).toBe(false);
    expect(bad.error).toBe('Incorrect email or password.');
    expect((await validateSignInCredentials({ email: 'ghost@example.com', password: 'x' })).error).toBe('Incorrect email or password.');
  });

  it('rejects short passwords and invalid PANs', async () => {
    expect((await validateAndRegisterUser({ name: 'A B', email: 'a@b.co', password: 'short', investorCategory: 'Retail', termsAccepted: true })).valid).toBe(false);
    expect((await validateAndRegisterUser({ name: 'A B', email: 'a@b.co', password: 'longenough1', investorCategory: 'Retail', primaryPan: 'XYZ', termsAccepted: true })).valid).toBe(false);
  });

  it('rejects forged or unknown session tokens', async () => {
    expect(await validateSession('jwt_session_usr_inst_01')).toBeNull();
    expect(await getAuthenticatedUser(new Request('http://x', { headers: { cookie: 'ipolens_session=sess_fake' } }))).toBeNull();
  });

  it('refuses Google sign-in without a verifiable ID token', async () => {
    const r = await registerOrLoginWithGoogle({ email: 'victim@example.com', name: 'Victim' });
    expect(r.valid).toBe(false);
  });
});

describe('WhatsApp number formatting', () => {
  it('auto-prefixes +91 and rejects junk', () => {
    expect(formatIndianWhatsApp('9876543210')).toBe('+919876543210');
    expect(formatIndianWhatsApp('09876543210')).toBe('+919876543210');
    expect(formatIndianWhatsApp('919876543210')).toBe('+919876543210');
    expect(formatIndianWhatsApp('+14155550100')).toBe('+14155550100');
    expect(formatIndianWhatsApp('12345')).toBeNull();
  });
});
