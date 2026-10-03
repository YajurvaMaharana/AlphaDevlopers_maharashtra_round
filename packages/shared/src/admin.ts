import { z } from 'zod';

// ==========================================
// POST /admin/defenses
// ==========================================
export const AdminDefensesRequestSchema = z.object({
  enabled: z.boolean(),
  rateLimiting: z.boolean().optional(),
  powRequired: z.boolean().optional(),
  powDifficulty: z.number().int().min(1).max(8).optional(),
  tarpitting: z.boolean().optional(),
  strictFingerprinting: z.boolean().optional()
});
export type AdminDefensesRequest = z.infer<typeof AdminDefensesRequestSchema>;

export const AdminDefensesResponseSchema = z.object({
  success: z.boolean(),
  defenses: z.object({
    enabled: z.boolean(),
    rateLimiting: z.boolean(),
    powRequired: z.boolean(),
    powDifficulty: z.number().int(),
    tarpitting: z.boolean(),
    strictFingerprinting: z.boolean()
  }),
  updatedAt: z.number().int().positive()
});
export type AdminDefensesResponse = z.infer<typeof AdminDefensesResponseSchema>;

// ==========================================
// POST /admin/drop/start
// ==========================================
export const AdminDropStartRequestSchema = z.object({
  dropId: z.string().min(1),
  totalSeats: z.number().int().positive().default(500),
  shuffleAt: z.number().int().positive().optional(),
  seed: z.string().optional()
});
export type AdminDropStartRequest = z.infer<typeof AdminDropStartRequestSchema>;

export const AdminDropStartResponseSchema = z.object({
  success: z.boolean(),
  dropId: z.string(),
  phase: z.enum(['WAITING_ROOM', 'ACTIVE']),
  startedAt: z.number().int().positive(),
  totalSeats: z.number().int().positive()
});
export type AdminDropStartResponse = z.infer<typeof AdminDropStartResponseSchema>;

// ==========================================
// POST /admin/drop/reset
// ==========================================
export const AdminDropResetRequestSchema = z.object({
  dropId: z.string().min(1),
  preserveUsers: z.boolean().optional().default(false)
});
export type AdminDropResetRequest = z.infer<typeof AdminDropResetRequestSchema>;

export const AdminDropResetResponseSchema = z.object({
  success: z.boolean(),
  dropId: z.string(),
  resetAt: z.number().int().positive(),
  message: z.string()
});
export type AdminDropResetResponse = z.infer<typeof AdminDropResetResponseSchema>;

// ==========================================
// POST /admin/botlab/run
// ==========================================
export const BotLabScenarioEnum = z.enum([
  'baseline_humans',
  'naive_flood',
  'distributed_botnet',
  'replay_duplicate',
  'sybil_signup',
  'slow_payment',
  'headless_mimic'
]);
export type BotLabScenario = z.infer<typeof BotLabScenarioEnum>;

export const AdminBotLabRunRequestSchema = z.object({
  scenario: BotLabScenarioEnum,
  totalClients: z.number().int().min(10).max(50000).default(5000),
  botRatio: z.number().min(0).max(1).default(0.8),
  durationSeconds: z.number().int().min(5).max(300).default(30)
});
export type AdminBotLabRunRequest = z.infer<typeof AdminBotLabRunRequestSchema>;

export const AdminBotLabRunResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(['STARTING', 'RUNNING']),
  scenario: BotLabScenarioEnum,
  parameters: z.object({
    totalClients: z.number().int(),
    botRatio: z.number(),
    durationSeconds: z.number().int()
  }),
  startedAt: z.number().int().positive()
});
export type AdminBotLabRunResponse = z.infer<typeof AdminBotLabRunResponseSchema>;

// ==========================================
// GET /admin/invariants
// ==========================================
export const InventoryInvariantSchema = z.object({
  total: z.number().int().positive(),
  sold: z.number().int().nonnegative(),
  held: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  invariantFormula: z.literal('sold + held + available = total inventory'),
  isConserved: z.boolean(),
  oversellDelta: z.number().int()
});
export type InventoryInvariant = z.infer<typeof InventoryInvariantSchema>;

export const AdminInvariantsResponseSchema = z.object({
  isValid: z.boolean(),
  inventory: InventoryInvariantSchema,
  redisPostgresParity: z.boolean(),
  duplicateAllocations: z.number().int().nonnegative(),
  timestamp: z.number().int().positive()
});
export type AdminInvariantsResponse = z.infer<typeof AdminInvariantsResponseSchema>;

// ==========================================
// POST /admin/chaos
// ==========================================
export const ChaosActionEnum = z.enum([
  'kill_api_replica',
  'restart_redis',
  'delay_postgres',
  'simulate_payment_outage'
]);
export type ChaosAction = z.infer<typeof ChaosActionEnum>;

export const AdminChaosRequestSchema = z.object({
  action: ChaosActionEnum,
  durationSeconds: z.number().int().positive().default(10)
});
export type AdminChaosRequest = z.infer<typeof AdminChaosRequestSchema>;

export const AdminChaosResponseSchema = z.object({
  success: z.boolean(),
  action: ChaosActionEnum,
  appliedAt: z.number().int().positive(),
  status: z.literal('TRIGGERED'),
  details: z.string()
});
export type AdminChaosResponse = z.infer<typeof AdminChaosResponseSchema>;

// ==========================================
// Bot Lab Run Report (for Defenses OFF vs ON comparisons)
// ==========================================
export const RunReportMetricsSchema = z.object({
  botSeatSharePct: z.number().min(0).max(100),
  humanSeatSharePct: z.number().min(0).max(100),
  giniCoefficient: z.number().min(0).max(1),
  speedAdvantageIndex: z.number().min(-1).max(1),
  oversellCount: z.number().int().default(0),
  p95LatencyMs: z.number().nonnegative(),
  errorRatePct: z.number().min(0).max(100),
  totalRequests: z.number().int().nonnegative().optional(),
  rejectedRequests: z.number().int().nonnegative().optional(),
  seatsSold: z.number().int().nonnegative().optional(),
  totalSeats: z.number().int().default(500)
});
export type RunReportMetrics = z.infer<typeof RunReportMetricsSchema>;

export const RunReportSchema = z.object({
  runId: z.string(),
  scenario: BotLabScenarioEnum,
  scenarioName: z.string().optional(),
  defensesEnabled: z.boolean(),
  parameters: z.object({
    totalClients: z.number().int(),
    botRatio: z.number(),
    durationSeconds: z.number().int(),
    totalSeats: z.number().int().default(500),
    rateLimitRps: z.number().optional(),
    powDifficulty: z.number().optional()
  }),
  metrics: RunReportMetricsSchema,
  completedAt: z.number().int().positive()
});
export type RunReport = z.infer<typeof RunReportSchema>;
