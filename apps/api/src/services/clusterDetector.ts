import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { extractSubnet24, AsnType } from './networkSignals';
import { updateRiskScore } from './riskIntegration';

export interface IdentityClusterSignals {
  userId: string;
  ip: string;
  subnet24?: string;
  asnType?: AsnType;
  deviceFp: string;
  userAgent?: string;
  timestamp?: number;
}

export interface ClusterInfo {
  clusterId: string;
  subnet24: string;
  asnType: string;
  fpBucket: string;
  uaFamily: string;
  size: number;
  isSuspicious: boolean;
  action?: string;
  reasons: string[];
  members?: string[];
  flaggedAt?: number;
}

export interface ClusterDetectorConfig {
  windowSec: number;
  clusterSizeThreshold: number;
  checkIntervalMs: number;
  tarpitTtlSec: number;
  powEscalationDifficulty: number;
}

export const DEFAULT_CLUSTER_CONFIG: ClusterDetectorConfig = {
  windowSec: 60,
  clusterSizeThreshold: 15,
  checkIntervalMs: 5000,
  tarpitTtlSec: 300,
  powEscalationDifficulty: 6,
};

/**
 * Extracts fingerprint similarity bucket from raw client fingerprint.
 * Normalizes device entropy / canvas hash into a cluster bucket.
 */
export function extractFpBucket(deviceFp?: string): string {
  if (!deviceFp || typeof deviceFp !== 'string' || deviceFp.trim() === '') {
    return 'fp_empty';
  }
  const clean = deviceFp.trim();
  // Group by first 12 characters of fingerprint hash
  return clean.length > 12 ? clean.slice(0, 12) : clean;
}

/**
 * Normalizes raw User-Agent header into a canonical client family.
 */
export function extractUaFamily(userAgent?: string): string {
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    return 'Unknown';
  }
  const ua = userAgent.toLowerCase();

  if (ua.includes('headless') || ua.includes('puppeteer') || ua.includes('playwright') || ua.includes('selenium')) {
    return 'HeadlessBot';
  }
  if (ua.includes('python') || ua.includes('requests') || ua.includes('curl') || ua.includes('undici') || ua.includes('axios') || ua.includes('k6')) {
    return 'ScriptClient';
  }
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';

  return 'OtherBrowser';
}

/**
 * Computes deterministic cluster key from (subnet24, asnType, fpBucket, uaFamily).
 */
