import type { Prng } from './types.js'

/** FNV-1a 32-bit hash, returns an unsigned 32-bit integer */
function fnv1a(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash
}

/** Mulberry32 PRNG — fast, good distribution, seeded */
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
      return createPrng(fnv1a(`${seed}:${key}`))
    },
  }

  return prng
}

/** Derive a deterministic field-level seed from world seed + subject ID + field path */
export function fieldSeed(worldSeed: number, subjectId: string, fieldPath: string): number {
  return fnv1a(`${worldSeed}:${subjectId}:${fieldPath}`)
}
