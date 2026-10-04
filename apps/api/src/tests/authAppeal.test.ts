import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../server';
import { computeFairId } from '../db/postgres';
import { getOrCreateTicket } from '../services/queueService';

describe('POST /auth/appeal - High Lane Re-Verification & Draw Order Invariant', () => {
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

  it('allows a high lane user to appeal with OTP and lowers risk to standard lane', async () => {
    const email = 'appealing.user@example.com';
    const deviceFp = 'fp_browser_entropy_888';
    const fairId = computeFairId(email, deviceFp);
    const userId = 'usr_high_lane_001';
    const dropId = 'fairdrop-main-2026';

    // 1. Setup user ticket in Redis with rank 42 and high risk tier
    const { ticket } = await getOrCreateTicket(app.redis, dropId, fairId, userId, deviceFp);
    const initialRank = ticket.rank; // 1 or 42

    // Set initial high risk score (85) and tier ('high')
    await app.redis.hset(`risk:${userId}`, {
      score: '85',
      tier: 'high',
      reasons: JSON.stringify(['High request rate', 'datacenter network']),
    });

    // Also set ticket lane to high
    await app.redis.hset(`drop:${dropId}:ticket:${fairId}`, {
      riskTier: 'high',
      lane: 'high',
    });

    // 2. Perform POST /auth/appeal
    const appealRes = await app.inject({
      method: 'POST',
      url: '/auth/appeal',
      payload: {
        fairId,
        userId,
        dropId,
        reAuthMethod: 'otp',
        email,
        otpCode: '123456',
        deviceFp,
      },
    });

    expect(appealRes.statusCode).toBe(200);
    const appealData = JSON.parse(appealRes.body);

    // Assert typed UI response
    expect(appealData.success).toBe(true);
    expect(appealData.message).toBe("You've been moved to the standard lane");
    expect(appealData.previousRiskTier).toBe('high');
    expect(appealData.newRiskTier).toMatch(/low|medium/);
    expect(appealData.previousScore).toBe(85);
    expect(appealData.newScore).toBe(40); // 85 - 45
    expect(appealData.auditEventId).toBeDefined();
    expect(appealData.appealUsed).toBe(true);
    expect(appealData.drawRank).toBe(initialRank);

    // 3. INVARIANT: Draw order / rank is completely unchanged (cannot jump draw order, only the lane)
    const updatedTicket = await app.redis.hgetall(`drop:${dropId}:ticket:${fairId}`);
    expect(parseInt(updatedTicket.rank, 10)).toBe(initialRank);
    expect(updatedTicket.positionToken).toBe(ticket.positionToken);
    expect(updatedTicket.riskTier).toBe(appealData.newRiskTier);

    // 4. Assert audit event written to Redis
    const auditEventsRaw = await app.redis.lrange(`drop:${dropId}:audit:appeals`, 0, -1);
    expect(auditEventsRaw.length).toBeGreaterThanOrEqual(1);
    const lastAudit = JSON.parse(auditEventsRaw[auditEventsRaw.length - 1]);
    expect(lastAudit.type).toBe('USER_RISK_APPEAL');
    expect(lastAudit.fairId).toBe(fairId);
    expect(lastAudit.previousRiskTier).toBe('high');
    expect(lastAudit.newRiskTier).toBe(appealData.newRiskTier);
    expect(lastAudit.drawRank).toBe(initialRank);

    // 5. INVARIANT: Limit to exactly ONE appeal per FairID per drop
    const secondAppealRes = await app.inject({
      method: 'POST',
      url: '/auth/appeal',
      payload: {
        fairId,
        userId,
        dropId,
        reAuthMethod: 'otp',
        email,
        otpCode: '123456',
      },
    });

    expect(secondAppealRes.statusCode).toBe(409);
    const secondData = JSON.parse(secondAppealRes.body);
    expect(secondData.success).toBe(false);
    expect(secondData.message).toContain('already been submitted');
  });

  it('allows high lane user to appeal with Google auth', async () => {
    const email = 'google.appeal@example.com';
    const fairId = computeFairId(email, 'fp_google_appeal');
    const userId = 'usr_google_high_02';
    const dropId = 'fairdrop-main-2026';

    await getOrCreateTicket(app.redis, dropId, fairId, userId);
    await app.redis.hset(`risk:${userId}`, {
      score: '75',
      tier: 'high',
    });

    const appealRes = await app.inject({
      method: 'POST',
      url: '/auth/appeal',
      payload: {
        fairId,
        userId,
        dropId,
        reAuthMethod: 'google',
        idToken: 'valid_google_oauth_token',
      },
    });

    expect(appealRes.statusCode).toBe(200);
    const body = JSON.parse(appealRes.body);
    expect(body.success).toBe(true);
    expect(body.newRiskTier).toBe('low');
    expect(body.newScore).toBe(20); // 75 - 55
    expect(body.message).toBe("You've been moved to the standard lane");
  });
});
