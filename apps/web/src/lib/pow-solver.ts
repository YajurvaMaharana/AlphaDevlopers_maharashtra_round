/**
 * PoW Worker Bridge with fallback support for Next.js App Router
 */

import { PoWWorkerInput, PoWWorkerMessage } from '../workers/pow.worker';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface PoWSolveResult {
  nonce: string;
  hash: string;
  elapsedMs: number;
  totalHashes: number;
}

export interface PoWSolveProgress {
  hashes: number;
  hashesComputed: number;
  hashRate: number;
  elapsedMs: number;
}

export type PoWProgressCallback = (progress: PoWSolveProgress) => void;

/**
 * Generates mock PoW challenge for offline/development resilience
 */
export function createMockChallenge(eventId: string = 'fairdrop-main-2026') {
  return {
    challengeId: `chal_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    salt: `salt_${Math.random().toString(36).slice(2, 10)}`,
    difficulty: 4,
    expiresAt: Date.now() + 300000,
    algorithm: 'SHA-256' as const,
  };
}

/**
 * Executes PoW challenge in a dedicated Web Worker off the main thread.
 * If Web Workers are unavailable or restricted, falls back gracefully to a non-blocking main-thread generator.
 */
export function runPoWWorker(
  input: PoWWorkerInput,
  onProgress?: PoWProgressCallback
): {
  promise: Promise<PoWSolveResult>;
  cancel: () => void;
} {
  let worker: Worker | null = null;
  let isCancelled = false;

  const cancel = () => {
    isCancelled = true;
    if (worker) {
      try {
        worker.postMessage({ type: 'CANCEL' });
        worker.terminate();
      } catch {
        // ignore
      }
      worker = null;
    }
  };

  const promise = new Promise<PoWSolveResult>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('PoW solving requires a browser environment'));
      return;
    }

    try {
      // 1. Attempt standard module Web Worker
      worker = new Worker(new URL('../workers/pow.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent<PoWWorkerMessage>) => {
        if (isCancelled) return;

        const data = event.data;
        if (data.type === 'PROGRESS') {
          onProgress?.({
            hashes: data.hashes,
            hashesComputed: data.hashes,
            hashRate: data.hashRate,
            elapsedMs: data.elapsedMs,
          });
        } else if (data.type === 'SUCCESS') {
          resolve({
            nonce: data.nonce,
            hash: data.hash,
            elapsedMs: data.elapsedMs,
            totalHashes: data.totalHashes,
          });
          if (worker) {
            worker.terminate();
            worker = null;
          }
        } else if (data.type === 'ERROR') {
          reject(new Error(data.error));
          if (worker) {
            worker.terminate();
            worker = null;
          }
        }
      };

      worker.onerror = (err) => {
        if (isCancelled) return;
        // On worker script loading error, fall back to synchronous chunk solver
        console.warn('Web Worker error, falling back to client-thread chunk solver', err);
        if (worker) {
          worker.terminate();
          worker = null;
        }
        fallbackClientSolver(input, onProgress, () => isCancelled)
          .then(resolve)
          .catch(reject);
      };

      worker.postMessage(input);
    } catch (err) {
      console.warn('Worker instantiation failed, using client fallback', err);
      fallbackClientSolver(input, onProgress, () => isCancelled)
        .then(resolve)
        .catch(reject);
    }
  });

  return { promise, cancel };
}

/**
 * Bit-level difficulty verification helper
 */
function checkDifficultyBits(hashBytes: Uint8Array, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  for (let i = 0; i < fullBytes; i++) {
    if (hashBytes[i] !== 0) return false;
  }
  const remBits = bits % 8;
  if (remBits > 0) {
    const mask = (0xff << (8 - remBits)) & 0xff;
    if ((hashBytes[fullBytes] & mask) !== 0) return false;
  }
  return true;
}

/**
 * Fallback client solver yielding execution slices via setTimeout to keep UI responsive.
 */
async function fallbackClientSolver(
  input: PoWWorkerInput,
  onProgress?: PoWProgressCallback,
  isCancelled: () => boolean = () => false
): Promise<PoWSolveResult> {
  const {
    prefix,
    difficultyBits = input.difficulty ? input.difficulty * 4 : 16,
    chunkSize = 3000,
  } = input;

  const encoder = new TextEncoder();
  const prefixBytes = encoder.encode(prefix);

  let nonce = 0;
  let totalHashes = 0;
  const startTime = performance.now();

  return new Promise<PoWSolveResult>((resolve, reject) => {
    function step() {
      if (isCancelled()) {
        reject(new Error('PoW solving cancelled'));
        return;
      }

      for (let i = 0; i < chunkSize; i++) {
        const nonceStr = nonce.toString();
        const nonceBytes = encoder.encode(nonceStr);
        const msg = new Uint8Array(prefixBytes.length + nonceBytes.length);
        msg.set(prefixBytes, 0);
        msg.set(nonceBytes, prefixBytes.length);

        const digest = sha256(msg);
        totalHashes++;

        if (checkDifficultyBits(digest, difficultyBits)) {
          const elapsedMs = Math.round(performance.now() - startTime);
          resolve({
            nonce: nonceStr,
            hash: bytesToHex(digest),
            elapsedMs,
            totalHashes,
          });
          return;
        }

        nonce++;
      }

      const elapsed = Math.max(1, performance.now() - startTime);
      const hashRate = Math.round((totalHashes / elapsed) * 1000);
      onProgress?.({
        hashes: totalHashes,
        hashesComputed: totalHashes,
        hashRate,
        elapsedMs: Math.round(elapsed),
      });

      setTimeout(step, 0);
    }

    step();
  });
}
