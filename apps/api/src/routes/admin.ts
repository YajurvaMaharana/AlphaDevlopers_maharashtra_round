import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { pool } from '../db';
import { AdminDropStartInputSchema } from '../../../../packages/shared/admin';
import { flushDefensesCache } from '../plugins/abuseGuard';
import { getOperationalMetrics } from '../services/metrics';

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

  fastify.post('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, string>;
    const pipeline = redis.pipeline();
    for (const [key, value] of Object.entries(body)) {
      pipeline.hset('admin:config', key, value);
      if (key === 'initial_inventory') {
        pipeline.set('inv:available', value);
      }
    }
    await pipeline.exec();
    return reply.send({ success: true });
  });

  fastify.get('/invariants', async (request: FastifyRequest, reply: FastifyReply) => {
    const violations = [];
    
    const initialInvStr = await redis.hget('admin:config', 'initial_inventory') || '500';
    const initialInv = parseInt(initialInvStr, 10);
    
    const availableStr = await redis.get('inv:available');
    const available = availableStr ? parseInt(availableStr, 10) : 0;
    
    const keys = await redis.keys('hold_data:*');
    let heldQty = 0;
    if (keys.length > 0) {
      const holds = await Promise.all(keys.map(k => redis.hget(k, 'qty')));
      const statuses = await Promise.all(keys.map(k => redis.hget(k, 'status')));
      heldQty = holds.reduce((acc, val, idx) => {
        if (statuses[idx] === 'COMMITTED') return acc;
        return acc + parseInt(val || '0', 10);
      }, 0);
    }
    
    const client = await pool.connect();
    let soldQty = 0;
    try {
      const res = await client.query("SELECT COALESCE(SUM(qty), 0) as total FROM allocations WHERE status = 'COMMITTED'");
      soldQty = parseInt(res.rows[0].total, 10);
      
      const duplicateCommits = await client.query("SELECT user_id, round_id, COUNT(*) FROM allocations WHERE status = 'COMMITTED' GROUP BY user_id, round_id HAVING COUNT(*) > 1");
      if (duplicateCommits.rows.length > 0) {
        violations.push({ type: 'DUPLICATE_COMMITS', details: duplicateCommits.rows });
      }

      const userCommits = await client.query("SELECT user_id, SUM(qty) as total FROM allocations WHERE status = 'COMMITTED' GROUP BY user_id HAVING SUM(qty) > 2");
      if (userCommits.rows.length > 0) {
         violations.push({ type: 'USER_LIMIT_EXCEEDED_PG', details: userCommits.rows });
      }
    } finally {
      client.release();
    }
    
    const userHoldKeys = await redis.keys('hold:user:*');
    if (userHoldKeys.length > 0) {
       for (const key of userHoldKeys) {
          const qty = await redis.hget(key, 'qty');
          if (qty && parseInt(qty, 10) > 2) {
             violations.push({ type: 'USER_LIMIT_EXCEEDED_REDIS', key, qty });
          }
       }
    }

    if (soldQty + heldQty + available !== initialInv) {
      violations.push({ type: 'INVENTORY_MISMATCH', soldQty, heldQty, available, expected: initialInv });
    }

    return reply.send({ violations, soldQty, heldQty, available, initialInv });
  });

  fastify.post('/defenses', async (request: FastifyRequest, reply: FastifyReply) => {
    const { on } = request.body as { on: boolean };
    await redis.set('defenses:enabled', on ? 'true' : 'false');
    flushDefensesCache();
    return reply.send({ success: true, defensesEnabled: on });
  });

  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await getOperationalMetrics();
    return reply.send(metrics);
  });
}
