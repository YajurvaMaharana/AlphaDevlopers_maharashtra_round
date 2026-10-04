import { FastifyPluginAsync } from 'fastify';
import { getAllClusters, DEFAULT_CLUSTER_CONFIG } from '../services/clusterDetector';

export const adminClustersRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/clusters', async (request, reply) => {
    const query = (request.query || {}) as Record<string, string>;
    const windowSec = parseInt(query.windowSec || String(DEFAULT_CLUSTER_CONFIG.windowSec), 10);
    const threshold = parseInt(query.threshold || String(DEFAULT_CLUSTER_CONFIG.clusterSizeThreshold), 10);

    const clusters = await getAllClusters(fastify.redis, windowSec);
    const suspiciousClusters = clusters.filter((c) => c.isSuspicious);

    return reply.status(200).send({
      success: true,
      defensesEnabled: fastify.defensesEnabled !== false,
      timestamp: Date.now(),
      threshold,
      windowSec,
      activeClustersCount: clusters.length,
      suspiciousClustersCount: suspiciousClusters.length,
      clusters,
    });
  });
};

export default adminClustersRoute;
