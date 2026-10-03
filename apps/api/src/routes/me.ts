import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';

export async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/state', { preHandler: [(fastify as any).verifyJwt] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    // Single Redis pipeline call returning full user status
    const pipeline = redis.pipeline();
    
    pipeline.hget('drop:state', 'status');
    pipeline.zrank('drop:positions', user.sub);
    pipeline.hget(`hold:user:${user.sub}`, 'qty');
    pipeline.get(`admit_token:${user.sub}`);
    
    const results = await pipeline.exec();
    if (!results) {
      return reply.code(500).send({ error: 'Pipeline failed' });
    }

    const state = results[0][1] as string || 'SCHEDULED';
    const queuePositionStr = results[1][1];
    const queuePosition = queuePositionStr !== null ? parseInt(queuePositionStr as string, 10) + 1 : null;
    const holdQty = parseInt((results[2][1] as string) || '0', 10);
    const hasAdmitToken = results[3][1] === '1';

    return reply.send({
      step: state,
      queuePosition: queuePosition,
      holdQty: holdQty,
      hasAdmitToken,
      tier: user.tier
    });
  });
}
