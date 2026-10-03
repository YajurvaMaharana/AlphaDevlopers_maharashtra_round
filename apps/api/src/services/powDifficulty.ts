import { FastifyInstance } from 'fastify';
import { getRiskTier } from './riskIntegration';

// F6: Proof of Work Difficulty scaler
// The tier determines the computational complexity required by the client
export async function determinePowDifficulty(fastify: FastifyInstance, userId: string): Promise<number> {
  const tier = await getRiskTier(fastify, userId);
  
  // Base difficulty is usually a number of leading zero bits required in the hash
  switch (tier) {
    case 'high':
      return 24;
    case 'medium':
      return 20;
    case 'low':
    default:
      return 16;
  }
}
