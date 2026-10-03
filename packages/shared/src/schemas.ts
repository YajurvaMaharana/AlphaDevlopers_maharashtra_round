import { z } from 'zod';
import { PoWSolutionSchema } from './pow';

export const DropPhaseEnum = z.enum([
  'UPCOMING',
  'WAITING_ROOM',
  'SHUFFLE',
  'ACTIVE',
  'SOLD_OUT'
]);

export type DropPhase = z.infer<typeof DropPhaseEnum>;

export const EventConfigSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default('FairDrop Protected High-Demand Sale'),
  totalSeats: z.number().int().positive().default(500),
  remainingSeats: z.number().int().nonnegative().default(500),
  priceCents: z.number().int().nonnegative().default(9900),
  currency: z.string().default('USD'),
  waitingRoomOpensAt: z.number().int().positive(),
  dropStartsAt: z.number().int().positive(),
  purchaseWindowSeconds: z.number().int().positive().default(120),
  currentPhase: DropPhaseEnum.default('WAITING_ROOM')
});

export type EventConfig = z.infer<typeof EventConfigSchema>;

export const JoinWaitingRoomRequestSchema = z.object({
  eventId: z.string().min(1),
  clientId: z.string().min(1),
  fingerprint: z.string().min(8),
  solution: PoWSolutionSchema
});

export type JoinWaitingRoomRequest = z.infer<typeof JoinWaitingRoomRequestSchema>;

export const JoinWaitingRoomResponseSchema = z.object({
  success: z.boolean(),
  clientId: z.string(),
  joinedAt: z.number().int(),
  phase: DropPhaseEnum,
  waitingRoomTotal: z.number().int().nonnegative(),
  message: z.string()
});

export type JoinWaitingRoomResponse = z.infer<typeof JoinWaitingRoomResponseSchema>;

export const QueueStatusSchema = z.object({
  eventId: z.string(),
  clientId: z.string(),
  phase: DropPhaseEnum,
  position: z.number().int().nonnegative().nullable(),
  totalInQueue: z.number().int().nonnegative(),
  remainingSeats: z.number().int().nonnegative(),
  estimatedWaitSeconds: z.number().int().nonnegative().nullable(),
  isEligibleForReservation: z.boolean(),
  reservationToken: z.string().nullable().optional(),
  seatNumber: z.number().int().nullable().optional(),
  reservationExpiresAt: z.number().int().nullable().optional()
});

export type QueueStatus = z.infer<typeof QueueStatusSchema>;

export const ReservationGrantSchema = z.object({
  reservationToken: z.string().min(16),
  eventId: z.string(),
  clientId: z.string(),
  seatNumber: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  lockDurationSeconds: z.number().int().positive()
});

export type ReservationGrant = z.infer<typeof ReservationGrantSchema>;

export const CheckoutRequestSchema = z.object({
  eventId: z.string().min(1),
  reservationToken: z.string().min(16),
  idempotencyKey: z.string().uuid(),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  paymentMethod: z.enum(['card', 'mock_gateway']).default('card'),
  cardNumber: z.string().min(12).max(19).optional(),
  cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/, 'MM/YY required').optional(),
  cardCvc: z.string().min(3).max(4).optional()
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export const CheckoutResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string(),
  seatNumber: z.number().int().positive(),
  eventId: z.string(),
  buyerName: z.string(),
  buyerEmail: z.string(),
  purchasedAt: z.number().int().positive(),
  ticketHash: z.string(),
  amountCents: z.number().int().positive()
});

export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

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
  fairnessGiniScore: z.number().min(0).max(1), // 1.0 = optimal fair distribution
  avgHumanLatencyMs: z.number(),
  avgBotLatencyMs: z.number(),
  serverCpuLoadPct: z.number().min(0).max(100),
  activeAttackerCostEstimateUsd: z.number()
});

export type AdversarialMetrics = z.infer<typeof AdversarialMetricsSchema>;

export const SSEEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HEARTBEAT'),
    data: z.object({ timestamp: z.number().int() })
  }),
  z.object({
    type: z.literal('DROP_STATUS'),
    data: EventConfigSchema
  }),
  z.object({
    type: z.literal('QUEUE_UPDATE'),
    data: QueueStatusSchema
  }),
  z.object({
    type: z.literal('RESERVATION_GRANTED'),
    data: ReservationGrantSchema
  }),
  z.object({
    type: z.literal('SEATS_SOLD_OUT'),
    data: z.object({ eventId: z.string(), message: z.string() })
  })
]);

export type SSEEvent = z.infer<typeof SSEEventSchema>;
