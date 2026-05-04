# Advanced Topics

For power users hitting edge cases or extending the library. Assumes familiarity with [Core Concepts](core-concepts.md).

---

## The PRNG model: per-field seeding

### Algorithm

`zod4-mock` uses **Mulberry32** as its PRNG — a 32-bit state generator with fast output and excellent statistical distribution for mock-data purposes.

Seed derivation uses **FNV-1a 32-bit** hashing, which has low collision rates and is fast for short strings.

### `fork(key)`

`prng.fork(key)` derives a child PRNG without consuming the parent's state:

```ts
const child = ctx.prng.fork('my-subfield')
// ctx.prng and child are fully independent
// calling fork('my-subfield') again on the same prng gives an equivalent child
```

The child seed is `fnv1a("${parentSeed}:${key}")`. Because the parent state is not consumed, forking twice with the same key always produces the same child — useful when a matcher needs multiple independent random values:

```ts
lines: (s, ctx) => {
  const count = ctx.prng.int(1, 4)           // uses field PRNG
  return Array.from({ length: count }, (_, i) => {
    const linePrng = ctx.prng.fork(`line-${i}`) // independent per line
    return { quantity: linePrng.int(1, 10) }
  })
}
```

### Per-field seeding

Each field in each schema gets its own PRNG, derived via:

```
seed = fnv1a("${worldSeed}:${subjectId}:${fieldPath}")
```

This is the `fieldSeed(worldSeed, subjectId, fieldPath)` function exported from the library.

**The invariant:** adding, removing, or reordering a field in a schema does **not** change the generated values for any other field. The `lastName` of `person#1` is the same before and after you add a `middleName` field, because `lastName`'s seed depends only on the world seed, the subject ID, and the literal string `"lastName"`.

This matters for snapshot testing: a schema change in one file cannot invalidate snapshots from another file that uses the same world seed.

---

## Using `createPrng` and `fieldSeed` directly

```ts
import { createPrng, fieldSeed } from 'zod4-mock'
```

### `createPrng(seed)`

Creates a standalone Mulberry32 PRNG. Useful when writing a custom orchestration layer or a generator test.

```ts
const prng = createPrng(42)
prng.random()          // → 0.something deterministic
prng.int(1, 100)       // → integer in [1, 100]
prng.fork('child')     // → independent child PRNG
```

### `fieldSeed(worldSeed, subjectId, fieldPath)`

Derives the per-field seed without going through a world. Useful when you want to reproduce the exact PRNG state for a specific field:

```ts
const seed = fieldSeed(42, 'person#1', 'email')
const prng = createPrng(seed)
// prng is now at the same state the world would use for person#1's email field
```

---

## Custom `KeyGenerator` in depth

`KeyGenerator` is typed as:

```ts
type KeyGenerator<T = unknown> = (schema: ZodTypeAny, ctx: GeneratorContext) => T
```

### The full `GeneratorContext`

```ts
interface GeneratorContext {
  prng:                Prng                    // already forked for this field
  subject:             AnySubjectInstance | undefined
  registry:            Registry
  fieldPath:           string                  // e.g. 'address.street'
  optionalProbability?: number
}
```

**`ctx.prng`** is already forked for the current field. Use it directly for a single random value. If you need multiple independent values for one field, fork further: `ctx.prng.fork('a')`, `ctx.prng.fork('b')`.

**`ctx.subject`** is `undefined` for ad-hoc generation (no subject bound). Guard against this if your generator references subject data:

```ts
vendorCode: (_schema, ctx) => {
  const prefix = ctx.subject?._type === 'supplier' ? 'S' : 'V'
  return `${prefix}-${ctx.prng.int(1000, 9999)}`
},
```

**`ctx.registry`** is the live world registry — you can reference already-generated subjects. This makes key generators as powerful as matchers for cross-schema lookups.

**`ctx.fieldPath`** is the dot-separated path, e.g. `'address.street'` or `'lines.0.productId'`. Use it to write context-sensitive generators:

```ts
amount: (schema, ctx) => {
  // Generate a smaller amount for nested line items
  if (ctx.fieldPath.startsWith('lines.')) return ctx.prng.int(1, 100) * 100
  return ctx.prng.int(100, 10000) * 100
},
```

### Gating on schema type

The built-in heuristics only fire for the appropriate Zod type (string, number, date). Mirror this in custom generators to avoid producing the wrong type:

```ts
import type { ZodTypeAny } from 'zod'

function isNumberSchema(schema: ZodTypeAny): boolean {
  return (schema as any)._zod.def.type === 'number'
}

world.withGenerators({
  duration: (schema, ctx) => {
    if (!isNumberSchema(schema)) return undefined // skip — not a number
    return ctx.prng.int(30, 3600)
  },
})
```

Returning `undefined` from a custom `KeyGenerator` causes the world to fall through to schema-based generation.

---

## Multi-type schema binding

Calling `.withSchema(schema, subjectTypeA, ...)` and `.withSchema(schema, subjectTypeB, ...)` with the same schema object registers it for both types.

### `generate(z.array(schema))` behaviour

When an array is generated for a multi-bound schema, the world produces **one item per subject**, cycling through all bound types in registration order:

```ts
// 2 text-file subjects + 1 audio-file subject → 3 items in registration order
world.generate(z.array(RawDataSchema))
// → [text-file item, text-file item, audio-file item]
```

### `generate(schema)` behaviour (single item)

