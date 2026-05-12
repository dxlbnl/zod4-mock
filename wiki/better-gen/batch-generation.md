# Batch Generation API

## The Problem

Generating 10,000 mock records with the current API requires calling `world.generate(schema)` 10,000 times. Each call is fully independent — it re-hashes the same field paths from scratch.

The cost is in `fieldSeed()`, which builds and hashes the string `"worldSeed:subjectId:fieldPath"` for every field of every record:

```typescript
// Executed 50,000 times for a 50-field schema × 1,000 records
function fieldSeed(worldSeed: number, subjectId: string, fieldPath: string): number {
  return fnv1a(`${worldSeed}:${subjectId}:${fieldPath}`);
}
```

The `worldSeed` and `fieldPath` components are stable — only `subjectId` changes between records. Yet we re-hash the whole string every time.

## The Proposal: `generateBatch(schema, n)`

A dedicated batch API pre-computes per-field base seeds once and derives per-record values cheaply:

```typescript
interface World {
  // Existing
  generate<T>(schema: ZodType<T>, options?: GenerateOptions<T>): T;

  // New
  generateBatch<T>(
    schema: ZodType<T>,
    count: number,
    options?: GenerateOptions<T>,
  ): T[];
}
```

### Incremental Seeding Strategy

For a given field path, the per-record seed is derived from the base field seed XOR'd with the record index:

```typescript
// Pre-compute once per batch
const baseSeeds = precomputeFieldSeeds(worldSeed, schema);
// baseSeeds = { "firstName": 0xABCD1234, "email": 0xDEADBEEF, ... }

// Per record: fast, no string construction
function recordFieldSeed(baseSeed: number, recordIndex: number): number {
  // XOR with a hash of the index to avoid trivial patterns
  return baseSeed ^ splitmix32(recordIndex);
}
```

`precomputeFieldSeeds` traverses the schema once, collecting all field paths. It hashes `"worldSeed:fieldPath"` for each — a one-time cost. Then for each record, deriving a field's seed is a single XOR and a cheap integer hash.

### `precomputeFieldSeeds`

```typescript
function precomputeFieldSeeds(
  worldSeed: number,
  schema: ZodType,
): Map<string, number> {
  const seeds = new Map<string, number>();
  traverseSchema(schema, (fieldPath) => {
    seeds.set(fieldPath, fnv1a(`${worldSeed}:${fieldPath}`));
  });
  return seeds;
}
```

This traversal runs in O(F) where F = number of fields. For all subsequent records, seed derivation is O(1) per field.

## Expected Impact

For a 50-field schema generating 1,000 records:

| Approach | FNV-1a calls | String allocations |
|----------|:-----------:|:-----------------:|
| Current (`generate()` × 1000) | 50,000 | 50,000 |
| `generateBatch(schema, 1000)` | 50 + 1,000 cheap XORs | 50 |

The exact speedup depends on field count and schema complexity, but for bulk test-data generation (seeding databases, generating fixtures) this is a meaningful improvement.

## Determinism Guarantee

The batch API must produce the same result as calling `generate()` N times sequentially with incremented subject IDs. This is the correctness invariant to test: `generateBatch(schema, N)` equals `Array.from({ length: N }, (_, i) => generate(schema, { subjectIndex: i }))`.

---

See also: [PRNG Improvements](prng-batching.md) · [Back to Index](index.md)
