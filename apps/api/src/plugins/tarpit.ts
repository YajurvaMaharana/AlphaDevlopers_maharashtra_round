import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getRiskTier } from '../services/riskIntegration';

// F4: Tarpit plugin
// Delays the response for high risk users
const tarpitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // We assume request.user or similar is populated, extracting userId for this example
    const userId = (request.headers['x-user-id'] as string) || 'anonymous';
    
    // Read the tier from the risk module integration
    const tier = await getRiskTier(fastify, userId);
    
    if (tier === 'high') {
      fastify.log.info(`Tarpit engaged for user ${userId} (high risk)`);
      // Introduce an artificial delay (tarpit) for high risk users (e.g. 5 seconds)
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else if (tier === 'medium') {
      // Small delay for medium risk
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });
};

export default fp(tarpitPlugin);
