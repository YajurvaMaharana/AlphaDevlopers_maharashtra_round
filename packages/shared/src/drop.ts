import { z } from 'zod';

export const DROP_CONSTANTS = {
  TOTAL_SEATS: 500,
  SIMULATED_CROWD_SIZE: 50000,
  PURCHASE_WINDOW_SECONDS: 120,
  POW_DEFAULT_DIFFICULTY: 4,
  POW_EXPIRATION_MS: 300000,
  DEFAULT_EVENT_ID: 'fairdrop-main-2026',
  DEFAULT_PRICE_CENTS: 9900
} as const;

// ==========================================
// POST /drop/join
// ==========================================
export const DropJoinRequestSchema = z.object({
  dropId: z.string().min(1),
  powSolutionToken: z.string().optional(),
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID'),
  fingerprint: z.string().min(8),
  signals: z.record(z.any()).optional()
});
export type DropJoinRequest = z.infer<typeof DropJoinRequestSchema>;

export const DropJoinResponseSchema = z.object({
  success: z.boolean(),
  dropId: z.string(),
  status: z.enum(['WAITING_ROOM', 'QUEUED']),
  joinedAt: z.number().int().positive(),
  initialRank: z.number().int().positive().optional(),
  totalParticipants: z.number().int().nonnegative().optional(),
  message: z.string()
});
export type DropJoinResponse = z.infer<typeof DropJoinResponseSchema>;

// Aliases for user-facing and simulation integrations
export const JoinWaitingRoomRequestSchema = z.object({
  eventId: z.string().min(1),
  clientId: z.string().min(1),
  fingerprint: z.string().min(8),
  solution: z.object({
    challengeId: z.string(),
    nonce: z.string(),
    durationMs: z.number().optional()
  })
});
export type JoinWaitingRoomRequest = z.infer<typeof JoinWaitingRoomRequestSchema>;

export const JoinWaitingRoomResponseSchema = z.object({
  success: z.boolean(),
  clientId: z.string(),
  joinedAt: z.number().int(),
  phase: z.string(),
  waitingRoomTotal: z.number().int(),
  message: z.string()
});
export type JoinWaitingRoomResponse = z.infer<typeof JoinWaitingRoomResponseSchema>;

// ==========================================
// GET /drop/stream (Server-Sent Events)
// ==========================================
export const DropStreamQuerySchema = z.object({
  dropId: z.string().min(1),
  token: z.string().optional(),
  lastEventId: z.string().optional()
});
export type DropStreamQuery = z.infer<typeof DropStreamQuerySchema>;

export const DropPhaseEnum = z.enum([
  'UPCOMING',
  'WAITING_ROOM',
  'SHUFFLE',
  'ACTIVE',
  'SOLD_OUT'
]);
export type DropPhase = z.infer<typeof DropPhaseEnum>;

export const DropStreamQueueUpdateSchema = z.object({
  eventId: z.string().optional(),
  clientId: z.string().optional(),
  phase: DropPhaseEnum,
  position: z.number().int().nonnegative().nullable(),
  totalInQueue: z.number().int().nonnegative(),
  remainingSeats: z.number().int().nonnegative(),
  estimatedWaitSeconds: z.number().int().nonnegative().nullable(),
  isEligibleForReservation: z.boolean().optional(),
  reservationToken: z.string().nullable().optional(),
  seatNumber: z.number().int().nullable().optional(),
  reservationExpiresAt: z.number().int().nullable().optional()
});
export type DropStreamQueueUpdate = z.infer<typeof DropStreamQueueUpdateSchema>;
export type QueueStatus = DropStreamQueueUpdate;
export const QueueStatusSchema = DropStreamQueueUpdateSchema;

