/**
 * Cryptographically secure, unbiased random helpers built on
 * `crypto.getRandomValues`. Use these instead of `Math.random` anywhere the
 * result should be unpredictable or fair (passwords, dice, draws).
 */

const UINT32_RANGE = 0x1_0000_0000; // 2^32
const BUFFER_SIZE = 256;

let buffer = new Uint32Array(0);
let bufferPos = 0;

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error("Secure random numbers are not available in this environment.");
  }
  return c;
}

function nextUint32(): number {
  if (bufferPos >= buffer.length) {
    buffer = new Uint32Array(BUFFER_SIZE);
    getCrypto().getRandomValues(buffer);
    bufferPos = 0;
  }
  return buffer[bufferPos++];
}

/**
 * Returns a uniformly distributed integer in [0, n).
 *
 * Uses rejection sampling: values from the top partial "bucket" of the 32-bit
 * range are discarded so every result has exactly the same probability
 * (no modulo bias).
 */
export function randomInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > UINT32_RANGE) {
    throw new RangeError(`randomInt: n must be an integer in [1, 2^32], got ${n}`);
  }
  if (n === 1) return 0;
  // Largest multiple of n that fits in the 32-bit range.
  const limit = UINT32_RANGE - (UINT32_RANGE % n);
  let x: number;
  do {
    x = nextUint32();
  } while (x >= limit);
  return x % n;
}

/** Returns a uniformly distributed integer in [min, max] (inclusive). */
export function randomIntInclusive(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`randomIntInclusive: invalid range [${min}, ${max}]`);
  }
  return min + randomInt(max - min + 1);
}

/** Returns a uniformly chosen element of a non-empty array or string. */
export function randomChoice<T>(items: ArrayLike<T>): T {
  if (items.length === 0) {
    throw new RangeError("randomChoice: cannot choose from an empty list");
  }
  return items[randomInt(items.length)];
}

/** Returns a new array with the items in uniformly random order (Fisher-Yates). */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Returns `count` distinct items chosen uniformly at random, in random order. */
export function sample<T>(items: readonly T[], count: number): T[] {
  const k = Math.max(0, Math.min(Math.floor(count), items.length));
  // Partial Fisher-Yates: only the first k positions need to be settled.
  const pool = items.slice();
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}
