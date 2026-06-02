# Codebase complexity & consistency re-analysis (2026-06-01)

Audience: the maintainer. Scope: `src/` (engine + generators). Baseline:
[codebase-complexity.md (2026-05-29)](codebase-complexity.md) — read in full; this
report is a **delta**, not a repeat. Cross-checked against
[populate-dispatch-divergence.md](../engine/populate-dispatch-divergence.md) and
[generation-counter-d4-audit.md](../engine/generation-counter-d4-audit.md), and the
done cards B22–B53 in `wiki/backlog/done/`.

Method is identical to the 2026-05-29 report (§Method there): `wc -l` for sizes, a
McCabe proxy = 1 + count of branchy tokens (`if`/`else if`/`case`/`&&`/`||`/`??`/
`while`/`for`/`catch`) via Grep, read-confirmed; nesting by indent; fan-in/out by
import grep. Same thresholds. No tests run, no pnpm invoked, no source modified.

---

## 1. Summary

The 2026-05-29 audit's entire 15-item slate (B23–B37) **landed**, plus a second wave of
consistency fixes (B38–B53). The monolith is gone: `src/world.ts` is now a 15-line
barrel; the engine lives in `src/world/{engine,registration,derived,relations}.ts`. The
per-field pipeline is a real data list ([pipeline.ts](../../../src/pipeline.ts)) shared
by all three object-field call sites. The 38-case router switch is a typed dispatch
table. `applyModifiers`, the lazy-chain, and the optional-unwrap loops are all extracted
helpers. **This is a materially healthier codebase than the baseline.**

