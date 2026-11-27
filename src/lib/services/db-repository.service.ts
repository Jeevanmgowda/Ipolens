import { getDb, isDatabaseConfigured, schema } from '@/db';
import { eq, desc, and } from 'drizzle-orm';
import { FamilyPanProfile, IpoApplication } from '@/types/pan';
import { HoldingItem } from '@/types/portfolio';
import { encryptPan, decryptPan, maskPan, normalizePan } from '@/lib/security/panEncryption';

/**
 * User-scoped persistence for PAN profiles, applications, holdings, watchlist and notifications.
 * PostgreSQL (Supabase) is the only store: every method requires a real userId and there is no
 * in-memory fallback, so data is never shared between users or lost on restart.
 */

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function toApplication(r: typeof schema.ipoApplicationsTable.$inferSelect): IpoApplication {
  return {
    id: r.id,
    ipoSymbol: r.ipoSymbol,
    companyName: r.companyName,
    panId: r.panId,
    panNumber: r.panNumber,
    holderName: r.holderName,
    relationship: r.relationship as IpoApplication['relationship'],
    category: r.category as IpoApplication['category'],
    lots: r.lots,
    shares: r.shares,
    bidPrice: Number(r.bidPrice),
    blockedAmount: Number(r.blockedAmount),
    status: r.status as IpoApplication['status'],
    allottedShares: r.allottedShares || 0,
    allotmentStatus: r.allotmentStatus as IpoApplication['allotmentStatus'],
    checkedAt: r.checkedAt ? r.checkedAt.toISOString() : undefined,
    appliedAt: r.appliedAt.toISOString(),
  };
}

export class DbRepositoryService {
  static isDatabaseActive(): boolean {
    return isDatabaseConfigured();
  }

  // ==========================================
  // 1. Family PAN profiles (AES-256-GCM at rest, masked on read)
  // ==========================================

  static async getPans(userId: string): Promise<FamilyPanProfile[]> {
    const rows = await getDb()
      .select()
      .from(schema.familyPansTable)
      .where(eq(schema.familyPansTable.userId, userId))
      .orderBy(desc(schema.familyPansTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      relationship: r.relationship as FamilyPanProfile['relationship'],
      pan: r.pan,
      broker: r.broker,
      dematId: r.dematId || undefined,
      bankUpi: r.bankUpi || undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** True if the user already stored this raw PAN (compares decrypted values server-side). */
  static async hasPan(userId: string, rawPan: string): Promise<FamilyPanProfile | null> {
    const target = normalizePan(rawPan);
    const rows = await getDb()
      .select()
      .from(schema.familyPansTable)
      .where(eq(schema.familyPansTable.userId, userId));
    const hit = rows.find((r) => r.panEncrypted && decryptPan(r.panEncrypted) === target);
    if (!hit) return null;
    return {
      id: hit.id,
      name: hit.name,
      relationship: hit.relationship as FamilyPanProfile['relationship'],
      pan: hit.pan,
      broker: hit.broker,
      createdAt: hit.createdAt.toISOString(),
    };
  }

  static async savePan(profile: FamilyPanProfile, userId: string, rawPan: string): Promise<FamilyPanProfile> {
    const clean = normalizePan(rawPan);
    const secureProfile: FamilyPanProfile = { ...profile, pan: maskPan(clean) };
    await getDb().insert(schema.familyPansTable).values({
      id: secureProfile.id,
      userId,
      name: secureProfile.name,
      relationship: secureProfile.relationship,
      pan: secureProfile.pan,
      panEncrypted: encryptPan(clean),
      broker: secureProfile.broker,
      dematId: secureProfile.dematId,
      bankUpi: secureProfile.bankUpi,
      createdAt: new Date(secureProfile.createdAt || Date.now()),
    });
    return secureProfile;
  }

  static async deletePan(id: string, userId: string): Promise<boolean> {
    const res = await getDb()
      .delete(schema.familyPansTable)
      .where(and(eq(schema.familyPansTable.id, id), eq(schema.familyPansTable.userId, userId)))
      .returning({ id: schema.familyPansTable.id });
    return res.length > 0;
  }

  // ==========================================
  // 2. IPO applications
  // ==========================================

  static async getApplications(userId: string, symbol?: string): Promise<IpoApplication[]> {
    const t = schema.ipoApplicationsTable;
    const rows = await getDb()
      .select()
      .from(t)
      .where(symbol ? and(eq(t.userId, userId), eq(t.ipoSymbol, symbol.toUpperCase())) : eq(t.userId, userId))
      .orderBy(desc(t.appliedAt));
    return rows.map(toApplication);
  }

  static async getApplicationForUser(id: string, userId: string): Promise<IpoApplication | null> {
    const t = schema.ipoApplicationsTable;
    const rows = await getDb()
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.userId, userId)))
      .limit(1);
    return rows[0] ? toApplication(rows[0]) : null;
  }

