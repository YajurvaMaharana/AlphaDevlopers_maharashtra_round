import { z } from 'zod';

export const FunnelCountsSchema = z.object({
  joined: z.number().int().nonnegative(),
  admitted: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative(),
});
export type FunnelCounts = z.infer<typeof FunnelCountsSchema>;

export const RouteLatencySchema = z.object({
  p50: z.number().nonnegative(),
  p95: z.number().nonnegative(),
  p99: z.number().nonnegative(),
});
export type RouteLatency = z.infer<typeof RouteLatencySchema>;

export const SeatsWonByCohortSchema = z.object({
  human: z.number().int().nonnegative(),
  bot: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});
export type SeatsWonByCohort = z.infer<typeof SeatsWonByCohortSchema>;

export const MetricsStreamEventSchema = z.object({
  requestsPerSec: z.number().nonnegative(),
  rate429: z.number().nonnegative(),
  latency: z.record(z.string(), RouteLatencySchema),
  seatsWonByCohort: SeatsWonByCohortSchema,
  seatsPerIdentity: z.record(z.string(), z.number().int().nonnegative()),
  reservationsCreated: z.number().int().nonnegative(),
  reservationsExpired: z.number().int().nonnegative(),
  paymentFailures: z.number().int().nonnegative(),
  oversellViolations: z.number().int().nonnegative(),
  reconnectSuccessCount: z.number().int().nonnegative(),
  botSeatShare: z.number().min(0).max(1),
  humanSeatShare: z.number().min(0).max(1),
  giniCoefficient: z.number().min(0).max(1),
  speedAdvantageIndex: z.number().min(-1).max(1),
  winRateBySpeedDecile: z.array(z.number().min(0).max(1)).length(10),
  humanWinProbability: z.number().min(0).max(1),
  funnel: FunnelCountsSchema,
});
export type MetricsStreamEvent = z.infer<typeof MetricsStreamEventSchema>;

export const RunReportSchema = z.object({
  runId: z.string(),
  scenario: z.string(),
  durationSec: z.number().positive(),
  metrics: MetricsStreamEventSchema,
});
export type RunReport = z.infer<typeof RunReportSchema>;
