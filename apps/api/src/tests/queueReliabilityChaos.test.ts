import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../server';
import {
  computePositionToken,
  computeMonotonicEta,
  getOrCreateTicket,
  getTicketByFairId,
  QUEUE_CONFIG,
} from '../services/queueService';
import { computeFairId } from '../db/postgres';

describe('Queue Reliability, Idempotent FairID Tickets & Chaos Recovery', () => {
  let app: any;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
    if (app.redis && typeof app.redis.del === 'function') {
      const p = app.redis.pipeline();
      p.del('drop:fairdrop-main-2026:participants');
      p.del('drop:fairdrop-main-2026:next_rank');
      await p.exec();
    }
  });

  describe('1. Position Token & FairID Redis Invariants', () => {
    it('stores positionToken against FairID in Redis and survives replica restart', async () => {
      const email = 'verified.fan@example.com';
      const deviceFp = 'canvas_audio_entropy_998811';
      const fairId = computeFairId(email, deviceFp);

      // Join waiting room
      const res1 = await app.inject({
        method: 'POST',
        url: '/drop/join',
        payload: {
          dropId: 'fairdrop-main-2026',
          userId: 'usr_fan_01',
          email,
          fingerprint: deviceFp,
          fairId,
          idempotencyKey: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        },
      });

      expect(res1.statusCode).toBe(200);
      const data1 = JSON.parse(res1.body);
      expect(data1.success).toBe(true);
      expect(data1.positionToken).toBeDefined();
      expect(data1.initialRank).toBe(1);
      expect(data1.isExisting).toBe(false);

      const originalPositionToken = data1.positionToken;
      const originalRank = data1.initialRank;

      // GET /me/state with header x-fair-id
      const stateRes1 = await app.inject({
        method: 'GET',
        url: '/me/state',
        headers: {
          'x-fair-id': fairId,
          'x-user-id': 'usr_fan_01',
        },
      });

      expect(stateRes1.statusCode).toBe(200);
      const state1 = JSON.parse(stateRes1.body);
      expect(state1.positionToken).toBe(originalPositionToken);
      expect(state1.queuePosition).toBe(originalRank);
      expect(state1.fairId).toBe(fairId);

      // CHAOS SIMULATION: Simulate replica crash / termination mid-queue
      // Close existing app replica instance
      await app.close();

      // Launch fresh replica instance connecting to same Redis store
      const replica2 = await buildApp();
      await replica2.ready();

      // Query GET /me/state on fresh replica 2
      const stateRes2 = await replica2.inject({
        method: 'GET',
        url: '/me/state',
        headers: {
          'x-fair-id': fairId,
          'x-user-id': 'usr_fan_01',
        },
      });

      expect(stateRes2.statusCode).toBe(200);
      const state2 = JSON.parse(stateRes2.body);
      // Assert position and positionToken are preserved perfectly across replica restart
      expect(state2.positionToken).toBe(originalPositionToken);
      expect(state2.queuePosition).toBe(originalRank);
      expect(state2.fairId).toBe(fairId);

      await replica2.close();
    });

    it('emits id: on SSE stream for Last-Event-ID resume', async () => {
      const fairId = 'fair_id_sse_test_12345';
      await getOrCreateTicket(app.redis, 'fairdrop-main-2026', fairId, 'usr_sse_test');

      const streamRes = await app.inject({
        method: 'GET',
        url: `/drop/stream?fairId=${fairId}&lastEventId=42&once=true`,
        headers: {
          'last-event-id': '42',
        },
      });

      expect(streamRes.statusCode).toBe(200);
      const body = streamRes.body;
      expect(body).toContain('id: 43');
      expect(body).toContain('QUEUE_UPDATE');
      expect(body).toContain('pos_tok_');
    });
  });

  describe('2. Idempotent Join (Never Creates Second Ticket for Same FairID)', () => {
    it('returns the exact existing ticket on second tab / second device / replay', async () => {
      const fairId = 'fair_id_single_ticket_guarantee_1122';
      const userId = 'usr_alice';

      // Tab 1 (First Join)
      const resTab1 = await app.inject({
        method: 'POST',
        url: '/drop/join',
        payload: {
          dropId: 'fairdrop-main-2026',
          userId,
          fairId,
          fingerprint: 'fp_laptop_chrome',
          idempotencyKey: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        },
      });

      const body1 = JSON.parse(resTab1.body);
      expect(body1.success).toBe(true);
      expect(body1.isExisting).toBe(false);
      const ticketId1 = body1.ticketId;
      const rank1 = body1.initialRank;
      const posToken1 = body1.positionToken;

      // Tab 2 (Simultaneous Join with same FairID)
      const resTab2 = await app.inject({
        method: 'POST',
        url: '/drop/join',
        payload: {
          dropId: 'fairdrop-main-2026',
          userId,
          fairId,
          fingerprint: 'fp_laptop_chrome',
          idempotencyKey: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        },
      });

      const body2 = JSON.parse(resTab2.body);
      expect(body2.success).toBe(true);
      expect(body2.isExisting).toBe(true);
      expect(body2.ticketId).toBe(ticketId1);
      expect(body2.initialRank).toBe(rank1);
      expect(body2.positionToken).toBe(posToken1);

      // Replay / Mobile Device with same FairID
      const resMobile = await app.inject({
        method: 'POST',
        url: '/drop/join',
        payload: {
          dropId: 'fairdrop-main-2026',
          userId,
          fairId,
          fingerprint: 'fp_mobile_safari',
          idempotencyKey: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        },
      });

      const bodyMobile = JSON.parse(resMobile.body);
      expect(bodyMobile.success).toBe(true);
      expect(bodyMobile.isExisting).toBe(true);
      expect(bodyMobile.ticketId).toBe(ticketId1);
      expect(bodyMobile.initialRank).toBe(rank1);

      // Verify Redis participant set contains exactly 1 entry for this FairID
      const participants = await app.redis.smembers('drop:fairdrop-main-2026:participants');
      expect(participants.filter((id: string) => id === fairId).length).toBe(1);
    });
  });

  describe('3. Monotonic Bounded ETA Invariants', () => {
    it('ensures ETA never jumps backwards by more than one batch (30s)', () => {
      const BATCH_DURATION_SEC = QUEUE_CONFIG.BATCH_DURATION_SEC; // 30s

      // Initial calculation for rank 150 (Batch 3 = 90s)
      const eta1 = computeMonotonicEta(150, null);
      expect(eta1).toBe(90);

      // As queue advances to rank 100 (Batch 2 = 60s), ETA decreases smoothly
      const eta2 = computeMonotonicEta(100, eta1);
      expect(eta2).toBe(60);

      // If network latency or queue recalculation experiences an upward spike (e.g. queue pauses or recalculated at rank 400 = 240s raw)
      // The bounded ETA must NOT jump to 240s. It is strictly clamped to previousEta + 30s = 60 + 30 = 90s!
      const etaSpike = computeMonotonicEta(400, eta2);
      expect(etaSpike).toBe(eta2 + BATCH_DURATION_SEC); // 90s
      expect(etaSpike - eta2).toBeLessThanOrEqual(BATCH_DURATION_SEC);

      // Further advances smoothly decay
      const eta3 = computeMonotonicEta(50, etaSpike);
      expect(eta3).toBe(30);

      const etaDone = computeMonotonicEta(0, eta3);
      expect(etaDone).toBe(0);
    });
  });
});
