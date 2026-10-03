import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    // Harden for chaos
    enableOfflineQueue: true,
    maxRetriesPerRequest: null, // Let retryStrategy handle it
    retryStrategy(times) {
      // Exponential backoff with a max of 2 seconds
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect on readonly
      }
      return false;
    }
  });

  fastify.decorate('redis', redis);
  
  fastify.addHook('onClose', async (instance, done) => {
    await redis.quit();
    done();
  });
};

export default fp(redisPlugin);
