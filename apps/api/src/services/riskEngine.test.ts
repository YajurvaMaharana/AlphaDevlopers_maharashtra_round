import { describe, it, expect } from 'vitest';
import { evaluateRisk, RiskSignals } from './riskEngine';

describe('Risk Scoring Engine', () => {
  const baseSafeSignals: RiskSignals = {
    requestsPerMin: 5,
    burstiness: 1.5, // human-like variance
    uaAnomaly: false,
    headerOrderHashFamiliarity: 0.9,
    deviceFpReuseCount: 1,
    subnetReuseCount: 1,
    accountAgeSec: 86400 * 30, // 30 days
    joinLatencyMs: 2500, // 2.5s
    behaviorScore: 0.9,
    powSolveTimeMs: 1500,
    penaltyCount: 0,
  };

  const testCases: { name: string; signals: Partial<RiskSignals>; expectedTier: 'low' | 'medium' | 'high' }[] = [
    {
      name: 'Safe human user',
      signals: {}, // uses baseSafeSignals
      expectedTier: 'low',
    },
    {
      name: 'Slightly elevated requests but normal otherwise',
      signals: { requestsPerMin: 20 }, // (20-10)*0.5 = 5 points -> low (score < 30)
      expectedTier: 'low',
    },
    {
      name: 'New account (medium risk)',
      signals: { accountAgeSec: 500 }, // 15 points
      expectedTier: 'low', // 15 < 30
    },
    {
      name: 'New account with fast join (medium risk)',
      signals: { accountAgeSec: 500, joinLatencyMs: 300 }, // 15 + 20 = 35 points -> medium
      expectedTier: 'medium',
    },
    {
      name: 'Anomalous UA + weird headers (medium risk)',
      signals: { uaAnomaly: true, headerOrderHashFamiliarity: 0.1 }, // 15 + 10 = 25 points -> low
      expectedTier: 'low',
    },
    {
      name: 'Highly regular timing + weird headers (medium risk)',
      signals: { burstiness: 0.05, headerOrderHashFamiliarity: 0.1, uaAnomaly: true }, // 15 + 10 + 15 = 40 points -> medium
      expectedTier: 'medium',
    },
    {
      name: 'High device and subnet reuse (medium/high risk)',
      signals: { deviceFpReuseCount: 4, subnetReuseCount: 20 }, // (4-2)*10=20, min(20, (20-10)*2)=20 -> 40 points -> medium
      expectedTier: 'medium',
    },
    {
      name: 'Obvious botnet node (high risk)',
      signals: {
        uaAnomaly: true, // 15
        deviceFpReuseCount: 5, // 30
        behaviorScore: 0.1, // 20
        powSolveTimeMs: 50, // 15
      }, // 15 + 30 + 20 + 15 = 80 -> high
      expectedTier: 'high',
    },
    {
      name: 'DDoS flooding (high risk)',
      signals: {
        requestsPerMin: 120, // 25 (maxed out)
        burstiness: 0.01, // 15
        penaltyCount: 3, // min(40, 3*20)=40
      }, // 25 + 15 + 40 = 80 -> high
      expectedTier: 'high',
    },
    {
      name: 'Superhuman sniper script (high risk)',
      signals: {
        joinLatencyMs: 100, // 20
        behaviorScore: 0.05, // 20
        powSolveTimeMs: 10, // 15
        accountAgeSec: 10, // 15
      }, // 20 + 20 + 15 + 15 = 70 -> high
      expectedTier: 'high',
    },
    {
      name: 'User with many penalties',
      signals: {
        penaltyCount: 5, // 40 (maxed)
      }, // 40 points -> medium
      expectedTier: 'medium',
    },
    {
      name: 'All maximum penalties (score capped at 100)',
      signals: {
        requestsPerMin: 1000, // 25
        burstiness: 0, // 15
        uaAnomaly: true, // 15
        headerOrderHashFamiliarity: 0, // 10
        deviceFpReuseCount: 100, // 30
        subnetReuseCount: 100, // 20
        accountAgeSec: 0, // 15
        joinLatencyMs: 1, // 20
        behaviorScore: 0, // 20
        powSolveTimeMs: 1, // 15
        penaltyCount: 100, // 40
      }, // 225 raw points -> capped at 100 -> high
      expectedTier: 'high',
    }
  ];

  testCases.forEach((tc, idx) => {
    it(`Test Case ${idx + 1}: ${tc.name}`, () => {
      const input = { ...baseSafeSignals, ...tc.signals };
      const result = evaluateRisk(input);
      
      expect(result.tier).toBe(tc.expectedTier);
      
      if (tc.expectedTier === 'high') {
        expect(result.score).toBeGreaterThanOrEqual(70);
      } else if (tc.expectedTier === 'medium') {
        expect(result.score).toBeGreaterThanOrEqual(30);
        expect(result.score).toBeLessThan(70);
      } else {
        expect(result.score).toBeLessThan(30);
      }

      // Check reasons format
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.reasons.length).toBeLessThanOrEqual(3);
    });
  });
});
