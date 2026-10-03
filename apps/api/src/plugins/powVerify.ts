import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const powVerifyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    // Only apply to protected routes
    const path = request.routerPath || request.url;
    if (path.includes('/drop/join') || path.includes('/checkout/reserve')) {
      const defensesEnabled = fastify.defensesEnabled !== false;
      if (!defensesEnabled) return;

      const passToken = request.headers['x-pow-pass'] as string;
      if (!passToken) {
        return reply.status(403).send({ error: 'Missing X-Pow-Pass header' });
      }

      const userId = (request.headers['x-user-id'] as string) || 'anonymous';
      
      // We expect the frontend to pass the route it solved for. 
      // If we strictly match exact path, we must be careful with trailing slashes.
      // Easiest is to check multiple possible keys if we aren't sure, but here we just check the exact route.
      // Let's assume the frontend requests a challenge for the exact path.
      let route = path;
      // Strip query strings if present
      if (route.indexOf('?') > -1) {
        route = route.substring(0, route.indexOf('?'));
      }

      const passKey = `pow:pass:${userId}:${route}`;
      const savedToken = await fastify.redis.get(passKey);

      if (!savedToken || savedToken !== passToken) {
        return reply.status(403).send({ error: 'Invalid or expired PoW pass token' });
      }

      // Single-use: delete token
      await fastify.redis.del(passKey);
    }
  });
};

export default fp(powVerifyPlugin);
