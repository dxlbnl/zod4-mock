# B24: Decompose `WorldImpl.generateSingleItem` into four named methods (closes B21)

## Context

`WorldImpl.generateSingleItem` ([src/world.ts:1337-1513](../../src/world.ts#L1337),
~164 LOC, ~23 branch tokens) glues four disjoint sub-pipelines together via a
mutable `result` variable and a `transformApplied` flag. The four branches are:

1. `sourceOverride !== undefined` — the **B8 with-source upsert** path
   (lines ~1375-1437). Stores the derived record under `if (this.effectiveStore)`
   and records the per-(DerivedSchema, source-identity) entry in
   `derivedUpsert`. Applies `transform` inside `generateDerivedRecord` (B14 / D8);
   the spec's existing wording at lines ~1408-1412 explicitly says "do NOT
   re-apply overrides or transform in this branch".
2. `derivedRegs.length > 0` (no source) — the **no-source-derived
   auto-source** path (lines ~1438-1477). Auto-provisions a source per
   `derivedReg`, captures locally under `store: false` (B20's fix), picks a
   `(source, reg, sourceIndex)` pair via `derivedPairCounter` round-robin, calls
   `generateDerivedRecord`. **Today it does not store the derived record** —
   that's the asymmetry [B21](../backlog/inbox/B21-derived-generate-no-source-not-stored.md)
   captures, and it gets closed in this item (see Decision below).
3. `primaryRegs.length > 0` — the **registered-primary** path
   (lines ~1478-1480). Delegates to `generateAndStorePrimary`, which already
   applies `transform` and stores under `if (this.effectiveStore)`.
4. Ad-hoc fallback (unregistered schema, lines ~1481-1505). Calls
   `this.nextSchemaSlot(schema)` for the B39 per-schema slot, forks the ad-hoc
   PRNG via `prng.fork('adhoc:<id>:<slot>')`, dispatches to
   `generateObjectFields` (object schemas) or `generateFromSchema` (non-object
   schemas).

The trailing block at lines ~1508-1511 exists only to clean up after whichever
branch ran:

```ts
if (options?.overrides) result = deepMerge(result, options.overrides);
if (options?.transform && !transformApplied) {
  result = options.transform(result as input<ZodTypeAny>);
}
```

That block is structural debt: two branches set `transformApplied = true` to
defeat it, one branch (with-source) returns early to avoid it entirely, and the
ad-hoc branch is the only one that needs it. The mental load of "which branches
already applied `transform`, which already applied `overrides`?" is the function's
worst readability tax.

B22's audit
([wiki/research/reports/codebase-complexity.md](../research/reports/codebase-complexity.md)
§"Dimension 4 → WorldImpl.generateSingleItem", §"Dimension 1 #3") flagged this
as the engine's clearest accidental-complexity hot spot. The item card
([wiki/backlog/doing/B24-decompose-generate-single-item.md](../backlog/doing/B24-decompose-generate-single-item.md))
prescribes the decomposition into four private methods plus a thin dispatcher;
the manager pre-flagged it `review` so the user can approve the four method
signatures and the B21 resolution direction before tests/impl.

### B21 is closed inside this item

[B21](../backlog/inbox/B21-derived-generate-no-source-not-stored.md) captured an
asymmetry surfaced during B20's pipeline: under default `store: true`, the
no-source-derived branch generates a derived record and returns it but does
**not** write it to the registry, while the with-source branch stores by default
(B8). Today's behaviour:

```ts
world.generate(Derived, { source: x }); // count(Derived) → 1 (B8 stores)
world.generate(Derived); // count(Derived) → still 1 (asymmetry)
```

The card's recommended direction is **A — make the no-source branch also store
by default**. The asymmetry is a surprise factor when refactoring, exactly the
kind of buried-in-cascade detail that decomposition makes obvious. Once the
no-source branch is its own ~30-line method (`generateDerivedAutoSource`), the
missing `if (this.effectiveStore) this.registry.store(schema, result)` call —
mirroring the with-source branch's line at ~1426 — is the natural and only fix.
This spec adopts direction A and pins it in B24-R3.

### Pipeline / Rules compliance

- **D1 — no `any`**. The four extracted methods take typed parameters
  (`schema: ZodTypeAny`, `regs: SchemaReg[]`, `source: unknown`,
  `options?: GenerateOptions<unknown>`). The `(options as any)?.source` cast at
  line 1373 is part of B7's input/output type story (the `source` field on
  `GenerateOptions` is intentionally `any`-typed at registration time); the
  refactor preserves the existing cast in the dispatcher, no new `any` is
  introduced.
- **D3 — Zod v4 internals via `_zod.def`**. Unchanged; the lazy-resolve `while`
  at lines 1351-1359 stays in the dispatcher and continues to read `d.type ===
"lazy"` / `d.getter!()` exactly as today.
- **D4 / D10 — per-schema identity-based fork keys**. The B39 call site at
  line 1486 (`this.nextSchemaSlot(schema)` in the ad-hoc branch) MUST move to
  `generateAdHoc` and continue to key on the **outer** `schema` reference, not
  on `targetSchema` (after `lazy` resolution). The reference-identity rule
  (`WeakMap<ZodTypeAny, number>`) is preserved exactly as B39 set it up.
- **D5 — no public API change**. The refactor is purely internal: four private
  methods on `WorldImpl`. No surface visible to consumers changes. D5 is not
  triggered.
- **D6 — regression test for B21**. B24 carries B21's behaviour change, so the
  regression test for B21's asymmetry MUST land alongside (B24-R7).
- **D8 — stored equals returned for registered schemas**. The with-source
  branch's `this.registry.store(...)` is preserved inside
  `generateWithSourceOverride`; the new no-source-derived store added by R3
  also writes the same reference that's returned (after `generateDerivedRecord`
  has applied any `transform` per B14). D8 holds on both derived branches.
