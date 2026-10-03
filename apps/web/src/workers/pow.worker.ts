/**
 * FairDrop Proof-of-Work Web Worker
 * Uses @noble/hashes sha256 (fast, pure JS) to solve partial preimage hash challenges off the main thread.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface PoWWorkerInput {
  prefix: string; // Salt or challenge prefix
  difficultyBits?: number; // Number of leading zero bits required (e.g. 16, 20)
  difficulty?: number; // Number of leading hex zeros (e.g. 4 hex zeros = 16 bits)
  chunkSize?: number; // Nonces per execution slice (default: 5000)
  startNonce?: number;
}

export type PoWWorkerMessage =
  | {
      type: 'PROGRESS';
      hashes: number;
      hashRate: number; // Hashes per second
      elapsedMs: number;
      currentNonce: number;
    }
  | {
      type: 'SUCCESS';
      nonce: string;
      hash: string;
      elapsedMs: number;
      totalHashes: number;
    }
  | {
      type: 'ERROR';
      error: string;
    };

/**
 * Checks if a 32-byte sha256 Uint8Array satisfies the required leading zero bits.
 */
export function checkDifficultyBits(hashBytes: Uint8Array, bits: number): boolean {
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

// Only attach listener in worker context
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  let isCancelled = false;

  self.addEventListener('message', (event: MessageEvent<PoWWorkerInput | { type: 'CANCEL' }>) => {
    if ('type' in event.data && event.data.type === 'CANCEL') {
      isCancelled = true;
      return;
    }

    const input = event.data as PoWWorkerInput;
    const {
      prefix,
      difficultyBits = input.difficulty ? input.difficulty * 4 : 16,
      chunkSize = 5000,
      startNonce = 0,
    } = input;

    isCancelled = false;
    const encoder = new TextEncoder();
    const prefixBytes = encoder.encode(prefix);

    let nonce = startNonce;
    let totalHashes = 0;
    const startTime = performance.now();

    function processChunk() {
      if (isCancelled) return;

      const chunkStart = performance.now();

      for (let i = 0; i < chunkSize; i++) {
        const nonceStr = nonce.toString();
        const nonceBytes = encoder.encode(nonceStr);

        // Concatenate prefixBytes + nonceBytes into single message
        const message = new Uint8Array(prefixBytes.length + nonceBytes.length);
        message.set(prefixBytes, 0);
        message.set(nonceBytes, prefixBytes.length);

        const digest = sha256(message);
        totalHashes++;

        if (checkDifficultyBits(digest, difficultyBits)) {
          const elapsedMs = Math.round(performance.now() - startTime);
          const hashHex = bytesToHex(digest);

          self.postMessage({
            type: 'SUCCESS',
            nonce: nonceStr,
            hash: hashHex,
            elapsedMs,
            totalHashes,
          } as PoWWorkerMessage);
          return;
        }

        nonce++;
      }

      // Compute live hash rate and post progress
      const currentElapsed = Math.max(1, performance.now() - startTime);
      const hashRate = Math.round((totalHashes / currentElapsed) * 1000);

      self.postMessage({
        type: 'PROGRESS',
        hashes: totalHashes,
        hashRate,
        elapsedMs: Math.round(currentElapsed),
        currentNonce: nonce,
      } as PoWWorkerMessage);

      // Yield back to worker event loop so cancellations / messages can be processed
      setTimeout(processChunk, 0);
    }

    processChunk();
  });
}