  static async saveApplication(app: IpoApplication, userId: string): Promise<IpoApplication> {
    await getDb().insert(schema.ipoApplicationsTable).values({
      id: app.id,
      userId,
      ipoSymbol: app.ipoSymbol.toUpperCase(),
      companyName: app.companyName,
      panId: app.panId,
      panNumber: app.panNumber,
      holderName: app.holderName,
      relationship: app.relationship,
      category: app.category,
      lots: app.lots,
      shares: app.shares,
      bidPrice: app.bidPrice.toString(),
      blockedAmount: app.blockedAmount.toString(),
      status: app.status,
      allottedShares: 0,
      appliedAt: new Date(app.appliedAt || Date.now()),
    });
    return app;
  }

  /**
   * User-driven lifecycle updates (e.g. "Mandate Approved"). Allotment outcomes are written only
   * by the allotment gateway, never by this method.
   */
  static async updateApplicationLifecycle(
    id: string,
    userId: string,
    status: 'Applied' | 'Mandate Approved' | 'Refunded'
  ): Promise<IpoApplication | null> {
    const t = schema.ipoApplicationsTable;
    const rows = await getDb()
      .update(t)
      .set({ status })
      .where(and(eq(t.id, id), eq(t.userId, userId)))
      .returning();
    return rows[0] ? toApplication(rows[0]) : null;
  }

  static async deleteApplication(id: string, userId: string): Promise<boolean> {
    const t = schema.ipoApplicationsTable;
    const res = await getDb()
      .delete(t)
      .where(and(eq(t.id, id), eq(t.userId, userId)))
      .returning({ id: t.id });
    return res.length > 0;
  }

  // ==========================================
  // 3. Portfolio holdings
  // ==========================================

  static async getHoldings(userId: string): Promise<HoldingItem[]> {
    const rows = await getDb()
      .select()
      .from(schema.portfolioHoldingsTable)
      .where(eq(schema.portfolioHoldingsTable.userId, userId))
      .orderBy(desc(schema.portfolioHoldingsTable.updatedAt));

    return rows.map((r) => {
      const qty = r.quantity;
      const avgPrice = Number(r.averageBuyPrice);
      const curPrice = Number(r.currentPrice);
      const investedVal = Math.round(qty * avgPrice * 100) / 100;
      const currentVal = Math.round(qty * curPrice * 100) / 100;
      const pnl = Math.round((currentVal - investedVal) * 100) / 100;
      const pnlPct = investedVal > 0 ? Math.round((pnl / investedVal) * 10000) / 100 : 0;
      return {
        id: r.id,
        symbol: r.symbol,
        isin: r.isin,
        companyName: r.companyName,
        quantity: qty,
        averageBuyPrice: avgPrice,
        currentPrice: curPrice,
        investedValue: investedVal,
        currentValue: currentVal,
        unrealizedPnl: pnl,
        unrealizedPnlPercent: pnlPct,
        isIpoAllotment: Boolean(r.isIpoAllotment),
        importedFromBroker: r.importedFromBroker || undefined,
        lastUpdated: r.updatedAt.toISOString(),
      };
    });
  }

