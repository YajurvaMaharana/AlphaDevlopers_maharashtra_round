import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { buildApp } from '../server';

describe('GET /receipt/:id Audit & Plain-English Explanation', () => {
  let app: any;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('returns plain-English explanation, fairHash and privacy hashes', async () => {
    const receiptId = 'rcpt_test_audit_9988';
    const allocationId = 'alloc_test_42';
    const batchId = 'batch_42';
    const lane = 'low';
    const commitment = '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca';
    const timestamp = 1727989999000;
    const authMethod = 'google';
    const stepUpRequired = false;

    // Expected explanation and fairHash
    const expectedExplanation = 'Verified with Google, low-risk lane, randomized batch #42';
    const expectedFairHash = crypto
      .createHash('sha256')
      .update(`${allocationId}${batchId}${lane}${commitment}${timestamp}`)
      .digest('hex');

    const expectedEmailHash = crypto
      .createHash('sha256')
      .update('fan@example.com')
      .digest('hex');

    // Store in Redis mock
    await app.redis.hset(`receipt:${receiptId}`, {
      receiptId,
      allocationId,
      orderId: 'ord_test_01',
      dropId: 'fairdrop-main-2026',
      seatNumbers: JSON.stringify([42]),
      amountCents: 9900,
      currency: 'USD',
      paidAt: String(timestamp),
      timestamp: String(timestamp),
      status: 'COMPLETED',
      authMethod,
      riskTier: lane,
      riskLane: 'low-risk lane',
      lane,
      batchId,
      batchNumber: '42',
      stepUpRequired: 'false',
      commitment,
      explanation: expectedExplanation,
      fairHash: expectedFairHash,
      emailHash: expectedEmailHash,
      txHash: '0x123456789abcdef',
      merkleProof: JSON.stringify(['proof_hash_1', 'proof_hash_2']),
      merkleRoot: 'root_hash_99',
      rank: '42',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/receipt/${receiptId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // 1. Plain-English explanation
    expect(body.explanation).toBe(expectedExplanation);

    // 2. fairHash
    expect(body.fairHash).toBe(expectedFairHash);

    // 3. Merkle proof fields intact
    expect(body.merkleProof).toEqual(['proof_hash_1', 'proof_hash_2']);
    expect(body.merkleRoot).toBe('root_hash_99');
    expect(body.commitment).toBe(commitment);
    expect(body.rank).toBe(42);
    expect(body.seatNumbers).toEqual([42]);

    // 4. Privacy verification (hashes only)
    expect(body.emailHash).toBe(expectedEmailHash);
    expect(body.fingerprint).toBeUndefined();
  });

  it('correctly reports step-up verification for high-risk lane receipts', async () => {
    const receiptId = 'rcpt_stepup_high_risk_01';
    const allocationId = 'alloc_high_risk_77';
    const batchId = 'batch_12';
    const lane = 'high';
    const commitment = '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca';
    const timestamp = 1727989999000;
    const authMethod = 'otp';
    const stepUpRequired = true;

    const expectedExplanation = 'Verified with Email OTP, high-risk lane, randomized batch #12, adaptive PoW step-up verified';

    await app.redis.hset(`receipt:${receiptId}`, {
      receiptId,
      allocationId,
      orderId: 'ord_high_02',
      dropId: 'fairdrop-main-2026',
      seatNumbers: JSON.stringify([77]),
      paidAt: String(timestamp),
      timestamp: String(timestamp),
      authMethod,
      riskTier: lane,
      riskLane: 'high-risk lane',
      lane,
      batchId,
      batchNumber: '12',
      stepUpRequired: 'true',
      commitment,
      explanation: expectedExplanation,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/receipt/${receiptId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.explanation).toBe(expectedExplanation);
    expect(body.stepUpRequired).toBe(true);
    expect(body.authMethod).toBe('otp');
    expect(body.riskTier).toBe('high');
  });
});
