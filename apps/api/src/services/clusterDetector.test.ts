import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../server';
import {
  recordIdentityCluster,
  runClusterDetectionCycle,
  getAllClusters,
  extractFpBucket,
  extractUaFamily,
  computeClusterId,
} from './clusterDetector';

describe('Cluster Detector Service', () => {
  let app: any;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
    // Clear Redis mock keys
    if (app.redis && typeof app.redis.del === 'function') {
      const activeIds = await app.redis.smembers('clusters:active');
      for (const id of activeIds) {
        await app.redis.del(`cluster:members:${id}`);
        await app.redis.del(`cluster:meta:${id}`);
        await app.redis.del(`cluster:suspicious:${id}`);
        await app.redis.del(`tarpit:cluster:${id}`);
        await app.redis.del(`pow:cluster:${id}`);
      }
      await app.redis.del('clusters:active');
      await app.redis.del('clusters:suspicious');
      await app.redis.del('events:stream');
      await app.redis.del('lock:cluster_detector');
    }
  });

  describe('Pure Feature Extractors & Key Generation', () => {
    it('extracts fingerprint buckets consistently', () => {
      expect(extractFpBucket('0123456789abcdef1234')).toBe('0123456789ab');
      expect(extractFpBucket('short_fp')).toBe('short_fp');
      expect(extractFpBucket('')).toBe('fp_empty');
    });

    it('extracts canonical User-Agent families without cohort headers', () => {
      expect(extractUaFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 HeadlessChrome/120.0')).toBe('HeadlessBot');
      expect(extractUaFamily('python-requests/2.31.0')).toBe('ScriptClient');
      expect(extractUaFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0')).toBe('Chrome');
      expect(extractUaFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox');
      expect(extractUaFamily('')).toBe('Unknown');
    });

    it('generates deterministic cluster IDs from 4-tuple', () => {
      const id1 = computeClusterId('192.168.1.0/24', 'datacenter', 'fp_bucket_1', 'HeadlessBot');
      const id2 = computeClusterId('192.168.1.0/24', 'datacenter', 'fp_bucket_1', 'HeadlessBot');
      const id3 = computeClusterId('192.168.2.0/24', 'datacenter', 'fp_bucket_1', 'HeadlessBot');
      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
    });
  });

  describe('Sybil Cluster Benchmark: 200 Bot Identities across 3 Subnets vs 300 Normal Users', () => {
    it('flags exactly the 3 botnet subnets with 0 false positives', async () => {
      const startTime = Date.now();

      // 1. Simulate 200 botnet identities across 3 specific subnets:
      // Subnet A: 192.168.1.0/24 (70 bots)
      for (let i = 0; i < 70; i++) {
        await recordIdentityCluster(app.redis, {
          userId: `bot_alpha_${i}`,
          ip: `192.168.1.${10 + (i % 200)}`,
          subnet24: '192.168.1.0/24',
          asnType: 'datacenter',
          deviceFp: 'canvas_botnet_cluster_alpha_fixed_hash',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0',
          timestamp: startTime,
        });
      }

      // Subnet B: 10.0.4.0/24 (65 bots)
      for (let i = 0; i < 65; i++) {
        await recordIdentityCluster(app.redis, {
          userId: `bot_beta_${i}`,
          ip: `10.0.4.${5 + (i % 200)}`,
          subnet24: '10.0.4.0/24',
          asnType: 'datacenter',
          deviceFp: 'canvas_botnet_cluster_beta_fixed_hash',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HeadlessChrome/121.0',
          timestamp: startTime,
        });
      }

      // Subnet C: 185.220.101.0/24 (65 bots)
      for (let i = 0; i < 65; i++) {
        await recordIdentityCluster(app.redis, {
          userId: `bot_gamma_${i}`,
          ip: `185.220.101.${1 + (i % 200)}`,
          subnet24: '185.220.101.0/24',
          asnType: 'vpn_proxy',
          deviceFp: 'canvas_botnet_cluster_gamma_fixed_hash',
          userAgent: 'python-requests/2.31.0',
          timestamp: startTime,
        });
      }

      // 2. Simulate 300 normal organic users dispersed across 150 diverse residential subnets (1-2 per subnet)
      const browserUas = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      ];

      for (let i = 0; i < 300; i++) {
        const subnetOctet1 = 73 + (i % 5);
        const subnetOctet2 = Math.floor(i / 2);
        const subnet24 = `${subnetOctet1}.${subnetOctet2}.10.0/24`;

        await recordIdentityCluster(app.redis, {
          userId: `human_user_${i}`,
          ip: `${subnetOctet1}.${subnetOctet2}.10.${1 + (i % 200)}`,
          subnet24,
          asnType: 'residential',
          deviceFp: `human_entropy_canvas_audio_${i}_${Math.random().toString(36).slice(2, 10)}`,
          userAgent: browserUas[i % browserUas.length],
          timestamp: startTime,
        });
      }

      // 3. Execute Cluster Detection Cycle with threshold = 15
      const result = await runClusterDetectionCycle(app, {
        windowSec: 60,
        clusterSizeThreshold: 15,
        checkIntervalMs: 5000,
        tarpitTtlSec: 300,
        powEscalationDifficulty: 6,
      });

      const flaggedSubnets = result.flaggedClusters.map((c) => c.subnet24);
      const expectedBotSubnets = ['192.168.1.0/24', '10.0.4.0/24', '185.220.101.0/24'];

      // 4. Calculate False Positives and Negatives
      const falsePositives = result.flaggedClusters.filter(
        (c) => !expectedBotSubnets.includes(c.subnet24)
      );
      const falseNegatives = expectedBotSubnets.filter(
        (sub) => !flaggedSubnets.includes(sub)
      );

      const falsePositiveCount = falsePositives.length;
      const falseNegativeCount = falseNegatives.length;

      // Print Benchmark Results Table
      console.log('================================================================================');
      console.log('[CLUSTER DETECTOR BENCHMARK RESULTS]');
      console.log(`Total Ingested Identities : 500 (200 Botnet across 3 Subnets + 300 Organic Users)`);
      console.log(`Total Flagged Clusters    : ${result.flaggedClusters.length} (Expected: 3)`);
      console.log(`Flagged Subnets           : ${flaggedSubnets.join(', ')}`);
      console.log(`False Positive Count      : ${falsePositiveCount}`);
      console.log(`False Negative Count      : ${falseNegativeCount}`);
      console.log('================================================================================');

      // 5. Assert invariants
      expect(falsePositiveCount).toBe(0);
      expect(falseNegativeCount).toBe(0);
      expect(result.flaggedClusters.length).toBe(3);

      expect(flaggedSubnets).toContain('192.168.1.0/24');
      expect(flaggedSubnets).toContain('10.0.4.0/24');
      expect(flaggedSubnets).toContain('185.220.101.0/24');

      // Verify reasons and actions
      for (const flagged of result.flaggedClusters) {
        expect(flagged.action).toBe('tarpit_and_pow_escalation');
        expect(flagged.reasons.length).toBeGreaterThanOrEqual(2);
        expect(flagged.size).toBeGreaterThanOrEqual(15);
      }

      // Verify event was pushed to events:stream
      const eventList = await app.redis.lrange('events:stream', 0, -1);
      expect(eventList.length).toBeGreaterThanOrEqual(3);
      const parsedEvents = eventList.map((e: string) => JSON.parse(e));
      expect(parsedEvents.some((e: any) => e.layer === 'cluster' && e.subnet24 === '192.168.1.0/24')).toBe(true);
    });
  });

  describe('Defenses Kill-Switch & Admin API', () => {
    it('honours defenses kill-switch when disabled', async () => {
      app.defensesEnabled = false;

      // Ingest 50 bots in a single subnet
      for (let i = 0; i < 50; i++) {
        await recordIdentityCluster(app.redis, {
          userId: `disabled_bot_${i}`,
          ip: `192.168.1.${i}`,
          subnet24: '192.168.1.0/24',
          asnType: 'datacenter',
          deviceFp: 'fixed_bot_fp',
          userAgent: 'HeadlessChrome/120.0',
        });
      }

      const result = await runClusterDetectionCycle(app, {
        windowSec: 60,
        clusterSizeThreshold: 15,
        checkIntervalMs: 5000,
        tarpitTtlSec: 300,
        powEscalationDifficulty: 6,
      });

      expect(result.flaggedClusters.length).toBe(0);
      expect(result.suspiciousCount).toBe(0);
    });

    it('exposes GET /admin/clusters with current clusters, sizes, and reasons', async () => {
      app.defensesEnabled = true;

      // Ingest a cluster
      for (let i = 0; i < 20; i++) {
        await recordIdentityCluster(app.redis, {
          userId: `test_cluster_user_${i}`,
          ip: `3.88.50.${i}`,
          subnet24: '3.88.50.0/24',
          asnType: 'datacenter',
          deviceFp: 'aws_bot_fp_hash',
          userAgent: 'ScriptClient',
        });
      }

      await runClusterDetectionCycle(app, {
        windowSec: 60,
        clusterSizeThreshold: 15,
        checkIntervalMs: 5000,
        tarpitTtlSec: 300,
        powEscalationDifficulty: 6,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/admin/clusters',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.defensesEnabled).toBe(true);
      expect(body.suspiciousClustersCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(body.clusters)).toBe(true);

      const flagged = body.clusters.find((c: any) => c.subnet24 === '3.88.50.0/24');
      expect(flagged).toBeDefined();
      expect(flagged.isSuspicious).toBe(true);
      expect(flagged.size).toBe(20);
      expect(flagged.reasons.length).toBeGreaterThan(0);
    });
  });
});
