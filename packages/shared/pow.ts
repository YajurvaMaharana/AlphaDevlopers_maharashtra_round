import { z } from 'zod';

export const PowChallengeInputSchema = z.object({
  route: z.string(),
});
export type PowChallengeInput = z.infer<typeof PowChallengeInputSchema>;

export const PowChallengeOutputSchema = z.object({
  id: z.string(),
  nonce: z.string(),
});
export type PowChallengeOutput = z.infer<typeof PowChallengeOutputSchema>;

export const PowSolveInputSchema = z.object({
  id: z.string(),
  nonce: z.string(),
});
export type PowSolveInput = z.infer<typeof PowSolveInputSchema>;