Cycles through all bound subjects deterministically across successive calls:

```ts
world.generate(RawDataSchema) // → text-file subject's data
world.generate(RawDataSchema) // → audio-file subject's data
world.generate(RawDataSchema) // → bank-file subject's data
world.generate(RawDataSchema) // → text-file subject's data (wraps)
```

### Pinning to one type

```ts
world.generate(z.array(RawDataSchema), { subject: 'text-file' })
// → only items from text-file subjects
```

### Controlling subject counts

The world creates subjects lazily to satisfy array length constraints. If you need equal counts of each type, create subjects explicitly before calling `generate`:

```ts
// Force 3 of each type before generating the array
world.subject('text-file')  // text-file#1
world.subject('text-file')  // text-file#2
world.subject('text-file')  // text-file#3
world.subject('audio-file') // audio-file#1
world.subject('audio-file') // audio-file#2
world.subject('audio-file') // audio-file#3

const rawdata = world.generate(z.array(RawDataSchema))
// → 6 items, 3 text + 3 audio, in registration order
```

---

## Relations (declared but not yet enforced)

`defineSubjectType` accepts an optional `relations` map:

```ts
const PersonSubject = defineSubjectType('person', personSchema, {
  relations: {
    employer: { type: 'company', cardinality: '1' },
    reports:  { type: 'person',  cardinality: '0..n' },
  },
})
```

**Currently, relations are metadata only.** The world does not automatically generate related subjects or enforce referential constraints. They serve as inline documentation on the subject type.

Implement cross-subject references manually via matchers and the registry:

```ts
.withSchema(PersonApiSchema, PersonSubject, {
  employerId: (_, ctx) => ctx.registry.pick<{ companyId: string }>('company').companyId,
})
```

Future versions may use declared relations to auto-generate related subjects. For now, treat `relations` as a schema-level annotation.

---

## Zod v4 internals: `_zod.def`

Zod v4 stores schema definitions at `schema._zod.def` (not `schema._def` as in v3). The library accesses this directly via type-casting since Zod v4 does not expose a stable public introspection API:

```ts
function def(schema: ZodTypeAny) {
  return (schema as unknown as { _zod: { def: ZodDef } })._zod.def
}
```

If you write a custom `KeyGenerator` that needs to introspect the schema type, use the same pattern:

```ts
const type = (schema as any)._zod.def.type
// → 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum' | ...
```

Zod checks are class instances accessed via `check._zod.def`:

```ts
const checks = (schema as any)._zod.def.checks as Array<{ _zod: { def: { check: string; value?: unknown } } }>
for (const c of checks ?? []) {
  if (c._zod.def.check === 'min_length') { /* ... */ }
}
```

This is intentional and stable within Zod v4. Do not use it against Zod v3 — v3 uses `schema._def` with a completely different shape.

---

## TypeScript strictness

The library compiles with two strict flags that affect consumers.

### `exactOptionalPropertyTypes`

With this flag, `{ key: undefined }` is not assignable to `{ key?: string }`. This affects how you write `overrides` objects:

```ts
// ✗ Not valid with exactOptionalPropertyTypes
world.generate(schema, { overrides: { middleName: undefined } })

// ✓ Just omit the key
world.generate(schema, { overrides: {} })
```

If your project does **not** use `exactOptionalPropertyTypes`, you won't notice any difference.

### `noUncheckedIndexedAccess`

Array indexing returns `T | undefined`. The library handles this internally with `!` assertions where the array length is known. If you consume the library's output in a project with this flag:

```ts
const people = world.generate(z.array(PersonApiSchema).min(1))
const first  = people[0]   // → PersonApiSchema['_output'] | undefined
const first2 = people[0]!  // → PersonApiSchema['_output']  (use ! if you know it exists)
```

---

## Node16 ESM: import extensions

The library ships as ESM with `.js` extensions on all internal imports (required by `"moduleResolution": "Node16"`).

When consuming the library in your project, import from the package name — no extension needed:

```ts
import { createWorld, defineSubjectType } from 'zod4-mock'
```

If you copy-paste from the integration test files (which import from `'../../../src/index.js'`), change those paths to the package name.

---

## Ad-hoc `generateFromSchema` and `generateFromKey`

These low-level functions are exported for building custom orchestration outside of a world.

```ts
import { generateFromSchema, generateFromKey, createPrng } from 'zod4-mock'
import type { GeneratorContext } from 'zod4-mock'
```

Both require a `GeneratorContext`. Construct a minimal one:

```ts
const prng = createPrng(42)

const ctx: GeneratorContext = {
  prng,
  subject:             undefined,
  registry:            {
    store:   () => {},
    all:     () => [],
    pick:    () => { throw new Error('empty') },
    pickBy:  () => { throw new Error('empty') },
    filter:  () => [],
    count:   () => 0,
  },
  fieldPath:           'root',
  optionalProbability: 0,
}

const value = generateFromSchema(z.string().email(), ctx)
// → a valid email address
```

`generateFromKey` returns `undefined` for unrecognised keys:

```ts
const val = generateFromKey('email', z.string().email(), ctx)
// → email string

const notFound = generateFromKey('unknownField', z.string(), ctx)
// → undefined (caller should fall back to generateFromSchema)
```

These functions are useful for:
- Unit-testing a custom generator in isolation
- Writing a thin wrapper around the library's generation logic
- Generating a single value outside of a full world session
