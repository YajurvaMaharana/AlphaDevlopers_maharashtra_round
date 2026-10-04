import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

// Shared in-memory data store across mock instances (simulating external Redis cluster)
const globalStore = new Map<string, any>();
const globalHashStore = new Map<string, Map<string, any>>();
const globalSets = new Map<string, Set<string>>();
const globalLists = new Map<string, string[]>();
const globalSortedSets = new Map<string, Map<string, number>>();

export class InMemoryRedisMock {
  private store = globalStore;
  private hashStore = globalHashStore;
  private sets = globalSets;
  private lists = globalLists;
  private sortedSets = globalSortedSets;

  async get(key: string) { return this.store.get(key) ?? null; }
  async set(key: string, val: any, ...args: any[]) {
    const nxIndex = args.findIndex((a) => typeof a === 'string' && a.toUpperCase() === 'NX');
    if (nxIndex !== -1) {
      if (this.store.has(key)) return null;
    }
    this.store.set(key, String(val));
    return 'OK';
  }
  async del(...keys: string[]) {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
      if (this.hashStore.delete(key)) count++;
      if (this.sets.delete(key)) count++;
      if (this.lists.delete(key)) count++;
      if (this.sortedSets.delete(key)) count++;
    }
    return count || 1;
  }
  async expire(key: string, seconds: number) { return 1; }
  async incr(key: string) {
    const n = (parseInt(this.store.get(key) || '0', 10)) + 1;
    this.store.set(key, String(n));
    return n;
  }
  
  async hset(key: string, ...args: any[]) {
    if (!this.hashStore.has(key)) this.hashStore.set(key, new Map());
    const map = this.hashStore.get(key)!;
    if (typeof args[0] === 'object' && args[0] !== null) {
      for (const [k, v] of Object.entries(args[0])) {
        map.set(k, String(v));
      }
    } else {
      map.set(args[0], String(args[1]));
    }
    return 1;
  }

  async hget(key: string, field: string) {
    return this.hashStore.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string) {
    const map = this.hashStore.get(key);
    if (!map) return {};
    const obj: Record<string, string> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  async sadd(key: string, ...members: string[]) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const set = this.sets.get(key)!;
    for (const m of members) set.add(m);
    return members.length;
  }

  async smembers(key: string) {
    return Array.from(this.sets.get(key) || []);
  }

  async scard(key: string) {
    return this.sets.get(key)?.size ?? 0;
  }

  async sismember(key: string, member: string) {
    return this.sets.get(key)?.has(member) ? 1 : 0;
  }

  async rpush(key: string, ...elements: string[]) {
    if (!this.lists.has(key)) this.lists.set(key, []);
    const list = this.lists.get(key)!;
    for (const el of elements) list.push(el);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number) {
    const list = this.lists.get(key) || [];
    if (stop === -1) return list.slice(start);
    return list.slice(start, stop + 1);
  }

  async llen(key: string) {
    return this.lists.get(key)?.length ?? 0;
  }

  // Sorted Sets
  async zadd(key: string, score: number, member: string) {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    this.sortedSets.get(key)!.set(member, Number(score));
    return 1;
  }

  async zcard(key: string) {
    return this.sortedSets.get(key)?.size ?? 0;
  }

  async zcount(key: string, min: number | string, max: number | string) {
    const map = this.sortedSets.get(key);
    if (!map) return 0;
    const minVal = min === '-inf' ? -Infinity : Number(min);
    const maxVal = max === '+inf' ? Infinity : Number(max);
    let count = 0;
    for (const score of map.values()) {
      if (score >= minVal && score <= maxVal) count++;
    }
    return count;
  }

  async zrangebyscore(key: string, min: number | string, max: number | string) {
    const map = this.sortedSets.get(key);
    if (!map) return [];
    const minVal = min === '-inf' ? -Infinity : Number(min);
    const maxVal = max === '+inf' ? Infinity : Number(max);
    const items: Array<{ member: string; score: number }> = [];
    for (const [member, score] of map.entries()) {
      if (score >= minVal && score <= maxVal) {
        items.push({ member, score });
      }
    }
    items.sort((a, b) => a.score - b.score);
    return items.map((i) => i.member);
  }

  async hincrby(key: string, field: string, increment: number = 1) {
    if (!this.hashStore.has(key)) this.hashStore.set(key, new Map());
    const map = this.hashStore.get(key)!;
    const current = parseInt(map.get(field) || '0', 10);
    const updated = current + increment;
    map.set(field, String(updated));
    return updated;
  }

  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      del: (k: string) => { operations.push(async () => [null, await this.del(k)]); return pipe; },
      hgetall: (k: string) => { operations.push(async () => [null, await this.hgetall(k)]); return pipe; },
      scard: (k: string) => { operations.push(async () => [null, await this.scard(k)]); return pipe; },
      get: (k: string) => { operations.push(async () => [null, await this.get(k)]); return pipe; },
      llen: (k: string) => { operations.push(async () => [null, await this.llen(k)]); return pipe; },
      set: (k: string, v: any, ...a: any[]) => { operations.push(async () => [null, await this.set(k, v, ...a)]); return pipe; },
      hset: (k: string, ...a: any[]) => { operations.push(async () => [null, await this.hset(k, ...a)]); return pipe; },
      hincrby: (k: string, f: string, inc: number = 1) => { operations.push(async () => [null, await this.hincrby(k, f, inc)]); return pipe; },
      expire: (k: string, s: number) => { operations.push(async () => [null, await this.expire(k, s)]); return pipe; },
      zadd: (k: string, s: number, m: string) => { operations.push(async () => [null, await this.zadd(k, s, m)]); return pipe; },
      zrangebyscore: (k: string, min: any, max: any) => { operations.push(async () => [null, await this.zrangebyscore(k, min, max)]); return pipe; },
      rpush: (k: string, ...el: string[]) => { operations.push(async () => [null, await this.rpush(k, ...el)]); return pipe; },
      lrange: (k: string, s: number, e: number) => { operations.push(async () => [null, await this.lrange(k, s, e)]); return pipe; },
      sadd: (k: string, ...m: string[]) => { operations.push(async () => [null, await this.sadd(k, ...m)]); return pipe; },
      smembers: (k: string) => { operations.push(async () => [null, await this.smembers(k)]); return pipe; },
      exec: async () => {
        return Promise.all(operations.map((op) => op()));
      },
    };
    return pipe;
  }

  async quit() { return 'OK'; }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  let redis: any;
  const isTestOrLocal = process.env.NODE_ENV === 'test' || !process.env.REDIS_URL;

  if (isTestOrLocal) {
    redis = new InMemoryRedisMock();
  } else {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 50, 200)),
    });
  }

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    if (typeof redis.quit === 'function') {
      await redis.quit();
    }
  });
};

export default fp(redisPlugin);
