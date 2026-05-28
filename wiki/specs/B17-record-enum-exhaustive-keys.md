# B17: BUG — `z.record(enum, V)` should generate all enum keys, not a random subset

## Context

`generateZodRecord` in [src/generators/schema/collection.ts](../../src/generators/schema/collection.ts)
unconditionally rolls `ctx.prng.int(2, 5)` entries and asks the `keyType` schema to
generate each key — regardless of whether the `keyType` is open-ended (`z.string()`,
`z.number()`) or **finite** (`z.enum([...])`, a literal-union, etc.). For a finite
`keyType`, Zod v4 makes the record **strict over the key set**: the inferred type of
`z.record(z.enum(['A','B','C']), z.number())` is `{ A: number; B: number; C: number }`,
all keys required. Generated values silently fail `schema.parse(value)` because keys
are missing (typically only 1–2 of the 3 enum members appear), as captured by the item
card and GitHub issue #18.

The offending loop, today:

```ts
// src/generators/schema/collection.ts — generateZodRecord
const count = ctx.prng.int(2, 5);     // always 2–5 random picks
for (let i = 0; i < count; i++) {
  const rawKey = ctx.generate(d.keyType!, { prng: ctx.prng.fork(`rk-${i}`), ... });
  // …
  result[key] = ctx.generate(d.valueType!, { prng: ctx.prng.fork(`rv-${i}`), ... });
}
```

When `d.keyType` is a finite-key type, the fix is to read the key set off the
`keyType`'s `_zod.def` and emit **exactly one entry per key**, in declared order; when
it is open-ended (the **open-key** case), today's 2–5 random-key loop is left untouched.

**Finite-key vs open-key.** This spec is scoped to the finite-key case:

- **Finite-key (in scope):** `z.enum([...])`. Zod v4 exposes the member set at
  `def.entries` (a `Record<string, string>` keyed by member name); `Object.keys(d.entries)`
  yields the declared member order. The codebase already uses this exact shape at
  `src/generators/schema/router.ts` line 78 (`Object.keys(d.entries!)`).
- **Open-key (unchanged):** `z.record(z.string(), V)`, `z.record(z.number(), V)`, and any
  other `keyType` whose def shape does not expose a finite key set. These keep the
  current 2–5 random-key behaviour.

**Zod v4 internals (per D3).** All key-set introspection MUST be read through the
existing `def()` helper in [src/generators/schema/zod-def.ts](../../src/generators/schema/zod-def.ts)
(`schema._zod.def`), not `_def`. The relevant fields:

- `enum`: `d.type === "enum"` and `d.entries` is a `Record<string, string>` whose
  **values** are the runtime member strings and whose **keys** are the declared member
  names. `Object.values(d.entries)` is the parse-time key set Zod accepts; the current
  enum generator in `router.ts` uses `Object.keys(d.entries)` to index into
  `d.entries` and return a value — equivalent for plain `z.enum([...])` (entries are
  `{A:'A', B:'B', C:'C'}`), and the spec adopts the same `Object.values(d.entries)`
  shape for the record key set since that is what Zod uses at parse time.

**Determinism (per D4).** The generator MUST stay per-field deterministic. Two
properties combine:

1. **Key order is deterministic and matches the enum's declared member order.** The
   enum's declared order is read from `Object.values(d.entries)`; do not shuffle.
   Iterating in declared order means adding/removing an enum member only changes the
   per-member entries that the change touches (the appended key, or the removed key),
   leaving previously generated members at the same positions in the output object.
2. **Per-key value PRNG is forked by a stable key derived from the entry's position,
   matching today's `rv-${i}` pattern.** Forking by index keeps the change minimal vs.
   the existing code and is sufficient under the "declared-order" rule above: index `i`
   maps to the `i`-th declared enum member, so adding a new member at the **end** of
   the enum disturbs only that new member's value. (Removing a member or inserting one
   in the middle shifts the trailing indices — an acceptable cost for the minimal-diff
   choice, consistent with how today's `el-${i}`, `t-${i}`, and `rv-${i}` forks behave
   for arrays/tuples/records.)

