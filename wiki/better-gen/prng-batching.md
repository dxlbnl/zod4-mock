# PRNG Improvements

Three layered improvements to the PRNG layer, ordered by impact.

## 1. Replace Mulberry32 with SFC32

**Problem:** Mulberry32 has a known statistical flaw — it appears to skip approximately 1/3 of all 32-bit values due to how it maps its internal state to output. For a library producing mock data, this biases value distribution in subtle ways that can cause patterns in large datasets.

**Solution:** Replace with **SFC32** (Small Fast Counting 32-bit generator).

| Property | Mulberry32 | SFC32 |
|----------|-----------|-------|
| State size | 32 bits | 128 bits |
| Period | ~4 billion | ~3.4 × 10³⁸ |
| Statistical tests | Fails some | Passes all standard tests |
| Speed (ops/sec) | ~10.4M | ~7.4M |
| JS implementation | 1 closure | 1 closure |

The 30% speed difference is negligible at mock-data scale — the bottleneck is field-path hashing and object allocation, not the raw RNG.

```typescript
// SFC32 — drop-in replacement for the mulberry32 call inside createPrng()
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
```

SFC32 requires 4 seed values. Derive them from the single FNV-1a field seed using splitmix32:

```typescript
function seedToSfc32(seed: number): [number, number, number, number] {
  // splitmix32: a simple, fast way to expand one seed into four
  let s = seed;
  const next = () => { s = Math.imul(s ^ s >>> 15, s | 1); s ^= s + Math.imul(s ^ s >>> 7, s | 61); return (s ^ s >>> 14) >>> 0; };
  return [next(), next(), next(), next()];
}
```

**Migration:** Existing seeds produce different output after this change. This is expected and should be documented as a breaking change (major version).

## 2. `bytes(n)` Method

**Status:** `prng.bytes(n)` is implemented. `uuid` and `nanoid` generators have NOT yet been migrated to use it — both still call `prng.int()` per character.

**Problem:** Generators like `uuid`, `nanoid`, `hexadecimal`, `bitcoinAddress`, and `imei` call `prng.int(0, 15)` or `prng.int(0, 255)` once per character. For a UUID (32 hex characters) this is 32 separate algorithm invocations.

**Note:** `uint32()` nibble-batching was considered but dropped — `bytes(n)` covers the same ground more ergonomically.

**Remaining work:** Migrate `generateUuid` and `generateNanoid` in `src/generators/schema/string.ts` to use `prng.bytes()`. The `Prng` interface already exposes `bytes(n): Uint8Array`.

```typescript
interface Prng {
  random(): number;           // existing
  int(min: number, max: number): number;  // existing
  pick<T>(items: readonly [T, ...T[]]): T; // existing
  fork(key: string): Prng;    // existing

  uint32(): number;           // NEW: raw 32-bit unsigned integer
  bytes(n: number): Uint8Array; // NEW: n random bytes
}
```

### `uint32()` — nibble batching

One `uint32()` call produces 32 random bits. Extract 8 hex nibbles with bitwise shifts:

```typescript
// Before: 8 calls for 8 hex chars
for (let i = 0; i < 8; i++) hex += prng.int(0, 15).toString(16);

// After: 1 call for 8 hex chars
const u = prng.uint32();
for (let i = 0; i < 8; i++) hex += ((u >>> (i * 4)) & 0xF).toString(16);
```

UUID goes from 32 `int()` calls → 4 `uint32()` calls (8× reduction).

### `bytes(n)` — buffer generation

For anything needing a stream of random bytes (nanoid, base64, bitcoin addresses):

```typescript
// Before: 21 separate prng.int() calls for a 21-char nanoid
// After:
const buf = prng.bytes(21);
let id = "";
for (const b of buf) id += NANOID_ALPHABET[b % NANOID_ALPHABET.length];
```

```typescript
// Implementation inside createPrng():
bytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i += 4) {
    const u = this.uint32();
    arr[i]     = u & 0xFF;
    arr[i + 1] = (u >>> 8)  & 0xFF;
    arr[i + 2] = (u >>> 16) & 0xFF;
    arr[i + 3] = (u >>> 24) & 0xFF;
  }
  return arr;
},
```

## 3. `fork()` Result Caching — Not Applicable

**Closed by architecture.** The premise was that generating N records would call `prng.fork(fieldPath)` N times for the same key on the same parent PRNG. In practice, `fieldSeed(worldSeed, subjectId, fieldPath)` pre-computes a unique seed for every (record, field) pair upfront. Each record gets its own independent `createPrng(fieldSeed(...))` — no shared parent PRNG ever forks the same key twice. There is nothing to cache.

---

See also: [Batch Generation](batch-generation.md) · [Back to Index](index.md)
