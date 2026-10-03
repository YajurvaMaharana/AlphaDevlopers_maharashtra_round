import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

export const dropRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Setup the Drop (Admin)
  fastify.post('/admin/drop/setup', async (request, reply) => {
    // Generate 32 bytes random server seed
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const commitment = crypto.createHash('sha256').update(serverSeed).digest('hex');

    // Store privately
    await fastify.redis.set('drop:serverSeed', serverSeed);
    await fastify.redis.set('drop:commitment', commitment);

    return reply.send({ success: true, commitment });
  });

  // 2. Publish Commitment
  fastify.get('/drop/commitment', async (request, reply) => {
    const commitment = await fastify.redis.get('drop:commitment');
    if (!commitment) return reply.status(404).send({ error: 'Drop not setup yet' });
    return reply.send({ commitment });
  });

  // 3. Draw Execution (Admin)
  fastify.post('/admin/drop/draw', async (request, reply) => {
    const serverSeed = await fastify.redis.get('drop:serverSeed');
    const commitment = await fastify.redis.get('drop:commitment');
    if (!serverSeed) return reply.status(400).send({ error: 'Drop not setup' });

    // Fetch drand beacon (max 2 seconds)
    let beacon = 'none';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://api.drand.sh/public/latest', { signal: controller.signal as any });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as { randomness: string };
        beacon = data.randomness || 'none';
      }
    } catch (err) {
      fastify.log.warn('Drand beacon unreachable within 2s, using none');
    }

    const finalSeedString = serverSeed + (beacon !== 'none' ? beacon : '');

    // Get all tickets (mocking this as retrieving from Redis set "drop:tickets")
    const ticketsRaw = await fastify.redis.smembers('drop:tickets');
    const tickets = ticketsRaw.length > 0 ? ticketsRaw : ['tk_1', 'tk_2', 'tk_3', 'tk_4', 'tk_5'];
    
    // Sort lexicographically
    tickets.sort();
    const ticketCount = tickets.length;

    // Fisher-Yates with HMAC-SHA256 PRNG
    const prng = createPRNG(finalSeedString);
    for (let i = tickets.length - 1; i > 0; i--) {
      const j = Math.floor(prng.nextFloat() * (i + 1));
      const temp = tickets[i];
      tickets[i] = tickets[j];
      tickets[j] = temp;
    }

    // Build leaves: sha256(rank + ':' + ticketId)
    // rank is 1-indexed for the output
    const leaves = tickets.map((ticketId: string, index: number) => {
      const rank = index + 1;
      return crypto.createHash('sha256').update(`${rank}:${ticketId}`).digest('hex');
    });

    // Build Merkle Tree
    const tree = buildMerkleTree(leaves);
    const resultRoot = tree.length > 0 ? tree[tree.length - 1][0] : 'empty';

    // Store public proof data
    await fastify.redis.hset('drop:proof', {
      commitment: commitment as string,
      serverSeed,
      ticketCount,
      beacon,
      resultRoot
    });

    // Store receipts and proofs for each ticket
    const pipeline = fastify.redis.pipeline();
    tickets.forEach((ticketId: string, index: number) => {
      const rank = index + 1;
      const proof = getMerkleProof(tree, index);
      const receiptId = `alloc_${ticketId}`;
      const receipt = {
        allocationId: receiptId,
        ticketHash: leaves[index],
        rank,
        batchId: 'batch_1',
        riskTier: 'low',
        commitment,
        merkleProof: JSON.stringify(proof),
        timestamp: Date.now()
      };
      pipeline.hset(`receipt:${receiptId}`, receipt);
    });
    await pipeline.exec();

    return reply.send({ success: true, ticketCount, resultRoot, beacon });
  });

  // 4. Return Proof
  fastify.get('/drop/proof', async (request, reply) => {
    const proof = await fastify.redis.hgetall('drop:proof');
    if (!proof || !proof.serverSeed) return reply.status(404).send({ error: 'Draw not executed yet' });
    return reply.send(proof);
  });

  // 5. Return Receipt
  fastify.get<{ Params: { allocationId: string } }>('/receipt/:allocationId', async (request, reply) => {
    const { allocationId } = request.params;
    const receipt = await fastify.redis.hgetall(`receipt:${allocationId}`);
    if (!receipt || !receipt.allocationId) return reply.status(404).send({ error: 'Receipt not found' });
    
    // Parse the JSON array back to array for response
    receipt.merkleProof = JSON.parse(receipt.merkleProof);
    receipt.rank = parseInt(receipt.rank as unknown as string, 10) as any;
    receipt.timestamp = parseInt(receipt.timestamp as unknown as string, 10) as any;
    return reply.send(receipt);
  });
};

function createPRNG(seedString: string) {
  let counter = 0;
  let currentBlock = Buffer.alloc(0);
  let offset = 0;

  function nextUInt32(): number {
    if (offset + 4 > currentBlock.length) {
      const hmac = crypto.createHmac('sha256', seedString);
      hmac.update(counter.toString());
      currentBlock = hmac.digest();
      counter++;
      offset = 0;
    }
    const val = currentBlock.readUInt32BE(offset);
    offset += 4;
    return val;
  }

  return {
    nextFloat: () => {
      return nextUInt32() / (0xffffffff + 1);
    }
  };
}

function buildMerkleTree(leaves: string[]): string[][] {
  if (leaves.length === 0) return [];
  const tree = [leaves];
  let currentLevel = leaves;
  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const combined = crypto.createHash('sha256').update(left + right).digest('hex');
      nextLevel.push(combined);
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }
  return tree;
}

function getMerkleProof(tree: string[][], index: number): string[] {
  const proof = [];
  let currentIndex = index;
  for (let i = 0; i < tree.length - 1; i++) {
    const level = tree[i];
    const isRightNode = currentIndex % 2 !== 0;
    const siblingIndex = isRightNode ? currentIndex - 1 : Math.min(currentIndex + 1, level.length - 1);
    proof.push(level[siblingIndex]);
    currentIndex = Math.floor(currentIndex / 2);
  }
  return proof;
}

export default dropRoutes;