**Bug practice (per `.claude/practices/debugging.md`).** The failure mode is encoded
precisely in the regression scenario (B17-R5) so the bug cannot return: the exact card
repro (`z.record(z.enum(['PENDING','IN_PROGRESS','DONE']), z.number())`) must produce
all three keys **and** pass `schema.parse(value).success === true`.

**Doc target (per D5).** `docs/api-reference.md` does **not** document record-of-enum
exhaustion (record entries in `api-reference.md` cover the `relations`/`registry`
API surface, not generator key-set behaviour). The record/enum schema coverage table
in [docs/zod4-schema-coverage.md](../../docs/zod4-schema-coverage.md) lines 180–215
**does** document both `z.record(keySchema, valueSchema)` and `z.enum([...values])`
— this is the document the fix updates. The `z.record(keySchema, valueSchema)` row
gains a **Notes** entry stating that finite-key `keyType`s (enum) are exhausted (one
entry per enum member) so the result satisfies the strict-key inferred type. No
public API/method changes, so `docs/api-reference.md` does not require an entry per
D5 for this item.

Item card: [wiki/backlog/doing/B17-record-enum-exhaustive-keys.md](../backlog/doing/B17-record-enum-exhaustive-keys.md);
GitHub issue #18.

Relevant code:

- [src/generators/schema/collection.ts](../../src/generators/schema/collection.ts) —
  `generateZodRecord` (the loop to fix), `generateZodMap` (left unchanged — see Out of scope).
- [src/generators/schema/router.ts](../../src/generators/schema/router.ts) — the
  `case "enum"` branch reads `d.entries`; the new helper reuses the same shape.
- [src/generators/schema/zod-def.ts](../../src/generators/schema/zod-def.ts) — the
  `def()` helper (the only place we touch `_zod.def`, per D3).
- [docs/zod4-schema-coverage.md](../../docs/zod4-schema-coverage.md) — the doc table
  updated under D5.

Per **D6**, this bug fix MUST add a regression test. Per the architecture Rules, the
implementation MUST NOT use `any`, all relative imports MUST use `.js` extensions, all
Zod-internals access MUST go through `_zod.def` (via `def()`), and the generator MUST
stay per-field deterministic (per-key PRNG fork).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B17-R1: `z.record(enum, V)` emits one entry per enum member in declared order

