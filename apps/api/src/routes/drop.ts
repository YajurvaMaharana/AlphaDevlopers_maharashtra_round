import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { DropJoinOutputSchema } from '../../../../packages/shared/drop';
import { z } from 'zod';

export async function dropRoutes(fastify: FastifyInstance) {

  // POST /join (Auth required)
  fastify.post('/join', { preHandler: [(fastify as any).verifyJwt] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    const state = await redis.hget('drop:state', 'status');
    if (!state || state === 'SCHEDULED' || state === 'CLOSED') {
      return reply.code(400).send({ error: 'Drop is not active' });
    }

    const ticketId = `ticket-${user.sub}`;
    const pipeline = redis.pipeline();
    
    pipeline.hset('drop:user:tier', user.sub, user.tier || 'normal');

    if (state === 'JOIN_WINDOW') {
      pipeline.zadd('drop:joiners:window', Date.now(), user.sub);
      await pipeline.exec();
    } else {
      // Late joiners
      const rank = await redis.incr('drop:max_rank');
      pipeline.rpush('drop:queue', user.sub);
      pipeline.zadd('drop:positions', rank, user.sub);
      await pipeline.exec();
    }

    return reply.send({ ticketId });
  });

  // GET /status
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const state = await redis.hgetall('drop:state');
    return reply.send(state);
  });

  // GET /stream (Auth required)
  fastify.get('/stream', { preHandler: [(fastify as any).verifyJwt] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    const lastEventId = request.headers['last-event-id'];
    let eventId = lastEventId ? parseInt(lastEventId as string, 10) : 0;

    const sendEvent = async () => {
      const stateData = await redis.hgetall('drop:state');
      const admittedToken = await redis.get(`admit_token:${user.sub}`);
      
      const admitted = !!admittedToken;
      let position: number | null = null;
      let etaSec: number | null = null;

      const posStr = await redis.zscore('drop:positions', user.sub);
      if (posStr) {
        const globalPos = parseFloat(posStr);
        const admittedCount = parseInt(stateData.admitted_count || '0', 10);
        position = Math.floor(globalPos); // absolute rank for correlation testing
        if (!admitted) {
          const relativePos = Math.max(1, position - admittedCount);
          etaSec = Math.ceil(relativePos / 100); // 200 per 2 sec = 100 per sec
        } else {
          etaSec = 0;
        }
      }

      const payload = {
        state: stateData.status || 'SCHEDULED',
        position,
        etaSec,
        admitted,
        total: parseInt(stateData.admitted_count || '0', 10) // total could be admitted_count or total queue size, just sending admitted
      };

      eventId++;
      reply.raw.write(`id: ${eventId}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Send immediately
    await sendEvent();

    // Subscribe to drop:events
    const subscriber = redis.duplicate();
    await subscriber.subscribe('drop:events');
    
    subscriber.on('message', async (channel, message) => {
      if (channel === 'drop:events') {
        await sendEvent();
      }
    });

    // Also poll every 3 seconds just in case
    const interval = setInterval(sendEvent, 3000);

    request.raw.on('close', () => {
      clearInterval(interval);
      subscriber.quit();
    });
  });
}
