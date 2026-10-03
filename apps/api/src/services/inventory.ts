import { redis } from '../redis';

declare module 'ioredis' {
  interface Redis {
    reserveHold(
      invKey: string,
      stateKey: string,
      tokenKey: string,
      userHoldsKey: string,
      expiriesKey: string,
      userId: string,
      qty: number,
      holdId: string,
      ttlSec: number,
      nowMs: number
    ): Promise<string | { err: string }>;
    releaseHold(
      invKey: string,
      userHoldsKey: string,
      expiriesKey: string,
      holdId: string
    ): Promise<number>;
    commitHold(
      expiriesKey: string,
      holdId: string
    ): Promise<number>;
  }
}

redis.defineCommand('reserveHold', {
  numberOfKeys: 5,
  lua: `
    local invKey = KEYS[1]
    local stateKey = KEYS[2]
    local tokenKey = KEYS[3]
    local userHoldsKey = KEYS[4]
    local expiriesKey = KEYS[5]
    
    local userId = ARGV[1]
    local qty = tonumber(ARGV[2])
    local holdId = ARGV[3]
    local ttlSec = tonumber(ARGV[4])
    local nowMs = tonumber(ARGV[5])

    local status = redis.call('HGET', stateKey, 'status')
    if status ~= 'ADMITTING' then
      return {err = "DROP_NOT_ADMITTING"}
    end

    local hasToken = redis.call('EXISTS', tokenKey)
    if hasToken == 0 then
      return {err = "NO_ADMIT_TOKEN"}
    end

    local currentHolds = redis.call('HGET', userHoldsKey, 'qty')
    if not currentHolds then currentHolds = 0 end
    currentHolds = tonumber(currentHolds)
    if currentHolds + qty > 2 then
      return {err = "LIMIT_EXCEEDED"}
    end

    local available = redis.call('GET', invKey)
    if not available then available = 0 end
    available = tonumber(available)
    if available < qty then
      return {err = "OUT_OF_STOCK"}
    end

    redis.call('DECRBY', invKey, qty)
    redis.call('HINCRBY', userHoldsKey, 'qty', qty)
    redis.call('HSET', 'hold_data:' .. holdId, 'userId', userId, 'qty', qty, 'status', 'HELD')
    redis.call('ZADD', expiriesKey, nowMs + (ttlSec * 1000), holdId)

    return holdId
  `
});

redis.defineCommand('releaseHold', {
  numberOfKeys: 3,
  lua: `
    local invKey = KEYS[1]
    local userHoldsKey = KEYS[2]
    local expiriesKey = KEYS[3]
    local holdId = ARGV[1]

    local qty = redis.call('HGET', 'hold_data:' .. holdId, 'qty')
    if not qty then return 0 end
    qty = tonumber(qty)

    local status = redis.call('HGET', 'hold_data:' .. holdId, 'status')
    if status == 'COMMITTED' then return 0 end

    redis.call('INCRBY', invKey, qty)
    redis.call('HINCRBY', userHoldsKey, 'qty', -qty)
    redis.call('DEL', 'hold_data:' .. holdId)
    redis.call('ZREM', expiriesKey, holdId)

    return 1
  `
});

redis.defineCommand('commitHold', {
  numberOfKeys: 1,
  lua: `
    local expiriesKey = KEYS[1]
    local holdId = ARGV[1]
    
    local qty = redis.call('HGET', 'hold_data:' .. holdId, 'qty')
    if not qty then return 0 end

    redis.call('ZREM', expiriesKey, holdId)
    redis.call('HSET', 'hold_data:' .. holdId, 'status', 'COMMITTED')

    return 1
  `
});

export async function runInventoryJanitor() {
  const locked = await redis.set('inv:janitor_lock', '1', 'EX', 1, 'NX');
  if (!locked) return;

  try {
    const now = Date.now();
    const expiredHolds = await redis.zrangebyscore('hold:expiries', 0, now);
    
    if (expiredHolds.length > 0) {
      for (const holdId of expiredHolds) {
        const userId = await redis.hget(\`hold_data:\${holdId}\`, 'userId');
        if (userId) {
          await redis.releaseHold(
            'inv:available', 
            \`hold:user:\${userId}\`, 
            'hold:expiries', 
            holdId
          );
        }
      }
    }
  } catch (err) {
    console.error("Janitor error", err);
  }
}

export function startInventoryWorker() {
  setInterval(runInventoryJanitor, 1000);
}
