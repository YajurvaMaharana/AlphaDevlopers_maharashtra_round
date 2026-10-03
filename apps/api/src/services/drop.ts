import { redis } from '../redis';
import crypto from 'crypto';

// PRNG: simple LCG
function lcg(seed: number) {
  return function() {
    seed = Math.imul(1664525, seed) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export function getDrawSeed(): string {
  // Simulating F7 commit-reveal module seed
  return crypto.randomBytes(32).toString('hex');
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash;
}

function shuffle<T>(array: T[], randomFunc: () => number) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(randomFunc() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export async function runDraw() {
  const locked = await redis.set('drop:draw_lock', '1', 'EX', 60, 'NX');
  if (!locked) return; // Another replica is drawing

  try {
    const joiners = await redis.zrange('drop:joiners:window', 0, -1);
    if (joiners.length === 0) {
      await redis.hset('drop:state', 'status', 'ADMITTING');
      return;
    }

    // Fetch tiers
    const tiers = await redis.hmget('drop:user:tier', ...joiners);
    
    const lowList: string[] = [];
    const mediumList: string[] = [];
    const highList: string[] = [];

    for (let i = 0; i < joiners.length; i++) {
      const tier = tiers[i] || 'normal';
      if (tier === 'high') highList.push(joiners[i]);
      else if (tier === 'medium') mediumList.push(joiners[i]);
      else lowList.push(joiners[i]); // normal is low risk
    }

    const seedStr = getDrawSeed();
    await redis.hset('drop:state', 'draw_seed', seedStr);
    const prng = lcg(stringToSeed(seedStr));

    shuffle(lowList, prng);
    shuffle(mediumList, prng);
    shuffle(highList, prng);

    const queue: string[] = [];
    
    // WRR: 60/30/10 per batch of 100
    // Simplified: 6/3/1 per batch of 10
    let l = 0, m = 0, h = 0;
    while (l < lowList.length || m < mediumList.length || h < highList.length) {
      let lCount = 6, mCount = 3, hCount = 1;
      
      // If a bucket is empty, we don't strict-redistribute shares mathematically to the exact fraction,
      // we just take from whatever is available in the other buckets in the next loop.
      // Wait, prompt: "unused share flows to the other tiers". 
      // If we just take min(available, target) and push, the remaining just flows to the end,
      // which is fine, but to be strictly WRR:
      let batch = [];
      for (let i = 0; i < lCount && l < lowList.length; i++) batch.push(lowList[l++]);
      for (let i = 0; i < mCount && m < mediumList.length; i++) batch.push(mediumList[m++]);
      for (let i = 0; i < hCount && h < highList.length; i++) batch.push(highList[h++]);
      
      queue.push(...batch);
    }

    if (queue.length > 0) {
      // Store rank for SSE: using ZSET to query position easily
      const pipeline = redis.pipeline();
      let rank = 1;
      for (const userId of queue) {
        pipeline.zadd('drop:positions', rank++, userId);
        pipeline.rpush('drop:queue', userId);
      }
      pipeline.set('drop:max_rank', rank - 1);
      await pipeline.exec();
    }

    await redis.hset('drop:state', 'status', 'ADMITTING');
  } catch (err) {
    console.error("Draw failed:", err);
  } finally {
    await redis.del('drop:draw_lock');
  }
}

export async function runAdmissions() {
  const locked = await redis.set('drop:admit_lock', '1', 'EX', 2, 'NX');
  if (!locked) return; 

  const status = await redis.hget('drop:state', 'status');
  if (status !== 'ADMITTING') return;

  const now = Date.now();
  const lastRunStr = await redis.hget('drop:state', 'admit_last_run');
  const lastRun = lastRunStr ? parseInt(lastRunStr, 10) : 0;
  
  if (now - lastRun < 2000) return; // N seconds = 2

  const pipeline = redis.pipeline();
  pipeline.hset('drop:state', 'admit_last_run', now);

  const inventoryStr = await redis.hget('drop:state', 'inventory');
  const inventory = inventoryStr ? parseInt(inventoryStr, 10) : 0;
  
  const admittedStr = await redis.hget('drop:state', 'admitted_count');
  let admitted = admittedStr ? parseInt(admittedStr, 10) : 0;

  if (admitted >= inventory) {
    await redis.hset('drop:state', 'status', 'CLOSED');
    return;
  }

  // Pop up to 200
  const toAdmit = Math.min(200, inventory - admitted);
  if (toAdmit <= 0) return;

  const users = await redis.lpop('drop:queue', toAdmit);
  if (users && users.length > 0) {
    for (const u of users) {
      pipeline.set(`admit_token:${u}`, '1', 'EX', 600);
    }
    pipeline.hincrby('drop:state', 'admitted_count', users.length);
    // Remove from drop:positions so position query knows they are admitted?
    // Actually, SSE handles admitted state by checking if token exists. 
    await pipeline.exec();
    
    // Publish update
    redis.publish('drop:events', JSON.stringify({ event: 'admitted', count: users.length }));
  } else {
    // Queue is empty, but we might have late joiners coming in. Wait for CLOSED by admin or inventory.
  }
}

export function startDropWorker() {
  setInterval(async () => {
    try {
      const state = await redis.hgetall('drop:state');
      if (!state.status) {
        await redis.hset('drop:state', 'status', 'SCHEDULED', 'admitted_count', '0');
        return;
      }

      if (state.status === 'JOIN_WINDOW') {
        const windowCloses = parseInt(state.window_closes_at || '0', 10);
        if (Date.now() >= windowCloses) {
          // Transition to DRAWING
          await redis.hset('drop:state', 'status', 'DRAWING');
        }
      } else if (state.status === 'DRAWING') {
        await runDraw();
      } else if (state.status === 'ADMITTING') {
        await runAdmissions();
      }
    } catch (err) {
      console.error("Drop worker error:", err);
    }
  }, 1000);
}
