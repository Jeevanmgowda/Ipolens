import { db, isPostgresConfigured, schema } from '@/db';
import { eq, desc, and } from 'drizzle-orm';
import { FamilyPanProfile, IpoApplication } from '@/types/pan';
import { getUserPansStore } from '@/app/api/pans/route';
import { getApplicationsStore, updateApplicationStatus as updateMemoryAppStatus } from '@/app/api/applications/route';
import { encryptPan, maskPan } from '@/lib/security/panEncryption';

/**
 * Unified Database Repository Service
 * Dual-mode persistence: Uses PostgreSQL via Drizzle ORM when DATABASE_URL is configured,
 * with seamless zero-crash in-memory synchronization for development and testing.
 */

// Memory watchlist fallback
const inMemoryWatchlist = new Map<string, Array<{ id: string; symbol: string; companyName: string; addedAt: string }>>();
// Memory notifications fallback
const inMemoryNotifications = new Map<string, Array<any>>();

export class DbRepositoryService {
  /**
   * Status check for PostgreSQL persistence
   */
  static isDatabaseActive(): boolean {
    return isPostgresConfigured && db !== null;
  }

  // ==========================================
  // 1. Family PAN Profiles (with AES-256-GCM Encryption & Masking)
  // ==========================================

  static async getPans(userId: string = 'default_user'): Promise<FamilyPanProfile[]> {
    if (this.isDatabaseActive() && db) {
      try {
        const rows = await db
          .select()
          .from(schema.familyPansTable)
          .where(eq(schema.familyPansTable.userId, userId))
          .orderBy(desc(schema.familyPansTable.createdAt));

        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          relationship: r.relationship as any,
          pan: r.pan, // Masked PAN for security
          broker: r.broker,
          dematId: r.dematId || undefined,
          bankUpi: r.bankUpi || undefined,
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('[DB Repository] Error querying family_pans, falling back to memory store:', err);
      }
    }

    return getUserPansStore();
  }

