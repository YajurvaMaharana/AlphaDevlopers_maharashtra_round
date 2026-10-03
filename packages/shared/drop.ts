import { z } from 'zod';

export const DropJoinOutputSchema = z.object({
  ticketId: z.string(),
});
export type DropJoinOutput = z.infer<typeof DropJoinOutputSchema>;

export const DropStreamEventSchema = z.object({
  state: z.string(),
  position: z.number().nullable(),
  etaSec: z.number().nullable(),
  admitted: z.boolean(),
});
export type DropStreamEvent = z.infer<typeof DropStreamEventSchema>;

export const DropCommitmentOutputSchema = z.object({
  commitment: z.string(),
});
export type DropCommitmentOutput = z.infer<typeof DropCommitmentOutputSchema>;

export const DropProofOutputSchema = z.object({
  seed: z.string(),
  merkleRoot: z.string(),
});
export type DropProofOutput = z.infer<typeof DropProofOutputSchema>;
