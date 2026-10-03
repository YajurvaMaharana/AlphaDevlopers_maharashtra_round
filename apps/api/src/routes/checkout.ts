import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { pool } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export async function checkoutRoutes(fastify: FastifyInstance) {
  
  fastify.post('/reserve', { preHandler: [(fastify as any).verifyJwt] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const idempotencyKey = request.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      return reply.code(400).send({ error: 'Missing Idempotency-Key header' });
    }

    const { qty } = request.body as { qty: number };
    if (!qty || qty < 1 || qty > 2) {
      return reply.code(400).send({ error: 'Invalid qty' });
    }

    // Check idempotency cache in Redis
    const cacheKey = `idem:reserve:${user.sub}:${idempotencyKey}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const holdId = uuidv4();
    const ttlSec = 60; // 60s hold

    const res = await redis.reserveHold(
      'inv:available',
      'drop:state',
      `admit_token:${user.sub}`,
      `hold:user:${user.sub}`,
      'hold:expiries',
      user.sub,
      qty,
      holdId,
      ttlSec,
      Date.now()
    );

    if (typeof res !== 'string' && res && (res as any).err) {
      return reply.code(400).send({ error: (res as any).err });
    }

    const output = { holdId, expiresAt: Date.now() + (ttlSec * 1000) };
    
    // Cache the response
    await redis.set(cacheKey, JSON.stringify(output), 'EX', 86400);

    return reply.send(output);
  });

  fastify.post('/pay', { preHandler: [(fastify as any).verifyJwt] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const idempotencyKey = request.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      return reply.code(400).send({ error: 'Missing Idempotency-Key header' });
    }

    const { holdId } = request.body as { holdId: string };
    if (!holdId) {
      return reply.code(400).send({ error: 'Missing holdId' });
    }

    // Check idempotency cache in Redis
    const cacheKey = `idem:pay:${user.sub}:${idempotencyKey}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    // MockPaymentGateway configuration
    const latencyStr = await redis.hget('admin:config', 'payment_latency_ms');
    const failureRateStr = await redis.hget('admin:config', 'payment_failure_rate');
    
    const latency = latencyStr ? parseInt(latencyStr, 10) : 50;
    const failureRate = failureRateStr ? parseFloat(failureRateStr) : 0;

    await new Promise(r => setTimeout(r, latency));

    if (Math.random() < failureRate) {
      // Payment failed -> release hold
      await redis.releaseHold(
        'inv:available',
        `hold:user:${user.sub}`,
        'hold:expiries',
        holdId
      );
      return reply.code(402).send({ error: 'Payment failed' });
    }

    // Payment succeeded!
    const roundId = 1;
    let allocationId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const qtyStr = await redis.hget(`hold_data:${holdId}`, 'qty');
      const holdStatus = await redis.hget(`hold_data:${holdId}`, 'status');
      
      if (!qtyStr) {
        throw new Error('Hold expired or invalid');
      }
      if (holdStatus === 'COMMITTED') {
        throw new Error('Hold already committed');
      }

      const qty = parseInt(qtyStr, 10);
      const receiptId = uuidv4();

      // Insert into allocations
      const result = await client.query(`
        INSERT INTO allocations (user_id, hold_id, qty, status, round_id, idempotency_key, committed_at)
        VALUES ($1, $2, $3, 'COMMITTED', $4, $5, NOW())
        RETURNING id
      `, [user.sub, holdId, qty, roundId, idempotencyKey]);
      
      allocationId = result.rows[0].id;
      
      // Commit in Redis
      await redis.commitHold('hold:expiries', holdId);
      
      // We could also record the receipt
      
      await client.query('COMMIT');

      const output = { allocationId, receiptId };
      await redis.set(cacheKey, JSON.stringify(output), 'EX', 86400);

      return reply.send(output);
    } catch (err: any) {
      await client.query('ROLLBACK');
      
      // If it's a unique constraint violation (user already has a committed allocation in this round)
      if (err.code === '23505') {
        // Release hold since they are double dipping
        await redis.releaseHold(
          'inv:available',
          `hold:user:${user.sub}`,
          'hold:expiries',
          holdId
        );
        return reply.code(400).send({ error: 'User already has a committed allocation for this round' });
      }

      return reply.code(400).send({ error: err.message || 'Checkout failed' });
    } finally {
      client.release();
    }
  });
}
