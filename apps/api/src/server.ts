import Fastify, { FastifyInstance } from 'fastify';
import redisPlugin from './plugins/redisClient';
import tarpitPlugin from './plugins/tarpit';
import metricsHook from './plugins/metricsHook';
import gracefulShutdown from './plugins/gracefulShutdown';
import clusterDetectorPlugin from './plugins/clusterDetectorJob';
import authRoutes from './routes/auth';
import dropRoutes from './routes/drop';
import powRoutes from './routes/pow';
import adminRiskRoute from './routes/adminRisk';
import adminClustersRoute from './routes/adminClusters';
import botlabRoutes from './routes/botlab';
import chaosRoutes from './routes/chaos';
import metricsStreamRoutes from './routes/metricsStream';
import { initPostgres } from './db/postgres';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
    disableRequestLogging: process.env.NODE_ENV === 'test',
  });

  // Global defenses state
  fastify.defensesEnabled = process.env.DEFENSES_ENABLED !== 'false';

  // Core database initialization
  await initPostgres().catch((err) => {
    fastify.log.warn(`Postgres initialization warning: ${err.message}`);
  });

  // Register plugins
  await fastify.register(redisPlugin);
  await fastify.register(metricsHook);
  await fastify.register(tarpitPlugin);
  await fastify.register(gracefulShutdown);
  await fastify.register(clusterDetectorPlugin);

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(dropRoutes);
  await fastify.register(powRoutes);
  await fastify.register(adminRiskRoute);
  await fastify.register(adminClustersRoute);
  await fastify.register(botlabRoutes);
  await fastify.register(chaosRoutes);
  await fastify.register(metricsStreamRoutes);

  // Health check endpoint
  fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  return fastify;
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  buildApp()
    .then((app) => {
      app.listen({ port, host }, (err, address) => {
        if (err) {
          app.log.error(err);
          process.exit(1);
        }
        app.log.info(`FairDrop Fastify API listening on ${address}`);
      });
    })
    .catch((err) => {
      console.error('Fatal error starting server:', err);
      process.exit(1);
    });
}
