/**
 * @module prng
 * Seeded pseudo-random number generation and per-field seed derivation.
 *
 * ## Why per-field seeding?
 *
 * A sequential PRNG shifts every downstream value when a field is added or
 * removed from a schema.  Per-field seeding avoids this: each field gets its
 * own seed derived from `hash(worldSeed + subjectId + fieldPath)`, so adding
 * a new field never affects the values of existing fields.
 *
 * ## Algorithms
 * - **PRNG**: SFC32 — passes all standard statistical tests, 128-bit state, period ~3.4×10³⁸.
 * - **Hash**: FNV-1a 32-bit — fast, low collision rate for short strings.
 */

import type { Prng } from "./types.js";

/** FNV-1a 32-bit hash over a UTF-16 string, returns an unsigned 32-bit integer. */
export function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** One step of splitmix32 — avalanches all 32 bits. Used for integer seed mixing. */
export function splitmix32(s: number): number {
  s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
  s = (s ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
  return (s ^ (s >>> 14)) >>> 0;
}

/**
 * Expands one 32-bit seed into four via the splitmix state machine.
 * Note: the state advances to the intermediate value after each step, not to
 * the return value — this is intentional and must not be changed.
 */
function seedToSfc32(seed: number): [number, number, number, number] {
  let s = seed >>> 0;
  const next = (): number => {
    s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
    s = (s ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
    return (s ^ (s >>> 14)) >>> 0;
  };
  return [next(), next(), next(), next()];
}

/**
 * Returns an SFC32 generator function seeded with four 32-bit values.
 * Each call advances the internal state and returns a float in [0, 1).
 * SFC32 passes all standard statistical tests and has a period of ~3.4×10³⁸.
 */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  let _a = a >>> 0, _b = b >>> 0, _c = c >>> 0, _d = d >>> 0;
  return () => {
    const t = (_a + _b + _d) | 0;
    _d = (_d + 1) | 0;
    _a = _b ^ (_b >>> 9);
    _b = (_c + (_c << 3)) | 0;
    _c = (_c << 21 | _c >>> 11);
    _c = (_c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded PRNG.
 *
 * @param seed - Any 32-bit integer.  The same seed always produces the same sequence.
 */
export function createPrng(seed: number): Prng {
  const rand = sfc32(...seedToSfc32(seed));

  const prng: Prng = {
    seed,

    random() {
      return rand();
    },

    int(min, max) {
      return min + Math.floor(rand() * (max - min + 1));
    },

    pick(items) {
      return items[Math.floor(rand() * items.length)]!;
    },

    shuffle(items) {
      const result = items.slice();
      // Fisher-Yates: walk from the end, swap each element with a random
      // earlier-or-equal index. Deterministic for a given PRNG state.
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
      }
      return result;
    },

    sample(items, count) {
      // Clamp count into [0, items.length] — forgiving for matcher authors.
      const n = Math.max(0, Math.min(count, items.length));
      return prng.shuffle(items).slice(0, n);
    },

    fork(key) {
      // Derive a child seed from the parent seed + key; does NOT consume
      // the parent's state, so the child is fully independent.
      return createPrng(fnv1a(`${seed}:${key}`));
    },

    bytes(n) {
      // Each rand() call produces 32 random bits; extract 4 bytes per call.
      const arr = new Uint8Array(n);
      for (let i = 0; i < n; i += 4) {
        const u = (rand() * 4294967296) >>> 0;
        arr[i] = u & 0xff;
        if (i + 1 < n) arr[i + 1] = (u >>> 8) & 0xff;
        if (i + 2 < n) arr[i + 2] = (u >>> 16) & 0xff;
        if (i + 3 < n) arr[i + 3] = (u >>> 24) & 0xff;
      }
      return arr;
    },
  };

  return prng;
}

/**
 * Derive a deterministic field-level seed from three stable inputs.
 *
 * Used to give each field its own independent PRNG so that schema changes
 * (adding / removing fields) do not affect unrelated fields.
 *
 * @param worldSeed  - The world's master seed.
 * @param subjectId  - The subject instance's unique ID (e.g. `'person#3'`).
 * @param fieldPath  - Dot-separated field path (e.g. `'address.street'`).
 */
export function fieldSeed(worldSeed: number, subjectId: string, fieldPath: string): number {
  return fnv1a(`${worldSeed}:${subjectId}:${fieldPath}`);
}
