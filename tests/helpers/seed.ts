import { getDb, schema } from '@/db';
import { encryptPan, maskPan } from '@/lib/security/panEncryption';
import { createSession } from '@/lib/security/session';
import { hashPassword } from '@/lib/security/passwordHash';
import { IpoRepository } from '@/lib/repositories/ipo.repository';

export async function seedUser(id = 'usr_test', email = 'test@example.com') {
  const { hash, salt } = hashPassword('correct horse battery');
  await getDb().insert(schema.usersTable).values({ id, name: 'Test User', email, passwordHash: hash, salt });
  const { token } = await createSession(id);
  return { id, token, cookie: `ipolens_session=${token}` };
}

export async function seedIpo(over: Partial<Parameters<typeof IpoRepository.upsert>[0]> = {}) {
  const rec = {
    id: 'ig_1',
    symbol: 'TESTIPO',
    companyName: 'Test IPO Limited',
    series: 'EQ' as const,
    priceLow: 95,
    priceHigh: 100,
    lotSize: 150,
    issueSizeCr: 500,
    freshIssueCr: 300,
    ofsCr: 200,
    openDate: '2026-11-01',
    closeDate: '2026-11-03',
    allotmentDate: '2026-11-04',
    listingDate: '2030-01-01',
    registrar: 'MUFG Intime India Pvt.Ltd.',
    registrarSlug: 'linkintime',
    exchange: 'BSE, NSE',
    issuePrice: 100,
    listingPrice: null,
    source: 'test',
    extra: {},
    ...over,
  };
  await IpoRepository.upsert(rec);
  await getDb().update(schema.iposTable).set({ registrarCompanyId: 'CO1' });
  return rec;
}

export async function seedApplication(userId: string, opts: { id: string; pan: string; name?: string; symbol?: string; lots?: number }) {
  const db = getDb();
  const panId = `pan_${opts.id}`;
  await db.insert(schema.familyPansTable).values({
    id: panId,
    userId,
    name: opts.name ?? 'Member',
    relationship: 'Self',
    pan: maskPan(opts.pan),
    panEncrypted: encryptPan(opts.pan),
    broker: 'Zerodha',
  });
  const lots = opts.lots ?? 1;
  await db.insert(schema.ipoApplicationsTable).values({
    id: opts.id,
    userId,
    ipoSymbol: opts.symbol ?? 'TESTIPO',
    companyName: 'Test IPO Limited',
    panId,
    panNumber: maskPan(opts.pan),
    holderName: opts.name ?? 'Member',
    relationship: 'Self',
    category: 'Retail',
    lots,
    shares: lots * 150,
    bidPrice: '100',
    blockedAmount: String(lots * 150 * 100),
  });
  return { panId };
}