export const DropStreamStatusSchema = z.object({
  eventId: z.string().default('fairdrop-main-2026'),
  dropId: z.string().optional(),
  title: z.string().default('FairDrop Main Arena: 500 Exclusive Seats'),
  description: z.string().default('Zero-Bot Fair Allocation with Proof-of-Work & Random Waiting Room Shuffle'),
  phase: DropPhaseEnum.default('WAITING_ROOM'),
  currentPhase: DropPhaseEnum.default('WAITING_ROOM'),
  remainingSeats: z.number().int().nonnegative().default(500),
  totalSeats: z.number().int().positive().default(500),
  priceCents: z.number().int().positive().default(9900),
  currency: z.string().default('USD'),
  waitingRoomOpensAt: z.number().int().optional(),
  dropStartsAt: z.number().int().optional(),
  purchaseWindowSeconds: z.number().int().positive().default(120),
  waitingRoomParticipants: z.number().int().nonnegative().default(50000)
});
export type DropStreamStatus = z.infer<typeof DropStreamStatusSchema>;
export type EventConfig = DropStreamStatus;
export const EventConfigSchema = DropStreamStatusSchema;

export const DropStreamAdmissionGrantedSchema = z.object({
  reservationToken: z.string(),
  eventId: z.string().optional(),
  clientId: z.string().optional(),
  seatId: z.string().optional(),
  seatNumber: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  ttlSeconds: z.number().int().positive().optional(),
  lockDurationSeconds: z.number().int().positive().optional()
});
export type DropStreamAdmissionGranted = z.infer<typeof DropStreamAdmissionGrantedSchema>;
export type ReservationGrant = DropStreamAdmissionGranted;
export const ReservationGrantSchema = DropStreamAdmissionGrantedSchema;

export const DropStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HEARTBEAT'),
    data: z.object({ timestamp: z.number().int() })
  }),
  z.object({
    type: z.literal('QUEUE_UPDATE'),
    data: DropStreamQueueUpdateSchema
  }),
  z.object({
    type: z.literal('DROP_STATUS'),
    data: DropStreamStatusSchema
  }),
  z.object({
    type: z.literal('ADMISSION_GRANTED'),
    data: DropStreamAdmissionGrantedSchema
  }),
  z.object({
    type: z.literal('RESERVATION_GRANTED'),
    data: DropStreamAdmissionGrantedSchema
  }),
  z.object({
    type: z.literal('SOLD_OUT'),
    data: z.object({ dropId: z.string(), message: z.string() })
  }),
  z.object({
    type: z.literal('SEATS_SOLD_OUT'),
    data: z.object({ eventId: z.string(), message: z.string() })
  })
]);
export type DropStreamEvent = z.infer<typeof DropStreamEventSchema>;
export const SSEEventSchema = DropStreamEventSchema;
export type SSEEvent = DropStreamEvent;

// ==========================================
// GET /drop/commitment
// ==========================================
export const DropCommitmentQuerySchema = z.object({
  dropId: z.string().min(1)
});
export type DropCommitmentQuery = z.infer<typeof DropCommitmentQuerySchema>;

export const DropCommitmentResponseSchema = z.object({
  dropId: z.string(),
  commitment: z.string().length(64, 'SHA-256 commitment must be 64 hex characters'),
  algorithm: z.literal('SHA-256').default('SHA-256'),
  publishedAt: z.number().int().positive(),
  description: z.string()
});
export type DropCommitmentResponse = z.infer<typeof DropCommitmentResponseSchema>;

// ==========================================
// GET /drop/proof
// ==========================================
export const DropProofQuerySchema = z.object({
  dropId: z.string().min(1),
  userId: z.string().min(1)
});
export type DropProofQuery = z.infer<typeof DropProofQuerySchema>;

export const DropProofResponseSchema = z.object({
  dropId: z.string(),
  userId: z.string(),
  revealedSeed: z.string(),
  commitment: z.string(),
  merkleRoot: z.string(),
  merkleProof: z.array(z.string()),
  userRank: z.number().int().positive(),
  isVerified: z.boolean(),
  seatNumber: z.number().int().positive().optional(),
  leafHash: z.string().optional(),
  participants: z.array(z.string()).optional(),
  totalParticipants: z.number().int().positive().optional()
});
export type DropProofResponse = z.infer<typeof DropProofResponseSchema>;