- **D9 — cache short-circuits PRNG- and counter-neutral**. The B8-R9 upsert
  short-circuit at lines 1394-1405 — which rolls back `derivedPairCounter--` on
  a cache hit — MUST be preserved by the decomposition. Whether that rollback
  lives in the dispatcher or in `generateWithSourceOverride` is a choice the
  implementer makes; both work because the increment happens at the dispatcher's
  top (line 1346, `this.derivedPairCounter++`). This spec leaves the placement
  open (see Open questions) but pins the behaviour.
- **D10 — generation determinism per-(seed + schema identity + per-schema call
  index)**. B39 strengthened this rule. The decomposition MUST NOT regress it:
  the ad-hoc branch's `nextSchemaSlot(schema)` call MUST continue to fire
  exactly once per non-cache-hit `generateSingleItem` invocation that lands in
  the ad-hoc branch, with the outer `schema` reference. No new
  `nextSchemaSlot` calls are introduced; no existing call is moved between
  schema references.

### How B24 composes with adjacent items

- **B25** (resolveMode extraction) is not a prerequisite. B22 lists it as
  separate work that could land first to simplify the dispatcher; this item
  intentionally does **not** pre-empt B25 — it keeps the dispatcher's existing
  detection (`findDerivedRegs` / `findPrimaryRegs` / two-level fallback at
  lines 1362-1369) as-is. B25 will refactor that detection cross-method
  (`generateArray`, `populate`, `populateFrom` are also affected); B24 stays
  scoped to `generateSingleItem`.
- **B28** (split `world.ts` into multiple files) is later work. B24 keeps all
  four new methods inside `world.ts`, on `WorldImpl`.

Item card: [wiki/backlog/doing/B24-decompose-generate-single-item.md](../backlog/doing/B24-decompose-generate-single-item.md).
Closes [B21](../backlog/inbox/B21-derived-generate-no-source-not-stored.md). No
direct GitHub issue.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined
> in RFC 2119 — they mark genuine requirements, not emphasis.

## Decision

**Adopt the four-method split as prescribed by the item card.**

```ts
private generateWithSourceOverride(
  schema: ZodTypeAny,
  regs: SchemaReg[],
  source: unknown,
  options: GenerateOptions<unknown> | undefined,
): unknown;

private generateDerivedAutoSource(
  schema: ZodTypeAny,
  derivedRegs: SchemaReg[],
  options: GenerateOptions<unknown> | undefined,
): unknown;

private generatePrimary(
  schema: ZodTypeAny,
  primaryReg: SchemaReg,
  options: GenerateOptions<unknown> | undefined,
): unknown;

private generateAdHoc(
  schema: ZodTypeAny,
  targetSchema: ZodTypeAny,
  options: GenerateOptions<unknown> | undefined,
): unknown;
```

The dispatcher `generateSingleItem` retains:

- the recursion-depth check at lines 1338-1340,
- the `derivedPairCounter++` increment at line 1346,
- the lazy-resolve `while` at lines 1351-1359,
- the `findDerivedRegs` / `findPrimaryRegs` detection at lines 1362-1369,
- the `sourceOverride` extraction at line 1373,
- the **trailing override-deep-merge + transform** block at lines 1508-1511,
  applied **only** to the result of `generateAdHoc` (and `generatePrimary`
  inherits today's "transform applied inside `generateAndStorePrimary`"
  semantics, so the trailing `transform` is gated on `!transformApplied` exactly
  as today).

**Adopt direction A for B21** — `generateDerivedAutoSource` writes the derived
record to the registry under `if (this.effectiveStore)`, mirroring the
with-source branch's line at ~1426. This closes B21 inside the same commit as
the refactor.

### Why this split, and why not the alternatives

**Alternative (a): keep `generateSingleItem` as-is, only fix B21.** Rejected.
The B21 fix in isolation adds _one more side-effect line_ to an already-overloaded
function (now ~165 LOC) and does nothing to resolve the underlying readability
debt. B22's audit framed this exact bait — "the B21 asymmetry is currently easy
to miss because it's buried in the cascade" — as the reason the larger
decomposition is the right vehicle for the fix.

