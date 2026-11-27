import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { env } from '@/lib/env';
import { getRedisClient } from '@/lib/redis';
import { decryptPan } from '@/lib/security/panEncryption';
import { getRegistrar, fallbackAllotmentUrl } from '@/lib/registrars';
import { IpoRepository, todayIst } from '@/lib/repositories/ipo.repository';
import { PnLCalculationService } from '@/lib/services/pnl.service';
import { NotFoundError } from '@/lib/http';
import { LinkIntimeAdapter } from './linkintime.adapter';
import { KFintechAdapter } from './kfintech.adapter';
import { BigshareAdapter } from './bigshare.adapter';
import {
  BREAKER_THRESHOLD,
  BREAKER_WINDOW_SECONDS,
  CACHE_TTL_SECONDS,
  LOCK_TTL_MS,
} from './config';
import { breakerKey, cacheKey, hashPan, isValidPan, lockKey, maskPan, normalizePan, manualOutcome } from './helpers';
import { FINAL_STATUSES, type AdapterOutcome, type AllotmentResult, type RegistrarAdapter } from './types';

/**
 * Dual-path allotment engine.
 *  Path A: registrar adapter behind timeout, cache, lock and circuit breaker.
 *  Path B: deterministic deep link (MANUAL_VERIFICATION_REQUIRED) whenever Path A is not possible.
 * Only final outcomes (ALLOTTED / NOT_ALLOTTED) are cached or persisted, so retries can still succeed.
 */

export interface VerifyResult extends AllotmentResult {
  applicationId?: string;
  /** True when this call moved the application from PENDING to a final status. */
  transitioned: boolean;
  refundAmount?: number;
}

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
};

export interface GatewayDeps {
  adapters?: Partial<Record<string, RegistrarAdapter>>;
  redis?: RedisLike;
  directQuery?: boolean;
  now?: () => Date;
}

const defaultAdapters = (): Record<string, RegistrarAdapter> => ({
  linkintime: new LinkIntimeAdapter(),
  kfintech: new KFintechAdapter(),
  bigshare: new BigshareAdapter(),
});

/** Registrars with authorized B2B credentials may be queried even when the public-endpoint flag is off. */
function hasAuthorizedCredentials(slug: string): boolean {
  const map: Record<string, string | undefined> = {
    linkintime: process.env.MUFG_INTIME_API_KEY || process.env.LINKINTIME_API_KEY,
    kfintech: process.env.KFINTECH_API_KEY,
    bigshare: process.env.BIGSHARE_API_KEY,
  };
  return Boolean(map[slug]);
}

export class AllotmentGatewayService {
  private readonly adapters: Record<string, RegistrarAdapter>;
  private readonly redis: RedisLike;
  private readonly directQuery: boolean;
  private readonly now: () => Date;

  constructor(deps: GatewayDeps = {}) {
    this.adapters = { ...defaultAdapters(), ...(deps.adapters as Record<string, RegistrarAdapter>) };
    this.redis = deps.redis ?? (getRedisClient() as RedisLike);
    this.directQuery = deps.directQuery ?? env().REGISTRAR_DIRECT_QUERY;
    this.now = deps.now ?? (() => new Date());
  }

  // ------------------------------------------------------------------ circuit breaker
  private async breakerOpen(slug: string): Promise<boolean> {
    const v = await this.redis.get(breakerKey(slug)).catch(() => null);
    return Number(v || 0) >= BREAKER_THRESHOLD;
  }
  private async recordFailure(slug: string) {
    try {
      const n = await this.redis.incr(breakerKey(slug));
      if (n === 1) await this.redis.expire(breakerKey(slug), BREAKER_WINDOW_SECONDS);
    } catch {
      /* breaker is best-effort */
    }
  }
  private async recordSuccess(slug: string) {
    await this.redis.del(breakerKey(slug)).catch(() => 0);
  }

