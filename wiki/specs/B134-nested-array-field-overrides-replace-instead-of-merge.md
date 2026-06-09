# B134: BUG — array-field overrides replace elements instead of per-index deep-merge (unify the override-application flow)

## Context

User-reported via `playground.ts` (label "failing overrides"):

> `generate` does not cleanly apply overrides to a **nested array field** inside an object.
> Overriding the array with partial elements drops the generated sibling fields instead of
> merging them.

Concretely, with:

```ts
const schema = z.object({
  name: z.string(),
  nested: z.object({ age: z.number(), name: z.string(), number: z.number() }).array(),
});

world.generate(schema, {
  overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
});
```

each `nested` element comes back as `{ "number": N }` — the generated `age` and `name` are
**dropped**. The expected per-index deep-merge (consistent with B53 for primary arrays and
with the ad-hoc / derived array arms under [[D14]]) is `{ age, name, number: N }` per
element: the override's `number` wins, the generated siblings survive.

This page elaborates the item card
[wiki/backlog/doing/B134-nested-array-field-overrides-replace-instead-of-merge.md](../backlog/doing/B134-nested-array-field-overrides-replace-instead-of-merge.md).
Reported conversationally (no GitHub issue).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

> **Prior draft corrected.** An earlier version of this spec located the bug in
> `schemaBasedStep`'s array-field branch ([src/pipeline.ts:518-531](../../src/pipeline.ts#L518))
> and proposed routing that rung through the array arm. That site is **never reached** for
> an overridden array field — **step 0** (`overrideEagerStep`) short-circuits the override
> array first. The prior fix direction was unreachable. The corrected root cause and a
> unified-flow design follow.

### Root cause (per `.claude/practices/debugging.md`)

The repro is the playground scenario above. Reading the field-resolution pipeline
([src/pipeline.ts](../../src/pipeline.ts)) and the engine
([src/world/engine.ts](../../src/world/engine.ts)) pins **two independent, compounding**
mechanisms — both of which replace an array-valued override wholesale.

