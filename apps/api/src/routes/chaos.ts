import { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';

export const chaosRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { action: string } }>('/admin/chaos', async (request, reply) => {
    const { action } = request.body || {};
    
    fastify.log.warn(`Chaos injected: ${action}`);

    switch (action) {
      case 'kill_api_replica':
        reply.send({ success: true, message: 'Replica dying in 500ms...' });
        setTimeout(() => {
          process.exit(1);
        }, 500);
        return;
        
      case 'restart_redis':
        // Assuming we are in docker, a host script or sidecar handles the restart.
        // For local demo, we just attempt to restart the local docker container for redis
        reply.send({ success: true, message: 'Attempting to restart redis via host docker...' });
        exec('docker restart fairdrop-redis', (error, stdout, stderr) => {
          if (error) fastify.log.error(`Redis restart failed: ${error}`);
        });
        return;
        
      case 'slow_postgres':
        await fastify.redis.set('chaos:slow_postgres', 'true', 'EX', 30); // expires in 30s
        return reply.send({ success: true, message: 'Postgres writes slowed by 3s for 30s' });
        
      case 'payment_outage':
        await fastify.redis.set('chaos:payment_outage', 'true', 'EX', 30);
        return reply.send({ success: true, message: '100% payment failures for 30s' });
        
      default:
        return reply.status(400).send({ error: 'Unknown chaos action' });
    }
  });

  fastify.post<{ Body: { enabled: boolean } }>('/admin/defenses', async (request, reply) => {
    const { enabled } = request.body;
    fastify.defensesEnabled = enabled;
    fastify.log.warn(`Defenses toggled: ${enabled ? 'ON' : 'OFF'}`);
    return reply.send({ success: true, defensesEnabled: enabled });
  });
};

export default chaosRoutes;
