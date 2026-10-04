import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { runClusterDetectionCycle, DEFAULT_CLUSTER_CONFIG } from '../services/clusterDetector';

const clusterDetectorPlugin: FastifyPluginAsync = async (fastify) => {
  // Only run background interval when server is running in dev / production
  if (process.env.NODE_ENV !== 'test') {
    const intervalId = setInterval(async () => {
      try {
        await runClusterDetectionCycle(fastify, DEFAULT_CLUSTER_CONFIG);
      } catch (err: any) {
        fastify.log.warn(`Cluster detector cycle error: ${err?.message}`);
      }
    }, DEFAULT_CLUSTER_CONFIG.checkIntervalMs);

    fastify.addHook('onClose', async () => {
      clearInterval(intervalId);
    });
  }
};

export default fp(clusterDetectorPlugin);
