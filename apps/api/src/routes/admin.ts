import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { AdminDropStartInputSchema } from '../../../../packages/shared/admin';

export async function adminRoutes(fastify: FastifyInstance) {
  
  // POST /drop/start
  fastify.post('/drop/start', async (request: FastifyRequest, reply: FastifyReply) => {
    // Admin auth could be added here, but skipping for demo simplicity
    const parsed = AdminDropStartInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error });
    }
    
    const { inventory, windowSec } = parsed.data;
    
    const pipeline = redis.pipeline();
    pipeline.hset('drop:state', 'status', 'JOIN_WINDOW');
    pipeline.hset('drop:state', 'inventory', inventory);
    pipeline.hset('drop:state', 'window_closes_at', Date.now() + (windowSec * 1000));
    pipeline.hset('drop:state', 'admitted_count', 0);
    
    // Clear old data
    pipeline.del('drop:joiners:window');
    pipeline.del('drop:queue');
    pipeline.del('drop:positions');
    
    await pipeline.exec();
    
    redis.publish('drop:events', JSON.stringify({ event: 'started' }));
    
    return reply.send({ success: true, windowSec, inventory });
  });

  // POST /drop/reset
  fastify.post('/drop/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const pipeline = redis.pipeline();
    pipeline.hset('drop:state', 'status', 'SCHEDULED');
    pipeline.hset('drop:state', 'inventory', 0);
    pipeline.hset('drop:state', 'admitted_count', 0);
    pipeline.del('drop:joiners:window');
    pipeline.del('drop:queue');
    pipeline.del('drop:positions');
    await pipeline.exec();
    
    redis.publish('drop:events', JSON.stringify({ event: 'reset' }));
    
    return reply.send({ success: true });
  });
}
