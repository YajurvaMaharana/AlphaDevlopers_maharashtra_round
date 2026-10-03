export interface RiskSignals {
  requestsPerMin: number;
  burstiness: number; // coefficient of variation (stddev/mean) of inter-arrival times
  uaAnomaly: boolean;
  headerOrderHashFamiliarity: number; // 0 (unknown/weird) to 1 (very common)
  deviceFpReuseCount: number;
  subnetReuseCount: number;
  accountAgeSec: number;
  joinLatencyMs: number; // time from page load to join click
  behaviorScore: number; // 0 (bot-like) to 1 (human-like)
  powSolveTimeMs: number; 
  penaltyCount: number;
}

export interface RiskResult {
  score: number;
  tier: 'low' | 'medium' | 'high';
  reasons: string[];
}

// Configurable weights and thresholds for calculating risk (0 = safe, 100+ = risky)
// We cap the total score at 100.
const RISK_CONFIG = {
  requestsPerMin: { base: 10, weight: 0.5, max: 25 }, // e.g. 60 req/min -> 25 points
  burstiness: { threshold: 0.2, points: 15 }, // Very regular timing (low CV) = bot
  uaAnomaly: { points: 15 },
  headerOrderHashFamiliarity: { threshold: 0.3, points: 10 }, // Weird headers = bot
  deviceFpReuseCount: { base: 2, weight: 10, max: 30 }, // High reuse = bot
  subnetReuseCount: { base: 10, weight: 2, max: 20 }, // High reuse = bot
  accountAgeSec: { threshold: 3600, points: 15 }, // < 1 hr old = risky
  joinLatencyMs: { threshold: 500, points: 20 }, // superhuman reaction < 500ms
  behaviorScore: { threshold: 0.3, points: 20 }, // Low behavior score = bot
  powSolveTimeMs: { threshold: 100, points: 15 }, // Super fast PoW = bot
  penaltyCount: { weight: 20, max: 40 }, // High penalty = bot
};

export function evaluateRisk(signals: RiskSignals): RiskResult {
  const contributions: { reason: string; points: number }[] = [];

  // 1. requestsPerMin
  if (signals.requestsPerMin > RISK_CONFIG.requestsPerMin.base) {
    const points = Math.min(
      RISK_CONFIG.requestsPerMin.max,
      (signals.requestsPerMin - RISK_CONFIG.requestsPerMin.base) * RISK_CONFIG.requestsPerMin.weight
    );
    if (points > 0) contributions.push({ reason: 'High request rate', points });
  }

  // 2. burstiness
  if (signals.burstiness >= 0 && signals.burstiness < RISK_CONFIG.burstiness.threshold) {
    contributions.push({ reason: 'Highly regular request timing', points: RISK_CONFIG.burstiness.points });
  }

  // 3. uaAnomaly
  if (signals.uaAnomaly) {
    contributions.push({ reason: 'Anomalous User-Agent', points: RISK_CONFIG.uaAnomaly.points });
  }

  // 4. headerOrderHashFamiliarity
  if (signals.headerOrderHashFamiliarity < RISK_CONFIG.headerOrderHashFamiliarity.threshold) {
    contributions.push({ reason: 'Unusual HTTP header order', points: RISK_CONFIG.headerOrderHashFamiliarity.points });
  }

  // 5. deviceFpReuseCount
  if (signals.deviceFpReuseCount > RISK_CONFIG.deviceFpReuseCount.base) {
    const points = Math.min(
      RISK_CONFIG.deviceFpReuseCount.max,
      (signals.deviceFpReuseCount - RISK_CONFIG.deviceFpReuseCount.base) * RISK_CONFIG.deviceFpReuseCount.weight
    );
    if (points > 0) contributions.push({ reason: 'High device fingerprint reuse', points });
  }

  // 6. subnetReuseCount
  if (signals.subnetReuseCount > RISK_CONFIG.subnetReuseCount.base) {
    const points = Math.min(
      RISK_CONFIG.subnetReuseCount.max,
      (signals.subnetReuseCount - RISK_CONFIG.subnetReuseCount.base) * RISK_CONFIG.subnetReuseCount.weight
    );
    if (points > 0) contributions.push({ reason: 'High IP subnet reuse', points });
  }

  // 7. accountAgeSec
  if (signals.accountAgeSec < RISK_CONFIG.accountAgeSec.threshold) {
    contributions.push({ reason: 'Newly created account', points: RISK_CONFIG.accountAgeSec.points });
  }

  // 8. joinLatencyMs
  if (signals.joinLatencyMs > 0 && signals.joinLatencyMs < RISK_CONFIG.joinLatencyMs.threshold) {
    contributions.push({ reason: 'Superhuman join reaction time', points: RISK_CONFIG.joinLatencyMs.points });
  }

  // 9. behaviorScore
  if (signals.behaviorScore < RISK_CONFIG.behaviorScore.threshold) {
    contributions.push({ reason: 'Bot-like client behavior', points: RISK_CONFIG.behaviorScore.points });
  }

  // 10. powSolveTimeMs
  if (signals.powSolveTimeMs > 0 && signals.powSolveTimeMs < RISK_CONFIG.powSolveTimeMs.threshold) {
    contributions.push({ reason: 'Suspiciously fast PoW solution', points: RISK_CONFIG.powSolveTimeMs.points });
  }

  // 11. penaltyCount
  if (signals.penaltyCount > 0) {
    const points = Math.min(
      RISK_CONFIG.penaltyCount.max,
      signals.penaltyCount * RISK_CONFIG.penaltyCount.weight
    );
    contributions.push({ reason: 'Prior abuse penalties', points });
  }

  // Sum points and cap at 100
  let totalScore = contributions.reduce((sum, c) => sum + c.points, 0);
  totalScore = Math.min(100, Math.round(totalScore));

  // Determine tier
  let tier: 'low' | 'medium' | 'high' = 'low';
  if (totalScore >= 70) tier = 'high';
  else if (totalScore >= 30) tier = 'medium';

  // Get top 3 reasons
  contributions.sort((a, b) => b.points - a.points);
  const reasons = contributions.slice(0, 3).map((c) => c.reason);
  
  // Pad reasons to always have length 3 if we need exact string[3] format? 
  // Requirements: "reasons: string[3] where reasons name the top 3 contributing signals"
  // It's fine to just return an array of up to 3 strings.

  return {
    score: totalScore,
    tier,
    reasons
  };
}