**Alternative (b): split into a single helper with case dispatch on a tagged
mode union.** This is roughly B25's job (extract `resolveMode(schema):
SchemaMode` and let every call site switch on the tag). It would require
introducing the tagged union _and_ the four cases in one item. B24 deliberately
stays scoped to `generateSingleItem`: extracting `resolveMode` cross-method
involves `generateArray`, `populate`, `populateFrom` — out of scope here. The
four-method split leaves room for B25 to convert the dispatcher's branch
selection (today's `if (sourceOverride !== undefined) ... else if
(derivedRegs.length > 0) ...`) into `switch (resolveMode(...))` later, without
B24 pre-empting that design.

**Alternative (c): extract `resolveMode()` first.** Same as (b) — it conflates
B24 with B25. The item card explicitly notes "Related: B25 (`resolveMode`
extraction) could land first to simplify the dispatcher; not a hard prerequisite".
This spec respects the not-pre-empting boundary.

**Why exactly four boundaries, not three or five.** The four boundaries map
1:1 onto the four branches of the existing cascade. Three would force two
disjoint pipelines back into one method (which is the very smell being fixed).
Five would split the ad-hoc branch's object-vs-non-object dispatch into its own
method; that dispatch is two lines (`def(targetSchema).type === "object" ? ... :
...`) and lives naturally inside `generateAdHoc`. The four-way decomposition is
the minimal split that gives each disjoint pipeline its own scope.

## Requirements

### B24-R1: four named private methods replace the cascade body

`WorldImpl.generateSingleItem` MUST decompose into four private methods on
`WorldImpl` — `generateWithSourceOverride`, `generateDerivedAutoSource`,
`generatePrimary`, `generateAdHoc` — each handling exactly one of the four
branches of the existing if/else cascade. Each method MUST carry a JSDoc
summary stating which branch it handles and the contract preserved (the B8
upsert, the B20 local-capture, the B39 per-schema slot, etc.). The dispatcher
(`generateSingleItem` itself) MUST remain the entry point that resolves the
mode and routes the call. No new public API MUST be introduced; the four new
methods MUST be `private` on `WorldImpl`.

- Scenario: four methods exist with correct visibility
  GIVEN B24 implemented end-to-end
  WHEN `src/world.ts` is read
  THEN `class WorldImpl` declares four methods named `generateWithSourceOverride`,
  `generateDerivedAutoSource`, `generatePrimary`, `generateAdHoc`; each is
  declared `private`; each has a JSDoc summary; `generateSingleItem` continues
  to exist and remains the only call site for the four helpers.

- Scenario: no public surface change
  GIVEN B24 implemented
  WHEN a consumer attempts `world.generateWithSourceOverride(...)` (or any of
  the four method names) at the call site
  THEN `pnpm typecheck` reports a type error — the methods are private on
  `WorldImpl` and not visible through the `World` interface; the only public
  entry point is still `world.generate(schema, options?)`.

### B24-R2: `generateWithSourceOverride` preserves B8's per-(DerivedSchema, source) upsert

`generateWithSourceOverride(schema, derivedRegs, source, options)` MUST
preserve every B8 contract that today's `sourceOverride !== undefined` branch
implements at [src/world.ts:1375-1437](../../src/world.ts#L1375):

- The first call for a given `(DerivedSchema, identity(source))` MUST run
  `generateDerivedRecord` to produce the derived record, write it to the
  registry under `if (this.effectiveStore)`, and record the
  `(identity → derived)` entry in `derivedUpsert` under
  `if (this.effectiveStore)` (and only when `isUnique === true`, per B8-R4).
- A second call with the same source-identity for the same DerivedSchema MUST
  return the cached value via the upsert hit path AND MUST roll back
  `derivedPairCounter--` per D9 / B8-R9 cache-neutrality. Whether the rollback
  lives in the dispatcher or inside this method is the implementer's choice;
  the **observable** invariant is that no per-world counter advances on an
  upsert hit.
- The `transform` (if any) MUST be applied **inside** the derived-record path
  (via `generateDerivedRecord`'s existing transform-apply); the dispatcher MUST
  NOT re-apply it for results returned through this method. The existing
  comment at lines 1408-1412 ("do NOT re-apply overrides or transform in this
  branch") MUST continue to hold for the new method.
- Under `effectiveStore === false`, B8-R7 stays in force: the upsert lookup
  AND the upsert write are both suppressed.

- Scenario: B8-R1 upsert still hits on a second call (regression)
  GIVEN the B8-R1 setup
  ([wiki/specs/B8-derived-schemas-identity.md](B8-derived-schemas-identity.md)) —
  `UserSchema`, `UserProfileSchema` with `from: UserSchema`, one stored `user`
  WHEN the consumer calls `const a = world.generate(UserProfileSchema, { source: user });`
  then `const b = world.generate(UserProfileSchema, { source: user });`
  THEN `a === b` (reference equality), `world.registry.count(UserProfileSchema) === 1`,
  and `a.userId === user.id` — identical to today's B8-R1 behaviour.

- Scenario: B8-R9 D9 cache neutrality preserved (regression)
  GIVEN two worlds with the B8-R1 setup, each with one stored user
  WHEN `worldA` calls `worldA.generate(UserProfileSchema, { source: userA })` once,
  then `worldA.generate(UserSchema)` (advancing PRNG by one primary), and
  `worldB` calls `worldB.generate(UserProfileSchema, { source: userB })` twice
  (second is an upsert hit), then `worldB.generate(UserSchema)`
  THEN `worldA`'s second `UserSchema` value `JSON.stringify`-equals `worldB`'s
  third `UserSchema` value — the upsert hit in `worldB` advanced no
  `derivedPairCounter` and produced no PRNG draw. The existing B8-R9 test
  ([tests/unit/core/derived-identity.test.ts](../../tests/unit/core/derived-identity.test.ts))
  MUST stay green.

- Scenario: transform applied once, not twice (regression on lines 1408-1412)
  GIVEN the B8-R1 setup with one stored user
  WHEN the consumer calls
  `world.generate(UserProfileSchema, { source: user, transform: (p) => ({ ...p, count: (p as any).count ? (p as any).count + 1 : 1 }) })`
  THEN the returned record has `count === 1` (the transform ran exactly once);
  the value returned `===` `world.registry.all(UserProfileSchema)[0]` (D8).

### B24-R3: `generateDerivedAutoSource` closes B21 by writing the derived record under `effectiveStore`

`generateDerivedAutoSource(schema, derivedRegs, options)` MUST handle the
no-source-derived branch (today's `else if (derivedRegs.length > 0)` at
[src/world.ts:1438-1477](../../src/world.ts#L1438)) and MUST:

- Auto-provision one source per distinct `reg.from` whose source registry is
  currently empty, via `this.generateAndStorePrimary(reg.from, fromReg)` — same
  call as today.
- Capture the auto-provisioned source locally in a
  `Map<ZodTypeAny, unknown>` keyed by `reg.from`, exactly as today (B20's fix).
  Multiple `derivedReg`s sharing the same `reg.from` reuse one captured source.
- Collect `(source, reg, sourceIndex)` pairs by reading
  `this.registry.all(reg.from!)` for non-empty source registries and falling
  back to the captured Map for empty ones (the B20-R4 invariant on the
  non-empty path is unchanged).
- Pick a pair via `(this.derivedPairCounter - 1) % pairs.length` and call
  `this.generateDerivedRecord(schema, reg, source, sourceIndex, options)`.
- **NEW (closes B21)**: under `if (this.effectiveStore)`, write the resulting
  derived record to the registry via `this.registry.store(schema, result)` —
  mirroring the with-source branch's line at ~1426. This makes the no-source
  derived path symmetric with the with-source path on the storage axis.
- Return the derived record. The dispatcher MUST NOT re-apply the `transform`
  (`generateDerivedRecord` has already applied it, just as today — the
  `transformApplied = true` semantics is preserved).
- Under `effectiveStore === false`, the new `registry.store` call MUST be
  skipped, preserving B10-R4's transitive suppression rule and B20-R2's
  invariant that `store: false` does not write the derived record. This is
  the same mechanism B8's with-source path uses; reusing it here is the entire
  point.

The new store call MUST NOT enter the B8 `derivedUpsert` map — the upsert is
keyed by an explicit `source` identity, and the no-source path has no such
identity. The two paths share storage semantics; they do not share upsert
semantics.

- Scenario: closes B21 — no-source default-mode derived store lands in the registry
  GIVEN the B21 repro setup
  ([wiki/backlog/inbox/B21-derived-generate-no-source-not-stored.md](../backlog/inbox/B21-derived-generate-no-source-not-stored.md)):

  ```ts
  const Source = z.object({ id: z.uuid(), name: z.string() });
  const Derived = z.object({ sourceId: z.uuid(), label: z.string() });
  const world = createWorld({ seed: 1 });
  world.withSchema(Source);
  world.withSchema(Derived, { from: Source, matchers: { sourceId: (ctx) => ctx.source.id } });
  ```

  with `world.registry.count(Source) === 0 && world.registry.count(Derived) === 0`
  WHEN the consumer calls `const r = world.generate(Derived);` (no `source`, no
  `store` option)
  THEN `Derived.safeParse(r).success === true`;
  `world.registry.count(Source) === 1` (auto-provisioned source stored today,
  unchanged); `world.registry.count(Derived) === 1` (B24's fix — the no-source
  derived record now lands in the registry, closing B21).

- Scenario: with-source path's existing behaviour unchanged (regression on B21 fix)
  GIVEN the same setup, registry empty
  WHEN the consumer calls
  `const a = world.generate(Source);` then
  `const b = world.generate(Derived, { source: a });` then
  `const c = world.generate(Derived, { source: a });`
  THEN `b === c` (B8 upsert hit on second call); `world.registry.count(Derived) === 1`
  — the with-source path still upserts to exactly one record, identical to today.

- Scenario: B20's `store: false` empty-registry path still does not write
  ([wiki/specs/B20-store-false-empty-from-crash.md](B20-store-false-empty-from-crash.md))
  GIVEN the B21 repro setup, registry empty for both schemas
  WHEN the consumer calls `world.generate(Derived, { store: false });`
  THEN the call returns without throwing; `world.registry.count(Source) === 0`
  (B20-R2 — auto-provisioned source not stored under `store: false`);
  `world.registry.count(Derived) === 0` (B10-R2 / B20-R2 — derived record not
  stored under `store: false`, even after B24's new R3 store call, because the
  store is gated on `this.effectiveStore`).

- Scenario: loop of `generate(Derived)` calls — source reused, derived per call
  GIVEN the B21 repro setup, registry empty
  WHEN the consumer calls `for (let i = 0; i < 5; i++) world.generate(Derived);`
  THEN `world.registry.count(Source) === 1` (the no-source branch auto-provisions
  ONLY when the source registry is empty at call time; the first call stores one
  source and subsequent calls reuse it via the `pairs[idx % pairs.length]`
  round-robin — unchanged from today); `world.registry.count(Derived) === 5`
  (B24's fix — each call stores its derived record, so a 5-iteration loop
  produces 5 derived records reading off the single shared source).

### B24-R4: `generatePrimary` delegates to `generateAndStorePrimary` and inherits today's transform behaviour

`generatePrimary(schema, primaryReg, options)` MUST handle the
`primaryRegs.length > 0` branch (today's [src/world.ts:1478-1480](../../src/world.ts#L1478))
and MUST delegate the entire work to `this.generateAndStorePrimary(schema,
primaryReg, options)`. `generateAndStorePrimary` already applies `transform`
inside its body (see [src/world.ts:1004-1006](../../src/world.ts#L1004)), so the
dispatcher's trailing `if (options?.transform && !transformApplied) ...` block
MUST NOT re-apply it — i.e. `transformApplied = true` must be set (or
equivalent: the dispatcher routes `generatePrimary` results down the
"transform already applied" lane). This is byte-equivalent to today.

- Scenario: registered-primary generate is byte-identical to pre-B24
  GIVEN `PersonSchema = z.object({ id: z.uuid(), name: z.string() })` and two
  worlds, each `createWorld({ seed: 42 }).withSchema(PersonSchema)`
  WHEN each world calls `const r = world.generate(PersonSchema);`
  THEN both `r`s are deep-equal (`JSON.stringify`-identical); the registry
  contains exactly one record; and the value matches a pre-B24 baseline run
  with the same seed and schema. The existing tests at
  [tests/unit/core/world.test.ts:621-642](../../tests/unit/core/world.test.ts#L621)
  ("determinism" describe block) MUST stay green.

- Scenario: transform applies exactly once on primary path
  GIVEN the world above
  WHEN the consumer calls
  `const r = world.generate(PersonSchema, { transform: (p) => ({ ...p, marker: "T" }) });`
  THEN `r.marker === "T"`; `world.registry.all(PersonSchema)[0] === r` (D8 — the
  stored record equals the returned record, with the transform applied once,
  identical to today).

### B24-R5: `generateAdHoc` preserves the B39 per-schema slot and the lazy-target split

`generateAdHoc(schema, targetSchema, options)` MUST handle the ad-hoc fallback
branch (today's `else` at [src/world.ts:1481-1505](../../src/world.ts#L1481))
and MUST:

- Call `this.nextSchemaSlot(schema)` for the B39 per-schema slot. The argument
  MUST be the outer `schema` reference (the one the caller invoked
  `generate(...)` with), NOT the lazy-resolved `targetSchema` — preserving
  B39-R4 site 1's stable identity model across `z.lazy(...)` re-resolutions.
- Build the ad-hoc PRNG via `this.prng.fork('adhoc:<id>:<slot>')` using the
  returned `{ id, slot }`. The fork-key shape MUST remain literally
  `adhoc:${id}:${slot}` — D10 / B39 fixes this string format.
- Dispatch on `def(targetSchema).type`:
  - If `"object"` — call `this.generateObjectFields(targetSchema, EMPTY_REG,
undefined, adHocPrng, recordId, fieldPath, options?.overrides as
Record<string, unknown>)`, exactly as today.
  - Otherwise — call `generateFromSchema(targetSchema,
this.makeFieldCtx(EMPTY_REG, undefined, adHocPrng, adHocPrng, fieldPath,
recordId))`, exactly as today.
- Return the result; the dispatcher then applies the trailing
  `if (options?.overrides) result = deepMerge(...)` and
  `if (options?.transform && !transformApplied) result = options.transform(...)`
  block to it. (The ad-hoc branch is the **only** branch for which the
  dispatcher actually applies these — the other three already applied them
  inside their helpers.)

- Scenario: ad-hoc call-order independence preserved (B39-R1 regression)
  GIVEN `AdHocSchema = z.object({ x: z.number().int(), y: z.string() })`,
  `OtherSchema = z.object({ z: z.number().int() })`, and two worlds
  `worldA = createWorld({ seed: 42 })` and `worldB = createWorld({ seed: 42 })`
  WHEN `worldA` calls `const a = worldA.generate(AdHocSchema)`, and `worldB`
  calls `worldB.generate(OtherSchema)` then `const b = worldB.generate(AdHocSchema)`
  THEN `JSON.stringify(a) === JSON.stringify(b)` — the B39 per-schema slot
  semantics are preserved. The existing B39-R1 tests at
  [tests/unit/core/call-order-independence.test.ts](../../tests/unit/core/call-order-independence.test.ts)
  MUST stay green.

- Scenario: ad-hoc trailing transform applied once
  GIVEN `AdHocSchema = z.object({ x: z.number().int() })` and a fresh world
  WHEN the consumer calls
  `const r = world.generate(AdHocSchema, { transform: (v) => ({ ...v, marker: "T" }) });`
  THEN `r.marker === "T"` (transform applied exactly once by the dispatcher);
  no record is stored (ad-hoc has no registration — unchanged from today).

- Scenario: ad-hoc trailing overrides deep-merge applied
  GIVEN `AdHocSchema = z.object({ obj: z.object({ a: z.string(), b: z.string() }) })`
  and a fresh world
  WHEN the consumer calls
  `const r = world.generate(AdHocSchema, { overrides: { obj: { b: "B" } } });`
  THEN `r.obj.b === "B"` (override applied via deep-merge) AND `typeof r.obj.a
