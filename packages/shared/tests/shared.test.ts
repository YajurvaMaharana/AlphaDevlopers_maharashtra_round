import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPoW,
  solvePoW,
  PoWChallenge,
  CheckoutRequestSchema,
  AppErrorSchema,
  FairDropError,
  DROP_CONSTANTS
} from '../src/index';

test('Proof of Work (PoW) anti-bot challenge: solves and verifies valid solution', async () => {
  const challenge: PoWChallenge = {
    challengeId: 'test-chal-001',
    salt: 'fairdrop-salt-abc123',
    difficulty: 2, // low difficulty for instant test execution
    expiresAt: Date.now() + 10000,
    algorithm: 'SHA-256'
  };

  const solution = await solvePoW(challenge);
  assert.equal(solution.challengeId, challenge.challengeId);
  assert.ok(solution.nonce);

  const isValid = await verifyPoW(challenge.salt, solution.nonce, challenge.difficulty);
  assert.equal(isValid, true, 'Valid nonce must pass verification');
});

test('Proof of Work (PoW) verification fails on fraudulent/tampered nonce', async () => {
  const salt = 'fairdrop-salt-xyz789';
  const fakeNonce = 'bot_instant_guess_999999999';
  const difficulty = 5;

  const isValid = await verifyPoW(salt, fakeNonce, difficulty);
  assert.equal(isValid, false, 'Tampered nonce must fail PoW check');
});

test('CheckoutRequestSchema: validates idempotency and payment payload correctly', () => {
  const validPayload = {
    eventId: 'fairdrop-main-2026',
    reservationToken: 'res-tok-abcdef1234567890',
    idempotencyKey: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    paymentMethod: 'card'
  };

  const parseResult = CheckoutRequestSchema.safeParse(validPayload);
  assert.equal(parseResult.success, true);

  // Invalid payload missing idempotencyKey UUID
  const invalidPayload = {
    ...validPayload,
    idempotencyKey: 'not-a-valid-uuid'
  };
  const invalidResult = CheckoutRequestSchema.safeParse(invalidPayload);
  assert.equal(invalidResult.success, false);
});

test('FairDropError: formats typed errors adhering to {code, message}', () => {
  const err = new FairDropError('SEATS_SOLD_OUT', 'All 500 seats have been reserved');
  const json = err.toJSON();

  assert.equal(json.code, 'SEATS_SOLD_OUT');
  assert.equal(json.message, 'All 500 seats have been reserved');

  const validated = AppErrorSchema.safeParse(json);
  assert.equal(validated.success, true);
});

test('Constants: total seats equals 500 and flash crowd equals 50,000', () => {
  assert.equal(DROP_CONSTANTS.TOTAL_SEATS, 500);
  assert.equal(DROP_CONSTANTS.SIMULATED_CROWD_SIZE, 50000);
  assert.equal(DROP_CONSTANTS.PURCHASE_WINDOW_SECONDS, 120);
});
