const crypto = require('crypto');

/**
 * Checks if the SHA-256 hash of (prefix + nonce) has the required number of leading zero bits.
 *
 * @param {Buffer} hash
 * @param {number} bits
 * @returns {boolean}
 */
function checkLeadingZeroBits(hash, bits) {
  let remainingBits = bits;
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i];
    if (remainingBits >= 8) {
      if (byte !== 0) return false;
      remainingBits -= 8;
    } else {
      const shift = 8 - remainingBits;
      return (byte >> shift) === 0;
    }
    if (remainingBits === 0) break;
  }
  return true;
}

/**
 * Solves the Proof of Work challenge.
 *
 * @param {string} prefix - The random prefix from the server.
 * @param {number} difficultyBits - The required leading zero bits.
 * @returns {{ nonce: string, timeMs: number, iterations: number }}
 */
function solveChallenge(prefix, difficultyBits) {
  const start = Date.now();
  let iterations = 0;
  
  // If difficulty is 0 (defenses disabled), just return a dummy nonce
  if (difficultyBits <= 0) {
    return { nonce: 'dummy_nonce', timeMs: 0, iterations: 0 };
  }

  // Find a valid nonce by brute force
  while (true) {
    // Generate a quick random nonce (hex string)
    const nonce = crypto.randomBytes(8).toString('hex');
    const hash = crypto.createHash('sha256').update(prefix + nonce).digest();
    
    if (checkLeadingZeroBits(hash, difficultyBits)) {
      const timeMs = Date.now() - start;
      return { nonce, timeMs, iterations };
    }
    
    iterations++;
    
    // Optional: add small non-blocking delay if we don't want to lock the thread entirely, 
    // but typically a PoW solver runs synchronously to utilize CPU fully.
  }
}

// Example usage to demonstrate cost scaling
if (require.main === module) {
  console.log('--- PoW Solver Cost Scaling Test ---');
  const prefix = crypto.randomBytes(16).toString('hex');
  const difficulties = [16, 20, 24]; // low, medium, high

  for (const diff of difficulties) {
    console.log(`\nTesting Difficulty ${diff} bits...`);
    const result = solveChallenge(prefix, diff);
    console.log(`[Difficulty ${diff}] Solved in ${result.timeMs} ms after ${result.iterations.toLocaleString()} iterations`);
    console.log(`Nonce found: ${result.nonce}`);
  }
}

module.exports = {
  solveChallenge,
  checkLeadingZeroBits
};