  /**
   * Core Path A/B decision for one (IPO, PAN). Shared by persisted and ad-hoc checks.
   */
  private async checkRegistrar(ipo: {
    symbol: string;
    companyName: string;
    id: string;
    registrarSlug: string | null;
    registrarCompanyId: string | null;
    allotmentDate: string | null;
  }, rawPan: string): Promise<{ outcome: AdapterOutcome; source: AllotmentResult['source'] }> {
    const slug = ipo.registrarSlug || 'other';

    if (ipo.allotmentDate && todayIst(this.now()) < ipo.allotmentDate) {
      return {
        outcome: { status: 'PENDING', errorCode: 'NOT_PUBLISHED', message: `Allotment is expected on ${ipo.allotmentDate}; results are not published yet.` },
        source: 'fallback',
      };
    }

    const adapter = this.adapters[slug];
    if (!adapter) {
      return { outcome: manualOutcome('UNSUPPORTED_REGISTRAR', `Automatic checks are not available for ${getRegistrar(slug).name}. Verify on the registrar site.`), source: 'fallback' };
    }
    if (!this.directQuery && !hasAuthorizedCredentials(slug)) {
      return { outcome: manualOutcome('DIRECT_QUERY_DISABLED', 'Automatic registrar lookups are turned off. Verify in one click on the registrar site.'), source: 'fallback' };
    }
    if (await this.breakerOpen(slug)) {
      return { outcome: manualOutcome('CIRCUIT_OPEN', `${getRegistrar(slug).name} is not responding reliably right now. Verify on the registrar site.`), source: 'fallback' };
    }

    let companyId = ipo.registrarCompanyId;
    if (!companyId && adapter.resolveCompanyId) {
      companyId = await adapter.resolveCompanyId(ipo.companyName).catch(() => null);
      if (companyId) {
        await getDb().update(schema.iposTable).set({ registrarCompanyId: companyId }).where(eq(schema.iposTable.id, ipo.id));
      }
    }
    if (!companyId) {
      return { outcome: manualOutcome('COMPANY_NOT_FOUND', `${ipo.companyName} is not listed on the registrar's allotment page yet.`), source: 'fallback' };
    }

    const outcome = await adapter.checkStatus(companyId, rawPan);
    if (outcome.status === 'MANUAL_VERIFICATION_REQUIRED') await this.recordFailure(slug);
    else await this.recordSuccess(slug);
    return { outcome, source: 'registrar' };
  }

  private build(
    symbol: string,
    rawPan: string,
    registrarSlug: string | null,
    sharesApplied: number,
    outcome: AdapterOutcome,
    source: AllotmentResult['source']
  ): AllotmentResult {
    return {
      symbol,
      panNumber: maskPan(rawPan),
      status: outcome.status,
      sharesApplied: outcome.sharesApplied ?? sharesApplied,
      sharesAllotted: outcome.status === 'ALLOTTED' ? outcome.sharesAllotted ?? 0 : 0,
      applicationNumber: outcome.applicationNumber,
      dpId: outcome.dpId,
      message: outcome.message,
      fallbackUrl: fallbackAllotmentUrl(registrarSlug),
      registrar: getRegistrar(registrarSlug).name,
      source,
      errorCode: outcome.errorCode,
      checkedAt: this.now().toISOString(),
    };
  }

