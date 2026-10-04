import { z } from 'zod';

// ==========================================
// POST /checkout/reserve
// ==========================================
export const CheckoutReserveRequestSchema = z.object({
  dropId: z.string().min(1),
  seatCount: z.number().int().min(1).max(2).default(1),
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID'),
  admissionToken: z.string().min(1)
});
export type CheckoutReserveRequest = z.infer<typeof CheckoutReserveRequestSchema>;

export const CheckoutReserveResponseSchema = z.object({
  reservationId: z.string(),
  dropId: z.string(),
  seatNumbers: z.array(z.number().int().positive()),
  heldUntil: z.number().int().positive(),
  ttlSeconds: z.number().int().positive(),
  priceCents: z.number().int().positive(),
  currency: z.string().default('USD')
});
export type CheckoutReserveResponse = z.infer<typeof CheckoutReserveResponseSchema>;

// ==========================================
// POST /checkout/pay
// ==========================================
export const CheckoutPayAttendeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required')
});
export type CheckoutPayAttendee = z.infer<typeof CheckoutPayAttendeeSchema>;

export const CheckoutPayRequestSchema = z.object({
  eventId: z.string().optional(),
  reservationId: z.string().optional(),
  reservationToken: z.string().optional(),
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID'),
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  paymentMethod: z.enum(['mock_card', 'card']).default('mock_card'),
  paymentToken: z.string().optional(),
  cardNumber: z.string().optional(),
  cardNumberLast4: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvc: z.string().optional(),
  attendee: CheckoutPayAttendeeSchema.optional()
});
export type CheckoutPayRequest = z.infer<typeof CheckoutPayRequestSchema>;
export type CheckoutRequest = CheckoutPayRequest;
export const CheckoutRequestSchema = CheckoutPayRequestSchema;

export const CheckoutPayResponseSchema = z.object({
  success: z.boolean(),
  receiptId: z.string().optional(),
  orderId: z.string(),
  seatNumber: z.number().int().positive().optional(),
  seatNumbers: z.array(z.number().int().positive()).optional(),
  amountPaidCents: z.number().int().positive().optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.string().default('USD'),
  paidAt: z.number().int().positive().optional(),
  purchasedAt: z.number().int().positive().optional(),
  eventId: z.string().optional(),
  buyerName: z.string().optional(),
  buyerEmail: z.string().optional(),
  ticketHash: z.string().optional(),
  status: z.enum(['COMPLETED']).default('COMPLETED')
});
export type CheckoutPayResponse = z.infer<typeof CheckoutPayResponseSchema>;
export type CheckoutResponse = CheckoutPayResponse;
export const CheckoutResponseSchema = CheckoutPayResponseSchema;

// ==========================================
// GET /receipt/:id
// ==========================================
export const ReceiptParamsSchema = z.object({
  id: z.string().min(1)
});
export type ReceiptParams = z.infer<typeof ReceiptParamsSchema>;

export const ReceiptResponseSchema = z.object({
  receiptId: z.string(),
  orderId: z.string(),
  dropId: z.string(),
  seatNumbers: z.array(z.number().int().positive()),
  buyerName: z.string().optional(),
  buyerEmail: z.string().optional(),
  paidAt: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  currency: z.string(),
  txHash: z.string(),
  merkleProof: z.array(z.string()).optional(),
  qrCodeUrl: z.string().optional(),
  allocationId: z.string().optional(),
  queueBatch: z.string().optional(),
  rank: z.number().int().positive().optional(),
  riskTier: z.string().optional(),
  commitment: z.string().optional(),
  revealedSeed: z.string().optional(),
  merkleRoot: z.string().optional(),
  explanation: z.string().optional(),
  fairHash: z.string().optional(),
  authMethod: z.string().optional(),
  riskLane: z.string().optional(),
  lane: z.string().optional(),
  batchId: z.string().optional(),
  batchNumber: z.number().int().optional(),
  stepUpRequired: z.boolean().optional(),
  emailHash: z.string().optional(),
  fingerprintHash: z.string().optional()
});
export type ReceiptResponse = z.infer<typeof ReceiptResponseSchema>;