  static async saveHoldings(holdings: HoldingItem[], userId: string): Promise<HoldingItem[]> {
    const db = getDb();
    for (const h of holdings) {
      await db
        .insert(schema.portfolioHoldingsTable)
        .values({
          id: h.id,
          userId,
          symbol: h.symbol.toUpperCase(),
          isin: h.isin,
          companyName: h.companyName,
          quantity: h.quantity,
          averageBuyPrice: h.averageBuyPrice.toFixed(2),
          currentPrice: h.currentPrice.toFixed(2),
          isIpoAllotment: h.isIpoAllotment,
          importedFromBroker: h.importedFromBroker || 'generic',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.portfolioHoldingsTable.id,
          set: {
            quantity: h.quantity,
            averageBuyPrice: h.averageBuyPrice.toFixed(2),
            currentPrice: h.currentPrice.toFixed(2),
            updatedAt: new Date(),
          },
        });
    }
    return this.getHoldings(userId);
  }

  static async deleteHolding(id: string, userId: string): Promise<boolean> {
    const t = schema.portfolioHoldingsTable;
    const res = await getDb()
      .delete(t)
      .where(and(eq(t.id, id), eq(t.userId, userId)))
      .returning({ id: t.id });
    return res.length > 0;
  }

  static async clearHoldings(userId: string): Promise<boolean> {
    await getDb().delete(schema.portfolioHoldingsTable).where(eq(schema.portfolioHoldingsTable.userId, userId));
    return true;
  }

  // ==========================================
  // 4. Watchlist
  // ==========================================

  static async getWatchlist(userId: string): Promise<string[]> {
    const rows = await getDb()
      .select()
      .from(schema.marketWatchlistTable)
      .where(eq(schema.marketWatchlistTable.userId, userId))
      .orderBy(desc(schema.marketWatchlistTable.addedAt));
    return rows.map((r) => r.symbol);
  }

  static async toggleWatchlist(
    userId: string,
    symbol: string,
    companyName?: string
  ): Promise<{ watchlisted: boolean; symbol: string }> {
    const sym = symbol.toUpperCase().trim();
    const t = schema.marketWatchlistTable;
    const db = getDb();
    const existing = await db
      .select({ id: t.id })
      .from(t)
      .where(and(eq(t.userId, userId), eq(t.symbol, sym)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(t).where(and(eq(t.userId, userId), eq(t.symbol, sym)));
      return { watchlisted: false, symbol: sym };
    }
    await db.insert(t).values({ id: newId('watch'), userId, symbol: sym, companyName: companyName || sym, addedAt: new Date() });
    return { watchlisted: true, symbol: sym };
  }

  // ==========================================
  // 5. Notification centre
  // ==========================================

  static async getNotifications(userId: string) {
    return getDb()
      .select()
      .from(schema.notificationsTable)
      .where(eq(schema.notificationsTable.userId, userId))
      .orderBy(desc(schema.notificationsTable.createdAt))
      .limit(50);
  }

  static async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    symbol?: string,
    metadata?: Record<string, unknown>
  ) {
    const notif = {
      id: newId('notif'),
      userId,
      type,
      title,
      message,
      symbol: symbol ? symbol.toUpperCase() : null,
      read: false,
      metadata: metadata || null,
      createdAt: new Date(),
    };
    await getDb().insert(schema.notificationsTable).values(notif);
    return notif;
  }

  static async markNotificationRead(id: string, userId: string) {
    const t = schema.notificationsTable;
    await getDb().update(t).set({ read: true }).where(and(eq(t.id, id), eq(t.userId, userId)));
    return true;
  }

  // ==========================================
  // 6. DPDP: right to be forgotten
  // ==========================================

  static async purgeUserData(userId: string): Promise<boolean> {
    if (!userId) return false;
    const db = getDb();
    await db.delete(schema.familyPansTable).where(eq(schema.familyPansTable.userId, userId));
    await db.delete(schema.ipoApplicationsTable).where(eq(schema.ipoApplicationsTable.userId, userId));
    await db.delete(schema.portfolioHoldingsTable).where(eq(schema.portfolioHoldingsTable.userId, userId));
    await db.delete(schema.portfolioPnlJournalTable).where(eq(schema.portfolioPnlJournalTable.userId, userId));
    await db.delete(schema.marketWatchlistTable).where(eq(schema.marketWatchlistTable.userId, userId));
    await db.delete(schema.notificationsTable).where(eq(schema.notificationsTable.userId, userId));
    await db.delete(schema.pushSubscriptionsTable).where(eq(schema.pushSubscriptionsTable.userId, userId));
    await db.delete(schema.sessionsTable).where(eq(schema.sessionsTable.userId, userId));
    return true;
  }
}
