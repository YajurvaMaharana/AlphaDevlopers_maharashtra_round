const Redis = require('./apps/api/node_modules/ioredis');
const crypto = require('crypto');

const redis = new Redis('redis://localhost:6379');

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

/**
 * Concurrency Test & Race Condition Inline Documentation
 * 
 * 1. Check-Then-Set (TOCTOU): 
 *    If Node fetches 'inv:available', sees 500, and sends 'DECR 2', another request could have
 *    simultaneously reserved 500. Both read 500, both decrement, causing negative inventory.
 *    Lua Atomicity: Redis runs the entire script in a single isolated step. The check 
 *    \`available < qty\` and the \`DECRBY\` happen without any interleaved operations from other clients.
 * 
 * 2. Phantom Inventory Reads:
 *    If an expiry sweeps while a reservation is validating, the total available stock could mutate.
 *    Lua Atomicity guarantees that Janitor sweeps and reservations never interleave. 
 * 
 * 3. Double-decrementing or Bypassing Caps:
 *    A single user can fire 100 concurrent requests trying to reserve 2 tickets each.
 *    If checked asynchronously in Node, all 100 requests read \`currentHolds = 0\` and proceed, 
 *    allowing the user to reserve 200 tickets (bypassing the max 2 limit).
 *    Lua Atomicity safely checks \`currentHolds + qty > 2\` and increments \`userHoldsKey\` in the 
 *    same synchronous tick, safely throwing \`LIMIT_EXCEEDED\` for 99 of those requests.
 */

async function run() {
  console.log("Preparing database for concurrency test...");

  await redis.flushdb();

  await redis.set('inv:available', '500');
  await redis.hset('drop:state', 'status', 'ADMITTING');

  const users = [];
  const pipeline = redis.pipeline();
  for (let i = 0; i < 2000; i++) {
    const userId = `user-${i}`;
    users.push(userId);
    pipeline.set(`admit_token:${userId}`, '1', 'EX', 600);
  }
  await pipeline.exec();

  console.log("Tokens issued. Firing 5,000 parallel reserve requests...");

  const totalCalls = 5000;
  const promises = [];

  for (let i = 0; i < totalCalls; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const holdId = crypto.randomUUID();
    const qty = Math.floor(Math.random() * 2) + 1;

    promises.push(
      redis.reserveHold(
        'inv:available',
        'drop:state',
        `admit_token:${randomUser}`,
        `hold:user:${randomUser}`,
        'hold:expiries',
        randomUser,
        qty,
        holdId,
        60,
        Date.now()
      ).catch(e => e)
    );
  }

  const results = await Promise.all(promises);
  
  let successes = 0;
  let limits = 0;
  let outOfStock = 0;

  for (const res of results) {
    if (typeof res === 'string') {
      successes++;
    } else if (res && res.message) {
      if (res.message === 'LIMIT_EXCEEDED') limits++;
      else if (res.message === 'OUT_OF_STOCK') outOfStock++;
    }
  }

  const remainingInv = parseInt(await redis.get('inv:available') || '0', 10);
  
  const keys = await redis.keys('hold_data:*');
  let heldQty = 0;
  if (keys.length > 0) {
    const holds = await Promise.all(keys.map(k => redis.hget(k, 'qty')));
    heldQty = holds.reduce((acc, val) => acc + parseInt(val || '0', 10), 0);
  }

  const totalAccounted = remainingInv + heldQty;

  console.log(`Results of 5000 parallel calls:`);
  console.log(`- Successes: ${successes}`);
  console.log(`- LIMIT_EXCEEDED: ${limits}`);
  console.log(`- OUT_OF_STOCK: ${outOfStock}`);
  console.log(`- Held items qty: ${heldQty}`);
  console.log(`- Remaining Inventory: ${remainingInv}`);
  
  console.log(`Total accounted (Held + Remaining): ${totalAccounted} (Should be exactly 500)`);
  
  if (totalAccounted !== 500) {
    console.error("FAIL: Inventory leak detected!");
    process.exit(1);
  }
  
  if (heldQty > 500) {
    console.error("FAIL: Oversold!");
    process.exit(1);
  }

  if (remainingInv < 0) {
    console.error("FAIL: Negative inventory!");
    process.exit(1);
  }

  console.log("PASS: Concurrency handled perfectly by Lua Atomicity.");
  
  await redis.quit();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
