# Progress Journal

> Append-only run journal. The `manager` updates this as backlog items move through the
> pipeline, so the whole run is auditable. Newest at the bottom.

## Format

```
## <YYYY-MM-DD HH:MM> — B<n>: <item title>
- <agent>: <what it did> → <outcome>
- ...
- result: <done | escalated | paused for review> — <commit hash if committed>
```

When the manager **pauses** (review checkpoint) or **escalates** (unresolved failure),
it records the reason here AND states it in chat.

---

<!-- entries start here -->

## 2026-05-27 — B4: Add `registry.find()` — single-record predicate lookup
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B4-registry-find.md (R1–R5); 1 non-blocking open question (return contract → T|undefined)
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/registry.test.ts (7 tests, R1–R5); RED confirmed (7 failed / 795 passed), failures attributable to missing find
- manager: dispatch implementer
- implementer: added find to Registry (src/types.ts) + SchemaRegistry (src/registry.ts) via all().find(); updated docs/api-reference.md; conformance no-op find on 2 test stubs. GREEN: 802 passed, typecheck clean
- manager: dispatch reviewer
- reviewer: PASS — R1–R5 met, 802 tests green, typecheck clean, no scope creep, stub edits conformance-only, doc rule honored
- result: done — commit e64e832

## 2026-05-27 — B5: Add `ctx.related.many(name, count)` for one-to-many relations
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B5-related-many.md (R1–R6); 3 non-blocking open questions (distinct/api-shape/range all resolved per card)
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: added B5 block to tests/unit/core/relations.test.ts (10 tests, R1–R6); RED confirmed (9 failed / 803 passed), failures attributable to missing related.many
- manager: dispatch implementer
- implementer: added resolveRelatedMany (src/world.ts) + .many on related (src/types.ts) reusing relationPools/prng.sample/generateAndStorePrimary; updated docs/api-reference.md; conformance no-op .many on 6 generator-test fixtures. GREEN: 812 passed, typecheck clean
- manager: dispatch reviewer
- reviewer: PASS — R1–R6 met, 812 tests green, typecheck clean, fixture edits conformance-only, no scope creep, no new standing constraint
- result: done — commit 12fa016

## 2026-05-27 — B6: Add `world.get(schema, predicate)` — find-or-create by domain key
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B6-world-get-find-or-create.md (R1–R9); 4 non-blocking open questions resolved
- manager: review checkpoint — user raised 2 design points: (1) registry vs world → keep on World (create path needs world.generate; registry is a pure store, would need a circular back-ref); (2) make predicate optional. Re-dispatching spec-writer to fold in.
- spec-writer (incorporate answers): B6-R1 signature → optional predicate; B6-R9 covers absent ≡ {}; World-vs-registry rationale added to Context. No blocking questions.
- manager: spec-validation gate passed (user decided design at checkpoint); dispatch test-writer
- test-writer: wrote tests/unit/core/world-get.test.ts (15 tests, R1–R9); RED confirmed (15 failed / 812 passed), all via missing world.get; typecheck clean
- manager: dispatch implementer
- implementer: added World.get (src/types.ts, src/world.ts) — find via registry.find (deep-eq on nested), create via generate-overrides + explicit store (ad-hoc + registered); added deepEqual to src/utils/merge.ts; updated docs/api-reference.md. GREEN: 827 passed, typecheck clean
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R9 met, 827 tests green, typecheck clean, no scope creep, registered-schema ref-equality nuance verified, deepEqual is a local one-off (no decisions.md)
- result: done — commit 925068b

