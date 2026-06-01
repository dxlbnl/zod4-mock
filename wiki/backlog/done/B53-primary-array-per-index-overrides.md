---
id: B53
title: BUG — per-index `options.overrides` on primary-registered array schemas throws instead of applying
type: bug
priority: high
flags: [review]
created: 2026-06-01
spec: wiki/specs/B53-primary-array-per-index-overrides.md
---

## Description

User-reported:

> the `generate` call does not cleanly use overrides, per index overrides don't work on primary-registered schemas. Why not? Analyze if they dont, and check why (if so) I want overrides to work reliably across all paths.

**Confirmed**: `world.generate(PrimarySchema.array(), { overrides: [obj1, obj2, ...] })` throws ([src/world/engine.ts:1369-1374](../../../src/world/engine.ts#L1369)) — the B38 guard. The same call shape works on:

- ad-hoc arrays ([src/world/engine.ts:1455-1461](../../../src/world/engine.ts#L1455) — deepMerge post-generation)
- derived arrays (post-B52-R4 — same pattern as ad-hoc)
- single records (`generate(S, { overrides: {} })` — flows through `generateAndStorePrimary` → `generateObjectFields` at field-level via PIPELINE step 0)
- `populate(S, N, factory)` (factory's per-record overrides flow through `generateAndStorePrimary` per record at [src/world/engine.ts:642](../../../src/world/engine.ts#L642))

So primary arrays are the **only** path where per-index overrides don't work. The B38 throw was a temporary compromise — it loudly refused a call shape that was silently broken pre-B38. The user wants the path to actually work, consistent with the other four.

## History — why B38 picked throw

B38's spec ([wiki/specs/B38-primary-array-overrides-dropped.md](../../specs/B38-primary-array-overrides-dropped.md)) considered Options A/B/C/D and picked **C+D combined** (throw + docs). Option B (make them work) was explicitly rejected by **D8** at the time — silently dropping overrides post-generation would have been a D8 violation, and the fix path "apply overrides INSIDE `generateAndStorePrimary` so the stored record is the merged record" wasn't pursued because `populate(S, count, factory)` already had the right shape. Per-index overrides on primary arrays were a "ladder of acceptable corners" the team accepted to keep B38 surgical.

That history is now stale:

- B52 unified the three array arms (derived/primary/ad-hoc) under D14. The "or throw" carveout in D14 ("cap → overrides **or throw** → transform") is the B38 holdover and is the only remaining asymmetry across arms.
- `generateAndStorePrimary` **already** accepts `options?: GenerateOptions` and applies `options.overrides` at field-level via `generateObjectFields` ([src/world/engine.ts:1159](../../../src/world/engine.ts#L1159)) BEFORE storing. The infrastructure for "make it work cleanly under D8" already exists; `populate` exercises it every day.

## Acceptance

- **B53-R1** — `world.generate(PrimarySchema.array(), { overrides: [obj0, obj1, ...] })` MUST apply `overrides[i]` to record `i` as a deep-merge at field-level (via `generateAndStorePrimary({ overrides: obj_i })`). The stored record in the registry MUST equal the returned record (D8 preserved by construction — the merge happens before `registry.store`). The B38 throw at [src/world/engine.ts:1369-1374](../../../src/world/engine.ts#L1369) MUST be removed.
- **B53-R2** — When `options.overrides.length > result.length`, extras MUST be silently ignored (ad-hoc / derived parity per D14). When `options.overrides.length < result.length`, only positions `< overrides.length` are merged.
- **B53-R3** — When `existingCount > 0` (the registry has pre-populated records) AND `overrides.length > 0`, the first `min(existingCount, overrides.length)` returned records MUST have `overrides[i]` applied **only to the freshly-generated records, not the pre-existing ones**. Open question: should pre-existing records be re-fetched with overrides applied, or returned untouched? **Spec-writer to resolve** — the natural semantic is "overrides apply to newly-produced records at positions `>= existingCount`", since the pre-existing ones are stored in the registry and modifying them would re-violate D8. The spec MUST pin this clearly.
- **B53-R4** — `options.transform` MUST run on the post-overrides result (B52-R3 contract preserved — transform sees the override-merged record).
- **B53-R5** — D14's Rule line in `architecture.md` MUST be updated to drop the "or throw" carveout. New wording: "cap → per-index overrides → transform" — no exception for primary-registered. The corresponding ADR `D14` in `decisions.md` MUST be amended in-place (per the "Newest at the bottom. Never edit a past entry — supersede it" rule, this would normally be a supersession; ask manager whether to supersede with `D15` or amend D14 directly given the carveout was always meant to be temporary).
- **B53-R6** — B38's spec, ADR (if any), and the docs language describing the throw MUST be marked superseded. The B38 throw test in `tests/unit/primary-array-overrides-throw.test.ts` MUST be rewritten (or replaced with the B53 working-behaviour assertions). B38 wasn't a standing constraint — only a runtime guard — so no D-number rotation is needed beyond the D14 amendment.
- **B53-R7** — `docs/api-reference.md` MUST be updated: any wording that documents the B38 throw (around the `.generate` array-return paragraph and the `GenerateOptions.overrides` paragraph) MUST be removed or rewritten to describe the new behaviour. Likely the throw is referenced near `docs/api-reference.md` line 316 (`.generate` array bullet) and line 341 (`GenerateOptions.overrides`).
- **B53-R8** — Changeset MUST be added (`patch` bump — correctness fix, no API surface change; the throw being lifted is a _softening_, not a breaking change in the SemVer sense).

## Tests

Per [[feedback-minimal-tests]] + [[feedback-tests-test-behavior]]: one test per R-ID, focused on **behaviour** not artifact-checks. The B38 throw test (`tests/unit/primary-array-overrides-throw.test.ts`) is REPLACED — its assertion was "throws"; the new assertion is "applies the override". Either rename the file to `tests/unit/primary-array-per-index-overrides.test.ts` (spec-writer's call) or modify in place.

Scenarios to cover:

- **R1 / fresh primary array + overrides applied**: registered `Person`, fresh world, `generate(Person.array().length(3), { overrides: [{name: "alice"}, {name: "bob"}, {name: "carol"}] })`. Assert returned `[0]/[1]/[2].name` match; assert `registry.all(Person)` matches the returned array (D8).
- **R2 / overrides shorter than result**: `generate(Person.array().length(5), { overrides: [{name: "a"}, {name: "b"}] })`. Assert positions 0/1 carry the override; positions 2/3/4 are matcher-generated.
- **R2 / overrides longer than result**: `generate(Person.array().length(2), { overrides: [{n: "a"}, {n: "b"}, {n: "c"}] })`. Assert length 2, extras ignored.
- **R3 / existing records + overrides apply to fresh tail**: `populate(Person, 5)` then `generate(Person.array().length(8), { overrides: [{n: "a"}, {n: "b"}, {n: "c"}, {n: "d"}, {n: "e"}, {n: "f"}, {n: "g"}, {n: "h"}] })`. Assert positions 0-4 (pre-existing) are unchanged, positions 5-7 carry overrides[5..7] (per spec-writer's R3 resolution; if spec resolves differently, adjust).
- **R4 / overrides + transform composition**: `generate(Person.array().length(2), { overrides: [{n: "x"}], transform: (p) => ({ ...p, hidden: true }) })`. Assert position 0 has `name === "x"` AND `hidden === true`; position 1 has matcher-generated name AND `hidden === true`.
- **R7 / docs**: reviewer-only (Read the diff).
- **R8 / changeset**: reviewer-only.

Cap: ~5-6 behaviour tests + 2 reviewer-only verifications.

## Out of scope

- Per-index overrides on `populate(S, N, factory)` — already works correctly, no change.
- `world.populate(S, N)` without a factory — already works correctly, no change.
- The `world.generate(S, { overrides: {} })` single-record path — already works correctly via `generateAndStorePrimary` field-level merge.
- Changing what an "override" means at the field level (B12 / PIPELINE step 0) — untouched.
- Changing the derived or ad-hoc paths' override handling — they already work.

## Refactor direction (implementer hint, not binding)

The fix is small. In the primary array branch ([src/world/engine.ts:1362-1426](../../../src/world/engine.ts#L1362)):

1. Delete the throw at lines 1369-1374.
2. In the existing `Array.from` (store-off) and `while` (store-on) loops, pass per-index options to `generateAndStorePrimary`:

   ```ts
   // store-off
   primaryResult = Array.from({ length: storeOffLength }, (_, i) =>
     this.generateAndStorePrimary(innerSchema, mode.reg, {
       overrides: options?.overrides?.[i] as Record<string, unknown> | undefined,
     }),
   );

   // store-on
   while (this.registry.count(innerSchema) < target) {
     const i = this.registry.count(innerSchema); // index of the about-to-be-generated record
     this.generateAndStorePrimary(innerSchema, mode.reg, {
       overrides: options?.overrides?.[i] as Record<string, unknown> | undefined,
     });
   }
   ```

3. The trailing `transform` pass at lines 1420-1423 already runs after generation; no change there (B52-R3 preserved).
4. **R3 resolution**: pre-existing records in `registry.all(innerSchema)` at positions `[0, existingCount)` are returned untouched (D8 — they are the stored values). Overrides apply only to records produced by the loop (positions `[existingCount, target)`). The spec-writer pins this; the implementer enforces it.

## Notes

- **B25** unified the classifier; **B52** unified the trailing pass across mode arms; **B53** completes the unification by lifting the B38 throw on the primary-arm overrides slot.
- **B38** is _superseded_ in spirit but not in document — the throw it added is removed under R1, and its acceptance scenarios are replaced with R1-R4 here. Manager decides whether to mark the B38 spec page as "superseded by B53" or leave it as a historical record.
- **D14** is amended under R5 — the "or throw" carveout was always the B38 holdover.
- **D8** is preserved by construction (the merge happens BEFORE `registry.store`).
- Bump: **patch** (correctness fix; the throw being lifted is a softening — the call shape that worked before-but-was-buggy now works correctly; no API surface change).
- GitHub issue: none — user reported conversationally.
- `flags: [review]` — supersedes a previous design decision (B38) + amends a standing constraint (D14). Manager pauses for spec sign-off before tests/impl runs.
- Predecessor: **B38**, **B52**, **D14**.
- Composes with: D8, D14 (amended), B10 (effectiveStore preserved), B12 (PIPELINE step 0 — the field-level eager-override path that the per-record merge uses).
- Anchor reading: src/world/engine.ts:1362-1426 (primary array arm), :1137-1175 (`generateAndStorePrimary`), :1455-1461 (ad-hoc post-deepMerge as the reference for "what 'works' looks like"), wiki/specs/B38-primary-array-overrides-dropped.md (history).
