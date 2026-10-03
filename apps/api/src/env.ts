import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  REPLICA_ID: z.string().default('api'),
});

export const env = envSchema.parse(process.env);