## 2026-05-28 — B12: BUG — Nested-object overrides skip the matcher and don't deep-merge
- manager: start, track: bug (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B12-nested-override-skips-matcher.md (R1–R4); 2 non-blocking open questions
- manager: review checkpoint — user expanded scope: also align key-map / key-based / schema-based branches to in-step deep-merge. Re-dispatching spec-writer to fold in.
- spec-writer (incorporate answers): added B12-R5 (in-step deep-merge for all branches), rewrote B12-R3 sub-1 as layered model. No blocking questions.
- manager: spec-validation gate passed (user decided scope at checkpoint); dispatch test-writer
- test-writer: wrote tests/unit/core/nested-overrides.test.ts (12 tests, R1/R3/R5); RED on 4 (R1 ×2, R5 key-map, R5 custom-generator); 8 guards GREEN today (incl. R5 schema-based, which already merges via recursion)
- manager: dispatch implementer
- implementer: edited src/world.ts generateObjectFields steps 1 (matcher), 2 (key-map), 4 (custom gen) to deepMerge object overrides in-step; reused src/utils/merge.ts deepMerge; no API/doc change. GREEN: 839 passed, typecheck clean
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R5 met (incl. card-repro regression per D6), 839 tests green, typecheck clean, no scope creep, no API/type/docs change, no new standing constraint
- result: done — commit c21023e (closes #12)

## 2026-05-28 — B7: Registry read methods should return `infer<T>` (output shape), not `input<T>`
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B7-registry-output-typing.md (R1–R7); empirically verified no matcher round-trips pre-coerce values in src/ or tests/ — option (b) document-the-contract safe
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/output-typing.test.ts (13 tests, R1–R6). RED in typecheck only (10 TS errors at read/predicate sites); runtime all green (pure type-only spec)
- manager: dispatch implementer
- implementer: src/types.ts (Registry reads → z.infer<T>; store stays input<T>; World.get return → z.infer<TSchema>); src/world.ts (WorldImpl.get return + matches predicate retyped; added input<T> cast at registry.store write boundary, removed unnecessary input<T> cast); docs/api-reference.md updated with asymmetry note. GREEN: typecheck 10→0; 853 tests pass; no test annotations needed
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R7 met, typecheck clean, 853 tests green, doc rule honored, single store-boundary cast scoped correctly, no scope creep, no new standing constraint
- result: done — commit 1b67a89 (closes #7, #16)

## 2026-05-28 — B15: `prng.pick` should accept `readonly T[]`; verify `shuffle`/`sample` shipped on the published `Prng` interface
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B15-…md (R1–R5). Diagnostic: shuffle/sample ALREADY in locale-core src/ + committed dist/; only the npm-published 0.2.0 is stale. R3 closes recurrence via prepublishOnly on 4 locale packages.
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer — INTERRUPTED. User pushed back on B15-R3 (prepublishOnly package.json assertion is a config check, not a test) and B15-R4 (doc-comment string match is busywork). Re-dispatching spec-writer to tighten: keep prepublishOnly + doc-comment as non-test deliverables (implementer does, reviewer verifies); only R1+R2 carry failing tests.
- spec-writer (incorporate answers): tightened spec to R1 (pick overload), R2 (shuffle/sample type-pin), R3 (no regressions). prepublishOnly + doc-comment + docs update moved to "Additional deliverables" section (reviewer verifies, no test).
- manager: dispatch test-writer (corrected scope: tests only for R1 + R2)
- test-writer: added describe("B15: pick overload & shuffle/sample invariant") to tests/unit/core/prng.test.ts (9 tests). RED: 6 typecheck errors (TS2345) at plain-array pick call sites; runtime 862/862 green. B15-R2 type pins compile today (invariant guard). Removed two stray scope-creep test files (build/locale-prepublish-guard + types-prng-doc).
- manager: dispatch implementer
- implementer: added pick(readonly T[]) overload to packages/locale-core/src/types.ts; removed `!` from src/prng.ts pick body (honest T|undefined); added prepublishOnly:"pnpm build" to 4 locale packages; doc-comment near Prng import in src/types.ts; docs/api-reference.md updated with both overloads. GREEN: 862 tests, 0 typecheck errors. (Note: dist/index.d.ts is gitignored — prepublishOnly regenerates at publish time.)
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R3 met, 862 tests green, typecheck clean, additional deliverables (prepublishOnly ×4 + doc-comment + docs update) verified; recommended D7 standing constraint
- manager: promoted D7 to decisions.md + one-line Rule in architecture.md ("Every publishable workspace package MUST have a prepublishOnly script")
- result: done — commit 45b45df (closes #15)

## 2026-05-28 — B14: `world.populate` should support a per-record factory for `GenerateOptions`
- manager: start, track: feature (unflagged)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B14-world-populate-factory.md (R1–R7); 2 non-blocking open questions (factory shape = GenerateOptions; pure-factory determinism)
- manager: spec-validation gate passed; no review flag → dispatch test-writer directly
- (manager pause: backfilled (closes #N) refs onto B12/B7/B15 commits via stash + reset --hard b3a20e8 + cherry-pick + amend. New hashes: c21023e/1b67a89/45b45df. progress.md hashes updated in-tree.)
- test-writer: wrote tests/unit/core/populate-factory.test.ts (11 tests, R1–R6); RED 13 TS errors + 5 runtime fails (missing factory arg + transform not threaded through populate path); regression guards pass
- manager: dispatch implementer
- implementer: added populate(schema, count, factory?) overload (src/types.ts, src/world.ts); routed through lower-level helpers; threaded transform through generateAndStorePrimary + generateDerivedRecord; added transformApplied flag in generateSingleItem to avoid double-apply; docs/api-reference.md updated. GREEN: 873 tests, typecheck clean. NOTE: this aligns registered-schema registry storage with the transform-applied return value (previously diverged) — reviewer to assess whether scope-acceptable.
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R7 met, 873 tests green, typecheck clean; transform-alignment scope expansion ACCEPTED (required by R3, internally consistent, safe). Recommend D8 standing constraint.
- manager: promoted D8 to decisions.md + one-line Rule in architecture.md ("registry storage = generate's return value including transform")
- result: done — commit 9b2a80a (closes #14)

## 2026-05-28 — B10: Add an opt-out for registry storage on `world.generate`
- manager: start, track: feature (unflagged)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B10-generate-store-opt-out.md (R1–R8); 2 non-blocking open questions resolved; D8 finding documented (makes B10-R5 mandatory — world.get must always store)
- (manager pause: user requested backfill changesets for prior items; committed B7/B12/B14/B15 changesets as 3e99691; B10 in-flight resumes)
- manager: spec-validation gate passed; no review flag → dispatch test-writer
- test-writer: wrote tests/unit/core/generate-store-opt-out.test.ts (17 tests, R1–R7). RED: 11 TS errors (no `store` field) + 5 runtime fails (store-suppression and nested propagation missing); 6 regression-guard tests pass today as designed
- manager: dispatch implementer
- implementer: added store?: boolean to GenerateOptions (src/types.ts); per-call `effectiveStore` field on WorldImpl with try/finally push/pop in generate; gated registry.store in generateAndStorePrimary + resolveRelated/Many auto-provision pool; world.get forces store:true on its inner generate; populate strips factory's store field; docs + changeset added. GREEN: 890 tests, typecheck clean
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R8 met, 890 tests green, typecheck clean, re-entrancy + double-store-via-pool both ruled out, changeset present, no scope creep. effectiveStore is a local impl detail (no new standing constraint).
- result: done — commit 63e88e7 (closes #10)

## 2026-05-28 — B8: Derived schemas (`from:`) should be 1:1 / identity-preserving with their source
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B8-derived-schemas-identity.md (R1–R11); 3 non-blocking open questions
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/derived-identity.test.ts (16 tests, R1–R9). RED: 4 typecheck errors (missing `unique`/`sourceKey` fields) + 13 runtime fails (no upsert; derive path doesn't even store today). 3 pass-as-guards. Implementer must add BOTH upsert tracking AND registry write for derived records, post-transform per D8.
- manager: dispatch implementer
- implementer: added `unique?: boolean` to GenerateOptions (src/types.ts) + `sourceKey?: keyof input<TSource> & string` to SchemaOpts; added private derivedUpsert Map<schema, Map<identity, record>> on WorldImpl; wired upsert in generateSingleItem's source-override branch (decrements generationCounter on hit for B8-R9 lockstep; applies overrides+transform inline, returns early to skip trailing pass); gated by effectiveStore (B8-R7) and unique (B8-R4); docs + changeset added. GREEN: 906 tests, typecheck clean.
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: FAIL — B8-R6/D8 double-apply: generateDerivedRecord already applies overrides+transform; source-override branch applies AGAIN (lines 956-959); current tests pass only because their transform is idempotent. transformApplied=true at line 951 is dead code (early return). Fix: drop the manual override/transform pass in the source-override branch; add a non-idempotent transform test. Also recommended D9 standing constraint: "cache short-circuits MUST be PRNG/counter-neutral" (corroborates the existing generationCounter-- pattern).
- manager: loop back to implementer with review notes (first rejection, retry budget 1)
- implementer (retry): removed redundant override-merge + transform call + dead transformApplied=true from source-override branch; added non-idempotent transform regression test. Verified bug-real (before: bio ended "!!"; after: ends "!"). GREEN: 907 tests, typecheck clean.
- manager: re-dispatch reviewer to confirm fix
- reviewer (re-run): PASS — B8-R6/D8 double-apply fix verified by new non-idempotent test ("bio" ends "!"). All R1–R9 met, 907 tests green, typecheck clean, no scope creep, no new `any`. Confirms D9 standing constraint recommendation.
- manager: promoted D9 (cache short-circuits MUST be PRNG/counter-neutral) to decisions.md + one-line Rule in architecture.md
- result: done — commit 948bd71 (closes #8)

## 2026-05-28 — B11: `relations` should support a predicate to filter the candidate pool
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B11-relations-predicate-filter.md (R1–R10); 3 non-blocking open questions resolved (z.infer predicate, re-evaluate per record, empty-pool-throws)
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/relations-where.test.ts (15 tests, R1–R8). RED: typecheck rejects { schema, where } object form; 11 runtime fails (withSchema doesn't normalize wrapper, where not applied). 4 pass-as-guards (R1 structural + R2 regression). D9 PRNG-neutrality test uses sibling-`.many` instrumentation (`whereCalls === 8`) instead of two-world PRNG compare (cleaner expression of the same invariant). Self-reference exemption test included for R6.
- manager: dispatch implementer
- implementer: added RelationEntry<T> discriminated union (src/types.ts) + isZodSchema/normalizeRelationEntry helpers; updated withSchema to normalize entries at registration; resolveRelated/Many filter snapshot once on cache-miss; throw with named relation when empty filtered pool (self-ref exemption); B10 store:false in-memory pool also filtered; docs + changeset added. GREEN: 922 tests, typecheck clean.
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R10 met, 922 tests green, typecheck clean, discriminator robust (uses _zod brand per D3), D9 neutrality verified (whereCalls === 8), B10 store:false interaction confirmed, no scope creep, no new standing constraint
- result: done — commit 1a9603e (closes #11)

## 2026-05-28 — B13: Add `world.populateFrom(derivedSchema, sourceSchema, predicate?)`
- manager: start, track: feature (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B13-world-populate-from.md (R1–R11); 2 non-blocking open questions resolved (z.infer predicate; ad-hoc source schemas accepted)
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/world-populate-from.test.ts (17 tests, R1–R9). RED: TS2551 ("populateFrom does not exist") at every call site + 17 runtime TypeErrors. All attributable to missing method on World/WorldImpl. R6 snapshot test uses matcher side-effect (store extra source mid-iteration). R4 pins reference equality across two calls (B8 upsert composition).
- manager: dispatch implementer
- implementer: added populateFrom to World interface (src/types.ts) + WorldImpl.populateFrom (src/world.ts): snapshot at entry, predicate-filter, per-source `this.generate(D, { source, ...factoryReturn })` (factory's `store` stripped), returns `this`. B8 upsert provides idempotence and determinism inherited via existing PRNG paths. Docs + changeset added. GREEN: 939 tests, typecheck clean.
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R11 met, 939 tests green, typecheck clean, B8 composition verified (idempotence via upsert), snapshot semantics + factory-store-stripping confirmed, no scope creep, no new standing constraint
- result: done — commit 30d1c17 (closes #13)

## 2026-05-28 — B16: Surface the auto key-match list (docs + a debug helper `world.explain`)
- manager: start, track: feature (unflagged)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B16-surface-key-match-list.md (R1–R11); 3 non-blocking open questions resolved (structured+toString, standalone method, single-schema scope). Found localized aliases live in DEFAULT_KEY_MAP.string (src/generators/data/key-map.ts), not in locale packages.
- manager: spec-validation gate passed; no review flag → dispatch test-writer
- test-writer: wrote tests/unit/core/world-explain.test.ts (18 tests, R1–R8). RED: 18/18 fail with TypeError: world.explain is not a function. Tests use a local WithExplain shim + `as World & WithExplain` (B6/world-get pattern); typecheck currently passes via the shim — B16-R1 will re-pin no-cast call sites once explain lands. R7 toString uses .toContain on exact aligned substrings.
- manager: dispatch implementer
- implementer: added explain to World (src/types.ts) + WorldImpl.explain (src/world.ts → delegates to src/explain.ts); types exported (FieldExplanation/RelationExplanation/ExplainResult); regenerated docs/key-heuristics.md (DEFAULT_KEY_MAP exact keys + patterns + Dutch aliases); api-reference + changeset added. GREEN: 957 tests, typecheck clean. FLAGGED: B16-R2 pins createdAt 'date.anytime', B16-R7 toString pins 'date.anytime+toISOString' for same field — internal contradiction. Workaround: parallel displayGenerators map in src/explain.ts swaps for toString only. Spec needs reconciliation.
- manager: dispatch reviewer with explicit attention to the contradiction
- reviewer: FAIL — contradiction is real; displayGenerators workaround misrepresents engine behavior (z.coerce.date() yields Date, not ISO string). Recommends option (a): fix R7 substrings to use 'date.anytime' (no suffix), re-align columns, drop workaround. docs/key-heuristics.md already documents the correct leaf-aware reality.
- manager: loop back (1st rejection) — re-dispatch spec-writer to apply option (a) to R7, then implementer to drop workaround + update test substrings to match reconciled spec.
- spec-writer (incorporate answers): R7 toString example reconciled to use 'date.anytime' (no suffix), columns re-aligned to width 16 driven by 'person.firstName'. New R7 invariant: toString MUST be byte-identical to fields[k].generator. R2 unchanged.
- implementer (retry): removed displayGenerator field + displayGenerators map from src/explain.ts; formatExplainResult now reads entry.generator directly; updated R7 substrings in tests/unit/core/world-explain.test.ts (R2 untouched). GREEN: 957 tests, typecheck clean.
- manager: re-dispatch reviewer to confirm fix
- reviewer (re-run): FAIL — implementation correct & 957 tests green, but the same stale `date.anytime+toISOString` example block appears in docs/api-reference.md:552-557 AND in .changeset/b16-world-explain-and-key-heuristics.md:11-16. Fix: replace each example block with the byte-identical 6 lines from R7's scenario.
- manager: ESCALATE (2nd reviewer rejection per workflow) — narrow scope (4-6 lines × 2 files); seeking user approval to do one more implementer pass.
- user: approved one more focused implementer pass to update docs + changeset example blocks.
- manager: dispatch implementer (focused — docs/api-reference.md:552-557 + .changeset b16:11-16 only)
- implementer (focused): replaced 6 lines × 2 files to byte-identical R7 scenario (column-1 width 12, column-2 width 17, createdAt → date.anytime no suffix). GREEN: 957 tests, typecheck clean.
- manager: re-dispatch reviewer (3rd pass; narrow confirmation)
- reviewer (3rd pass): PASS — both example blocks now byte-identical to R7 scenario; no `date.anytime+toISOString` remains in either; 957 tests green, typecheck clean. R1–R11 finally clean across all layers (spec/test/impl/docs/changeset).
- result: done — commit bc5558f (closes #17)

## 2026-05-28 21:44 — manager: planning pass
- inbox: 6 items (B2, B3, B9, B17, B18, B19); ready: 0; doing: 0
- B19 is a tracking marker (already resolved by B8 in 0.7.0) flagged blocked — not real work; bookkeeping pending GitHub-side close on issue #20
- ordered work plan presented to user; pausing for approval

## 2026-05-28 21:45 — B19: BUG — `world.generate(derivedSchema, { source })` does not store (RESOLVED by B8 in 0.7.0)
- manager: housekeeping pass — user approved "handle B19 first"
- manager: no auth available for GitHub write API; falling back to card's Option 2 (close via commit subject on next push)
- manager: swapped frontmatter flags: [blocked] → [cancelled], updated Notes; git mv inbox/ → done/
- result: cancelled — commit d478d03 (closes #20)

## 2026-05-28 21:46 — B18: BUG — `deepMerge` recurses into `Date` / `Map` / `Set` / `RegExp` and loses the value
- manager: start, track: bug (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B18-deepmerge-atomic-objects.md (R1–R5); resolved realm-check open question in-spec as (a) `Object.getPrototypeOf === Object.prototype || null` (Node-only library); 0 blocking open questions
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/merge-atomic.test.ts (11 tests, R1+R2) + tests/unit/core/overrides-atomic.test.ts (6 tests, R3+R4). RED confirmed: 12 fail attributable to "atomic object reduced to {} by deepMerge"; 5 pass-as-guards (R1 null-prototype dict + 4× R2 plain-object recursion). Placed under tests/unit/core/ (spec hint of tests/unit/utils/ was wrong — that dir doesn't exist; existing merge.test.ts is in core).
- manager: dispatch implementer
- implementer: added isPlainObject predicate (`value is Record<string, unknown>`) to src/utils/merge.ts; replaced deepMerge's early-return clause with `!isPlainObject(source) || !isPlainObject(target)`; body Object.keys recursion unchanged; deepEqual untouched; no per-call-site guards added in src/world.ts (R3 satisfied via single-source change); added .changeset/b18-deepmerge-atomic.md (patch). GREEN: 974/974 tests, typecheck clean.
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R5 met, 974/974 tests green, typecheck clean, no scope creep (src/world.ts diff empty, no test edits), D6 regression test pins exact card repro, D1 honored (no `any`; impl actually removed 2 existing casts via type predicate), D5 not triggered (deepMerge internal), changeset present (patch, closes #19), no new standing constraint (one-helper local choice, documented in spec)
- result: done — commit pending (closes #19)
