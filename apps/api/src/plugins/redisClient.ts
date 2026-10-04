import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

class InMemoryRedisMock {
  private store = new Map<string, any>();
  private hashStore = new Map<string, Map<string, any>>();
  private sets = new Map<string, Set<string>>();
  private lists = new Map<string, string[]>();

  async get(key: string) { return this.store.get(key) ?? null; }
  async set(key: string, val: any, ...args: any[]) { this.store.set(key, String(val)); return 'OK'; }
  async del(key: string) { this.store.delete(key); this.hashStore.delete(key); this.sets.delete(key); return 1; }
  async expire(key: string, seconds: number) { return 1; }
  async incr(key: string) { const n = (parseInt(this.store.get(key) || '0', 10)) + 1; this.store.set(key, String(n)); return n; }
  
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

  async llen(key: string) {
    return this.lists.get(key)?.length ?? 0;
  }

  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      hgetall: (k: string) => { operations.push(async () => [null, await this.hgetall(k)]); return pipe; },
      scard: (k: string) => { operations.push(async () => [null, await this.scard(k)]); return pipe; },
      get: (k: string) => { operations.push(async () => [null, await this.get(k)]); return pipe; },
      llen: (k: string) => { operations.push(async () => [null, await this.llen(k)]); return pipe; },
      set: (k: string, v: any, ...a: any[]) => { operations.push(async () => [null, await this.set(k, v, ...a)]); return pipe; },
      hset: (k: string, ...a: any[]) => { operations.push(async () => [null, await this.hset(k, ...a)]); return pipe; },
      expire: (k: string, s: number) => { operations.push(async () => [null, await this.expire(k, s)]); return pipe; },
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
