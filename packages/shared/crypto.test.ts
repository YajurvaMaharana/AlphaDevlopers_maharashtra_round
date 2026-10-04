import { describe, it, expect } from 'vitest';
import {
  sha256,
  computeDropDraw,
  buildMerkleTree,
  verifyCommitment,
  verifyMerkleProof
} from './src/crypto';

describe('FairDrop Cryptographic & Lottery Engine', () => {
  const dropId = 'fairdrop-main-2026';
  const participants = [
    'usr_low_fan',
    'usr_med_vpn',
    'usr_high_bot',
    'usr_fan_001',
    'usr_fan_002',
    'usr_fan_003',
    'usr_fan_004',
    'usr_fan_005'
  ];

  it('(a) an honest receipt and proof verify successfully across all 3 steps', async () => {
    const draw = await computeDropDraw(dropId, participants, 'fairdrop_seed_test_123');
    const tree = await buildMerkleTree(participants, draw.ranks);

    const testUser = 'usr_low_fan';
    const rank = draw.ranks.get(testUser)!;
    const leaf = await sha256(`${rank}:${testUser}`);
    const proof = tree.proofs.get(testUser)!;

    // Step 1: Verify Commitment
    const step1Valid = await verifyCommitment(draw.seed, draw.commitment);
    expect(step1Valid).toBe(true);

    // Step 2: Verify Shuffle reproduces rank
    const recomputedDraw = await computeDropDraw(dropId, participants, draw.seed);
    const recomputedRank = recomputedDraw.ranks.get(testUser);
    expect(recomputedRank).toBe(rank);

    // Step 3: Verify Merkle inclusion proof
    const step3Valid = await verifyMerkleProof(leaf, proof, tree.root);
    expect(step3Valid).toBe(true);
  });

  it('(b) changing one character of the seed, rank or a proof hash makes the matching check fail', async () => {
    const draw = await computeDropDraw(dropId, participants, 'fairdrop_seed_test_123');
    const tree = await buildMerkleTree(participants, draw.ranks);

    const testUser = 'usr_low_fan';
    const rank = draw.ranks.get(testUser)!;
    const leaf = await sha256(`${rank}:${testUser}`);
    const proof = tree.proofs.get(testUser)!;

    // 1. Tampered seed -> Commitment check fails
    const tamperedSeed = draw.seed + 'x';
    const step1Failed = await verifyCommitment(tamperedSeed, draw.commitment);
    expect(step1Failed).toBe(false);

    // 2. Tampered rank -> Shuffle rank check fails
    const tamperedRank = rank + 1;
    const recomputedDraw = await computeDropDraw(dropId, participants, draw.seed);
    const recomputedRank = recomputedDraw.ranks.get(testUser);
    expect(recomputedRank).not.toBe(tamperedRank);

    // 3. Tampered proof hash -> Merkle proof check fails
    const tamperedProof = [...proof];
    if (tamperedProof.length > 0) {
      tamperedProof[0] = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    }
    const step3Failed = await verifyMerkleProof(leaf, tamperedProof, tree.root);
    expect(step3Failed).toBe(false);
  });

  it('(c) users of low, medium and high lane all get receipts and proofs that verify', async () => {
    const lanes = [
      { userId: 'usr_low_fan', lane: 'low' },
      { userId: 'usr_med_vpn', lane: 'medium' },
      { userId: 'usr_high_bot', lane: 'high' }
    ];

    const draw = await computeDropDraw(dropId, participants);
    const tree = await buildMerkleTree(participants, draw.ranks);

    for (const { userId } of lanes) {
      const rank = draw.ranks.get(userId)!;
      const leaf = await sha256(`${rank}:${userId}`);
      const proof = tree.proofs.get(userId)!;

      const validCommitment = await verifyCommitment(draw.seed, draw.commitment);
      const validMerkle = await verifyMerkleProof(leaf, proof, tree.root);

      expect(validCommitment).toBe(true);
      expect(validMerkle).toBe(true);
      expect(rank).toBeGreaterThan(0);
    }
  });
});
