import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { globalMemoryFallback } from '@/lib/redis';
import { AllotmentGatewayService } from '@/lib/services/allotment/allotment-gateway.service';
import { checkFamilyAllotment } from '@/lib/services/allotment/family-check.service';
import { notifyAllotmentOutcome, type ChannelSenders } from '@/lib/services/notification.service';
import { PnLCalculationService } from '@/lib/services/pnl.service';
import type { AdapterOutcome, RegistrarAdapter } from '@/lib/services/allotment/types';
import { createTestDatabase } from './helpers/testDb';
import { seedUser, seedIpo, seedApplication } from './helpers/seed';

const NOW = () => new Date('2026-11-05T06:00:00Z'); // after the allotment date

function fakeAdapter(byPan: Record<string, AdapterOutcome>) {
  const calls: string[] = [];
  const adapter: RegistrarAdapter = {
    slug: 'linkintime',
    async checkStatus(_c, pan) {
      calls.push(pan);
      return byPan[pan] ?? { status: 'MANUAL_VERIFICATION_REQUIRED', errorCode: 'HTTP_ERROR', message: 'down' };
    },
  };
  return { adapter, calls };
}

const gatewayWith = (adapter: RegistrarAdapter, directQuery = true) =>
  new AllotmentGatewayService({ adapters: { linkintime: adapter }, redis: globalMemoryFallback as never, directQuery, now: NOW });

describe('AllotmentGatewayService.verifyApplication', () => {
  let close: () => Promise<void>;
  let userId: string;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
    globalMemoryFallback.flushall();
    userId = (await seedUser()).id;
    await seedIpo();
  });
  afterEach(async () => close());

  it('persists a final ALLOTTED result exactly once and syncs P&L', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter } = fakeAdapter({ ABCDE1234F: { status: 'ALLOTTED', sharesAllotted: 150, message: 'ok' } });
    const pnl = vi.spyOn(PnLCalculationService, 'syncUserPnL');
    const gw = gatewayWith(adapter);

    const first = await gw.verifyApplication('app1');
    expect(first.status).toBe('ALLOTTED');
    expect(first.transitioned).toBe(true);
    expect(first.panNumber).toBe('ABCDE****F');
    expect(first.refundAmount).toBe(0);
    expect(pnl).toHaveBeenCalledTimes(1);

    const [row] = await getDb().select().from(schema.ipoApplicationsTable).where(eq(schema.ipoApplicationsTable.id, 'app1'));
    expect(row.allotmentStatus).toBe('ALLOTTED');
    expect(row.allottedShares).toBe(150);
    expect(row.attemptCount).toBe(1);

    const second = await gw.verifyApplication('app1');
    expect(second.transitioned).toBe(false);
    expect(second.source).toBe('database');
    expect(pnl).toHaveBeenCalledTimes(1);

    const journal = await getDb().select().from(schema.portfolioPnlJournalTable);
    expect(journal).toHaveLength(1);
    const holdings = await getDb().select().from(schema.portfolioHoldingsTable);
    expect(holdings[0].quantity).toBe(150);
    expect(holdings[0].isIpoAllotment).toBe(true);
    pnl.mockRestore();
  });

  it('serves a cached final outcome without calling the registrar', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter, calls } = fakeAdapter({ ABCDE1234F: { status: 'NOT_ALLOTTED', sharesAllotted: 0, message: 'no' } });
    const gw = gatewayWith(adapter);
    await gw.checkPan('TESTIPO', 'ABCDE1234F');
    expect(calls).toHaveLength(1);
    const r = await gw.verifyApplication('app1');
    expect(r.source).toBe('cache');
    expect(r.status).toBe('NOT_ALLOTTED');
    expect(calls).toHaveLength(1);
  });

  it('never caches or persists PENDING / MANUAL outcomes', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter, calls } = fakeAdapter({});
    const gw = gatewayWith(adapter);
    const r1 = await gw.verifyApplication('app1');
    expect(r1.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(r1.fallbackUrl).toMatch(/mpms\.mufg\.com/);
    await gw.verifyApplication('app1');
    expect(calls).toHaveLength(2); // retried, not cached
    const [row] = await getDb().select().from(schema.ipoApplicationsTable);
    expect(row.allotmentStatus).toBe('PENDING');
    expect(row.attemptCount).toBe(2);
    expect(row.lastErrorCode).toBe('HTTP_ERROR');
  });

  it('returns PENDING while another check holds the lock', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { hashPan } = await import('@/lib/security/panEncryption');
    await globalMemoryFallback.set(`allotment:lock:TESTIPO:${hashPan('ABCDE1234F')}`, '1', 'PX', 30000);
    const { adapter, calls } = fakeAdapter({ ABCDE1234F: { status: 'ALLOTTED', sharesAllotted: 150, message: 'ok' } });
    const r = await gatewayWith(adapter).verifyApplication('app1');
    expect(r.status).toBe('PENDING');
    expect(r.errorCode).toBe('LOCKED');
    expect(calls).toHaveLength(0);
  });

  it('uses the deep link when direct querying is disabled (Path B)', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter, calls } = fakeAdapter({ ABCDE1234F: { status: 'ALLOTTED', sharesAllotted: 150, message: 'ok' } });
    const r = await gatewayWith(adapter, false).verifyApplication('app1');
    expect(r.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(r.errorCode).toBe('DIRECT_QUERY_DISABLED');
    expect(calls).toHaveLength(0);
  });

  it('does not query before the allotment date', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter, calls } = fakeAdapter({});
    const early = new AllotmentGatewayService({ adapters: { linkintime: adapter }, redis: globalMemoryFallback as never, directQuery: true, now: () => new Date('2026-11-02T06:00:00Z') });
    const r = await early.verifyApplication('app1');
    expect(r.status).toBe('PENDING');
    expect(r.errorCode).toBe('NOT_PUBLISHED');
    expect(calls).toHaveLength(0);
  });

  it('opens the circuit breaker after repeated registrar failures', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter, calls } = fakeAdapter({});
    const gw = gatewayWith(adapter);
    for (let i = 0; i < 5; i++) await gw.verifyApplication('app1');
    expect(calls).toHaveLength(5);
    const r = await gw.verifyApplication('app1');
    expect(r.errorCode).toBe('CIRCUIT_OPEN');
    expect(calls).toHaveLength(5);
  });

  it('rejects applications owned by another user (404)', async () => {
    await seedApplication(userId, { id: 'app1', pan: 'ABCDE1234F' });
    const { adapter } = fakeAdapter({});
    await expect(gatewayWith(adapter).verifyApplication('app1', { userId: 'someone_else' })).rejects.toThrow('Application not found');
  });
});

