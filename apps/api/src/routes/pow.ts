import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { determinePowDifficulty } from '../services/powDifficulty';

const powRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { route: string } }>('/pow/challenge', async (request, reply) => {
    const userId = (request.headers['x-user-id'] as string) || 'anonymous';
    const { route } = request.body || { route: '/drop/join' };
    
    // Check defenses kill-switch (assuming fastify.defensesEnabled is globally available or defaulting to true)
    // If we can't find it, we assume true.
    const defensesEnabled = fastify.defensesEnabled !== false;

    let difficultyBits = 0;
    if (defensesEnabled) {
      difficultyBits = await determinePowDifficulty(fastify, userId);
    }

    const challengeId = crypto.randomUUID();
    const prefix = crypto.randomBytes(16).toString('hex');
    const createdAt = Date.now();

    // Store challenge in Redis, TTL 60s
    await fastify.redis.hset(`pow:challenge:${challengeId}`, {
      prefix,
      difficultyBits,
      userId,
      route,
      createdAt
    });
    await fastify.redis.expire(`pow:challenge:${challengeId}`, 60);

    return reply.send({ challengeId, prefix, difficultyBits });
  });

  fastify.post<{ Body: { challengeId: string; nonce: string } }>('/pow/solve', async (request, reply) => {
    const { challengeId, nonce } = request.body;
    
    if (!challengeId || !nonce) {
      return reply.status(400).send({ error: 'Missing challengeId or nonce' });
    }

    const challengeKey = `pow:challenge:${challengeId}`;
    const challenge = await fastify.redis.hgetall(challengeKey);

    if (!challenge || !challenge.prefix) {
      return reply.status(400).send({ error: 'Invalid or expired challenge' });
    }

    // Single-use: delete immediately
    await fastify.redis.del(challengeKey);

    const { prefix, difficultyBits, userId, route, createdAt } = challenge;
    const bits = parseInt(difficultyBits, 10);

    // Verify hash if defenses enabled and bits > 0
    if (bits > 0) {
      const hash = crypto.createHash('sha256').update(prefix + nonce).digest();
      if (!checkLeadingZeroBits(hash, bits)) {
        return reply.status(403).send({ error: 'Invalid PoW solution' });
      }
    }

    const solveTimeMs = Date.now() - parseInt(createdAt, 10);
    
    // Record solve time as risk signal
    // Fire-and-forget updating the signal
    const signalsKey = `signals:${userId}`;
    fastify.redis.get(signalsKey).then(existingStr => {
      const existing = existingStr ? JSON.parse(existingStr) : {};
      existing.powSolveTimeMs = solveTimeMs;
      fastify.redis.set(signalsKey, JSON.stringify(existing), 'EX', 600);
    }).catch(err => fastify.log.error(err));

    // Generate short-lived pass token
    const passToken = crypto.randomUUID();
    const passKey = `pow:pass:${userId}:${route}`;
    await fastify.redis.set(passKey, passToken, 'EX', 60);

    return reply.send({ passToken, solveTimeMs });
  });
};

function checkLeadingZeroBits(hash: Buffer, bits: number): boolean {
  let remainingBits = bits;
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i];
    if (remainingBits >= 8) {
      if (byte !== 0) return false;
      remainingBits -= 8;
    } else {
      const shift = 8 - remainingBits;
      return (byte >> shift) === 0;
    }
    if (remainingBits === 0) break;
  }
  return true;
}

export default powRoutes;
