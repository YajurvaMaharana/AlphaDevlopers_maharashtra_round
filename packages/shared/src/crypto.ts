/**
 * FairDrop Shared Cryptographic & Lottery Engine
 * Ensures 100% mathematical parity between mock generators, backend, and client verifiers.
 */

export async function sha256(input: string): Promise<string> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  try {
    const nodeCrypto = eval("require('crypto')");
    return nodeCrypto.createHash('sha256').update(input).digest('hex');
  } catch (e) {
    throw new Error('No SHA-256 implementation available.');
  }
}

export function createMulberry32(seedInt: number): () => number {
  let s = seedInt >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function computeDropDraw(
  dropId: string,
  participants: string[],
  seed?: string
): Promise<{
  seed: string;
  commitment: string;
  shuffledParticipants: string[];
  ranks: Map<string, number>;
}> {
  const cleanSeed = seed || `fairdrop_seed_${dropId}_2026_valid`;
  const commitment = await sha256(cleanSeed);
  const seedHash = await sha256(cleanSeed);
  const seedInt = parseInt(seedHash.slice(0, 8), 16);
  const prng = createMulberry32(seedInt);

  const sorted = [...participants].sort();
  const shuffled = [...sorted];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  const ranks = new Map<string, number>();
  shuffled.forEach((id, idx) => {
    ranks.set(id, idx + 1);
  });

  return {
    seed: cleanSeed,
    commitment,
    shuffledParticipants: shuffled,
    ranks
  };
}

export async function computeAllocationLeaf(
  userId: string,
  rank: number,
  seatNumber: number
): Promise<string> {
  const leafPayload = `${rank}:${userId}`;
  return sha256(leafPayload);
}

export interface MerkleTreeResult {
  root: string;
  leaves: string[];
  proofs: Map<string, string[]>;
}

export async function buildMerkleTree(
  participants: string[],
  ranks: Map<string, number>,
  seatNumberMap?: Map<string, number>
): Promise<MerkleTreeResult> {
  const leaves: string[] = [];
  for (const userId of participants) {
    const rank = ranks.get(userId) || 1;
    const seatNumber = seatNumberMap?.get(userId) || rank;
    const leaf = await computeAllocationLeaf(userId, rank, seatNumber);
    leaves.push(leaf);
  }

  let currentLayer = [...leaves];
  const treeLayers: string[][] = [currentLayer];

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      const pair = left <= right ? left + right : right + left;
      const parent = await sha256(pair);
      nextLayer.push(parent);
    }
    treeLayers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = treeLayers[treeLayers.length - 1][0] || '';

  const proofs = new Map<string, string[]>();
  for (let pIdx = 0; pIdx < participants.length; pIdx++) {
    const userId = participants[pIdx];
    const proof: string[] = [];
    let idx = pIdx;

    for (let l = 0; l < treeLayers.length - 1; l++) {
      const layer = treeLayers[l];
      const isEven = idx % 2 === 0;
      const siblingIdx = isEven ? idx + 1 : idx - 1;
      if (siblingIdx < layer.length) {
        proof.push(layer[siblingIdx]);
      } else {
        proof.push(layer[idx]);
      }
      idx = Math.floor(idx / 2);
    }
    proofs.set(userId, proof);
  }

  return { root, leaves, proofs };
}

export async function verifyCommitment(seed: string, expectedCommitment: string): Promise<boolean> {
  const computed = await sha256(seed);
  return computed.toLowerCase() === expectedCommitment.toLowerCase();
}

export async function verifyMerkleProof(
  leafHash: string,
  proof: string[],
  expectedRoot: string
): Promise<boolean> {
  let current = leafHash.toLowerCase();
  for (const sibling of proof) {
    const s = sibling.toLowerCase();
    const pair = current <= s ? current + s : s + current;
    current = await sha256(pair);
  }
  return current === expectedRoot.toLowerCase();
}
