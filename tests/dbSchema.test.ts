import { describe, it, expect } from 'vitest';
import * as schema from '../src/db/schema';
import { DbRepositoryService } from '../src/lib/services/db-repository.service';
import { FamilyPanProfile, IpoApplication } from '../src/types/pan';

describe('PostgreSQL Database Persistence Layer with Drizzle ORM', () => {
  describe('Drizzle Schema Definitions', () => {
    it('should define valid PostgreSQL tables with all required fields', () => {
      // 1. Family PANs Table
      expect(schema.familyPansTable).toBeDefined();
      expect(schema.familyPansTable.id).toBeDefined();
      expect(schema.familyPansTable.name).toBeDefined();
      expect(schema.familyPansTable.pan).toBeDefined();
      expect(schema.familyPansTable.broker).toBeDefined();

      // 2. IPO Applications Table
      expect(schema.ipoApplicationsTable).toBeDefined();
      expect(schema.ipoApplicationsTable.id).toBeDefined();
      expect(schema.ipoApplicationsTable.ipoSymbol).toBeDefined();
      expect(schema.ipoApplicationsTable.blockedAmount).toBeDefined();
      expect(schema.ipoApplicationsTable.status).toBeDefined();

      // 3. Demat Portfolio Holdings Table
      expect(schema.portfolioHoldingsTable).toBeDefined();
      expect(schema.portfolioHoldingsTable.isin).toBeDefined();
      expect(schema.portfolioHoldingsTable.quantity).toBeDefined();
      expect(schema.portfolioHoldingsTable.averageBuyPrice).toBeDefined();

      // 4. Exchange Snapshots Table
      expect(schema.exchangeSnapshotsTable).toBeDefined();
      expect(schema.exchangeSnapshotsTable.symbol).toBeDefined();
      expect(schema.exchangeSnapshotsTable.snapshotType).toBeDefined();
      expect(schema.exchangeSnapshotsTable.data).toBeDefined();
    });
  });

  describe('DbRepositoryService Operations & Standalone Fallback', () => {
    it('should query and report database connection status without throwing', () => {
      const active = DbRepositoryService.isDatabaseActive();
      expect(typeof active).toBe('boolean');
    });

    it('should save, retrieve, and delete Family PAN profiles', async () => {
      const testPan: FamilyPanProfile = {
        id: `pan_test_${Date.now()}`,
        name: 'Database Test User',
        relationship: 'Self',
        pan: 'DBTST1234F',
        broker: 'Zerodha',
        bankUpi: 'dbtest@oksbi',
        createdAt: new Date().toISOString(),
      };

      // Save
      await DbRepositoryService.savePan(testPan);

      // Retrieve
      const pans = await DbRepositoryService.getPans();
      const found = pans.find((p) => p.id === testPan.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Database Test User');
      expect(found?.pan).toBe('DBTST1234F');

      // Delete
      const deleted = await DbRepositoryService.deletePan(testPan.id);
      expect(deleted).toBe(true);

      const afterDelete = await DbRepositoryService.getPans();
      expect(afterDelete.find((p) => p.id === testPan.id)).toBeUndefined();
    });

    it('should save, update status, and retrieve IPO Applications', async () => {
      const testAppId = `app_test_${Date.now()}`;
      const testApp: IpoApplication = {
        id: testAppId,
        ipoSymbol: 'BAJAJHFL',
        companyName: 'Bajaj Housing Finance Limited',
        panId: 'pan_test_holder',
        panNumber: 'ABCDE1234F',
        holderName: 'Jeevan Gowda',
        relationship: 'Self',
        category: 'Retail',
        lots: 1,
        shares: 214,
        bidPrice: 70,
        blockedAmount: 14980,
        status: 'Applied',
        appliedAt: new Date().toISOString(),
      };

      // Save Application
      await DbRepositoryService.saveApplication(testApp);

      // Verify retrieval
      const apps = await DbRepositoryService.getApplications('BAJAJHFL');
      const found = apps.find((a) => a.id === testAppId);
      expect(found).toBeDefined();
      expect(found?.status).toBe('Applied');
      expect(found?.blockedAmount).toBe(14980);

      // Update Application Status (e.g. from Registrar Scanner)
      const updated = await DbRepositoryService.updateApplicationStatus(testAppId, 'Allotted', 214);
      expect(updated).toBe(true);

      const appsAfter = await DbRepositoryService.getApplications('BAJAJHFL');
      const updatedApp = appsAfter.find((a) => a.id === testAppId);
      expect(updatedApp?.status).toBe('Allotted');
      expect(updatedApp?.allottedShares).toBe(214);
    });
  });
});
