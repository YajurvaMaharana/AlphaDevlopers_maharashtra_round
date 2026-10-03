import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const gracefulShutdownPlugin: FastifyPluginAsync = async (fastify) => {
  // Fastify handles graceful shutdown out of the box when closing.
  // We just need to catch SIGTERM and SIGINT and trigger close.
  const closeSignals = ['SIGINT', 'SIGTERM'];
  
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      fastify.log.warn(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await fastify.close();
        fastify.log.info('Graceful shutdown completed. Process will exit.');
        process.exit(0);
      } catch (err) {
        fastify.log.error(`Error during graceful shutdown: ${err}`);
        process.exit(1);
      }
    });
  }
};

export default fp(gracefulShutdownPlugin);
