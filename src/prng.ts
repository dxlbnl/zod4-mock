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
 * - **PRNG**: Mulberry32 — fast, excellent distribution, 32-bit state.
 * - **Hash**: FNV-1a 32-bit — fast, low collision rate for short strings.
 */

import type { Prng } from './types.js'

/** FNV-1a 32-bit hash over a UTF-16 string, returns an unsigned 32-bit integer. */
function fnv1a(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

/**
 * Returns a Mulberry32 generator function seeded with `seed`.
 * Each call advances the internal state and returns a float in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Create a seeded PRNG.
 *
 * @param seed - Any 32-bit integer.  The same seed always produces the same sequence.
 */
export function createPrng(seed: number): Prng {
  const rand = mulberry32(seed)

  const prng: Prng = {
    random() {
      return rand()
    },

    int(min, max) {
      return min + Math.floor(rand() * (max - min + 1))
    },

    pick(items) {
      return items[Math.floor(rand() * items.length)]!
    },

    fork(key) {
      // Derive a child seed from the parent seed + key; does NOT consume
      // the parent's state, so the child is fully independent.
      return createPrng(fnv1a(`${seed}:${key}`))
    },
  }

  return prng
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
  return fnv1a(`${worldSeed}:${subjectId}:${fieldPath}`)
}
