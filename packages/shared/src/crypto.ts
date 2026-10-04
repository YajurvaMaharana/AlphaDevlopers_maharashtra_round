/**
 * FairDrop Shared Cryptographic & Lottery Engine
 * 100% Deterministic, HMAC-SHA256 PRNG Fisher-Yates Shuffle, Merkle Tree with Odd Duplication.
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

export async function hmacSha256(keyStr: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.subtle) {
    const key = await cryptoObj.subtle.importKey(
      'raw',
      enc.encode(keyStr),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await cryptoObj.subtle.sign('HMAC', key, enc.encode(message));
    const arr = Array.from(new Uint8Array(sig));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const nodeCrypto = eval("require('crypto')");
    return nodeCrypto.createHmac('sha256', keyStr).update(message).digest('hex');
  } catch (e) {
    throw new Error('No HMAC-SHA256 implementation available.');
  }
}

export async function deterministicShuffle(tickets: string[], seed: string): Promise<string[]> {
  const sorted = [...tickets].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const arr = [...sorted];
  for (let i = arr.length - 1; i > 0; i--) {
    const hmacHex = await hmacSha256(seed, String(i));
    const intVal = parseInt(hmacHex.slice(0, 8), 16);
    const j = intVal % (i + 1);
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export async function computeAllocationLeaf(
  userId: string,
  rank: number
): Promise<string> {
  // Excludes volatile fields (timestamps, lane, tier, risk score)
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
  ranks: Map<string, number>
): Promise<MerkleTreeResult> {
  const sortedParticipants = [...participants].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const leaves: string[] = [];
  for (const userId of sortedParticipants) {
    const rank = ranks.get(userId) || 1;
    const leaf = await computeAllocationLeaf(userId, rank);
    leaves.push(leaf);
  }

  let currentLayer = [...leaves];
  const treeLayers: string[][] = [currentLayer];

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      // Odd-sized level handling: duplicate the last node
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
  for (let pIdx = 0; pIdx < sortedParticipants.length; pIdx++) {
    const userId = sortedParticipants[pIdx];
    const proof: string[] = [];
    let idx = pIdx;

    for (let l = 0; l < treeLayers.length - 1; l++) {
      const layer = treeLayers[l];
      const isEven = idx % 2 === 0;
      const siblingIdx = isEven ? idx + 1 : idx - 1;
      if (siblingIdx < layer.length) {
        proof.push(layer[siblingIdx]);
      } else {
        proof.push(layer[idx]); // duplicated odd sibling
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

export interface DropSnapshotData {
  dropId: string;
  seed: string;
  commitment: string;
  tickets: string[];
  shuffledTickets: string[];
  ranks: Record<string, number>;
  root: string;
  leaves: string[];
  proofs: Record<string, string[]>;
}

let cachedSnapshot: DropSnapshotData | null = null;

export async function getOrCreateDropSnapshot(dropId = 'fairdrop-main-2026', forcedSeed?: string): Promise<DropSnapshotData> {
  if (cachedSnapshot && !forcedSeed) {
    return cachedSnapshot;
  }

  const seed = forcedSeed || `fairdrop_seed_${dropId}_2026_frozen_v1`;
  const commitment = await sha256(seed);

  const baseTickets: string[] = [];
  for (let i = 1; i <= 500; i++) {
    baseTickets.push(`usr_ticket_${i.toString().padStart(3, '0')}`);
  }
  baseTickets.push('usr_mock_001', 'usr_low_fan', 'usr_med_vpn', 'usr_high_bot', 'alex.rivers@example.com', 'fan@example.com');
  const uniqueTickets = Array.from(new Set(baseTickets));

  const shuffled = await deterministicShuffle(uniqueTickets, seed);
  const ranksMap = new Map<string, number>();
  shuffled.forEach((id, idx) => {
    ranksMap.set(id, idx + 1);
  });

  const tree = await buildMerkleTree(shuffled, ranksMap);

  const ranksRecord: Record<string, number> = {};
  ranksMap.forEach((v, k) => {
    ranksRecord[k] = v;
  });

  const proofsRecord: Record<string, string[]> = {};
  tree.proofs.forEach((v, k) => {
    proofsRecord[k] = v;
  });

  cachedSnapshot = {
    dropId,
    seed,
    commitment,
    tickets: uniqueTickets,
    shuffledTickets: shuffled,
    ranks: ranksRecord,
    root: tree.root,
    leaves: tree.leaves,
    proofs: proofsRecord
  };

  return cachedSnapshot;
}

export function resetDropSnapshot(forcedSeed?: string): Promise<DropSnapshotData> {
  cachedSnapshot = null;
  return getOrCreateDropSnapshot('fairdrop-main-2026', forcedSeed);
}
