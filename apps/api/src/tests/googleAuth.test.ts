import { describe, it, expect } from 'vitest';
import { computeFairId } from '../db/postgres';
import { evaluateRisk, RISK_CONFIG, RiskSignals } from '../services/riskEngine';
import { verifyGoogleIdToken, createSessionJwt } from '../services/googleAuth';
import { jwtVerify } from 'jose';

describe('Google Authentication & FairID Integrity', () => {
  it('should deterministically compute FairID = sha256(identifier + ":" + deviceFp)', () => {
    const googleSub = 'google_sub_1092837465';
    const deviceFp = 'fp_canvas_audio_webgl_99';
    const fairId1 = computeFairId(googleSub, deviceFp);
    const fairId2 = computeFairId(googleSub, deviceFp);

    expect(fairId1).toBe(fairId2);
    expect(fairId1).toHaveLength(64); // SHA-256 hex length
    expect(/^[0-9a-f]{64}$/.test(fairId1)).toBe(true);

    // Different device fingerprint produces different FairID
    const fairId3 = computeFairId(googleSub, 'different_device_fp');
    expect(fairId3).not.toBe(fairId1);
  });

  it('should give Google-verified users a lower base risk score than OTP-only users via RISK_CONFIG', () => {
    const baseSignals: RiskSignals = {
      requestsPerMin: 15, // (15 - 10) * 0.5 = 2.5 pts
      burstiness: 1.0,
      uaAnomaly: false,
      headerOrderHashFamiliarity: 0.9,
      deviceFpReuseCount: 1,
      subnetReuseCount: 1,
      accountAgeSec: 500, // 15 pts
      joinLatencyMs: 2000,
      behaviorScore: 0.9,
      powSolveTimeMs: 1000,
      penaltyCount: 0,
    };

    const otpResult = evaluateRisk({
      ...baseSignals,
      authMethod: 'otp',
    });

    const googleResult = evaluateRisk({
      ...baseSignals,
      authMethod: 'google',
    });

    // Google discount should strictly lower the risk score
    expect(RISK_CONFIG.authMethod.googleDiscountPoints).toBeGreaterThan(0);
    expect(googleResult.score).toBeLessThan(otpResult.score);
    expect(otpResult.score - googleResult.score).toBe(RISK_CONFIG.authMethod.googleDiscountPoints);
  });

  it('should verify Google ID tokens in demo/test mode and extract claims', async () => {
    process.env.DEMO_MODE = 'true';
    const testToken = 'mock_google_token_testuser123_alice';
    const verified = await verifyGoogleIdToken(testToken);

    expect(verified.sub).toBe('testuser123');
    expect(verified.email).toBe('alice@gmail.com');
    expect(verified.emailVerified).toBe(true);
  });

  it('should issue unified JWT with claim authMethod and fairId', async () => {
    const sessionJwt = await createSessionJwt({
      sub: 'usr_g_1092837465',
      email: 'fan@gmail.com',
      fairId: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      riskTier: 'low',
      authMethod: 'google',
    });

    expect(typeof sessionJwt).toBe('string');

    // Decode and verify the issued JWT
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fairdrop_default_jwt_secret_dev_2026'
    );
    const { payload } = await jwtVerify(sessionJwt, secret);

    expect(payload.sub).toBe('usr_g_1092837465');
    expect(payload.email).toBe('fan@gmail.com');
    expect(payload.authMethod).toBe('google');
    expect(payload.riskTier).toBe('low');
    expect(payload.fairId).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
