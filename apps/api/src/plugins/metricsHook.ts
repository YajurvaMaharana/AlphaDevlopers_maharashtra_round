import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { recordRequestMetrics } from '../services/metricsCollector';

const metricsHookPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    // Ignore metrics endpoint to avoid infinite feedback loops
    if (request.routerPath === '/metrics/stream') return;
    
    const responseTime = reply.elapsedTime;
    await recordRequestMetrics(fastify, request, responseTime, reply.statusCode);
  });
};

export default fp(metricsHookPlugin);
