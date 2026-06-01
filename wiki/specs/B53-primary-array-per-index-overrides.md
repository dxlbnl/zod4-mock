# B53: BUG — per-index `options.overrides` on primary-registered array schemas throws instead of applying

## Context

User-reported:

> the `generate` call does not cleanly use overrides, per index overrides don't work
> on primary-registered schemas. Why not? Analyze if they dont, and check why (if so) I
> want overrides to work reliably across all paths.

Concretely, `world.generate(PrimarySchema.array(), { overrides: [obj0, obj1, …] })`
throws at [src/world/engine.ts:1369-1374](../../src/world/engine.ts#L1369) — the B38
guard ([B38](B38-primary-array-overrides-dropped.md)). The same call shape works on
all four sibling dispatch paths today:

- **ad-hoc arrays** ([src/world/engine.ts:1449-1455](../../src/world/engine.ts#L1449))
  — `result.map((item, i) => deepMerge(item, overrides[i]))` post-generation.
- **derived arrays** ([src/world/engine.ts:1342-1350](../../src/world/engine.ts#L1342))
  — same pattern, added by B52-R4.
- **single records** (`generate(S, { overrides: {…} })`) — flows through
  `generateAndStorePrimary` → `generateObjectFields` at **field-level** via PIPELINE
  step 0 (the B12 contract).
- **`populate(S, N, factory)`** — the factory's per-record `overrides` flow through
  `generateAndStorePrimary` per record at
  [src/world/engine.ts:642](../../src/world/engine.ts#L642).

So primary arrays are the **only** path where per-index overrides don't work. The B38
throw was a temporary compromise: it loudly refused a call shape that was silently
broken pre-B38. The natural fix at the time — apply overrides INSIDE
`generateAndStorePrimary` so the stored record is the merged record — was not pursued
because the team accepted "use `populate` instead" as the canonical workaround and kept
B38 surgical. That history is now stale: B52 unified the three array arms under
[D14](../decisions.md#d14-all-generatearray-mode-arms-share-the-same-trailing-pass),
and the "or throw" carveout in D14's wording ("cap → overrides **or throw** → transform")
is the only remaining cross-arm asymmetry on this surface.

The infrastructure to "make it work cleanly under D8" already exists.
`generateAndStorePrimary` already accepts `options?: GenerateOptions<unknown>` and
applies `options.overrides` at field-level via `generateObjectFields` at
[src/world/engine.ts:1152-1160](../../src/world/engine.ts#L1152) **before**
`registry.store` — `populate(S, N, factory)` exercises this path every day with no D8
violation ([D8](../decisions.md#d8-registry-storage-equals-generates-return-value-for-registered-schemas)
holds by construction: the field-level merge happens on the value about to be stored,
so stored = returned). B53 wires the primary array branch's two loops (store-on `while`
and store-off `Array.from`) to pass `{ overrides: options.overrides[i] }` per record to
`generateAndStorePrimary`, lifts the B38 throw, and amends D14 to drop the "or throw"
carveout. No public API surface change.

Item card:
[wiki/backlog/doing/B53-primary-array-per-index-overrides.md](../backlog/doing/B53-primary-array-per-index-overrides.md).
GitHub issue: none — user reported conversationally.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Composition with shipped Rules

- **D1** — no `any`; the new code reads `options.overrides[i]` (typed `unknown[] |
undefined`) and passes it through the existing
  `options?: GenerateOptions<unknown>` parameter. No new `any` needed.
- **D5** — `docs/api-reference.md` is updated in the same step. The B38-era wording on
  line 316 (`.generate` array-return bullet) and line 341 (`GenerateOptions.overrides`
  paragraph) describes the throw — both MUST be rewritten to describe the new
  apply-the-override behaviour. Audited under R7.
- **D6** — regression test. The exact user-reported call shape (per-index overrides on
  a primary-registered array) gets a test under `tests/unit/` asserting the override
  lands (R1 scenario).
- **D8** — preserved by construction. The field-level merge happens inside
  `generateAndStorePrimary` **before** `registry.store(schema, result)`, so the value
  written to the registry equals the value returned. No post-pipeline deep-merge slot
  is added on the primary arm — the eager step 0 / matcher-aware deep-merge inside
  the per-record `generateObjectFields` call IS the merge slot. This matches how the
  `populate` path already operates.
- **D10** — no new PRNG draws. The per-record `generateAndStorePrimary` invocation
  already forks its own `recordPrng` from `(seed, recordId)` per
  [src/world/engine.ts:1149](../../src/world/engine.ts#L1149); passing `options`
  through changes no PRNG seeding. Determinism is preserved per
  `(seed + schema identity + per-schema call index)`.
- **D11** — `PIPELINE` is untouched. The per-field eager-override step 0 + the matcher
  deep-merge step (B12) inside `generateObjectFields` is what the new behaviour
  reuses; the `PIPELINE` list itself is not edited.
- **D14** — amended under R5. The "or throw per B38 on primary-registered inner
  schemas" carveout in the current Rules line and ADR entry is removed; all three
  mode arms apply the same trailing pass uniformly.

### Composition with sibling specs

- **B12** ([B12-nested-override-skips-matcher.md](B12-nested-override-skips-matcher.md))
  — the field-level deep-merge semantics for object overrides. The per-record
  `generateObjectFields` call already routes object overrides through B12-R1/R5 (matcher
  → deep-merge) and B12-R3 (primitive/array/null override → replace). B53 reuses these
  semantics unchanged.
- **B38** ([B38-primary-array-overrides-dropped.md](B38-primary-array-overrides-dropped.md))
  — the throw B53 lifts. B38-R1 is **superseded** by B53-R1; B38-R2 (empty/absent
  overrides byte-equivalence) is **preserved** by construction — the new code only
  branches on `options.overrides` when it is an array with `length > 0`, and even then
  passes `undefined` for positions where `overrides[i]` is missing. B38's documentation
  language (R6/R7) is rewritten under R7/R8 here.
- **B52** ([B52-generate-array-dispatch-inconsistencies.md](B52-generate-array-dispatch-inconsistencies.md))
  — the trailing-pass unification across arms. B53 completes it by removing the only
  remaining asymmetry (the throw); the cap → overrides → transform ordering is
  preserved on all three arms.
- **B43 / B44** — the primary-arm `callerMax` slice (B43) and `store: false`
  `Array.from` (B44) survive intact. B53 plumbs `options.overrides[i]` into both the
  `Array.from` (store-off, line 1401) and `while`-loop (store-on, line 1405) calls to
  `generateAndStorePrimary` — neither the callerMax slice nor the no-infinite-loop
  property changes.
- **B10** — `effectiveStore` transitive suppression. Untouched; the
  `generateAndStorePrimary` body already gates `registry.store` under
  `this.effectiveStore` at line 1165.
- **B14** ([B14-world-populate-factory.md](B14-world-populate-factory.md)) — the
  `populate(S, N, factory)` per-record-override path. After B53, `world.generate` of a
  primary array IS observably equivalent to a fresh `populate(S, N, () => ({ overrides:
overrides[i] }))` for the freshly-generated tail, with the documented edge case
  around pre-existing records pinned in R3.

## Decision (R3 resolution)

The item card flags **one open question** the spec-writer must pin: when
`existingCount > 0` (the registry has pre-populated records) AND `overrides.length > 0`,
should the first `min(existingCount, overrides.length)` returned records be re-fetched
with overrides applied, or returned untouched?

**Pinned semantic: overrides apply only to records produced by the loop (positions
`[existingCount, target)`); pre-existing records at positions `[0, existingCount)` are
returned untouched.** Justification:

1. **D8 — stored equals returned.** Pre-existing records were stored at their previous
   `generate` / `populate` call. The registry holds those exact values. Re-fetching
   them with overrides applied would either (a) return a value distinct from what the
   registry stores — re-violating D8 — or (b) require mutating registry storage to
   reflect the override, which is over-broad scope creep (the registry is a
   write-once-per-record store and rewriting it under a `generate` call would
   invalidate every existing reference picked up via `registry.all` / `registry.find`).
2. **Natural read for the caller.** Users think of overrides as "values I want applied
   to records I'm about to produce." A registry that already contains records is a
   prior contract those records agreed to; the current call is producing additional
   records that catch up to `target`. The override array's index `i` aligns to the
   `i`-th newly-produced record (i.e. position `existingCount + i_loop` in the
   returned array). This matches the `populate(S, N, factory)` mental model exactly,
   where the factory's per-record options apply to the `i`-th record **produced by this
   call**, not to records already in the registry.
3. **No silent re-emission of merged tombstones.** The alternative — return a fresh
   object that merges `overrides[i]` over `registry.all()[i]` but stores nothing — was
   explicitly rejected by D8 at B38 time and is rejected again here for the same
   reason.

**Implementer guidance (non-binding, per item-card sketch).** Both loops read the
override slot at the position currently being filled in the registry:

```ts
// store-on (line 1405)
while (this.registry.count(innerSchema) < target) {
  const i = this.registry.count(innerSchema); // index of the record about to be produced
  this.generateAndStorePrimary(innerSchema, mode.reg, {
    overrides: options?.overrides?.[i] as Record<string, unknown> | undefined,
  });
}

// store-off (line 1401)
primaryResult = Array.from({ length: storeOffLength }, (_, i) =>
  this.generateAndStorePrimary(innerSchema, mode.reg, {
    overrides: options?.overrides?.[i] as Record<string, unknown> | undefined,
  }),
);
```

In the store-on path with `existingCount > 0`, the loop's first iteration reads
`overrides[existingCount]` (because `i = registry.count = existingCount` on entry), so
overrides applied to "freshly-generated records" naturally start at index
`existingCount` in the override array. This is the convention pinned by R3 — the
override array is indexed in the **returned array's coordinate system**, with the
contract that positions `< existingCount` are pre-existing and ignore their override
slots.

## Requirements

### B53-R1: per-index overrides MUST apply to records freshly produced by the primary array branch

`WorldImpl.generateArray`'s primary-mode arm
([src/world/engine.ts:1362-1426](../../src/world/engine.ts#L1362)) MUST apply
`options.overrides[i]` (when present and an object) to the record produced at position
`i` in the returned array, via the existing `generateAndStorePrimary` field-level
merge path (PIPELINE step 0 + B12-R1/R5 deep-merge on top of matcher results). The
merge MUST happen **before** `registry.store(schema, result)` inside
`generateAndStorePrimary`, so the stored record equals the returned record
([D8](../decisions.md#d8-registry-storage-equals-generates-return-value-for-registered-schemas)
holds by construction). The B38 throw at
[src/world/engine.ts:1369-1374](../../src/world/engine.ts#L1369) MUST be removed.

The override semantics for each record are exactly the
field-level semantics already pinned by B12: a plain-object `overrides[i]`
deep-merges with the matcher / key-map / heuristic / schema-based result per field;
primitive, `null`, or array sibling-field overrides replace verbatim; missing fields in
`overrides[i]` are preserved from the generated record. No new merge variant is
introduced.

- Scenario: fresh world + primary array + per-index object overrides — overrides land
  GIVEN
  ```ts
  const Person = z.object({ id: z.string(), name: z.string() });
  const world = createWorld({ seed: 1 }).withSchema(Person);
  ```
  WHEN the consumer calls
  ```ts
  const result = world.generate(Person.array().length(3), {
    overrides: [{ name: "alice" }, { name: "bob" }, { name: "carol" }],
  });
  ```
  THEN `result.length === 3` AND `result.map((p) => p.name)` deep-equals
  `["alice", "bob", "carol"]` AND `world.registry.all(Person).map((p) => p.name)`
  deep-equals `["alice", "bob", "carol"]` — every returned record was stored before it
  was returned, with the override merged at field-level (D8 by construction). The
  sibling `id` field on each record is a non-empty string from the schema-based
  generator (B12-R1 sibling preservation).

### B53-R2: extra and short override arrays MUST follow ad-hoc / derived parity

When `options.overrides.length > result.length`, the extra entries MUST be silently
ignored (matching the ad-hoc branch's behaviour at
[src/world/engine.ts:1449-1455](../../src/world/engine.ts#L1449) and the derived
branch's behaviour at
[src/world/engine.ts:1344-1350](../../src/world/engine.ts#L1344) — both rely on
`overrides[i] === undefined` for out-of-range indices and skip via a conditional).
When `options.overrides.length < result.length`, only positions `< overrides.length`
are merged; positions `>= overrides.length` produce records with no override applied.

- Scenario: overrides shorter than result — tail positions are matcher-generated
  GIVEN the same `Person` schema and a fresh `createWorld({ seed: 1 }).withSchema(Person)`
  WHEN the consumer calls

  ```ts
  const result = world.generate(Person.array().length(5), {
    overrides: [{ name: "a" }, { name: "b" }],
  });
  ```

  THEN `result.length === 5` AND `result[0].name === "a"` AND `result[1].name === "b"`
  AND for `i in {2, 3, 4}`, `result[i].name` is a non-empty string distinct from
  `"a"` / `"b"` (i.e. a schema-generated value).

- Scenario: overrides longer than result — extras ignored
  GIVEN the same `Person` schema and a fresh `createWorld({ seed: 1 }).withSchema(Person)`
  WHEN the consumer calls
  ```ts
  const result = world.generate(Person.array().length(2), {
    overrides: [{ name: "a" }, { name: "b" }, { name: "c" }],
  });
  ```
  THEN `result.length === 2` AND `result.map((p) => p.name)` deep-equals `["a", "b"]`
  (the third entry is silently discarded; no throw).

### B53-R3: pre-existing records MUST be returned untouched; overrides apply only to records produced by this call

When `existingCount = this.registry.count(innerSchema) > 0` on entry to the
primary-mode arm AND `options.overrides.length > 0`, the records at returned-array
positions `[0, existingCount)` MUST be returned **byte-equivalent** to
`this.registry.all(innerSchema).slice(0, existingCount)` — i.e. the stored values, no
override applied. Overrides MUST be applied only to records produced by the loop —
positions `[existingCount, target)` in the returned array, indexed against the
override array at the same positions.

Equivalently: the loop reads `options.overrides[i]` where `i` is the index of the
record currently being produced (which equals `this.registry.count(innerSchema)` at
the start of each store-on iteration, and `existingCount + loopIndex` in the store-off
`Array.from`). Override slots at indices `< existingCount` are never consulted — they
correspond to records that already existed and whose registry-stored values D8 binds
us to return unchanged. This pinning is one of two natural readings — see **Decision
(R3 resolution)** above for the justification.

- Scenario: existing records + per-index overrides — tail positions carry overrides, head positions untouched
  GIVEN
  ```ts
  const Person = z.object({ id: z.string(), name: z.string() });
  const world = createWorld({ seed: 1 }).withSchema(Person);
  world.populate(Person, 5); // five pre-existing records, seeded names
  const baselineHead = world.registry
    .all(Person)
    .slice(0, 5)
    .map((p) => p.name);
  ```
  WHEN the consumer calls
  ```ts
  const result = world.generate(Person.array().length(8), {
    overrides: [
      { name: "a" },
      { name: "b" },
      { name: "c" },
      { name: "d" },
      { name: "e" },
      { name: "f" },
      { name: "g" },
      { name: "h" },
    ],
  });
  ```
  THEN `result.length === 8` AND `result.slice(0, 5).map((p) => p.name)` deep-equals
  `baselineHead` (pre-existing records untouched; the override slots 0..4 are
  ignored), AND `result.slice(5).map((p) => p.name)` deep-equals `["f", "g", "h"]` (the
  three freshly-generated records at positions 5..7 carry the override at their own
  array index), AND `world.registry.count(Person) === 8`, AND
  `world.registry.all(Person)` deep-equals `result` (D8 by construction —
  stored = returned).

### B53-R4: `options.transform` MUST run after overrides on the primary array path

`WorldImpl.generateArray`'s primary-mode arm MUST apply `options.transform` (the
trailing per-element pass at
[src/world/engine.ts:1420-1424](../../src/world/engine.ts#L1420)) to each record
**after** the per-index override has been merged in by
`generateAndStorePrimary`. This is the existing B52-R3 ordering on this arm; B53 only
adds the override step **before** the transform step, in the same arm, in the order
D14 pins (cap → overrides → transform). The transform sees the override-merged value.

The transform pass and the per-record override path remain composable on both the
store-on `while` path and the store-off `Array.from` path
(the same trailing pass applies on both, matching B52-R3).

- Scenario: overrides + transform compose on the primary array path
  GIVEN
  ```ts
  const Person = z.object({ id: z.string(), name: z.string() });
  const world = createWorld({ seed: 1 }).withSchema(Person);
  ```
  WHEN the consumer calls
  ```ts
  const result = world.generate(Person.array().length(2), {
    overrides: [{ name: "x" }],
    transform: (p) => ({ ...p, hidden: true }),
  });
  ```
  THEN `result.length === 2` AND `result[0].name === "x"` AND
  `result[0].hidden === true` AND `result[1].name` is a non-empty string (no override
  at position 1) AND `result[1].hidden === true` — the transform applied to every
  record after overrides, on both the override-carrying and the override-free
  positions.

### B53-R5: D14 MUST be amended to drop the "or throw" carveout

The Rules line in `wiki/architecture.md` describing the trailing-pass discipline (D14)
MUST be rewritten to remove the "or throw per B38 on primary-registered inner schemas"
carveout. The new wording MUST read (approximately):

> All `generateArray` mode arms (derived, primary, ad-hoc) **MUST** apply the same
> trailing pass in the same order: cap to `callerMax ?? defMax`, apply per-index
> `options.overrides` (deepMerge per record), then apply `options.transform`. New
> behaviour added to one arm **MUST** be added to all three. (→ D14)

The corresponding ADR entry at `wiki/decisions.md` D14 MUST be amended in place: the
"(or throw per B38 on primary-registered inner schemas)" parenthetical removed and a
short note appended that B53 lifted the throw and unified the arms. The recommendation
is **amend in place** (not supersede with D15), because the carveout was always meant
to be temporary — the B53 lift is the resolution D14's parenthetical was a placeholder
for. Supersession with D15 would add audit noise without value: the standing
constraint (all arms share the trailing pass) has not changed, only the implementation
of one arm has. Manager confirms at close (see Open questions Q2).

The manager performs the Rules edit and the ADR edit at item close — spec-writer
records the wording and rationale here; subagents (test-writer / implementer) do not
touch `architecture.md` or `decisions.md` themselves.

- Scenario: D14's Rules line and ADR have the carveout removed
  GIVEN B53 is closed and the manager has performed the Rules promotion
  WHEN `wiki/architecture.md`'s Rules section and `wiki/decisions.md`'s D14 entry
  are read
  THEN the D14 Rules line MUST NOT contain the substring "or throw" AND the D14 ADR
  Decision section MUST mention "B53 lifted the throw" (or equivalent wording) AND no
  D15 entry MUST exist that supersedes D14 (unless the manager elected supersession at
  close — see Q2).

### B53-R6: the B38 throw test MUST be rewritten or replaced

The existing `tests/unit/primary-array-overrides-throw.test.ts` central assertion is
`expect(() => world.generate(...)).toThrow(/world\.populate\(schema, count, factory\)/)`
for the B38-R1 and B38-R5 scenarios. Under B53-R1, this call shape no longer throws —
it applies the override and returns the merged array. The test file MUST be either:

- **Deleted** in favour of a new `tests/unit/B53-primary-array-overrides.test.ts`
  whose per-R-ID tests assert the apply-the-override semantics. The recommendation is
  **delete + new file**, since the semantics being asserted are inverted and a
  rewrite-in-place leaves a misleading filename (`-throw` for a file that asserts
  no-throw). The test-writer's call.
- **Rewritten in place** with inverted assertions and a new file-level docstring; the
  filename is renamed to `tests/unit/B53-primary-array-overrides.test.ts` to avoid
  the misleading `-throw` suffix.

The B38-R2 / B38-R3 / B38-R4 byte-equivalence and ad-hoc / populate guards MUST be
preserved (either folded into the new file or kept in their own file) — they assert
properties B53 does not change. The reviewer audits the test-file delta to confirm
the old file's `-throw` assertions are gone and the new file's apply-the-override
assertions cover R1-R4 + R3-edge.

- Scenario: the B38 throw test is gone and the B53 behaviour test covers R1-R4
  GIVEN B53 implemented
  WHEN `pnpm test` is run from the repo root
  THEN either (a) `tests/unit/primary-array-overrides-throw.test.ts` no longer exists
  AND `tests/unit/B53-primary-array-overrides.test.ts` exists with tests covering R1,
  R2 (short + long), R3, and R4 — OR (b) the rewritten file exists with the new
  filename and the inverted assertions — AND the full test suite passes.

### B53-R7: `docs/api-reference.md` MUST be updated in the same step

Per [D5](../decisions.md#d5-documentation-lives-in-docs-update-on-api-change), when a
public-API observable behaviour changes, `docs/api-reference.md` MUST be updated in
the same step. The B38 wording in two places MUST be removed or rewritten:

1. The `.generate` array-return bullet at
   [docs/api-reference.md:316](../../docs/api-reference.md#L316). Today's wording
   parenthetically reads "(per-index `overrides` → see `.populate` for
   primary-registered inner schemas; …)". The "per-index overrides → see .populate"
   redirect MUST be removed; the surviving wording MUST note per-index overrides apply
   uniformly across primary / derived / ad-hoc arrays via field-level deep-merge
   (matching the new `GenerateOptions.overrides` paragraph wording).
2. The `GenerateOptions.overrides` paragraph at
   [docs/api-reference.md:341](../../docs/api-reference.md#L341). Today's wording
   ends: "**Note**: per-index `overrides` on a **primary-registered** array schema
   (`world.generate(RegisteredSchema.array(), { overrides: [...] })`) **throw** —
   use `world.populate(schema, count, factory)` to per-record-override a registered
   schema." The throw note MUST be removed and replaced with a sentence describing
   the new behaviour: per-index `overrides[i]` deep-merges into the i-th returned
   record on every array dispatch arm (primary / derived / ad-hoc); on
   primary-registered arrays with pre-existing registry records, override slots at
   indices `< existingCount` are ignored (records already stored under D8 are
   returned untouched; overrides apply to freshly-generated records — R3).

The `.populate` subsection (line ~362) MAY keep its existing per-record-override
example as the documented way to override **every** record (including pre-existing
ones, by triggering fresh generation); no rewrite of `.populate` is required. The
auditor (implementer at re-dispatch) reports either "edits applied at lines X-Y" or
"wording was already current under the new semantic" — the reviewer confirms.

- Scenario: docs reflect the lifted throw
  GIVEN B53 applied
  WHEN `docs/api-reference.md` is read at the two anchor sections
  THEN the `.generate` array-return bullet at line ~316 does NOT contain the
  parenthetical "per-index `overrides` → see `.populate` for primary-registered inner
  schemas" AND the `GenerateOptions.overrides` paragraph at line ~341 does NOT
  contain the "**Note**: per-index `overrides` on a **primary-registered** array
  schema … **throw**" sentence AND the new wording describes the apply-the-override
  semantics that B53 ships.

### B53-R8: changeset entry — patch bump

A changeset file at `.changeset/b53-primary-array-per-index-overrides.md` MUST be
added in the same step. The frontmatter MUST declare a **patch** bump for `zod4-mock`.
Rationale: the throw being lifted is a **softening** — the call shape that previously
errored now works correctly with the natural deep-merge semantics every sibling arm
already used. No public-API surface change (no new method, no new option, no signature
change); the runtime behaviour change is "call that errored now succeeds, with
observably consistent semantics." This is the classic patch-bump shape.

The changeset body MUST summarise the bug (per-index overrides on primary-registered
array schemas threw instead of applying) and describe the new behaviour (overrides
deep-merge at field-level per record via `generateAndStorePrimary`; pre-existing
records untouched per R3; D8 preserved by construction). No `(closes #N)` line — user
reported conversationally.

- Scenario: changeset exists with the right bump and content
  GIVEN B53 applied
  WHEN `.changeset/b53-primary-array-per-index-overrides.md` is read
  THEN its frontmatter contains `"zod4-mock": patch` AND its body summarises the
  bug (per-index overrides threw on primary-registered arrays) and the new
  apply-the-override behaviour (deepMerge per record; D8 preserved).

## Tests

Per [[feedback-minimal-tests]] + [[feedback-tests-test-behavior]]: **one test per
behavioural R-ID** + the R3 edge case as its own test. R5 / R7 / R8 are
reviewer-only. R6 is a delta-audit verifying the old throw test is gone or rewritten;
no separate test needs to be authored for it. Net **5 behaviour tests + 3
reviewer-only verifications** = **8 R-IDs**, **5 tests**.

One file: `tests/unit/B53-primary-array-overrides.test.ts` (recommended over rewriting
the old file in place — the assertion semantics are inverted, the file rename keeps
the test-file delta auditable). The test-writer MAY rewrite in place if they prefer;
the file-name choice is non-binding (the reviewer audits the delta either way).

| Test | Covers | Scenario shape                                                       | Asserts                                                                                                              |
| ---- | ------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | R1     | fresh world + `Person.array().length(3)` + 3 overrides               | returned names match overrides; `registry.all(Person)` matches returned array (D8)                                   |
| 2    | R2     | overrides shorter (length 5 / 2 overrides) AND longer (length 2 / 3) | two `expect`s in one test: short — positions 0-1 carry overrides, 2-4 schema-generated; long — length 2, extras gone |
| 3    | R3     | `populate(Person, 5)` then `generate(Person.array().length(8), …)`   | positions 0-4 byte-equal pre-existing; positions 5-7 carry `overrides[5..7]`; `registry.count(Person) === 8`; D8     |
| 4    | R4     | `Person.array().length(2)` + `[{name:"x"}]` + `transform`            | position 0 has `name === "x"` AND `hidden === true`; position 1 has schema name AND `hidden === true`                |
| 5    | R6     | (delta-audit only)                                                   | reviewer Read: old throw test deleted or rewritten with inverted assertions                                          |

R5 (D14 amendment), R7 (docs), R8 (changeset) are reviewer-only — verified via Read
on the diff. The reviewer audit list is:

- **R5** — `wiki/architecture.md` Rules line for D14 has the "or throw" carveout
  removed; `wiki/decisions.md` D14 entry is amended in place (or superseded by D15 if
  the manager elects supersession at close).
- **R6** — `tests/unit/primary-array-overrides-throw.test.ts` is gone or renamed
  with inverted assertions; no test file still asserts the throw.
- **R7** — `docs/api-reference.md` lines ~316 and ~341 have the B38-throw wording
  removed and replaced.
- **R8** — `.changeset/b53-primary-array-per-index-overrides.md` exists with
  `"zod4-mock": patch` and the required body content.

Test-writer MUST NOT enumerate beyond five tests. There is no `(seed × callerMax ×
existingCount × overrides-length)` Cartesian to walk — the matrix above pins exactly
the cells that prove each behavioural R-ID.

## Out of scope

- **Per-index overrides on `populate(S, N, factory)`** — already work correctly via
  the factory's per-record `GenerateOptions`; no change.
- **`world.populate(S, N)` without a factory** — already works correctly; no change.
- **The `world.generate(S, { overrides: {…} })` single-record path** — already works
  correctly via `generateAndStorePrimary` field-level merge; no change.
- **Changing what an "override" means at the field level (B12 / PIPELINE step 0)** —
  unchanged. B53 reuses the existing `generateObjectFields` merge semantics; it does
  not introduce a new merge variant.
- **Changing the derived or ad-hoc paths' override handling** — both already work
  (ad-hoc since before B38; derived since B52-R4). B53 only changes the primary arm.
- **Re-fetching pre-existing registry records with overrides applied** — explicitly
  rejected by the R3 resolution above (would violate D8 or require mutating registry
  storage, both out of scope).
- **Mutating registry storage to reflect a `generate`-call override on pre-existing
  records** — a hypothetical "overwrite the stored value with the override-merged
  value" feature would need its own spec and a deliberate D8 revisit; B53 does not
  pursue it.
- **A new `World.regenerate(schema, overrides)` API** — not introduced. Callers who
  want every record (including pre-existing) to be regenerated with overrides should
  construct a fresh world or call `populate(S, N, () => ({ overrides: ... }))` on a
  freshly-`clear()`ed registry (out of scope; existing patterns).
- **The B38 spec page** — manager decides at close whether to mark it "superseded by
  B53" or leave it as a historical record. Not a spec-writer concern.

## Open questions

- **Q1: Should the new test file replace the old one, or both coexist? — Non-blocking.**
  R6 records the recommendation (new file, old file deleted) but leaves the choice to
  the test-writer. Coexisting would mean the old `-throw` filename remains a
  misleading artifact in the tree; deleting is the cleaner audit trail. The reviewer
  confirms the chosen path delivers no surviving `expect(...).toThrow(/world\.populate/)`
  assertion. Recorded; not blocking.

- **Q2: Amend D14 in place vs supersede with D15. — Non-blocking; manager's call at close.**
  R5 records the recommendation (amend in place) with full justification: the
  standing constraint hasn't changed, only the wording of one carveout. `decisions.md`'s
  "never edit a past entry — supersede it" convention argues for supersession; B53
  argues that the parenthetical "(or throw per B38)" was always a placeholder for a
  temporary state, and removing it is closer to a textual cleanup than a substantive
  change of constraint. Either choice is principled. Recorded; the manager makes the
  final call at item close. The test-writer / implementer / reviewer are unaffected
  by which path the manager picks — both produce the same observable change in the
  Rules line.

No blocking open questions remain; the spec can advance to `test-writer`. Net **0
blocking, 2 non-blocking**.

## Notes

- **Anchor reading** — `src/world/engine.ts:1362-1426` (primary array branch — where
  the throw lives, where the two loops are wired); `:1137-1175`
  (`generateAndStorePrimary` — accepts `options?: GenerateOptions<unknown>` already
  and applies field-level merge before `registry.store`); `:1449-1455` (ad-hoc
  post-deepMerge — the reference for "what works"); `:1342-1350` (derived arm
  post-deepMerge — same pattern, post-B52-R4).
- **Bump** — `patch`. The throw being lifted is a softening (call shape that
  previously errored now works correctly with the natural semantic every sibling arm
  used). No public API surface change.
- **Changeset wording sketch** —
  > **patch**: Per-index `overrides` on `world.generate(PrimarySchema.array(), {
overrides: [...] })` now apply (field-level deep-merge per record via
  > `generateAndStorePrimary`) instead of throwing. Pre-existing registry records are
  > returned untouched (D8 preserved); overrides apply to freshly-generated records.
  > Supersedes the B38 throw — all three `generateArray` arms (primary, derived,
  > ad-hoc) now share the same trailing pass (D14 amended).
- **Predecessors** — **B12** (field-level deep-merge of object overrides on top of
  matcher / branch results); **B38** (the throw being lifted); **B52** (unified the
  three arms under D14, leaving the "or throw" carveout as the only asymmetry —
  closed here); **D14** (the standing constraint amended under R5).
- **Composes with** — **D8** (stored = returned: preserved by construction; the
  merge happens inside `generateAndStorePrimary` before `registry.store`); **D10**
  (per-`(seed + schema identity + per-schema call index)` determinism: no new PRNG
  draws); **D14** (amended); **B10** (`effectiveStore` transitive suppression:
  untouched; the existing gate inside `generateAndStorePrimary` continues to apply);
  **PIPELINE step 0** (`overrideEagerStep` / B12's matcher-aware deep-merge: the
  reused merge layer).
- **GitHub issue** — none (user reported conversationally). No `(closes #N)` line
  in the commit message or changeset body.
- **`flags: [review]`** — the item card carries this; the manager pauses for spec
  sign-off before advancing to test-writer.
- **No `node:*` introduced** — D13 satisfied trivially (pure logic in already-shipped
  paths inside `src/world/engine.ts`).
- **No `any`** — D1 satisfied; `options.overrides[i]` is read as `unknown` and cast
  to `Record<string, unknown> | undefined` exactly as the item-card sketch shows,
  matching how `generateAndStorePrimary` already accepts overrides today.