**Mechanism 1 — step 0 `overrideEagerStep` returns any array override wholesale, before any
other rung.** Field overrides are dispatched per-field through `PIPELINE`. Step 0
([src/pipeline.ts:289-301](../../src/pipeline.ts#L289)) is:

```ts
export function overrideEagerStep(ctx: PipelineStepContext): FieldResolution | null {
  const o = ctx.fieldOverride;
  if (o === undefined) return null;
  if (typeof o !== "object" || o === null || Array.isArray(o)) {
    return { kind: "override", value: o }; // ← ARRAY override returned wholesale
  }
  return null;
}
```

For an array-valued `overrides[field]`, `Array.isArray(o)` is true, so step 0 returns the
override array **verbatim** as the field value and `walkPipeline` stops. No later rung runs;
the array is **never generated**, so there is nothing for any per-index merge to merge onto.
`schemaBasedStep`'s array-field branch (lines 518-531) — the prior draft's claimed site — is
**never reached** for an overridden array field. This is the primary cause of the repro.

**Mechanism 2 — the post-record whole-record `deepMerge` at engine.ts:1870 replaces array
fields too.** After the dispatcher produces a record, the single-item path runs:

```ts
if (options?.overrides) result = deepMerge(result, options.overrides);
```

([src/world/engine.ts:1870](../../src/world/engine.ts#L1870)). Because `deepMerge` treats
arrays as **leaves** (by the [[B18]] contract — a source array replaces a target array
verbatim), an array-valued field override **also** replaces the produced array wholesale
here. This pass runs on the primary / derived / ad-hoc single-record paths. So even if
Mechanism 1 were fixed in the pipeline, this second pass would **clobber** the per-field fix
and re-drop the siblings. The two mechanisms are independent and **double-guard** the bug.

The bug therefore spans **every object path** that takes a field-level override (registered
primary, derived, ad-hoc), not just one-level nested array fields — wherever an array-valued
override reaches a field. Both mechanisms must be removed in one coherent change.

### The design — a single override-application flow (the maintainer's directive)

The directive is "reduce complexity → a **single** override-application flow, without a
performance regression." B134 spec'd as a **unification**, not a surgical patch:

1. **Make the pipeline rungs override-agnostic.** Each rung produces a **raw** generated
   value; the override is applied at **exactly one** per-field site. A single helper — call
   it `applyOverride(override, innerSchema, generateRaw)` — dispatches on the override's
   **shape** and is **lazy** over generation (it controls whether `generateRaw()` runs):
   - `override === undefined` → `generateRaw()`. This is the un-overridden **hot path** and
     **MUST** be the first, fast exit — no behaviour or performance change for non-overridden
     fields (the overwhelming majority).
   - **primitive** override (string / number / boolean / bigint / `null` / symbol) → return
     the override **without** calling `generateRaw()` (skip generation entirely). This
     preserves today's determinism: step 0's primitive short-circuit consumes no PRNG draw,
     so the new site MUST NOT either.
   - **plain-object** override → `deepMerge(generateRaw(), override)` (B12 semantics: object
     fields merge recursively, generated siblings preserved).
   - **array** override → call `generateRaw()` to produce the array, then **per-index**
     deep-merge each present override slot onto the generated element — the exact semantics
     the array arms already use at
     [src/world/engine.ts:1718-1726](../../src/world/engine.ts#L1718): for each `i`,
     `overrides[i] === undefined` leaves the generated element untouched; an **object-element**
     slot merges (siblings preserved); a **primitive-element** slot replaces. The override
     array does **NOT** resize the array — schema length governance wins (`.length()` /
     min-max, else `defaultArrayLength`), strict B53-R2 / [[D14]] parity.

2. **The single site replaces all three of today's divergent mechanisms:**
   - step 0's eager array/primitive consumption (`overrideEagerStep`),
   - the per-rung `applyObjectOverride` / raw-replace divergence (matcher / keymap /
     custom-gen call `applyObjectOverride`; key-based and schema-based-leaf replace verbatim
     via `ctx.fieldOverride !== undefined ? ctx.fieldOverride : …`),
   - the post-record whole-record `deepMerge(result, options.overrides)` at engine.ts:1870.

   After the fix, overrides are **fully resolved per-field** inside the object-fields walk,
   so the whole-record second pass at engine.ts:1870 is **redundant and MUST be removed**
   (see B134-R7 — the implementer pins removal vs. proven-redundant; removal is the
   directive). The shared array-arm trailing pass (D14) and the array-element per-index merge
   are **unchanged** — they are the reference implementation the per-field array case reuses.

3. **`deepMerge` stays byte-identical** ([src/utils/merge.ts](../../src/utils/merge.ts)). The
   per-index array merge lives in the override-application path, never inside `deepMerge`
   ([[B18]] array-as-leaf is load-bearing for primitive/atomic leaves elsewhere).

4. **Sibling-visibility is preserved.** A field's resolved (override-applied) value is
   written to the in-progress record at
   [src/world/engine.ts:1397](../../src/world/engine.ts#L1397) (`result[key] = resolution.value`)
   **before** later siblings resolve, because fields resolve in shape order. So a later
   sibling's matcher reading `ctx.current.<earlier>` sees the **override-applied** value —
   exactly the eager-visibility step 0 provided today (step 0's `kind: "override"` value is
   written to `result[key]` the same way). The new single site MUST keep this ordering
   property: the override is applied **inside** the per-field resolution whose result is
   assigned to `result[key]`, not in a later whole-record pass.

### Performance (per `.claude/practices/performance.md`)

The change touches the hottest path in the library (per-field resolution). The guardrail is
the B97 allocation suite + the B98 memory suite in
[site/bench/perf.test.ts](../../site/bench/perf.test.ts), which gate per-tier time (>25 %
FAIL) and memory (>50 % FAIL) against `site/bench/results/baseline.json`.

- The **no-override** field path (`override === undefined`) MUST stay allocation- and
  PRNG-identical to today: the first branch is the bare `generateRaw()` exit; no closure
  allocation, no extra object, no extra PRNG draw is introduced when there is no override.
  B97/B98 measure schemas with **no** overrides, so they MUST stay green.
- **One accepted determinism change, stated explicitly so the test-writer expects it:** an
  **array-overridden** field now **draws its element PRNG** to generate the base array it
  merges onto. Today step 0 returned the override array without drawing any element PRNG; the
  fix generates the array first. This is correct (the whole point — there must be a generated
  element to merge onto) and **per-field-local** (the array field forks its own element PRNG
  keyed on the array schema reference + slot, exactly as an un-overridden generation of that
  field would; D4/D10 — a sibling field's seed is undisturbed). It changes only the
  array-overridden field's own values, which the user is overriding anyway.

### Composition with shipped Rules and sibling specs

- **[[B18]]** — `deepMerge` treats arrays as leaves; **preserved unchanged** (B134-R5).
- **[[B53]]** ([B53-primary-array-per-index-overrides.md](B53-primary-array-per-index-overrides.md))
  / **D14** — per-index `overrides` deep-merge per record on every array arm. B53-R2 is the
  reference for short / long override arrays (B134-R3 mirrors it: override never resizes).
- **[[B38]]** ([B38-primary-array-overrides-dropped.md](B38-primary-array-overrides-dropped.md))
  — history: the throw B53 lifted. B134 is the analogous correctness fix one level down (an
  array **field** of an object rather than a primary array **schema**).
- **B12** ([B12-nested-override-skips-matcher.md](B12-nested-override-skips-matcher.md)) —
  the field-level deep-merge model the single site reuses. **B12-R3** asserted "array override
  on a matcher-backed field replaces wholesale" for a **primitive-element** array
  (`z.array(z.string())`, matcher `() => ["m1","m2","m3"]`, override `["alpha","beta"]` →
  `["alpha","beta"]`, resized to length 2). Under B134's unified **no-resize per-index merge**,
  a matcher-produced array is "the generated base" exactly like a schema-produced one: the
  override merges **positionally** onto the matcher's array and does **NOT** resize it. So when
  the matcher base is **longer** than the override, the trailing matcher elements **survive** —
  `["m1","m2","m3"]` + `["alpha","beta"]` → `["alpha","beta","m3"]`. This **supersedes**
  B12-R3's wholesale-replace assertion (per the maintainer's full-unification decision); it is
  the intended, consistent consequence of B134-R1/R3/R6 (a matcher-produced array is treated as
  the generated base, never resized by the override). B12-R3 only happened to hold when the
  matcher base length equalled the override length. The superseding expectation is pinned by
  **B134-R6**. B12-R1/R5 object-merge semantics are likewise preserved by the plain-object
  branch.
- **D8** (register-equals-returned) — satisfied by construction. The override is applied
  per-field **before** the record is stored (the merged value is what `result[key]` holds and
  what `registry.store` writes), so stored == returned. Removing the post-store whole-record
  pass does not weaken D8 — the per-field site already produced the final value pre-store.
- **D11** (`PIPELINE` is the canonical ladder) — the single site is wired through the
  existing per-field resolution that drives `PIPELINE`; the rungs stay in the list and stay
  override-agnostic. No rung is open-coded at a call site; `walkPipeline` remains the
  dispatcher.
- **D14** (array-arm unification) — honoured. The per-field array case reuses the **same**
  per-index merge the arms apply; no new merge variant.
- **D4 / D10** (determinism) — preserved on the no-override path byte-for-byte; the one
  accepted change (array-overridden field draws its element PRNG) is per-field-local and
  matches an un-overridden generation of that same field.
- **D1** (no `any`) / **D13** (runtime-agnostic) — pure logic in already-shipped `src/`
  files; the override is read as `unknown` and narrowed exactly as the array arms already
  narrow `options.overrides`. No `node:*`.

## Requirements

### B134-R1: an array-valued field override on a registered object MUST per-index deep-merge, preserving siblings

When `world.generate(ObjectSchema, { overrides })` supplies an **array** at an array-typed
field (`overrides[field]` is an array), the system MUST generate the field's array from the
schema and deep-merge `overrides[field][i]` onto the **generated** element `i` — the same
per-index `deepMerge` the array arms apply
([src/world/engine.ts:1718-1726](../../src/world/engine.ts#L1718); D14) — instead of
replacing the whole generated array with the override array. Un-overridden sibling fields of
each merged element MUST be preserved. The override MUST be applied at the **single per-field
override-application site** (not in step 0's eager array branch and not in the post-record
whole-record `deepMerge`); it MUST NOT be applied in `deepMerge`.

- Scenario: registered object, nested object-array field, partial-object override merges per element
  GIVEN
  ```ts
  const Schema = z.object({
    name: z.string(),
    nested: z
      .object({ age: z.number(), name: z.string(), number: z.number() })
      .array()
      .length(4),
  });
  const world = createWorld({ seed: 1 }).withSchema(Schema);
  ```
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, {
    overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
  });
  ```
  THEN `r.nested.length === 4` AND for each `i in {0,1,2,3}`: `r.nested[i].number === i`
  (the override won) AND `typeof r.nested[i].age === "number"` AND
  `typeof r.nested[i].name === "string"` AND `r.nested[i].name.length > 0` — the generated
  `age` and `name` siblings survive the merge (they are NOT dropped). This is the exact
  playground repro; pre-fix each `r.nested[i]` is `{ number: i }` with `age` / `name`
  missing.

### B134-R2: the same array-field override MUST merge per-index on the ad-hoc (unregistered) path

The unification MUST hold on an **ad-hoc** object (no `withSchema` registration): an
array-valued field override MUST per-index deep-merge onto the generated elements, preserving
siblings, identically to the registered path. This proves the fix is in the single shared
override-application flow rather than a registered-path-only patch — the bug spanned both
mechanisms across both paths.

- Scenario: ad-hoc object with a nested object-array field, partial-object override merges per element
  GIVEN
  ```ts
  const Schema = z.object({
    name: z.string(),
    nested: z.object({ age: z.number(), name: z.string(), number: z.number() }).array().length(3),
  });
  const world = createWorld({ seed: 1 }); // NO withSchema(Schema)
  ```
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, {
    overrides: { nested: Array.from({ length: 3 }, (_, number) => ({ number })) },
  });
  ```
  THEN `r.nested.length === 3` AND for each `i in {0,1,2}`: `r.nested[i].number === i` AND
  `typeof r.nested[i].age === "number"` AND `typeof r.nested[i].name === "string"` AND
  `r.nested[i].name.length > 0` — the generated siblings survive on the ad-hoc path too.

### B134-R3: short and long override arrays on an array field MUST follow B53-R2 / D14 parity (override does not resize)

The override array MUST be applied **positionally** onto the array generated from the field
schema's length governance; it MUST NOT resize the array. When the override array is
**longer** than the generated array, the extra entries MUST be silently ignored (no throw).
When the override array is **shorter**, only positions `< overrides.length` are merged;
positions `>= overrides.length` are returned as schema-generated. This is exactly B53-R2 / the
array arms' behaviour.

- Scenario: override longer than the generated array — extras ignored
  GIVEN
  ```ts
  const Schema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array().length(2),
  });
  const world = createWorld({ seed: 1 }).withSchema(Schema);
  ```
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, {
    overrides: { items: [{ k: 10 }, { k: 11 }, { k: 12 }, { k: 13 }] },
  });
  ```
  THEN `r.items.length === 2` (the field's `.length(2)` governs, not the 4-entry override)
  AND `r.items[0].k === 10` AND `r.items[1].k === 11` AND each `r.items[i].v` is a non-empty
  string (sibling preserved); the third and fourth override entries are silently discarded
  with no throw.

- Scenario: override shorter than the generated array — tail stays schema-generated
  GIVEN
  ```ts
  const Schema = z.object({
    items: z.object({ k: z.number(), v: z.string() }).array().length(3),
  });
  const world = createWorld({ seed: 1 }).withSchema(Schema);
  ```
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, { overrides: { items: [{ k: 100 }] } });
  ```
  THEN `r.items.length === 3` AND `r.items[0].k === 100` AND each of `r.items[1]` and
  `r.items[2]` is a fully-generated element (`typeof .k === "number"`, `.v` a non-empty
  string) with no override applied.

### B134-R4: sibling-visibility — a later field's matcher MUST read the override-applied value of an earlier sibling

The single override-application site MUST write each field's resolved (override-applied) value
to the in-progress record **before** later siblings resolve, so a later field's matcher reading
`ctx.current.<earlierSibling>` sees the **override-applied** value, exactly as today's step 0
behaviour. The override MUST be applied inside the per-field resolution whose value is assigned
to `result[key]`, never deferred to a whole-record pass after all fields resolve.

- Scenario: a matcher reads an overridden earlier sibling and sees the override
  GIVEN
  ```ts
  const Schema = z.object({
    label: z.string(),
    summary: z.string(),
  });
  const world = createWorld({ seed: 1 }).withSchema(Schema, {
    matchers: {
      summary: (ctx) => `seen:${(ctx.current as { label?: string }).label ?? ""}`,
    },
  });
  ```
  (the shape orders `label` before `summary`)
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, { overrides: { label: "overridden" } });
  ```
  THEN `r.label === "overridden"` AND `r.summary === "seen:overridden"` — the `summary`
  matcher read the **override-applied** `label`, demonstrating sibling-visibility survives
  the move to the single site.

### B134-R5: the fix MUST NOT modify `deepMerge` (B18 array-as-leaf preserved)

`deepMerge` in [src/utils/merge.ts](../../src/utils/merge.ts) MUST remain byte-identical: it
MUST continue to treat any array `source` as a leaf that replaces the target verbatim
([[B18]]). The per-index array-override merge MUST live in the single override-application
path, not inside `deepMerge`. No edit to `src/utils/merge.ts` is permitted by this item.

- Scenario: `deepMerge` array-as-leaf semantics are intact
  GIVEN B134 is implemented
  WHEN `src/utils/merge.ts` is read and `deepMerge({ tags: ["a","b","c"] }, { tags: ["x","y"] })`
  is evaluated
  THEN `src/utils/merge.ts` carries no B134-introduced change to `deepMerge` (the
  `isPlainObject` guard and array-replace early return are byte-identical to pre-B134) AND
  the call returns `{ tags: ["x","y"] }` (array replaces wholesale, B18-R2 preserved).

### B134-R6: a primitive-element array field MUST merge per-index without resizing (matcher base or schema base — supersedes B12-R3 wholesale-replace)

When the array field's elements are **primitives** (e.g. `z.string().array()`) and the
override is a primitive array, each present override entry MUST replace its element (per-index
`deepMerge(primitive, override)` returns the override), and the array length MUST stay
governed by the **generated base** array — never resized by the override (B134-R3). The
"generated base" is whatever the pipeline produces for the field: a **matcher-produced** array
counts as the generated base exactly like a schema-produced one. So when the base array is
**longer** than the override, the trailing base elements MUST survive (positions
`>= overrides.length` are returned untouched). No throw fires.

This **supersedes B12-R3's** wholesale-replace assertion for a matcher-backed primitive array:
under the unified no-resize per-index merge the array is not resized to the override length, so
when the matcher returns more elements than the override supplies, the matcher's tail survives.

- Scenario: primitive-element array field (schema base), positional replace, schema length wins
  GIVEN
  ```ts
  const Schema = z.object({ tags: z.string().array().length(3) });
  const world = createWorld({ seed: 1 }).withSchema(Schema);
  ```
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, { overrides: { tags: ["alpha", "beta"] } });
  ```
  THEN `r.tags.length === 3` AND `r.tags[0] === "alpha"` AND `r.tags[1] === "beta"` AND
  `typeof r.tags[2] === "string"` with `r.tags[2].length > 0` (position 2 has no override,
  stays schema-generated). The two override entries replace positions 0–1 element-wise.

- Scenario: matcher-backed primitive array, longer matcher base — tail survives (supersedes B12-R3)
  GIVEN
  ```ts
  const Schema = z.object({ tags: z.array(z.string()) });
  const world = createWorld({ seed: 1 }).withSchema(Schema, {
    matchers: { tags: () => ["m1", "m2", "m3"] },
  });
  ```
  WHEN the consumer calls
  ```ts
  const r = world.generate(Schema, { overrides: { tags: ["alpha", "beta"] } });
  ```
  THEN `r.tags.length === 3` (the matcher base of length 3 governs — the 2-entry override does
  NOT resize it) AND `r.tags[0] === "alpha"` AND `r.tags[1] === "beta"` (positions 0–1 replaced
  by the override) AND `r.tags[2] === "m3"` (position 2 has no override entry, so the surviving
  matcher element is returned). This is the updated, superseding expectation that B12-R3's
  former wholesale-replace test (`["alpha","beta"]`) now maps to.

### B134-R7: the whole-record post-record override merge MUST be removed (single flow)

Because overrides are now fully resolved per-field inside the object-fields walk, the
post-record whole-record `deepMerge(result, options.overrides)` at
[src/world/engine.ts:1870](../../src/world/engine.ts#L1870) MUST be removed (the single
override-application flow makes it redundant — a second application is at best a no-op and at
worst re-clobbers the per-index array merge). The implementer MUST pin which: remove it, and
prove via the green suite that no override behaviour depends on it. After removal, all
override resolution flows through the one per-field site.

- Scenario: object-override behaviour is identical with the second pass gone
  GIVEN B134 implemented and the engine.ts:1870 whole-record `deepMerge` removed
  WHEN the full existing override suite runs (B12 / B18 / B53 nested-object and per-index
  override tests) plus the B134 scenarios above
  THEN `pnpm test` exits 0 — every existing override assertion (scalar override, nested-object
  sibling preservation, matcher + object override deep-merge, atomic-object override, array
  per-index merge on the arms) passes unchanged AND `src/world/engine.ts` no longer contains
  the `if (options?.overrides) result = deepMerge(result, options.overrides)` whole-record
  line.

### B134-R8: the no-override hot path MUST stay performance-neutral (B97 / B98 green)

The single override-application site MUST add **no** allocation and **no** extra PRNG draw on
the `override === undefined` (no-override) field path, which MUST remain the first fast exit.
The B97 allocation suite and the B98 memory suite in
[site/bench/perf.test.ts](../../site/bench/perf.test.ts) MUST stay within their baseline
guardrails (no FAIL) after the change. The accepted determinism change is **only** for an
array-overridden field (it draws its element PRNG to generate the base array it merges onto);
no other field's values or PRNG draws change.

- Scenario: B97 / B98 suite stays green on the no-override path
  GIVEN B134 implemented
  WHEN `pnpm test` (which runs the `site/bench/perf.test.ts` B97/B98 regression gate against
  `site/bench/results/baseline.json`) is run from the repo root
  THEN the suite exits 0 with no per-tier time FAIL (>25 %) and no memory FAIL (>50 %) on the
  `simple` / `user` / `nested` / `matcher` tiers (none of which pass `overrides`), confirming
  the no-override hot path is allocation- and PRNG-neutral.

### B134-R9: regression test — the playground repro element keeps `age`/`name` when only `number` is overridden

A regression test MUST be added under `tests/unit/` (D6) reproducing the playground "failing
overrides" scenario: a registered object with a nested object-array field, overridden with
partial objects that set only one key, MUST return elements whose un-overridden siblings are
preserved. If a regression re-drops the siblings, this test MUST be the one that fails.

- Scenario: card repro — partial `{ number }` override keeps generated `age` and `name`
  GIVEN
  ```ts
  const Schema = z.object({
    name: z.string(),
    nested: z
      .object({ age: z.number(), name: z.string(), number: z.number() })
      .array()
      .length(4),
  });
  const world = createWorld({ seed: 1 }).withSchema(Schema);
  ```
  WHEN
  ```ts
  const r = world.generate(Schema, {
    overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
  });
  ```
  THEN for every `i in {0,1,2,3}`: `Object.keys(r.nested[i]).sort()` deep-equals
  `["age", "name", "number"]` AND `r.nested[i].number === i` AND
  `typeof r.nested[i].age === "number"` AND `typeof r.nested[i].name === "string"` AND
  `r.nested[i].name.length > 0`. Pre-fix this fails because each element is `{ number: i }`.

### B134-R10: changeset entry — patch bump

A changeset file MUST be added in the same step declaring a **patch** bump for `zod4-mock`.
Rationale: a call shape that previously dropped sibling fields now correctly deep-merges,
matching the documented per-index semantics every other array path already used; the
override-flow unification is internal (no public API surface change — no new method / option /
signature). This is the same patch-bump shape B53 used for the sibling primary-array fix.

- Scenario: changeset exists with the right bump and content
  GIVEN B134 implemented
  WHEN the new `.changeset/*.md` for this item is read
  THEN its frontmatter declares `"zod4-mock": patch` AND its body summarises the bug
  (array-field overrides replaced elements wholesale via two compounding mechanisms — step-0
  eager-array consumption and the post-record whole-record `deepMerge` — dropping generated
  siblings) and the fix (a single per-field override-application site applying per-index
  deep-merge consistent with the array arms / D14; `deepMerge` unchanged; whole-record pass
  removed). No `(closes #N)` line — reported conversationally.

## Out of scope

- **Override-array-driven length.** The override array does NOT set the field array's length;
  schema length governance (`.length()` / `.min` / `.max`, else `defaultArrayLength`) wins,
  per B134-R3 / B53-R2 / D14. A consumer wanting exactly N elements pins the field schema
  length. Making the override drive length would diverge from every other array path and needs
  its own item (Q1 resolution below).
- **Changing `deepMerge`** ([[B18]]) — explicitly forbidden by B134-R5.
- **Changing the standalone array-schema paths** (primary / derived / ad-hoc array **arms**)
  — those already apply per-index overrides (B53 / B52 / D14) and are the reference the single
  site reuses. B134 unifies the **field-level** override flow; the array arms' own per-index
  merge and trailing pass are unchanged.
- **Arbitrarily-deep / multi-level array nesting** (`z.array(z.array(z.object(...)))` with
  array-of-array override entries) — see Q2. The fix is scoped to a **one-level** array field
  (`z.object({...}).array()`): the override slot maps positionally to the field's elements, and
  each element's own deep-merge / object-recursion handles further nesting **within** an
  element (an object element that itself contains a nested array recurses through the same
  per-field resolution). An override array whose entries are themselves arrays-of-arrays is not
  a B134 case.
- **Changing what an "override" means at the field level (B12 semantics)** — the
  object-merge / primitive-replace semantics are unchanged; B134 only unifies **where** the
  override is applied (one site) and fixes the array-field case to per-index merge.
- **`docs/api-reference.md` rewrite** — the documented `GenerateOptions.overrides` semantics
  ("per-index `overrides[i]` deep-merges into the i-th element on every array path") already
  describe the post-fix behaviour; B134 makes the array-**field** path conform to the docs,
  not the other way round. The implementer audits the `overrides` paragraph and reports
  "already current" or applies a one-line clarification; no D5 obligation is asserted as a
  separate requirement since no public surface changes.

## Open questions

- **Q1: Does the override array set the field array's length, or merge positionally onto a
  schema-length-governed array? — Non-blocking; resolved in spec as positional/schema-length.**
  Resolved to **positional merge onto a schema-length-governed array** (B134-R3), for strict
  parity with B53-R2 and D14 (every array path generates length from the schema bound or
  `defaultArrayLength`, then applies overrides positionally — the override never resizes). The
  card's "length driven by the override" is the reporter's intuition, but adopting it would
  make the array-field path the lone exception to D14 and require a separate length-from-override
  feature. The behaviour the bug is actually about — un-overridden siblings surviving a
  partial-object override — holds identically under positional merge. A consumer needing
  exactly-N elements pins `.length(N)`. Recorded; not blocking.

- **Q2: Does the fix generalize to arbitrarily-deep nested arrays, or only one level? —
  Non-blocking; resolved in spec as one level.**
  Resolved to **one level** (a single array field directly under the overridden object). The
  outer override slot maps positionally to that field's elements; deeper structure **inside**
  each element (an object element containing its own nested array) recurses naturally through
  the same per-field resolution, so ordinary object-in-array nesting is covered for free. An
  override whose entries are themselves raw arrays-of-arrays is out of scope (listed under Out
  of scope). Picking the smallest correct scope avoids speculative multi-level array-of-array
  merge semantics no repro motivates. Recorded; not blocking.

- **Q3: Remove the engine.ts:1870 whole-record `deepMerge`, or prove it redundant and leave
  it? — Non-blocking; resolved in spec as remove.**
  Resolved to **remove** (B134-R7), per the directive's "single override-application flow."
  Leaving the second pass would (a) violate the unification (overrides applied in two places),
  and (b) re-clobber the per-index array merge (it would replace the merged array wholesale,
  reintroducing the bug). The implementer removes it and proves via the green existing override
  suite (B12 / B18 / B53) that no behaviour depended on the second pass. If — contrary to
  analysis — some existing test breaks only because of the removal, that surfaces a genuine
  dependency the implementer reports back before forcing the change; the spec's expectation is
  that none exists (the per-field site produces the final value pre-store). Recorded; not
  blocking.

No blocking open questions remain; the spec can advance to `test-writer`. Net **0 blocking,
3 non-blocking**. (The item card carries `flags: [review]` — it touches the override contract
and establishes a standing constraint, so the manager pauses for spec sign-off before
test-writer; that checkpoint is a manager/user sign-off, not an answer-blocked bounce.)

## Notes

- **Anchor reading** — `src/pipeline.ts:289-301` (`overrideEagerStep` — Mechanism 1, the
  eager array/primitive short-circuit), `:177-180` (`applyObjectOverride` — the per-rung
  object-merge helper the single site subsumes), `:465-471` / `:525-531` (key-based and
  schema-based-leaf raw-replace branches the single site subsumes), `:518-523`
  (schema-based object recursion, threads `overrides` down); `src/world/engine.ts:1870`
  (Mechanism 2 — the whole-record `deepMerge` to remove), `:1384-1458`
  (`generateObjectFields` / `resolveField` — where `result[key] = resolution.value` is the
  per-field write that gives sibling-visibility, and where the single site is wired),
  `:1718-1726` (the array arm's per-index `deepMerge` — the reference semantics);
  `src/utils/merge.ts` (the unchanged `deepMerge` — array-as-leaf, B18).
- **Standing constraint** — B134 establishes a new rule (single per-field
  override-application site; rungs override-agnostic; no post-record whole-record override
  merge). A proposed ADR (**D34**) is appended to `wiki/decisions.md`; the **manager** promotes
  it to a one-line Rule in `architecture.md` at item close. Test-writer / implementer / reviewer
  do not edit `architecture.md` or `decisions.md`.
- **B12-R3 superseded** — per the maintainer's full-unification decision, B12-R3's
  wholesale-replace assertion for a matcher-backed array (matcher `["m1","m2","m3"]` + override
  `["alpha","beta"]` → `["alpha","beta"]`) is **superseded by B134** for the longer-matcher-base
  case: the unified no-resize per-index merge yields `["alpha","beta","m3"]` (the matcher tail
  survives). The superseding expectation is pinned by **B134-R6**; B12-R3 is annotated
  accordingly in [B12-nested-override-skips-matcher.md](B12-nested-override-skips-matcher.md).
- **Bump** — `patch` (correctness fix + internal unification; no public API surface change).
- **`flags: [review]`** — the item card carries this; all open questions are non-blocking, so
  the review checkpoint is a manager/user sign-off, not an answer-blocked bounce.
