import { evaluateRisk, RiskSignals, RiskResult } from './riskEngine';
import { FastifyRequest, FastifyInstance } from 'fastify';

// This function acts as the integration layer for Fastify routes
export async function updateRiskScore(
  fastify: FastifyInstance,
  userId: string,
  partialSignals: Partial<RiskSignals>
): Promise<RiskResult> {
  const redis = fastify.redis;
  const riskKey = `risk:${userId}`;
  const signalsKey = `signals:${userId}`;

  // Default safe baseline signals
  const baseSignals: RiskSignals = {
    requestsPerMin: 0,
    burstiness: 1.0,
    uaAnomaly: false,
    headerOrderHashFamiliarity: 1.0,
    deviceFpReuseCount: 1,
    subnetReuseCount: 1,
    accountAgeSec: 86400 * 30, // 30 days old default
    joinLatencyMs: 2000,
    behaviorScore: 1.0,
    powSolveTimeMs: 1000,
    penaltyCount: 0
  };

  // 1. Fetch current historical signals from Redis (if any)
  const existingSignalsStr = await redis.get(signalsKey);
  let existingSignals: Partial<RiskSignals> = {};
  if (existingSignalsStr) {
    try {
      existingSignals = JSON.parse(existingSignalsStr);
    } catch (e) {
      fastify.log.warn('Failed to parse existing risk signals for user', userId);
    }
  }

  // 2. Merge base, existing, and new partial signals
  const currentSignals = {
    ...baseSignals,
    ...existingSignals,
    ...partialSignals
  };

  // 3. Evaluate the pure risk function
  const result = evaluateRisk(currentSignals);

  // 4. Cache the signals and the result in Redis with 10-minute TTL (600s)
  const pipeline = redis.pipeline();
  pipeline.set(signalsKey, JSON.stringify(currentSignals), 'EX', 600);
  pipeline.hset(riskKey, {
    score: result.score,
    tier: result.tier,
    reasons: JSON.stringify(result.reasons)
  });
  pipeline.expire(riskKey, 600);
  await pipeline.exec();

  return result;
}

export async function getRiskTier(fastify: FastifyInstance, userId: string): Promise<'low' | 'medium' | 'high'> {
  const tier = await fastify.redis.hget(`risk:${userId}`, 'tier');
  if (tier === 'high' || tier === 'medium' || tier === 'low') {
    return tier;
  }
  return 'low'; // Default to low if not found
}