`generateZodRecord` MUST detect the finite-key case where `def(d.keyType).type === "enum"`
and emit **exactly one entry per enum member**, iterating in the **declared member
order** read from `Object.values(def(d.keyType).entries)`. The returned object MUST
have its keys appear in declared order (so iteration order, `Object.keys`, and
`JSON.stringify` reflect the enum's declared order). The generated value MUST satisfy
`schema.parse(value).success === true`.

This applies regardless of how many enum members exist (≥ 1). If the enum is empty
(no members), the result MUST be `{}` (no entries) — Zod accepts an empty object for
a record of an empty enum's keys.

- Scenario: three-member enum produces all three keys, in declared order
  GIVEN `const Status = z.enum(['PENDING', 'IN_PROGRESS', 'DONE'])`
  AND `const schema = z.record(Status, z.number())`
  AND a world with seed `1`
  WHEN `world.generate(schema)` (or zero-config `generate(schema)`) is called
  THEN the returned value has exactly these keys: `['PENDING', 'IN_PROGRESS', 'DONE']`
  AND `Object.keys(value)` deep-equals `['PENDING', 'IN_PROGRESS', 'DONE']` (declared
  order, not alphabetical)
  AND `schema.parse(value).success === true`
  AND every entry's value is a number (the `valueType` generator ran for each key).

- Scenario: single-member enum produces a single entry
  GIVEN `const One = z.enum(['ONLY'])` AND `const schema = z.record(One, z.string())`
  WHEN `generate(schema)` is called
  THEN `Object.keys(value)` deep-equals `['ONLY']`
  AND `schema.parse(value).success === true`.

### B17-R2: `z.nativeEnum(...)` — out of scope (documented)

The codebase currently does **not** support `z.nativeEnum(...)` in the schema-based
router ([docs/zod4-schema-coverage.md](../../docs/zod4-schema-coverage.md) line 213
marks it ❌). Adding `nativeEnum` support is its own backlog item, not a side-effect
of this bug fix. This spec MUST NOT extend the finite-key exhaustion to `nativeEnum`
key types; if a user passes `z.record(z.nativeEnum(MyEnum), V)`, behaviour MAY be
inherited from whatever the router does today (currently: falls through to the
existing 2–5 random-key path, because `def(keyType).type` is not `"enum"`). When
`nativeEnum` support is added in a future item, **that** item MUST extend
`generateZodRecord`'s finite-key detection to include it.

- Scenario: `z.record(z.nativeEnum(...), V)` is not promised to be exhausted
  GIVEN a record whose `keyType` is `z.nativeEnum(...)` (not currently supported by
  the schema router)
  WHEN `generate(schema)` is called
  THEN the result is **not** required by this spec to contain all native-enum
  members; the spec explicitly defers that case to a follow-up item.

### B17-R3: `z.union([z.literal('A'), z.literal('B'), ...])` — out of scope (documented)

Literal-union `keyType`s (`z.union([z.literal('A'), z.literal('B')])`) are deliberately
**out of scope** for this fix. Rationale: the Zod-v4 def shape for a `union` exposes
`d.options: ZodTypeAny[]` rather than a flat key-value table, and extracting the
union's literal member set requires walking each option's `def`, special-casing what
counts as a "literal" (only `z.literal(value)`, but how to handle `z.literal([..])`,
mixed-type unions, or a single nullable literal?), and rejecting unions that mix
literals with non-literal members. That logic is non-trivial and brittle for a bug
fix scoped to the card's repro. The fix MAY extend in a follow-up item; this spec
draws the line at the `enum` keyType case explicitly handled by Zod's `def.entries`.

If a user passes `z.record(z.union([z.literal('A'), z.literal('B')]), V)`, behaviour
is inherited from today's 2–5 random-key path (no exhaustion), and `schema.parse`
may still fail — same as today. This is documented under Out of scope and the doc
update (D5) names enum only, not literal-unions.

- Scenario: literal-union keyType is not promised to be exhausted
  GIVEN `const schema = z.record(z.union([z.literal('A'), z.literal('B')]), z.number())`
  WHEN `generate(schema)` is called
  THEN the result is **not** required by this spec to contain both `A` and `B`; the
  spec explicitly defers that case to a follow-up item.

### B17-R4: open-key `z.record(z.string(), V)` / `z.record(z.number(), V)` unchanged

For non-finite key types — specifically when `def(d.keyType).type !== "enum"` — the
generator MUST keep today's 2–5 random-key behaviour byte-for-byte (same `ctx.prng.int(2, 5)`
count, same `rk-${i}` / `rv-${i}` fork seeds, same `rawKey → key` coercion). No change
in determinism: a fixed seed MUST produce the same record for `z.record(z.string(), V)`
or `z.record(z.number(), V)` before and after this fix (regression guard).

- Scenario: `z.record(z.string(), z.number())` unchanged at a fixed seed
  GIVEN `const schema = z.record(z.string(), z.number())`
  AND a world with seed `1`
  WHEN `world.generate(schema)` is called both before and after the B17 implementation
  THEN both outputs deep-equal each other (key set, key strings, values, key order),
  AND the result has between 2 and 5 entries inclusive.

- Scenario: `z.record(z.number(), z.string())` unchanged at a fixed seed
  GIVEN `const schema = z.record(z.number(), z.string())`
  AND a world with seed `1`
  WHEN `world.generate(schema)` is called both before and after the B17 implementation
  THEN both outputs deep-equal each other,
  AND the result has between 2 and 5 entries inclusive.

