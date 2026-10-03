import { z } from 'zod';
import { RunReportSchema } from './metrics';
import { ErrorSchema } from './error';

export const AdminDefensesInputSchema = z.object({
  on: z.boolean(),
});
export type AdminDefensesInput = z.infer<typeof AdminDefensesInputSchema>;

export const AdminDropStartInputSchema = z.object({
  inventory: z.number().int().positive(),
  windowSec: z.number().positive(),
});
export type AdminDropStartInput = z.infer<typeof AdminDropStartInputSchema>;

export const AdminDropResetInputSchema = AdminDropStartInputSchema;
export type AdminDropResetInput = z.infer<typeof AdminDropResetInputSchema>;

export const AdminBotlabRunInputSchema = z.object({
  scenario: z.string(),
  humans: z.number().int().nonnegative(),
  bots: z.number().int().nonnegative(),
  rps: z.number().positive(),
  durationSec: z.number().positive(),
});
export type AdminBotlabRunInput = z.infer<typeof AdminBotlabRunInputSchema>;

export const AdminBotlabRunOutputSchema = z.object({
  runId: z.string(),
});
export type AdminBotlabRunOutput = z.infer<typeof AdminBotlabRunOutputSchema>;

export const AdminChaosInputSchema = z.object({
  action: z.string(),
});
export type AdminChaosInput = z.infer<typeof AdminChaosInputSchema>;

export const AdminInvariantsOutputSchema = z.object({
  oversold: z.boolean(),
  invariants: z.array(z.string()),
});
export type AdminInvariantsOutput = z.infer<typeof AdminInvariantsOutputSchema>;