=== "string"` (the schema-generated value for `a` is preserved) — identical
  to today.

### B24-R6: dispatcher (`generateSingleItem`) routes to the matching method

The dispatcher MUST:

- Run the recursion-depth check (line 1340) unchanged.
- Increment `this.derivedPairCounter++` at the top (line 1346) unchanged.
- Run the lazy-resolve `while` (lines 1351-1359) unchanged, producing
  `targetSchema = current` post-resolution.
- Run the two-level `findDerivedRegs(schema) || findDerivedRegs(targetSchema)`
  / `findPrimaryRegs(schema) || findPrimaryRegs(targetSchema)` detection
  (lines 1362-1369) unchanged.
- Extract `sourceOverride = (options as any)?.source` (line 1373) unchanged.
- Route by branch detection:
  - `sourceOverride !== undefined` → `generateWithSourceOverride(schema,
derivedRegs, sourceOverride, options)`
  - else `derivedRegs.length > 0` → `generateDerivedAutoSource(schema,
derivedRegs, options)`
  - else `primaryRegs.length > 0` → `generatePrimary(schema,
primaryRegs[0]!, options)`
  - else → `generateAdHoc(schema, targetSchema, options)`
- Apply the trailing `if (options?.overrides) result = deepMerge(result,
options.overrides)` line **only for branches that did not apply overrides
  inside** — i.e. for the result of `generateAdHoc` (and effectively a no-op
  for the others, because their helpers already handled overrides). The
  implementer MAY express this as a per-branch `transformApplied`-style flag
  (today's pattern), or by having each helper return both the value and an
  "already-finalized" indication, or by hoisting the trailing block into the
  ad-hoc helper itself. The observable contract is: **`transform` and
  `overrides` MUST be applied exactly once per call, regardless of which
  branch ran**.
- Honour the B8 cache short-circuit (D9): on an upsert hit inside
  `generateWithSourceOverride`, no per-world counter advances by the time the
  dispatcher returns. The implementer MAY locate the `derivedPairCounter--`
  rollback in either the dispatcher (after the helper returns the cached
  value) or inside `generateWithSourceOverride` (before it returns); both
  preserve D9.

- Scenario: `transform` applied exactly once across all four branches
  GIVEN four scenarios — with-source, no-source-derived, primary, ad-hoc —
  each invoking `world.generate(...)` with a counting `transform: (v) => ({
...v, count: ((v as any).count ?? 0) + 1 })`
  WHEN each scenario is exercised once
  THEN each returned record has `count === 1` (no branch double-applies the
  transform); for branches that store, the stored record `===` the returned
  record with `count === 1` (D8 holds).

- Scenario: `overrides` applied exactly once across all four branches
  GIVEN the same four scenarios, each invoking
  `world.generate(..., { overrides: { marker: "O" } })` on a schema with a
  `marker: z.string()` field
  WHEN each scenario is exercised once
  THEN each returned record has `marker === "O"`; for object-typed overrides
  the deep-merge runs once (no double-merge corruption — every other generated
  field is byte-equivalent to a control run with no `overrides`).

### B24-R7: regression test for B21 — D6

Per binding rule D6 ("when fixing a bug, a regression test MUST be added"), a
new regression test MUST land alongside the B24 implementation and MUST:

- Live under `tests/unit/` (per the architecture's test-file-location
  convention).
- Register `Source` (primary) and `Derived` (with `from: Source`, matcher reads
  `ctx.source.id`).
- Call `world.generate(Derived)` once with no `source` and default
  `store: true`.
- Assert `world.registry.count(Derived) === 1` after the call — the
  no-source-derived path now stores by default, closing B21.
- Cover the with-source path in the same file to confirm
  `world.registry.count(Derived) === 1` after `world.generate(Derived, {
source });` hasn't regressed.
- Assert the `store: false` no-source path still produces
  `world.registry.count(Derived) === 0` — B20-R2's invariant is preserved by
  the `if (this.effectiveStore)` gate.
- Fail on the pre-B24 codebase (where the no-source derived path returns
  without storing — `count === 0`) and pass after B24.

- Scenario: B21 regression test exists and asserts the new symmetric storage
  GIVEN B24 implemented and committed
  WHEN `pnpm test` is run
  THEN a test file under `tests/unit/` exercises the B21 repro and asserts
  `world.registry.count(Derived) === 1` after a no-source `world.generate(Derived)`
  call under default `store: true`; the test passes; the test would have
  failed against the 0.7.1 + B20 + B39 codebase prior to B24's R3 implementation.

### B24-R8: full suite green — no regressions on B8 / B10 / B14 / B20 / B39

The full test suite (~1013+ tests after B40, plus the B24-R7 regression test)
MUST stay green. In particular, the following sibling-spec tests MUST NOT
require any changes to their assertions:

- B8's per-(DerivedSchema, source) upsert tests
  ([tests/unit/core/derived-identity.test.ts](../../tests/unit/core/derived-identity.test.ts))
  — every `B8-R*` scenario stays byte-equivalent.
- B10's `{ store: false }` opt-out tests
  ([tests/unit/core/generate-store-opt-out.test.ts](../../tests/unit/core/generate-store-opt-out.test.ts))
  — every `B10-R*` scenario stays byte-equivalent, in particular B10-R4's
  transitive-suppression scenarios.
- B14's `populate` factory tests
  ([tests/unit/core/populate-factory.test.ts](../../tests/unit/core/populate-factory.test.ts))
  — registered-primary byte-equivalence is unaffected.
- B20's `store: false` empty-from crash test
  ([tests/unit/store-false-empty-from.test.ts](../../tests/unit/store-false-empty-from.test.ts))
  — every `B20-R*` scenario stays byte-equivalent. **Note**: B20-R2's second
  scenario asserts that after a follow-up default-mode call,
  `world.registry.count(Derived) === 0` — this assertion **must be updated**
  to `=== 1` under B24's R3 (the no-source default-mode path now stores).
  This is a deliberate, scoped behaviour change (B24 closes B21); the
  spec-writer flags it here so the test-writer / reviewer knows to update
  exactly this assertion, and only this one, in B20's test file. (Strictly,
  B20-R2's "second scenario" wording in the B20 spec talks about _count_ on
  the no-source default-mode follow-up; B24 changes the expected value at
  that exact line — see Open questions, "B20-R2 second scenario expected
  count change".)
- B39's call-order-independence tests
  ([tests/unit/core/call-order-independence.test.ts](../../tests/unit/core/call-order-independence.test.ts))
  — `generateAdHoc`'s `nextSchemaSlot(schema)` call is preserved; the
  per-schema-slot semantics survive the refactor unchanged.

- Scenario: full suite + B24 regression test green
  GIVEN B24 implemented end-to-end (R1 through R7) + the B21 regression test
  added (R7) + the one B20-R2 second-scenario assertion updated (R8)
  WHEN `pnpm test` is run
  THEN it exits 0; all existing tests pass with no other assertion changes;
  the new B21 regression test passes.

### B24-R9: D1 / D5 — internal-only refactor, no `any`, no public API change

The decomposition MUST NOT introduce any `any` types beyond the existing
`(options as any)?.source` cast at the dispatcher (which is preserved by the
refactor — B7-R5 explicitly keeps the input/output type story intact for the
`source` field). The four new private methods MUST have explicitly typed
parameters and return `unknown`. No new public API MUST be added to the
`World` interface, to `WorldImpl`, or to `GenerateOptions`. `docs/api-reference.md`
MUST NOT need to be updated — there is no public-contract change. (D5 is not
triggered.) `derivedPairCounter` semantics MUST be unchanged: it MUST be
incremented exactly once at the dispatcher's top (today's line 1346) and
read exactly once at the no-source pair-pick site (today's line 1474, now
inside `generateDerivedAutoSource`), with the B8-R9 rollback preserved.

- Scenario: typecheck clean, no new `any`
  GIVEN B24 implemented
  WHEN `pnpm typecheck` is run
  THEN it exits 0; a `grep` for `: any` or `as any` inside the four new
  methods finds no occurrences beyond what already existed pre-B24 (notably
  the `sourceOverride = (options as any)?.source` cast in the dispatcher,
  preserved verbatim).

- Scenario: `docs/api-reference.md` unchanged
  GIVEN B24 implemented and committed
  WHEN the diff of `docs/api-reference.md` is inspected against the pre-B24
  commit
  THEN there is no change — B24 is internal-only and triggers no D5
  documentation update.

### B24-R10: changeset entry — `minor` bump

A changeset MUST be created at
`.changeset/b24-decompose-generate-single-item.md` recording B24 as a
`"zod4-mock": minor` bump. The body MUST summarise:

- (a) the internal refactor (`generateSingleItem` decomposed into four named
  private methods; behaviour-neutral for the with-source / primary / ad-hoc
  branches);
- (b) the behaviour change in the no-source-derived path: `world.generate(D)`
  on a `from:`-registered schema with no `source` now stores the derived
  record by default (closes B21), symmetric with `world.generate(D, {
source })`;
- (c) the unchanged opt-out semantics — `{ store: false }` still suppresses
  the new store call, B10's contract intact;
- (d) the user-visible upgrade implication — `world.registry.count(D)` after
  a loop of `world.generate(D)` calls now equals the call count (was 1 for
  any N > 0). Existing consumers who relied on "no-source generate is
  ephemeral" should call `world.generate(D, { store: false })` explicitly,
  or upgrade their usage to `populate` / `populateFrom`.

The changeset MUST include `(closes B21)` on its final line to mark the
internal-card closure. The card does not carry a GitHub issue, so a `(closes
#N)` reference is not required.

The bump choice is **`minor`**, not `patch`, because the B21 fix is an
observable behaviour change at a public API surface
(`world.registry.count(DerivedSchema)` after `world.generate(DerivedSchema)`
goes from 1 to N over a loop of N calls). Even though the change is
narrowly scoped to the no-source-derived path, it is the same shape of
"narrow but observable behaviour shift" that B20 was published under
`patch`. The judgement here leans `minor` rather than `patch` because:

- the B21 card itself flagged this as a `patch`-vs-`minor` judgement call
  ("changes observable behaviour for any user who has relied on 'no-source
  generate is ephemeral'");
- the symmetric "derived generate stores by default" mental model is the
  documented intent of B8 / B19, and B24's R3 brings the no-source path into
  line with that intent — which is the kind of behaviour-aligning fix that
  warrants `minor` over `patch` to signal "your registry counts may change";
- the refactor itself is behaviour-neutral and would be `patch`, but the
  paired B21 closure makes the whole item observable.

The spec-writer's recommended bump is **`minor`**; the implementer MAY argue
`patch` if the user explicitly accepts the narrower framing during review.
See Open questions.

- Scenario: changeset file exists with `minor` bump and `(closes B21)` reference
  GIVEN B24 implemented
  WHEN `.changeset/b24-decompose-generate-single-item.md` is read
  THEN its frontmatter declares `"zod4-mock": minor`; the body summarises
  (a)-(d) above; the final non-empty line is `(closes B21)`.

## Out of scope

- **Extracting `resolveMode(schema): SchemaMode` for cross-method dispatch
  unification** — that is **B25**'s job. B24 keeps the dispatcher's
  `findDerivedRegs` / `findPrimaryRegs` cascade as-is. B25 will refactor that
  dispatch across `generateSingleItem`, `generateArray`, `populate`, and
  `populateFrom`; pre-empting it inside B24 would conflate two refactors and
  block B24 on a wider design discussion.
- **Decomposing `generateArray`** — that is B22's proposed item #7 (covered in
  the same audit pass as B24, but a separate piece of work). The B22 audit
  ranks `generateArray` as Dim 1 #7 / Dim 3 #3; it has three mode-pipelines of
  its own and a parallel set of asymmetries. B24 does not touch
  `generateArray`.
- **Splitting `src/world.ts` into multiple files** — B22's proposed item #6
  / B28. B24's four new methods stay inside `world.ts`, on `WorldImpl`.
- **Changing the `derivedPairCounter` semantics** — that semantic is the B39 /
  D10 contract for the derived-without-source round-robin. B24 preserves the
  increment site, the read site, and the B8-R9 rollback exactly as today.
- **Adding a public API to "store the derived record explicitly" on the
  no-source path** — B21's fix is implicit by default. There is no new
  `unique` / `forceStore` / `markEphemeral` flag; consumers who want
  ephemeral derived records use `{ store: false }` (B10).
- **Public API for the four new methods** — they remain `private`. Callers
  who need direct access (e.g. for testing) should drive through
  `world.generate(schema, options)` exactly as today.
- **Rewriting `generateObjectFields` / `generateAndStorePrimary` /
  `generateDerivedRecord`** — those helpers are unchanged by B24. Only their
  callers move.
- **Promoting any standing constraint to a new ADR** — B24 establishes no new
  Rules. The Rules it preserves (D1, D3, D4, D5, D6, D8, D9, D10) are already
  binding. No `wiki/decisions.md` entry is added.
- **Updating `wiki/codebase-map.md`** — the file-level view of `world.ts` is
  unchanged; the four new private methods are internal to the class. A
  follow-up `/wiki-sync` is not required for this item.

## Open questions

- **Where the B8-R9 `derivedPairCounter--` rollback lives — Non-blocking.**
  Default: keep it in `generateWithSourceOverride` (the helper rolls back
  before returning the cached value), mirroring today's structure. The
  alternative — rolling back in the dispatcher after the helper returns the
  cached value — is observationally equivalent because the dispatcher
  incremented the counter at the top. The choice is internal readability;
  the implementer picks. Recorded; not blocking.

- **`generateAdHoc` parameter shape — `(schema, targetSchema, options)` vs
  `(schema, options)` with internal lazy-resolve — Non-blocking.** Default:
  caller passes both `schema` (for the B39 per-schema slot) and `targetSchema`
  (post-lazy-resolve, for routing on `def(targetSchema).type === "object"`).
  The alternative — having `generateAdHoc` redo the lazy-resolve internally —
  duplicates the dispatcher's existing `while` loop; the spec rejects that
  duplication. The dispatcher already holds both references; passing both is
  the cleaner shape. Recorded; not blocking.

- **`generatePrimary` accepting `primaryReg` directly vs rediscovering it —
  Non-blocking.** Default: accept (the caller has it). Rediscovery would
  require re-running `findPrimaryRegs(schema)` inside the helper, duplicating
  work. The dispatcher already paid for the lookup; passing the result through
  is correct. Recorded; not blocking.

- **B20-R2's second-scenario count change in B20's test file — Non-blocking.**
  B20-R2's second scenario asserts
  `world.registry.count(Derived) === 0` after a follow-up default-mode call.
  Under B24's R3, that assertion becomes
  `world.registry.count(Derived) === 1` (the no-source default-mode path now
  stores). The test-writer MUST update exactly that one assertion in
  [tests/unit/store-false-empty-from.test.ts](../../tests/unit/store-false-empty-from.test.ts)
  to match the new B24 behaviour, and the reviewer MUST confirm no other
  assertion in that file changes. Recorded as a non-blocking note for the
  pipeline downstream; the change is scoped, predictable, and follows from
  R3 directly. (This is not a regression of B20 — B20's job was the
  `store: false` empty-from crash fix, which R3 leaves intact under the
  `if (this.effectiveStore)` gate.)

- **Changeset bump — `minor` vs `patch` — Non-blocking.** Default: **`minor`**
  per B24-R10's rationale. The implementer MAY argue `patch` if the user
  explicitly accepts that framing during review, but the spec-writer
  recommends `minor` because `world.registry.count(DerivedSchema)` after a
  loop of `world.generate(DerivedSchema)` calls now equals the call count
  (was 1 for any N > 0). That is observable at a public API surface, even if
  narrowly scoped. Recorded; not blocking.

- **Whether the dispatcher's trailing `if (options?.overrides) result =
deepMerge(...)` line MAY be inlined into `generateAdHoc` and removed from
  the dispatcher entirely — Non-blocking.** Default: leave it in the
  dispatcher. The line is a no-op for the three non-ad-hoc branches today
  (their helpers already handled overrides), so leaving it where it is
  preserves the cleanest "dispatcher applies the trailing block, helpers do
  their own thing" mental model. Inlining it would be a micro-optimisation
  that the implementer MAY pursue if the resulting code reads cleaner;
  observationally neutral. Recorded; not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