### B17-R5: regression test for the card's exact repro

Per D6, a regression test for the exact failure in the item card MUST live under
`tests/unit/generators/domains/collection.test.ts` (extending the existing
`schema/collection` describe block) and MUST assert the card's repro:

```ts
const Status = z.enum(['PENDING', 'IN_PROGRESS', 'DONE']);
const schema = z.record(Status, z.number());
const value = generate(schema);
// → all three keys present
// → schema.parse(value).success === true
```

The test MUST assert **both** halves: (a) `Object.keys(value).sort()` deep-equals
`['DONE', 'IN_PROGRESS', 'PENDING']` (sorted to make the assertion stable regardless
of declared-order assertion in B17-R1, so a regression to "missing one key" fails
this assertion specifically) AND (b) `schema.safeParse(value).success === true`. A
regression that drops back to "2–5 random keys" fails (a); a regression that picks
all keys but emits an incompatible value type fails (b).

- Scenario: regression test exists and asserts both halves of the card's expectation
  GIVEN the test file at `tests/unit/generators/domains/collection.test.ts` containing
  the regression case
  WHEN `pnpm test` is run
  THEN the test passes,
  AND it asserts both the all-three-keys condition (`Object.keys(value).sort()` deep-equals
  `['DONE', 'IN_PROGRESS', 'PENDING']`) and `schema.safeParse(value).success === true`.

### B17-R6: per-key value PRNG forked deterministically per key

The per-key value generator MUST be invoked with a per-key PRNG derived from a stable
key tied to the entry's position in the iteration (the existing `rv-${i}` pattern is
sufficient and SHOULD be preserved unchanged). This keeps the change minimal and
aligns with **D4** (per-field PRNG `fork`): for a finite `keyType`, iterating in
declared order means the `i`-th entry's value is generated from `ctx.prng.fork('rv-${i}')`,
so adding a new enum member **at the end** of the enum disturbs only the new member's
value, leaving previously generated values byte-identical.

- Scenario: appending an enum member only disturbs the new member's value
  GIVEN `const E1 = z.enum(['A', 'B'])` AND `const S1 = z.record(E1, z.number())`
  AND `const E2 = z.enum(['A', 'B', 'C'])` AND `const S2 = z.record(E2, z.number())`
  AND two worlds `w1`, `w2` both seeded with `1`
  WHEN `w1.generate(S1)` and `w2.generate(S2)` are computed
  THEN `w1.generate(S1).A === w2.generate(S2).A` AND `w1.generate(S1).B === w2.generate(S2).B`
  (the values for the pre-existing members are byte-identical),
  AND `w2.generate(S2).C` is a number (the new member got its own value).

- Scenario: same enum and same seed produces identical output across runs
  GIVEN `const Status = z.enum(['PENDING', 'IN_PROGRESS', 'DONE'])`
  AND `const schema = z.record(Status, z.number())`
  AND two worlds both seeded with `42`
  WHEN both call `world.generate(schema)`
  THEN both outputs deep-equal each other (deterministic across the per-key fork).

### B17-R7: documentation update under D5

Per D5, the public-output change MUST be reflected in
[docs/zod4-schema-coverage.md](../../docs/zod4-schema-coverage.md) in the same step as
the implementation, in the `z.record(keySchema, valueSchema)` table at lines 180–187.
The `z.record(keySchema, valueSchema)` row's **Notes** column MUST gain a brief entry
stating that when `keySchema` is a finite-key type (`z.enum([...])`), the record is
exhausted (one entry per enum member, declared order) so the output satisfies Zod's
strict-key inferred type. `docs/api-reference.md` is **not** updated by this item
(no public API or method change; the doc rule fires on API shape, and the rule's
binding line in `architecture.md` names `docs/api-reference.md` specifically — the
spec extends the same discipline to `docs/zod4-schema-coverage.md` for an output-
behaviour change).

