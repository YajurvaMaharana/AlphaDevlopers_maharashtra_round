import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../server';

describe('GET /metrics/stream Extended Telemetry & Fairness SLA', () => {
  let app: any;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('calculates seatsByLane, activeClusters, appealsGranted, authMethodShare, and fairnessSla', async () => {
    // Populate Redis metrics state
    await app.redis.hset('metrics:seats_won', {
      bot: '4',
      human: '196',
    });

    await app.redis.hset('metrics:seats_by_lane', {
      low: '160',
      medium: '30',
      high: '10',
    });

    await app.redis.del('metrics:active_cluster_sizes');
    await app.redis.rpush('metrics:active_cluster_sizes', '15', '9', '4');

    await app.redis.del('drop:fairdrop-main-2026:audit:appeals');
    await app.redis.rpush('drop:fairdrop-main-2026:audit:appeals', 'appeal1', 'appeal2', 'appeal3');

    await app.redis.hset('metrics:auth_method_counts', {
      google: '70',
      otp: '30',
    });

    // Test SSE endpoint with once=true for inject
    const res = await app.inject({
      method: 'GET',
      url: '/metrics/stream?once=true',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    
    // Check initial SSE data chunk
    const bodyText = res.body;
    expect(bodyText).toContain('data:');
    
    const jsonMatch = bodyText.match(/data:\s*(\{.*\})/);
    expect(jsonMatch).not.toBeNull();
    const data = JSON.parse(jsonMatch![1]);

    // 1. seatsByLane
    expect(data.seatsByLane).toBeDefined();
    expect(data.seatsByLane.low).toBe(160);
    expect(data.seatsByLane.medium).toBe(30);
    expect(data.seatsByLane.high).toBe(10);

    // 2. activeClusters
    expect(data.activeClusters).toBeDefined();
    expect(data.activeClusters.count).toBe(3);
    expect(data.activeClusters.sizes).toEqual([15, 9, 4]);

    // 3. appealsGranted
    expect(data.appealsGranted).toBe(3);

    // 4. authMethodShare
    expect(data.authMethodShare).toBeDefined();
    expect(data.authMethodShare.google).toBe(0.7);
    expect(data.authMethodShare.otp).toBe(0.3);

    // 5. fairnessSla
    expect(data.fairnessSla).toBeDefined();
    expect(data.fairnessSla.target).toBe(0.05);
    // botSeatShare: 4 / 200 = 0.02
    expect(data.fairnessSla.botSeatShare).toBe(0.02);
    expect(data.fairnessSla.passing).toBe(true);

    // 6. Existing fields remain unchanged
    expect(data.timestamp).toBeDefined();
    expect(data.requestsPerSecond).toBeDefined();
    expect(data.seatsSold).toBeDefined();
    expect(data.botSeatSharePct).toBe(2);
    expect(data.humanSeatSharePct).toBe(98);
    expect(data.giniCoefficient).toBeDefined();
    expect(data.speedAdvantageIndex).toBeDefined();
    expect(data.funnel).toBeDefined();
  });
});
