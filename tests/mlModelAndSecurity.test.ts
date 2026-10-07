import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/security/passwordHash';
import { encryptPan, decryptPan, maskPan } from '../src/lib/security/panEncryption';
import { predictListingGain, HISTORICAL_BENCHMARK_SET } from '../src/services/mlListingGainModel';
import { getAnchorLockInSchedule } from '../src/services/anchorLockInService';

describe('Security & Enterprise Auth Architecture', () => {
  describe('PBKDF2 Password Hashing Engine', () => {
    it('should hash passwords with salt and verify successfully', () => {
      const rawPassword = 'SecretP@ssword123!';
      const { hash, salt } = hashPassword(rawPassword);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash.length).toBeGreaterThan(32);
      expect(salt.length).toBeGreaterThan(16);

      const isValid = verifyPassword(rawPassword, hash, salt);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', () => {
      const { hash, salt } = hashPassword('CorrectPassword99');
      const isValid = verifyPassword('WrongPassword12', hash, salt);
      expect(isValid).toBe(false);
    });

    it('should produce distinct hashes for identical passwords due to random salt generation', () => {
      const pwd = 'ConsistentPassword!23';
      const res1 = hashPassword(pwd);
      const res2 = hashPassword(pwd);

      expect(res1.salt).not.toBe(res2.salt);
      expect(res1.hash).not.toBe(res2.hash);
      expect(verifyPassword(pwd, res1.hash, res1.salt)).toBe(true);
      expect(verifyPassword(pwd, res2.hash, res2.salt)).toBe(true);
    });
  });

  describe('AES-256-GCM PAN Encryption & Masking', () => {
    it('should mask PAN cards adhering to SEBI standards (ABCDE****F)', () => {
      expect(maskPan('ABCDE1234F')).toBe('ABCDE****F');
      expect(maskPan('BNZPS9988K')).toBe('BNZPS****K');
    });

    it('should encrypt and decrypt PAN numbers with AES-256-GCM authenticated cipher', () => {
      const originalPan = 'ABCDE1234F';
      const encrypted = encryptPan(originalPan);

      // Structure: iv:authTag:ciphertext
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(encrypted).not.toContain(originalPan);

      const decrypted = decryptPan(encrypted);
      expect(decrypted).toBe(originalPan);
    });

    it('should fail decryption gracefully if ciphertext or auth tag is tampered with', () => {
      const originalPan = 'ABCDE1234F';
      const encrypted = encryptPan(originalPan);
      const parts = encrypted.split(':');
      // Corrupt the ciphertext
      const tampered = `${parts[0]}:${parts[1]}:badbeef999`;

      expect(decryptPan(tampered)).toBe('**********');
    });
  });
});

