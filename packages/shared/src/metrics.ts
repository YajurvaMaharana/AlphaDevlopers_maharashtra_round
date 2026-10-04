import { z } from 'zod';

// ==========================================
// GET /metrics/stream (Server-Sent Events)
// ==========================================
export const MetricsStreamQuerySchema = z.object({
  interval: z.coerce.number().int().min(500).max(10000).default(2000)
});
export type MetricsStreamQuery = z.infer<typeof MetricsStreamQuerySchema>;

export const FunnelMetricsSchema = z.object({
  waitingRoom: z.number().int().nonnegative(),
  admitted: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative()
});
export type FunnelMetrics = z.infer<typeof FunnelMetricsSchema>;

export const SeatsByLaneSchema = z.object({
  low: z.number().int().nonnegative().default(0),
  medium: z.number().int().nonnegative().default(0),
  high: z.number().int().nonnegative().default(0)
});
export type SeatsByLane = z.infer<typeof SeatsByLaneSchema>;

export const ActiveClustersSchema = z.object({
  count: z.number().int().nonnegative().default(0),
  sizes: z.array(z.number().int().nonnegative()).default([])
});
export type ActiveClusters = z.infer<typeof ActiveClustersSchema>;

export const AuthMethodShareSchema = z.object({
  google: z.number().min(0).max(1).default(0.5),
  otp: z.number().min(0).max(1).default(0.5)
});
export type AuthMethodShare = z.infer<typeof AuthMethodShareSchema>;

export const FairnessSlaSchema = z.object({
  target: z.number().min(0).max(1).default(0.05),
  botSeatShare: z.number().min(0).max(1),
  passing: z.boolean()
});
export type FairnessSla = z.infer<typeof FairnessSlaSchema>;

export const LiveMetricsPayloadSchema = z.object({
  timestamp: z.number().int().positive(),
  requestsPerSecond: z.number().nonnegative(),
  activeConnections: z.number().int().nonnegative(),
  seatsSold: z.number().int().nonnegative(),
  seatsHeld: z.number().int().nonnegative(),
  seatsRemaining: z.number().int().nonnegative(),
  totalInventory: z.number().int().positive().default(500),
  botSeatSharePct: z.number().min(0).max(100),
  humanSeatSharePct: z.number().min(0).max(100),
  giniCoefficient: z.number().min(0).max(1), // 0 = complete equality, 1 = complete inequality
  speedAdvantageIndex: z.number().min(-1).max(1), // 0 = no speed advantage, -1 = strict FCFS
  p95LatencyMs: z.number().nonnegative(),
  p99LatencyMs: z.number().nonnegative(),
  rateLimit429Count: z.number().int().nonnegative(),
  powBlockedCount: z.number().int().nonnegative(),
  oversellCount: z.number().int().default(0), // strict invariant: must be 0
  defensesEnabled: z.boolean(),
  funnel: FunnelMetricsSchema,

  // Extended telemetry & SLA fields
  seatsByLane: SeatsByLaneSchema.optional(),
  activeClusters: ActiveClustersSchema.optional(),
  appealsGranted: z.number().int().nonnegative().optional(),
  authMethodShare: AuthMethodShareSchema.optional(),
  fairnessSla: FairnessSlaSchema.optional()
});
export type LiveMetricsPayload = z.infer<typeof LiveMetricsPayloadSchema>;

export const MetricsStreamEventSchema = z.object({
  type: z.literal('METRICS_UPDATE'),
  data: LiveMetricsPayloadSchema
});
export type MetricsStreamEvent = z.infer<typeof MetricsStreamEventSchema>;

// Adversarial and bot telemetry schemas
export const AdversarialAttackTypeEnum = z.enum([
  'NONE',
  'SPEED_BOTS',
  'VOLUME_DDOS',
  'SYBIL_SWARM',
  'REPLAY_ATTACK'
]);
export type AdversarialAttackType = z.infer<typeof AdversarialAttackTypeEnum>;

export const AdversarialMetricsSchema = z.object({
  timestamp: z.number().int(),
  attackType: AdversarialAttackTypeEnum,
  activeAttackName: z.string(),
  totalSimulatedParticipants: z.number().int(),
  humanParticipants: z.number().int(),
  botParticipants: z.number().int(),
  requestsPerSecond: z.number(),
  humanSeatsWon: z.number().int(),
  botSeatsWon: z.number().int(),
  totalAllocatedSeats: z.number().int(),
  totalSeats: z.number().int(),
  blockedByProofOfWork: z.number().int(),
  blockedByRateLimit: z.number().int(),
  blockedByIdempotency: z.number().int(),
  fairnessGiniScore: z.number().min(0).max(1),
  avgHumanLatencyMs: z.number(),
  avgBotLatencyMs: z.number(),
  serverCpuLoadPct: z.number().min(0).max(100),
  activeAttackerCostEstimateUsd: z.number()
});
export type AdversarialMetrics = z.infer<typeof AdversarialMetricsSchema>;
