import { z } from 'zod';

// ==========================================
// Generic Error Schema for all endpoints
// ==========================================
export const ErrorCodeEnum = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CHALLENGE_FAILED',
  'CHALLENGE_EXPIRED',
  'WAITING_ROOM_NOT_OPEN',
  'QUEUE_CLOSED',
  'ALREADY_IN_QUEUE',
  'SEATS_SOLD_OUT',
  'RESERVATION_EXPIRED',
  'RESERVATION_INVALID',
  'ALREADY_PURCHASED',
  'IDEMPOTENCY_CONFLICT',
  'PAYMENT_FAILED',
  'INVARIANT_VIOLATION',
  'GOOGLE_AUTH_FAILED',
  'GOOGLE_JWKS_UNREACHABLE',
  'EMAIL_NOT_VERIFIED',
  'INVALID_TOKEN',
  'INTERNAL_ERROR'
]);
export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

export const AuthMethodEnum = z.enum(['google', 'otp']);
export type AuthMethod = z.infer<typeof AuthMethodEnum>;

export const AppErrorSchema = z.object({
  code: ErrorCodeEnum,
  message: z.string(),
  details: z.unknown().optional()
});
export type AppError = z.infer<typeof AppErrorSchema>;

export class FairDropError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'FairDropError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, FairDropError.prototype);
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {})
    };
  }
}

export function createAppError(code: ErrorCode, message: string, details?: unknown): AppError {
  return {
    code,
    message,
    ...(details !== undefined ? { details } : {})
  };
}

// ==========================================
// POST /auth/register
// ==========================================
export const RegisterRequestSchema = z.object({
  email: z.string().email('Valid email address is required'),
  clientFingerprint: z.string().min(8, 'Client fingerprint is required'),
  turnstileToken: z.string().optional()
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  challengeId: z.string().optional(),
  expiresAt: z.number().int().positive()
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// ==========================================
// POST /auth/verify
// ==========================================
export const VerifyOtpRequestSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  clientFingerprint: z.string().min(8),
  signals: z.record(z.any()).optional()
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const VerifyOtpResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fairId: z.string().optional(),
    riskTier: z.enum(['low', 'medium', 'high']),
    authMethod: AuthMethodEnum.optional().default('otp')
  })
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;

// ==========================================
// POST /auth/google
// ==========================================
export const GoogleAuthRequestSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
  deviceFp: z.string().min(1, 'Device fingerprint is required'),
  signals: z.record(z.any()).optional()
});
export type GoogleAuthRequest = z.infer<typeof GoogleAuthRequestSchema>;

export const GoogleAuthResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fairId: z.string(),
    riskTier: z.enum(['low', 'medium', 'high']),
    authMethod: z.literal('google')
  }),
  fairId: z.string().optional()
});
export type GoogleAuthResponse = z.infer<typeof GoogleAuthResponseSchema>;

// ==========================================
// GET /me/state
// ==========================================
export const ClientFlowStepEnum = z.enum([
  'anonymous',
  'verified',
  'joined',
  'waiting',
  'admitted',
  'reserved',
  'paying',
  'confirmed',
  'failed',
  'expired'
]);
export type ClientFlowStep = z.infer<typeof ClientFlowStepEnum>;

export const HoldStateSchema = z.object({
  holdId: z.string(),
  expiresAt: z.number().int().positive()
});
export type HoldState = z.infer<typeof HoldStateSchema>;

export const UserStateStatusEnum = z.enum([
  'ANONYMOUS',
  'VERIFIED',
  'WAITING_ROOM',
  'QUEUED',
  'RESERVED',
  'PURCHASED',
  'EXPIRED'
]);
export type UserStateStatus = z.infer<typeof UserStateStatusEnum>;

export const UserReservationStateSchema = z.object({
  reservationId: z.string(),
  seatNumber: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  ttlSeconds: z.number().int().nonnegative()
});
export type UserReservationState = z.infer<typeof UserReservationStateSchema>;

