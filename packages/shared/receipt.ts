import { z } from 'zod';

export const ReceiptOutputSchema = z.object({
  hash: z.string(),
  batchId: z.string(),
  tier: z.string(),
  merkleProof: z.array(z.string()),
});
export type ReceiptOutput = z.infer<typeof ReceiptOutputSchema>;
