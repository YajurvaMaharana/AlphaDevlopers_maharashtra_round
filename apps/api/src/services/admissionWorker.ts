import { FastifyInstance } from 'fastify';
import { getRiskTier } from './riskIntegration';

// F2: Admission Worker
// Decides if a user should be admitted from the waiting room to the checkout phase.
export async function admitUser(fastify: FastifyInstance, userId: string): Promise<boolean> {
  const tier = await getRiskTier(fastify, userId);

  fastify.log.info(`Evaluating admission for user ${userId} with risk tier ${tier}`);

  // High risk users are heavily deprioritized or blocked from admission
  if (tier === 'high') {
    // 90% chance to drop them or keep them in the waiting room
    if (Math.random() > 0.1) {
      return false; 
    }
  } else if (tier === 'medium') {
    // 50% chance to admit medium risk users
    if (Math.random() > 0.5) {
      return false;
    }
  }

  // Low risk users are admitted normally
  return true;
}
