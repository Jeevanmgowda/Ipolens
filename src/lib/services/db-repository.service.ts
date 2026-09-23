import { db, isPostgresConfigured, schema } from '@/db';
import { eq, desc, and } from 'drizzle-orm';
import { FamilyPanProfile, IpoApplication } from '@/types/pan';
import { getUserPansStore } from '@/app/api/pans/route';
import { getApplicationsStore, updateApplicationStatus as updateMemoryAppStatus } from '@/app/api/applications/route';

/**
 * Unified Database Repository Service
 * Dual-mode persistence: Uses PostgreSQL via Drizzle ORM when DATABASE_URL is configured,
 * with seamless zero-crash in-memory synchronization for development and testing.
 */

export class DbRepositoryService {
  /**
   * Status check for PostgreSQL persistence
   */
  static isDatabaseActive(): boolean {
    return isPostgresConfigured && db !== null;
  }

  // ==========================================
  // 1. Family PAN Profiles
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
          pan: r.pan,
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

  static async savePan(profile: FamilyPanProfile, userId: string = 'default_user'): Promise<FamilyPanProfile> {
    if (this.isDatabaseActive() && db) {
      try {
        await db.insert(schema.familyPansTable).values({
          id: profile.id,
          userId,
          name: profile.name,
          relationship: profile.relationship,
          pan: profile.pan,
          broker: profile.broker,
          dematId: profile.dematId,
          bankUpi: profile.bankUpi,
          createdAt: new Date(profile.createdAt || Date.now()),
        });
      } catch (err) {
        console.warn('[DB Repository] Error inserting family_pan, synced to memory store:', err);
      }
    }

    // Always keep memory store synchronized
    const memoryStore = getUserPansStore();
    const existingIdx = memoryStore.findIndex((p) => p.id === profile.id);
    if (existingIdx === -1) {
      memoryStore.push(profile);
    } else {
      memoryStore[existingIdx] = profile;
    }

    return profile;
  }

  static async deletePan(id: string): Promise<boolean> {
    if (this.isDatabaseActive() && db) {
      try {
        await db.delete(schema.familyPansTable).where(eq(schema.familyPansTable.id, id));
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
}