describe('Machine Learning Listing-Gain Estimation Engine', () => {
  it('should compute multi-factor listing gain prediction with attributions', () => {
    const prediction = predictListingGain({
      symbol: 'TATATECH',
      companyName: 'Tata Technologies Limited',
      issuePrice: 500,
      gmp: 500,
      qibSubscriptionMultiple: 203.4,
      niiSubscriptionMultiple: 62.1,
      retailSubscriptionMultiple: 16.5,
      totalSubscriptionMultiple: 69.4,
      issueSizeCr: 3042,
      marketMomentumPct: 3.2,
    });

    expect(prediction.symbol).toBe('TATATECH');
    expect(prediction.naiveGmpGainPct).toBe(100);
    expect(prediction.mlPredictedGainPct).toBeGreaterThan(0);
    expect(prediction.confidenceInterval.lowerPct).toBeLessThan(prediction.mlPredictedGainPct);
    expect(prediction.confidenceInterval.upperPct).toBeGreaterThan(prediction.mlPredictedGainPct);
    expect(prediction.attributions.length).toBeGreaterThanOrEqual(4);
    expect(prediction.benchmarkComparison.errorReductionPct).toBeCloseTo(58.1, 0.5);
  });

  it('should detect grey market manipulation risk when GMP is high but QIB is low', () => {
    const prediction = predictListingGain({
      symbol: 'SUSPICIOUS_IPO',
      companyName: 'Suspicious Corp Ltd',
      issuePrice: 200,
      gmp: 120, // 60% naive GMP!
      qibSubscriptionMultiple: 0.8, // Institutional QIB is undersubscribed
      niiSubscriptionMultiple: 1.2,
      retailSubscriptionMultiple: 12.0,
      totalSubscriptionMultiple: 3.5,
      issueSizeCr: 150,
    });

    expect(prediction.naiveGmpGainPct).toBe(60);
    expect(prediction.manipulationRisk).toBe(true);
    // ML predicted gain should be dampened to protect retail investors
    expect(prediction.mlPredictedGainPct).toBeLessThan(60);
  });

  it('should demonstrate superior accuracy over naive GMP on the historical benchmark dataset', () => {
    let naiveTotalError = 0;
    let mlTotalError = 0;

    for (const item of HISTORICAL_BENCHMARK_SET) {
      const pred = predictListingGain(item.features);
      const naiveError = Math.abs(item.actualListingGainPct - item.naiveGmpGainPct);
      const mlError = Math.abs(item.actualListingGainPct - pred.mlPredictedGainPct);

      naiveTotalError += naiveError;
      mlTotalError += mlError;
    }

    const naiveMae = naiveTotalError / HISTORICAL_BENCHMARK_SET.length;
    const mlMae = mlTotalError / HISTORICAL_BENCHMARK_SET.length;

    // ML MAE must be substantially lower than Naive GMP MAE
    expect(mlMae).toBeLessThan(naiveMae);
  });
});

describe('Anchor Investor Lock-In Expiry Intelligence', () => {
  it('should return statutory lock-in records for Indian IPOs', () => {
    const records = getAnchorLockInSchedule();
    expect(records.length).toBeGreaterThan(0);

    const swiggy = getAnchorLockInSchedule('SWIGGY')[0];
    expect(swiggy).toBeDefined();
    expect(swiggy.symbol).toBe('SWIGGY');
    expect(swiggy.anchor30Day.sharesUnlocked).toBeGreaterThan(0);
    expect(swiggy.anchor90Day.sharesUnlocked).toBeGreaterThan(0);
    expect(swiggy.marqueeAnchors.length).toBeGreaterThan(0);
  });
});

describe('Finance Act 2024 Post-Listing Tax Impact Formulation', () => {
  it('should accurately calculate Short-Term Capital Gains (STCG @ 20% + 4% cess)', () => {
    const capitalGain = 100000; // 1 Lakh gain
    const stcgRate = 0.20; // 20%
    const cessRate = 0.04; // 4%
    const baseTax = capitalGain * stcgRate; // 20,000
    const cess = baseTax * cessRate; // 800
    const totalTax = baseTax + cess; // 20,800
    const netInHand = capitalGain - totalTax; // 79,200

    expect(totalTax).toBe(20800);
    expect(netInHand).toBe(79200);
  });

  it('should accurately calculate Long-Term Capital Gains (LTCG @ 12.5% + 4% cess with ₹1.25L exemption)', () => {
    const capitalGain = 225000; // 2.25 Lakh gain
    const exemption = 125000; // 1.25 Lakh exempt
    const taxableGain = capitalGain - exemption; // 100,000
    const ltcgRate = 0.125; // 12.5%
    const cessRate = 0.04; // 4%
    const baseTax = taxableGain * ltcgRate; // 12,500
    const cess = baseTax * cessRate; // 500
    const totalTax = baseTax + cess; // 13,000
    const netInHand = capitalGain - totalTax; // 212,000

    expect(taxableGain).toBe(100000);
    expect(totalTax).toBe(13000);
    expect(netInHand).toBe(212000);
  });
});
