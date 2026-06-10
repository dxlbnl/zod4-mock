import type { Prng } from "./types.js";

export function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function splitmix32(s: number): number {
  s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
  s = (s ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
  return (s ^ (s >>> 14)) >>> 0;
}

// The state advances to the intermediate value after each step, not to the
// return value — intentional and must not be changed.
function seedToSfc32(seed: number): [number, number, number, number] {
  let s = seed >>> 0;
  const next = (): number => {
    s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
    s = (s ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
    return (s ^ (s >>> 14)) >>> 0;
  };
  return [next(), next(), next(), next()];
}

export class SFC32Prng implements Prng {
  readonly seed: number;
  // SFC32 state, mutated in place by random(); readers MUST NOT depend on
  // stability across random() calls.
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
    // Caller must ensure min > 0. Routes through the public random() so wrappers
    // that intercept random() observe the single draw.
    const u = this.random();
    return min * Math.pow(max / min, u);
  }

  geometric(p: number): number {
    // Returns a non-negative integer offset from 0 (callers add min). Routes
    // through the public random().
    const u = this.random();
    return Math.floor(Math.log(1 - u) / Math.log(1 - p));
  }

  pickZipf<T>(items: readonly T[], s: number): T {
    const N = items.length;
    const u = this.random();
    let raw: number;
    if (s === 0) {
      // s === 0 reproduces pick().
      raw = Math.floor(1 + u * N) - 1;
    } else if (s === 1) {
      raw = Math.floor(Math.pow(N + 1, u)) - 1;
    } else {
      const oneMinusS = 1 - s;
      const term = 1 + u * (Math.pow(N + 1, oneMinusS) - 1);
      raw = Math.floor(Math.pow(term, 1 / oneMinusS)) - 1;
    }
    const i = Math.max(0, Math.min(raw, N - 1));
    return items[i]!;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    // Fisher-Yates.
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const n = Math.max(0, Math.min(count, items.length));
    return this.shuffle(items).slice(0, n);
  }

  fork(key: string): Prng {
    // Derives a child seed without consuming the parent's state, so the child is
    // fully independent.
    return new SFC32Prng(fnv1a(`${this.seed}:${key}`));
  }

  bytes(n: number): Uint8Array {
    // 4 bytes per random() call (32 bits each).
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

export function fieldSeed(worldSeed: number, subjectId: string, fieldPath: string): number {
  return fnv1a(`${worldSeed}:${subjectId}:${fieldPath}`);
}
