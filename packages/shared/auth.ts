import { z } from 'zod';

export const RegisterInputSchema = z.object({
  email: z.string().email(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const RegisterOutputSchema = z.object({
  otp: z.string().optional(), // For demo mode
});
export type RegisterOutput = z.infer<typeof RegisterOutputSchema>;

export const VerifyInputSchema = z.object({
  email: z.string().email(),
  otp: z.string(),
  deviceFp: z.string(),
});
export type VerifyInput = z.infer<typeof VerifyInputSchema>;

export const VerifyOutputSchema = z.object({
  token: z.string(),
  tier: z.string(),
});
export type VerifyOutput = z.infer<typeof VerifyOutputSchema>;

export const MeStateOutputSchema = z.object({
  step: z.string(),
  queuePosition: z.number().nullable(),
  hold: z.boolean(),
  tier: z.string(),
});
export type MeStateOutput = z.infer<typeof MeStateOutputSchema>;
