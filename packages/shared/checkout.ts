import { z } from 'zod';

export const CheckoutReserveInputSchema = z.object({
  qty: z.number().int().positive(),
});
// Note: Idempotency-Key is typically in headers
export type CheckoutReserveInput = z.infer<typeof CheckoutReserveInputSchema>;

export const CheckoutReserveOutputSchema = z.object({
  holdId: z.string(),
  expiresAt: z.string().datetime(),
});
export type CheckoutReserveOutput = z.infer<typeof CheckoutReserveOutputSchema>;

export const CheckoutPayInputSchema = z.object({
  holdId: z.string(),
});
// Note: Idempotency-Key in headers
export type CheckoutPayInput = z.infer<typeof CheckoutPayInputSchema>;

export const CheckoutPayOutputSchema = z.object({
  allocationId: z.string(),
  receiptId: z.string(),
});
export type CheckoutPayOutput = z.infer<typeof CheckoutPayOutputSchema>;