describe('Family PAN check and notifications', () => {
  let close: () => Promise<void>;
  let userId: string;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
    globalMemoryFallback.flushall();
    userId = (await seedUser()).id;
    await seedIpo();
  });
  afterEach(async () => close());

  it('checks every family PAN and totals shares and refunds', async () => {
    await seedApplication(userId, { id: 'a1', pan: 'AAAAA1111A', name: 'Self' });
    await seedApplication(userId, { id: 'a2', pan: 'BBBBB2222B', name: 'Spouse' });
    await seedApplication(userId, { id: 'a3', pan: 'CCCCC3333C', name: 'Parent' });
    const { adapter } = fakeAdapter({
      AAAAA1111A: { status: 'ALLOTTED', sharesAllotted: 150, message: 'ok' },
      BBBBB2222B: { status: 'NOT_ALLOTTED', sharesAllotted: 0, message: 'no' },
    });
    const summary = await checkFamilyAllotment(userId, 'TESTIPO', gatewayWith(adapter));
    expect(summary!.members).toHaveLength(3);
    expect(summary!.totals.allotted).toBe(1);
    expect(summary!.totals.notAllotted).toBe(1);
    expect(summary!.totals.manual).toBe(1);
    expect(summary!.totals.sharesAllotted).toBe(150);
    expect(summary!.totals.refundDue).toBe(15000); // the not-allotted member's blocked amount
    for (const m of summary!.members) expect(m.panNumber).toMatch(/^[A-Z]{5}\*{4}[A-Z]$/);

    // In-app notifications were created once per final outcome.
    const notes = await getDb().select().from(schema.notificationsTable);
    expect(notes).toHaveLength(2);
  });

  it('sends each outcome once per channel and isolates channel failures', async () => {
    await seedApplication(userId, { id: 'a1', pan: 'AAAAA1111A' });
    await getDb().update(schema.usersTable).set({ phone: '+919876543210', whatsappOptIn: true });
    await getDb().insert(schema.pushSubscriptionsTable).values([
      { userId, endpoint: 'https://push.example/expired', p256dh: 'k'.repeat(20), auth: 'a'.repeat(8) },
      { userId, endpoint: 'https://push.example/ok', p256dh: 'k'.repeat(20), auth: 'a'.repeat(8) },
    ]);
    const senders: ChannelSenders = {
      webPush: vi.fn(async (sub) => {
        if (sub.endpoint.endsWith('expired')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      }),
      whatsapp: vi.fn(async () => {
        throw new Error('Twilio down');
      }),
    };
    const notice = {
      applicationId: 'a1',
      userId,
      outcome: 'ALLOTTED' as const,
      symbol: 'TESTIPO',
      companyName: 'Test IPO Limited',
      holderName: 'Member',
      panMasked: 'AAAAA****A',
      sharesAllotted: 150,
      refundAmount: 0,
    };
    const first = await notifyAllotmentOutcome(notice, senders);
    expect(first).toEqual({ IN_APP: 'SENT', WEB_PUSH: 'SENT', WHATSAPP: 'FAILED' });
    // Expired subscription removed.
    const subs = await getDb().select().from(schema.pushSubscriptionsTable);
    expect(subs.map((s) => s.endpoint)).toEqual(['https://push.example/ok']);

    const second = await notifyAllotmentOutcome(notice, senders);
    expect(second).toEqual({ IN_APP: 'DUPLICATE', WEB_PUSH: 'DUPLICATE', WHATSAPP: 'DUPLICATE' });
    expect(await getDb().select().from(schema.notificationsTable)).toHaveLength(1);
  });
});