  /** Checks one of the user's recorded applications and persists a final outcome exactly once. */
  async verifyApplication(applicationId: string, opts: { userId?: string } = {}): Promise<VerifyResult> {
    const db = getDb();

    // 1. Hydrate: application + IPO + PAN (the raw PAN is decrypted only here, server-side).
    const rows = await db
      .select({ app: schema.ipoApplicationsTable, ipo: schema.iposTable, pan: schema.familyPansTable })
      .from(schema.ipoApplicationsTable)
      .leftJoin(schema.iposTable, eq(schema.iposTable.symbol, schema.ipoApplicationsTable.ipoSymbol))
      .leftJoin(
        schema.familyPansTable,
        and(eq(schema.familyPansTable.id, schema.ipoApplicationsTable.panId), eq(schema.familyPansTable.userId, schema.ipoApplicationsTable.userId))
      )
      .where(
        opts.userId
          ? and(eq(schema.ipoApplicationsTable.id, applicationId), eq(schema.ipoApplicationsTable.userId, opts.userId))
          : eq(schema.ipoApplicationsTable.id, applicationId)
      )
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundError('Application not found.');
    const { app, ipo, pan } = row;
    const symbol = app.ipoSymbol;
    const lotSize = ipo?.lotSize ?? null;
    const sharesApplied = lotSize ? app.lots * lotSize : app.shares;
    const rawPan = pan?.panEncrypted ? normalizePan(decryptPan(pan.panEncrypted)) : '';
    const slug = ipo?.registrarSlug ?? null;

    const bookkeeping = async (errorCode: string | null) => {
      await db
        .update(schema.ipoApplicationsTable)
        .set({ checkedAt: this.now(), attemptCount: sql`${schema.ipoApplicationsTable.attemptCount} + 1`, lastErrorCode: errorCode })
        .where(eq(schema.ipoApplicationsTable.id, applicationId));
    };

    // Already final in the database: nothing to fetch.
    if (FINAL_STATUSES.has(app.allotmentStatus as never)) {
      return {
        ...this.build(
          symbol,
          rawPan || 'XXXXX0000X',
          slug,
          sharesApplied,
          { status: app.allotmentStatus as 'ALLOTTED' | 'NOT_ALLOTTED', sharesAllotted: app.allottedShares ?? 0, message: 'Result already recorded.' },
          'database'
        ),
        panNumber: app.panNumber,
        applicationId,
        transitioned: false,
      };
    }

    if (!ipo) {
      await bookkeeping('UNSUPPORTED_REGISTRAR');
      return { ...this.build(symbol, rawPan || 'XXXXX0000X', null, sharesApplied, manualOutcome('UNSUPPORTED_REGISTRAR', `${symbol} is not in the live IPO directory.`), 'fallback'), panNumber: app.panNumber, applicationId, transitioned: false };
    }
    if (!isValidPan(rawPan)) {
      await bookkeeping('INVALID_PAN');
      return { ...this.build(symbol, 'XXXXX0000X', slug, sharesApplied, manualOutcome('INVALID_PAN', 'The PAN for this application could not be read. Re-save the PAN profile.'), 'fallback'), panNumber: app.panNumber, applicationId, transitioned: false };
    }

    const panHash = hashPan(rawPan);

    // 2. Cache lookup (final outcomes only).
    const cached = await this.redis.get(cacheKey(symbol, panHash)).catch(() => null);
    let outcome: AdapterOutcome | null = null;
    let source: AllotmentResult['source'] = 'cache';
    if (cached) outcome = JSON.parse(cached) as AdapterOutcome;

    let lockAcquired = false;
    try {
      if (!outcome) {
        // 3. Lock per (symbol, PAN) so concurrent checks do not hit the registrar twice.
        lockAcquired = (await this.redis.set(lockKey(symbol, panHash), '1', 'PX', LOCK_TTL_MS, 'NX').catch(() => 'OK')) === 'OK';
        if (!lockAcquired) {
          return {
            ...this.build(symbol, rawPan, slug, sharesApplied, { status: 'PENDING', errorCode: 'LOCKED', message: 'A check for this PAN is already in progress.' }, 'fallback'),
            applicationId,
            transitioned: false,
          };
        }
        // 4. Breaker + routing + adapter.
        const r = await this.checkRegistrar(
          { symbol, companyName: ipo.companyName, id: ipo.id, registrarSlug: slug, registrarCompanyId: ipo.registrarCompanyId, allotmentDate: ipo.allotmentDate },
          rawPan
        );
        outcome = r.outcome;
        source = r.source;
        if (FINAL_STATUSES.has(outcome.status)) {
          await this.redis.set(cacheKey(symbol, panHash), JSON.stringify(outcome), 'EX', CACHE_TTL_SECONDS).catch(() => null);
        }
      }

      const result = this.build(symbol, rawPan, slug, sharesApplied, outcome, source);
      let transitioned = false;
      let refundAmount: number | undefined;

      // 5. Persist idempotently: only PENDING rows change, so a final result is written once.
      if (FINAL_STATUSES.has(outcome.status)) {
        const updated = await db
          .update(schema.ipoApplicationsTable)
          .set({
            allotmentStatus: outcome.status,
            allottedShares: result.sharesAllotted,
            status: outcome.status === 'ALLOTTED' ? 'Allotted' : 'Not Allotted',
          })
          .where(and(eq(schema.ipoApplicationsTable.id, applicationId), eq(schema.ipoApplicationsTable.allotmentStatus, 'PENDING')))
          .returning({ id: schema.ipoApplicationsTable.id });
        transitioned = updated.length > 0;

        // 6. P&L sync on a fresh transition (journal also records refunds for NOT_ALLOTTED).
        if (transitioned) {
          await PnLCalculationService.syncUserPnL(app.userId);
          const issuePrice = ipo.issuePrice ? Number(ipo.issuePrice) : ipo.priceHigh ? Number(ipo.priceHigh) : Number(app.bidPrice);
          refundAmount = Math.max(0, Number(app.blockedAmount) - result.sharesAllotted * issuePrice);
        }
      }

      // 7. Bookkeeping, always.
      await bookkeeping(outcome.errorCode ?? null);
      return { ...result, applicationId, transitioned, refundAmount };
    } finally {
      if (lockAcquired) await this.redis.del(lockKey(symbol, panHash)).catch(() => 0);
    }
  }

