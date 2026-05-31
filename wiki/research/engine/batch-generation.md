# Array Batch Generation

## The Problem

Generating an array of N objects with the current API calls `generate(innerSchema)` N times inside the `ZodArray` handler. Each iteration independently calls `fieldSeed(worldSeed, subjectId, fieldPath)` for every field — building and hashing the full key string from scratch.

For a 50-field inner schema with an array of 1,000 elements, that's 50,000 FNV-1a hash calls where the `worldSeed` and `fieldPath` components are stable across all iterations.

## The Solution: Transparent Array Batching

No new API method is needed. `generate(z.array(Schema).length(N))` **is** the batch call — the optimization is an implementation detail of the `ZodArray` generator in `src/generators/schema/collection.ts`.

Before the element loop, pre-compute a base seed for each field path in the inner schema once. For each element, derive that element's field seed cheaply via XOR with a hash of the element index:

```typescript
// Inside the ZodArray generator — pseudocode

// Pre-compute once per array (O(F) hashes, where F = number of fields)
const baseSeeds = precomputeFieldSeeds(worldSeed, innerSchema);
// { "firstName": 0xABCD1234, "email": 0xDEADBEEF, ... }

// Per element: O(1), no string construction
function elementFieldSeed(baseSeed: number, elementIndex: number): number {
  return baseSeed ^ splitmix32(elementIndex);
}

// Generate elements
const result = [];
for (let i = 0; i < count; i++) {
  result.push(generateRecord(innerSchema, baseSeeds, i));
}
```

`precomputeFieldSeeds` traverses the inner schema once, hashing `"worldSeed:fieldPath"` for each leaf field. For all subsequent elements, each field's seed is a single XOR and a cheap integer hash — no string allocation.

### Nested Arrays

The optimization applies recursively. When `precomputeFieldSeeds` encounters a `ZodArray` node while traversing, it recurses into that array's inner schema, using a fixed index range to generate paths like `items[0].price`, `items[1].price`, etc.:

- Fixed-length arrays (`z.array(...).length(N)`) — use the schema's declared length.
- Variable-length arrays — use `defaultArrayLength` as the pre-computation bound (the same length the element loop will use).

### No API Change

The caller sees no difference:

```typescript
// These are equivalent — the second just benefits from the optimization
const users = generate(z.array(UserSchema)); // small array
const bulk = generate(z.array(UserSchema).length(1000)); // batch path
```

## Expected Impact

For a 50-field inner schema generating an array of 1,000 elements:

| Approach                                       | FNV-1a hash calls | String allocations |
| ---------------------------------------------- | :---------------: | :----------------: |
| Current (50,000 independent `fieldSeed` calls) |      50,000       |       50,000       |
| Array batching (pre-compute + XOR)             |  50 + 1,000 XORs  |         50         |

## Determinism Guarantee

The batched path must produce identical output to the current unbatched path. The invariant to test:

```typescript
const batched = generate(z.array(UserSchema).length(N));
const sequential = Array.from({ length: N }, (_, i) => generate(UserSchema, { subjectIndex: i }));
expect(batched).toEqual(sequential);
```

---

See also: [PRNG Improvements](prng-batching.md) · [Back to Index](../overview.md)
