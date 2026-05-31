# B23: Promote the per-field pipeline to a `PIPELINE` list of named steps

## Context

The 0-through-6 per-field pipeline is the engine's headline contract. It is
documented in [`docs/concepts.md`](../../docs/concepts.md) (steps 0-5, 6 rungs),
[`wiki/codebase-map.md`](../codebase-map.md), [`CLAUDE.md`](../../CLAUDE.md),
and the module-level JSDoc at [`src/world.ts:14-26`](../../src/world.ts#L14)
(steps 0-6, 7 rungs); the doc-numbering drift is tracked separately by
[B37](../backlog/inbox/B37-pipeline-numbering-drift.md) (blocked on this item).
Today the contract is **implemented three times**:

1. The canonical implementation — `WorldImpl.generateObjectFields` at
   [`src/world.ts:1201-1319`](../../src/world.ts#L1201) — a 118-LOC `for` body
   with `continue` between rungs (overrideEager → matcher → schemaKeyMap →
   unwrapOptional → customKeyGen → keyHeuristic → schemaBased).
2. A **read-only mirror** in [`src/explain.ts`](../../src/explain.ts) —
   `decideField` at [`src/explain.ts:161-230`](../../src/explain.ts#L161) plus
   `identifierForExactKey` / `patternHit` / `patternIdentifier` /
   `patternLabel`. ~150 LOC of re-implementation of the same ladder; the rung
   ordering and labelling already diverge from the code path (B22 audit
   §"Dimension 4 → Drift between code and documentation": `explain.ts` calls
   `withGenerators` "Rule 3" and places it before the exact-key map, while the
   code runs it after `unwrapOptional`).
3. A **partial duplicate without registration** in
   [`src/generators/schema/collection.ts`](../../src/generators/schema/collection.ts)
   — `generateZodObject` at
   [`collection.ts:193-231`](../../src/generators/schema/collection.ts#L193).
   Walks the per-field shape, runs `unwrapOptionalChainForField`, calls
   `generateFromKey` (the key-heuristic step), then falls through to
   `childCtx.generate(innerSchema)` (the schema-based step). Skips matchers,
   per-schema key map, customKeyGen, and any override handling because
   collection-level entry has no `SchemaReg` available — but the omissions
   produce a subtle behaviour split: a `z.object` nested inside another schema
   without registration silently bypasses four rungs of the contract.

Three implementations, guaranteed to drift. The B22 codebase-complexity audit
([`wiki/research/reports/codebase-complexity.md`](../research/reports/codebase-complexity.md))
ranks this as **the engine's headline architectural lever**:

- Dimension 1 #4 (`generateObjectFields` — 147 LOC, ~21 branches, nested `while`
  for unwrap with mutated state),
- Dimension 2 #4 (`explain.ts` re-implementation guaranteed to drift),
- Dimension 3 #2 (147 LOC + nested `while`, 5-deep max nesting),
- Dimension 4 ("The generation pipeline" + "The two generator axes (key-based
  vs schema-based)" + "Drift between code and documentation").

This item promotes the pipeline to **data** — a `PIPELINE` list of named
`PipelineStep` functions returning a `FieldResolution` tagged union — and
points all three call sites at it. The pipeline order is byte-identical to
today's code path; PRNG fork keys, `applyModifiers` calls, deep-merge points,
and absent-roll semantics are preserved exactly. The cleanup benefits:

- `explain.ts`'s ~150 LOC of mirrored decision logic collapses to a `dryRun`
  walk of the same `PIPELINE`. The `kind` literal on `FieldResolution` doubles
  as the rendered `generator` identifier (`matcher:<key>`, `key-map:<key>`,
  `custom:<key>`, etc.), so the same enum drives both code paths.
- `generateZodObject` walks a `PIPELINE_NO_REGISTRATION` subset (unwrapOptional
  → keyHeuristic → schemaBased), making explicit which rungs the nested-object
  path intentionally omits and giving B22's "two generator axes" convergence
  recommendation a literal source of truth.
- `console.log(PIPELINE.map((s) => s.name))` becomes the canonical answer to
  "what does the pipeline look like?", replacing the prose ladder in five
  docs.

Item card:
[`wiki/backlog/doing/B23-promote-per-field-pipeline-to-list.md`](../backlog/doing/B23-promote-per-field-pipeline-to-list.md).
Pre-flagged `review` so the user can approve the `PipelineStep` signature,
the `FieldResolution` shape, the B12 deep-merge handling pattern, and the
`PIPELINE_NO_REGISTRATION` subset before tests/impl. Closes nothing
externally; unblocks [B37](../backlog/inbox/B37-pipeline-numbering-drift.md)
(pipeline-numbering doc reconciliation).

### Pipeline / Rules compliance

- **D1 — no `any`**. The `FieldResolution` discriminated union and
  `PipelineStep` signature are fully typed; step return values carry `unknown`
  rather than `any`. The existing `(options as any)?.source` cast in
  `generateSingleItem` is unrelated and untouched.
- **D3 — Zod v4 internals via `_zod.def`**. Unchanged; the `unwrapOptional`
  step delegates to the existing `unwrapOptionalChainForField` helper in
  `zod-def.ts`, which is the only file allowed to touch `_zod.def`.
- **D4 / D10 — per-schema identity-based fork keys + byte-identical PRNG order**.
  Each step receives `fieldPrng = recordPrng.fork(key)` via the
  `PipelineStepContext`, identical to today's
  [`world.ts:1227`](../../src/world.ts#L1227). The `unwrapOptional` step
  consumes the same number of `prng.random()` rolls per wrapper layer as
  today's call (preserved by `unwrapOptionalChainForField`'s existing
  contract). No step introduces a new fork key, no step changes the fork-key
  literal shape, no step reorders existing rolls. Byte-equivalence with the
  pre-B23 PRNG draw sequence is the binding invariant (R7).
- **D5 — no public API change**. `PIPELINE`, `PipelineStep`,
  `FieldResolution`, `PipelineStepContext`, and `PIPELINE_NO_REGISTRATION` are
  internal types and constants. `docs/api-reference.md` is not touched. (D5
  is not triggered.)
- **D6 — regression test for bug fix**. B23 is a `chore` / refactor, not a
  bug fix; D6 does not apply. Byte-equivalence with the full pre-B23 suite
  is the regression guard.
- **D8 — stored equals returned**. The pipeline output composes into a
  record that flows through `generateAndStorePrimary` /
  `generateDerivedRecord` exactly as today; D8 is unaffected.
- **D9 — cache short-circuits PRNG- and counter-neutral**. The B8
  `derivedUpsert` cache short-circuit lives in `generateSingleItem`, not in
  the per-field pipeline. B23 does not touch it; D9 holds unchanged.
- **D10 — generation determinism per-(seed + schema identity + per-schema
  call index)**. The three counter-bearing call sites
  (`generateAdHoc`/`generateArray`/outer-wrap roll) are outside the per-field
  pipeline. B23 does not touch them; D10 holds unchanged.

### How B23 composes with adjacent items

- **B24** (`generateSingleItem` decomposition) landed already; B23 leaves the
  four extracted methods (`generateWithSourceOverride`,
  `generateDerivedAutoSource`, `generatePrimary`, `generateAdHoc`) untouched
  — they call into `generateObjectFields` exactly as today, and
  `generateObjectFields` continues to be the entry point that drives the
  `PIPELINE` walk.
- **B25** (`resolveMode` extraction) is unrelated; lives in `generateSingleItem`
  / `generateArray` / `populate`. B23 does not touch it.
- **B28** (split `world.ts` into multiple files) is later work. B23's
  `PIPELINE` list, `PipelineStep` type, and the step function bodies stay
  inside `world.ts` for now — the implementer MAY co-locate them in a new
  private namespace (e.g. a `private static` field or a module-private
  `const`), but no new file is added. B28 will split them out later.
- **B37** (pipeline-numbering doc reconciliation) is blocked on B23. The
  rung names B23 pins (`overrideEagerStep`, `matcherStep`,
  `schemaKeyMapStep`, `unwrapOptionalStep`, `customKeyGenStep`,
  `keyHeuristicStep`, `schemaBasedStep`) become the doc reconciliation's
  source of truth. B23 does not proactively renumber `docs/concepts.md` /
  `CLAUDE.md` / `world.ts` JSDoc — that is B37's job and is folded into
  this commit **only** if the new step names suggest a different numbering
  (they do not; the rung ordering is preserved 1:1).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as
> defined in RFC 2119 — they mark genuine requirements, not emphasis.

## Decision

### The `FieldResolution` discriminated union

A `FieldResolution` is a tagged value returned by a pipeline step. The first
non-`null` `FieldResolution` produced by the pipeline wins; subsequent steps
are skipped.

```ts
type FieldResolution =
  | { kind: "override"; value: unknown } // step 0: eager primitive/array override
  | { kind: "matcher"; value: unknown } // step 1: matcher hit
  | { kind: "keymap"; value: unknown } // step 2: per-schema key map hit
  | { kind: "absent"; value: undefined | null } // step 3: optional/nullable rolled absent (skip → undefined)
  | { kind: "default"; value: unknown } // step 3: .default() captured (or nullable → null fallback)
  | { kind: "custom-gen"; value: unknown } // step 4: world-level customKeyGenerators hit
  | { kind: "key-based"; value: unknown } // step 5: DEFAULT_KEY_MAP / DEFAULT_KEY_PATTERNS heuristic
  | { kind: "schema-based"; value: unknown }; // step 6: schema-based generation (router.ts)
```

A step returns `null` when it does not apply (so the dispatcher falls through
to the next step). It returns a `FieldResolution` when it has a value to
assign to `result[key]`.

**Rationale for the kind set:**

- The seven non-`null` shapes map 1:1 onto the seven rungs `generateObjectFields`
  implements today. The first three (`override` / `matcher` / `keymap`) and
  the last three (`custom-gen` / `key-based` / `schema-based`) carry
  arbitrary `unknown` values. The absent-rolled shapes split into `absent`
  (typed `undefined | null` to reflect skip vs nullable-fallback) and
  `default` (typed `unknown` because `.default()` carries an arbitrary
  user-supplied value).
- The `kind` literal doubles as the `explain.ts` rendered identifier prefix:
  `matcher:<key>`, `key-map:<key>`, `custom:<lk>`, `schema-based`, and so on.
  Today `explain.ts` constructs these strings independently; under B23 the
  `kind` field is the literal source.
- Why a separate `absent` / `default` split rather than a unified
  `{ kind: "unwrap"; absent: { kind: "skip" | "default"; value } | null }`:
  the union form is flatter and matches the existing
  `UnwrappedAbsent` shape returned by `unwrapOptionalChainForField`
  ([`src/generators/schema/zod-def.ts:141`](../../src/generators/schema/zod-def.ts#L141)),
  which already returns `{ inner, absent: { kind: "skip" | "default", value } | null }`.
  The pipeline step adapts that shape into the `FieldResolution` union; both
  forms encode the same information.

### The `PipelineStepContext` and `PipelineStep` signatures

```ts
interface PipelineStepContext {
  /** The field's Zod schema (pre-unwrap-optional). */
  readonly fieldSchema: ZodTypeAny;

  /**
   * The "inner" schema post-unwrap-optional. Steps 0-3 see `inner === undefined`;
   * step 3 (unwrapOptional) populates this field on the next-step context for
   * steps 4-6 (customKeyGen / keyHeuristic / schemaBased). The dispatcher
   * threads the post-unwrap inner schema into steps 4-6 via a context
   * refresh; see "Dispatcher contract" below.
   */
  readonly inner?: ZodTypeAny;

  /** The field name (the property key on the Zod object's shape). */
  readonly fieldName: string;

  /**
   * The `GeneratorContext` built by `makeFieldCtx` for this field — carries
   * `prng = fieldPrng`, `gen`, `source`, `registry`, `fieldPath`, `current`,
   * `locale`, etc. Steps 1 / 2 / 4 / 6 invoke generator functions through
   * this; step 3 reads `fieldCtx.prng` for the absent roll.
   */
  readonly fieldCtx: GeneratorContext;

  /**
   * The pre-extracted override slice for this field — `overrides?.[key]` from
   * the caller's `options.overrides`. Step 0 consumes it eagerly when
   * primitive/array; steps 1 / 2 / 4 / 5 deep-merge it on top of their hit
   * (only when it is a plain object — primitive/array overrides were already
   * eaten by step 0); step 3 suppresses the absent branch when `fieldOverride
   * !== undefined`; step 6's object-typed schema-based recursion threads it
   * into `fieldCtx.generate(innerSchema, { overrides: fieldOverride })`
   * exactly as today's [world.ts:1311](../../src/world.ts#L1311).
   */
  readonly fieldOverride: unknown;

  /**
   * The `SchemaReg` for the outer (registered) schema. Steps 1 / 2 / 4 read
   * `reg.matchers`, `schemaKeyMaps`, `customKeyGenerators` via it. Always
   * present (the dispatcher passes `EMPTY_REG` for unregistered / ad-hoc
   * paths, identical to today's `generateAdHoc` →
   * `generateObjectFields(targetSchema, EMPTY_REG, ...)` call).
   */
  readonly reg: SchemaReg;

  /**
   * The outer object schema reference and its lazy-resolved inner — used by
   * step 2 (per-schema key map) for the two-level lookup at today's
   * [world.ts:1265](../../src/world.ts#L1265):
   * `schemaKeyMaps.get(schema)?.[key] ?? schemaKeyMaps.get(current)?.[key]`.
   */
  readonly outerSchema: ZodTypeAny;
  readonly resolvedSchema: ZodTypeAny;

  /** B23 cleanup: step accessors for the world's tables. */
  readonly customKeyGenerators: ReadonlyMap<string, KeyGenerator>;
  readonly schemaKeyMaps: ReadonlyMap<
    ZodTypeAny,
    Record<string, (ctx: GeneratorContext) => unknown>
  >;

  /**
   * Read-only dry-run flag. When `true`, steps MUST NOT execute side-effects
   * (no PRNG draws, no `applyModifiers`, no generator invocations). Steps
   * report **the resolution they would produce** as a `FieldResolution`
   * with `value: undefined` (the discriminator is what matters); the
   * `explainSchema` walk consumes the `kind` field and discards `value`.
   * `dryRun: false` runs the normal pipeline with side effects (the world's
   * `generateObjectFields` walk). Default: `false`. The step author MUST
   * read this flag before any PRNG / generator side effect; failure to
   * gate is a regression on B16-R8 (`explain` PRNG-neutral).
   */
  readonly dryRun: boolean;
}

type PipelineStep = (ctx: PipelineStepContext) => FieldResolution | null;
```

**Rationale for the struct-arg signature** (over a positional multi-arg form):

- Forward compatible — adding a new field (e.g. a `recursionDepth` for a
  future lazy-resolve step, or a per-step `index` for explain-mode rendering)
  does not break callers.
- Steps that ignore the bulk of the context (e.g. `overrideEagerStep` reads
  only `fieldOverride`; `schemaBasedStep` reads only `inner` + `fieldCtx` +
  `fieldOverride`) destructure what they need; the unused fields are free.
- TypeScript inferences are crisper: a step's body destructures a typed
  struct, not a positional tuple where the type-of-arg-4 question requires
  scrolling back to the call site.

**The dispatcher does not pass `fieldPrng` separately** — it lives at
`fieldCtx.prng` (which is the canonical home in `makeFieldCtx`). The
`unwrapOptionalStep` reads `ctx.fieldCtx.prng` for the absent roll, the same
way today's call at [`world.ts:1280`](../../src/world.ts#L1280) reads
`fieldCtx.prng`.

**`PipelineStepContext.inner` is `undefined` for steps 0-3 and populated for
steps 4-6** — the dispatcher refreshes the context after step 3 returns
`{ kind: "absent" } | { kind: "default" } | null`. When step 3 returns
`null`, the dispatcher carries the unwrapped inner schema forward into the
context for steps 4-6.

### The `PIPELINE` list

```ts
const PIPELINE: ReadonlyArray<PipelineStep> = [
  overrideEagerStep, // step 0
  matcherStep, // step 1
  schemaKeyMapStep, // step 2
  unwrapOptionalStep, // step 3
  customKeyGenStep, // step 4
  keyHeuristicStep, // step 5
  schemaBasedStep, // step 6
];

const PIPELINE_NO_REGISTRATION: ReadonlyArray<PipelineStep> = [
  unwrapOptionalStep, // step 3
  keyHeuristicStep, // step 5
  schemaBasedStep, // step 6
];
```

The ordering is byte-identical to today's
[`world.ts:1226-1316`](../../src/world.ts#L1226) implementation. The
`PIPELINE_NO_REGISTRATION` subset excludes the four registration-dependent
rungs (matcher, schemaKeyMap, customKeyGen, override) for use by
`generateZodObject` ([`collection.ts:193`](../../src/generators/schema/collection.ts#L193))
— which today executes only the unwrapOptional → keyHeuristic → schemaBased
fall-through pattern. Listing those three steps in `PIPELINE_NO_REGISTRATION`
makes the omission explicit in code rather than implicit by absence.

(The "step 0 — overrideEager" rung sits outside `PIPELINE_NO_REGISTRATION`
because nested `generateZodObject` calls do not receive a top-level
`options.overrides` — the parent-level pipeline already threaded any
relevant override slice into `fieldCtx.generate(innerSchema, { overrides:
fieldOverride })` at step 6, which becomes the recursive entry into the
nested object's full `PIPELINE` walk via `generateObjectFields`. The
`PIPELINE_NO_REGISTRATION` walk in `generateZodObject` is reached only for
truly-unregistered nested objects with no override slice.)

### Per-step bodies (preserved contracts)

Each step's body mirrors the corresponding block in today's
`generateObjectFields`. Pinned shape (illustrative; the implementer writes
the actual code):

```ts
// Step 0 — overrideEagerStep (today: world.ts:1242-1251)
const overrideEagerStep: PipelineStep = (ctx) => {
  const o = ctx.fieldOverride;
  if (o === undefined) return null;
  if (typeof o !== "object" || o === null || Array.isArray(o)) {
    return { kind: "override", value: o };
  }
  return null; // plain-object override defers to the deep-merge wrappers in later steps
};

// Step 1 — matcherStep (today: world.ts:1253-1261)
const matcherStep: PipelineStep = (ctx) => {
  const m = ctx.reg.matchers[ctx.fieldName];
  if (!m) return null;
  if (ctx.dryRun) return { kind: "matcher", value: undefined };
  const matched = m(ctx.fieldCtx);
  return {
    kind: "matcher",
    value: applyObjectOverride(matched, ctx.fieldOverride),
  };
};

// Step 2 — schemaKeyMapStep (today: world.ts:1263-1270)
const schemaKeyMapStep: PipelineStep = (ctx) => {
  const fn =
    ctx.schemaKeyMaps.get(ctx.outerSchema)?.[ctx.fieldName] ??
    ctx.schemaKeyMaps.get(ctx.resolvedSchema)?.[ctx.fieldName];
  if (fn === undefined) return null;
  if (ctx.dryRun) return { kind: "keymap", value: undefined };
  const mapped = fn(ctx.fieldCtx);
  return {
    kind: "keymap",
    value: applyObjectOverride(mapped, ctx.fieldOverride),
  };
};

// Step 3 — unwrapOptionalStep (today: world.ts:1272-1287)
const unwrapOptionalStep: PipelineStep = (ctx) => {
  // ... calls unwrapOptionalChainForField(fieldSchema, prng, optProb, allowAbsent)
  // returns { kind: "absent", value: undefined } | { kind: "default", value }
  // | null (when not absent). When returning null, the dispatcher caches the
  // returned `inner` schema and threads it into the next step's context.
};

// Step 4 — customKeyGenStep (today: world.ts:1289-1295)
// Step 5 — keyHeuristicStep (today: world.ts:1297-1303)
// Step 6 — schemaBasedStep (today: world.ts:1305-1315)
```

The full pinned bodies are deferred to the implementer; the spec pins the
**observable contract** (R3-R6) rather than the exact line shapes.

### B12 deep-merge handling

Today's [`world.ts:1259`](../../src/world.ts#L1259) (matcher) /
[`world.ts:1268`](../../src/world.ts#L1268) (keymap) /
[`world.ts:1293`](../../src/world.ts#L1293) (customGen) /
[`world.ts:1300-1301`](../../src/world.ts#L1300) (key-based) /
[`world.ts:1311-1314`](../../src/world.ts#L1311) (schema-based) lines
apply a plain-object `fieldOverride` ON TOP of the step's result via
`deepMerge(matched, fieldOverride)`. This is the [B12](B12-nested-override-skips-matcher.md)
fix — primitive/array overrides were already consumed by step 0; plain-object
overrides fall through to here and merge on the matcher/keymap/customGen/etc.
result.

**Decision — adopt pattern (B)**: the step's own body applies the deep-merge
using a tiny shared helper.

```ts
function applyObjectOverride(value: unknown, fieldOverride: unknown): unknown {
  if (fieldOverride === undefined) return value;
  // Primitive/array overrides were already consumed by step 0 — if they
  // reach a later step, B12's intent is to defer to step 0 (which already
  // ran). Reaching here means fieldOverride is plain-object (or step 0
  // returned null because the override was object-typed). deepMerge is
  // B18-safe (atomic objects guarded).
  return deepMerge(value, fieldOverride);
}
```

Steps 1 / 2 / 4 wrap their generator-invocation result in
`applyObjectOverride(result, ctx.fieldOverride)`. Step 5 (key-based) preserves
today's slightly different shape — when `fieldOverride !== undefined` the
override **replaces** the key-based value entirely (today's
`fieldOverride !== undefined ? fieldOverride : applyModifiers(keyResult,
innerSchema)` at [`world.ts:1300-1301`](../../src/world.ts#L1300)) — and the
step body MUST preserve that exact branching. Step 6 (schema-based) preserves
today's object-vs-non-object split: for `isObjectLike` it threads the
override slice into the recursive `fieldCtx.generate(innerSchema, { overrides:
fieldOverride })` call; for non-object schemas it does the same `fieldOverride
!== undefined ? fieldOverride : generateFromSchema(innerSchema, fieldCtx)`
replacement as today.

**Rejected alternative — pattern (A)**: a `mergeOverride: (result: unknown) =>
unknown` callable wrapper passed via the context. This was considered but
rejected: the wrapper would be a closure over `ctx.fieldOverride`, and steps
that need to consult `fieldOverride` for branching (step 0 reads it directly;
step 3 reads `fieldOverride === undefined` to decide `allowAbsent`; step 5
replaces rather than merges; step 6 threads it into a recursive call) cannot
express that through a generic merge wrapper. The wrapper would cover only
steps 1 / 2 / 4, and adding a context field that some steps use and others
read raw is more confusing than each step owning the call to a shared
`applyObjectOverride` helper.

**Rejected alternative — pattern (C)**: the dispatcher applies the deep-merge
after the step returns, based on the `kind`. This was considered but
rejected: the dispatcher would need to encode the per-step merge policy (step
5 replaces; step 6 threads-into-recursion; steps 1 / 2 / 4 merge; steps 0 / 3
do not have a fieldOverride to apply), turning the dispatcher into a switch
on `kind` — which is precisely what the step abstraction is supposed to
abolish. Keeping the merge logic local to each step body is cleaner.

### Dispatcher contract

```ts
function walkPipeline(
  pipeline: ReadonlyArray<PipelineStep>,
  ctx: PipelineStepContext,
): FieldResolution {
  let workingCtx = ctx;
  for (const step of pipeline) {
    const r = step(workingCtx);
    if (r !== null) {
      // Step 3 sets `inner` for the next step's context; the dispatcher
      // refreshes here so steps 4-6 see the unwrapped schema. When step 3
      // returns null (not absent), the dispatcher reads the unwrapped inner
      // off the step's side channel (see Open questions: "inner-schema
      // threading from step 3").
      // ...
    }
  }
  // Default — schema-based step always returns a resolution; the dispatcher
  // never falls off the end. (B23-R6: schemaBasedStep MUST always return
  // a non-null FieldResolution.)
  throw new Error("pipeline did not resolve field — schema-based step regression");
}
```

`generateObjectFields` becomes:

```ts
for (const [key, fieldSchema] of Object.entries(shape)) {
  const fieldPrng = recordPrng.fork(key);                  // unchanged
  const fieldPath = ...;                                    // unchanged
  const fieldCtx = this.makeFieldCtx(reg, source, recordPrng,
    fieldPrng, fieldPath, recordId, result);                // unchanged
  const stepCtx: PipelineStepContext = {
    fieldSchema: fieldSchema as ZodTypeAny,
    fieldName: key,
    fieldCtx,
    fieldOverride: overrides?.[key],
    reg,
    outerSchema: schema,
    resolvedSchema: current,
    customKeyGenerators: this.customKeyGenerators,
    schemaKeyMaps: this.schemaKeyMaps,
    dryRun: false,
  };
  const r = walkPipeline(PIPELINE, stepCtx);
  result[key] = r.value;
}
```

### `explain.ts` benefits — pinned cleanup contract

`explainSchema` ([`src/explain.ts:236`](../../src/explain.ts#L236)) walks the
**same** `PIPELINE` list with `dryRun: true`. Each step that would fire
returns a `FieldResolution` with `kind` set and `value: undefined`; the
explain code maps the `kind` to the rendered `generator` string. The bulk of
`explain.ts`'s helpers — `decideField`, `identifierForExactKey`, `patternHit`,
`patternIdentifier`, `patternLabel` — fold into the relevant pipeline step
bodies:

- The exact-key lookup (`identifierForExactKey`) lives in
  `keyHeuristicStep`'s dry-run branch.
- The pattern-match (`patternHit` / `patternIdentifier` / `patternLabel`)
  lives in `keyHeuristicStep`'s dry-run branch, sharing the
  `DEFAULT_KEY_PATTERNS` traversal with `generateFromKey`.
- The matcher / keymap / custom-gen / schema-based-object detection
  collapses into the dry-run branches of the corresponding step bodies.

**The `explainSchema` public output (`ExplainResult` type) MUST be unchanged
byte-identically.** Every existing string emitted by today's `decideField`
(`matcher:<key>`, `key-map:<key>`, `custom:<lk>`, `string.uuid`,
`person.fullName`, `internet.url`, `internet.email`,
`date.anytime+toISOString`, `date.anytime`, `date.anytime+getTime`,
`pattern:<leafType>:<index>:<lowerKey>` for new patterns, `inline:<key>` for
inline closures, `schema-based:object`, `schema-based:array`, `schema-based`)
MUST be reproduced exactly by the `PIPELINE` walk. The `reason` strings
emitted by `decideField` ("matcher registered via withSchema", "per-schema
key map registered via withKeyMap", "custom generator registered via
withGenerators", `exact key: "<lk>"`, `key-pattern: <label>`, etc.) MUST
also be reproduced exactly. The B16 acceptance criteria
([`wiki/specs/B16-surface-key-match-list.md`](B16-surface-key-match-list.md))
are preserved.

`explain.ts`'s `FN_TO_ID` reverse-lookup map, the `formatExplainResult`
toString formatter, and the public `explainSchema` entry point remain — the
**file shrinks** by collapsing the per-rung decision logic into the pipeline
steps' dry-run branches.

### `collection.ts:generateZodObject` benefits

`generateZodObject` ([`collection.ts:193`](../../src/generators/schema/collection.ts#L193))
walks `PIPELINE_NO_REGISTRATION` with a context where `reg = EMPTY_REG`,
`fieldOverride = undefined`, `customKeyGenerators = new Map()`,
`schemaKeyMaps = new Map()`, and `dryRun = false`. The three rungs that
remain (unwrapOptional, keyHeuristic, schemaBased) are exactly the work
`generateZodObject` does today; the four omitted rungs (override, matcher,
schemaKeyMap, customKeyGen) become **explicit omissions** rather than
silent absences.

The implementer MAY thread `PIPELINE_NO_REGISTRATION` into
`generateZodObject` via an import barrel (`from "../../world.js"` or a
private re-export); the spec leaves the wire-up path open as long as
`generateZodObject` calls the same step functions as `generateObjectFields`.
Duplicating the bodies is forbidden — that would re-introduce the drift
B23 is eliminating.

## Requirements

### B23-R1: `FieldResolution` discriminated union

`src/world.ts` (or a co-located internal module imported by both
`world.ts` and `explain.ts` / `collection.ts`) MUST export a `FieldResolution`
type matching the union pinned above. The type MUST carry exactly eight
non-`null` variants (`override`, `matcher`, `keymap`, `absent`, `default`,
`custom-gen`, `key-based`, `schema-based`); a step's return value is
`FieldResolution | null`. No variant MUST use the `any` type for its `value`
field (D1).

- Scenario: `FieldResolution` exported with eight variants
  GIVEN B23 implemented
  WHEN `src/world.ts` (or the co-located module it imports `FieldResolution`
  from) is read
  THEN the `FieldResolution` type declaration lists exactly eight `kind`
  literals (`"override"`, `"matcher"`, `"keymap"`, `"absent"`, `"default"`,
  `"custom-gen"`, `"key-based"`, `"schema-based"`); each variant declares a
  `value` field; the `absent` variant's `value` is typed `undefined | null`;
  the other seven `value` fields are typed `unknown` (not `any`).

### B23-R2: `PipelineStep` and `PipelineStepContext` signatures

The codebase MUST define a `PipelineStep` type with the exact signature
`(ctx: PipelineStepContext) => FieldResolution | null`, and a
`PipelineStepContext` interface carrying the fields pinned above (at minimum:
`fieldSchema`, `fieldName`, `fieldCtx`, `fieldOverride`, `reg`,
`outerSchema`, `resolvedSchema`, `customKeyGenerators`, `schemaKeyMaps`,
`dryRun`; plus `inner?` for steps 4-6 produced by the dispatcher's
post-step-3 context refresh). The implementer MAY add additional readonly
fields for future use, but MUST NOT remove or rename any field listed above
without re-running this spec. Every field MUST be `readonly`; D1 (no `any`)
applies.

- Scenario: `PipelineStep` type matches the pinned signature
  GIVEN B23 implemented
  WHEN the `PipelineStep` type declaration is inspected
  THEN it equals `(ctx: PipelineStepContext) => FieldResolution | null`; the
  `PipelineStepContext` interface declares every field in the pinned list as
  `readonly`; the interface contains no `any` types.

- Scenario: a custom step compiles against the pinned signature
  GIVEN B23 implemented
  WHEN a test file declares `const sampleStep: PipelineStep = (ctx) => null;`
  and `const otherStep: PipelineStep = (ctx) => ({ kind: "key-based", value:
ctx.fieldOverride });`
  THEN `pnpm typecheck` passes; both declarations compile.

### B23-R3: `PIPELINE` list — exact seven named step functions in order

The codebase MUST export a `PIPELINE: ReadonlyArray<PipelineStep>` containing
exactly seven entries, in this order: `overrideEagerStep`, `matcherStep`,
`schemaKeyMapStep`, `unwrapOptionalStep`, `customKeyGenStep`,
`keyHeuristicStep`, `schemaBasedStep`. Each entry MUST be a named function
(named export OR a `function NAME(ctx) { ... }` declaration, not an
anonymous arrow). `console.log(PIPELINE.map((s) => s.name))` MUST print
`["overrideEagerStep","matcherStep","schemaKeyMapStep","unwrapOptionalStep","customKeyGenStep","keyHeuristicStep","schemaBasedStep"]`
in that order.

- Scenario: `PIPELINE` declared with seven named steps in order
  GIVEN B23 implemented
  WHEN a test reads `PIPELINE.map((s) => s.name).join(",")`
  THEN the result equals
  `"overrideEagerStep,matcherStep,schemaKeyMapStep,unwrapOptionalStep,customKeyGenStep,keyHeuristicStep,schemaBasedStep"`
  exactly.

### B23-R4: `PIPELINE_NO_REGISTRATION` subset — exact three steps in order

The codebase MUST export a `PIPELINE_NO_REGISTRATION: ReadonlyArray<PipelineStep>`
containing exactly `unwrapOptionalStep`, `keyHeuristicStep`,
`schemaBasedStep`, in that order. Both `PIPELINE` and
`PIPELINE_NO_REGISTRATION` MUST reference the **same** step function
instances (no duplicate function bodies). `collection.ts:generateZodObject`
MUST walk `PIPELINE_NO_REGISTRATION` rather than its current open-coded
unwrap-then-keyHeuristic-then-schemaBased pattern. The matcher,
schemaKeyMap, customKeyGen, and override-eager rungs MUST be **explicitly
absent** from `PIPELINE_NO_REGISTRATION`; reaching a nested-`z.object`
without a `SchemaReg` MUST execute only the three subset rungs.

- Scenario: subset references the same function instances as `PIPELINE`
  GIVEN B23 implemented
  WHEN a test reads `PIPELINE_NO_REGISTRATION[0] === PIPELINE[3]` (unwrap),
  `PIPELINE_NO_REGISTRATION[1] === PIPELINE[5]` (key-based), and
  `PIPELINE_NO_REGISTRATION[2] === PIPELINE[6]` (schema-based)
  THEN all three equalities are `true`.

- Scenario: `generateZodObject` resolves a nested unregistered object via the subset
  GIVEN a world with no registration, and a top-level schema `Outer =
z.object({ inner: z.object({ first: z.string(), createdAt: z.string() }) })`
  WHEN `world.generate(Outer)` is called
  THEN the resulting `inner.first` is a non-empty string (schema-based step
  fired); `inner.createdAt` is an ISO-formatted date string (key-heuristic
  step fired); the value is byte-equivalent to the pre-B23 output for the
  same seed (regression on the subset behaviour).

### B23-R5: PRNG fork keys MUST be byte-identical to pre-B23 code path

The PRNG draw sequence produced by `generateObjectFields` walking `PIPELINE`
for any field MUST be byte-identical to the pre-B23 walk. Specifically:

- The dispatcher MUST fork `fieldPrng = recordPrng.fork(fieldName)` exactly
  once per field, at the same site as today's
  [`world.ts:1227`](../../src/world.ts#L1227). No step MUST refork from
  `recordPrng` for its own use.
- `unwrapOptionalStep` MUST call `unwrapOptionalChainForField(fieldSchema,
fieldCtx.prng, optProb, fieldOverride === undefined)` with the same
  arguments and call order as today's
  [`world.ts:1278-1283`](../../src/world.ts#L1278), consuming the same number
  of `prng.random()` rolls per wrapper layer (the existing
  `unwrapOptionalChainForField` contract preserves this).
- `keyHeuristicStep` MUST call `generateFromKey(fieldName, innerSchema,
fieldCtx)` with the same arguments as today's
  [`world.ts:1298`](../../src/world.ts#L1298); the post-call `applyModifiers`
  is preserved verbatim.
- `schemaBasedStep` MUST preserve today's object-vs-non-object dispatch
  shape at [`world.ts:1306-1315`](../../src/world.ts#L1306): for `isObjectLike`,
  recurse via `fieldCtx.generate(innerSchema, { overrides: fieldOverride })`;
  for non-object, call `generateFromSchema(innerSchema, fieldCtx)` (gated by
  the `fieldOverride !== undefined` replacement).
- No new fork key is introduced anywhere in the pipeline. No existing fork
  key changes its literal shape (`fork(fieldName)` stays `fork(fieldName)`).

D4 / D10 byte-equivalence is the binding invariant — the full pre-B23
test suite MUST stay green without changing any seeded snapshot assertion.

- Scenario: every existing seeded test stays green
  GIVEN B23 implemented end-to-end
  WHEN `pnpm test` is run
  THEN it exits 0; every test that asserts on specific seeded values
  (notably under `tests/unit/core/`, `tests/unit/generators/`, and
  `tests/integration/`) passes without any assertion update; no test file
  is modified by the B23 commit beyond adding new B23-specific tests (R3,
  R4, R6, R9).

- Scenario: byte-equivalence for a representative schema
  GIVEN `Sample = z.object({ name: z.string(), email: z.string(),
createdAt: z.string(), nested: z.object({ inner: z.number().int() }) })`
  and `world = createWorld({ seed: 42 })`
  WHEN `const r = world.generate(Sample);`
  THEN `JSON.stringify(r)` equals the pre-B23 seed-42 snapshot exactly
  (the spec defers the literal snapshot to the test-writer; the contract is
  that the snapshot taken on the pre-B23 commit and the post-B23 commit are
  identical).

### B23-R6: B12 deep-merge contract preserved — `applyObjectOverride` helper

The B12 contract (a plain-object `fieldOverride` deep-merges on top of a
step's matcher / keymap / customGen / etc. result) MUST be preserved
byte-identically. Each step MUST apply the deep-merge via a shared
`applyObjectOverride(value, fieldOverride)` helper that:

- returns `value` unchanged when `fieldOverride === undefined`;
- returns `deepMerge(value, fieldOverride)` otherwise.

The helper MUST be applied by:

- `matcherStep` — to its `matcher(fieldCtx)` return value;
- `schemaKeyMapStep` — to its `keyMapFn(fieldCtx)` return value;
- `customKeyGenStep` — to its post-`applyModifiers(customGen(...))` value.

`keyHeuristicStep` and `schemaBasedStep` (non-object branch) MUST preserve
today's **replacement** semantics (`fieldOverride !== undefined ?
fieldOverride : <generated>`), NOT a deep-merge. `schemaBasedStep`'s
object branch MUST thread `fieldOverride` into the recursive
`fieldCtx.generate(innerSchema, { overrides: fieldOverride })` call exactly
as today's [`world.ts:1311`](../../src/world.ts#L1311). `overrideEagerStep`
MUST short-circuit primitive/array overrides; plain-object overrides MUST
fall through to later steps' merge.

- Scenario: object override deep-merges on a matcher hit (B12 regression)
  GIVEN `Schema = z.object({ author: z.object({ id: z.string(), name:
z.string() }) })` registered with a matcher
  `matchers: { author: () => ({ id: "matcher-id", name: "matcher-name" }) }`
  WHEN `world.generate(Schema, { overrides: { author: { name: "OVERRIDE" } } })`
  is called
  THEN the returned record has `author.id === "matcher-id"` (the matcher's
  value survived) and `author.name === "OVERRIDE"` (the override
  deep-merged on top). Identical to the current B12 test.

- Scenario: primitive override short-circuits at step 0
  GIVEN `Schema = z.object({ name: z.string() })` registered with a matcher
  `matchers: { name: () => "MATCHER-VALUE" }`
  WHEN `world.generate(Schema, { overrides: { name: "OVERRIDE" } })` is
  called
  THEN the returned record has `name === "OVERRIDE"` (step 0 consumed the
  primitive override; the matcher did not run).

- Scenario: array override short-circuits at step 0
  GIVEN `Schema = z.object({ tags: z.array(z.string()) })` registered with a
  matcher `matchers: { tags: () => ["a", "b"] }`
  WHEN `world.generate(Schema, { overrides: { tags: ["x", "y"] } })` is
  called
  THEN the returned record has `tags` deep-equal to `["x", "y"]` (step 0
  consumed the array override; the matcher did not run); this is the
  current B12 / B18 behaviour preserved.

### B23-R7: `explainSchema` output byte-identical, `explain.ts` shrinks

`explain.ts`'s `explainSchema` public output (`ExplainResult`) MUST be
**byte-identical** to the pre-B23 output. Every existing
`FieldExplanation.generator` string (e.g. `matcher:<key>`, `key-map:<key>`,
`custom:<lk>`, `string.uuid`, `person.fullName`, `internet.url`,
`internet.email`, `date.anytime+toISOString`, `date.anytime`,
`date.anytime+getTime`, `inline:<key>`, `schema-based:object`,
`schema-based:array`, `schema-based`) MUST be emitted by the
`dryRun: true` walk of `PIPELINE`. Every existing `FieldExplanation.reason`
string ("matcher registered via withSchema", "per-schema key map registered
via withKeyMap", "custom generator registered via withGenerators",
`exact key: "<lk>"`, `key-pattern: <label>`, etc.) MUST also be reproduced
exactly. The `toString()` formatter (`formatExplainResult` at
[`explain.ts:284`](../../src/explain.ts#L284)) MUST stay (its output is
unaffected — same `generator` + `reason` flowing into the same formatter).

`explain.ts`'s `decideField` MUST be **removed**; its body folds into the
relevant pipeline steps' `dryRun: true` branches. The
`identifierForExactKey`, `patternHit`, `patternIdentifier`, and
`patternLabel` helpers MUST move into (or be called from) the
`keyHeuristicStep`'s dry-run branch, NOT duplicated in `explain.ts`. The
`FN_TO_ID` reverse-lookup constant MAY stay in `explain.ts` (it is only
used by the dry-run path of `keyHeuristicStep`); the implementer chooses
the location as long as no duplication exists.

`explain.ts` MUST shrink by at least 100 LOC (today's 315 LOC →
post-B23 ≤ 215 LOC). The exact final size is the implementer's call; the
contract is that the per-rung decision logic no longer lives in `explain.ts`.

- Scenario: every `explainSchema` output stays byte-identical
  GIVEN B23 implemented and the existing B16 test suite at
  `tests/unit/core/explain.test.ts`
  WHEN `pnpm test tests/unit/core/explain.test.ts` is run
  THEN it exits 0; every assertion on `generator` and `reason` strings
  passes; no assertion is updated.

- Scenario: `decideField` is gone from `explain.ts`
  GIVEN B23 implemented
  WHEN a grep for `function decideField` (or `const decideField =`) is run
  against `src/explain.ts`
  THEN no occurrences are found; the per-rung decision logic lives entirely
  in the pipeline step bodies under `dryRun: true`.

- Scenario: `explain.ts` LOC reduced by ≥ 100
  GIVEN B23 implemented
  WHEN `wc -l src/explain.ts` is run
  THEN the line count is ≤ 215 (down from 315 pre-B23). The implementer
  MAY land below this threshold; the requirement is the upper bound.

### B23-R8: PRNG-neutral and registry-neutral `dryRun: true`

A `walkPipeline(PIPELINE, ctx)` call with `ctx.dryRun === true` MUST
consume **zero PRNG state** (no `prng.random()` / `prng.fork(...)` /
`prng.int(...)` calls), MUST NOT invoke any generator function (no matcher,
no key-based generator, no schema-based generator, no `applyModifiers`,
no `unwrapOptionalChainForField`), MUST NOT write to the registry, and
MUST NOT advance any per-world counter (no `derivedPairCounter++`, no
`nextSchemaSlot(...)` slot advance). Every step body MUST check
`ctx.dryRun` before any side-effecting call and return a
`FieldResolution` with `value: undefined` when in dry-run mode. The
`unwrapOptionalStep` dry-run path MUST report `{ kind: "absent" } | { kind:
"default" } | null` based on the field's static optional/nullable/default
structure (no roll), preserving today's `explain.ts` behaviour where
optional/nullable fields report a non-absent decision (B16-R8).

- Scenario: explain consumes zero PRNG state (regression on B16-R8)
  GIVEN a fresh world `w = createWorld({ seed: 1 })` and a schema
  `S = z.object({ name: z.string(), email: z.string() })` registered
  WHEN `w.explain(S);` then `const r1 = w.generate(S);`
  AND a separate world `w2 = createWorld({ seed: 1 })` with the same
  registration calls only `const r2 = w2.generate(S);`
  THEN `JSON.stringify(r1) === JSON.stringify(r2)` (explain advanced no
  PRNG state); the existing B16-R8 test asserting this contract stays
  green.

- Scenario: explain advances no per-world counter
  GIVEN a fresh world with schema `S` registered as primary
  WHEN `w.explain(S);` then `const a = w.generate(S);`
  AND a separate identically-seeded world calls only `const b = w.generate(S);`
  THEN `JSON.stringify(a) === JSON.stringify(b)` (no `derivedPairCounter` /
  `schemaCallCounts` advance from `explain`); the existing test on this
  invariant stays green.

### B23-R9: `generateObjectFields` shrinks; no per-rung logic outside `PIPELINE`

After B23, `WorldImpl.generateObjectFields` MUST reduce to:

- the recursion-depth guard (today's
  [`world.ts:1210-1211`](../../src/world.ts#L1210)),
- the lazy-resolve + `d.type !== "object"` early-return (today's
  [`world.ts:1213-1221`](../../src/world.ts#L1213)),
- the per-field `for` loop that builds the `PipelineStepContext`, calls
  `walkPipeline(PIPELINE, stepCtx)`, and assigns `result[key] = r.value`.

The 0-through-6 per-rung blocks (today's
[`world.ts:1239-1315`](../../src/world.ts#L1239)) MUST move into the
step function bodies; **no per-rung conditional logic MUST remain in
`generateObjectFields`'s body**. The total LOC of `generateObjectFields`
MUST drop below 50 (today: 118). The total LOC of `WorldImpl` (the class
declaration only, exclusive of step function bodies and helper types
co-located in the file) MUST NOT regress by more than +20 LOC from
today's count — the step function bodies MAY co-locate inside `world.ts`
(today's 1759 LOC file), but the class itself MUST shrink rather than
grow.

- Scenario: `generateObjectFields` shrinks below 50 LOC
  GIVEN B23 implemented
  WHEN `awk '/private generateObjectFields/,/^  }/' src/world.ts | wc -l`
  is run (counts the method body inclusive of the signature and closing
  brace)
  THEN the count is < 50.

- Scenario: no per-rung `if` cascade remains in the method body
  GIVEN B23 implemented
  WHEN the body of `generateObjectFields` is inspected
  THEN it contains no `if (matcher)` line, no `if (keyMapFn !== undefined)`
  line, no `if (customGen !== undefined)` line, no `if (keyResult !==
undefined)` line, no `const fieldOverride = overrides?.[key]` line —
  every per-rung branch lives inside a step function body.

### B23-R10: `collection.ts:generateZodObject` walks `PIPELINE_NO_REGISTRATION`

`generateZodObject` ([`collection.ts:193`](../../src/generators/schema/collection.ts#L193))
MUST be rewritten to:

- build a `PipelineStepContext` with `reg = EMPTY_REG` (or an equivalent
  empty `SchemaReg`), `fieldOverride = undefined`,
  `customKeyGenerators = new Map()`, `schemaKeyMaps = new Map()`,
  `dryRun = false`,
- walk `PIPELINE_NO_REGISTRATION`,
- assign `result[key] = r.value`.

The current `unwrapOptionalChainForField` + `generateFromKey` +
`childCtx.generate(innerSchema)` open-coded sequence MUST be deleted. The
`childCtx.prng = ctx.prng.fork(key)` per-field fork MUST be preserved
(threaded via the `fieldCtx.prng` slot on the step context); the
`fieldPath` propagation MUST be preserved (threaded via `fieldCtx.fieldPath`);
the `current: result` propagation MUST be preserved (threaded via
`fieldCtx.current` on the per-field context refresh, exactly as today's
[`collection.ts:205`](../../src/generators/schema/collection.ts#L205)).

- Scenario: `generateZodObject` uses `PIPELINE_NO_REGISTRATION`
  GIVEN B23 implemented
  WHEN the body of `generateZodObject` is inspected
  THEN it contains a reference to `PIPELINE_NO_REGISTRATION` (an import or
  direct identifier) and a `walkPipeline(...)` call; it contains no
  reference to `generateFromKey` (that lookup now lives inside
  `keyHeuristicStep`); it contains no call to `unwrapOptionalChainForField`
  (that call now lives inside `unwrapOptionalStep`).

- Scenario: nested unregistered object behaviour byte-equivalent (regression)
  GIVEN `Outer = z.object({ inner: z.object({ name: z.string(),
createdAt: z.string() }) })` and `world = createWorld({ seed: 99 })` with
  no registration
  WHEN `const r = world.generate(Outer);`
  THEN `JSON.stringify(r)` equals the pre-B23 seed-99 snapshot for `Outer`
  exactly. The existing tests covering nested-`z.object` behaviour
  (notably under `tests/unit/generators/domains/collection.test.ts`) stay
  green without assertion updates.

### B23-R11: full suite green — no behavioural regression on B8 / B10 / B12 / B14 / B16 / B18 / B20 / B24 / B38 / B39

The full test suite (~1013+ tests after B40, plus the new B23-specific
tests for R3, R4, R6, R9, R10) MUST stay green. In particular, the
following sibling-spec test files MUST NOT require any assertion changes:

- B8's per-(DerivedSchema, source) upsert tests
  ([`tests/unit/core/derived-identity.test.ts`](../../tests/unit/core/derived-identity.test.ts)),
- B10's `{ store: false }` opt-out tests
  ([`tests/unit/core/generate-store-opt-out.test.ts`](../../tests/unit/core/generate-store-opt-out.test.ts)),
- B12's nested-override-skips-matcher tests,
- B14's `populate` factory tests
  ([`tests/unit/core/populate-factory.test.ts`](../../tests/unit/core/populate-factory.test.ts)),
- B16's `explain` tests
  ([`tests/unit/core/explain.test.ts`](../../tests/unit/core/explain.test.ts)),
- B18's `deepMerge` atomic-objects tests,
- B20's `store: false` empty-from crash tests,
- B24's regression tests including the no-source-derived path,
- B38's primary-array-overrides-dropped tests,
- B39's call-order-independence tests
  ([`tests/unit/core/call-order-independence.test.ts`](../../tests/unit/core/call-order-independence.test.ts)).

- Scenario: full suite + B23-specific tests green
  GIVEN B23 implemented end-to-end (R1 through R10) and the new B23
  tests landed (per R3, R4, R6, R9, R10)
  WHEN `pnpm test` is run
  THEN it exits 0; every existing assertion passes without update; the
  new B23 tests pass.

### B23-R12: D1 / D5 — internal-only refactor, no `any`, no public API change

The B23 refactor MUST NOT introduce any new `any` types — neither in the
`FieldResolution` union, the `PipelineStepContext` interface, the
`PipelineStep` type, the step bodies, nor the dispatcher. `unknown` is the
correct type for the step values; explicit casts (`as ZodTypeAny`) MAY be
used where today's code already does (e.g.
[`world.ts:1226`](../../src/world.ts#L1226)'s
`for (const [key, fieldSchema] of Object.entries(shape))` casts), but no
new cast MUST be introduced.

No new public API MUST be added to the `World` interface, `WorldImpl`'s
public surface, or `GenerateOptions`. `PIPELINE`, `PipelineStep`,
`FieldResolution`, `PipelineStepContext`, and `PIPELINE_NO_REGISTRATION`
are **internal** — they MAY be exported from `src/world.ts` to allow
import by `src/explain.ts` and `src/generators/schema/collection.ts`, but
MUST NOT be re-exported from `src/index.ts`. `docs/api-reference.md` MUST
NOT need to be updated — there is no public-contract change. (D5 is not
triggered.)

- Scenario: typecheck clean, no new `any`
  GIVEN B23 implemented
  WHEN `pnpm typecheck` is run
  THEN it exits 0; a grep for `: any` and `as any` inside the new code
  (`FieldResolution`, `PipelineStepContext`, `PipelineStep`, `PIPELINE`,
  `PIPELINE_NO_REGISTRATION`, the seven step function bodies, the
  `walkPipeline` dispatcher) finds no occurrences.

- Scenario: `src/index.ts` not modified
  GIVEN B23 implemented and committed
  WHEN the diff of `src/index.ts` is inspected against the pre-B23 commit
  THEN there is no change — B23 adds no public exports.

- Scenario: `docs/api-reference.md` unchanged
  GIVEN B23 implemented and committed
  WHEN the diff of `docs/api-reference.md` is inspected against the
  pre-B23 commit
  THEN there is no change — B23 is internal-only.

### B23-R13: changeset entry — `patch` bump

A changeset MUST be created at
`.changeset/b23-promote-per-field-pipeline-to-list.md` recording B23 as a
`"zod4-mock": patch` bump. The body MUST summarise:

- (a) the internal refactor — per-field pipeline promoted to a `PIPELINE`
  list of named `PipelineStep` functions returning a `FieldResolution`
  tagged union; `generateObjectFields`, `explainSchema`, and
  `generateZodObject` now walk the same list (the latter walks the
  `PIPELINE_NO_REGISTRATION` subset);
- (b) behaviour-neutral — no public API change; all existing tests stay
  green without assertion updates; `explain` output is byte-identical;
  generated data is byte-identical for any given seed;
- (c) the cleanup payoff — `explain.ts` shrinks by ≥ 100 LOC;
  `generateObjectFields` body shrinks below 50 LOC; the per-rung decision
  logic now lives in seven named step functions rather than three
  drift-prone implementations;
- (d) unblocks B37 (pipeline-numbering doc reconciliation).

The bump choice is **`patch`** because B23 is purely internal and
behaviour-neutral: no public API change (R12), no observable behaviour
shift for any consumer, byte-equivalent output. The card itself does not
flag a behaviour change; the refactor is the contract. (Compare B24,
which paired its refactor with a behaviour-shifting B21 fix and took
`minor` for that reason. B23 has no paired behaviour change.)

- Scenario: changeset file exists with `patch` bump
  GIVEN B23 implemented
  WHEN `.changeset/b23-promote-per-field-pipeline-to-list.md` is read
  THEN its frontmatter declares `"zod4-mock": patch`; the body summarises
  (a)-(d) above.

## Out of scope

- **Splitting `src/world.ts` into multiple files** — that is **B28**'s job.
  B23's `PIPELINE` list, `PipelineStep` type, `FieldResolution` union,
  `PipelineStepContext` interface, and the seven step function bodies stay
  inside `src/world.ts`. The implementer MAY co-locate them in a dedicated
  module-private namespace at the top of the file (e.g. a `// ----
PIPELINE ----` section before `class WorldImpl`), but no new file is
  added. B28 will split them out later.
- **Renaming the pipeline rungs** — the seven step names
  (`overrideEagerStep`, `matcherStep`, `schemaKeyMapStep`,
  `unwrapOptionalStep`, `customKeyGenStep`, `keyHeuristicStep`,
  `schemaBasedStep`) MUST be used as written by R3. They map 1:1 onto the
  pipeline-numbering today (`docs/concepts.md`'s 0-5 + the `withGenerators`
  rung today's docs omit). The numbering reconciliation is **B37**'s job;
  B23 does not proactively renumber `docs/concepts.md`, `CLAUDE.md`, or
  `world.ts`'s module-level JSDoc.
- **Adding new pipeline steps** — the seven-step structure is preserved.
  Lazy-resolve as a step (proposed by B22 Dim 4 §"Codify the def(schema)
  → unwrap → lazy-resolve pattern") is **not** added in B23. Future items
  MAY insert new steps; B23 makes that future change trivial by
  establishing the list, but does not pre-empt it.
- **Lifting registration-mode dispatch into `PIPELINE`** — the
  `derivedRegs` / `primaryRegs` / ad-hoc cascade lives in
  `generateSingleItem` (post-B24, in the four decomposed methods). B23
  operates on the per-field pipeline _inside_ one record's generation; it
  does not touch the _per-record_ mode dispatch.
- **Promoting any standing constraint to a new ADR** — B23 establishes no
  new Rules. The Rules it preserves (D1, D3, D4, D5, D6, D8, D9, D10) are
  already binding. No `wiki/decisions.md` entry is added.
- **Updating `wiki/codebase-map.md`** — the file-level view of `world.ts`
  is unchanged; the new internal types and constants are private. The
  manager MAY trigger a `/wiki-sync` follow-up to mention the
  `PIPELINE` shape in the codebase map; this spec does not require it.
- **Public API to walk `PIPELINE` from user code** — `PIPELINE`,
  `PipelineStep`, `FieldResolution`, `PipelineStepContext`, and
  `PIPELINE_NO_REGISTRATION` are internal. Consumers who want to inspect
  the pipeline use `world.explain(schema)` (B16's API), which now happens
  to drive the same list under `dryRun: true`.
- **Fixing the `explain.ts` rung-ordering drift noted by B22**
  (`withGenerators` placed before exact-key map in `decideField`) — this
  is **automatically fixed** by R7 (`explainSchema` walks the same
  `PIPELINE` list in the canonical order), but is not called out as a
  separate requirement because the byte-identical `ExplainResult` invariant
  (R7) constrains it: any rendering change would shift an `ExplainResult`
  string, which R7 forbids. (Practical implication: today's `explain.ts`
  `decideField` reports `custom:<lk>` before checking the exact-key map,
  while the code runs custom-gen **after** the exact-key map. The R7
  byte-identical invariant means the implementer MUST verify today's
  `explain.ts` output for a `lk` that has both a custom generator AND an
  exact-key match — if such a case exists in any current test, the spec
  bumps it to a blocking open question; the spec-writer's read of the
  existing test suite found no such case, classifying this as
  non-blocking.)

## Open questions

- **`FieldResolution` co-location — Non-blocking.** Default: the union,
  the `PipelineStep` type, the `PipelineStepContext` interface, the
  seven step function bodies, the `PIPELINE` list, the
  `PIPELINE_NO_REGISTRATION` subset, and the `walkPipeline` dispatcher
  all live in `src/world.ts` (today's 1759 LOC file). The implementer MAY
  break them into a top-of-file `// ---- PIPELINE ----` section, a
  module-private namespace, or even a new file
  `src/world/pipeline.ts` if doing so reads cleaner. B28 will rearrange
  the file structure later; B23 makes no commitment beyond "these symbols
  are importable by `explain.ts` and `collection.ts`." Recorded; not
  blocking.

- **`inner`-schema threading from step 3 to steps 4-6 — Non-blocking.**
  Default: the dispatcher destructures the unwrapped inner schema from
  step 3's "no-resolution" side channel and refreshes the context for
  steps 4-6 with `inner` populated. The cleanest implementation form is
  ambiguous between (a) the step returns a `{ resolution: null; inner:
ZodTypeAny }` shape, (b) the step writes the inner to a
  pre-allocated slot on a mutable context, or (c) the dispatcher
  pre-runs the unwrap loop before any step fires and threads `inner` from
  the start. The implementer picks the cleanest of (a) / (b) / (c); the
  observable invariant is that steps 4-6 see the unwrapped schema. The
  spec-writer leans toward (c) — the unwrap is the only step that
  meaningfully transforms the schema before later steps consume it, and
  hoisting it lets the seven step functions all receive a fully-built
  context — but (c) deviates from the literal "seven steps in order"
  framing of R3. (a) preserves R3 cleanly. Recorded; not blocking.

- **Whether `walkPipeline` is a free function or a class method —
  Non-blocking.** Default: free function (`function walkPipeline(pipeline,
ctx): FieldResolution`). It has no `this`-dependence, takes the
  context-with-tables-and-dryrun explicitly, and is more easily reused
  by `explain.ts` and `collection.ts`. A class method on `WorldImpl`
  would force them to import the class. The implementer picks; both
  shapes satisfy R3 and R9. Recorded; not blocking.

- **Whether step bodies live at module scope or inside `WorldImpl` as
  private static / private instance methods — Non-blocking.** Default:
  module-scope `const overrideEagerStep: PipelineStep = (ctx) => { ... }`
  declarations. Step bodies do not need `this`; they read everything they
  need off the context. Class-scope methods would force `bind(this)` at
  the `PIPELINE` declaration site or change the `PipelineStep` signature
  to include `this`-binding, which is messier. Recorded; not blocking.

- **Migrating the `applyObjectOverride` helper to `src/utils/merge.ts` —
  Non-blocking.** Default: declare `applyObjectOverride` next to the step
  bodies (top-of-file in `world.ts` or in the same co-located module per
  the first open question). The helper is a one-liner that's only useful
  to the pipeline; placing it next to the steps keeps the B12 contract
  scoped to the engine. The implementer MAY hoist it into
  `src/utils/merge.ts` if a future caller materialises; for B23 it is
  pipeline-local. Recorded; not blocking.

- **`explain.ts`'s shrink target — Non-blocking.** R7 pins ≤ 215 LOC
  (down from 315). The implementer MAY land below that. The shrink
  benefit is the cleanup payoff and is the visible reason B23 is the
  headline lever; landing at, say, 180 LOC would be a stronger payoff.
  The 215 ceiling is the requirement; "lower is better" is the guidance.
  Recorded; not blocking.

- **Whether `PipelineStepContext.fieldCtx` exposes a typed `current`
  slot or remains `Partial<any>` — Non-blocking.** The existing
  `GeneratorContext.current` is typed `Partial<any>` at
  [`src/types.ts`](../../src/types.ts) (B23 inherits this rather than
  fixing it). Tightening this type is a separate item; B23 preserves
  today's shape. The `as any` cast at
  [`world.ts:947`](../../src/world.ts#L947) is preserved; R12's "no
  **new** `any`" wording covers this — the existing `any` is not
  introduced by B23. Recorded; not blocking.

- **B37 fold-in vs. separate item — Non-blocking.** B37 is blocked on
  B23 and explicitly tracks the pipeline-numbering doc reconciliation
  (5 vs 6 vs 7 rungs across `docs/concepts.md`, `CLAUDE.md`,
  `world.ts` JSDoc, `wiki/codebase-map.md`, `explain.ts`). Default:
  leave B37 separate. The new step names (R3) do not suggest a
  different numbering — they map 1:1 onto today's 7-rung structure —
  so there is no in-spec opportunity to fold B37 into B23's commit
  without expanding scope. The B22 audit's "pick one canonical
  ordering and document it" recommendation is B37's contract; B23
  provides the canonical source (the `PIPELINE` list itself), B37
  consumes it. Recorded; not blocking. (The reviewer's three minor
  cosmetic findings from B22 — pipeline rung counts off by one,
  `email` LOC off by one, `types.ts` fan-in off by one — also land
  in B37's commit per its item card notes.)

No blocking open questions remain; the spec can advance to `test-writer`.