- Scenario: schema-coverage doc names the new behaviour
  GIVEN the merged B17 implementation
  WHEN [docs/zod4-schema-coverage.md](../../docs/zod4-schema-coverage.md) is opened
  THEN the `z.record(keySchema, valueSchema)` row in the section "`z.record(keySchema, valueSchema)`"
  has a Notes entry naming the finite-key (`z.enum`) exhaustion behaviour.

### B17-R8: no regressions in the full test suite

The fix MUST keep the full test suite green (`pnpm test`). No existing test assertion
MAY be changed to accommodate the fix; only **new** tests for B17-R1/R4/R5/R6 may be
added.

- Scenario: full suite green
  GIVEN the implementation of B17 on top of the current `main`
  WHEN `pnpm test` is run from the repo root
  THEN every existing test case passes with its current assertions unchanged, and the
  new B17 tests also pass.

## Out of scope

- **`z.map(enum, V)` is unchanged (Option (b) chosen).** `generateZodMap`
  ([src/generators/schema/collection.ts](../../src/generators/schema/collection.ts))
  is left at its current 2–4 random-key shape. Rationale: (1) the user pain point in
  issue #18 is records, because Zod records of enums are **strict-keyed** at parse
  time — that is what makes the random-subset output a hard failure. Maps are
  consumed as iterables, and the `z.map(keyType, valueType)` schema's parse semantics
  do not require every enum member to be a Map key, so the random-subset output is
  not a hard `parse` failure the way it is for records. (2) The card's repro is
  records only; (3) the `z.map(enum, V)` case is rarer in practice; (4) keeping the
  diff minimal aligns with **bug practice** — fix the root cause of the reported
  failure, do not bundle a parallel behavioural change. A follow-up backlog item MAY
  later extend exhaustion to `generateZodMap` for consistency; this spec deliberately
  does not.
- **`z.nativeEnum(TsEnum)` key types** (see B17-R2). Not currently supported by the
  schema router; adding it is its own item.
- **Literal-union key types** (`z.union([z.literal('A'), ...])`) (see B17-R3). Out of
  scope for this fix; a follow-up item MAY extract literal members from a `union` def
  and apply the same exhaustion treatment.
- **`z.partialRecord(...)`, `z.looseRecord(...)`** ([docs/zod4-schema-coverage.md](../../docs/zod4-schema-coverage.md)
  lines 186–187 mark both ❌ today). Not in scope; both remain unsupported.
- **Schema-based generation for `z.enum(...)` itself** (when an enum appears as a
  field type, not a `keyType`). The `case "enum"` branch in
  [src/generators/schema/router.ts](../../src/generators/schema/router.ts) is unaffected
  — the record fix reads the enum's member set, it does not change how an enum value
  is generated.
- **Public API or type-surface changes.** No new method, no signature change.
  `GenerateOptions`/`World`/registry types are untouched. Because the doc rule in
  `architecture.md` is keyed to public API changes, `docs/api-reference.md` does not
  require an entry for this item; the doc target is `docs/zod4-schema-coverage.md`
  (R7).

## Open questions

No blocking open questions remain; the spec can advance to `test-writer`.

- **Should `generateZodMap` get the same finite-key exhaustion as `generateZodRecord`?
  — Non-blocking, resolved as Option (b) (no).** The card raised this. This spec
  picks Option (b): leave `generateZodMap` unchanged. Rationale is documented under
  Out of scope. If a follow-up item is filed to extend exhaustion to Maps, that item
  inherits the helper this fix introduces.
- **Should literal-union `keyType` be exhausted? — Non-blocking, resolved as no
  (B17-R3).** Out of scope; the def-walk to extract a union's literal members is
  brittle for a bug fix. A follow-up item MAY add it.
- **Should `z.nativeEnum` `keyType` be exhausted? — Non-blocking, resolved as no
  (B17-R2).** `nativeEnum` is not supported anywhere in the router today; adding it
  is its own item, which would then extend `generateZodRecord`'s finite-key
  detection.