export const UserStateResponseSchema = z.object({
  // Canonical fast pipeline fields (<5 ms contract)
  step: ClientFlowStepEnum.optional(),
  ticketId: z.string().nullable().optional(),
  position: z.number().int().nullable().optional(),
  etaSec: z.number().int().nullable().optional(),
  hold: HoldStateSchema.nullable().optional(),
  allocation: z.number().int().nullable().optional(),
  tier: z.enum(['low', 'medium', 'high']).optional(),

  // Extended / existing fields
  userId: z.string().optional(),
  email: z.string().optional(),
  fairId: z.string().optional(),
  positionToken: z.string().optional(),
  authMethod: AuthMethodEnum.optional(),
  status: UserStateStatusEnum.optional(),
  queuePosition: z.number().int().nullable().optional(),
  estimatedWaitSeconds: z.number().int().nullable().optional(),
  reservation: UserReservationStateSchema.nullable().optional(),
  receiptId: z.string().nullable().optional(),
  riskTier: z.enum(['low', 'medium', 'high']).optional(),
  powRequired: z.boolean().optional(),
  powDifficulty: z.number().int().min(1).max(8).optional()
});
export type UserStateResponse = z.infer<typeof UserStateResponseSchema>;

// ==========================================
// POST /pow/challenge
// ==========================================
export const CreatePoWChallengeRequestSchema = z.object({
  clientId: z.string().min(1),
  action: z.enum(['auth', 'join', 'reserve']).default('join')
});
export type CreatePoWChallengeRequest = z.infer<typeof CreatePoWChallengeRequestSchema>;

export const PoWChallengeSchema = z.object({
  challengeId: z.string(),
  salt: z.string(),
  difficulty: z.number().int().min(1).max(8),
  expiresAt: z.number().int().positive(),
  algorithm: z.literal('SHA-256').default('SHA-256')
});
export type PoWChallenge = z.infer<typeof PoWChallengeSchema>;

// ==========================================
// POST /pow/solve
// ==========================================
export const SolvePoWRequestSchema = z.object({
  challengeId: z.string(),
  clientId: z.string(),
  nonce: z.string(),
  durationMs: z.number().optional()
});
export type SolvePoWRequest = z.infer<typeof SolvePoWRequestSchema>;

export const SolvePoWResponseSchema = z.object({
  success: z.boolean(),
  solutionToken: z.string(),
  verified: z.boolean()
});
export type SolvePoWResponse = z.infer<typeof SolvePoWResponseSchema>;

export const PoWSolutionSchema = z.object({
  challengeId: z.string(),
  nonce: z.string(),
  durationMs: z.number().optional()
});
export type PoWSolution = z.infer<typeof PoWSolutionSchema>;

// Utility helpers for PoW challenge solving & verification
async function computeSha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('WebCrypto subtle digest is not available in the current environment');
}

export async function verifyPoW(
  salt: string,
  nonce: string,
  difficulty: number
): Promise<boolean> {
  if (difficulty < 1 || difficulty > 8) return false;
  const hash = await computeSha256(`${salt}:${nonce}`);
  return hash.startsWith('0'.repeat(difficulty));
}

export async function solvePoW(
  challenge: PoWChallenge,
  onProgress?: (attempts: number) => void
): Promise<PoWSolution> {
  const startTime = Date.now();
  const targetPrefix = '0'.repeat(challenge.difficulty);
  let nonceNum = 0;

  while (Date.now() <= challenge.expiresAt) {
    const nonce = nonceNum.toString();
    const hash = await computeSha256(`${challenge.salt}:${nonce}`);

    if (hash.startsWith(targetPrefix)) {
      return {
        challengeId: challenge.challengeId,
        nonce,
        durationMs: Date.now() - startTime
      };
    }

    nonceNum++;
    if (onProgress && nonceNum % 500 === 0) {
      onProgress(nonceNum);
    }
  }

  throw new Error('PoW challenge expired before solution was found');
}
