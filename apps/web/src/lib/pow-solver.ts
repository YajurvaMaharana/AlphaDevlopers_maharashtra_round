import { PoWChallenge, PoWSolution, solvePoW, DROP_CONSTANTS } from '@fairdrop/shared';

export interface PoWSolveProgress {
  hashesComputed: number;
  elapsedMs: number;
  hashRate: number; // hashes per second
  isComplete: boolean;
}

export async function runClientPoW(
  challenge: PoWChallenge,
  onProgress?: (progress: PoWSolveProgress) => void
): Promise<PoWSolution> {
  const startTime = Date.now();
  let currentAttempts = 0;

  const solution = await solvePoW(challenge, (attempts) => {
    currentAttempts = attempts;
    const elapsed = Math.max(1, Date.now() - startTime);
    const rate = Math.round((attempts / elapsed) * 1000);
    if (onProgress) {
      onProgress({
        hashesComputed: attempts,
        elapsedMs: elapsed,
        hashRate: rate,
        isComplete: false
      });
    }
  });

  const totalElapsed = Math.max(1, Date.now() - startTime);
  if (onProgress) {
    onProgress({
      hashesComputed: currentAttempts || 1,
      elapsedMs: totalElapsed,
      hashRate: Math.round(((currentAttempts || 1) / totalElapsed) * 1000),
      isComplete: true
    });
  }

  return solution;
}

export function createMockChallenge(eventId: string): PoWChallenge {
  return {
    challengeId: `chal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    salt: `fairdrop-salt-${eventId}-${Math.random().toString(36).substring(2, 9)}`,
    difficulty: DROP_CONSTANTS.POW_DEFAULT_DIFFICULTY,
    expiresAt: Date.now() + DROP_CONSTANTS.POW_EXPIRATION_MS,
    algorithm: 'SHA-256'
  };
}
