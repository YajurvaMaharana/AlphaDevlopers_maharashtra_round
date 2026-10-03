import { z } from 'zod';

export const PoWChallengeSchema = z.object({
  challengeId: z.string(),
  salt: z.string(),
  difficulty: z.number().int().min(1).max(8),
  expiresAt: z.number().int().positive(),
  algorithm: z.literal('SHA-256').default('SHA-256')
});

export type PoWChallenge = z.infer<typeof PoWChallengeSchema>;

export const PoWSolutionSchema = z.object({
  challengeId: z.string(),
  nonce: z.string(),
  durationMs: z.number().optional()
});

export type PoWSolution = z.infer<typeof PoWSolutionSchema>;

async function computeSha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('WebCrypto subtle digest is not available in the current runtime environment');
}

export async function verifyPoW(
  salt: string,
  nonce: string,
  difficulty: number
): Promise<boolean> {
  if (difficulty < 1 || difficulty > 8) return false;
  const hash = await computeSha256(`${salt}:${nonce}`);
  const targetPrefix = '0'.repeat(difficulty);
  return hash.startsWith(targetPrefix);
}

export async function solvePoW(
  challenge: PoWChallenge,
  onProgress?: (attempts: number) => void
): Promise<PoWSolution> {
  const startTime = Date.now();
  const targetPrefix = '0'.repeat(challenge.difficulty);
  let nonceNum = 0;

  while (Date.now() <= challenge.expiresAt) {
    const nonce = nonceNum.toString();
    const hash = await computeSha256(`${challenge.salt}:${nonce}`);

    if (hash.startsWith(targetPrefix)) {
      return {
        challengeId: challenge.challengeId,
        nonce,
        durationMs: Date.now() - startTime
      };
    }

    nonceNum++;
    if (onProgress && nonceNum % 500 === 0) {
      onProgress(nonceNum);
    }
  }

  throw new Error('PoW challenge expired before solution was found');
}