What remains is concentrated in one file again: `src/world/engine.ts` at **1748 LOC** —
the largest file in the repo even after the B28 split. It is large because it still owns
**seven stateful concerns** the pure-helper split could not lift (they touch
`WorldImpl`'s private fields). The good news: the heavy functions are now _cohesive_, not
_tangled_ — the accidental complexity that made the old `generateSingleItem` hard is
gone (B24 decomposed it into a thin dispatcher + four named branch helpers).

**Top 4 highest-leverage wins** (priority order):

1. **Split `engine.ts` along the array path.** `generateArray` is now the single
   biggest function (~186 LOC, ~26 branches) with three full mode-pipelines inline. Lift
   the array engine into `src/world/array.ts` (or decompose into
   `generateArrayDerived` / `generateArrayPrimary` / `generateArrayAdHoc`, mirroring what
   B24 did for `generateSingleItem`). Drops engine.ts by ~190 LOC and removes the last
   tangled function. **Size: M.**
2. **Lift `resolveRelationPool` + the relation methods into `world/relations.ts`.**
   The pure _helpers_ moved in B32, but the 100-LOC, ~29-branch `resolveRelationPool`
   method (plus `resolveRelated`/`resolveRelatedMany`/`ensurePrimaryRecord`) stayed in
   the engine "per the B28 pragmatic split." That method is the second-densest in the
   file and is self-contained behind 4 private-state touchpoints — it is the cleanest
   candidate for a `RelationResolver` collaborator object. **Size: M.**
3. **Evict the generator-binding layer into `world/bind-generators.ts`.** This is not a
   "split the engine" win — it is recognising that ~235 LOC (the `CTX_SLOTS` arity table +
   `bindNamespace` + the string-length check helpers, engine.ts:130–460) **are not engine
   logic at all**. They touch no `WorldImpl` state — they're the generator-binding concern
   squatting in the engine file for historical reasons. ≈20% of the file is mis-filed.
   Moving it out is a pure lift (zero `this`, zero behaviour change, confirmable in one
   read) and it makes the file stop lying about its scope: what remains is genuinely the
   engine. **Size: S — do this first.**
4. **Two small correctness/clarity items** flagged in §4: the **stale "populate inverts
   precedence" comments** (registration.ts:111–115, engine.ts:843–851) now contradict the
   B52 code, and the **two `any` casts** in `generateArray`'s ad-hoc tail
   (engine.ts:1445–1453) survived the B26/B36 `any`-purge. Both **XS**.

**Consistency verdict: CONSISTENT, with one _documented-and-intended_ asymmetry and two
_stale-comment_ hazards.** Every cross-cutting option (`overrides`, `transform`, `store`,
`source`, mode-dispatch) is now applied uniformly across the single-item, array,
`populate`, and `populateFrom` paths — the divergences the 2026-05-29 report and B41
flagged were closed by B38/B43/B44/B47/B52/B53. The one remaining asymmetry is **by
design**: `generateZodObject` (nested `z.object` with no registration) walks
`PIPELINE_NO_REGISTRATION` (3 steps) while `generateObjectFields` walks the full
`PIPELINE` (7 steps). That is the intended "ad-hoc nested object has no `SchemaReg`"
contract (B23), not a bug — but it is the one place where "which options apply" depends on
the entry path, so it is documented in the matrix below.

---

## 2. Delta from 2026-05-29

Prior **per-function** hot spots (Dim 1) and **architectural** findings (Dim 4):

| 2026-05-29 finding                               | Item        | Status                               | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ----------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generateFromSchema` 38-case switch              | B26         | **fixed**                            | `DISPATCH: Record<ZodDefType, GenFn>` table, [router.ts:233](../../../src/generators/schema/router.ts#L233); non-trivial arms lifted to named fns                                                                                                                                                                                                                            |
| `applyModifiers` 5-pass string/number blob       | B29         | **fixed**                            | split into `applyStringModifiers` + `applyNumberModifiers`, each pass a named fn, [zod-def.ts:181–339](../../../src/generators/schema/zod-def.ts#L181)                                                                                                                                                                                                                       |
| `generateSingleItem` 164-LOC 4-branch tangle     | B24         | **fixed**                            | now a 77-LOC dispatcher + 4 named branch helpers (`generateWithSourceOverride` / `…AutoSource` / `…Primary` / `…AdHoc`), [engine.ts:1479](../../../src/world/engine.ts#L1479)                                                                                                                                                                                                |
| `generateObjectFields` flat 0-6 `for` body       | B23         | **fixed**                            | walks `PIPELINE` list; body is ~30 LOC, [engine.ts:1211](../../../src/world/engine.ts#L1211)                                                                                                                                                                                                                                                                                 |
| `generateZodString` 22-arm `else if`             | B34         | **fixed**                            | `FORMAT_GENERATORS` table, [string.ts:206](../../../src/generators/schema/string.ts#L206)                                                                                                                                                                                                                                                                                    |
| `generate` triple-loop wrapper strip + lazy      | B31         | **partial**                          | `resolveLazyChain` extracted; the outer optional/nullable strip is still inline in `generate` ([engine.ts:714](../../../src/world/engine.ts#L714)) and re-appears in `explain.ts:53` — minor dup remains                                                                                                                                                                     |
| `generateArray` three mode-pipelines             | —           | **OPEN / regressed in size**         | still inline; now the **largest** function (~186 LOC) after B38/B43/B44/B52 added store-off, caller-max, and per-index-override handling. See §3                                                                                                                                                                                                                             |
| `resolveRelated{,Many}` twin methods             | B32         | **fixed (logic) / open (placement)** | shared `resolveRelationPool` extracted, twins are 6-line wrappers ([engine.ts:976](../../../src/world/engine.ts#L976)); but the 100-LOC pool method stayed _in the engine_                                                                                                                                                                                                   |
| `email` / `lastName` dense generators            | —           | **open (low priority)**              | unchanged; never escalated to a card. Still fine                                                                                                                                                                                                                                                                                                                             |
| `world.ts` 1202 LOC, 7 concerns                  | B28         | **fixed (split) / re-emerged**       | split into `world/*`; but `engine.ts` is now **1748 LOC**. See §3                                                                                                                                                                                                                                                                                                            |
| `types.ts` 430 LOC bundles interfaces            | —           | **open (aesthetic)**                 | now 410 LOC; never carded                                                                                                                                                                                                                                                                                                                                                    |
| `key-map.ts` repeated text closures              | B35         | **fixed**                            | text aliases built programmatically                                                                                                                                                                                                                                                                                                                                          |
| `explain.ts` mirrors the per-field ladder        | B23         | **fixed**                            | now walks the shared `PIPELINE` with `dryRun:true`; ~150 LOC of mirrored logic gone, [explain.ts:94](../../../src/explain.ts#L94)                                                                                                                                                                                                                                            |
| `bindGenerators` double-Proxy + `any`            | B36         | **fixed**                            | eager `bindNamespace` pass, no Proxy, no `any` in the binder, [engine.ts:367](../../../src/world/engine.ts#L367)                                                                                                                                                                                                                                                             |
| `effectiveStore` open-coded try/finally          | B33         | **fixed**                            | `withEffectiveStore(value, fn)` helper, [engine.ts:871](../../../src/world/engine.ts#L871)                                                                                                                                                                                                                                                                                   |
| `generationCounter` call-order D4 smell          | B27→B39     | **fixed (superseded)**               | B27 audited; **B39** then went past option (a) and implemented option (b): module-global `getSchemaId` `WeakMap` + per-world `schemaCallCounts`, fork keys are now `wrap:<id>:<slot>` / `array:<id>:<slot>` / `adhoc:<id>:<slot>` — call-order-**independent** across distinct schemas. Counter survives only as `derivedPairCounter` for the documented round-robin. See §4 |
| pipeline numbering drift (6 vs 7 steps)          | B37         | **fixed**                            | engine.ts module JSDoc, `docs/concepts.md`, `CLAUDE.md` all state 7 steps + 2 wrapping passes; `PIPELINE` is the literal source                                                                                                                                                                                                                                              |
| `populate` primary-first vs others derived-first | B41→B47/B52 | **fixed**                            | B47/D12 forbids dual primary+derived registration (`withSchema` throws, [engine.ts:538](../../../src/world/engine.ts#L538)); B52 deletes populate's pre-check so it dispatches via `resolveMode` like everyone else ([engine.ts:613](../../../src/world/engine.ts#L613))                                                                                                     |

**New since the baseline:**

| New finding                                                                                                                            | Status                | Where |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----- |
| `engine.ts` re-grew to 1748 LOC — the B28 split lifted _pure_ helpers but left all 7 _stateful_ concerns                               | **open**              | §3    |
| `generateArray` is the new #1 hot spot (B38/B43/B44/B52/B53 piled mode-specific override/transform/store-off/caller-max logic into it) | **open**              | §3    |
| `resolveRelationPool` (B32) is dense (~29 branches) and still engine-resident                                                          | **open**              | §3    |
| Stale comments asserting populate's inverted precedence (contradicted by B52)                                                          | **open (XS doc bug)** | §4    |
| Two `any` casts re-introduced in `generateArray` ad-hoc tail (B26/B36 purged `any` elsewhere)                                          | **open (XS)**         | §4    |

---

## 3. Thread 1 — complexity

### 3.1 Module sizes (current)

| File                                                                      | LOC      | Δ vs baseline       | Note                                                                          |
| ------------------------------------------------------------------------- | -------- | ------------------- | ----------------------------------------------------------------------------- |
| [world/engine.ts](../../../src/world/engine.ts)                           | **1748** | (was world.ts 1202) | the engine; 7 stateful concerns + 2 large pure blocks that could leave        |
| [default-locale.ts](../../../src/default-locale.ts)                       | 499      | +285                | data growth (locale corpus), not structural                                   |
| [pipeline.ts](../../../src/pipeline.ts)                                   | 486      | new (B23)           | the promoted pipeline + explain-mode rendering; cohesive                      |
| [types.ts](../../../src/types.ts)                                         | 410      | −20                 | still a bundle; never carded                                                  |
| [generators/data/key-map.ts](../../../src/generators/data/key-map.ts)     | 353      | ~flat               | B35 trimmed closures; table grew back with new keys                           |
| [generators/schema/zod-def.ts](../../../src/generators/schema/zod-def.ts) | 339      | +158                | now hosts the split modifier passes + the two extracted loops — _good_ growth |
| [generators/schema/router.ts](../../../src/generators/schema/router.ts)   | 279      | +56                 | dispatch table + named arms                                                   |
| [world/registration.ts](../../../src/world/registration.ts)               | 123      | new                 | pure                                                                          |
| [world/relations.ts](../../../src/world/relations.ts)                     | 75       | new                 | pure _helpers only_ — the stateful pool method stayed in engine               |
| [world/derived.ts](../../../src/world/derived.ts)                         | 70       | new                 | pure                                                                          |

**Topology**: still clean. `engine.ts` imports its three sibling pure modules + the
pipeline + the schema/data generators; no cycles. The split achieved its goal (testable
pure helpers); it just didn't move enough _mass_ out of the engine because the heavy
functions are stateful.

### 3.2 Per-function hot spots in `engine.ts`

| #   | Function                          | Lines                                           | LOC  | ~Branches | Essential / Accidental                                                                                                                                 | Recommendation                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------- | ----------------------------------------------- | ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `generateArray`                   | [1272–1457](../../../src/world/engine.ts#L1272) | ~186 | ~26       | mostly **essential** (3 modes × 2 store paths × caller-max × per-index overrides are all real contracts) but the **inline interleaving is accidental** | Decompose into `generateArrayDerived` / `generateArrayPrimary` / `generateArrayAdHoc` (mirror B24). The `switch (mode.kind)` becomes a 3-line dispatcher + trailing override/transform tail. **M**                                                                                                   |
| 2   | `resolveRelationPool`             | [1024–1125](../../../src/world/engine.ts#L1024) | ~101 | ~29       | **essential** (B10-R4 store-off, B11 where-filter, self-ref guard, single/many divergence all required) but **placement is accidental**                | Move to a `RelationResolver` collaborator (holds `relationPools` + a ref to the world for `generateAndStorePrimary`), or at minimum extract the `kind==="single"` and `kind==="many"` auto-provision blocks into two private helpers so the method body reads as "build pool → filter → fork." **M** |
| 3   | `generateSingleItem` (dispatcher) | [1479–1555](../../../src/world/engine.ts#L1479) | ~77  | ~18       | **essential**                                                                                                                                          | Already B24-decomposed; the dispatcher is as thin as the B8 upsert short-circuit + two-level fallback allow. **Leave it.**                                                                                                                                                                           |
| 4   | `generateAndStorePrimary`         | [1137–1173](../../../src/world/engine.ts#L1137) | ~37  | ~6        | essential                                                                                                                                              | fine                                                                                                                                                                                                                                                                                                 |
| 5   | `generateDerivedAutoSource`       | [1628–1683](../../../src/world/engine.ts#L1628) | ~56  | ~9        | essential (B20 local-capture)                                                                                                                          | fine; could share a `collectSourcePairs` helper with `generateArray`'s derived arm (both build `SourcePair[]`) — **S**, dedups ~15 LOC                                                                                                                                                               |

The `generateArray` derived arm ([1296–1357](../../../src/world/engine.ts#L1296)) and
`generateDerivedAutoSource` ([1655–1666](../../../src/world/engine.ts#L1655)) build the
same `type SourcePair = { source, reg, sourceIndex }` pair list with the same nested
loop. That is the one piece of genuine duplication left in the engine.

### 3.3 Concrete engine split proposal

`engine.ts` owns seven stateful concerns. A clean further split, each landing well under
~400 LOC:

| New file                       | Moves out                                                                                                                                                                                                         | ~LOC moved |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `world/bind-generators.ts`     | `CtxSlot`, `CTX_SLOTS`, `bindNamespace`, `CtxAwareFn` (pure data + one pure fn, engine.ts:194–429)                                                                                                                | ~235       |
| `world/array.ts`               | `generateArray` + its constraint resolvers (`resolveMinRequired`/`resolveMaxAllowed`/`readCallerMaxBound`) — needs `this` access, so either a free fn taking the world or a `RelationResolver`-style collaborator | ~230       |
| `world/relations.ts` (grow it) | `resolveRelated`, `resolveRelatedMany`, `resolveRelationPool`, `ensurePrimaryRecord` as a `RelationResolver` class constructed with the world's `registry` + `relationPools` + a store callback                   | ~165       |

After those three moves the engine drops from ~1748 to **~1100 LOC** and contains only:
constructor, `withSchema`/`withKeyMap`/`withGenerators`, `populate`/`populateFrom`,
`generate`/`get`/`explain`, the four `generateSingleItem` branch helpers,
`generateAndStorePrimary`/`generateDerivedRecord`/`generateObjectFields`,
`makeFieldCtx`, `withEffectiveStore`, and the registration-lookup wrappers. That is the
irreducible "world session" concern. `bind-generators.ts` is a pure lift (do it first,
**S**); `array.ts` and the relations grow are **M** each and want the `SourcePair`
dedup (§3.2 #5) folded in.

The `bindNamespace` lift (#3 in the Summary) is the single highest _effort-to-payoff_
win: it removes 235 LOC of pure machinery from the engine with zero behavioural risk
(no `this`, no state) — a reviewer can confirm it by a single read.

### 3.4 Why not split the cohesive core further?

A fair pushback on §3.3: the three moves shrink the file to ~1100 LOC but the _wins read
as minor_ — a pure-data eviction and two relocations. Is there a bigger structural prize
hiding in the residual ~1100-LOC core? **No, and the reason is itself the finding.**

The remaining core is **one cohesive stateful machine, not an accidental pile.**
`WorldImpl` shares ~12 pieces of mutable state across every method — `registry`,
`effectiveStore`, `derivedUpsert`, `lazyCache`, `schemaCallCounts`, `relationPools`,
`pendingCounts`, `schemaRegs`, … ([engine.ts:463–488](../../../src/world/engine.ts#L463))
— and every generation method **re-enters itself recursively** through
`ctx.generate → this.generate`. That entanglement is load-bearing, not sloppiness.

This bounds the kinds of "split" available, and only one of them has positive value:

1. **File-split-for-size (move stateful methods to sibling files).** In TypeScript you
   cannot move a method off a class into another file without either keeping it a method
   (no split) or converting it to a free function that takes the instance/state as an
   argument. The latter replaces every `this.registry` with `state.registry` threaded
   through the call graph — you relocate lines and make the recursion _harder_ to read.
   **Negative value.** This is exactly the seam B28 correctly stopped at: it lifted the
   _pure, stateless_ helpers (`registration`/`derived`/`relations`) and went no further,
   because that is where the shared state begins. The leftover size is not a B28 failure —
   it is the irreducible mass of the state machine.

2. **Collaborator-object split (extract objects that _own_ a state slice).** The only
   decomposition with real payoff: e.g. a `RelationResolver` owning `relationPools` +
   `resolveRelationPool`/`resolveRelated{,Many}`/`ensurePrimaryRecord` (§3.3, item 3),
   constructed with the registry and a `generate` callback; similarly isolating the B8
   derived-upsert/identity machine. The payoff here is **unit-testability and explicit
   state ownership** — _not_ line count. These are **M–L** and justified only if the
   maintainer wants to test relation resolution in isolation or expects the engine to keep
   growing. They are an investment, not a complexity fix.

3. **Decompose the last tangled _function_** (`generateArray`, §3.2 #1) — already the
   headline Thread-1 item. Real value (symmetry with the B24 single-item decomposition),
   but it shrinks a _function_, not the _file_.

**Verdict:** there is no large win hiding in "split the file further" for its own sake.
The file is large because the engine is genuinely one thing. The honest leverage is, in
order: (1) **evict** the ~235 non-engine lines (§3.3 #1 — the file stops lying about its
scope), (2) **decompose `generateArray`** for symmetry (§3.2 #1), (3) extract a
`RelationResolver` **only if** testability is the goal (§3.3 #3). Splitting the cohesive
core into more files purely to lower the LOC count would thread state through the call
graph and make the code worse — a regression dressed as a cleanup.

---

## 4. Thread 2 — codepath consistency matrix

Entry paths (rows) × cross-cutting option/pass (columns). Cell = **applied** /
**n/a** / **applied differently (how)**.

| Entry path                                                                                                            | `overrides`                                                                                                                                                                      | `transform`                                                                    | `store` / `effectiveStore`                                                                               | `source` + mode dispatch                                                                                        | PRNG fork-key convention                                                                                               |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **single-item** (`generate(S)` non-array) → `generateSingleItem`                                                      | eager primitive/array in pipeline step 0 + trailing `deepMerge` (engine.ts:1550); derived branches apply inside `generateDerivedRecord` (gated by `transformApplied`)            | trailing (1551) or inside branch (gated) — **applied once**, never double      | `withEffectiveStore` scopes it; each branch gates `registry.store` on `effectiveStore`                   | `resolveMode(schema)` derived→primary→ad-hoc, two-level `schema`/`targetSchema` fallback; B8 upsert on `source` | registered: `reg<id>#<i>` / `dreg<id>#<i>` (registry-keyed, call-order-free). ad-hoc: `adhoc:<id>:<slot>` (B39 stable) |
| **array** (`generate(S.array())`) → `generateArray`                                                                   | derived arm: per-index `deepMerge` (1344); primary arm: per-index threaded into `generateAndStorePrimary` (B53); ad-hoc tail: per-index `deepMerge` (1444) — **all three apply** | derived/primary/ad-hoc each `.map(transform)` at arm end — **all three apply** | every arm gates `registry.store` on `effectiveStore`; B44 store-off uses `Array.from` not the while-loop | `resolveMode(innerSchema)` — same order as single-item                                                          | `array:<id>:<slot>` (B39) for length+element seeds; element bodies recover registry-keyed ids                          |
| **`populate(S, n)`**                                                                                                  | n/a (writes registry; factory-supplied opts threaded per-iteration)                                                                                                              | factory opts → `generateAndStorePrimary` / `generateDerivedRecord`             | always writes (B10-R6 strips `store:false` from factory return)                                          | `resolveMode(schema)` — **now identical** to single-item after B52 (pre-check deleted)                          | inherits registered ids via the store helpers                                                                          |
| **`populateFrom(D, Src)`**                                                                                            | factory opts stripped of `store`, threaded as `overrides`                                                                                                                        | via delegated `generate`                                                       | always writes (B13-R8 strips `store:false`)                                                              | delegates to `generate(D, { source })` → single-item path (Site 1)                                              | inherits single-item conventions                                                                                       |
| **object-field pipeline** (per field of a registered object) → `walkPipeline(PIPELINE, …)`                            | step 0 eager (primitive/array) + per-step `applyObjectOverride` (object slices); key-based step **replaces** not merges (pipeline.ts:399)                                        | n/a (record-level, applied by the caller)                                      | n/a (inherits ambient `effectiveStore`)                                                                  | n/a                                                                                                             | `recordPrng.fork(key)` per field                                                                                       |
| **per-schema object** (nested `z.object`, no reg) → `generateZodObject` → `walkPipeline(PIPELINE_NO_REGISTRATION, …)` | **DIFFERENT — by design**: only steps `unwrapOptional`/`keyHeuristic`/`schemaBased` run; **override/matcher/keymap/customGen steps are absent**                                  | n/a                                                                            | n/a                                                                                                      | n/a (no `SchemaReg`)                                                                                            | `ctx.prng.fork(key)` per field                                                                                         |

### Asymmetries

1. **`PIPELINE_NO_REGISTRATION` (3 steps) vs `PIPELINE` (7 steps).** This is the _only_
   place where "which options apply" depends on the entry path. A `z.object` nested
   inside another schema, reached without a registration, does **not** honour matchers,
   the per-schema key map, world-level custom generators, or eager overrides — because
   there is no `SchemaReg` to carry them. **This is intended** (B23-R: the registration-
   free path explicitly omits the four registration-dependent rungs, and both lists live
   side-by-side in [pipeline.ts:452–466](../../../src/pipeline.ts#L452) so the contract
   is scannable). **Not a bug.** The fix sketch, _if_ the maintainer ever wants full
   convergence, is to thread the active `reg` + key maps into nested-object generation —
   but that re-introduces the world→collection coupling B23 deliberately avoided. Leave as
   documented behaviour; the matrix row is the documentation.

2. **Key-based step _replaces_ overrides; matcher/keymap/custom-gen steps _deep-merge_
   them.** [pipeline.ts:399–403](../../../src/pipeline.ts#L399): the key-based and
   schema-based steps treat `fieldOverride` as a full replacement, whereas
   `matcherStep`/`schemaKeyMapStep`/`customKeyGenStep` call `applyObjectOverride`
   (deep-merge). This is consistent _within_ a path (the same rule everywhere `PIPELINE`
   runs) and is preserved-verbatim-from-`world.ts` per the B23 comment, so it is not a
   cross-path asymmetry — but it is a _semantic_ inconsistency between rungs worth a
   one-line note in `docs/concepts.md` if it isn't already there. **Not a path bug.**

### Resolved divergences (confirmed closed)

- **populate precedence (B41).** Closed two ways: B47/D12 makes dual primary+derived
  registration throw at `withSchema` ([engine.ts:538–548](../../../src/world/engine.ts#L538)),
  so the inversion-observable config can't exist; B52 then deletes populate's primary-first
  pre-check and dispatches through `resolveMode` ([engine.ts:613](../../../src/world/engine.ts#L613))
  exactly like single-item/array/get. The four dispatchers are now uniform.
- **array overrides/transform dropped on derived & primary arms (B38/B52/B53).** All
  three array arms now apply per-index overrides and trailing transform.
- **primary array `.min`/`.max`/`.length` ignored + store-off hang (B43/B44).** Caller
  bounds honoured on both store paths; store-off uses `Array.from`.
- **`generationCounter` call-order D4 smell (B27/B39).** B39 implemented the stronger
  identity-based fork keys (module-global `getSchemaId` + per-world `schemaCallCounts`).
  The counter survives only as `derivedPairCounter` for the documented round-robin pick
  ([engine.ts:1668](../../../src/world/engine.ts#L1668)); its three former PRNG-fork
  consumers are now call-order-independent. The 2026-05-29 "hidden global / possible
  correctness smell" is **resolved**, not merely renamed.

### Two stale/hazard items (genuine, small)

- **STALE COMMENTS (doc bug, not behaviour).** Three comment blocks still assert
  populate's _inverted_ precedence, which B52 removed:
  [registration.ts:111–115](../../../src/world/registration.ts#L111) ("`populate` inverts
  this (see its explicit primary-first re-check)") and the `resolveMode` JSDoc at
  [engine.ts:843–851](../../../src/world/engine.ts#L843) ("`populate` … with `populate`
  using the inverted primary-first precedence"). The `populate` code itself
  ([engine.ts:608–613](../../../src/world/engine.ts#L608)) correctly documents the
  removal, so the comments _contradict each other_. A future reader will be misled.
  **Fix: XS** — update the two stale comments to "all four dispatchers use `resolveMode`
  (derived-first) post-D12."
- **RE-INTRODUCED `any` (style, not behaviour).** The ad-hoc tail of `generateArray`
  uses `options.overrides as any[]`, `deepMerge(item, ov) as any`, and
  `options.transform as any` ([engine.ts:1445–1453](../../../src/world/engine.ts#L1445)).
  B26/B36 purged `any` from the router and the binder; this arm kept it. The derived arm
  10 lines up does the same merge with `as unknown[]` + a typed map, so the typed shape
  is already in-file to copy. **Fix: XS.**

---

## 5. Proposed backlog items (sketches — not /intake'd)

Priority-ordered. None is a _behavioural_ correctness bug; the two flagged ⚠ are
correctness-adjacent (a misleading comment about dispatch precedence, and `any` that
weakens the D1 no-`any` rule). The rest are readability/placement.

1. **Evict the generator-binding layer into `world/bind-generators.ts`** (`CTX_SLOTS` +
   `bindNamespace` + length helpers, ~235 LOC / ≈20% of the file). Not a "split the
   engine" item — it removes code that was never engine logic and touches no `WorldImpl`
   state. Pure move, zero behaviour change, highest payoff-to-risk. Targets §3.3 / §3.4.
   **Size: S — do first.**
2. **Decompose `generateArray` into per-mode helpers** (`generateArrayDerived` /
   `…Primary` / `…AdHoc` + trailing override/transform tail), mirroring B24's
   `generateSingleItem` decomposition. Fold in the shared `collectSourcePairs` helper
   (§3.2 #5) used by both the derived array arm and `generateDerivedAutoSource`. Targets
   §3.2 #1, the new #1 hot spot. **Size: M.**
3. **Extract a `RelationResolver` collaborator** holding `relationPools` + the store
   callback, moving `resolveRelated`/`resolveRelatedMany`/`resolveRelationPool`/
   `ensurePrimaryRecord` out of the engine into `world/relations.ts`. Targets §3.2 #2.
   **Size: M.**
4. ⚠ **chore: fix the stale populate-precedence comments** in `registration.ts:111–115`
   and `engine.ts:843–851` (they contradict the B52 code). Behaviour-neutral; trivial-
   chore-gate candidate — could be folded into item 2's commit if that lands first.
   **Size: XS.**
5. ⚠ **lite: remove the two `any` casts in `generateArray`'s ad-hoc tail**
   (engine.ts:1445–1453), copying the typed `unknown[]` + typed-map shape already used in
   the derived arm 10 lines above. Restores the D1 no-`any` invariant. **Size: XS.**
6. **De-dup the outer optional/nullable wrapper-strip** shared by `generate`
   (engine.ts:714) and `explainSchema` (explain.ts:53) — the B31 lazy-chain extraction
   left this sibling loop un-extracted. Low value; do only if convenient. **Size: XS.**

Distribution: items 1–3 target the engine's residual mass (the headline Thread-1 win);
items 4–6 are the small consistency/clarity cleanups from Thread 2. Item 1 first (lowest
risk), then 2, then 3.
