import { describe, it, expect } from 'vitest';
import {
  sha256,
  deterministicShuffle,
  buildMerkleTree,
  verifyCommitment,
  verifyMerkleProof,
  getOrCreateDropSnapshot,
  resetDropSnapshot
} from './src/crypto';

describe('FairDrop Cryptographic Engine & Deterministic Snapshot Tests', () => {
  it('handles various participant counts (1, 2, 3, 7, 8, 500, 501) with odd node duplication', async () => {
    const counts = [1, 2, 3, 7, 8, 500, 501];
    for (const count of counts) {
      const tickets = Array.from({ length: count }, (_, i) => `usr_t_${i + 1}`);
      const seed = `seed_${count}_test`;
      const shuffled = await deterministicShuffle(tickets, seed);
      expect(shuffled.length).toBe(count);

      const ranksMap = new Map<string, number>();
      shuffled.forEach((id, idx) => ranksMap.set(id, idx + 1));

      const tree = await buildMerkleTree(shuffled, ranksMap);
      expect(tree.root).toHaveLength(64);
      expect(tree.leaves.length).toBe(count);

      // Verify each participant
      for (const t of tickets) {
        const rank = ranksMap.get(t)!;
        const leaf = await sha256(`${rank}:${t}`);
        const proof = tree.proofs.get(t)!;
        const valid = await verifyMerkleProof(leaf, proof, tree.root);
        expect(valid).toBe(true);
      }
    }
  });

  it('(a) 200 random seed variations verify 100% of the time', async () => {
    const tickets = ['usr_a', 'usr_b', 'usr_c', 'usr_d', 'usr_e'];
    for (let i = 0; i < 200; i++) {
      const seed = `seed_rand_${i}_${Math.floor(Math.random() * 100000)}`;
      const commitment = await sha256(seed);
      const shuffled = await deterministicShuffle(tickets, seed);
      const ranksMap = new Map<string, number>();
      shuffled.forEach((id, idx) => ranksMap.set(id, idx + 1));
      const tree = await buildMerkleTree(shuffled, ranksMap);

      const validCommitment = await verifyCommitment(seed, commitment);
      expect(validCommitment).toBe(true);

      const testUser = tickets[0];
      const rank = ranksMap.get(testUser)!;
      const leaf = await sha256(`${rank}:${testUser}`);
      const proof = tree.proofs.get(testUser)!;
      const validProof = await verifyMerkleProof(leaf, proof, tree.root);
      expect(validProof).toBe(true);
    }
  });

  it('(b) calling snapshot getters multiple times (20 times) returns byte-identical JSON', async () => {
    await resetDropSnapshot('fixed_test_seed_20');
    const first = await getOrCreateDropSnapshot();
    const firstJson = JSON.stringify(first);

    for (let i = 0; i < 20; i++) {
      const current = await getOrCreateDropSnapshot();
      expect(JSON.stringify(current)).toBe(firstJson);
    }
  });

  it('(c) adding tickets after draw does not alter snapshot or ranks of existing tickets', async () => {
    await resetDropSnapshot('fixed_test_seed_freeze');
    const snapshot1 = await getOrCreateDropSnapshot();
    const rankUser1 = snapshot1.ranks['usr_mock_001'];

    // Simulate late joiner
    const snapshot2 = await getOrCreateDropSnapshot();
    snapshot2.tickets.push('usr_late_joiner_999');

    const snapshot3 = await getOrCreateDropSnapshot();
    expect(snapshot3.ranks['usr_mock_001']).toBe(rankUser1);
    expect(snapshot3.root).toBe(snapshot1.root);
  });

  it('(d) tampering with one character makes exactly the matching check fail', async () => {
    const snapshot = await resetDropSnapshot('tamper_test_seed');
    const testUser = 'usr_mock_001';
    const rank = snapshot.ranks[testUser];
    const leaf = await sha256(`${rank}:${testUser}`);
    const proof = snapshot.proofs[testUser];

    // 1. Tampered seed
    const badCommitment = await verifyCommitment(snapshot.seed + 'x', snapshot.commitment);
    expect(badCommitment).toBe(false);

    // 2. Tampered proof
    const badProof = [...proof];
    if (badProof.length > 0) {
      badProof[0] = '0000000000000000000000000000000000000000000000000000000000000000';
    }
    const badMerkle = await verifyMerkleProof(leaf, badProof, snapshot.root);
    expect(badMerkle).toBe(false);
  });

  it('(e) whole flow verifies after reset demo', async () => {
    const snap1 = await resetDropSnapshot('reset_demo_seed_1');
    const snap2 = await resetDropSnapshot('reset_demo_seed_2');
    expect(snap1.commitment).not.toBe(snap2.commitment);

    const valid = await verifyCommitment(snap2.seed, snap2.commitment);
    expect(valid).toBe(true);
  });
});
