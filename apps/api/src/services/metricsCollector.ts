import { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * LINT ANNOTATION:
 * The X-Sim-Cohort header MUST ONLY be used for calculating analytics and ground truth metrics.
 * UNDER NO CIRCUMSTANCES should any defense, rate-limiting, risk scoring, or admission logic
 * read or branch based on this value. It represents the simulation oracle data.
 */
export function getSimCohort(request: FastifyRequest): 'human' | 'bot' | 'unknown' {
  const cohort = request.headers['x-sim-cohort'];
  if (cohort === 'human' || cohort === 'bot') {
    return cohort;
  }
  return 'unknown';
}

export async function recordRequestMetrics(fastify: FastifyInstance, request: FastifyRequest, responseTime: number, statusCode: number) {
  const cohort = getSimCohort(request);
  const route = request.routeOptions.url || 'unknown';
  const pipeline = fastify.redis.pipeline();

  // 1. Requests/sec (bucketed by current second)
  const currentSec = Math.floor(Date.now() / 1000);
  pipeline.hincrby(`metrics:req_sec:${currentSec}`, 'total', 1);
  if (statusCode === 429) {
    pipeline.hincrby(`metrics:req_sec:${currentSec}`, '429', 1);
  }
  pipeline.expire(`metrics:req_sec:${currentSec}`, 60); // keep for 60s

  // 2. Latency per route (using fixed buckets in a hash)
  // Buckets: <50ms, 50-200ms, 200-1000ms, >1000ms
  let bucket = '>1000ms';
  if (responseTime < 50) bucket = '<50ms';
  else if (responseTime < 200) bucket = '50-200ms';
  else if (responseTime < 1000) bucket = '200-1000ms';
  pipeline.hincrby(`metrics:latency:${route}`, bucket, 1);
  pipeline.hincrby(`metrics:latency:global`, bucket, 1);

  // 3. Funnel & Cohort Tracking (General)
  pipeline.hincrby('metrics:cohort_reqs', cohort, 1);

  await pipeline.exec().catch(err => fastify.log.error(err));
}

export async function recordFunnelEvent(fastify: FastifyInstance, event: 'joined' | 'admitted' | 'reserved' | 'paid', cohort: 'human' | 'bot' | 'unknown', userId: string) {
  const pipeline = fastify.redis.pipeline();
  
  pipeline.hincrby(`metrics:funnel:${event}`, 'total', 1);
  pipeline.hincrby(`metrics:funnel:${event}`, cohort, 1);

  // If this is a seat win (reserved/paid), track seats per identity for Gini
  if (event === 'reserved' || event === 'paid') {
    pipeline.hincrby('metrics:seats_per_user', userId, 1);
    pipeline.hincrby('metrics:seats_won', cohort, 1);
  }

  await pipeline.exec().catch(err => fastify.log.error(err));
}

export async function recordSpeedDecile(fastify: FastifyInstance, decile: number, cohort: 'human' | 'bot' | 'unknown') {
  if (decile >= 1 && decile <= 10) {
    await fastify.redis.hincrby(`metrics:speed_deciles:${decile}`, cohort, 1);
  }
}

export async function recordSpeedAdvantage(fastify: FastifyInstance, arrivalRank: number, finalRank: number) {
  // Push the pairs to calculate Spearman correlation
  const pipeline = fastify.redis.pipeline();
  pipeline.lpush('metrics:spearman:arrival', arrivalRank.toString());
  pipeline.lpush('metrics:spearman:final', finalRank.toString());
  pipeline.ltrim('metrics:spearman:arrival', 0, 999);
  pipeline.ltrim('metrics:spearman:final', 0, 999);
  await pipeline.exec();
}

export async function recordReservationExpired(fastify: FastifyInstance) {
  await fastify.redis.hincrby('metrics:system', 'reservations_expired', 1);
}

export async function recordPaymentFailure(fastify: FastifyInstance) {
  await fastify.redis.hincrby('metrics:system', 'payment_failures', 1);
}

export async function recordOversellViolation(fastify: FastifyInstance) {
  await fastify.redis.hincrby('metrics:system', 'oversell_violations', 1);
}

export async function recordReconnectSuccess(fastify: FastifyInstance) {
  await fastify.redis.hincrby('metrics:system', 'reconnect_success', 1);
}

export async function recordPowBlock(fastify: FastifyInstance) {
  await fastify.redis.hincrby('metrics:system', 'pow_blocks', 1);
}