  /** Ad-hoc check of any PAN for an IPO (not persisted, no application required). */
  async checkPan(symbol: string, pan: string): Promise<AllotmentResult> {
    const rawPan = normalizePan(pan);
    const ipo = await IpoRepository.getBySymbol(symbol);
    if (!ipo) throw new NotFoundError(`IPO ${symbol} is not in the live IPO directory.`);
    const panHash = hashPan(rawPan);
    const cached = await this.redis.get(cacheKey(ipo.symbol, panHash)).catch(() => null);
    if (cached) return this.build(ipo.symbol, rawPan, ipo.registrarSlug, 0, JSON.parse(cached), 'cache');

    const lock = (await this.redis.set(lockKey(ipo.symbol, panHash), '1', 'PX', LOCK_TTL_MS, 'NX').catch(() => 'OK')) === 'OK';
    if (!lock) {
      return this.build(ipo.symbol, rawPan, ipo.registrarSlug, 0, { status: 'PENDING', errorCode: 'LOCKED', message: 'A check for this PAN is already in progress.' }, 'fallback');
    }
    try {
      const row = await getDb().select({ cid: schema.iposTable.registrarCompanyId }).from(schema.iposTable).where(eq(schema.iposTable.id, ipo.id)).limit(1);
      const { outcome, source } = await this.checkRegistrar(
        { symbol: ipo.symbol, companyName: ipo.companyName, id: ipo.id, registrarSlug: ipo.registrarSlug, registrarCompanyId: row[0]?.cid ?? null, allotmentDate: ipo.allotmentDate },
        rawPan
      );
      if (FINAL_STATUSES.has(outcome.status)) {
        await this.redis.set(cacheKey(ipo.symbol, panHash), JSON.stringify(outcome), 'EX', CACHE_TTL_SECONDS).catch(() => null);
      }
      return this.build(ipo.symbol, rawPan, ipo.registrarSlug, 0, outcome, source);
    } finally {
      await this.redis.del(lockKey(ipo.symbol, panHash)).catch(() => 0);
    }
  }
}