export function computeClusterId(
  subnet24: string,
  asnType: string,
  fpBucket: string,
  uaFamily: string
): string {
  const payload = `${subnet24}|${asnType}|${fpBucket}|${uaFamily}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12);
  return `cls_${hash}`;
}

/**
 * Records an identity arrival into Redis cluster buckets.
 */
export async function recordIdentityCluster(
  redis: any,
  signals: IdentityClusterSignals
): Promise<{ clusterId: string; subnet24: string; asnType: string; fpBucket: string; uaFamily: string }> {
  const subnet24 = signals.subnet24 || extractSubnet24(signals.ip);
  const asnType = signals.asnType || 'unknown';
  const fpBucket = extractFpBucket(signals.deviceFp);
  const uaFamily = extractUaFamily(signals.userAgent);
  const clusterId = computeClusterId(subnet24, asnType, fpBucket, uaFamily);
  const now = signals.timestamp || Date.now();

  const membersKey = `cluster:members:${clusterId}`;
  const metaKey = `cluster:meta:${clusterId}`;
  const activeClustersKey = 'clusters:active';

  // 1. Add userId to cluster members sorted set scored by timestamp
  if (typeof redis.zadd === 'function') {
    await redis.zadd(membersKey, now, signals.userId);
  } else {
    await redis.sadd(membersKey, signals.userId);
  }
  await redis.expire(membersKey, 300);

  // 2. Save cluster metadata
  await redis.hset(metaKey, {
    clusterId,
    subnet24,
    asnType,
    fpBucket,
    uaFamily,
    lastSeen: now,
  });
  await redis.expire(metaKey, 300);

  // 3. Register active cluster in global set
  await redis.sadd(activeClustersKey, clusterId);
  await redis.expire(activeClustersKey, 300);

  // 4. Map user to cluster
  await redis.set(`user:cluster:${signals.userId}`, clusterId, 'EX', 300);

  return { clusterId, subnet24, asnType, fpBucket, uaFamily };
}

/**
 * Runs one cluster detection cycle.
 * Executed every 5s by leader replica (protected by Redis lock).
 */
export async function runClusterDetectionCycle(
  fastify: FastifyInstance,
  config: ClusterDetectorConfig = DEFAULT_CLUSTER_CONFIG
): Promise<{
  activeCount: number;
  suspiciousCount: number;
  flaggedClusters: ClusterInfo[];
}> {
  // 1. Honour Defenses Kill-Switch
  if (fastify.defensesEnabled === false || process.env.DEFENSES_ENABLED === 'false') {
    return {
      activeCount: 0,
      suspiciousCount: 0,
      flaggedClusters: [],
    };
  }

  const redis = fastify.redis;
  if (!redis) {
    return { activeCount: 0, suspiciousCount: 0, flaggedClusters: [] };
  }

  // 2. Leader election: Try to acquire Redis lock for this cycle
  const lockKey = 'lock:cluster_detector';
  const lock = await redis.set(lockKey, 'locked', 'PX', 4500, 'NX');
  if (!lock && process.env.NODE_ENV !== 'test') {
    // Non-leader replica skips execution
    return { activeCount: 0, suspiciousCount: 0, flaggedClusters: [] };
  }

  const now = Date.now();
  const windowCutoff = now - config.windowSec * 1000;
  const activeClusterIds = await redis.smembers('clusters:active');

  const flaggedClusters: ClusterInfo[] = [];

  for (const clusterId of activeClusterIds) {
    const meta = await redis.hgetall(`cluster:meta:${clusterId}`);
    if (!meta || !meta.subnet24) continue;

    const membersKey = `cluster:members:${clusterId}`;
    let members: string[] = [];

    if (typeof redis.zrangebyscore === 'function') {
      members = await redis.zrangebyscore(membersKey, windowCutoff, '+inf');
    } else {
      members = await redis.smembers(membersKey);
    }

    const size = members.length;

    // Check if cluster size exceeds configurable threshold
    if (size >= config.clusterSizeThreshold) {
      const reasons: string[] = [
        `Cluster size ${size} exceeds threshold of ${config.clusterSizeThreshold} within ${config.windowSec}s`,
      ];

      if (meta.asnType === 'datacenter') {
        reasons.push(`datacenter network concentration on ${meta.subnet24}`);
      } else if (meta.asnType === 'vpn_proxy') {
        reasons.push(`vpn/proxy network concentration on ${meta.subnet24}`);
      } else {
        reasons.push(`high concentration on subnet ${meta.subnet24}`);
      }

      reasons.push(`Identical fingerprint bucket [${meta.fpBucket}] across ${size} identities`);
      if (meta.uaFamily && meta.uaFamily !== 'Unknown') {
        reasons.push(`Uniform User-Agent family: ${meta.uaFamily}`);
      }

      // Mark cluster as suspicious in Redis
      await redis.sadd('clusters:suspicious', clusterId);
      await redis.hset(`cluster:suspicious:${clusterId}`, {
        clusterId,
        subnet24: meta.subnet24,
        asnType: meta.asnType,
        fpBucket: meta.fpBucket,
        uaFamily: meta.uaFamily,
        size,
        reasons: JSON.stringify(reasons),
        action: 'tarpit_and_pow_escalation',
        flaggedAt: now,
      });
      await redis.expire(`cluster:suspicious:${clusterId}`, config.tarpitTtlSec);

      // Apply Tarpit & PoW Escalation to the whole cluster
      await redis.set(`tarpit:cluster:${clusterId}`, 1, 'EX', config.tarpitTtlSec);
      await redis.set(`pow:cluster:${clusterId}`, config.powEscalationDifficulty, 'EX', config.tarpitTtlSec);

      // Raise every member's risk score
      for (const memberId of members) {
        await updateRiskScore(fastify, memberId, {
          penaltyCount: 5,
          subnetReuseCount: size,
          behaviorScore: 0.05,
          asnType: meta.asnType as AsnType,
        });
      }

      // Write event to events stream
      const eventPayload = {
        ts: now,
        layer: 'cluster',
        clusterId,
        size,
        action: 'tarpit_and_pow_escalation',
        subnet24: meta.subnet24,
        asnType: meta.asnType,
        reasons,
      };

      await redis.rpush('events:stream', JSON.stringify(eventPayload));

      flaggedClusters.push({
        clusterId,
        subnet24: meta.subnet24,
        asnType: meta.asnType,
        fpBucket: meta.fpBucket,
        uaFamily: meta.uaFamily,
        size,
        isSuspicious: true,
        action: 'tarpit_and_pow_escalation',
        reasons,
        members,
        flaggedAt: now,
      });
    }
  }

  return {
    activeCount: activeClusterIds.length,
    suspiciousCount: flaggedClusters.length,
    flaggedClusters,
  };
}

/**
 * Retrieves all currently tracked clusters and their status.
 */
export async function getAllClusters(
  redis: any,
  windowSec: number = 60
): Promise<ClusterInfo[]> {
  const activeClusterIds = await redis.smembers('clusters:active');
  const suspiciousClusterIds = new Set(await redis.smembers('clusters:suspicious'));
  const now = Date.now();
  const windowCutoff = now - windowSec * 1000;

  const clusterList: ClusterInfo[] = [];

  for (const clusterId of activeClusterIds) {
    const meta = await redis.hgetall(`cluster:meta:${clusterId}`);
    if (!meta || !meta.subnet24) continue;

    const membersKey = `cluster:members:${clusterId}`;
    let members: string[] = [];

    if (typeof redis.zrangebyscore === 'function') {
      members = await redis.zrangebyscore(membersKey, windowCutoff, '+inf');
    } else {
      members = await redis.smembers(membersKey);
    }

    const isSuspicious = suspiciousClusterIds.has(clusterId);
    let reasons: string[] = [];
    let action: string | undefined = undefined;

    if (isSuspicious) {
      const suspData = await redis.hgetall(`cluster:suspicious:${clusterId}`);
      if (suspData && suspData.reasons) {
        try {
          reasons = JSON.parse(suspData.reasons);
        } catch {}
      }
      action = suspData?.action || 'tarpit_and_pow_escalation';
    }

    clusterList.push({
      clusterId,
      subnet24: meta.subnet24,
      asnType: meta.asnType,
      fpBucket: meta.fpBucket,
      uaFamily: meta.uaFamily,
      size: members.length,
      isSuspicious,
      action,
      reasons,
      members,
      flaggedAt: meta.lastSeen ? Number(meta.lastSeen) : undefined,
    });
  }

  clusterList.sort((a, b) => b.size - a.size);
  return clusterList;
}
