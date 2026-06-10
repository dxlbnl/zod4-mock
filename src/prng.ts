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
 *
 * ## Class shape with prototype methods
 *
 * `createPrng(seed)` returns an `SFC32Prng` instance whose methods live on
 * `SFC32Prng.prototype` (not as per-instance closure-object properties). The
 * byte-identical SFC32 state machine is preserved — the refactor only flips
 * the allocation shape from closure-object to class.
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
 * Class-shaped SFC32 PRNG with all methods on the prototype.
 *
 * Holds the SFC32 state (4 unsigned 32-bit integers) as own properties. The
 * methods are class-syntax (so they live on `SFC32Prng.prototype`), which
 * makes `new SFC32Prng(seed)` allocate just the four state slots + the
 * `seed` slot — no per-instance closure properties.
 *
 * Byte-identity with the legacy closure-object factory is preserved: the
 * SFC32 step (`random()`), the `seedToSfc32` initialisation, the `fork(key)`
 * hash derivation, and the closed-form `pickZipf` / `logUniform` /
 * `geometric` formulas are unchanged.
 */
export class SFC32Prng implements Prng {
  readonly seed: number;
  // SFC32 state — four unsigned 32-bit integers. Mutated in place by
  // `random()`; readers MUST NOT depend on stability across `random()` calls.
  private _a: number;
  private _b: number;
  private _c: number;
  private _d: number;

  constructor(seed: number) {
    this.seed = seed;
    const [a, b, c, d] = seedToSfc32(seed);
    this._a = a >>> 0;
    this._b = b >>> 0;
    this._c = c >>> 0;
    this._d = d >>> 0;
  }

  random(): number {
    const t = (this._a + this._b + this._d) | 0;
    this._d = (this._d + 1) | 0;
    this._a = this._b ^ (this._b >>> 9);
    this._b = (this._c + (this._c << 3)) | 0;
    this._c = (this._c << 21) | (this._c >>> 11);
    this._c = (this._c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  pick<T>(items: readonly [T, ...T[]]): T {
    return items[Math.floor(this.random() * items.length)] as T;
  }

  logUniform(min: number, max: number): number {
    // Closed-form log-uniform inverse-CDF — one `random()`, no rejection.
    // Caller is responsible for ensuring `min > 0`. Routes through the
    // public `this.random()` (mirroring `pickZipf`) so wrappers that
    // intercept `random()` observe the single draw.
    const u = this.random();
    return min * Math.pow(max / min, u);
  }

  geometric(p: number): number {
    // Closed-form truncated-geometric inverse-CDF — one `random()`, no
    // rejection. Returns a non-negative integer offset from 0; callers add
    // `min` if desired. Routes through the public `this.random()`.
    const u = this.random();
    return Math.floor(Math.log(1 - u) / Math.log(1 - p));
  }

  pickZipf<T>(items: readonly T[], s: number): T {
    const N = items.length;
    const u = this.random();
    let raw: number;
    if (s === 0) {
      // Reproduces `pick`: floor(1 + u·N) − 1 ≡ floor(u·N) for u ∈ [0, 1).
      raw = Math.floor(1 + u * N) - 1;
    } else if (s === 1) {
      // Classic Zipf: floor((N + 1)^u) − 1.
      raw = Math.floor(Math.pow(N + 1, u)) - 1;
    } else {
      // General power law: floor([1 + u·((N+1)^(1−s) − 1)]^(1/(1−s))) − 1.
      const oneMinusS = 1 - s;
      const term = 1 + u * (Math.pow(N + 1, oneMinusS) - 1);
      raw = Math.floor(Math.pow(term, 1 / oneMinusS)) - 1;
    }
    const i = Math.max(0, Math.min(raw, N - 1));
    return items[i]!;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    // Fisher-Yates: walk from the end, swap each element with a random
    // earlier-or-equal index. Deterministic for a given PRNG state.
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  sample<T>(items: readonly T[], count: number): T[] {
    // Clamp count into [0, items.length] — forgiving for matcher authors.
    const n = Math.max(0, Math.min(count, items.length));
    return this.shuffle(items).slice(0, n);
  }

  fork(key: string): Prng {
    // Derive a child seed from the parent seed + key; does NOT consume
    // the parent's state, so the child is fully independent. R14: returns
    // an `SFC32Prng` instance directly (not via `createPrng` wrapping) so
    // `child instanceof SFC32Prng === true`.
    return new SFC32Prng(fnv1a(`${this.seed}:${key}`));
  }

  bytes(n: number): Uint8Array {
    // Each rand() call produces 32 random bits; extract 4 bytes per call.
    const arr = new Uint8Array(n);
    for (let i = 0; i < n; i += 4) {
      const u = (this.random() * 4294967296) >>> 0;
      arr[i] = u & 0xff;
      if (i + 1 < n) arr[i + 1] = (u >>> 8) & 0xff;
      if (i + 2 < n) arr[i + 2] = (u >>> 16) & 0xff;
      if (i + 3 < n) arr[i + 3] = (u >>> 24) & 0xff;
    }
    return arr;
  }
}

/**
 * Create a seeded PRNG.
 *
 * @param seed - Any 32-bit integer.  The same seed always produces the same sequence.
 */
export function createPrng(seed: number): Prng {
  return new SFC32Prng(seed);
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
