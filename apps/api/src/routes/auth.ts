import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { pool } from '../db';
import { env } from '../env';
import { getSubnet } from '../utils/ip';
import { SignJWT } from 'jose';
import crypto from 'crypto';

import { 
  RegisterInputSchema, 
  VerifyInputSchema 
} from '../../../../packages/shared/auth';

export async function authRoutes(fastify: FastifyInstance) {
  
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RegisterInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error });
    }
    const { email } = parsed.data;
    
    const ip = request.ip || '127.0.0.1';
    
    // IP based rate limiting: max 3 sends per hour per IP
    const ipKey = `rl:reg:ip:${ip}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) await redis.expire(ipKey, 3600);
    if (ipCount > 3) {
      return reply.code(429).send({ error: 'Too many requests from this IP' });
    }

    // Email based rate limiting: max 3 sends per hour per email
    const emailKey = `rl:reg:email:${email}`;
    const emailCount = await redis.incr(emailKey);
    if (emailCount === 1) await redis.expire(emailKey, 3600);
    if (emailCount > 3) {
      return reply.code(429).send({ error: 'Too many requests for this email' });
    }
    
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    
    // Store in Redis with 5 minute TTL (300 seconds), also init attempts
    const otpData = { hash, attempts: 0 };
    await redis.set(`otp:${email}`, JSON.stringify(otpData), 'EX', 300);
    
    if (env.DEMO_MODE) {
      return reply.send({ otp });
    } else {
      // In production, send via email provider
      return reply.send({ message: 'OTP sent' });
    }
  });

  fastify.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = VerifyInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error });
    }
    const { email, otp, deviceFp } = parsed.data;
    
    const otpKey = `otp:${email}`;
    const dataStr = await redis.get(otpKey);
    
    if (!dataStr) {
      return reply.code(400).send({ error: 'OTP expired or invalid' });
    }
    
    const data = JSON.parse(dataStr);
    
    if (data.attempts >= 3) {
      await redis.del(otpKey);
      return reply.code(400).send({ error: 'Too many failed attempts' });
    }
    
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    if (inputHash !== data.hash) {
      data.attempts += 1;
      // update attempts keeping TTL
      const ttl = await redis.ttl(otpKey);
      if (ttl > 0) {
        await redis.set(otpKey, JSON.stringify(data), 'EX', ttl);
      }
      return reply.code(400).send({ error: 'Invalid OTP' });
    }
    
    // Success, delete OTP
    await redis.del(otpKey);
    
    const ipSubnet = getSubnet(request.ip || '127.0.0.1');
    
    // Check caps for deviceFp and ipSubnet
    let riskTier = 'normal';
    
    const deviceCountResult = await pool.query(
      'SELECT count(*) FROM users WHERE device_fp = $1',
      [deviceFp]
    );
    const ipCountResult = await pool.query(
      'SELECT count(*) FROM users WHERE ip_subnet = $1',
      [ipSubnet]
    );
    
    const deviceCount = parseInt(deviceCountResult.rows[0].count, 10);
    const ipCount = parseInt(ipCountResult.rows[0].count, 10);
    
    if (deviceCount >= 3 || ipCount >= 3) {
      riskTier = 'high';
    }
    
    let userId: string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const existing = await client.query('SELECT id, risk_tier FROM users WHERE email = $1', [email]);
      
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        riskTier = existing.rows[0].risk_tier;
      } else {
        const insertRes = await client.query(
          `INSERT INTO users (email, device_fp, ip_subnet, risk_tier)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [email, deviceFp, ipSubnet, riskTier]
        );
        userId = insertRes.rows[0].id;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(err, 'DB error during verify');
      return reply.code(500).send({ error: 'Internal Server Error' });
    } finally {
      client.release();
    }
    
    // Generate JWT
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const regAt = new Date().toISOString();
    
    const token = await new SignJWT({
      sub: userId,
      fp: deviceFp,
      tier: riskTier,
      regAt: regAt
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);
      
    return reply.send({ token, tier: riskTier });
  });
}
