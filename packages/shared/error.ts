import { z } from 'zod';

export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorSchema>;