  static async savePan(
    profile: FamilyPanProfile,
    userId: string = 'default_user',
    rawPan?: string
  ): Promise<FamilyPanProfile> {
    const rawToEncrypt = rawPan || profile.pan;
    const encrypted = rawToEncrypt && rawToEncrypt.length === 10 ? encryptPan(rawToEncrypt) : null;
    const masked = maskPan(rawToEncrypt || profile.pan);

    const secureProfile: FamilyPanProfile = {
      ...profile,
      pan: masked,
    };

    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.familyPansTable).values({
          id: secureProfile.id,
          userId,
          name: secureProfile.name,
          relationship: secureProfile.relationship,
          pan: secureProfile.pan,
          panEncrypted: encrypted,
          broker: secureProfile.broker,
          dematId: secureProfile.dematId,
          bankUpi: secureProfile.bankUpi,
          createdAt: new Date(secureProfile.createdAt || Date.now()),
        });
      } catch (err) {
        console.warn('[DB Repository] Error inserting family_pan, synced to memory store:', err);
      }
    }

    // Always keep memory store synchronized
    const memoryStore = getUserPansStore();
    const existingIdx = memoryStore.findIndex((p) => p.id === secureProfile.id);
    if (existingIdx === -1) {
      memoryStore.push(secureProfile);
    } else {
      memoryStore[existingIdx] = secureProfile;
    }

    return secureProfile;
  }

  static async deletePan(id: string, userId?: string): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        if (userId) {
          await db
            .delete(schema.familyPansTable)
            .where(and(eq(schema.familyPansTable.id, id), eq(schema.familyPansTable.userId, userId)));
        } else {
          await db.delete(schema.familyPansTable).where(eq(schema.familyPansTable.id, id));
        }
      } catch (err) {
        console.warn('[DB Repository] Error deleting family_pan from DB:', err);
      }
    }

    const memoryStore = getUserPansStore();
    const idx = memoryStore.findIndex((p) => p.id === id);
    if (idx !== -1) {
      memoryStore.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ==========================================
  // 2. IPO Applications
  // ==========================================

  static async getApplications(symbol?: string, userId: string = 'default_user'): Promise<IpoApplication[]> {
    if (this.isDatabaseActive() && db) {
      try {
        const query = db
          .select()
          .from(schema.ipoApplicationsTable)
          .where(
            symbol
              ? and(
                  eq(schema.ipoApplicationsTable.userId, userId),
                  eq(schema.ipoApplicationsTable.ipoSymbol, symbol.toUpperCase())
                )
              : eq(schema.ipoApplicationsTable.userId, userId)
          )
          .orderBy(desc(schema.ipoApplicationsTable.appliedAt));

        const rows = await query;
        return rows.map((r) => ({
          id: r.id,
          ipoSymbol: r.ipoSymbol,
          companyName: r.companyName,
          panId: r.panId,
          panNumber: r.panNumber,
          holderName: r.holderName,
          relationship: r.relationship as any,
          category: r.category as any,
          lots: r.lots,
          shares: r.shares,
          bidPrice: Number(r.bidPrice),
          blockedAmount: Number(r.blockedAmount),
          status: r.status as any,
          allottedShares: r.allottedShares || 0,
          appliedAt: r.appliedAt ? r.appliedAt.toISOString() : new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('[DB Repository] Error querying ipo_applications, falling back to memory store:', err);
      }
    }

    let list = getApplicationsStore();
    if (symbol) {
      list = list.filter((a) => a.ipoSymbol.toUpperCase() === symbol.toUpperCase());
    }
    return list;
  }

  static async saveApplication(app: IpoApplication, userId: string = 'default_user'): Promise<IpoApplication> {
    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.ipoApplicationsTable).values({
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
          allottedShares: app.allottedShares || 0,
          appliedAt: new Date(app.appliedAt || Date.now()),
        });
      } catch (err) {
        console.warn('[DB Repository] Error inserting ipo_application:', err);
      }
    }

    const memoryStore = getApplicationsStore();
    const existingIdx = memoryStore.findIndex((a) => a.id === app.id);
    if (existingIdx === -1) {
      memoryStore.unshift(app);
    } else {
      memoryStore[existingIdx] = app;
    }

    return app;
  }

  static async updateApplicationStatus(
    id: string,
    status: IpoApplication['status'],
    allottedShares?: number
  ): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        await db
          .update(schema.ipoApplicationsTable)
          .set({
            status,
            allottedShares: allottedShares !== undefined ? allottedShares : 0,
          })
          .where(eq(schema.ipoApplicationsTable.id, id));
      } catch (err) {
        console.warn('[DB Repository] Error updating ipo_application in DB:', err);
      }
    }

    // Update memory store
    return updateMemoryAppStatus(id, status, allottedShares);
  }

  // ==========================================
  // 3. Exchange Telemetry & Subscription Snapshots
  // ==========================================

  static async saveExchangeSnapshot(
    symbol: string,
    snapshotType: 'SUBSCRIPTION' | 'CANDLES' | 'REGISTRAR',
    data: any
  ): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.exchangeSnapshotsTable).values({
          symbol: symbol.toUpperCase(),
          snapshotType,
          data,
          createdAt: new Date(),
        });
        return true;
      } catch (err) {
        console.warn('[DB Repository] Error caching exchange snapshot to DB:', err);
      }
    }
    return false;
  }

  static async getLatestSnapshot(
    symbol: string,
    snapshotType: 'SUBSCRIPTION' | 'CANDLES' | 'REGISTRAR'
  ): Promise<any | null> {
    if (this.isDatabaseActive() && db) {
      try {
        const rows = await db
          .select()
          .from(schema.exchangeSnapshotsTable)
          .where(
            and(
              eq(schema.exchangeSnapshotsTable.symbol, symbol.toUpperCase()),
              eq(schema.exchangeSnapshotsTable.snapshotType, snapshotType)
            )
          )
          .orderBy(desc(schema.exchangeSnapshotsTable.createdAt))
          .limit(1);

        if (rows.length > 0) {
          return rows[0].data;
        }
      } catch (err) {
        console.warn('[DB Repository] Error reading exchange snapshot from DB:', err);
      }
    }
    return null;
  }

  // ==========================================
  // 4. Persistence of Subscription, Quotes, and OHLC to Postgres
  // ==========================================

  static async saveSubscriptionTelemetry(
    symbol: string,
    retail: number,
    nii: number,
    qib: number,
    total: number,
    employee: number = 0,
    ipoId?: string
  ): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.ipoSubscriptionsTable).values({
          ipoId: ipoId || symbol.toLowerCase(),
          symbol: symbol.toUpperCase(),
          retail: retail.toFixed(2),
          nii: nii.toFixed(2),
          qib: qib.toFixed(2),
          employee: employee.toFixed(2),
          total: total.toFixed(2),
          recordedAt: new Date(),
        });
        return true;
      } catch (err) {
        console.warn('[DB Repository] Error persisting subscription telemetry:', err);
      }
    }
    return false;
  }

  static async saveGmpHistory(
    symbol: string,
    gmp: number,
    gmpPercent?: number,
    source: string = 'Consensus Feed',
    ipoId?: string
  ): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.ipoGmpHistoryTable).values({
          ipoId: ipoId || symbol.toLowerCase(),
          symbol: symbol.toUpperCase(),
          gmp: gmp.toFixed(2),
          gmpPercent: gmpPercent !== undefined ? gmpPercent.toFixed(2) : null,
          source,
          recordedAt: new Date(),
        });
        return true;
      } catch (err) {
        console.warn('[DB Repository] Error persisting GMP history:', err);
      }
    }
    return false;
  }

  static async saveMarketQuote(quote: {
    symbol: string;
    ltp: number;
    open: number;
    high: number;
    low: number;
    previousClose: number;
    volume?: number;
    change?: number;
    changePercent?: number;
  }): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        await db
          .insert(schema.marketQuotesTable)
          .values({
            symbol: quote.symbol.toUpperCase(),
            ltp: quote.ltp.toFixed(2),
            open: quote.open.toFixed(2),
            high: quote.high.toFixed(2),
            low: quote.low.toFixed(2),
            previousClose: quote.previousClose.toFixed(2),
            volume: quote.volume || 0,
            change: (quote.change || quote.ltp - quote.previousClose).toFixed(2),
            changePercent: (
              quote.changePercent ||
              ((quote.ltp - quote.previousClose) / (quote.previousClose || 1)) * 100
            ).toFixed(2),
            timestamp: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.marketQuotesTable.symbol,
            set: {
              ltp: quote.ltp.toFixed(2),
              open: quote.open.toFixed(2),
              high: quote.high.toFixed(2),
              low: quote.low.toFixed(2),
              previousClose: quote.previousClose.toFixed(2),
              volume: quote.volume || 0,
              change: (quote.change || quote.ltp - quote.previousClose).toFixed(2),
              changePercent: (
                quote.changePercent ||
                ((quote.ltp - quote.previousClose) / (quote.previousClose || 1)) * 100
              ).toFixed(2),
              timestamp: new Date(),
            },
          });
        return true;
      } catch (err) {
        console.warn('[DB Repository] Error saving market quote:', err);
      }
    }
    return false;
  }

  static async saveOhlcCandles(
    symbol: string,
    timeframe: string,
    candles: Array<{
      timestamp: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }>
  ): Promise<boolean> {
    if (this.isDatabaseActive() && db && candles.length > 0) {
      try {
        const values = candles.map((c) => ({
          symbol: symbol.toUpperCase(),
          timeframe,
          timestamp: c.timestamp,
          open: c.open.toFixed(2),
          high: c.high.toFixed(2),
          low: c.low.toFixed(2),
          close: c.close.toFixed(2),
          volume: c.volume || 0,
        }));
        await db.insert(schema.marketOhlcTable).values(values);
        return true;
      } catch (err) {
        console.warn('[DB Repository] Error persisting OHLC candles:', err);
      }
    }
    return false;
  }

  // ==========================================
  // 5. User Watchlist with User Isolation
  // ==========================================

  static async getWatchlist(userId: string = 'default_user'): Promise<string[]> {
    if (this.isDatabaseActive() && db) {
      try {
        const rows = await db
          .select()
          .from(schema.marketWatchlistTable)
          .where(eq(schema.marketWatchlistTable.userId, userId))
          .orderBy(desc(schema.marketWatchlistTable.addedAt));

        return rows.map((r) => r.symbol);
      } catch (err) {
        console.warn('[DB Repository] Error querying watchlist:', err);
      }
    }

    const memoryList = inMemoryWatchlist.get(userId) || [
      { id: '1', symbol: 'SWIGGY', companyName: 'Swiggy Limited', addedAt: new Date().toISOString() },
      { id: '2', symbol: 'BAJAJHFL', companyName: 'Bajaj Housing Finance', addedAt: new Date().toISOString() },
    ];
    return memoryList.map((m) => m.symbol);
  }

  static async toggleWatchlist(
    userId: string = 'default_user',
    symbol: string,
    companyName?: string
  ): Promise<{ watchlisted: boolean; symbol: string }> {
    const sym = symbol.toUpperCase().trim();

    if (this.isDatabaseActive() && db) {
      try {
        const existing = await db
          .select()
          .from(schema.marketWatchlistTable)
          .where(
            and(
              eq(schema.marketWatchlistTable.userId, userId),
              eq(schema.marketWatchlistTable.symbol, sym)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .delete(schema.marketWatchlistTable)
            .where(
              and(
                eq(schema.marketWatchlistTable.userId, userId),
                eq(schema.marketWatchlistTable.symbol, sym)
              )
            );
          return { watchlisted: false, symbol: sym };
        } else {
          await db.insert(schema.marketWatchlistTable).values({
            id: `watch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            symbol: sym,
            companyName: companyName || sym,
            addedAt: new Date(),
          });
          return { watchlisted: true, symbol: sym };
        }
      } catch (err) {
        console.warn('[DB Repository] Error toggling watchlist in DB:', err);
      }
    }

    // Memory store fallback
    const list = inMemoryWatchlist.get(userId) || [];
    const idx = list.findIndex((m) => m.symbol === sym);
    if (idx !== -1) {
      list.splice(idx, 1);
      inMemoryWatchlist.set(userId, list);
      return { watchlisted: false, symbol: sym };
    } else {
      list.push({
        id: `watch_${Date.now()}`,
        symbol: sym,
        companyName: companyName || sym,
        addedAt: new Date().toISOString(),
      });
      inMemoryWatchlist.set(userId, list);
      return { watchlisted: true, symbol: sym };
    }
  }

  // ==========================================
  // 6. Notification Center
  // ==========================================

  static async getNotifications(userId: string = 'default_user') {
    if (this.isDatabaseActive() && db) {
      try {
        return await db
          .select()
          .from(schema.notificationsTable)
          .where(eq(schema.notificationsTable.userId, userId))
          .orderBy(desc(schema.notificationsTable.createdAt))
          .limit(50);
      } catch (err) {
        console.warn('[DB Repository] Error reading notifications:', err);
      }
    }

    return inMemoryNotifications.get(userId) || [
      {
        id: 'notif_1',
        userId,
        type: 'SUBSCRIPTION_MILESTONE',
        title: 'Retail Subscription Surge',
        message: 'Swiggy Limited retail portion has surpassed 8.4x subscription demand!',
        symbol: 'SWIGGY',
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        id: 'notif_2',
        userId,
        type: 'GMP_JUMP',
        title: 'Grey Market Premium Alert',
        message: 'Bajaj Housing Finance GMP jumped by +18% to ₹78 with high consensus.',
        symbol: 'BAJAJHFL',
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
      {
        id: 'notif_3',
        userId,
        type: 'LOCKIN_EXPIRY',
        title: 'Anchor Lock-In Expiry',
        message: '30-Day anchor lock-in expires in 4 days. 1.2 Crore shares becoming unlocked.',
        symbol: 'SWIGGY',
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      },
    ];
  }

  static async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    symbol?: string,
    metadata?: any
  ) {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type,
      title,
      message,
      symbol: symbol ? symbol.toUpperCase() : null,
      read: false,
      metadata: metadata || null,
      createdAt: new Date(),
    };

    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.notificationsTable).values(notif as any);
      } catch (err) {
        console.warn('[DB Repository] Error inserting notification to DB:', err);
      }
    }

    const list = inMemoryNotifications.get(userId) || [];
    list.unshift(notif);
    inMemoryNotifications.set(userId, list);
    return notif;
  }

  static async markNotificationRead(id: string, userId: string = 'default_user') {
    if (this.isDatabaseActive() && db) {
      try {
        await db
          .update(schema.notificationsTable)
          .set({ read: true })
          .where(and(eq(schema.notificationsTable.id, id), eq(schema.notificationsTable.userId, userId)));
      } catch (err) {
        console.warn('[DB Repository] Error marking notification read:', err);
      }
    }

    const list = inMemoryNotifications.get(userId) || [];
    const item = list.find((n) => n.id === id);
    if (item) item.read = true;
    return true;
  }

  // ==========================================
  // 7. DPDP Compliance: Right to be Forgotten (Data Purge)
  // ==========================================

  static async purgeUserData(userId: string): Promise<boolean> {
    if (!userId) return false;

    if (this.isDatabaseActive() && db) {
      try {
        await db.delete(schema.familyPansTable).where(eq(schema.familyPansTable.userId, userId));
        await db.delete(schema.ipoApplicationsTable).where(eq(schema.ipoApplicationsTable.userId, userId));
        await db.delete(schema.portfolioHoldingsTable).where(eq(schema.portfolioHoldingsTable.userId, userId));
        await db.delete(schema.marketWatchlistTable).where(eq(schema.marketWatchlistTable.userId, userId));
        await db.delete(schema.notificationsTable).where(eq(schema.notificationsTable.userId, userId));
        await db.delete(schema.sessionsTable).where(eq(schema.sessionsTable.userId, userId));
      } catch (err) {
        console.warn('[DB Repository] Error purging user data from DB:', err);
      }
    }

    inMemoryWatchlist.delete(userId);
    inMemoryNotifications.delete(userId);
    return true;
  }
}
