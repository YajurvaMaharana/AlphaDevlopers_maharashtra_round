import { FastifyInstance } from 'fastify';

export async function runInvariantCheck(fastify: FastifyInstance): Promise<any> {
  const pipeline = fastify.redis.pipeline();
  pipeline.hgetall('metrics:funnel:reserved');
  pipeline.hgetall('metrics:funnel:paid');
  pipeline.scard('db:postgres:committed'); // Mocking postgres count as a redis set size
  pipeline.get('metrics:oversell_limit'); // Per-user max or system limit config
  
  // Checking duplicates (assuming we add successful commits to a set)
  pipeline.scard('db:commits:set');
  pipeline.llen('db:commits:list');
  
  const results = await pipeline.exec();
  if (!results) return {};

  const funnelReserved = results[0][1] || {};
  const funnelPaid = results[1][1] || {};
  
  const seatsSold = parseInt(funnelPaid.total || '0', 10);
  const seatsHeld = parseInt(funnelReserved.total || '0', 10) - seatsSold;
  const totalInventory = 500;
  const seatsAvailable = Math.max(0, totalInventory - seatsSold - seatsHeld);

  const postgresCommittedCount = results[2][1] || 0;
  const uniqueCommits = results[4][1] || 0;
  const totalCommits = results[5][1] || 0;

  // Invariant 1: sold + held + available == inventory
  const inventoryMatch = (seatsSold + seatsHeld + seatsAvailable) === totalInventory;

  // Invariant 2: no duplicate commits
  const noDuplicateCommits = uniqueCommits === totalCommits;

  // Invariant 3: Postgres committed count == Redis sold count
  // In a real system we'd query Postgres directly. 
  // Here we mock postgresCommittedCount as syncing with seatsSold eventually.
  const countsMatch = seatsSold === postgresCommittedCount;

  // Invariant 4: No user above per-user limit
  // Assuming limit is 2. We'd scan `metrics:seats_per_user`.
  // Since scanning entire hash every second is costly, we rely on the oversell_violations counter we added earlier
  const systemMetricsStr = await fastify.redis.hgetall('metrics:system');
  const oversellViolations = parseInt(systemMetricsStr?.oversell_violations || '0', 10);
  const noOversell = oversellViolations === 0;

  const invariants = {
    inventoryMatch,
    noDuplicateCommits,
    countsMatch,
    noOversell,
    details: {
      sold: seatsSold,
      held: seatsHeld,
      available: seatsAvailable,
      inventory: totalInventory,
      postgresCount: postgresCommittedCount,
      uniqueCommits,
      totalCommits,
      oversells: oversellViolations
    }
  };

  // Cache latest invariants so the SSE stream can pick it up
  await fastify.redis.set('system:invariants', JSON.stringify(invariants));

  return invariants;
}

export function startInvariantChecker(fastify: FastifyInstance) {
  setInterval(async () => {
    try {
      // In a real system, we'd use Redis locks or Raft to ensure only the LEADER replica runs this.
      // For this implementation, we attempt to grab a fast-expiring leader lock.
      const isLeader = await fastify.redis.set('system:invariant_leader', '1', 'EX', 2, 'NX');
      if (isLeader) {
        await runInvariantCheck(fastify);
      }
    } catch (err) {
      fastify.log.error(`Invariant check failed: ${err}`);
    }
  }, 1000);
}
