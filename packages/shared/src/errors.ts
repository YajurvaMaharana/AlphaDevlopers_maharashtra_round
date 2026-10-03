import { z } from 'zod';

export const ErrorCodeEnum = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CHALLENGE_FAILED',
  'CHALLENGE_EXPIRED',
  'INVALID_SIGNATURE',
  'WAITING_ROOM_NOT_OPEN',
  'QUEUE_CLOSED',
  'ALREADY_IN_QUEUE',
  'SEATS_SOLD_OUT',
  'RESERVATION_EXPIRED',
  'RESERVATION_INVALID',
  'ALREADY_PURCHASED',
  'IDEMPOTENCY_CONFLICT',
  'SESSION_INVALID',
  'PAYMENT_FAILED',
  'INTERNAL_ERROR'
]);

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

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
