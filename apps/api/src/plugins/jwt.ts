import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
import { env } from '../env';

export interface UserPayload {
  sub: string;
  fp: string;
  tier: string;
  regAt: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPayload;
  }
}

export const jwtVerifyPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate('verifyJwt', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Missing or invalid authorization header' });
        return;
      }
      
      const token = authHeader.substring(7);
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      
      const { payload } = await jwtVerify(token, secret);
      request.user = payload as unknown as UserPayload;
    } catch (err) {
      reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
});
