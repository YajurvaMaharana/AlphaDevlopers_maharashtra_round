import { FastifyPluginAsync } from 'fastify';
import { evaluateRisk, RiskResult } from '../services/riskEngine';

const adminRiskRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { userId: string } }>('/admin/risk/:userId', async (request, reply) => {
    const { userId } = request.params;
    const riskKey = `risk:${userId}`;
    const signalsKey = `signals:${userId}`;

    // Try to get from cache first
    const riskData = await fastify.redis.hgetall(riskKey);
    
    if (riskData && riskData.score && riskData.tier) {
      let reasons: string[] = [];
      try {
        reasons = JSON.parse(riskData.reasons);
      } catch (e) {
        // Ignore JSON parse error for reasons
      }
      return reply.send({
        score: parseInt(riskData.score, 10),
        tier: riskData.tier,
        reasons
      });
    }

    // If not in cache, try to recalculate from saved signals
    const signalsStr = await fastify.redis.get(signalsKey);
    if (!signalsStr) {
      return reply.status(404).send({ error: 'Risk profile not found for user' });
    }

    try {
      const signals = JSON.parse(signalsStr);
      const result = evaluateRisk(signals);
      return reply.send(result);
    } catch (e) {
      return reply.status(500).send({ error: 'Failed to process risk profile' });
    }
  });
};

export default adminRiskRoute;
