import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegistrarScannerService } from '../src/lib/services/registrar-scanner.service';
import { FamilyPanProfile, IpoApplication } from '../src/types/pan';
import { getApplicationsStore } from '../src/app/api/applications/route';

describe('Automated 1-Click Multi-PAN Registrar Allotment Scanner', () => {
  const mockFamilyPans: FamilyPanProfile[] = [
    {
      id: 'pan-user-1',
      name: 'Jeevan Gowda',
      relationship: 'Self',
      pan: 'ABCDE1234F',
      broker: 'Zerodha',
      createdAt: '2026-09-20',
    },
    {
      id: 'pan-user-2',
      name: 'Rekha Gowda',
      relationship: 'Spouse',
      pan: 'BCDEF2345G',
      broker: 'Groww',
      createdAt: '2026-09-20',
    },
    {
      id: 'pan-user-3',
      name: 'M. Gowda',
      relationship: 'Parent',
      pan: 'CDEFG3456H',
      broker: 'AngelOne',
      createdAt: '2026-09-20',
    },
    {
      id: 'pan-user-4',
      name: 'Sunita Gowda',
      relationship: 'Parent',
      pan: 'DEFGH4567I',
      broker: 'Upstox',
      createdAt: '2026-09-20',
    },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Official Registrar Resolution', () => {
    it('should correctly resolve official registrar by IPO symbol', () => {
      const bajajReg = RegistrarScannerService.getRegistrar('BAJAJHFL');
      expect(bajajReg.slug).toBe('linkintime');
      expect(bajajReg.name).toContain('Link Intime');

      const nseReg = RegistrarScannerService.getRegistrar('NSE');
      expect(nseReg.slug).toBe('kfintech');
      expect(nseReg.name).toContain('KFin Technologies');

      const spectraaReg = RegistrarScannerService.getRegistrar('SPECTRAA');
      expect(spectraaReg.slug).toBe('bigshare');
      expect(spectraaReg.name).toContain('Bigshare Services');
    });
  });

  describe('Concurrent Multi-PAN Scanner Execution', () => {
    it('should scan all 4 family PANs simultaneously across the assigned registrar without simulation', async () => {
      const summary = await RegistrarScannerService.scanAllFamilyPans({
        symbol: 'BAJAJHFL',
        companyName: 'Bajaj Housing Finance Limited',
        price: 70,
        lotSize: 214,
        pans: mockFamilyPans,
        autoSyncDatabase: false,
      });

      expect(summary.symbol).toBe('BAJAJHFL');
      expect(summary.registrarSlug).toBe('linkintime');
      expect(summary.totalPansScanned).toBe(4);
      expect(summary.items.length).toBe(4);

      // Every PAN should receive a structured scan record with zero simulation
      summary.items.forEach((item) => {
        expect(['Allotted', 'Not Allotted', 'Pending', 'Technical Rejection']).toContain(
          item.status
        );
        expect(item.panMasked).toContain('****');
        expect(item.registrarSlug).toBe('linkintime');
        expect(item.isSimulation).toBe(false);
        expect(typeof item.allotmentValue).toBe('number');
        expect(typeof item.refundAmount).toBe('number');
      });

      // Total count checks
      expect(summary.allottedCount + summary.notAllottedCount + summary.pendingCount).toBe(4);
    });
  });

  describe('Single PAN Authentic Allotment Inquiry', () => {
    it('should query single PAN and return genuine structure with zero simulation', async () => {
      vi.spyOn(RegistrarScannerService, 'queryRegistrarLive').mockResolvedValueOnce({
        success: true,
        status: 'Allotted',
        sharesAllotted: 38,
        sharesApplied: 38,
        applicantName: 'Jeevan Gowda',
        applicationNo: 'APP83726154',
        message: 'Official Allotment Confirmed by Link Intime',
        isOfficialGatewayRequired: false,
      });

      const result = await RegistrarScannerService.inquireSinglePan('SWIGGY', 'ABCDE1234F', {
        companyName: 'Swiggy Limited',
        price: 390,
        lotSize: 38,
      });

      expect(result.status).toBe('Allotted');
      expect(result.sharesAllotted).toBe(38);
      expect(result.isSimulation).toBe(false);
      expect(result.mirrors.length).toBeGreaterThan(0);
      expect(result.sourceBadge).toContain('OFFICIAL REGISTRAR');
    });

    it('should cleanly indicate official verification required when registrar uses CAPTCHA', async () => {
      vi.spyOn(RegistrarScannerService, 'queryRegistrarLive').mockResolvedValueOnce({
        success: false,
        status: 'Pending',
        sharesAllotted: 0,
        message: 'Security verification (CAPTCHA) required.',
        isOfficialGatewayRequired: true,
      });

      const result = await RegistrarScannerService.inquireSinglePan('HYUNDAI', 'ABCDE1234F', {
        companyName: 'Hyundai Motor India Ltd',
        price: 1960,
        lotSize: 7,
      });

      expect(result.status).toBe('Pending');
      expect(result.isSimulation).toBe(false);
      expect(result.isOfficialGatewayRequired).toBe(true);
      expect(result.sourceBadge).toContain('OFFICIAL GATEWAY REQUIRED');
    });
  });

  describe('Database Auto-Synchronization', () => {
    it('should update application status in the database upon scan completion when official status is returned', async () => {
      const appStore = getApplicationsStore();

      // Seed a test application into the store
      const testAppId = `test_app_${Date.now()}`;
      const seedApp: IpoApplication = {
        id: testAppId,
        ipoSymbol: 'NSE',
        companyName: 'National Stock Exchange of India Ltd',
        panId: 'pan-user-1',
        panNumber: 'ABCDE1234F',
        holderName: 'Jeevan Gowda',
        relationship: 'Self',
        category: 'Retail',
        lots: 1,
        shares: 14,
        bidPrice: 1785,
        blockedAmount: 24990,
        status: 'Applied',
        appliedAt: new Date().toISOString(),
      };
      appStore.push(seedApp);

      // Mock live registrar response with confirmed allotment
      vi.spyOn(RegistrarScannerService, 'queryRegistrarLive').mockResolvedValueOnce({
        success: true,
        status: 'Allotted',
        sharesAllotted: 14,
        sharesApplied: 14,
        applicantName: 'Jeevan Gowda',
        applicationNo: 'APP99887766',
        message: 'Official Allotment Confirmed by KFin Technologies: 14 shares allotted.',
        isOfficialGatewayRequired: false,
      });

      // Perform scan with autoSyncDatabase: true
      const summary = await RegistrarScannerService.scanAllFamilyPans({
        symbol: 'NSE',
        companyName: 'National Stock Exchange of India Ltd',
        price: 1785,
        lotSize: 14,
        pans: [mockFamilyPans[0]],
        autoSyncDatabase: true,
      });

      expect(summary.items.length).toBe(1);
      const scannedItem = summary.items[0];
      expect(scannedItem.syncedToDatabase).toBe(true);
      expect(scannedItem.status).toBe('Allotted');
      expect(scannedItem.sharesAllotted).toBe(14);

      // Verify the application in store now has updated status
      const updatedApp = appStore.find((a) => a.id === testAppId);
      expect(updatedApp).toBeDefined();
      expect(updatedApp?.status).toBe('Allotted');
      expect(updatedApp?.allottedShares).toBe(14);

      // Clean up test seed
      const idx = appStore.findIndex((a) => a.id === testAppId);
      if (idx !== -1) appStore.splice(idx, 1);
    });
  });
});
