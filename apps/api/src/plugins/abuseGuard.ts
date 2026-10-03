import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis';
import { env } from '../env';

// Track metrics
export const abuseMetrics = {
  totalReqs: 0,
  rateLimits: { ip: 0, token: 0, device: 0, subnet: 0 },
  tarpits: 0,
  activeBans: 0,
};

async function getDefensesEnabled(): Promise<boolean> {
  const flag = await redis.get('defenses:enabled');
  // Default to true if not set
  return flag !== 'false';
}

export function flushDefensesCache() {
  // no-op
}

interface AbuseConfig {
  points: number;
  duration: number; // in seconds
}

// Config per route group
const limits: Record<string, AbuseConfig> = {
  'auth': { points: 5, duration: 60 },
  'join': { points: 10, duration: 60 },
  'checkout': { points: 20, duration: 60 },
  'status': { points: 60, duration: 60 },
  'default': { points: 100, duration: 60 }
};

// sliding window implementation using Lua to ensure atomicity
const SLIDING_WINDOW_LUA = `
  local key = KEYS[1]
  local nowMs = tonumber(ARGV[1])
  local windowMs = tonumber(ARGV[2])
  local maxPoints = tonumber(ARGV[3])
  local inc = tonumber(ARGV[4])

  -- remove older entries
  local clearBefore = nowMs - windowMs
  redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

  -- count current points
  local count = redis.call('ZCARD', key)

  if count >= maxPoints then
    return -1
  end

  -- insert new request
  redis.call('ZADD', key, nowMs, nowMs)
  redis.call('PEXPIRE', key, windowMs)
  
  return count + inc
`;

let activeTarpits = 0;
const MAX_CONCURRENT_TARPITS = 1000;

async function checkRateLimit(key: string, limit: AbuseConfig): Promise<boolean> {
  const now = Date.now();
  try {
    const res = await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      now.toString(),
      (limit.duration * 1000).toString(),
      limit.points.toString(),
      '1'
    );
    return res !== -1;
  } catch (err) {
    // Fail open on Redis error
    return true;
  }
}

async function recordEvent(layer: string, identity: string, action: string) {
  try {
    await redis.xadd('abuse:events', '*', 'ts', new Date().toISOString(), 'layer', layer, 'identityHash', identity, 'action', action);
  } catch (err) {
    // Ignore stream errors
  }
}

async function handlePenalty(identity: string): Promise<number> {
  const penaltyKey = `penalty:${identity}`;
  const count = await redis.incr(penaltyKey);
  
  let banDuration = 0;
  if (count === 1) banDuration = 60;
  else if (count === 2) banDuration = 300;
  else banDuration = 900;
  
  await redis.expire(penaltyKey, Math.max(86400, banDuration * 2)); // keep count around for a day to track repeat offenders
  
  const banKey = `ban:${identity}`;
  await redis.set(banKey, '1', 'EX', banDuration);
  abuseMetrics.activeBans++;
  return count;
}

export const abuseGuardPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    abuseMetrics.totalReqs++;
    
    if (request.url.startsWith('/admin') || !(await getDefensesEnabled())) {
      return; // completely bypass
    }

    // Determine group
    let group = 'default';
    if (request.url.startsWith('/auth')) group = 'auth';
    else if (request.url.startsWith('/drop/join')) group = 'join';
    else if (request.url.startsWith('/checkout')) group = 'checkout';
    else if (request.url.startsWith('/me') || request.url.startsWith('/drop')) group = 'status';

    const limit = limits[group];

    // Identify layers
    const ip = request.ip || '0.0.0.0';
    const subnet = ip.split('.').slice(0, 3).join('.') + '.0'; // basic /24 
    const deviceFp = (request.headers['x-device-fingerprint'] as string) || 'unknown';
    
    // We can't access request.user yet if jwtVerify happens in preHandler, 
    // but we can parse authorization header roughly or wait for preHandler. 
    // We'll just use authorization header token directly.
    const authHeader = request.headers.authorization;
    let token = 'none';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Check for active bans FIRST across all layers
    const identities = [
      { layer: 'ip', val: ip },
      { layer: 'subnet', val: subnet },
      { layer: 'device', val: deviceFp },
      { layer: 'token', val: token }
    ];

    for (const { layer, val } of identities) {
      if (val === 'none' || val === 'unknown') continue;
      const isBanned = await redis.get(`ban:${val}`);
      if (isBanned) {
        await recordEvent(layer, val, 'banned');
        reply.header('Retry-After', 60);
        reply.code(429).send({
          error: { code: 'RATE_LIMITED', message: 'Too many requests', layer }
        });
        return reply;
      }
    }

    // Check rate limits
    for (const { layer, val } of identities) {
      if (val === 'none' || val === 'unknown') continue;
      
      const key = `rl:${layer}:${group}:${val}`;
      const allowed = await checkRateLimit(key, limit);
      
      if (!allowed) {
        abuseMetrics.rateLimits[layer as keyof typeof abuseMetrics.rateLimits]++;
        await recordEvent(layer, val, 'limited');
        
        // Escalate to penalty box
        const penaltyCount = await handlePenalty(val);
        (request as any).penaltyCount = penaltyCount; // pass downstream

        reply.header('Retry-After', 60);
        reply.code(429).send({
          error: { code: 'RATE_LIMITED', message: 'Too many requests', layer }
        });
        return reply;
      }
    }

    // Tarpit Check: if high risk tier (from token, but we must parse it, 
    // since this is onRequest, we decode it minimally without verify to check tier)
    let isHighRisk = false;
    if (token !== 'none') {
      try {
        const payloadB64 = token.split('.')[1];
        if (payloadB64) {
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
          if (payload.tier === 'high') {
            isHighRisk = true;
          }
        }
      } catch (e) {}
    }
    
    // Tarpit if high risk and we have capacity
    if (isHighRisk && activeTarpits < MAX_CONCURRENT_TARPITS) {
      activeTarpits++;
      abuseMetrics.tarpits++;
      await recordEvent('token', token, 'tarpitted');
      
      const delay = Math.floor(Math.random() * 2500) + 500; // 500ms to 3000ms
      await new Promise(resolve => setTimeout(resolve, delay));
      
      activeTarpits--;
    } else {
      await recordEvent('ip', ip, 'allowed');
    }
  });
});
