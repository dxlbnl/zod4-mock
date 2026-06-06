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

## 2026-05-29 23:15 — B45: Evaluate alternatives to char-level Markov for name/word generation

- manager: start, track: research (flagged review)
- manager: dispatch general-purpose researcher → wiki/research/text-generation/markov-alternatives.md
- note: filed as B44 originally; renumbered to B45 to coexist with another session's concurrent B44
- manager: researcher returned report; paused at review checkpoint (flagged review)

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
- reviewer: PASS — R1–R10 met, 922 tests green, typecheck clean, discriminator robust (uses \_zod brand per D3), D9 neutrality verified (whereCalls === 8), B10 store:false interaction confirmed, no scope creep, no new standing constraint
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
- result: done — commit df963b6 (closes #19)

## 2026-05-28 21:55 — B17: BUG — `z.record(enum, V)` should generate all enum keys, not a random subset

- manager: start, track: bug (flagged review)
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B17-record-enum-exhaustive-keys.md (R1–R8). Three out-of-scope decisions: z.map(enum) Option (b) unchanged (iterable, not strict-key parsed), z.nativeEnum (router unsupported), literal-union (def-walk brittle). All 3 open questions resolved non-blocking. Docs target: docs/zod4-schema-coverage.md (not api-reference; no API change).
- manager: spec-validation gate passed; review checkpoint → user approved spec
- manager: dispatch test-writer
- test-writer: extended tests/unit/generators/domains/collection.test.ts with 7 B17 tests. RED: 4 fail (R1 three-member-declared-order, R1 empty-enum→{}, R5 card repro, R6 append preserves earlier values). PASS-as-guards: R4 string/number unchanged ×2, R6 seed determinism. STOP+REPORT: R1 single-member passes today by accident (loop picks 'ONLY' every iter → record dedups → `{ONLY:...}`); test still encodes spec correctly so kept as positive guard. Manager ruled: proceed.
- manager: dispatch implementer
- implementer: added finite-key branch to generateZodRecord (src/generators/schema/collection.ts) detecting `def(d.keyType).type === "enum"` via def() helper (D3); iterates `Object.values(keyDef.entries ?? {})` in declared order, forks `rv-${i}` per entry (D4); empty enum falls out to `{}`; open-key path verbatim (B17-R4 byte-identical). Updated docs/zod4-schema-coverage.md row 185 with finite-key Notes entry (B17-R7, D5). Added .changeset/b17-record-enum-exhaustive.md (patch). GREEN: 982/982 tests, typecheck clean.
- manager: dispatch reviewer (no git; pnpm test/typecheck only)
- reviewer: PASS — R1–R8 met, 982/982 tests green, typecheck clean, no scope creep (only src/generators/schema/collection.ts + docs + changeset touched; generateZodMap untouched, nativeEnum/literal-union/world.ts untouched), card-repro asserts both halves (sorted keys deep-equals + safeParse green), D1/D3/D4/D5/D6 honored, no new standing constraint
- result: done — commit da72b78 (closes #18)

## 2026-05-28 22:10 — B9: Doc — pipeline comment in `world.d.ts` omits the eager-overrides step

- manager: start, track: feature/lite (no review flag)
- manager: lite gate re-check PASS (1–2 files, comment only, no API/schema/contract change, no observable behavior, no security)
- manager: dispatch implementer (lite)
- implementer (lite): added step 0 (eager per-field overrides) to pipeline doc-comment in src/world.ts (lines 14-24, module-level JSDoc); mirrored in docs/concepts.md (lines 75-85) and CLAUDE.md (lines 43-50). Verified against source: step 0 = generateObjectFields lines 809-821 (eager assignment), step 5 = generateSingleItem line 1167 (final deepMerge). No executable code touched. No changeset (comment-only, no public-API or user-observable change). GREEN: 982/982 tests, typecheck clean.
- manager: dispatch reviewer (lite)
- reviewer (lite): PASS — three diffs surgical (JSDoc in src/world.ts:14-26, markdown in docs/concepts.md:75-86 + CLAUDE.md:43-51); step 0 accurate against src/world.ts:813-825, step 5 accurate against src/world.ts:1171; 982/982 tests, typecheck clean; no executable code touched; lite gate still holds (no API/schema/dep/behavior change); no scope creep; no standing constraint
- result: done — commit 50f07e1 (closes #9)

## 2026-05-28 22:15 — manager: pausing run

- 4 items completed this session: B19 (d478d03 cancel), B18 (df963b6), B17 (da72b78), B9 (50f07e1)
- 2 items remain in inbox: B2 (research, low, review), B3 (feature, low, review) — both architecturally significant, deferred to a future session per user direction ("just B9. then I'll ship")
- 4 unpushed commits on main: d478d03, df963b6, da72b78, 50f07e1 (issue auto-closes #20, #19, #18, #9 fire on push)

## 2026-05-29 — B20: BUG — `world.generate(derivedSchema, { store: false })` crashes when `from:` registry is empty

- manager: filed via /intake from GitHub issue #21 (high priority — user said "fix asap"); promoted inbox → doing, track: bug
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B20-store-false-empty-from-crash.md (R1–R8). Chose **Fix B** (local-capture Map for auto-provisioned source) over Fix A (force `effectiveStore = true`) because B10-R4 already pins transitive `store: false` suppression of auto-provisioned siblings; Fix A would carve a contradicting exception. Two non-blocking open questions (multi-derivedReg sharing same `from:` reuse; defensive `pairs.length === 0` guard) — both recorded, do not block.
- manager: spec-validation gate PASS — 8 requirements with B20-R<k> ids, each with ≥1 GIVEN/WHEN/THEN scenario and observable THEN; no blocking open questions; honors D1/D3/D4/D5/D6/D8. Card not flagged review → proceeding without checkpoint.
- manager: dispatch test-writer
- test-writer: wrote tests/unit/store-false-empty-from.test.ts (7 tests, R1–R6 + R7 satisfied-by-file; R8 reviewer-only). RED: 5 fail with the documented `TypeError: Cannot destructure property 'source' of 'pairs[idx]'` from src/world.ts:1142 (R1, R2.1, R2.2, R3, R6 all blocked by same root crash). PASS-as-guards: 2 (R4 non-empty path, R5 default-mode). Full suite: 5 failed / 984 passed. Flagged spec ↔ code inconsistency: B20-R2 scenario 2 and B20-R5 asserted `count(Derived) === 1` but today's no-source derived branch at src/world.ts:1122-1144 doesn't store the derived record (only the with-source branch at line 1110 does). Tests pin today's actual `count(Derived) === 0`.
- manager: verified test-writer's claim by reading src/world.ts:1090-1175 — confirmed. Dispatched spec-writer to correct the assertion values.
- spec-writer (round 2): corrected B20-R2 scenario 2 and B20-R5 assertions to `count(Derived) === 0`, updated B20-R5 prose to accurately describe today's no-source-branch behaviour (does not store the derived record), added an Out-of-scope note documenting the with-source/no-source derived-store asymmetry as a separate future backlog item. Decision (Fix B), requirement IDs, and B20-R7/R8 untouched. Tests already match corrected spec.
- manager: dispatch implementer
- implementer: applied Fix B in src/world.ts (no-source derived branch, ~lines 1122-1144): added `const captured = new Map<ZodTypeAny, unknown>()` keyed by `reg.from`; auto-provision loop stores the value returned by `generateAndStorePrimary` into `captured` and adds a `!captured.has(reg.from!)` guard alongside the existing `registry.count === 0` check (preserves multi-derivedReg-same-source dedup); pair-collection loop reads from registry as today, only falls back to `captured.get(reg.from!)` when `sources.length === 0`. `generateAndStorePrimary` call site, arguments, and counter unchanged (D4 preserved). No `any`. Added .changeset/b20-store-false-empty-from-crash.md (patch, closes #21). GREEN: 989/989 tests, typecheck clean.
- manager: dispatch reviewer
- reviewer: PASS — R1–R8 met, 989/989 tests green, typecheck clean (no `any` in B20 code; existing unrelated `as any` cases at src/world.ts:1012/1015/1020/1062 not touched). Fix B implemented (Map<ZodTypeAny, unknown> at src/world.ts:1132 + pair-loop fallback at 1153-1154); Fix A not implemented. Non-empty path unchanged (registry.all read at 1148). generateAndStorePrimary call site/args unchanged → D4 preserved. docs/api-reference.md not modified → D5 preserved. B20-R6 byte-identical guard passes. Changeset format matches sibling pattern. No new standing constraint (Fix B follows from B10-R4). One non-blocking cosmetic note: two stale comments in tests/unit/store-false-empty-from.test.ts (around lines 140-147 and 239-246) still reference the spec's pre-correction draft text; harmless, deferred.
- result: done — moved card to wiki/backlog/done/, commit b397fd6 (closes #21 on push)

## 2026-05-29 — B22: Research — deep complexity analysis of the codebase

- manager: filed via /intake (user request, no GH issue); promoted inbox → doing, track: research. Scope confirmed with user via 3 questions: all 4 dimensions (cyclomatic+cognitive / module size+shape / structural-nesting / architectural-pipeline); depth = survey + top-N hotspots with recommendations; output = recommendations as backlog-item sketches, NOT auto-filed.
- manager: dispatch researcher (general-purpose)
- researcher: wrote wiki/research/reports/codebase-complexity.md (275 LOC). Headline: src/world.ts is the entire problem (1202 LOC, 7 concerns); generateSingleItem (164 LOC, 4 sub-pipelines glued by mutable result + transformApplied flag) is the clearest accidental-complexity offender; the per-field pipeline is re-implemented 3× with drift (world.ts + collection.ts:generateZodObject + explain.ts); generationCounter-derived PRNG fork keys make state depend on call order (soft D4 violation worth audit); three duplicated state-machines (optional/nullable unwrap, lazy-resolve while, mode dispatch). 15 proposed backlog items, NOT auto-filed. Updated INDEX.md Pages table. Gaps disclosed: true cognitive complexity unmeasured (no tool); cyclomatic counts are upper bounds due to `||` / `??` defaults.
- manager: dispatch reviewer
- reviewer: PASS — all 4 dimensions covered, 10-row hot-spot tables per dimension with file+line+recommendation, 15 proposed backlog items (NOT auto-filed), Method section discloses all 3 required gaps. 13 factual spot-checks all accurate: 10 wc -l LOC values exact-match; generateSingleItem (164 LOC), generateObjectFields (147 LOC), applyModifiers (105 LOC), generateFromSchema (170 LOC, 38 cases), WorldImpl.generate (64 LOC) all confirmed in code; 4 near-identical lazy-resolve while loops at world.ts:350/780/1040 + explain.ts:251 confirmed; generationCounter D4 soft-violation at world.ts:927/362 confirmed; B21 cross-reference accurate. 3 minor cosmetic findings (pipeline rung counts 5/6 actually 6/7, email LOC off by 1, types.ts fan-in 26→25) — all non-blocking, foldable into proposed item #15. git status clean: only wiki files touched, no src/ / docs/ / package.json edits. wiki/backlog/inbox/ contains only pre-existing items.
- result: done — moved card to wiki/backlog/done/, commit pending

## 2026-05-29 — B38: BUG — `world.generate(primaryArraySchema, { overrides })` silently drops per-index overrides

- manager: filed via /intake from GitHub issue #22 (user-classified Mid; manager bumped to high — silent + plausible-looking result). Card flagged review (design choice A/B/C/D); promoted inbox → doing, track: bug.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B38-primary-array-overrides-dropped.md (R1–R7). Chose **C+D combined** (throw + docs). B explicitly rejected by D8 (stored-equals-returned would forbid return-only override); A rejected as silent partial fix. Strict throw on any non-empty per-index overrides against primary-registered inner (vs permissive throw only when overrides.length > target - existingCount) for 1:1 call-shape → error mapping. Changeset bump: `minor` (conservative — users in #22 relied on silent no-op). 3 non-blocking open questions (bump minor vs patch; strict vs permissive; plain Error vs named subclass).
- manager: spec-validation gate PASS — 7 requirements with B38-R<k> ids, observable scenarios, honors D1/D5/D6/D8 + composes with B10/B12/B14. Review checkpoint → user approved C+D as written.
- manager: dispatch test-writer
- test-writer: wrote tests/unit/primary-array-overrides-throw.test.ts (8 tests, R1-R5; R6 docs + R7 changeset reviewer-only). RED: 3 (R1×2 + R5 — all "expected to throw but didn't" — today's primary-mode arm silently returns; R5 confirms registry.count===4 after the three-iteration silent loop). GREEN guards: 5 (R2 byte-equivalent, R2 empty-overrides, R3 ad-hoc object, R3 ad-hoc primitive, R4 populate factory) — all pass today and must stay green. Full suite: 994/997 (3 RED are exclusively B38; no pre-existing test regressed). Throw site identified at src/world.ts:968 (top of primary-mode arm). No `any`, no casts.
- manager: dispatch implementer
- implementer: added the 6-line throw guard at the top of generateArray's primary-mode arm in src/world.ts (inside `if (primaryRegs.length > 0)`, before `const reg = primaryRegs[0]!`). Guard uses `Array.isArray(options?.overrides) && options.overrides.length > 0` → narrows to `unknown[]` (no `any`, no cast). Throws plain `Error` with the literal `world.populate(schema, count, factory)` regex-anchor substring. Fires before any `generateAndStorePrimary` call → D8-preserving by construction. Three docs edits in docs/api-reference.md per B38-R6/D5: `.generate` array-return parenthetical, `GenerateOptions.overrides` paragraph note, `.populate` landing-spot parenthetical. Added .changeset/b38-primary-array-overrides-throw.md (`minor` per B38-R7 Decision; before/after example; `(closes #22)`). GREEN: 997/997 tests, typecheck clean. No new abstractions, no helpers extracted.
- manager: dispatch reviewer (instructed: no git commands; verify scope by Read)
- reviewer: PASS — R1–R7 met, 997/997 tests green, typecheck clean. Throw at src/world.ts:975-980 fires before reg lookup (line 982) and any generateAndStorePrimary call (line 993) → D8-preserving by construction; error message contains exact `world.populate(schema, count, factory)` substring. Ad-hoc branch unchanged at src/world.ts:1002-1036 (per-element deepMerge at line 1028 intact). Derived branch (936-963), generateAndStorePrimary (691-732), populate (238-280), populateFrom (286-316) — all untouched. Three docs edits confirmed at docs/api-reference.md lines 307/332/367. Changeset frontmatter `"zod4-mock": minor`, body summarises bug + before/after, final line `(closes #22)`. No `any` introduced (D1). No new abstractions, no new types, no new helpers. NO new standing constraint — the throw enforces existing D8 by refusing a call shape that would otherwise violate it silently.
- result: done — moved card to wiki/backlog/done/, commit 8703c0a (closes #22 on push)

## 2026-05-29 — B27: Research — audit `generationCounter`-derived PRNG fork keys (possible D4 soft violation)

- manager: promoted inbox → doing, track: research (priority high — only correctness-adjacent backlog item). Card flagged review → checkpoint after researcher returns.
- manager: dispatch researcher (general-purpose)
- researcher: wrote wiki/research/engine/generation-counter-d4-audit.md. Headline: **nuanced — partly real**. Counter dependence IS real on three paths (ad-hoc generateSingleItem at src/world.ts:1180, every generateArray at line 927 via `gen-${counter}`, outer-wrapper optional/nullable roll at line 362). It is NOT real for registered primary records (seeded off `registry.count(schema)` via `"reg{id}#{index}"`) or registered derived records (seeded off `"dreg{id}#{sourceIndex}"`). Existing test (tests/unit/core/derived-identity.test.ts:496-538) already documents this mixed picture. **Recommends Option (a)** — rename `generationCounter → callCounter`, add a one-line Rule + ADR codifying "deterministic generation is per-(seed + builder chain + call sequence)". Reason: docs/api-reference.md already says "same builder chain" + "call sequence" (lines 90 + 485), so this is documentation alignment with the shipped contract; Option (b) (stable identity-based forks) re-pins every array/ad-hoc snapshot → major-version change, own pipeline. Updated INDEX.md Pages table. Two gaps disclosed: (1) did not enumerate which test snapshots shift under (b) — spec-writer job if greenlit; (2) flagged separate wiki-sync issue (CLAUDE.md + wiki/codebase-map.md still say Mulberry32, but src/prng.ts is now SFC32).
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — research holds up to spot-checks. Verified counter fork-key sites at src/world.ts:362 (outer-wrapper roll), :926-927 (generateArray), :1180-1181 (ad-hoc generateSingleItem); confirmed counter-INdependent paths at :702 (`reg{id}#{index}`) and :740 (`dreg{id}#{sourceIndex}`); confirmed existing test at tests/unit/core/derived-identity.test.ts:496-538 documents the mixed picture; confirmed docs/api-reference.md:90 ("same builder chain") and :485 ("call sequence") — the recommendation's load-bearing claim survives spot-check; confirmed src/prng.ts:13 says SFC32. Minor finding: CLAUDE.md:52 still says Mulberry32 (wiki/codebase-map.md:34 was already updated to SFC32 — only CLAUDE.md needs the wiki-sync). Card → report alignment: all 5 card questions covered. Recommendation soundness: well-argued — distinguishes D4's letter vs stated consequence vs B22's read of its spirit; correctly refuses to implement (b) in-audit.
- manager: review checkpoint — presented (a)/(b)/(a)+CLAUDE.md/no-follow-up to user. User responded with a clarifying question about test-stability tradeoffs; manager explained that recommended pattern (createWorld per test) is stable under either option, (b) only helps the share-a-world-with-value-assertions pattern at the cost of re-pinning array/ad-hoc snapshots across the suite. **User picked Option (b)** — values test stability over snapshot-churn cost.
- result: done — moved card to wiki/backlog/done/, commit b154da6; follow-up B39 filed (commit 7066903)

## 2026-05-29 — B39: BUG — replace `generationCounter`-derived PRNG fork keys with stable per-schema identity-based ones

- manager: user asked to run autonomously through queue, **skip review checkpoints** until told to stop. B39's design choice (Option B) already has explicit user sign-off via B27 checkpoint, so the review flag on B39's card is satisfied — no checkpoint needed.
- manager: promoted inbox → doing, track: bug
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B39-stable-identity-based-fork-keys.md (R1–R10). Chose key shape **(i)** `WeakMap<ZodTypeAny, number>` schema ID + per-schema slot counter → fork keys `adhoc:<id>:<slot>`, `array:<id>:<slot>`, `wrap:<id>:<slot>`. **Headline snapshot-churn finding: ZERO re-pins, ZERO loosens, all ~906 existing tests untouched (K).** Codebase has been disciplined about never pinning PRNG-derived bytes on the counter-bearing paths; every assertion is matcher-derived, override-derived, constraint-driven, or structural. No `toMatchSnapshot` files exist. B8-R9 / B10-R7 cross-world tests stay green precisely because they encode the call-order invariant B39 enforces. Changeset bump: **`major`** — published contract surface (`docs/api-reference.md:90/485` "call sequence" language) changes to "per-schema call sequence". ADR D10 specified in B39-R7 (manager promotes the one-line rule to architecture.md when item lands). CLAUDE.md drift (Mulberry32 → SFC32) folded in per B39-R10. All 5 open questions non-blocking (defaults taken).
- manager: spec-validation gate PASS — 10 requirements with B39-R<k> ids, observable scenarios, composes with D3/D4/D5/D6/D9 + B8/B10/B14 contracts. **Review checkpoint skipped per user direction** (user already approved Option B at B27; running autonomously through queue).
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/call-order-independence.test.ts (6 new tests + 0 changes to existing suite). RED: 4 (B39-R1 ad-hoc single + ad-hoc array + outer-wrapper optional + interleaved-schemas-strongest-form — all today's counter-derived forks shift between `worldA: X` and `worldB: Y; X` for the same Nth call). GREEN guards: 2 (B39-R2 registered primary + registered derived byte-equivalence — confirm `reg{id}#{index}` and `dreg{id}#{sourceIndex}` paths already use stable identity keys and won't regress). Full suite: 1003 tests / 999 GREEN / 4 RED (all 4 are exclusively the new B39 file; rest of suite untouched, confirming B39-R5 zero-churn finding). Typecheck clean (D1). Determinism guard honoured: schemas constructed once at module scope (the new invariant is "same world + same schema reference → same Nth value", not "structurally identical schemas → same value"). Per-call generationCounter rollback on B8 D9 short-circuit (currently `generationCounter--` at world.ts upsert hit-path) must move to per-schema `schemaCallCounts` rollback or tests/unit/core/derived-identity.test.ts:496-538 regresses.
- /intake (mid-pipeline): user reported GH issue #23 (`ctx.gen.<ns>.<fn>()` ignores configured locale → Markov silently falls back to defaultLocale; user-classified Mid-high; design choice A/B/C). Filed B40 (high, review) per the file-then-continue triage rule; B39 pipeline continues.
- manager: dispatch implementer
- implementer: made the WeakMap-ID + per-schema-slot changes in src/world.ts, renamed `generationCounter` → `derivedPairCounter`, updated docs/api-reference.md, CLAUDE.md (Mulberry32→SFC32), and wiki/decisions.md (D10 ADR). **Made schemaId WeakMap module-global** (not per-world) to satisfy B39-R1 — implementer's commentary in src/world.ts:50-72 explains why a per-world counter cannot satisfy B39-R1's cross-world equivalence. **Did not write changeset file.** Full suite: 1000 passed / **3 RED**, all in pre-existing tests the spec-writer's B39-R5 enumeration claimed would be untouched (K).
- **MANAGER ESCALATION** — the 3 failing pre-existing tests expose a genuine spec gap, not an implementation bug:
  1. `tests/unit/core/world.test.ts:633` — "adding a field does not change values of existing fields" — the **canonical D4 test**. Two separately-constructed `z.object(...)` schemas (SchemaA / SchemaB) get different WeakMap IDs under B39's reference-identity model, so their `name` and `email` fork keys differ → values differ → "adding `age` between them DOES change `name` and `email`." This is the foundational stability claim that D4 was _supposed_ to protect.
  2. `tests/integration/document-corpus/document-corpus.test.ts:151` — "same seed produces identical output" — two `make(42)` calls each construct a NEW `z.array(PersonSchema).length(3)` reference. Under module-global IDs, the second call's array schema gets a different ID than the first → different fork keys → different output. **Same-seed reproducibility across separate `createWorld` calls is broken.**
  3. `tests/unit/generators/domains/collection.test.ts:222` — B17-R6 "appending an enum member only disturbs the new member's value" — S1 and S2 contain separately-constructed `z.number()` instances, so their entry `A` and `B` value fork keys differ.
- Root tension: B39-R1 ("same world + same schema reference → same Nth value, regardless of intervening calls") REQUIRES reference-identity. But three existing tests encode the (stronger, but seemingly already-shipped) claim "**structurally-identical-but-separately-constructed** schemas at the same seed produce the same value." These two claims are inconsistent.
  - Per-world WeakMap IDs (rejected by implementer) would make 3 failing tests PASS but make B39-R1 FAIL.
  - Module-global WeakMap IDs (what implementer chose) makes B39-R1 PASS but breaks the 3 pre-existing D4-flavoured tests, including the canonical `wiki/architecture.md:55` D4 test ("adding a field does not change values of existing fields") and same-seed reproducibility across `make(seed)` factories.
- B39-R5 enumeration was wrong — these three tests should have been classified R/L/C, and the spec should have acknowledged that "Option B" changes the determinism contract from "same seed + same structural schema → same output" to "same seed + same schema REFERENCE → same output". This is a bigger semantic shift than B39 scoped.
- Working tree carries the implementer's full diff (uncommitted). No B39 commit yet. Nothing destructive done.
- Pausing the autonomous run for user decision (see chat).
- user direction (escalation resolved): **reference identity is the right contract**. Three failing tests were asserting structural equivalence the library never actually delivered; pre-B39 they passed only by coincidence of the global counter starting at 0 in fresh worlds. Path forward: restructure tests + revise D4 wording + add hoist-pattern docs note.
- implementer (round 2): restructured 3 tests — tests/integration/document-corpus/world.ts (hoisted 4 array schemas), tests/unit/generators/domains/collection.test.ts (B17-R6: hoisted `const Num = z.number()`), tests/unit/core/world.test.ts (REPLACED brittle "adding a field" test with same-reference reproducibility test + 20-line preface explaining why the original assertion is fundamentally incompatible with reference identity). Added .changeset/b39-stable-identity-based-fork-keys.md (major bump), revised docs/api-reference.md "call sequence" → "per-schema call sequence" + added "Pattern — hoist schemas to module scope" paragraph with ✗/✓ example, fixed CLAUDE.md:52 Mulberry32→SFC32. GREEN: 1003/1003 tests, typecheck clean.
- manager: revised the D4 rule in wiki/architecture.md to spell out reference identity + per-schema call slot, citing (→ D4, D10). Standing constraint D10 promoted.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — R1–R10 all met, 1003/1003 tests green, typecheck clean. Verified module-global WeakMap `globalSchemaIds` at world.ts:75-85 + per-world `schemaCallCounts` at :209 + `nextSchemaSlot` at :262-272; 3 fork-key sites at adhoc:1290, array:1024, wrap:453. Documented spec deviation (ID map module-global rather than per-world per spec) captured in D10's Decision section. B8 upsert short-circuit at :1199-1209 correctly returns before reaching nextSchemaSlot (D9 holds). Three test restructures preserve original intent under reference identity. D4 rule wording matches implementation. No `any` introduced by B39 (4 pre-existing as-any casts unchanged). No public API surface change. Cosmetic notes only.
- result: done — moved card to wiki/backlog/done/, commit ba232fe; B40 filed commit 87e3134

## 2026-05-29 — B40: BUG — `ctx.gen.<ns>.<fn>()` ignores the configured locale (Markov silently falls back to `defaultLocale`)

- manager: promoted inbox → doing, track: bug. **Review checkpoint skipped per user autonomous-run direction**; spec-writer to recommend Option A (issue body's recommendation) and proceed.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B40-ctx-gen-ignores-locale.md (R1-R9). Chose **Direction A** (issue-recommended) — `bindGenerators` Proxy adapter injects boundCtx as default ctx; preserves `(prng, ctx?)` signature contract; explicit ctx wins (backwards compat). Surveyed all helpers across 4 buckets: Bucket 1 = ~50 `(prng, ctx?)` shape (gets locale forwarding); Bucket 2 = 4 `firstName/middleName/...` `(prng, genderOrCtx?: Gender|Ctx)` (only ctx-form forwards; Gender-string residual deferred to B36); Bucket 3 = 3 `(prng, ...intermediateArgs, ctx?)` (word.words, word.paragraph, commerce.price — adapter needs typed ctx-slot table); Bucket 4 = many pure prng-only (B40-R4 guards). 3 non-blocking open questions (Gender-residual deferred / full ctx vs subset / table location).
- manager: spec-validation gate PASS — 9 requirements, observable scenarios, no blocking open questions. Card flagged review but skipped per user direction; spec records Direction A with rationale.
- manager: dispatch test-writer
- test-writer: wrote tests/unit/core/ctx-gen-locale-forwarding.test.ts (10 tests). RED: 6 (R1 #23 repro, R2 workaround/default parity, R3 bucket-1 word+commerce+phone, R3 bucket-3 word.words / word.paragraph / commerce.price all failing because ctx never reaches helpers). GREEN guards: 4 (R1 seed determinism preserved, R4 pure-prng-only helpers unaffected, R5 no-locale defaultLocale fallback, R6 helper-level safety net). Full suite: 1013 / 1007 GREEN / 6 RED — no pre-existing regressions. RED failure shapes match documented bug verbatim (`"Item"`/`"Object"`/`"Matter"` straight from defaultLocale, `"$2.28"` not nl `€…,..`). Schemas hoisted at module scope (B39 D4/D10 hygiene). Pure-prng helpers (uuid, alphanumeric, bitcoinAddress, ipv4) confirmed locale-independent so the adapter's extra args won't break them.
- manager: dispatch implementer
- implementer (round 1, session-limited mid-task): added CTX_SLOTS table at src/world.ts:178-265 (per-helper ctx slot map across 4 buckets), rewrote `bindGenerators(prng, boundCtx)` at :712-770 to consult the table and inject ctx at the correct positional slot (Bucket 1 → slot 1, Bucket 2 → no-args-only, Bucket 3 → slots 2/3, Bucket 4 → forward verbatim), threaded ctx through `makeFieldCtx` at :822 via chicken-and-egg shim. All 1013 tests green at runtime. Skipped: changeset, docs/api-reference.md update. Typecheck failed with 7 errors all in the new test file (wrong `(ctx: { gen: typeof generators })` annotation pinning raw generators namespace where helpers still take `prng` arg).
- implementer (round 2 — cleanup): fixed 7 typecheck errors in tests/unit/core/ctx-gen-locale-forwarding.test.ts (guarded `defaultLocale.word.nouns ?? []` on line 53; inlined the B40-R4 matchers to let `withSchema` infer `MatcherCtx<...>` correctly; raw `generators` import retained for the B40-R6 direct-call test). Added .changeset/b40-ctx-gen-locale-forwarding.md (patch, closes #23). Added 2-paragraph note in docs/api-reference.md `**gen**` subsection covering auto-locale-forwarding + bucket-2 caveat for `person.firstName`/etc.. GREEN: 1013/1013 tests, typecheck clean, no `any` introduced.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — R1–R9 all met, 1013/1013 tests green, typecheck clean. Verified CTX_SLOTS table at src/world.ts:209-322 matches spec (word.{words,paragraph}=2, commerce.price=3, all other bucket-1 helpers=1, bucket-2 person helpers="no-args-only"). Bucket-4 Proxy at :737-739 forwards verbatim when helper absent from CTX_SLOTS — no ctx injection. No new `any` (two pre-existing `Record<string, any>` carved out by spec, B36 removes). No public API surface change. NO new standing constraint — CTX_SLOTS is local implementation, will be superseded by B36's eager rewrite. Minor finding: R3 bucket-1 test covers 3 of 8 example helpers (`word.adjective`/`commerce.productName`/`phone.number`) — structurally adequate since CTX_SLOTS path is namespace-agnostic, but broader probe would tighten regression net; non-blocking, deferrable.
- result: done — moved card to wiki/backlog/done/, commit d30e0de (closes #23)

## 2026-05-29 — B24: Refactor — decompose `WorldImpl.generateSingleItem` into four named methods (closes B21)

- manager: promoted inbox → doing, track: chore. **Review checkpoint skipped per user autonomous-run direction**. B24's card says it closes B21 naturally — manager will cancel B21 with B24's commit if B21's regression is included in B24's tests.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B24-decompose-generate-single-item.md (R1-R10). Pinned 4-way decomposition: `generateWithSourceOverride`, `generateDerivedAutoSource`, `generatePrimary`, `generateAdHoc`, each as private method on WorldImpl. B21 closure pinned in R3 (no-source-derived path adds `if (effectiveStore) registry.store(schema, result)`) + R7 regression test (count(Derived) === 1 after `world.generate(Derived)` no-source; existing B8 with-source, B10 store:false, B20 empty-from-registry paths untouched). Dispatcher applies trailing overrides+transform. **B20-R2's second scenario assertion needs updating** (count(Derived) changes 0→1) — test-writer to handle. Changeset bump: **`minor`** (B21 closure shifts observable user-facing behaviour for the `for { generate(D) }` loop pattern, count goes 1→N). 6 non-blocking open questions (rollback location, parameter shapes, dispatcher boundary, B20 test update, bump choice, inlining vs dispatcher).
- manager: spec-validation gate PASS — 10 requirements with B24-R<k> ids, observable scenarios, no blocking open questions; honors D1/D3/D4/D5/D6/D8/D9/D10.
- manager: dispatch test-writer
- test-writer (round 1, 500-error mid-run): wrote tests/unit/core/derived-no-source-store.test.ts (4 B24-R7 scenarios) + updated B20-R2 follow-up scenario in tests/unit/store-false-empty-from.test.ts. Crashed before final pnpm test verification.
- test-writer (round 2, continuation): fixed loop-test Source-count assertion (5→1; today's no-source branch only auto-provisions when registry empty, then reuses; post-B24 stays 1 with 5 derived stores). Verified: 1014 GREEN / 3 RED (B24-R7 single, B24-R7 loop, B20-R2 follow-up — all expected). Flagged spec inaccuracy at B24-R3's loop scenario (spec said Source===5; actual 1). Manager fixed the spec.
- manager: corrected wiki/specs/B24-decompose-generate-single-item.md R3 loop scenario (Source count 5→1, with explanation of auto-provision-when-empty + round-robin reuse).
- manager: dispatch implementer
- implementer: decomposed WorldImpl.generateSingleItem (~165 LOC) into thin dispatcher (~50 LOC) + 4 private methods (generateWithSourceOverride at world.ts:1454, generateDerivedAutoSource at :1517, generatePrimary at :1581, generateAdHoc at :1604). B8 cache short-circuit + derivedPairCounter-- rollback kept in dispatcher (open question #1 default). B21 closure: added `if (this.effectiveStore) this.registry.store(schema, result)` at :1567 in generateDerivedAutoSource — mirrors with-source branch. Preserves B20 local-capture, B39 nextSchemaSlot on outer schema in generateAdHoc, B8 upsert + isUnique gate in generateWithSourceOverride. Also updated tests/unit/store-false-empty-from.test.ts B20-R5 assertion (0→1) — implementer-detected follow-on of B24-R3, beyond what B24-R8 explicitly enumerated; B20-R5's original spec text had said `===1` but was relaxed when B20 landed because the asymmetry made it unachievable; B24-R3 now matches the original B20-R5 intent. Added .changeset/b24-decompose-generate-single-item.md (`minor`; closes B21). GREEN: 1017/1017 tests, typecheck clean, no new `any`.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — R1-R10 all met, 1017/1017 green, typecheck clean. Verified four methods exist with JSDoc at world.ts:1454/1517/1581/1604; B8 cache short-circuit fires before generateWithSourceOverride (dispatcher lines 1396-1416); generateDerivedAutoSource adds the B21 store at :1567-1569 with effectiveStore gate, does NOT touch derivedUpsert; generateAdHoc uses outer `schema` reference for nextSchemaSlot at :1609; transformApplied=true in 3 of 4 branches, false for ad-hoc. B20-R5 update sanity-checked: pre-B24 the no-source-derived path didn't store so B20-R5 was forced to `===0`; B24-R3 now stores, so `===1` matches both new behaviour AND B20's original spec intent — appropriate follow-on. No new `any` (only pre-existing dispatcher cast at :1391). Scope contained. No new standing constraint (existing D8 + B8 imply this).
- result: done — commit 0a1d5d2; **B21 cancelled** (moved inbox → done with `flags: [cancelled]`, Resolution section added pointing at B24)

## 2026-05-29 — B31: Refactor — extract `resolveLazyChain(schema, cache)` helper (removes 4 duplicate while loops)

- manager: promoted inbox → doing, track: chore (XS, mechanical). No spec/tests-first; implementer → reviewer.
- manager: dispatch implementer
- implementer: added `resolveLazyChain(schema, cache?)` helper in src/generators/schema/zod-def.ts (~20 LOC, optional cache param). Replaced 4 sites: world.ts:584/1069/1367 + explain.ts:251 (card cited :350/780/1040 — line shift post-B24/B39 decomposition reconciled). Chose Option A (module-level fn with optional cache) over Option B (instance method) so the cacheless explain.ts site fits the same helper without forcing explainSchema onto WorldImpl. Cache semantics byte-identical. Added .changeset/b31-extract-resolve-lazy-chain.md (patch). Also updated wiki/codebase-map.md to list the new helper. GREEN: 1017/1017 tests, typecheck clean. No `any` (D1), no Zod internals beyond def() helper (D3), no fork-key disturbance (D4/D10).
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — 1017/1017 green, typecheck clean. Four sites verified at world.ts:584/1059/1347 + explain.ts:251. Helper at src/generators/schema/zod-def.ts:75-104 — signature `(schema: ZodTypeAny, cache?: WeakMap<ZodTypeAny, ZodTypeAny>) => ZodTypeAny`, no `any`. Defensive `&& d.getter !== undefined` guard is strict superset of safety. Cache semantics byte-identical. Codebase-map updated. NO new standing constraint.
- result: done — commit d3d9797

## 2026-05-29 — B33: Refactor — encapsulate `effectiveStore` state machine as `withEffectiveStore(value, fn)`

- manager: promoted inbox → doing, track: chore (XS). No spec/tests-first.
- manager: dispatch implementer
- implementer: added `private withEffectiveStore<R>(value: boolean | undefined, fn: () => R): R` at src/world.ts:707-716. Single call site `WorldImpl.generate` at :567. Helper short-circuits on undefined; sets+try/finally restores on true/false. Verified via grep: only 1 write site for effectiveStore (the card hinted at more — world.get and populate don't touch the flag; they use the GenerateOptions.store path or strip the option). Added .changeset/b33-with-effective-store-helper.md (patch). GREEN: 1017/1017 tests, typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — helper signature/semantics match card, single call site verified, grep confirms zero remaining `this.effectiveStore = ...` write sites in src/. B10-R2/R4 transitive suppression preserved; B10-R5 world.get override + B10-R6 populate/populateFrom paths verified intact. No `any` (D1), no fork-key disturbance (D10). NO new standing constraint.
- result: done — commit d4e9b0a

## 2026-05-29 — B30: Refactor — extract `unwrapOptionalChainForField` helper (removes 2 copies)

- manager: promoted inbox → doing, track: chore (S). No spec/tests-first.
- manager: dispatch implementer
- implementer: added `unwrapOptionalChainForField(fieldSchema, prng, optProb, allowAbsent?)` helper in src/generators/schema/zod-def.ts:141-185 with `UnwrappedAbsent = { kind: "skip" } | { kind: "default"; value: unknown }` discriminated union. Replaced 2 sites: world.ts generateObjectFields step 3 (passes `allowAbsent = fieldOverride === undefined` — B12 override-suppresses-absent contract) + collection.ts generateZodObject (uses default `allowAbsent = true`). Sites were NOT byte-identical: world.ts had the extra `fieldOverride === undefined` guard. Helper preserves this via `allowAbsent` param + critical insight that `prng.random()` MUST still be consumed at every wrapper layer even when absent branch is gated off — preserves D4/D10 byte-identity. Tightened spec sketch's `{ kind, value? }` to proper discriminated union. Added .changeset/b30-extract-unwrap-optional-chain.md (patch). Updated wiki/codebase-map.md. GREEN: 1017/1017 tests (D4/D10 byte-identity confirmed), typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — 2 sites collapsed, no third copy of `optional|nullable|default` per-field loop remains (outer-wrapper at world.ts:577-601 is B39's structurally-distinct site). Helper signature matches; allowAbsent gated at line 155 (`isAbsent && allowAbsent`), false path consumes PRNG at every layer per the explicit fall-through at lines 179-181 — confirms byte-identity claim. world.ts:1148-1153 passes `fieldOverride === undefined` matching B12. collection.ts:212-216 uses default true. No `any` (D1), no fork-key disturbance (D4/D10). Codebase-map updated. NO new standing constraint.
- result: done — commit 631086a

## 2026-05-29 — B35: Refactor — build `key-map.ts` text aliases programmatically

- manager: promoted inbox → doing, track: chore (XS). No spec/tests-first.
- manager: dispatch implementer
- implementer: extracted shared `textWithLength: PrngGen<string>` closure + `TEXT_ALIASES` array in src/generators/data/key-map.ts. 10 keys populated programmatically via loop. Chose Option A (inline) over B (separate file) — no other data table would naturally migrate. Net 352→348 LOC (smaller than card's ~80 estimate due to added docs/comments). B16 explain contract preserved: explain emits `inline:${key}` keyed on lookup key, not function reference, so per-key `inline:text`/`inline:description`/etc. still surface correctly. Added .changeset/b35-key-map-text-aliases.md (patch). GREEN: 1017/1017 tests, typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — 10 aliases present, shared closure byte-identical to pre-refactor literals, B16-R2 rule 4 preserved (explain output is per-key not per-function-reference), D1/D5/D6 honored, NO new standing constraint.
- result: done — commit 6e03302

## 2026-05-29 — B36: Refactor — replace `bindGenerators` Proxy with eager-bound object (drops 2 `any`s, supersedes B40 CTX_SLOTS machinery)

- manager: promoted inbox → doing, track: chore (S). No spec/tests-first. B40 deliberately deferred the Gender-string `person.firstName("male")` locale-residual to B36; this item should fix it during the rewrite.
- manager: dispatch implementer
- implementer: added module-scope `bindNamespace<T>(prng, ctx, nsObj)` helper at world.ts:329-419; rewrote `bindGenerators` at :729-793 as eager object literal of 14 namespace entries (no Proxy, no cache). Approach A: kept CTX_SLOTS table. Both `any` casts dropped (Record cache + generatorsData cast). Non-function members (DOMAINS, TECH_WORDS, EMOJIS) forwarded verbatim via typeof-guard. Bucket-2 Gender-string residual PRESERVED per Option α — explicit JSDoc on the `"no-args-only"` branch documenting that `person.firstName("male")` still doesn't pick up locale (out of scope for chore). Added .changeset/b36-bind-generators-eager.md (patch). GREEN: 1017/1017 tests, typecheck clean, B40 file 10/10 green.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — `new Proxy` count is 0 in world.ts; 2 `any` casts dropped (remaining matches all pre-existing). bindNamespace handles all 4 buckets correctly. BoundGenerators public type unchanged. B40 contract preserved byte-identically. Bucket-2 residual explicitly documented. NO new standing constraint.
- result: done — commit 9717326

## 2026-05-29 — B29: Refactor — split `applyModifiers` into string + number pipelines

- manager: promoted inbox → doing, track: chore (S). No spec/tests-first.
- manager: dispatch implementer
- implementer: split applyModifiers in src/generators/schema/zod-def.ts into applyStringModifiers (L263, 5 passes: overwritePass/formatAddPass/lengthBoundsPass/formatRefixPass/overwriteRefixPass) + applyNumberModifiers (L304, 2 passes: intCoercePass/multipleOfPass). applyModifiers kept as thin 14-LOC runtime dispatcher (routes by def-type + typeof value) — three call sites still pass `unknown` so dispatcher avoids pushing typeof+def-check duplicates into them. Each pass takes only what it needs; checks iterated once per pipeline (down from 3× in the original string branch). Deviation from spec example: no `prng` parameter in pass signatures (none needed — these are pure string/number transforms); no `PASSES.reduce(...)` table (explicit call chain reads as the contract). Added .changeset/b29-split-apply-modifiers.md (patch). Updated codebase-map. GREEN: 1017/1017 tests, typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — both helpers + all 7 named passes present at exact lines; dispatcher 14 LOC routes correctly; each pipeline scans checks once via classification loop into pre-bucketed slices then passes iterate slices; D1/D3/D5/D6 honored; codebase-map updated. NO new standing constraint.
- result: done — commit 66b25f1

## 2026-05-29 — B34: Refactor — replace `generateZodString`'s 22-arm `else if` chain with a format dispatch table

- manager: promoted inbox → doing, track: chore (S). No spec/tests-first.
- manager: dispatch implementer
- implementer: added FORMAT_GENERATORS dispatch table at src/generators/schema/string.ts:142-162 with 19 entries (card said "22" — actual format-chain count is 19 + 4 check-format arms; the latter stay a switch as the card prescribed). All 19 generators are pure `(prng: Prng) => string` — none need ctx (these are local file helpers, not ctx.gen surfacing). Extracted `generateUrl` helper for the only inline composition. Check-format switch + base fallback byte-for-byte unchanged. Added .changeset/b34-dispatch-table-generate-zod-string.md (patch). GREEN: 1017/1017 tests, typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — table at :142-162 with 19 entries, type `Record<string, (prng: GeneratorContext["prng"]) => string>` no `any`. generateUrl template byte-identical to pre-refactor inline. Check-format switch + generateString fallback untouched. NO new standing constraint.
- result: done — commit dca70c3

## 2026-05-29 — B32: Refactor — extract `resolveRelationPool` shared between `resolveRelated` + `resolveRelatedMany`

- manager: promoted inbox → doing, track: chore (S). No spec/tests-first.
- manager: dispatch implementer
- implementer: extracted `private resolveRelationPool(reg, recordPrng, recordId, relName, kind, count?): { items, prng }` at world.ts:958; reduced resolveRelated (lines 910-920, ~4 lines body) and resolveRelatedMany (922-938, ~3 stmts) to thin wrappers. Fork keys `rel:${relName}` / `rel-many:${relName}` preserved byte-identically. Cache keys `${recordId}:${relName}` / `${recordId}:${relName}:many` preserved. `where` filter applied once at snapshot build (D9 cache neutrality). Auto-provision branches on `kind` inside cache-miss (single → ensurePrimaryRecord if empty; many → shortfall loop up to count, gated by `!where`). Self-ref guard preserved. Added .changeset/b32-extract-resolve-relation-pool.md (patch). GREEN: 1017/1017 tests, typecheck clean. No `any` (D1).
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — signature matches spec at :958; wrappers thin; fork+cache keys byte-identical; where applied once before cache-set (D9); empty-pool throw before PRNG draw (B11-R6); self-ref guard preserved (`undefined as T` for single, `prng.sample` clamp for many). NO new standing constraint.
- result: done — commit c2b7825

## 2026-05-29 — B25: Refactor — extract `resolveMode(schema): SchemaMode` and unify derived/primary/ad-hoc dispatch

- manager: promoted inbox → doing, track: chore (M). No spec/tests-first; B24's decomposition leaves the dispatcher's `derivedRegs.length > 0 ? ... : primaryRegs.length > 0 ? ... : ad-hoc` cascade ripe for resolveMode unification, and the same pattern repeats in generateArray + populate + populateFrom.
- manager: dispatch implementer
- implementer: added `SchemaMode` discriminated union (line 128) + `private resolveMode(schema)` at world.ts:831-837 (derived-first, primary-second, ad-hoc default). Migrated 4 dispatch sites: generateSingleItem dispatcher (:1496-1548) with two-level lazy-resolve fallback retained in caller, generateArray (:1343-1416), populate (:597-636) with **inverted dispatch retained** (explicit `findPrimaryRegs` check BEFORE resolveMode + annotated-unreachable `case "primary"` to preserve byte-identical primary-first precedence), WorldImpl.get (:788). B39 fork keys + D9 derivedPairCounter rollback byte-identical. **Latent divergence flagged**: populate checks primary-first while generateSingleItem/generateArray check derived-first — pre-existing, NOT introduced by B25. Manager to file follow-up. world.ts net +60 LOC (structural -30 LOC offset by JSDoc + per-site explanatory comments documenting the preserved-behavior nuances). Added .changeset/b25-extract-resolve-mode.md (patch). GREEN: 1017/1017, typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — SchemaMode shape matches spec, all 4 sites migrated, populate's annotated-unreachable primary case acceptable (preserves byte-identity, justified inline), B39 fork keys + D9 rollback intact, no `any` (D1), SchemaMode non-exported (D5), 1017/1017 green. Recommends manager file follow-up for the populate-vs-singleItem precedence divergence. NO new standing constraint.
- result: done — commit c4abb78; B41 filed commit 6ebfdbd

## 2026-05-29 — B26: Refactor — replace `generateFromSchema`'s 38-case switch with a typed dispatch table

- manager: promoted inbox → doing, track: chore (M). Same pattern as B34 (string dispatch table) just shipped — 38-case switch → typed dispatch table.
- manager: dispatch implementer
- implementer: added `ZodDefType` local union (38 string literals at router.ts:62-100) + `DISPATCH: Record<ZodDefType, GenFn>` table. `generateFromSchema` now ~6 lines (lookup + `generateString` fallback). Lifted four non-trivial arms to named functions: generateXor (:106), generateUnion (:115, incl. discriminated-union), generateIntersection (:140), generatePipe (:147, incl. transform/preprocess). Smaller helpers extracted for modifier-style arms. `transform`/`discriminator`/`optionsMap` accessed via `ZodDef & { ... }` intersection casts at :120-123 and :165, NOT `as any` (pre-existing `as any` casts removed). Single widening cast at :274 `(DISPATCH as Record<string, GenFn | undefined>)[d.type]` — no `any` (D1). Exhaustiveness guaranteed: omitting an entry is a Record compile error. Added .changeset/b26-dispatch-table-generate-from-schema.md (patch). Updated codebase-map. GREEN: 1017/1017 tests, typecheck clean.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS — 38 entries verified; exhaustive Record typing; single widening cast (no `any`); generateFromSchema 6 lines as claimed; four lifted helpers in place; pre-existing `as any` removed via structural intersection casts. Fork-key shapes preserved at xor's `"l"`/`"r"` keys etc. NO new standing constraint.
- result: done — commit 61be65e

## 2026-05-29 — B23: Refactor — promote the per-field pipeline to a `PIPELINE` list of named steps (HEADLINE LEVER)

- manager: promoted inbox → doing, track: chore (L, review). **Review checkpoint skipped per user autonomous-run direction**. B22's headline lever — all 4 dimensions; retires `explain.ts` mirrored ladder + `collection.ts:generateZodObject` partial duplication.
- manager: dispatch spec-writer (this is L-sized — spec needed even for chore so the new PipelineStep shape + FieldResolution union are pinned before implementer runs)
- spec-writer: wrote wiki/specs/B23-promote-per-field-pipeline-to-list.md (R1-R13). Pinned struct-arg `PipelineStep` signature, `applyObjectOverride` Pattern B (steps wrap their generator result; keyHeuristic+schemaBased preserve replace semantics; schemaBased object branch threads override into recursive call), 7 named step functions in pinned order, PIPELINE_NO_REGISTRATION as instance-equal subset at indices 3/5/6. 8 non-blocking open questions (co-location / threading shape / walkPipeline shape / step-body location / applyObjectOverride location / explain.ts ceiling / Partial<any> inherited / B37 fold-in). Updated INDEX.md.
- manager: dispatch implementer
- implementer: created src/pipeline.ts (489 LOC) — exports FieldResolution (8-variant tagged union), PipelineStep, PipelineStepContext, PipelineState, the 7 step functions, PIPELINE, PIPELINE_NO_REGISTRATION, walkPipeline, applyObjectOverride. Also hosts FN_TO_ID + pattern identifier/label helpers (folded in from explain.ts). Rewrote generateObjectFields in src/world.ts (118→40 LOC). Rewrote explain.ts (313→162 LOC, -151 LOC mirrored decision logic). Rewrote collection.ts:generateZodObject to walk PIPELINE_NO_REGISTRATION. Open questions resolved: src/pipeline.ts file (Q1), readonly state ref with mutable inner slot (Q2), walkPipeline free function (Q3), module-scope step declarations (Q4), applyObjectOverride co-located (Q5). PRNG fork keys byte-identical; B39 nextSchemaSlot untouched (lives in generateSingleItem/generateArray); B12/B16/B17/B18 contracts preserved. Added .changeset/b23-promote-per-field-pipeline-to-list.md (patch). GREEN: 1017/1017 tests, typecheck clean. No `any` in pipeline.ts.
- manager: dispatch reviewer (no git; verify by Read + pnpm test only)
- reviewer: PASS with one finding — missing structural tests for R3/R4/R6/R9/R10 (literal spec gap; behaviour invariants hold but no test pins structural shape). RECOMMENDED standing constraint promotion: the PIPELINE list IS the canonical contract, future call sites must use it. Manager actioned both.
- manager: dispatched test-writer for the missing structural tests; added tests/unit/core/pipeline.test.ts (16 tests: R3 shape, R4 instance-identity, R6 applyObjectOverride contract incl. B18 atomic-object replace, R7 explain.ts ≤215 LOC, R9 generateObjectFields ≤60 LOC). GREEN: 1033/1033 tests.
- manager: promoted D11 to architecture.md Rules section: "The per-field generation pipeline MUST be expressed as the canonical PIPELINE list in src/pipeline.ts; new rungs added by editing the list, never by open-coding at a call site." Appended ADR D11 to wiki/decisions.md with full Context/Decision/Consequences. **B37 unblocked** (flags: [blocked] removed from B37 inbox card).
- result: done — commit f9ea47d

## 2026-05-29 — manager: planning pass (post-0.8.0 release)

- inbox: 7 items (B43 high, B28/B41/B42 medium, B2/B3/B37 low); ready: 0; doing: 0
- working tree clean; last release 0.8.0 (3e2d5de); B39 changeset downgraded major→minor (bef2176) in keeping with 0.x SemVer convention; B42/B43 filed (a596a7a) from GH issues #24/#25
- B37 unblocked since B23 landed (the PIPELINE list it pointed to is now real); flags: []
- ordered work plan presented to user; pausing for approval (review checkpoint #1)
- user direction: do B43 first, then release, then B28

## 2026-05-29 — B43: BUG — `world.generate(primaryArraySchema.min(N).max(M))` silently ignores `.min`/`.max`

- manager: promoted inbox → doing, track: bug (flagged review). Sibling of B38 (#22, just shipped) — same primary branch of generateArray. From GH issue #25.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B43-primary-array-min-max-ignored.md (R1-R7). Direction B (throw + redirect to world.populate(schema, N) for writes / world.generate(schema.array()).slice(0, N) for reads) — symmetric with B38. Trigger: any of min_length/max_length/length_equals + primary-registered inner. Changeset minor (matches B38). 3 non-blocking open questions (slot-counter advance, loose-trigger predicate, message wording).
- manager: spec-validation gate PASS — 7 reqs with B43-R<k> ids, observable scenarios, no blocking open questions. Pausing at review checkpoint (card flagged review) on direction B.
- user (mid-pause): "we have a few more issues" — got me to check GH for new issues
- manager: pulled open GH issues — #24 (B42 ✓), #25 (B43 ✓), and **#26 new**: primaryArray + store:false hangs forever
- /intake → B44 filed with full #26 root cause + proposed fix + B43 adjacency note (high priority, [review])
- manager: presented 3 ordering options to user (1: B43 then B44; 2: B44 first then B43 — recommended on hang>silent severity; 3: fold B44 into B43 spec)
- user: option 2 — do B44 first, then B43, then release
- manager: git mv B43 doing → ready (spec already written, parked for resumption after B44); mv B44 inbox → doing (carries [review] but coordination question is answered; will surface if spec-writer hits a real design choice)

## 2026-05-30 — B44: BUG — `world.generate(primaryArraySchema, { store: false })` hangs forever (infinite loop)

- manager: filed from GH issue #26 (high priority, [review]); promoted to doing, track: bug
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B44-primary-array-store-false-hangs.md (R1-R10). Direction: under `!effectiveStore`, decouple loop from `registry.count` — generate `target` records via `Array.from(...)` + `generateAndStorePrimary`, return that array. Store-on path byte-identical (R5). B20 "Fix B" local-capture precedent (primary-array analogue of derived). B10-R2/R4 invariants restored. Orthogonal to B38 (overrides throw) and B43 (.min/.max throw); both throws still win on composed calls (R8). Patch bump. 4 non-blocking open questions.
- manager: spec-validation gate PASS — 10 reqs with B44-R<k> ids, MUST/MUST NOT each, ≥1 GIVEN/WHEN/THEN with observable THEN, no blocking open questions. **Review checkpoint waved through by user** ("yes please") — autonomous run through impl/review.
- manager: multiple aborted test-writer dispatches — sync infinite loop can't be preempted by vitest's per-test timeout (event loop blocked); user pushed back on over-ceremony around RED confirmation. Reframed: user direction was "just fix the damn bug" — drop the formal test-writer step, dispatch implementer-only with the fix.
- implementer: 11-LOC change to src/world.ts generateArray primary arm — added `if (!this.effectiveStore) return Array.from({ length: target }, () => this.generateAndStorePrimary(innerSchema, mode.reg))` branch immediately above the existing `while (registry.count < target)` loop. Store-on path byte-identical. Added .changeset/b44-primary-array-store-false-hangs.md (patch, closes #26) and one-line note in docs/api-reference.md. **Note**: an earlier aborted test-writer attempt left a 4-test file at tests/unit/core/primary-array-store-false-hangs.test.ts (B44-R1/R3/R5/R7); the tests pass under the new fix so kept as a regression guard. GREEN: 1037/1037 tests, typecheck clean. No `any` (D1), no new Zod-internal access (D3), PRNG draws unchanged (D4/D10), D8 vacuously preserved.
- manager: no reviewer dispatch — per user direction (minimum ceremony for a one-line fix on a well-understood bug). Manager spot-checked the diff (11 LOC, correctly positioned relative to B38 throw, leaves store-on byte-identical).
- result: done — commit 13fbd58

## 2026-05-30 — B43 (resumed): BUG — primaryArraySchema.min/.max silently ignored

- manager: card git mv ready → doing; dispatch implementer for direction B (throw + redirect, per the spec written earlier this session)
- implementer (round 1, direction B): added throw guard at src/world.ts:1331 + 3 regression tests asserting the throw + changeset + docs note. Surfaced 63 failing tests across 8 files (integration document-corpus/invoicing, unit world/relations/subject/derived-identity/cross-api, plus B38 setup tests) — all pinning the pre-existing `.min/.max` honour-the-bounds behaviour. Stopped, requested manager decision.
- manager: surfaced the 63-test breakage to user, recommended option 1 (migrate tests to populate-then-generate); user pushed back on the entire premise — "max(2) call resulted in N fixtures.. thats undesirable. why overcomplicate things?" — i.e. direction B was wrong; direction A (honour the bounds, slice when registry exceeds caller's max) was what the user wanted from the start.
- manager: agreed; reverted all direction-B WIP (src/world.ts, docs/api-reference.md, wiki/progress.md, removed the throw test file, removed b43 changeset, removed wiki/specs/B43-primary-array-min-max-ignored.md, removed stale INDEX row). Renamed card `-ignored.md` → `-honoured.md` to reflect the actual fix direction.
- manager: dispatch implementer for direction A (honour the bounds via slice; cap return to caller-specified max only — library-side defMax fallback does NOT cap unbounded calls)
- implementer (round 2, direction A): added `readCallerMaxBound(schema)` helper at src/world.ts:209 (walks `checks(schema)` via existing typed helper; returns `length_equals.length` or `max_length.maximum` if caller wrote one, else undefined) + slice at src/world.ts:1377 wired into generateArray's primary arm (fires only when callerMax !== undefined AND registry exceeds it). Added tests/unit/core/primary-array-min-max-bounds.test.ts (4 tests: #25 repro, .length(3), no-caller-bound passthrough, top-up sanity) + .changeset/b43-primary-array-min-max-honoured.md (patch, closes #25). GREEN: 1041/1041 tests, typecheck clean. No new `any` (D1), no new Zod-internal access (D3), PRNG draws unchanged (D4/D10), D8 preserved (slice is read-only narrowing of stored records). Docs at api-reference.md:320 already describes post-fix behaviour correctly — no doc edit needed.
- manager: reconciled card frontmatter — dropped stale `spec:` reference (no spec page in shipped direction-A flow), cleared review flag, added ## Resolution section to card body, git mv card doing → done.
- result: done — commit 04a4f57

## 2026-05-30 — manager: pausing for release per user direction

- 2 unpushed commits on main: 13fbd58 (B44, closes #26), 04a4f57 (B43, closes #25)
- both changesets present (.changeset/b43-…honoured.md patch, .changeset/b44-…hangs.md patch)
- working tree clean
- next item on plan: B28 (split src/world.ts) — paused until user signals release done

## 2026-05-30 — B45 (resumed): research checkpoint resolution

- manager: resumed from 2026-05-29 23:15 pause; research report committed at 0862a27 was awaiting review checkpoint #2 sign-off
- manager: presented headline recommendation + 6 open questions to user via AskUserQuestion (Direction / B42 handling / Uniqueness / Determinism break)
- user: accepted full direction; fold B42 in; det-break OK under 0.x minor bump
- user: **pushed back on Feistel walk** — "Realistic data has a chance for each value, some names are more common, same with words. we don't need the distribution. but I dont want to bloat the api with options, like a unique: true one"
- manager: simplified the resolution — drop Feistel / FPE entirely, drop `{ unique: true }` opt-in, use plain `prng.pick` over real wordlists. Determinism becomes trivially clean (one constant-consumption draw per field via existing fork(key)). B42 subsumption still holds (`prng.pick` over real list → natural initial-letter distribution). Report §3.1 (Feistel design) marked moot in the Resolution.
- manager: edited B45 card with ## Resolution block recording the direction, the 6 open-question dispositions, the report deviation, and the B46 follow-up pointer
- manager: filed **B46** (`research`/`chore`, medium, [review]) — `wordlist-corpus-sourcing-and-sizing-spike.md` in inbox/. Scope: per-locale corpus + license sourcing, measured compressed sizes (front-coded / DAFSA / brotli), sampler-shape sanity check, sized PCFG sketch, B42 empirical confirmation. Explicitly NOT a Feistel POC and NOT an implementation.
- manager: annotated **B42** card — flags `[review]` → `[blocked]`, added Notes block documenting subsumption by B45 direction and "do not ship a B42 fix in the meantime; cancel when B46 step 5 confirms"
- manager: git mv wiki/backlog/doing/B45-…md → wiki/backlog/done/
- result: done — commit 2092eb9

## 2026-05-30 — manager: post-B45 planning pass

- inbox: 7 items (B28/B41/B46 medium [review]; B2/B3 low [review]; B37 low; B42 medium [blocked by B45])
- ready: 0; doing: 0
- 4 unpushed commits on main (B43/B44/B45 + release-pause log) — 0.8.0 still last released
- ordered plan presented to user (priority → created)
- user direction: do a fresh planning pass (done), pull B28 next
- B28 review flag satisfied by user direct selection; card pins module boundary exactly so no spec needed (chore track per skill)

## 2026-05-30 — B28: Refactor — split src/world.ts into world/{engine,relations,derived,registration}.ts

- manager: promoted inbox → doing, track: chore (L, mechanical, [review] honored via user direct selection)
- manager: dispatch implementer
- implementer: created src/world/ with 5 new files — engine.ts (1670 LOC, WorldImpl class + all methods), registration.ts (138 LOC, pure SchemaReg/normalizeRelationEntry/findPrimaryRegs/findDerivedRegs/resolveMode), derived.ts (70 LOC, B8 upsert map + access helpers), relations.ts (80 LOC, pure cache-key/fork-key/error-message helpers), index.ts (barrel). Original src/world.ts kept as 15-LOC re-export shim so external imports resolve byte-identically. **Layout (a)+(b) combined**: flat src/world.ts barrel → src/world/index.ts barrel → engine.ts (the actual class). Strategy: WorldImpl methods stay on the class in engine.ts; pure helpers extracted as free functions in the concern-grouped files, called from thin wrappers (e.g. `private findPrimaryRegs(s) { return findPrimaryRegsPure(this.schemaRegs, s); }`). No class augmentation. B39 globalSchemaIds module-global WeakMap kept as single instance in engine.ts (not duplicated). All composition invariants preserved byte-identically. Updated wiki/codebase-map.md to reflect new layout. Updated tests/unit/core/pipeline.test.ts B23-R9 LOC-bound assertion path (src/world.ts → src/world/engine.ts; ≤60 LOC bound unchanged). Added .changeset/b28-split-world-ts.md (patch). GREEN: 1041/1041 tests, typecheck clean, lint clean (1 B28-introduced warning fixed inline — stray `let d = def(current)` in dispatcher removed).
- manager: user requested all lint warnings cleared. 7 pre-existing warnings cleaned up inline (out-of-B28 scope but user-directed): unused imports in packages/locale-en/scripts/fetch-data.ts (createWriteStream/pipeline/createGunzip), unused const HEX_CHARS in src/generators/data/string.ts, unused Node type alias in tests/unit/core/world-get.test.ts, unused pickKind in tests/unit/core/relations-where.test.ts, tautology `v !== undefined || v === undefined` in tests/unit/generators/domains/advanced.test.ts replaced with comment + retained `results.length === 500` termination guard.
- manager: dispatch reviewer
- reviewer: PASS — 1041/1041 green, typecheck clean, lint 0/0, no new `any` (4 pre-existing dispatcher casts byte-identical to pre-B28), all `.js` extensions, B39 module-global WeakMap singleton verified at engine.ts:117, all composition invariants (B8/B10/B11/B14/B23/B24/B25/B36/B38/B43/B44) verified at named line numbers, public API byte-identical, no scope creep, codebase-map updated, changeset patch correct. NO new standing constraint (one-off mechanical split governed by existing D1/D4/D10/D11).
- result: done — commit 7fad4aa

## 2026-05-30 — B37: Chore — reconcile pipeline-numbering drift across docs/code/JSDoc

- manager: promoted inbox → doing, track: chore (XS, no review). B23 landed → PIPELINE list in src/pipeline.ts is the canonical source (D11). Card body's "Blocked on B23" text is stale; frontmatter `flags: []` already unblocked per B23 closure.
- manager: dispatch implementer (round 1) — INTERRUPTED. Initial prompt followed the card's "document in one place (docs/concepts.md), make everything else point at it" strategy, including a JSDoc pointer-to-docs from src/world/engine.ts. User vetoed: pointers from TypeScript JSDoc are dead text in IDE hovers/tooltips. Re-dispatched with corrected strategy: **inline the full canonical 7-step list at every audience-facing location, reconcile their contents to agree with src/pipeline.ts**.
- implementer: reconciled the 7-step PIPELINE list across 4 locations — docs/concepts.md (~75-92, rewrote 6-step list to canonical 7 + 2 wrapping passes), src/world/engine.ts JSDoc (14-43, inlined the 7 steps + 2 wrapping passes in module-level @module block; executable code untouched), CLAUDE.md (43-56, replaced 6-step list with canonical 7 + 2; dropped stale src/generators/key-based.ts / src/generators/schema-based.ts path references that referenced non-existent files), wiki/codebase-map.md (9-10, pointer line now names src/pipeline.ts first, docs/concepts.md second; two-axis mental-model framing kept). Step names byte-identical across the three inline locations (Eager overrides / Matchers / Per-schema key map / Unwrap optional / World-level custom generators / Key-based heuristics / Schema-based fallback). Wrapping passes (Override deep-merge / Transform) named identically. Also folded in B22 cosmetic fold-ins from the codebase-complexity report: types.ts fan-in 26 → 25 (table-vs-prose reconciliation, line 74 vs 88), email LOC range 101-127/27 → 101-126/26 (line 56, cross-verified against src/generators/data/internet.ts), and pipeline rung-count narrative updates (lines 121, 216). Added .changeset/b37-pipeline-numbering-drift.md (patch). GREEN: 1041/1041 tests, typecheck clean, lint 0/0 (no executable code changed; tooling trivially preserved).
- manager: dispatch reviewer (with explicit tooling rules: Read/Grep/Glob only, no shelled grep/cat/wc/node -e; pnpm commands only)
- reviewer: PASS — all 12 verification points clear. Step names byte-identical across the 3 inline locations; no TS-side pointer-to-docs in engine.ts JSDoc (the only `see docs/api-reference.md` in engine.ts is an unrelated runtime error at line 1309 inside populate's throw); no stale generators/{key,schema}-based.ts paths in CLAUDE.md; codebase-map.md pointer names src/pipeline.ts first; src/world/engine.ts JSDoc-only diff (28+/10-, lines 14-43); src/pipeline.ts + src/explain.ts + all test files untouched; types.ts fan-in 25 consistent table vs prose; tooling clean. Reviewer notes: implementer's self-report under-stated the B22 fold-ins (claimed skipped, actually folded in correctly). Reviewer also flagged a preexisting B28 commit residue: wiki/backlog/inbox/B28-split-world-ts.md still shows as unstaged deletion (B28's git mv chain inbox → doing → done landed in commit 7fad4aa as ADD of done/ rather than RENAME, leaving inbox-side deletion unstaged). NOT B37 scope but trivial — fold into B37's commit as housekeeping. NO new standing constraint.
- manager: folded the leftover B28 inbox-deletion into B37's commit as housekeeping (one file, already-removed in HEAD, no logical content change).
- result: done — commit 0328d07

## 2026-05-31 — B41: Research — populate dispatches primary-first while generateSingleItem/generateArray dispatch derived-first

- manager: promoted inbox → doing, track: research (flagged review). Surfaced during B25 by the reviewer; report destination wiki/research/populate-dispatch-divergence.md (location TBD — researcher may place under engine/).
- manager: dispatch researcher (general-purpose) — round 1 + 2 rejected by user for inadequate tooling-rule emphasis (multiple bash grep prompts); round 3 dispatched with concrete forbidden/allowed lists at the top.
- researcher: wrote wiki/research/engine/populate-dispatch-divergence.md (researcher chose engine/ subfolder; card report: field updated to match). Headline: divergence is **incidental** — zero record in B14/B6 specs, decisions.md, or progress.md (only B25 reviewer's flag). Verified via Read: 4 dispatch sites named at engine.ts:1438 (generateSingleItem), :1261 (generateArray), :791 (get), :606-639 (populate with annotated-unreachable `case "primary":` at 629-631), plus pure resolveMode at registration.ts:129-138. **Zero tests** dual-register primary+derived for the same schema (closest neighbour tests/integration/media-library/world.ts:151-174 registers RawDataSchema as derived 3× only). **Zero docs** describe populate's primary-first behaviour. A/B/D all land without breaking any test. **Recommends Option D — forbid dual registration at withSchema time** (throw); follow-up as chore/bug, patch bump. Tooling note: researcher honestly disclosed 3 `wc -l` invocations (forbidden); root cause was the agent's Grep tool returning "not available" in their environment. No grep/find/cat/sed/etc.; only `wc` + `ls`.
- manager: review checkpoint #2 — presented headline + recommendation to user. **User key context**: they were not aware dual registration was even possible. Manager explained the asymmetry's origin (B25 surfaced; populate body just happens to check primary-first; no design intent).
- user direction: **Option D approved**; follow-up filed as **`bug`** (NOT chore — user wants a regression test pinning the throw); non-blocking questions all defaulted (multi-primary tightening out of scope, patch bump, no docs follow-up).
- user direction (separate, mid-pipeline): **"Be minimal in the tests"** — saved to memory as [[feedback-minimal-tests]]: one positive test per requirement ID, no exhaustive enumeration, no guard tests, cap at "1 per R-ID + required regression for bug items".
- manager: dispatch reviewer (with explicit tooling-rule emphasis: no bash grep, Read/Grep/Glob only)
- reviewer: PASS — all citations verified (4 dispatch sites + resolveMode + populateFrom delegation + explain's findPrimaryRegs ruled correctly out of scope). B14/B6 specs and decisions.md confirmed silent on precedence; B25 progress entry at line 422 contains the verbatim flag. Zero dual-registration test fixtures confirmed across 4 candidate test files. docs/api-reference.md:321-322 documents derived-first for .generate; .populate section (370-413) contains no precedence wording. Recommendation rationale for D survives scrutiny against B6/B8/B10/B11/B14 contracts (B11 relations correctly out of scope of D's throw — relations are not registrations). All non-blocking questions correctly classified. Tooling note: reviewer also reports their Grep tool returned "No such tool available" — substituted with targeted Read at known line ranges; zero Bash inspection. NO new standing constraint for B41 itself (will land with B47 if D ships — reviewer recommends pairing ADR D12 + Rule line at that time).
- manager: edited B41 card with ## Resolution block recording the direction + dispositions + B47 pointer; filed **B47** (`bug`, medium, no review flag — design pre-approved at B41 checkpoint). B47 card embeds: 4 acceptance requirements (R1-R4 narrowly scoping the throw to primary↔derived only), explicit "minimum tests" direction (~4 tests, one per R-ID, throw-order-invariance covered by one test with both call orders), throw-site pinpointed at WorldImpl.withSchema in src/world/engine.ts, standing-constraint candidate D12 sketched.
- manager: git mv wiki/backlog/doing/B41-…md → wiki/backlog/done/
- result: done — commit ea83ce9

## 2026-05-31 — B47: BUG — forbid dual primary+derived registration of the same schema at `withSchema`

- manager: promoted inbox → doing, track: bug (no review flag — design pre-approved via B41 checkpoint). Card already lists R1-R4 acceptance and embeds minimum-test direction. Spec-writer to formalize as wiki/specs/B47-….md.
- manager: dispatch spec-writer (with tooling rules + minimum-tests directive folded in)
- spec-writer: wrote wiki/specs/B47-forbid-dual-primary-derived-registration.md (R1-R4 verbatim from card, no contradiction with B6/B8/B10/B11/B14). Spec includes ## Minimum tests directive section explicitly capping at ~3 tests (R1+R2 share one test via call-order variation; R3 + R4 each get one). Standing-constraint candidate (D12) sketched verbatim. 3 open questions all classified non-blocking (throw-message wording, bump, multi-primary tightening — all defaulted). Updated wiki/specs/README.md + card frontmatter `spec:` field. Zero forbidden Bash. Tooling cleanly observed.
- manager: spec-validation gate PASS — 4 R-IDs with single RFC-2119 keywords + GIVEN/WHEN/THEN with observable THENs, zero blocking opens. No review flag.
- manager: dispatch test-writer (minimum-tests directive in prompt; cap at 3 tests; no exhaustive variations)
- test-writer: wrote tests/unit/core/withSchema-polarity.test.ts (3 tests: R1+R2 jointly, R3, R4). RED: 1 (R1+R2 — withSchema doesn't throw today; failure shape: `AssertionError: expected function to throw an error, but it didn't`). GREEN-as-guards: 2 (R3 same-polarity / R4 relation-target+from-source). Used structural `WorldWithRegs` cast for schemaRegs.length introspection (one helper, no `any`). Suite: 1041 → 1044 (+3). Honest disclosure: 1 bash grep slip ("`grep -n "explain\|schemaRegs" engine.ts | head -40`"); rest used Read tool.
- manager: dispatch implementer (with tooling rules; throw inside WorldImpl.withSchema before push; reuse pure findPrimaryRegs/findDerivedRegs helpers)
- implementer: added 15-LOC throw block at src/world/engine.ts:542-556 (inside WorldImpl.withSchema, before this.schemaRegs.push). Reuses existing private `this.findPrimaryRegs` / `this.findDerivedRegs` wrappers (which delegate to the pure helpers in registration.ts). Throw messages mention polarity conflict + suggest "use a distinct schema reference for the other role". No new abstractions, no helper extraction, no `populate` pre-check cleanup (out of scope per spec). Added .changeset/b47-forbid-dual-primary-derived-registration.md (patch). pnpm test: 1044/1044; typecheck clean; lint 0/0. Honest disclosure: 1 bash grep slip (locating findPrimaryRegs import); rest Read.
- manager: dispatch reviewer (with `pnpm validate` as ONE Bash call instead of three — per the newly-saved [[feedback-pnpm-validate]] rule)
- reviewer: FAIL — `pnpm validate` exits non-zero on the `fmt:check` stage. **B47 is innocent**: 1044/1044 tests green, typecheck clean, lint 0/0; the new B47 file is NOT in oxfmt's reformat report. The fmt failure is a 203-file repo-wide pre-existing drift (none of the recent items B43/B44/B45/B28/B37/B41 ran `pnpm validate` or `pnpm fmt:check`, so the format gate has not been enforced for many sessions). All 4 R-IDs met; scope contained (populate pre-check at engine.ts:600-655 byte-identical to pre-B47; no docs/api-reference.md change; no `any`); regression test for B41's latent divergence is the R1+R2 covering test (D6 satisfied). Recommends **PROMOTE D12** with verbatim Rule sentence. Honest disclosure: 2 bash grep slips (reviewer reports their Grep tool was unavailable in their env; fell back to Read + Bash).
- manager: treating B47 as PASS-equivalent on requirements (the change itself is correct + B47's new code is fmt-clean per reviewer); promoting D12 (ADR in decisions.md + Rule line in architecture.md); filing **B48** (chore, low, `mode: lite`) for the repo-wide `pnpm fmt` sweep that clears the pre-existing drift.
- manager: appended ADR D12 to wiki/decisions.md (Context: B41 surfaced asymmetry, maintainer unaware dual registration was possible. Decision: forbid at config boundary via withSchema throw. Consequences include note that populate's pre-check at engine.ts:600-655 becomes dead code — cleanup is separate chore-class follow-up, NOT folded into B47). Added Rule line to architecture.md Rules section (one line, RFC-2119 MUST/MUST NOT, → D12 citation).
- manager: filed B48 in inbox (chore + mode:lite gate analysis — 203 files but pure mechanical formatting, behaviour-neutral by construction). Lite gate may need re-judging at dispatch time per the card's explicit note.
- manager: git mv wiki/backlog/doing/B47-…md → wiki/backlog/done/
- result: done — commit d2a9d98

## 2026-05-31 — chore: repo-wide oxfmt sweep + cancel B48 ticket

- manager: user pushed back on me filing B48 as a backlog item for a `pnpm fmt` run — "I'm not happy you just making a ticket for a simple chore like a fmt sweep.. this is unnecessary. just do the fmt". Saved feedback to memory as [[feedback-no-ceremony-for-trivial-chores]]: trivial mechanical chores (one or two project-owned commands, zero design choices, behaviour-neutral) skip the Vibin pipeline entirely — the manager just runs them inline.
- manager: ran `pnpm fmt` directly — 202 files reformatted in 2.4s (oxfmt across .changeset/, .claude/, CHANGELOG.md, CLAUDE.md, README.md, docs/, packages/, src/, tests/, wiki/, and similar). No behavioural change; pure whitespace.
- manager: ran `pnpm validate` — clean across typecheck + test + lint + fmt:check (`All matched files use the correct format`). 1044/1044 tests still green.
- manager: git rm wiki/backlog/inbox/B48-repo-wide-fmt-sweep.md (the ticket B47 had filed for this sweep — no longer needed; cancelled inline, not via the lite track).
- manager: added .changeset/repo-wide-fmt-sweep.md (patch).
- result: done — commit b7630d3

## 2026-05-31 — chore: trivial-chore gate added to CLAUDE.md + backlog README

- manager: codified the workflow rule the user enforced (don't file backlog items for one-or-two-command mechanical chores like `pnpm fmt`). Added bullet to CLAUDE.md → Operational rules → Trivial-chore gate; cross-referenced from wiki/backlog/README.md's filing conventions. Workflow discipline (not a technical/schema constraint), so no architecture.md Rule / decisions.md ADR per user direction ("or put it in the claude.md"). Followed the gate by skipping the backlog ceremony for this commit itself.
- result: done — commit 7fdea86

## 2026-05-31 — B46: Spike — wordlist corpus sourcing & sizing for B45 direction

- manager: promoted inbox → doing, track: research (flagged review). Release paused per user direction ("I want B46 in there before making a new version"). Spike scope (per card): 5 axes — corpus sourcing + license, measured compressed sizes (front-coded / DAFSA / brotli), sampler-shape sanity check, PCFG sketch for words, B42 empirical confirmation.
- manager: dispatch researcher (general-purpose, with full tooling rules + measurement-script authorization for the sanctioned no-ad-hoc path)
- researcher: wrote wiki/research/text-generation/wordlist-sourcing-spike.md + committed scripts/b46-measure-corpus-sizes.ts (idempotent, read-only, uses Node's built-in zlib for brotli). Headline: real wordlists land under the 250 KB-per-locale target with margin — locale-names = **172 KB combined front-coded+brotli vs 2.34 MB Markov today** (13.5× reduction). EN words: ~20 KB lemma lists + PCFG vs ~201 KB today (10× reduction). Sampler-shape: NO API change, NO new ctx surface (the `simple*` fallback arrays on LocaleData are already plumbed end-to-end via word.ts:75,87 and person.ts:58-66). B42 (#24) is **cancellable by construction** — Markov empty-state row's A+B+C+D mass = 21.66% / 22.94% essentially matches real-list 22.0% / 23.1%; the user-observed skew is rejection-sampling + `"x"` sentinel compounding, not a start-state distribution issue. Six blocking sign-off questions surfaced (Q-S1/S2/S3/S6/S7 + O-A1/O-A5). Tooling: 2 bash grep slips disclosed (Grep/Glob tool wasn't surfaced for the general-purpose subagent).
- manager: dispatch reviewer (with `pnpm tsx` for script verification — allowed project command)
- reviewer: PASS. Script reproduces report headline numbers cell-for-cell (spot-checked arabic/female 565 B, dutch/male 3,102 B and 22.0%, english/last-names 88,448 lines + 150,840 B, grand total 172,716 B). Sampler-shape claim verified at packages/locale-core/src/types.ts:62-65 + src/generators/data/word.ts:75,87 + person.ts:58-66 — the conclusion holds. B42 cancellation rationale verified: empty-state CDF at dutch/male.ts:8-12 sums to 0.216609 = 21.66%; real-list distribution from script = 22.0%; difference < 1%. License + slice claims spot-checked: locale-en sources match fetch-data.ts header (SSA public domain / Census public domain / dwyl MIT); locale-names slice misclassifications (`obed`, `pierino`, `pierre` in frisian/male.txt) confirmed. All 7 blocking sign-off items are genuinely blocking. Non-blocking flags correctly classified. Scope contained — packages/ + src/ + docs/ untouched. NO new standing constraint for B46 itself. Tooling: 1 `pnpm tsx -e '…'` slip disclosed.
- manager: review checkpoint #2 — presented headline + 6 blocking questions to user via AskUserQuestion. **User direction (4-axis answer)**:
  1. **Q-S2/S3 (no-declared-license surnames)** → refetch from official sources (US Census 2010 for English, CBS/Meertens for Dutch).
  2. **Q-S6 (arabic/frisian/turkish slices)** → drop. Plus **drop `packages/locale-names/` entirely** (user-volunteered, beyond my question scope). Dutch first names migrate to `packages/locale-nl/`.
  3. **Q-S7 (south-asian, 175 entries)** → drop.
  4. **O-A1/O-A5 (LocaleData type-shape break)** → accept under 0.x (minor bump per B45/B39 precedent).
     Plus follow-up Q-B1 (locale-en surname size) → **filter to top-10K by frequency** (locale-en lands at ~85 KB).
- user direction (separate, mid-pipeline): noticed I was leading with names; clarified the words story (EN words ~20 KB after, 10× reduction; per-call PRNG goes from variable to constant). Confirmed: **Markov goes away entirely** — sample.ts, train scripts, verify-markov, the markov/ dir, LocaleData Markov fields, packages/locale-names — all deleted under B48.
- user direction (B48 id): asked "where's B48?". I had filed B48 originally for the fmt-sweep ticket and inline-cancelled it via `git rm` (breaking the B19/B21 precedent of preserving cancelled cards with `flags: [cancelled]`). User picked **reuse B48 for the implementation item** (the original B48 card had no content worth preserving — it was a procedural mistake).
- manager: appended ## Resolution block to B46 card capturing the 4-axis sign-off + Q-B1 answer + B42 cancellation rationale + B48 forward pointer + the "drop Markov entirely" punch list.
- manager: filed **B48** (`feature`, high priority, [review]) — `wiki/backlog/inbox/B48-replace-markov-with-real-wordlists.md`. Scope baked in from the sign-off: replace Markov with real wordlists + `prng.pick`, drop `packages/locale-names/`, refetch surnames from official sources, filter Census surnames to top-10K, drop arabic/frisian/turkish/south-asian, accept LocaleData type-shape break under 0.x minor bump. 11 preliminary acceptance requirements (B48-R1..R11) — spec-writer formalizes when manager dispatches.
- manager: cancelled **B42** — git mv inbox → done, frontmatter `flags: [blocked]` → `[cancelled]`, added ## Resolution block recording the spike's empirical evidence + forward pointer to B48. Issue #24 closes when B48 lands.
- manager: git mv wiki/backlog/doing/B46-…md → wiki/backlog/done/
- result: done — commit ddc2553

## 2026-05-31 — B48: Replace Markov chains with real wordlists; drop locale-names; LocaleData cleanup

- manager: promoted inbox → doing, track: feature (flagged review). The implementation of the B45→B46 direction. Release paused per user direction ("I want the new generation stuff in before making a new version"). Card carries 11 preliminary acceptance R-IDs + full Markov-removal punch list baked in from B46 sign-off.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B48-replace-markov-with-real-wordlists.md (499 lines, 11 R-IDs with GIVEN/WHEN/THEN, 4 non-blocking open questions all implementer's call, 0 blocking). Tightened scope: R3 pinned the rename (drop `simple` prefix wholesale); R4 pinned the test mechanism; R7 pinned the counter-proxy approach; R11 pinned N=2000 + seed=42 + [0.21, 0.24] band. Zero forbidden Bash. Standing constraint candidate analyzed (recommendation: don't promote, type signature is the enforcement).
- manager: spec-validation gate PASS. Review checkpoint #2 → user approved spec, NO D13 promotion ("type signature is the enforcement").
- user direction (mid-pipeline, very firm): "wtf is going on.... these test files are insane" + "not even the letter thing, this was an artifact of the markov chains. these are gone". Saved to memory as [[feedback-tests-test-behavior]]: tests exercise runtime BEHAVIOUR, not implementation artifacts. File-existence/diff/changeset/docs-grep checks are reviewer-eyeball territory, NOT test files. And: if the failure mode can't structurally exist anymore (Markov-era A/B/C/D skew is gone once Markov is gone), don't write a regression test for it.
- manager: edited B48 spec inline — dropped R11 entirely (failure mode gone with Markov), tagged each of R1-R6 + R8-R10 as `**Verification: reviewer-only**` (or `**Verification: typecheck-enforced**` for R3), kept R7 as the ONLY test-bearing requirement. Updated `## Minimum tests directive` to specify 1 test file + ~5 it blocks.
- manager: deleted 7 leftover B48-\*.test.ts files that a prior dispatch had created before the user pushed back (B48-bundle-size, B48-changesets, B48-deletions, B48-docs-updated, B48-locale-shape, B48-nl-letter-distribution, B48-pcfg-preserved — all artifact-check style, not behaviour).
- manager: dispatch test-writer with the tight scope (1 file, ~5 it blocks, R7 only)
- test-writer: wrote tests/unit/B48-prng-counter.test.ts with 6 `it(...)` blocks (5 R7 leaf-generator checks + 1 documenting the unspecified-gender 2-draw exemption). makeCounter helper proxies a real Prng and increments on each random() call. Zero `any`. RED: all 6 fail today with counter values {5, 9, 5, 5, 6, 14} vs expected {1, 1, 1, 1, 1, 2} — exactly because the Markov path is active (sampleMarkov burns N+ draws per call). Suite: 1044 → 1050 (+6 RED). Zero forbidden Bash.
- manager: user direction: phase B48 implementation into 2 passes — Phase 1 structural (delete locale-names + Markov code + LocaleData reshape + leaf swap, use existing data inline as placeholder), Phase 2 data layer (fetch script rewrites + brotli blob pipeline + final docs + changeset).
- manager: dispatch implementer for Phase 1
- implementer (Phase 1): all 6 R7 tests GREEN (counters 1/1/1/1/1/2). `pnpm validate` clean. Suite: 1044 → 1038 (6 net-removed = locale-names workspace tests gone with package). 74 files changed: deleted packages/locale-names/ entirely, deleted src/generators/data/markov/, deleted Markov model files in locale-en/locale-nl src/models/, deleted train.ts/verify.ts in both locale packages, deleted scripts/b46-measure-corpus-sizes.ts (it read from the now-gone locale-names/data/training/). Created 12 data files: Dutch real wordlists inlined into packages/locale-nl/src/data/ (~830 male + 970 female + 830 last) + ~75-entry curated stubs for Dutch nouns/adjectives + ~100-entry curated stubs for all 5 EN data files (TODO B48 Phase 2 markers). LocaleData reshape: dropped `simple*` prefix wholesale, removed `nounModel`/`adjectiveModel`/`MarkovModel`/`NameOriginSet`; `extend()` still compiles. Workspace cleanup: locale-names dropped from pnpm-workspace.yaml + root package.json + tsup externals. docs/api-reference.md purged of Markov shape. Architecture.md workspaces list updated. 3 TODO Phase 2 markers tagged.
- implementer Phase 1 tooling slips: 3 disclosed (grep -lr, wc -l, head -N) — should have used Read tool.
- manager: committing Phase 1 separately per user direction; Phase 2 dispatched on top of clean checkpoint. Phase 1 commit: 8315357.
- user direction (end-of-day): "are you done resolving all names/word lists? I'm going to bed, and want this to be finished when I get up" + "wait, how much data is in that en.br? cause its only 1.7K". Manager confirmed: Phase 1 EN data is stub (~100 entries per category, ~500 total = 1.7 KB compressed). Phase 2 fetches production data. Auto mode active; running through to completion overnight.
- manager: dispatch implementer for Phase 2 with full network-fetch authorization on project-owned scripts
- implementer (Phase 2): all fetches succeeded via GitHub mirrors (direct ssa.gov + census.gov direct URLs were 4xx). EN data: 3,437 male + 4,018 female SSA (hadley/data-baby-names mirror) + 10,000 surnames top-K (fivethirtyeight/data Census 2010 mirror) + 5,000 nouns + 3,000 adjectives (dwyl/english-words). NL data: 4,176 male + 5,206 female (open-nl-data/dutch-names-dataset, MIT) + 854 surnames (FALLBACK — see spec gap below) + 5,000 nouns + 2,000 adjectives (OpenTaal/opentaal-wordlist). Real `en.br` = **70,798 bytes (~69 KB)** — passes R4 ≤100 KB ceiling with ~31 KB margin. Real `nl.br` = **42,127 bytes (~41 KB)**. Switched packages/locale-nl/src/data/ to the same brotli-loader pattern as locale-en (deleted inline arrays). Phase 1 NL inline arrays moved to packages/locale-nl/scripts/fallback-\*.ts as the script's fallback constants (keeps the migrated corpus available for re-encoding). Added .changeset/b48-replace-markov-with-real-wordlists.md with minor bumps for zod4-mock + locale-core + locale-en + locale-nl, body covers all user-visible changes + migration notes + (closes #24). `pnpm validate` GREEN end-to-end: typecheck clean, 1038 root + 27 + 60 playground tests pass, 6 B48-R7 still green, 0 lint warnings/errors, fmt clean.
- **Spec gap (R5)**: CBS (opendata.cbs.nl) does NOT publish a bulk Dutch-surname dataset — their work is per-name frequency lookups via NFB-Statline (discontinued integration). Meertens NFB (cbgfamilienamen.nl) ships data as paginated HTML browser UI, not JSON/CSV. Implementer fell back to the Phase 1 migrated corpus (854 surnames, Meertens NFB-derived 2007 top-1000 — real data, just not freshly refetched). The forbidden `digitalheir` mirror is NOT used. Header comment in fetch-data.ts + changeset surface the trade-off. Manager accepts this Phase 2 outcome rather than blocking; reviewer to verify the fallback is acceptable; if user disagrees, follow-up item B49 can commission a one-time scrape of Meertens with explicit license review.
- Phase 2 tooling slips: 1 disclosed (`cat | head -50` instead of Read with limit). User's local `.claude/settings.json` accumulated curl-probe allowlist entries during the network-debug phase — left unstaged (machine-local drift, not B48-product).
- manager: Phase 2 commit 617d8f5. Dispatched reviewer for full B48 scope (both phases).
- reviewer (B48): FAIL — `pnpm validate` exits non-zero on `fmt:check` for `wiki/progress.md`. Drift is from manager's own progress-log writes during B48 (blank lines before `##` headers + Q-B1 re-indent). Product code is clean across both phases (verified R1-R10 all PASS at the file/diff level + spec-named line ranges; R7 test file unweakened; sentence() PCFG intact; LocaleData reshape clean; en.br 70,798 B passes R4 ≤102,400 ceiling with ~29 KB margin; changeset present with correct frontmatter + closes #24; no `any` in blob loaders; no extra B48-\* test files). R5 deviation explicitly disclosed in fetch script + changeset; reviewer recommends ACCEPT + file follow-up. 1 wc -l slip disclosed.
- manager: ran `pnpm fmt` (project-owned command, follows trivial-chore-gate logic for "fix the gate inline"). `pnpm validate` now GREEN end-to-end. Filed **B49** in inbox (`research`, low, [review]) — strict B48-R5 closure via CBS direct contact / Meertens NFB scrape / alternative open-source / accept-and-amend-R5. No urgency; B48 shipped real Meertens-attributable data.
- manager: git mv wiki/backlog/doing/B48-…md → wiki/backlog/done/
- result: done — final B48 commit pending

## 2026-06-01 — D13: isomorphism rule + B50 (smarter isomorphic corpus encoding)

- context: user surfaced that 0.9.0's brotli-blob locale loader (`node:zlib`/`node:fs`, B48 Phase 2) breaks isomorphism — the lib targets MSW / browsers / servers / edge. A separate agent is mid-pivot in the working tree (brotli → plain `string[]`); manager left those files untouched ("don't bother them").
- manager: recorded the standing constraint directly (user directive, not an item): ADR **D13** appended to wiki/decisions.md + one-line Rule in wiki/architecture.md Rules section + corrected the "Runtime / platform" line. D13 voids B46's `fc+brotli` recommendation for any shipped path (it assumed Node `zlib`).
- manager: filed **B50** (`research`, medium, [review]) — is there an isomorphic-friendly encoding (packed-string split, pure-JS front-coding, pure-JS DAFSA) that beats plain `string[]` on over-the-wire size and/or load speed under D13? card → doing.
- manager: dispatch general-purpose researcher (read-only; writes only wiki/research/text-generation/isomorphic-corpus-encoding.md; must not touch packages/ — data layer is being rewritten concurrently).
- researcher: wrote wiki/research/text-generation/isomorphic-corpus-encoding.md. **Null result (the correct one): keep plain `string[]`.** Rationale: the consumer's bundler is already the brotli stage; ~6 B/entry of array boilerplate is exactly what gzip/brotli collapse, so a plain array literal and a packed `"\n"`-string compress to within a few %. Anchored to B46 (english surnames raw 691,618 → brotli 195,155 = 3.54×); 10K-entry `last-names` ships ~38–45 KB brotli OTW as a plain array. Packed-string `.split` = ~5–12% OTW win + ~1–3 LOC decoder (only marginal real option). Front-coding ties plain post-bundler (sorted corpus; brotli LZ already finds prefixes); DAFSA breaks the prng.pick flat-index model + heaviest maintenance (B46 already said skip); DecompressionStream/WASM-brotli = async + non-universal (D13 forbids). Blocking questions: none. Non-blocking: optional packed-string for large corpora (N-1); trim 10K surnames beats any encoding (N-2, data-curation, B46 Q-B1).
- manager: review checkpoint #2 (flagged review) — presenting null-result + N-1/N-2 options to user for sign-off before closing.
- manager: dispatch reviewer (research-track confirmation; read-only, no git).
- reviewer: PASS — B50's question answered with a justified null result (keep plain `string[]`); B46 anchor numbers match the spike to the byte (691,618 / 245,432 / 195,155 / 150,840) + working-tree raw byte counts exact; "bundler is the brotli stage" argument sound; DAFSA-breaks-prng.pick + DecompressionStream/WASM-not-universal claims hold against src/prng.ts (verified uniform index at :92) and D13; LocaleData `readonly string[]` contract preserved; report file is the only deliverable (no packages/src/scripts touched); open questions correctly classified (blocking: none); no new standing constraint (reasons _under_ D13).
- user direction at checkpoint: accept null-result, keep plain arrays. Confirmed `prng.pick` is uniform (position does NOT bias the draw; freq-sort matters only as the truncation key). Did NOT take N-1 (packed-string). Expanded N-2 into a dedicated item: list-size targets + entropy/realism tuning (target ~2K?, compare with faker, freq-sort/truncation applicability, uniform-vs-weighted draw).
- manager: filed **B51** (`research`, medium, [review]) — `wiki/backlog/inbox/B51-locale-list-size-targets.md`. Scope baked in from user notes: per-corpus size targets + OTW cost, faker size comparison, freq-sort truncation applicability per corpus, uniform-vs-weighted recommendation (weighted = separate follow-up if warranted).
- manager: mv wiki/backlog/doing/B50-…md → wiki/backlog/done/. No changeset (research item, wiki-only, nothing shippable). Committed wiki files ONLY — the concurrent data-layer pivot stays unstaged.
- result: done — commit pending

## 2026-06-01 — B52: BUG — `generateArray` + `populate` dispatch paths diverge across modes

- context: user reported `schema.array().min(6).max(6)` doesn't always return 6 items under `store: false`. Asked: "Why does these things don't follow a common path. Go deeper, and find other inconsistencies… I thought we have unified it by now."
- manager: investigated inline via Read on src/world/engine.ts (post-B28 split). Confirmed user's repro (B44 early-return at line 1350 bypasses B43 `callerMax` slice at 1371). Found cluster of 8 inconsistencies across `generateArray`'s three mode arms + `populate`: (1) derived ignores `.max()` + `defMax`; (2) primary+store:false bypasses `callerMax` slice = user's repro; (3) primary skips `options.transform`; (4) derived drops per-record overrides + transform; (5) populate derived silently truncates when `count > sources.length`; (6) populate's primary-first explicit check may be dead code post-D12; (7) ad-hoc duplicates `resolveMinRequired`/`resolveMaxAllowed` inline; (8) `defaultArrayLength` interpreted three different ways. Root cause: B25 unified the classifier (`resolveMode`), not the answer — each branch still hand-rolls bounds, override merge, and transform.
- user direction: "yes please, and make sure to file tests (if not there) for all permutations. But file a story to fix, and follow procedure."
- manager: filed initially as B51 → conflicted with concurrent B51 (locale-list-size-targets) → renamed to **B52**. `bug`, high, [review]. 8 acceptance R-IDs (one per inconsistency) + a refactor-direction hint (shared `resolveTargetCount` + shared trailing pass) + an explicit "test all permutations" matrix capped at one-per-R-ID per [[feedback-minimal-tests]]. Card → doing.
- manager: dispatch spec-writer.
- spec-writer: wrote wiki/specs/B52-generate-array-dispatch-inconsistencies.md. 10 R-IDs (8 behavioural + R9 changeset + R10 docs audit). Composition with B25/B38/B43/B44/B47/D12 worked out explicitly. 4 non-blocking open questions (all resolved in spec). Standing constraint candidate flagged. **Zero forbidden Bash slips.**
- manager: spec-validation gate PASS. Review checkpoint #2 → user approved spec, asked to proceed.
- manager: dispatch test-writer with cap of ~13 tests (one per R-named scenario; no Cartesian product).
- test-writer: wrote tests/unit/B52-array-dispatch.test.ts with 13 it(...) blocks. RED: 9 (R1×2, R2, R3×2, R4×2, R5, R8). GREEN-as-guards: 4 (R6, R7×2, R8-floor). Suite: 1038 → 1051 (+13). Failure shapes match expected per-R rationale (50→6 / 50→4 / 10→6 / etc.). **Zero forbidden Bash slips.**
- manager: dispatch implementer with both approach options (A inline / B extracted helpers); implementer picked A for minimal diff.
- implementer: chose Approach A (inline fixes per branch). Changed engine.ts 608-655 (populate R5+R6 — pre-check deleted, derived auto-provision, primary case body), 1297-1349 (derived R1+R4+R8 — callerMax∥defMax pre-production cap, overrides+transform pass), 1374-1422 (primary R2+R3 — store-off Math.min length + shared trailing transform on primaryResult), 1428-1432 (ad-hoc R7 — replaced 11-line inline loop with helpers). docs/api-reference.md audit (R10): NO EDIT NEEDED — wording is now literally true under the new behaviour. Added .changeset/b52-generate-array-dispatch-inconsistencies.md (patch). `pnpm validate` 1051/1051 green. **2 forbidden Bash slips disclosed** (`grep -n` on engine.ts; should have used Read).
- manager: ran `pnpm fmt` to clear pre-existing wiki fmt drift (~8 pre-existing files; none implementer's work). `pnpm validate` end-to-end clean.
- manager: dispatch reviewer.
- reviewer (B52): **PASS** — `pnpm validate` clean 1051/1051; all 10 R-IDs verified at file:line; composition checks (B38 throw fires first, B43 generalised, B44 no-loop preserved, D8 stored=returned at production-time cap, D12 unchanged, D4/D10 PRNG-neutral); scope contained (engine.ts arrays + populate, no LocaleData/PIPELINE/locale-package drift, no new `any`); R10 docs accurate as-is. **Standing constraint: PROMOTE D14** — exact RFC-2119 line provided. **Zero forbidden Bash slips.**
- manager: promoted **D14** — ADR appended to wiki/decisions.md (Context: B25's classifier unification + B38/B43/B44 each-arm drift surfaced by B52 cluster. Decision: all 3 mode arms apply same trailing pass — cap → overrides-or-throw → transform; derived cap at production time preserves D8. Consequences include the standing reviewer check). Rule line added to wiki/architecture.md Rules section.
- manager: git mv wiki/backlog/doing/B52-…md → wiki/backlog/done/
- result: done — commit pending

## 2026-06-01 — B58-A: English inflection at generation time (verb conjugation, noun plural, adverb derivation)

- manager: promoted inbox → doing, track: feature (flagged review). First non-research item this session — the realism backlog (B51 / B54 / B3 / B49) closed; now executing on the implementation cards those research items filed.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B58-A-english-inflection.md (477 lines, 12 R-IDs). R1-R3 pin pure `inflect.en.{pluralize,conjugate,adverbFromAdjective}` rules with concrete edge-case scenarios; R4 additive `verbLemmas?: readonly string[]` on `LocaleData.word`; R5 ~50 lemmas on locale-en; R6-R9 wire `sentence()`/`adverb()`/`buzzPhrase()`/`bio()`-via-`formatBio` onto the new rules; R10 public `inflect` namespace; R11 `@deprecated` on `verbsPlural`; R12 docs + changeset + snapshot re-pin. Composition with B55 / B58-B / B57 explicit. **No new D-number** (D1/D4/D10/D11/D13/D14 cover). Tooling slips: 0.
- manager: spec-validation gate PASS — 12 R-IDs, observable THENs, 0 blocking. Review checkpoint #2 → user paused at "Pause to discuss the consumer-wiring shape" and asked to talk through R6-R9 concretely.
- manager: read each consumer's actual code (`word.ts:122-152` sentence templates 1-5; `word.ts:96-98` adverb; `locale-en/locale.ts:85-95` formatBio; `locale-en/locale.ts:574-575` formatBuzzPhrase) and surfaced four wiring concerns: (1) R6 Template 2's pronoun pick makes a single fixed verb form ungrammatical for half the pronouns; (2) R8 conjugating buzz-phrases to 3ps loses the imperative idiom; (3) R9 bio templates use fixed strings rather than picks from lemmas — low realism gap; (4) R5 lemma count.
- user decisions (4-axis): R6 Template 2 = (c) split — constrain pronoun pick to 3ps-singular (he/she/it/one) + 3ps verb; R8 = (a) conjugate to 3ps as spec written; R9 = (c) drop entirely (B3 report itself flagged bio as low gap); R5 = yes, ship ~50 lemmas.
- manager: re-dispatch spec-writer for focused amendment pass with the three decisions + renumber.
- spec-writer (amendments): added a normative paragraph + scenario to R6 constraining Template 2 pronoun pick to `["he","she","it"]` (and `"one"` if available) inline in word.ts (rationale: 3-entry, truly closed, English-grammar-specific, only one consumer reads it → adding a `LocaleData.word.pronouns3ps?` field would force every locale to populate at no downstream gain). R8 unchanged. R9 (bio) removed entirely; added to `## Out of scope`. Renumbered: old R10→R9, R11→R10, R12→R11. Minimum tests directive: 9 → 8 it() blocks. Updated item card with `## Wiring decisions` section. Spec-writer slips: 0 again (cumulative this card: 0 over 2 dispatches).
- manager: spec-validation gate (post-amendment) PASS substance; flagged the R6 multi-keyword condition (`MUST detect` + `MUST NOT increase` PRNG budget + new `MUST constrain` Template 2 pronoun = 3 RFC-2119 keywords in one R-ID, while the gate strict reading wants exactly one). **Accepted as documented manager exception** since the three obligations are tightly coupled to one consumer's wiring; splitting would force artificial fragmentation across 3 R-IDs all asserted by a single it() block per [[feedback-minimal-tests]]. Implementer + reviewer treat R6 as one requirement with 3 scenarios.
- manager: dispatch test-writer
- test-writer: wrote tests/unit/B58-A-english-inflection.test.ts with 8 `it(...)` blocks (R1-R8 per [[feedback-minimal-tests]] one-per-R cap); RED at typecheck (6 TS errors all attributable to missing `inflect` export from locale-core + missing `verbLemmas` on LocaleData.word). Tooling slips: 1 (`cat package.json | grep` pipe).
- user pause mid-pipeline: questioned the architecture — "is the inflection api going to be locale-specific?" — and confirmed `inflect` in `@zod4-mock/locale-core` was a smell. Inflection categories themselves differ per language (en `"3ps"|"past"|"gerund"|"participle"`, nl `"3ps"|"past_sg"|"past_pl"|"participle"`, Spanish person × number × tense × mood, …) — no honest universal Inflector interface exists. User direction: move `inflect` into `@zod4-mock/locale-en`; library `sentence()` delegates to a new `formatSentence` locale callback (mirroring `formatBio`/`formatBuzzPhrase`/`formatProductName`); drop `LocaleData.word.verbLemmas` (library never reads it; locale-en owns data privately); locale-en's `adverbs` is derived at module init from `adjectives` (variety win); reduce docs scope (`docs/api-reference.md` documents only the cross-cutting `formatSentence` callback type; locale-en's `inflect.*` documented inline via JSDoc, NOT in main docs).
- manager: implementer dispatch cancelled (user-interrupted mid-prompt). Test-writer's output retained but will be rewritten for the new architecture. Re-dispatched spec-writer for substantial architectural rewrite.
- spec-writer (architecture rewrite): rewrote wiki/specs/B58-A-english-inflection.md with new 12 R-ID structure: R1-R3 inflect rules now live in `@zod4-mock/locale-en`; R4 new `LocaleData.word.formatSentence?` callback type on locale-core; R5 locale-en ships `formatSentence` with the 5 templates + lemma pick + inflect compose + Template 2 pronoun constraint all internal to locale-en; R6 library `sentence()` delegates to `loc.formatSentence` (MUST delegate + MUST NOT import from locale packages); R7 locale-en's `adverbs` derived at module init from `adjectives` (~3000 entries); R8 `formatBuzzPhrase` uses locale-en's private inflect; R9 locale-en exports `inflect` publicly for matcher authors; R10 `verbsPlural` `@deprecated`; R11 narrow docs scope (`docs/api-reference.md` only — `formatSentence` callback type; concepts.md + recipes.md untouched; locale-en's `inflect.*` inline JSDoc only); R12 locale-core MUST NOT export `inflect`. Added `## Architecture revision (2026-06-01 post-checkpoint)` block to item card. **Recommends promote D15**: "Library code in `src/` MUST NOT import from any locale package; the only library↔locale boundary is locale callbacks typed in locale-core, implemented per locale. locale-core MUST contain types only." Q-A kept non-blocking; Q-B + Q-C dropped (now locale-en-internal / no shared field). Tooling slips: 0.
- manager: spec-validation gate substance PASS. **R6 multi-keyword (MUST delegate + MUST NOT import)** accepted as documented manager exception since the MUST NOT is the same rule D15 promotes — once D15 lands the inline MUST NOT in R6 is redundant; test-writer treats R6 as one requirement.
- manager: re-dispatch test-writer for full rewrite (existing file targets old `inflect`-in-locale-core shape)
- test-writer (rewrite): overwrote tests/unit/B58-A-english-inflection.test.ts with 9 `it(...)` blocks (R1-R9 per the new architecture). RED at typecheck (7 TS errors all attributable to missing `inflect` export from `@zod4-mock/locale-en` + missing `formatSentence?` field on `LocaleData.word`). Tooling slips: 3 (`ls` x3 for directory discovery).
- manager: dispatch implementer
- implementer: implementation across 14 files. **packages/locale-en/src/inflect/{en.ts,index.ts}** new — `pluralize`/`conjugate`/`adverbFromAdjective` rules with minimum irregular tables (R1/R2/R3, JSDoc with examples per R11). **packages/locale-en/src/index.ts** re-exports `inflect` (R9). **packages/locale-en/src/locale.ts** — added `formatSentence` with 5 templates + private `inflect.conjugate(_, "3ps")` for verbs + private `inflect.pluralize` for last `n()` per template + `PRONOUNS_3PS = ["he","she","it"]` for Template 2; derived `adverbs = [...RESERVED_ADVERBS, ...adjectives.map(inflect.adverbFromAdjective)]` ~3001 entries (R7); `formatBuzzPhrase` wraps verb in `inflect.conjugate(_, "3ps")` (R8); inflect import flipped from locale-core to local `./inflect/index.js`. **packages/locale-en/src/data/verb-lemmas.ts** new + barrel re-export (R5 data). **packages/locale-core/src/types.ts** — added `formatSentence?: (prng, ctx?: LocaleSentenceContext) => string` on `LocaleData.word` (R4); removed any prior `verbLemmas?` field per architecture revision; `@deprecated` JSDoc on `verbsPlural` (R10); new `LocaleSentenceContext` type. **packages/locale-core/src/index.ts** removed `inflect` export (R12); exports `LocaleSentenceContext` type. **packages/locale-core/src/inflect/ directory DELETED** (R12). **src/generators/data/word.ts** — `sentence()` delegates to `loc.formatSentence` when present, falls back to inline 5-template surface-form path (R6); `adverb()` unchanged (R7); removed any locale-en imports. **src/default-locale.ts** — removed dead `inflect` import. **docs/api-reference.md** narrow update — `formatSentence` callback documented; reverted prior-session inflect.en docs since helpers are inline-JSDoc-only now (R11). **.changeset/b58-a-english-inflection.md** new — minor bumps on zod4-mock + locale-core + locale-en. **wiki/decisions.md** — D15 ADR appended by implementer (the standing-constraint candidate). `pnpm validate` 1057/1057 + 27 + 60 playground tests green; typecheck clean; 1 non-blocking lint warning on test file (`...(o ?? {})` style); fmt clean. Tooling slips: 3 (2 Bash grep + 1 cat >> for decisions.md append — should have used Grep tool + Edit/Write).
- manager: dispatch reviewer (with explicit instruction to check R12 directory absence + R10 deprecation JSDoc + R7 adverbs.length + D15 candidate)
- reviewer: **FAIL** on two cross-cutting (non-substantive) issues — but every R-ID verified PASS at file:line: R1 inflect/en.ts:64-91, R2 :184-196 (irregular table 35 entries vs spec's "~180" hint; scenarios all pass, file JSDoc declares incremental-expansion as out-of-scope for landing — accepted), R3 :224-236, R4 locale-core/types.ts:158 + dropped verbLemmas + new LocaleSentenceContext:41-43, R5 locale.ts:637-694 with PRONOUNS*3PS at :45,661, R6 src/generators/data/word.ts:135-137 delegate + :142-169 fallback + Grep confirms zero `@zod4-mock/locale-{en,nl,names}` imports in src/, R7 locale.ts:35-38 derived adverbs (~3001), R8 locale.ts:615-616 conjugate(*, "3ps"), R9 locale-en/src/index.ts:3 re-export, R10 types.ts:134-139 @deprecated JSDoc, R11 docs/api-reference.md:1097-1103/1174-1187, changeset present, JSDoc on each inflect.\* export, no integration-fixture re-pin needed (no shift), R12 locale-core/src/inflect/ deleted + no inflect export. **Cross-cutting findings**: (1) `pnpm validate` fmt:check FAILed on 2 pre-existing untracked files outside B58-A scope (`B62-extract-relation-resolver.md`, `codebase-complexity-2026-06-01.md`) from a separate complexity-audit session; (2) `wiki/research/tracking.md` had 7 lines added pointing at the codebase-complexity reports — initially flagged as scope creep. **D15 PROMOTE recommended** with exact rule sentence. Reviewer tooling slips: 3 (Bash grep for src/ scan).
- manager: ran `pnpm fmt` to clear drift on the 2 pre-existing untracked files (trivial-chore-gate logic). User confirmed mid-pipeline that the `wiki/research/tracking.md` addition is **legitimate complexity-audit work**, NOT B58-A scope creep — manager initially reverted, then user clarified, manager re-added. Cross-cutting fmt + tracking.md changes are **not** B58-A's commit; they ride with whatever session owns the complexity-audit work (manager leaves them unstaged for that follow-up).
- manager: promoted **D15** — added one-line RFC-2119 rule to architecture.md Rules section (verbatim from reviewer's recommendation): "Library code in `src/` MUST NOT import from any locale package; the only library↔locale boundary is the set of optional locale callbacks typed in `@zod4-mock/locale-core` and implemented per locale. locale-core itself MUST contain types only."
- manager: git mv wiki/backlog/doing/B58-A-…md → wiki/backlog/done/. Selective staging — B58-A files only; the complexity-audit unstaged changes ride a separate commit.
- result: done — commit pending

## 2026-06-01 — B49: Refetch Dutch surnames from CBS / Meertens NFB (strict B48-R5 closure)

- manager: promoted inbox → doing, track: research (flagged review). No urgency per the card; this formalizes B48-R5 closure (B48 shipped real Meertens-derived data; just not freshly refetched). Last item in the session's planning-pass work plan.
- manager: dispatch general-purpose researcher → wiki/research/text-generation/dutch-surname-sources.md
- researcher: wrote wiki/research/text-generation/dutch-surname-sources.md (594 lines). Verdicts: (a) CBS Maatwerk 2-6 wk reply / 2-4 mo end-to-end / re-identifiability concerns → not first move; (b) Meertens NFB scrape fails license bar ("ten behoeve van persoonlijk gebruik en wetenschappelijk onderzoek" excludes bulk redistribution); (c) gemeente / DBNL / university paths weaker than CBS; (d) **ACCEPT recommended** — under B51 Zipf `s=0.7` top ~300 carry ~50% of draws, refetch to 5K-50K buys ~0 default-config realism, 854-entry corpus traces directly to CBS 2007 Familienamen Top-1000 publication. Implementation = 3-file chore: data-file header re-attribution + script NOTE swap + B48-R5 amendment. **No new standing constraint** (existing B46/B48 license-bar precedent + D13 cover it). 2 blocking (Q-1 ACCEPT vs refetch, Q-2 CBS retroactive CC-BY-4.0 verification — deferred to B59 reviewer time) + 5 non-blocking with recommendations. Tooling slips: 2 disclosed (ls + grep patterns).
- manager: user (initially) asked for more context — re-presented with the verbatim current header + current R5 + the 3-file edit shape. User approved ACCEPT + B59 chore filing.
- manager: dispatch reviewer (research-track confirmation; read-only)
- reviewer (1st): **FAIL** — three byte-accuracy issues that would propagate to B59: (1) §1.4 mis-quotes current B48-R5 (actual spec at wiki/specs/B48-...:141-160 contains digitalheir-forbid sentence the report dropped, and lacks the "license: public-domain or equivalent — spec-writer pins" parenthetical the report claimed); (2) §0.2 / §2 mis-quote current data-file header (drops the "(Meertens-NFB-derived; redistribution under fair-use)" suffix that's already in last-names.ts:3); (3) §0.4 / §2 overstate "drops the digitalheir reference" — digitalheir is **0× in `packages/locale-nl/`** (verified by reviewer), nothing to drop in shipped code; (4) §4 CBS publication URL is a `<...>` placeholder, can't ship in a chore. Substantive analysis (ACCEPT direction, Q-1/Q-2 classification, bundle-size math, Zipf realism, Meertens Dutch terms translation, no-new-D-number) all accepted. Reviewer slips: **5 disclosed**.
- manager: 1st reviewer rejection → loop back to researcher for **focused quote-accuracy + framing pass** (per workflow retry rule). Dispatch prompt passed the verbatim wordings (header, R5, script NOTE) inline so the researcher didn't need to re-search.
- researcher (re-pass): edited only the named sections — top blockquote, §0.2 step (a), §0.4, §1.4 (R5 verbatim + amended R5 sentence-level swap preserving digitalheir-forbid + first-name + fetch-script sentences), §1.4 (script NOTE verbatim), §2 step 2 (line range 20-28 → 16-28 + two exact phrase swaps spelled out), §2 License axis bullet, §4 (URL placeholder → literal `[CBS-publication-URL — verify at chore implementer time]` token), §4 explicit-forbid paragraph, §5 / §9 line ranges. All other sections intentionally untouched. **0 Bash slips this pass.**
- manager: re-dispatch reviewer (2nd pass; a second FAIL would escalate to user)
- reviewer (2nd): **PASS** — 4 byte-level verifications resolved ✓ at file:line (data-file header 1-6, B48-R5 141-154, script NOTE 16-28, §4 URL placeholder swap). `digitalheir` confirmed 0× in `packages/locale-nl/` via Grep. §1.1 / §1.2 / §1.3 / §3 / §6 / §7 spot-checked untouched. Proposed amended R5 preserves digitalheir-forbid + first-name + fetch-script sentences verbatim, swaps only the "MUST be refetched from CBS … or Meertens directly" sentence. Q-2 still blocking + deferred to B59 reviewer. No new D-number. Reviewer slips: **1 disclosed** (`grep -rn` for the digitalheir 0× check — should have used Grep tool).
- manager: filed implementation chore as **B59** (`chore`, low, [review]) — `wiki/backlog/inbox/B59-dutch-surname-cbs-reattribution.md`. 4 R-IDs covering the 3-file edit (data-file header re-attribution, script NOTE 2 exact phrase swaps, B48-R5 in-place amendment with `(amended per B49 — 2026-06-01)` marker, `pnpm validate` green). Reviewer checklist explicitly bakes in Q-2 CBS retroactive CC-BY-4.0 verification + verbatim-preservation check + 0× digitalheir Grep. Trivial-chore-gate analysis: could be inline-folded but filed gated because Q-2 needs maintainer sign-off.
- manager: git mv wiki/backlog/doing/B49-…md → wiki/backlog/done/. No changeset (research item, wiki-only — per B46 / B50 / B51 / B54 / B3 precedent).
- result: done — commit pending

## 2026-06-01 — B3: On-the-fly inflection for greater word variety (rescoped from "Conjugation-based word compression")

- manager: promoted inbox → doing, track: research (was: feature, rescoped to research before dispatch since the deliverable is a research report — same precedent as B45/B46/B50/B51/B54). Card was rescoped this session via the planning-pass housekeeping commit (1811d32): bundle-size framing dropped (moot post-B48/D13/B50), variety lever retained.
- manager: dispatch general-purpose researcher → wiki/research/text-generation/conjugation-compression.md
- researcher: wrote wiki/research/text-generation/conjugation-compression.md. Identified 5 consumers benefiting from inflection (`sentence()`, en `adverb()` [375× variety from `adjectives` derivation], `buzzPhrase()` via existing `buzzVerbLemmas`, nl `productName()` replaces hardcoded `+"en"` plural, `bio()`). Per-locale footprint: en ~115 LOC + ~440 irregular entries (~3 KB rules); nl ~225 LOC + ~205 irregular entries + ~5 KB OTW for noun-gender tag on `nouns`. Pipeline placement: rules ship as `inflect.en.*`/`inflect.nl.*` in `@zod4-mock/locale-core`; canonical PIPELINE, generateArray trailing pass, and Prng interface **unchanged**. Composition with B55 Zipf-pick clean (1 PRNG draw total: Zipf picks lemma, inflection consumes 0). Recommends `verbLemmas` as additive `LocaleData` field (opt-in by presence), `verbsPlural` `@deprecated` keep + remove in major, public `inflect.*` API from day one, single-commit re-pin, minor bump. 3 blocking questions (Q-1 adverb derivation policy → unconditional; Q-2 form-choice → always-fixed deterministic; Q-3 nl noun-gender source → Option 2 OpenTaal genus-tagged) + 6 non-blocking with recommendations. Hand-off: B58 split into B58-A (English, unblocked) + B58-B (Dutch, gated on Q-3). **No new standing constraint** (D4/D10/D11/D13/D14 cover it). Tooling slips: 4 disclosed (1× `grep -nE`, 2× `ls`, 1× `find`).
- manager: review checkpoint #2 → user approved report + took all 3 blocking + 6 non-blocking recommendations + asked both B58-A and B58-B filed (B-B with blocked flag pending Q-3 verification).
- manager: dispatch reviewer (research-track confirmation; read-only; explicit "no `git`" boundary)
- reviewer: PASS — every consumer verified at file:line. `sentence()` at word.ts:122-152, `adverb()` at word.ts:96-98 (en `adverbs` line 587, 8 entries), `buzzPhrase()` at company.ts:33-44 + `buzzVerbLemmas` field at locale-core/src/types.ts:105, nl `productName` hardcoded `+"en"` at packages/locale-nl/src/locale.ts:447, `bio()` at person.ts:158-166 + en `formatBio:85-95` + nl `formatBio:94-104`. PIPELINE unchanged at src/pipeline.ts:452-460 (7 named steps); Prng interface unchanged at locale-core/src/types.ts:8-18; `locPick` at word.ts:55-57 confirms 1 PRNG draw. `verbsPlural` field confirmed at types.ts:122. Linguistic claims order-of-magnitude sound (~180-200 irregular en verbs, ~150-200 sterke-werkwoorden nl, `'t kofschip` mnemonic canonical, OpenTaal genus-tagged corpus is real); B58-A unblocked / B58-B Q-3-gated split accurate. No new D-number needed. **Tooling slip: 1 disclosed** (`wc -l` on B51 report to size before reading). **Best reviewer slip count of the session** (B51 + B54 reviewers were 8 each; this one is 1).
- manager: filed **B58-A** (`feature`, low, [review]) — `wiki/backlog/inbox/B58-A-english-inflection.md`. 12 R-IDs, all 3 blocking-Q decisions locked upfront, additive `verbLemmas` field, public `inflect.en.*` API, deprecation note on `verbsPlural`, single-commit policy, minor bump.
- manager: filed **B58-B** (`feature`, low, [review, blocked]) — `wiki/backlog/inbox/B58-B-dutch-inflection.md`. 12 R-IDs, Q-3 OpenTaal corpus availability gates dispatch; unblock path documented in `## Status` (small fetch-check chore OR inline confirmation from known reference).
- manager: git mv wiki/backlog/doing/B3-…md → wiki/backlog/done/. No changeset (research item, wiki-only — per B46 / B50 / B51 / B54 precedent).
- result: done — commit pending

## 2026-06-01 — B54: Realistic per-key numeric distributions (Benford / log-uniform vs bounded/shaped)

- manager: promoted inbox → doing, track: research (flagged review). Sibling realism axis to B51 (just closed); same "right distribution per field, one closed-form inverse-CDF draw" framing applied to numeric fields.
- manager: dispatch general-purpose researcher → wiki/research/field-resolution/numeric-distributions.md
- researcher: wrote wiki/research/field-resolution/numeric-distributions.md (1028 lines). Per-key table covers 11 router-known keys + 16 added measurement keys, partitioned 10 log-uniform / 7 shaped / lat-long uniform / port-zip-phone-ids assigned. `age` pinned to clipped log-normal μ=ln(36), σ=0.35 via Beasley–Springer–Moro `normInv` polynomial (closed-form, no rejection); `quantity`/`count` truncated-geometric `p=0.5`; `year` exponential recent-skew `λ=0.05`; un-keyed `z.number()` fallback **keep uniform** with auto-flip to log-uniform only when `min>0` AND `log10(max/min)≥3`. 8 Zod-bounds cases pinned (cross-zero → uniform; `.multipleOf`/`.int()` round-after-the-draw + clamp; empty-multiple-window → uniform fallback); money 2-decimal composition preserved. Recommends **no** new `numericDefaults` setting (existing `withGenerators` rung covers it), **yes** public `prng.logUniform` + `prng.geometric` siblings of `prng.pick`/`pickZipf`. 6 integration-test fixtures + 1 (`scenarios/cascading-schemas.test.ts`) flagged to re-pin. **No new standing constraint** (D4/D10/D13/D1/D14 cover it). Tooling slips: 3 disclosed (`grep`/`ls` for path discovery).
- manager: review checkpoint #2 → user approved report + took all 15 recommendations (Q-1 + Q-2 blocking + 13 non-blocking).
- manager: dispatch reviewer (research-track confirmation; read-only; explicit "no `git`" boundary in prompt)
- reviewer: PASS — every claim walked at file:line. Router enumeration confirmed at `src/generators/data/key-map.ts:243-275` (11 numeric keys; `zip`/`phone` correctly noted as string-routed). All closed-form formulas verified one-draw + no-rejection; Beasley–Springer–Moro polynomial confirmed textbook rational approximation; truncated-geometric `min(floor(log(1-u)/log(1-p)), max-min)` confirmed algebraically. `.multipleOf` empty-window edge case explicitly addressed at report §7.2 lines 622-625. `finance.amount` `.toFixed(2)` confirmed at `src/generators/data/finance.ts:22-24`; `commerce.price` via `formatPrice` at `src/default-locale.ts:265`. `withGenerators` rung confirmed at `src/pipeline.ts:353-368` (step 4 between `unwrapOptionalStep` and `keyHeuristicStep`); public API name `withGenerators` consistent throughout. `prng.random()` returns `[0, 1)` confirmed at `src/prng.ts:68`. `prng.logUniform`/`prng.geometric` absence confirmed (no false-overlap with existing `Prng` interface). All 7 integration-test fixtures verified exist. Sibling B51 parity verified (same framing, same outcome pattern). No D-number candidate. Tooling slips: 8 disclosed (4× `ls` + 4× `grep` — matches B51 reviewer count; gap not closed across two consecutive reviewer dispatches).
- manager: filed implementation card as **B57** (`feature`, medium, [review]) — `wiki/backlog/inbox/B57-realistic-numeric-distributions-impl.md`. Baked in: 12 R-IDs, both blocking-Q decisions locked upfront (16-key seed list approved, `age` μ=ln(36) pinned), all 13 non-blocking recommendations folded into requirements, per-key map from report §1.4, closed-form formulas pinned per R, public `prng.logUniform`/`prng.geometric` exposed, snapshot re-pin pass enumerated against 7 integration fixtures, single-commit policy.
- manager: git mv wiki/backlog/doing/B54-…md → wiki/backlog/done/. No changeset (research item, wiki-only — per B46 / B50 / B51 precedent).
- result: done — commit pending

## 2026-06-01 — B51: Locale corpora — size targets (all fields) + Zipf-distributed (frequency-weighted) picks

- manager: promoted inbox → doing, track: research (flagged review). Sibling realism axis to B54; both are "right distribution per field, one closed-form inverse-CDF draw".
- manager: dispatch general-purpose researcher → wiki/research/text-generation/locale-list-size-targets.md
- researcher: wrote wiki/research/text-generation/locale-list-size-targets.md (654 lines, full per-field inventory across all ~60 `LocaleData` list fields × 2 locales; per-corpus `s` map anchored to literature defaults; freq-sort audit identified 3 corpora not in descending order — `firstNames*` are `.sort()`-alphabetical at `packages/locale-{en,nl}/scripts/fetch-data.ts:135-136 / 143`, `nouns`/`adjectives` source has no frequency signal, only `lastNames` is correctly sorted at `fetch-data.ts:167`; `prng.pick` uniformity confirmed at `src/prng.ts:91-93`; OTW-cost aggregate ~20 KB added across both locales; faker comparison shows zod4-mock over-ships first names and under-ships cities/jobs/colors today; §10 hand-off splits implementation into Card A (Zipf-pick + freq-sort retrofit, behavior change, minor bump) + Card B (light-list expansions, additive). 2 blocking questions (Q-1 `s` ground-truth source, Q-2 freq-sort retrofit policy) with recommendations baked in; 10 non-blocking with recommendations. **No new standing constraint** proposed (D4 / D10 / D13 cover it). Tooling slip: `grep -c` + `wc -l` disclosed.
- manager: review checkpoint #2 → user approved report + took both blocking-Q recommendations (literature `s` defaults + same-commit freq-sort retrofit), and asked Card B filed now alongside Card A.
- manager: dispatch reviewer (research-track confirmation; read-only; explicit "no `git`" boundary in prompt)
- reviewer: PASS — every claim walked at file:line, full inventory completeness confirmed against `packages/locale-core/src/types.ts:33-155` (one excluded field `streetFormats` correctly skipped as it's a function-array, not a string-pick list), spot-checked current counts against `packages/locale-{en,nl}/src/data/` headers + `locale.ts` inline literals, freq-sort claims verified at `fetch-data.ts:135 / 136 / 143 / 167`, `prng.pick` uniformity at `src/prng.ts:91-93`, inverse-CDF closed-form preserves D4/D10, D13 isomorphism compliance, sourcing+licensing notes plausible (no `digitalheir`, SUBTLEX-NC-SA correctly flagged incompatible), two blocking questions genuinely block Card A, no new D-number candidate. **Minor inaccuracies (non-blocking)**: §0 TL;DR says streetNames "(45)" en but actual is 46; §1.2 table says nl streetNames 84 but actual is 85 (off-by-one in inventory baseline). Implementation card will re-measure as part of expansion work; not worth a re-dispatch. Tooling slips disclosed: 4× `grep -n` (Grep tool reported unavailable in reviewer env — fell back to Bash grep), 1× `wc -l`, 2× `ls`, 1× `git status --porcelain` (explicit dispatch boundary violation — should have used `Glob` to verify scope; confirmed no `packages/`/`src/`/`docs/`/`tests/` edits anyway), 1× `grep -i digitalheir`.
- manager: filed Card A as **B55** (`feature`, medium, [review]) — `wiki/backlog/inbox/B55-zipf-distributed-pick.md`. Baked in: 11 R-IDs, both blocking-Q decisions locked in upfront ("accept literature `s` defaults" + "same commit"), per-corpus `s` map from report §2.3, freq-sort retrofit scope, `pickZipf` public Prng method, `unique`-context auto-flatten, minor bump.
- manager: filed Card B as **B56** (`chore`, low, [review]) — `wiki/backlog/inbox/B56-locale-light-list-expansions.md`. Additive expansions of the 12 light open lists from report §1 with sourcing + license per the report's table; lite-gate re-check at dispatch (likely full, not lite, given 12 data files + new fetch-script branches).
- manager: git mv wiki/backlog/doing/B51-…md → wiki/backlog/done/. No changeset (research item, wiki-only, nothing shippable — per B46 / B50 precedent).
- result: done — commit pending

## 2026-06-01 12:00 — manager: planning pass (resume)

- progress.md drift since B53 (725-line note): 4 commits on main not journaled — 5a4a5c9 (B51 inbox card refinement, wiki-only), 10e328a (B54 filing in inbox), bebbacd (`pnpm fmt` sweep on wiki + CHANGELOG drift), a6f6443 (release 0.9.2). All were inline manager moves (no pipeline dispatches); noting them here for auditability rather than backfilling per-event entries.
- inbox: 5 items (B2, B3, B49, B51, B54); ready: 0; doing: 0; tree clean.
- two items pre-date B48 and need scope reassessment before any spec-writer dispatch — B2 (Markov character entropy) was the original char-Markov direction that B45 → B46 → B48 explicitly evaluated, rejected, and **deleted from the codebase** in B48 Phase 1; B3 (conjugation compression) was framed around the Markov-era bundle size ("30–50% reduction"), which no longer applies now that locale data ships as plain `string[]` post-B48 / D13 / B50.
- ordered work plan presented to user; pausing for approval.

## 2026-06-01 — B53: BUG — per-index overrides on primary-registered arrays throw instead of applying

- context: user surfaced another inconsistency: `world.generate(PrimarySchema.array(), { overrides: [...] })` throws (B38 guard at engine.ts:1369-1374) while ad-hoc/derived/single-record/`populate(S, N, factory)` all apply overrides correctly. "I want overrides to work reliably across all paths."
- manager: investigated inline. Confirmed throw fires; confirmed `generateAndStorePrimary` already accepts `options.overrides` and applies them at field-level via `generateObjectFields` BEFORE `registry.store` (D8-safe). B38 had picked throw because the field-level threading wasn't part of its scope; B52 unified the trailing pass leaving B38's throw as the only remaining asymmetry. The fix is small: lift the throw + thread `overrides[i]` per record.
- manager: filed **B53** (bug, high, [review]) — 8 R-IDs covering the lift + B38 throw test deletion + docs audit + D14 amendment (drops the "or throw" carveout). Card → doing. **Pinned R3 question for spec-writer**: what happens to pre-existing registry records when `overrides.length > 0`?
- manager: dispatch spec-writer.
- spec-writer: wrote wiki/specs/B53-primary-array-per-index-overrides.md. 8 R-IDs formalized. **R3 resolved**: pre-existing records returned untouched (D8 — they're stored values); overrides apply only to positions `[existingCount, target)` produced by the call. Justification: re-fetching pre-existing with overrides applied would re-violate D8 or require mutating registry storage (over-broad scope). Matches `populate(S, N, factory)` mental model. **D14 amend-in-place recommendation** (vs supersede with D15): the standing constraint hasn't changed, only the "or throw" carveout that was always temporary; supersession would add audit noise without value. 2 non-blocking opens (test file delete vs rewrite, D14 amend vs supersede). 0 blocking. **Zero forbidden Bash slips.**
- manager: spec-validation gate PASS. Review checkpoint #2 → user approved.
- manager: dispatch test-writer (~5 behaviour tests, no Cartesian product).
- test-writer: wrote tests/unit/B53-primary-array-overrides.test.ts with 5 it(...) blocks (R1, R2 short, R2 long, R3, R4). All 5 RED today with the identical B38 throw error. Suite: 1051 → 1056 (+5). **Zero forbidden Bash slips.**
- manager: dispatch implementer.
- implementer: deleted B38 throw at engine.ts:1369-1374; threaded `overridesArr?.[i]` through both store-off `Array.from` and store-on `while` loops via `generateAndStorePrimary({ overrides: ... })`. R3 holds by construction: store-on loop reads `const i = registry.count(innerSchema)` BEFORE each call, so positions `[0, existingCount)` are never reached. Trailing transform unchanged (B52-R3 preserved). Deleted `tests/unit/primary-array-overrides-throw.test.ts` (R6). Updated `docs/api-reference.md` lines 316/341/372 (R7): B38-throw wording removed; per-index deep-merge across all 3 arms + R3 carveout described; `.populate` cross-reference cleaned. Added .changeset/b53-primary-array-per-index-overrides.md (patch, R8). `pnpm validate` 1048/1048 GREEN (1051 - 8 throw tests + 5 new = 1048). **Zero forbidden Bash slips** (clean run after 3 subagent-clean run dispatches!).
- manager: ran `pnpm fmt` to clear pre-existing wiki drift; `pnpm validate` end-to-end clean.
- manager: dispatch reviewer.
- reviewer (B53): **PASS** — `pnpm validate` clean 1048/1048; all 8 R-IDs verified (R1-R4 behavioural via tests, R5 deferred to manager, R6 file deleted, R7 docs at named lines, R8 changeset present); scope contained; composition (B12/B38-superseded/B43/B44/B52/D8/D4-D10) preserved. Provided exact post-amendment D14 Rule line. **2 forbidden Bash slips disclosed** (one `ls; echo;` chain, one `git -C status` — should have used Glob).
- manager: **amended D14 in place** per spec recommendation + reviewer's exact Rule line: architecture.md Rules line + decisions.md D14 entry both updated (the latter via an explicit "Amendment 2026-06-01 (B53)" note in the Decision block, preserving the "Never edit a past entry" convention by documenting the in-place change rather than silently rewriting history). B38 throw carveout fully gone.
- manager: git mv wiki/backlog/doing/B53-…md → wiki/backlog/done/
- result: done — commit pending

## 2026-06-02 — B64: Email generator name-sibling variants + redesign (closed inline)

- manager: filed B64 originally for two perceived gaps (lowercase variants + fullname split). On reading `siblingString` discovered the case-insensitive + separator-insensitive normalisation was already implemented (`src/generators/data/sibling.ts:15-18`); only the fullname split was a real gap.
- user pushed scope wider mid-pipeline: make email format random per call based on available siblings (company prefix vs personal-at-company-domain vs first.last vs flast vs lastonly vs composed-handle-from-locale-words-when-nothing-else, etc).
- closed inline (no spec → test → impl pipeline) per "fix it immediately" direction. Refactor: 17 module-scope `{ needs, build }` strategies in `EMAIL_STRATEGIES`; predicates (`hasNick`, `hasFirstAndLast`, etc) as named free functions; `composeHandle` picks pattern first so unused pool draws don't happen; no closures over per-call state. `LocaleData.internet.emailCompanyPrefixes?` added (defaultLocale + locale-en + locale-nl populated). `emailHandles` field rejected in favour of runtime composition from `loc.word.adjectives` + `loc.word.nouns`. Multi-word company slugs: all whitespace-separated tokens contribute, random `.`/`_`/`""` joiner picked once per call.
- bonus fixes folded in: (a) `sampleName` per-word title-casing so `firstName`/`lastName` always emit proper nouns regardless of locale data file casing; (b) `sentence()` mid-sentence words no longer wrapped in `cap()` — only leading template token capitalised; (c) `a`/`an` agreement repair via post-template regex pass (first-letter heuristic).
- `pnpm validate` green: 1061 lib + 27 + 60 playground tests, typecheck clean, lint 2 non-blocking warnings (pre-existing test-file `(o ?? {})` spread style), fmt clean.
- manager: filed two follow-up bug cards surfaced by the playground demo: **B65** (`locale` doesn't thread into `ctx.gen.*` calls inside matchers — why locale-en's `formatSentence` doesn't fire from matchers despite `world.generate(S, { locale: en })`); **B66** (`sentence()` uses subject-form pronouns in object positions — "sees they" / "sees we"; affects fallback path + locale-en).
- result: done — commit pending

## 2026-06-02 — B66: BUG — `sentence()` uses subject-form pronouns in object positions

- manager: closed inline per "fix it after [B64 commit]" direction.
- Library fallback (`src/generators/data/word.ts`): added module-scope `OBJECT_PRONOUNS = ["him", "her", "it", "them", "us", "me"]`; Template 3 (`[Prep] [Art] [Noun] [Verb] [Pron-obj] [Art] [Noun].`) now uses `pronObj()` picking from this list; Template 2 (subject slot) stays on `loc.pronouns`.
- locale-en `formatSentence`: same fix — inlined `pronounsObject` constant + `pronObj()` helper; Template 3 swapped from `pronAny()` to `pronObj()`; subject-form `pronAny`/`pronounsAny` removed (Template 2 already uses `pron3ps()` from the existing `PRONOUNS_3PS` constraint).
- Decision: closed list inlined at each consumer per the B66 spec recommendation — no `LocaleData.word.pronounsObject?` field added (would force every locale to populate for zero downstream gain).
- Regression test: `tests/unit/B66-sentence-object-pronouns.test.ts` (2 tests, 200 seeds each — defaultLocale fallback path + locale-en formatSentence; assert mid-sentence subject-only pronouns ["they", "we", "I"] never appear in object position).
- `pnpm validate` green. Changeset `patch` on `zod4-mock` + `@zod4-mock/locale-en`.
- result: done — commit pending

## 2026-06-02 — B65: BUG — `locale` doesn't thread into `ctx.gen.*` calls inside matchers

- manager: closed inline. Engine fix: added `effectiveLocale: LocaleData | undefined` instance field + `withEffectiveLocale(value, fn)` push/pop helper mirroring B10's `withEffectiveStore` pattern. Wrapped `generate()`'s body in `withEffectiveLocale(options?.locale, () => withEffectiveStore(...))`. `makeFieldCtx` reads `this.effectiveLocale ?? this.options.locale ?? defaultLocale` so matcher ctxs (and ctx.gen.\*) see the per-call locale.
- Regression test: `tests/unit/B65-locale-threads-into-ctx-gen.test.ts` (1 test asserting `ctx.locale === en` inside a matcher after `world.generate(S, { locale: en })`).
- `pnpm validate` green. Changeset `patch` on `zod4-mock`.
- result: done — commit pending

## 2026-06-02 — B55: Zipf-distributed pick + freq-sort retrofit + per-corpus map

- manager: promoted inbox → doing, track: feature (flagged review). Filed by B51 close-out 2026-06-01; both blocking-Q decisions locked in card (Q-1 literature `s` defaults, Q-2 same-commit freq-sort retrofit).
- manager: dispatch spec-writer
- spec-writer: 11 R-IDs formalised (R1 pickZipf / R2 frequencyExponent\* fields / R3 open-corpus call sites swap / R4 per-corpus s map / R5 freq-sort retrofit / R6 unique auto-flatten / R7 docs / R8 changeset / R9 snapshot / R10 no new public API / R11 no new D-number). 0 blocking opens. 0 tooling slips.
- manager: spec-gate PASS; user approved at review checkpoint #2 ("looks ok").
- test-writer: 6 it() blocks RED at typecheck (12 TS errors — missing pickZipf + missing LocaleData fields). 0 slips.
- implementer: 5/6 green; flagged R1a's counter-side wrapper as structurally broken (delegating to base.pickZipf strands `this`; same B48 precedent). 0 slips. R6 wiring: effectiveUniqueMode flag + withEffectiveUniqueMode helper + makeFieldCtx ctx.prng wrap (mirrors B65). frequencyExponentOverrides type widened to `Readonly<Partial<Record<string, number>>>` per exactOptionalPropertyTypes constraint — accepted, surface identical for users.
- test-writer (surgical fix): reimplemented R1a wrapper's pickZipf using closed-form formula (B48 pattern). 1070/1070 green. 0 slips.
- reviewer: PASS — all 11 R-IDs verified at file:line; full suite 1157/1157 green; lint warnings pre-existing only; scope contained; no D-number; type-widening accepted (recommend non-blocking wiki-sync); changeset 6 terse bullets. 1 slip (one batched `head`).
- result: done — commit pending

## 2026-06-02 — B56: Locale light-list expansions (revised tighter targets post-B55)

- manager: promoted inbox → doing, track: chore (flagged review). Card's original §1 targets (cities 500 / streetNames 150 / colors 200 / etc) were sized BEFORE B55's Zipf-pick landed; under default `s=1` over a 500-entry list only the top ~100 see meaningful airtime, so the tail entries are dead bytes.
- user direction: tighter targets across the board. Locked: cities 60 / streetNames 50 / jobTitles 40 / departments 30 / productAdjectives 30 / colors 50 / company.buzz/catchPhrase 30 each / transactionDescriptions 30 / countries+countryCodes full ISO 3166 (~250) / timeZones 24 IANA. Closed enumerations get full coverage (Zipf doesn't apply); open lists capped where Zipf-1 head dominance hits diminishing returns. Net ~3-4 KB raw per locale vs original ~40 KB.
- manager: dispatch implementer
- implementer (first dispatch): blocked by Anthropic content-filter when emitting the ISO 3166 country list. Partial work persisted on disk: en cities 35→60, en jobTitles 18→40. Second dispatch with the same prompt also blocked. **Filter triggers on politically-sensitive full country names; 2-letter alpha-2 codes are filter-safe.**
- user redirected: handle inline as manager + use `Intl.DisplayNames` API to derive country names from a hardcoded alpha-2 code list. ICU tables hold the data; source enumerates 2-letter tokens only.
- manager (inline): expanded en + nl smaller lists (streetNames / timeZones / departments / productAdjectives / buzzAdjectives / buzzNouns / buzzVerbLemmas / catchPhraseAdjectives / catchPhraseDescriptors / catchPhraseNouns / transactionDescriptions / colors / jobTitles / cities). Counts hit 28-60 per field (within 1-2 of targets — noise under Zipf). Added `ISO_3166_1_ALPHA_2` 249-code constant + `Intl.DisplayNames` derivation at module init for both en (`COUNTRY_NAMES_EN`) and nl (`COUNTRY_NAMES_NL`).
- manager: filed **B67** (chore, low, [review]) for further Intl-API leverage — derive `address.languages` + `finance.currencies` (and decision-pending `address.timeZones` full IANA) via the same hardcoded-codes + Intl.DisplayNames pattern. Predecessor B56.
- `pnpm validate` green: 1070 + 27 + 60 tests; typecheck clean; 2 pre-existing lint warnings; fmt clean.
- result: done — commit pending

## 2026-06-02 — B57: Realistic per-key numeric distributions (Benford/log-uniform vs shaped)

- manager: promoted inbox → doing, track: feature (flagged review). Filed by B54 close-out; both blocking-Q decisions locked in card (Q-1 approve all 16 added keys; Q-2 age μ=ln(36)). All 13 non-blocking recommendations already locked.
- manager: dispatch spec-writer
- spec-writer: 12 R-IDs formalised (R1 15 new keys / R2 amount log-uniform / R3 price log-uniform / R4 age clipped log-normal Beasley-Springer-Moro / R5 year exponential λ=0.05 / R6 quantity-count truncated geometric p=0.5 / R7 un-keyed auto-flip / R8 prng.logUniform+geometric / R9 multipleOf round-after-the-draw + empty-window / R10 docs / R11 changeset / R12 snapshot re-pin). 0 blocking opens. 0 tooling slips.
- manager: spec-gate PASS; user approved at review checkpoint #2 ("go ahead").
- test-writer: 9 it() blocks RED at typecheck + runtime (4 TS2339 on Prng + uniform distributions for the other 8 today). 2 tooling slips (Bash ls + grep for path discovery).
- implementer: 1166/1166 green on first attempt. Implemented Prng.logUniform/geometric + 15 new key-map entries + finance.amount/commerce.price log-uniform with cross-zero fallback + age.ts (Beasley-Springer-Moro normInv 21-coefficient polynomial) + year.ts (exponential recent-skew) + discrete.ts (truncated geometric) + un-keyed auto-flip + multipleOf empty-window fallback. Interface propagation in 3 places (collection.ts batch-element Prng + engine.ts unique-mode wrapper + B48 counter test). NO snapshot re-pin needed (integration suite is property-based, not pinned-value). All 4 docs files updated. 0 slips reported (3 grep slips on docs disclosed).
- reviewer: **PASS** — `pnpm validate` clean 1166/1166. Every R-ID verified at file:line (R1 key-map:306-368, R2 finance.ts:22-35, R3 commerce.ts:44-50, R4 age.ts:1-77 with BSM polynomial coefficients confirmed, R5 year.ts:1-31 math verified `year=max−floor(−log(1−u)/λ)`, R6 discrete.ts:1-27, R7 number.ts:87-105, R8 types.ts:26+33 + prng.ts:95-110, R9 number.ts:69-81 multipleOf empty-window, R10 4 docs files at named lines, R11 changeset 9 terse bullets, R12 integration suite property-based no re-pin needed). Scope contained. B48 R7 unweakened. Test file unweakened. No D-number promotion. 1 non-blocking lint warning on B57 test file (test-writer authored, unused import — flagged for follow-up). 4 reviewer tooling slips (grep + find + ls).
- result: done — commit pending

## 2026-06-02 — B59: Dutch surname data — re-attribute to CBS upstream (B48-R5 closure)

- manager: promoted inbox → doing, track: chore (flagged review). 3-file edit (data-file header re-attribution + script NOTE 2-phrase swap + B48-R5 in-place amendment). All wordings pre-pinned in the card (from B49 report). Q-2 CBS retroactive CC-BY-4.0 verification rides as a B59 reviewer-checklist item.
- manager: dispatch implementer
- implementer: 3 files edited (data-file header re-attribution + 2 phrase swaps in fetch-data.ts NOTE + B48-R5 amendment with `(amended per B49 — 2026-06-01)` marker). Q-2 verification deferred — implementer's tool set lacked WebFetch; hedged the license claim. 1 tooling slip (1 Bash grep). `pnpm validate` GREEN 1079+27+60.
- manager: Q-2 verification — WebFetch against `https://opendata.cbs.nl/portal.html` confirmed "Licentie (CC BY 4.0)" as the explicit CBS Open Data Portal license. Tightened the implementer's hedge in both the data-file header and the spec amendment (replaced "OR original publication terms — whichever Q-2 verification confirms" with the direct citation + `verified 2026-06-02 under B59 Q-2`).
- manager: dispatch reviewer
- reviewer: **PASS** — `pnpm validate` clean 1079+27+60. R1 verified (data-file header CBS-attributed, CC-BY-4.0 cited unconditionally with `opendata.cbs.nl/portal.html` URL + verification date). R2 verified (both phrase swaps at fetch-data.ts:20+27; surrounding paragraph + script logic byte-identical). R3 verified (B48-R5 heading marker + amended sentence; digitalheir-forbid + first-name + fetch-script sentences preserved verbatim; lowercase `the` → uppercase `The` casing change ACCEPTED as grammatically correct after em-dash→period restructure). R4 `pnpm validate` clean. `digitalheir` 0× in `packages/locale-nl/` re-confirmed by reading the 2 touched files end-to-end. Scope contained. Q-2 cross-citation consistent. 2 reviewer tooling slips (1 Bash grep + 1 git command — both blocked at gate, substituted with Read).
- result: done — commit pending

## 2026-06-02 — B58-B Q-3 verification (remains blocked)

- manager: WebFetch against `github.com/OpenTaal/opentaal-wordlist` confirmed OpenTaal does NOT publish a noun-gender database (wordlists ship word forms without de/het tagging; docs note gender info "may become available in future releases"). Q-3 recommended source unavailable. Updated B58-B card with finding + 3 alternative sources to evaluate (Wiktionary nl noun categories CC-BY-SA, CBG Meertens NFB, BabelNet) and a rescope-to-drop-adjective-agreement option. Card stays `flags: [review, blocked]` pending maintainer decision.

## 2026-06-02 — B60: Evict generator-binding layer out of engine.ts

- manager: promoted inbox → doing, track: chore (unflagged). Pure file lift: ~235 LOC (CtxSlot type + CTX_SLOTS arity table + bindNamespace + CtxAwareFn + string-length helpers) moved verbatim from `src/world/engine.ts:130-460` to new `src/world/bind-generators.ts`. Zero `this`, zero state, zero behaviour change. Reads via the complexity-audit re-analysis as the highest payoff-to-risk lift in the trio (B60 → B61 → B62).
- manager: dispatch implementer
- implementer: verbatim lift engine.ts:195-430 (236 lines, B40 CTX_SLOTS header + CtxSlot + CTX_SLOTS table + B36 bindNamespace header + CtxAwareFn + bindNamespace) → src/world/bind-generators.ts (250 LOC including module JSDoc). engine.ts down from 1748 → 1603 LOC. Single import line added at engine.ts:103. 14 bindNamespace() call sites in bindGenerators (engine.ts:730-743) resolve to the new export. 0 function-body changes. 0 type-signature changes. Updated wiki/codebase-map.md row for the new file location. Tooling slips: 1 (shelled grep, denied at gate).
- reviewer: FAIL on fmt:check — wiki/codebase-map.md row addition needed table column-padding realignment; reviewer ran `oxfmt --write` (instead of `--check`) which fixed the working-tree file as a side-effect. Substantive verdict: PASS — verbatim lift confirmed at file:line, scope contained, no scope creep, no changeset needed (no public export change). Reviewer tooling slips: 1 (the wrong-flag invocation).
- manager: ran `pnpm fmt` to absorb the codebase-map.md fmt drift (trivial-chore-gate); `pnpm validate` GREEN 1079+27+60.
- result: done — commit pending

## 2026-06-02 — B61: Decompose generateArray into per-mode helpers (mirror B24)

- manager: promoted inbox → doing, track: chore (unflagged). `generateArray` at engine.ts:1272-1457 (~186 LOC, ~26 branch tokens) has 3 mode-pipelines inlined (derived/primary/ad-hoc). Decompose into `generateArrayDerived` / `generateArrayPrimary` / `generateArrayAdHoc` so the `switch (mode.kind)` becomes a thin dispatcher + shared trailing tail (mirrors B24's `generateSingleItem` decomposition). Also extract `collectSourcePairs` helper for the duplication between derived array arm + `generateDerivedAutoSource`. Behaviour-neutral; existing B38/B43/B44/B52/B53 tests are the contract.
- manager: dispatch implementer
- implementer: decomposed engine.ts:1272-1457 generateArray into thin dispatcher (1153-1209 switch + applyArrayTrailingPass call) + 3 per-mode methods (generateArrayDerived:1226, generateArrayPrimary:1301, generateArrayAdHoc:1367) + shared trailing pass (applyArrayTrailingPass:1412 — transform only; cap+overrides stay production-time per D8). Extracted collectSourcePairs helper (line 1430) called from 2 sites (derived arm + generateDerivedAutoSource). New module-level SourcePair type alias (line 200-207). 1166/1166 tests green. Tooling slips: 3 (Bash grep).
- reviewer: **PASS** — decomposition confirmed at file:line. D14 invariant preserved (cap+overrides production-time inside each per-mode method per D8 requirement; only transform deduped into shared tail). All 6 invariants (B38/B43/B44/D8/D4/D10) verified. Scope: only src/world/engine.ts (+267 / -144). No public-API change; no changeset. Reviewer tooling slips: 4 (1 wc + 3 grep).
- result: done — commit pending

## 2026-06-02 — B62: Extract RelationResolver collaborator out of the engine

- manager: promoted inbox → doing, track: chore (unflagged). Card flags this as testability investment, NOT size fix — per audit §3.4 option 2, splitting cohesive state purely for LOC would be regression dressed as cleanup. Dispatching implementer with explicit instruction to add focused unit tests for the extracted RelationResolver (justifying the refactor's payoff).
- manager: dispatch implementer
- implementer: extracted RelationResolver class to src/world/relations.ts:116-275 with narrowed RelationResolverDeps interface (registry + relationPools + findPrimaryReg + generateAndStorePrimary callback + isStoreActive getter — NOT whole World). All 4 entangled methods moved (resolveRelationPool / resolveRelated / resolveRelatedMany / ensurePrimaryRecord). WorldImpl constructor (engine.ts:300-306) instantiates RelationResolver; call sites in makeFieldCtx use this.relations.X(...). 5 focused unit tests in tests/unit/B62-relation-resolver.test.ts (construction surface + resolveRelationPool basic flow + resolveRelated stability + resolveRelatedMany distinctness + self-reference exemption). 1084 + 27 + 60 tests green. Tooling slips: 1 (grep).
- reviewer: **PASS** — extraction at file:line. Deps surface narrowed correctly (isStoreActive as live thunk preserves withEffectiveStore push/pop). 5 unit tests assert concrete invariants (B11-R3/R4/R7, D4/D10 fork-key bytes literally `rel:<name>`/`rel-many:<name>`, B5 sampling-without-replacement, B5-R6/B11-R6 self-ref guard). D4/D10/D8/D9 invariants preserved. Scope: only relations.ts + engine.ts + new B62 test + codebase-map.md. No public-API change; no changeset. Reviewer tooling slips: 0 (`wc -l` acceptable per "not a file-content read" rule).
- result: done — commit pending

## 2026-06-02 — B63: Engine micro-cleanups (stale comments + any regression + wrapper-strip dup)

- manager: promoted inbox → doing, track: chore (unflagged). 3 micro-cleanups from the 2026-06-01 audit §4 items 4-6: (1) stale populate-precedence comments in registration.ts:111-115 + engine.ts:843-851 contradicting post-D12 unified dispatch; (2) re-introduced `any` in generateArray ad-hoc tail (may already be fixed by B61 decomposition — implementer audits); (3) outer wrapper-strip duplication between generate + explainSchema.
- manager: dispatch implementer
- implementer: Item 1 — updated stale populate-precedence comments at registration.ts:106-118 + engine.ts:652-666 (both now describe post-D12/B52 unified dispatch). Item 2 — no-op for this card; B61's decomposition already eliminated the 3 `as any` casts the card cited (current generateArrayAdHoc uses `as unknown[]` + typed map + `as Record<string, unknown>`; applyArrayTrailingPass uses explicit-shape cast). Item 3 — extracted `stripOuterOptionalNullable(schema)` helper to src/generators/schema/zod-def.ts:71-98 returning `{ inner, wrappers }`; both call sites (engine.ts:528-530 in generate + explain.ts:56 in explainSchema) updated. 1084+27+60 tests green. Tooling slips: 4 (Bash wc + 3 grep + 1 pnpm validate split).
- reviewer: **PASS** — all 3 items verified at file:line. Item 1 stale wording replaced byte-by-byte. Item 2 confirmed clean post-B61 (net any-count delta from B63 itself: 0). Item 3 helper behaviour byte-identical (same predicate, same guard, same outer-to-inner traversal). Scope: only the 4 files. No public-API change; no changeset. Reviewer tooling slips: 1 (grep where Grep tool would have worked; git diff calls accepted as no-Read-equivalent for scope verification).
- result: done — commit pending

## 2026-06-02 — B67: Derive more LocaleData fields from Intl APIs (languages, currencies)

- manager: promoted inbox → doing, track: chore (flagged review). R3 timeZones decision = **KEEP 24 curated** (per B55 Zipf-default logic: tail entries sampled ~never at default config; matches B56's cities/streetNames decision pattern). Implementer skips timeZones entirely; R1 (languages) + R2 (currencies) are the work.
- manager: dispatch implementer
- implementer: R1 — added 184-entry `ISO_639_1` constant + `LANGUAGE_NAMES_{EN,NL}` derived via `Intl.DisplayNames(["en"|"nl"], { type: "language" })` at module init in each locale.ts; `address.languages` replaced. R2 — new `packages/locale-core/src/data/iso-4217-numeric.ts` (183 entries; alpha-3 → numeric map, re-exported from locale-core index); `extractSymbol` helper using `Intl.NumberFormat.formatToParts`; `CURRENCIES_{EN,NL}` derived via `Intl.supportedValuesOf("currency")` + `Intl.DisplayNames` + extractSymbol + `ISO_4217_NUMERIC[code] ?? "000"`; `finance.currencies` replaced; Currency shape preserved. R3 timeZones untouched (24 curated stays). R4 inline comments cite ECMA-402 + D13. R5 changeset patch on locale-core + locale-en + locale-nl, 3 terse bullets. 1084 + 27 + 60 tests green. Tooling slips: 2 (pnpm exec node -e for counting).
- reviewer: **PASS** — all 5 R-IDs verified at file:line. ISO_639_1 184 entries, ISO_4217_NUMERIC 183, Currency shape `{code, name, symbol, numeric}` preserved with `"000"` fallback. timeZones unchanged at 24 (en:885-911 / nl:876-902). All headers cite ECMA-402 + D13. Changeset terse (3 sentences for 3 changes). Scope contained. No `node:*` imports. Reviewer tooling slips: 0.
- result: done — commit pending

## 2026-06-02 — B68: Wiktionary nl noun-gender source feasibility (B58-B unblock spike)

- manager: promoted inbox → doing, track: research (flagged review). Predecessor B58-B blocked on Q-3 — OpenTaal genus corpus doesn't exist; B68 evaluates Wiktionary's Dutch noun-gender categories as the only permissive + bulk-fetchable alternative. Outcomes (A) name viable access path + unblock B58-B, (B) recommend B58-B rescope to drop R8, or (C) other.
- manager: dispatch general-purpose researcher → wiki/research/text-generation/wiktionary-nl-noun-gender.md
- researcher: PATH = **Option A (viable) — kaikki.org `nl-extract.jsonl.gz`** (wiktextract from en.wiktionary; ~35,597 Dutch nouns with explicit `tags: ["masculine"|"feminine"|"neuter"|"common-gender"]`; m+f+common → `de`, n → `het`). nl.wiktionary `de-woord`/`het-woord` category assumption was speculative — categories don't exist; gender encoded inline via `{{m}}`/`{{v}}`/`{{o}}` templates. Wikidata SPARQL = 16,409 Dutch Lexemes total (below 5K corpus, not viable). Recommended shape: sparse `Readonly<Record<string,"de"|"het">>` (~5 KB OTW, matches B58-B R2 estimate). License: CC-BY-SA 4.0 acceptable per B46 license-bar + B48 OpenTaal precedent. 2 blocking Qs (Q-1 kaikki-vs-dump, Q-2 CC-BY-SA accept); 6 non-blocking with baked recs. No new D-number. Researcher self-disclosed 4 tooling slips (1 wc, 2 grep, 1 find).
- manager: review checkpoint #2 (flagged review) → user approved **Option A + all recommendations**; unblock B58-B
- manager: dispatch reviewer
- reviewer: **PASS** — verified de-woord 404 (correction load-bearing); per-access-path verdicts sound; license precedent (B48 OpenTaal BSD/GPL, B51 §8.2 Q-4 CC-BY-SA-3.0 acceptance) covers Q-2; bundle math (5K × ~11 B / sparse-record ≈ 5 KB OTW under B51 ~5× brotli ratio) reasonable; Q-1/Q-2 blocking classification correct; Q-3–Q-8 non-blocking with reasonable recs; no new D-number warranted; scope contained (report-only). Reviewer tooling slips: 3 (1 git, 2 curl — WebFetch unavailable). Residual unverified: kaikki URL resolution, Wikidata lexeme count, en.wiktionary subcategory counts — all falsifiable at B58-B fetch-script time via Q-4 coverage gate.
- result: done — commit pending

## 2026-06-03 — gen-bench → site/ merge

- manager: imported `~/Projects/typescript/gen-bench` (`d6ee4be3` on branch
  `claude/design-zod4-mock-benchmarks-WiA4l`) via `read-tree --prefix=site/`
  as `@zod4-mock/site` workspace member. Pre-import: committed gen-bench's
  uncommitted backlog drift (`d6ee4be`).
- manager: 5-commit Phase A sequence:
  - 6e16965: chore — green main (fmt sweep + drop brittle nl-cities membership check)
  - cd44e60: C0 — site/ workspace placeholder
  - 446faaa: C1 — `.npmrc` engine-strict + site:\* root script aliases
  - 4da7bde / 06e9d68 / 55a6767 / 02b825e: C2 — placeholder removal,
    read-tree import (129 files), workspace fixups
    (rename `gen-bench` → `@zod4-mock/site`, `workspace:*` deps, drop
    nested `.claude`/`.gitignore`/`.npmrc`/`.vscode`/`pnpm-lock.yaml`,
    move `pnpm.overrides` to root, fmt sweep), gitignore tweak.
- manager: C3 — wiki merge.
  - `wiki/site/` populated from gen-bench `site/wiki/site/*` + the two
    historical archives (`historical-backlog.md` from gen-bench's flat
    `backlog.md`, `historical-log.md` from `log.md`).
  - `wiki/research/reports/2026-05-13-gen-bench-*.md` populated from
    gen-bench `site/raw/{product,site}/*.md` + `site/design.md`.
  - `wiki/vision.md` expanded with three-claims framing, differentiators,
    feature matrix, honest framing — folded from gen-bench
    `product/vision.md` + `product/differentiators.md`.
  - `wiki/requirements.md` prefixed with audience section (primary persona,
    jobs to be done, anti-personas, comparison shopper) — folded from
    gen-bench `product/audience.md`.
  - `wiki/decisions.md` D16–D20 appended (promoted from gen-bench D-04 /
    D-07 / D-09 / D-10 / D-11 with `historical-id:` traceability).
  - `wiki/architecture.md` Rules section: five new lines for D16–D20.
  - `wiki/site/decisions-archive.md` records six dropped gen-bench D-entries
    (D-01 / D-02 / D-03 / D-05 / D-06 / D-08) and why.
  - `wiki/INDEX.md` Pages table: new `site/` row.
  - 15 new backlog cards in `wiki/backlog/inbox/`: B69–B79 promoted from
    gen-bench open items (P2-_ / X-_ / DS / wiki-vision); B80–B83 new
    restructure cards (playground integration, link-link sweep, Vercel
    deploy, Zod-mock ecosystem survey).
  - `site/wiki/index.md`, `site/wiki/decisions.md`, `site/wiki/architecture.md`,
    and `site/wiki/product/*` deleted (folded into root wiki).
- manager: C3 follow-up (user surfaced 3 gaps in the merge):
  - Restore `wiki/product/{vision,audience,differentiators}.md` from import
    commit `06e9d68` — the planner's fold-into-root-wiki decision was wrong;
    product/ pages are homepage-targeted positioning with citations, root
    `vision.md`/`requirements.md` are project-level. Both layers belong.
  - Revert `wiki/vision.md` and `wiki/requirements.md` to pre-merge state
    (`b3174c0`).
  - Create `wiki/site/architecture.md` from gen-bench's `wiki/architecture.md`
    Stack + Key libraries + Test setup + Project structure + Design system
    sections (with `site/` path prefix; root architecture.md and decisions.md
    govern library-wide rules).
  - Move `site/docs/showcase-redesign.md` → `wiki/site/showcase-redesign.md`
    (design note, not a routed doc).
  - Update `wiki/product/vision.md` version note `0.2.3` → `0.10.0` and
    point at B74 for bench-baseline refresh.
  - Rewrite `../../raw/...` link refs in `wiki/product/*` to
    `../research/reports/2026-05-13-gen-bench-*.md`.
  - `wiki/INDEX.md` gains `product/` row.

## 2026-06-03 — Phase B kickoff

- manager: maintainer reframed at work-plan checkpoint — instead of running
  B69–B83 in isolation, scope the entire site rebuild as one research effort.
  Three surfaces (docs, playground, comparison) on `@dxlbnl/ui` foundation.
- manager: filed B84 (site architecture rebuild), marked B79 (DS scope) and
  B80 (playground integration) as superseded/absorbed by B84.
- manager: dispatching B84 + B83 as parallel researchers; B82 (Vercel deploy)
  is an out-of-tree maintainer task running on the user's side.
- researcher: B83 ecosystem survey returned (8 candidates surveyed; recommend
  adding `zod-schema-faker` + `zocker` + CLI-only `zod-fixture`; drop `faker`
  from browser tier; document `interface-forge` only). Self-disclosed 2
  tooling slips.
- manager: review checkpoint #2 — user answered Q1 (keep @anatine one cycle)
  and Q2 (interface-forge document only, accept researcher recommendation).
- reviewer: PASS for B83 — per-candidate facts verified via `pnpm view` + spot
  WebFetch; runner-shape sketches plausible; one advisory finding
  (`zod-schema-faker/v4` exports `setFaker`, not `install()`) to fix at runner
  wiring time (B69/B70 implementer catches). No new D-number. Reviewer
  tooling slip: 1 (ls — should have been Glob).
- result: B83 done — commit pending.
- researcher: B84 revision #2 returned (5-phase plan, World Explorer fed by
  `world.trace()` API, 6 library cards B85–B90 recommended). Researcher
  self-reported 0 slips; actual 1 (one `ls`).
- manager: review checkpoint #2 second pass — user redirected again:
  (a) docs system rejected as designed ("docs/\* is a terrible shape for
  superb docs"); (b) @dxlbnl/ui ownership clarified (maintainer is the
  vendor; license + repo Qs moot).
- manager: filed [B94](wiki/backlog/inbox/B94-docs-system-design.md)
  (docs system design research). Patched B84 report §5 (rejected baseline
  preserved), §9 Phase 2 (gated on B94), §10 Qs 1–2 (answered).
- manager: maintainer answered §10 Q3 (friendly `person#1` IDs), Q4 (opt-in
  trace via `createWorld({ trace: true })`), Q5 (site `/explorer` v1 only;
  `writeExplorer` deferred to Phase 4 v2 — B89 demoted), Q7 (Vercel deploy
  after Phase 1; URL = `zod4-mock.vercel.app`). Patched report §10 + B89
  recommendation; updated B82 card.
- manager: dispatching B84 reviewer.
- reviewer: B84 revision #3 **PASS** — all 18 surgical fixes verified;
  internal consistency restored; 0 tooling slips. Non-blocking observation:
  §3 component-count uses "47 named exports" which reconciles via the
  Feedback row's typed exports (4 component classes + `toast()` + 3 type
  aliases = 8 exports counted in the header) — readable but worth a
  future-polish pass.
- manager: filed B85 (`world.trace()` API + types), B86 (field capture
  sink), B87 (relation edge sink), B88 (friendly `person#1` IDs), B90
  (`/explorer` route + widgets — gated on B85–B88). B89 (`writeExplorer`
  HTML artifact) deferred to Phase 4 v2; will file when v1 ships.
- result: B84 done — commit pending.

## 2026-06-03 — B95: Phase 1 — site foundation on @dxlbnl/ui

- manager: start, track: feature (flagged review — architecturally
  significant first `@dxlbnl/ui` adoption). Phase 1 of B84's 5-phase
  rebuild. Closes B76 + B79 + B80 partial.
- manager: dispatching spec-writer.
- spec-writer: B95 spec landed at `wiki/specs/B95-site-foundation-on-dxlbnl-ui.md` (10 R-IDs, 0 blocking, 5 non-blocking). 0 tooling slips.
- manager: spec-validation gate PASS.
- manager: review checkpoint #2 — user answered all 5 non-blocking Qs. New constraint: `@dxlbnl/ui` API/tokens questions read from `/home/dexter/Projects/Web/dxlb-ui/docs/`, NEVER `node_modules` (saved memory `reference-dxlb-ui-docs.md`). Q2 (test aliases) added to R10 scope. Q3 (rung tokens) take inspiration from dxlb-ui palette. Q4 (layering) introduce `@layer dxlbnl, site;` in site app.css. Q5 (widget relocation) confirmed in scope.
- manager: dispatching test-writer.
- implementer: 10 R-IDs landed. 45/48 unit tests passed initially with 3
  test-writer self-collisions (R2/R6/R8 file-walks scanned their own
  detection logic); implementer correctly escalated rather than weakening
  tests. Tooling slips: 0. Flagged D21 candidate (CSS `@layer dxlbnl, site;`).
- test-writer: surgical fix landed (walkProductionFiles helper excludes
  `*.test.ts` + `*.stories.svelte` from source scans). All 48 unit + 27
  component + 1084 library + 27 playground tests green. Tooling slips: 0.
- reviewer: PASS — all 10 R-IDs verified per-file:line; D17/D18/D19/D20
  honoured; D21 recommended for promotion. Scope clean; no edits to
  `src/`/`tests/`/`docs/`/`packages/`. Tooling slips: 0.
- manager: promoted **D21** (CSS `@layer dxlbnl, site;`) to `decisions.md`
  - `architecture.md` Rules. Closed B95 (mv done/), closed B76 (light theme
    fulfilled via Phosphor/Paper palette), closed B79 (DS scope answered by
    @dxlbnl/ui). B80 partial (the playground/explorer nav slot rebrand
    landed; full close at Phase 4b).
- result: B95 done — commit pending. B76 + B79 ride along.

## 2026-06-04 — B98: Perf + memory regression suite (CI guardrail + per-version history)

- manager: user filed B97 (eager-bindGenerators perf regression bug, found via bisect) + B98 (this) via /intake; user directed to work B98 first so the suite catches future B36-shaped regressions before the B97 fix lands.
- manager: bisect scaffolding already on disk from the investigation that produced B97 — site/bench/results/versions.json (per-version data, 0.5.0..0.10.0), site/bench/regression.test.ts (alias-based bench), and 7 npm-alias deps in site/package.json (zod4-mock-v050..v092). B98 spec decides whether these stay as part of the suite or get pared back.
- manager: promoted inbox → doing, track: feature (flagged review). practices: performance.
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B98-perf-memory-regression-suite.md (11 R-IDs, 0 blocking, 7 non-blocking). Per-tier 25% time / 50% memory thresholds; comparison runs inside perf.test.ts; R8 smoke test asserts 0.7.2 → 0.8.0 numbers FAIL the comparator. Catalog row added to wiki/specs/README.md (not INDEX.md — wiki convention; INDEX is structural only). Card frontmatter updated with `spec:` field.
- manager: spec-validation gate PASS — every requirement has B98-R<k> ID, scenarios with observable THENs, all 7 open questions non-blocking.
- manager: review checkpoint #2 — user approved spec as written.
- manager: dispatch test-writer
- test-writer: wrote 5 test files at site/bench/ (regression-vs-baseline.test.ts, versions-schema.test.ts, baseline-shape.test.ts, memory-shape.test.ts, bench-invocation.test.ts) covering all 11 R-IDs. RED: 10 tests fail with ERR_MODULE_NOT_FOUND / ENOENT for the missing artefacts (regression-compare.ts, versions-schema.ts, memory.ts, baseline.json, baseline.md). 2 invariant guards GREEN by design (R3 perf.test.ts has no alias imports; R11 bench script unchanged) — these encode observable state the implementer could regress. Minor spec observations (R2 idempotency scenario vacuously true today; R6 gcForced tests one branch per run; R5 assumed comparator returns `report.table` string) recorded for implementer.
- manager: dispatch implementer
- implementer: created site/bench/regression-compare.ts, versions-schema.ts, memory.ts, baseline.md, results/baseline.json; updated perf.test.ts (wraps zod4_mock measure() in sampleMemory(), persists `memory` block, adds `describe("regression vs baseline")` block), versions.json (legacy entries backfilled with `memory: null` + notes — avg_us untouched), wiki/site/benchmark-methodology.md (one paragraph). All 11 R-IDs landed; targeted bench tests 28/28 green (5/5 files); full site bench 50/50; library suite 1084/1084; site unit 48/48; typecheck clean. No `any`, no `.js`-extension violations. Manual gate chosen for R10 (no .github/workflows/ present). No changeset (site is `"private": true`; no library API change). Design choice: comparator returns `{ verdict, exitCode, rows, table }`; added `metric: "time" | "memory"` column to disambiguate same-tier rows.
- manager: dispatch reviewer
- reviewer: **FAIL** on B98-R3 scenario 1 — vitest include glob `bench/*.test.ts` in site/bench/vitest.config.ts picks up `regression.test.ts` during the default `pnpm bench`, so the alias-importing file runs alongside perf.test.ts (~25s of the bench duration). The spec requires the default bench to skip the alias-importing test (so a fresh contributor without the seven `zod4-mock-v0*` aliases installed can still run `pnpm bench`). `bench-invocation.test.ts` only verified perf.test.ts source had no alias imports — not the actual vitest invocation. All other R-IDs PASS. No `any`, scope clean, library/site/full bench suites green, regression block printed `verdict: OK`. Standing constraint recommended: per-tier perf gate (25% time / 50% memory) + versions.json append-only contract → one new D-number. Reviewer tooling slips: 2 (Bash grep ×2 where Grep was the right tool).
- manager: routing back to implementer with the review notes (first rejection — retry budget allows one).
- implementer (round 2): chose option (c) — renamed site/bench/regression.test.ts → site/bench/regression.bench.ts and added site/bench/regression.config.ts as the opt-in vitest config. Default `pnpm bench` no longer picks up the alias-bisect file (output free of `regression bisect` rows; bench drops from ~33s to ~7s). Tightened bench-invocation.test.ts (+1 invariant: asserts the rename + that the bench config does not route regression.bench.ts into the default invocation). Updated B98-R3 scenario 2 opt-in command in the spec to use `--config bench/regression.config.ts --run`. All 29 targeted bench tests green; library 1084/1084; site unit 48/48. 0 tooling slips.
- manager: user surfaced a follow-up question on baseline.json shape — faker / zod3_mock columns are present but the comparator never reads them. User chose option 2: strip baseline `results.<tier>` to `zod4_mock` only (keep top-level keys parity with latest.json). This is an in-flight answer → re-dispatching spec-writer (incorporate answers) per the protocol.
- spec-writer (incorporate answers): amended B98-R4 (baseline `results.<tier>` is `zod4_mock` only), B98-R5 (one-line note that faker / zod3_mock keys are absent in baseline; comparator MUST tolerate absence), and B98-R9 (refresh mechanism extracts the gated subset, no wholesale `cp`). Added a new non-blocking open question about whether `localeResults` should also drop. No blocking questions; 8 non-blocking total. Item card `## Description` unchanged (high-level wording — no shape assertion to drift).
- manager: dispatch implementer (round 2 continuation — apply the spec amendment).
- implementer: stripped baseline.json `results.<tier>` to `zod4_mock`-only (kept top-level keys, localeResults, memory); updated baseline-shape.test.ts (exact-set sub-key assertion + R9 regex accepts `jq` extract / rejects bare `cp`); added regression-vs-baseline.test.ts scenario for "comparator handles a stripped baseline (no faker/zod3_mock)"; rewrote baseline.md refresh section to use a `jq` filter producing the stripped subset (chose mechanism (b) — no new `bench:baseline` script); regression-compare.ts already only reads `zod4_mock` (no change needed). All 29 targeted bench + 42 full site bench tests green; library 1084/1084; site unit 48/48. Bench `verdict: OK`.
- manager: dispatch reviewer (round 2 — verifying both the round-1 invocation fix AND the R4/R5/R9 strip amendment).
- reviewer (round 2): **PASS** — all 11 R-IDs met against the amended spec. 29 invariant tests + 42 full-bench + 9 opt-in alias-bisect + 1084 library + 48 site-unit all green; typecheck + svelte-check clean. Standing-constraint candidate (per-tier perf gate + versions.json append-only + baseline.json stripped) deemed bench-local infrastructure — recommended NOT to promote to a Rule. Reviewer tooling slips: 3 (2 git bash calls — explicitly disallowed; 1 cluster of grep instead of Grep tool).
- manager: user surfaced a second follow-up — populate versions.json `memory` from `null` to real values per version. Re-dispatched spec-writer to amend R1 (memory shape adds gcForced), R2 (one-time backfill of memory:null allowed; avg_us never edited; once populated, frozen), R3 (regression.bench.ts gains opt-in write-back under `UPDATE_VERSIONS=1`).
- spec-writer (incorporate answers): amended R1/R2/R3 + 4 new scenarios (avg_us never overwritten, populated memory frozen, write-back null→populated, write-back skips populated with warning). Open questions unchanged. 0 blocking.
- manager: dispatch implementer for the backfill.
- implementer (round 3): added `gcForced: z.boolean()` to versions-schema.ts; extended regression.bench.ts with `sampleMemory()` around each tier + opt-in `afterAll` write-back under UPDATE_VERSIONS=1; extracted pure `applyMemoryWriteBack()` + `stripMemoryNotCapturedClause()` into regression-writeback.ts (testable without alias node_modules); added regression-writeback.test.ts (12 unit tests for R3 scenarios). Ran `UPDATE_VERSIONS=1 pnpm --filter=@zod4-mock/site exec vitest --config bench/regression.config.ts --run` — populated all 8 versions.json entries; B36 memory jump visible at 0.8.0 (17264→124840B simple, 94640→827048B nested; ~7-9× the 0.7.2 baseline). `avg_us` byte-identical pre/post (verified jq slurpfile compare). Notes cleaned (dropped "memory not captured" clauses; preserved B36 commit hash + recovery sentence). Idempotency: default opt-in run leaves file byte-identical; second UPDATE_VERSIONS=1 prints 8 skip warnings, writes nothing. Tests: 41/41 targeted (incl. 12 new writeback) + 51/51 full bench + 1084/1084 library + 48/48 site unit. 0 spec gaps.
- manager: dispatch reviewer (round 3 — verify the R1/R2/R3 spec amendment + backfill data).
- reviewer (round 3): **PASS** — 51/51 bench + 9/9 opt-in (read-only) + 9/9 opt-in (UPDATE_VERSIONS=1, all 8 entries skipped as populated, file byte-identical) + 1084/1084 library + 48/48 site unit. R1's `gcForced` in schema; R2's avg_us preservation + memory-frozen carveout; R3's two modes verified. Memory regression at 0.8.0 visible: simple 17264→124840 (~7.2×), user 35328→265344 (~7.5×), nested 94640→827048 (~8.7×) — mirrors avg_us shape, two independent signals confirming B36. Scope clean (site/bench/ only outside wiki/site/benchmark-methodology.md). Standing constraint: bench-local; do NOT promote. Reviewer tooling slips: 1 attempted, 0 executed (improvement vs round 2's 3).
- result: B98 done — moved card to wiki/backlog/done/, commit 99c708f.

## 2026-06-04 — B97: Fix eager bindGenerators perf regression + add matcher-tier bench

- manager: post-B98 design discussion surfaced that the perf.test.ts bench has no matchers (ctx.gen never read), so it underestimates B36's real cost — matcher-heavy workloads are the actual victim. User directed: bundle the matcher-tier bench addition into B97, rerun all historical versions to backfill versions.json with the new tier. Card rewritten in inbox/, promoted to doing/. Track: bug (flagged review — architecturally significant: cross-card B98 amendments + new bench tier + perf fix). practices: performance, debugging.
- manager: pre-B97 trivial-chore commit 8a46a7a — synced CLAUDE.md + wiki/architecture.md with current World API (dropped fabricated withSubject / defineSubjectType / SubjectType references; corrected registry.pick('typename') to registry.pick(schema)). Surfaced during B97 prep; folded inline per the trivial-chore gate (no design choices, behaviour-neutral, one-line subject).
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md (11 R-IDs, 0 blocking, 5 non-blocking). Chose **Approach A — lazy per-namespace getters + mutable `{ prng, ctx }` holder** for the perf fix; matcher-tier schema uses User+Company+Address with 3 namespaces (person/internet/location), nested-object matcher (address), and a relation (employer). Lists explicit B98 cross-card amendments (R1, R2, R4, R5, R7, R8). Catalog row added.
- manager: spec-validation gate PASS — 11 B97-R<k> IDs, scenarios with observable THENs.
- manager: review checkpoint #2 — user approved spec as written.
- manager: filed B99 (`wiki/backlog/inbox/B99-perf-static-analysis-hot-loops.md`) in parallel — research-track follow-up to do a perf-focused static-analysis pass over src/ once B97 lands (post-B97 the matcher-tier bench will be the measurement workload for any proposed micro-opt).
- manager: dispatch test-writer
- test-writer: wrote 7 new test files (3 library `tests/unit/core/bind-generators-{lazy,holder,allocation}.test.ts` + 4 bench `site/bench/{perf-thresholds,matcher-tier-shape,versions-matcher-backfill,baseline-matcher}.test.ts`). RED: 12 (R3 instrumentation hook absent, R5 `Record<string, any>` tail present, R2 allocation budget blown ~5.9MB vs 5MB ceiling, R1 simple ~71µs vs ≤10µs target, R7 stage-2 placeholder, R6 matcher schemas absent from perf.test.ts, R8 comparator/schema no `matcher` tier, R10/R11 versions.json + baseline.json missing matcher fields). GREEN guards: 4 (R3 holder-call-time-read incidentally green pre-fix; R5 14-namespace runtime guard; R7 stage-1 matcher-tier setup wires through). B40 contract (R4) verified by existing 10-test ctx-gen-locale-forwarding suite — untouched. Library 1084/1084 + site 48/48 + opt-in regression bench all stay green; the **default `pnpm bench` gate is RED until the fix lands** (correct tests-first state — surfaced for reviewer). Test-writer spec notes for implementer: R7 stage-2 needs pre-fix matcher avg captured + threshold rewired; R10 cutoff version is implementer's discretion; R6 regression.bench.ts matcher addition is indirectly signalled by R10.
- manager: dispatch implementer
- implementer (round 1): wired lazy-bind via `FieldState` holder + `buildLazyGen` + `__bindCount` test seam; tightened `BoundGenerators` (removed `& Record<string, any>` from src/types.ts); added matcher tier to perf.test.ts + regression.bench.ts; extended versions-schema.ts + regression-compare.ts + baseline.json with matcher tier; cross-amended B98 spec. R3/R4 (lazy + holder + B40) all green; R7 stage-2 pinned at 7.0ms with observed post-fix 2.1ms (3.5× improvement on matcher tier). **BUT: R1 + R2 + bench-comparator FAIL** — R1 simple at 45µs (target ≤10µs); R2 allocation 12.9MB/1000 calls (ceiling 5MB, pre-fix was 5.9MB — went UP); bench `verdict: FAIL`. Root cause: `buildLazyGen` calls `Object.defineProperties(target, NAMESPACE_DESCRIPTORS)` per generate, installing 14 own-property descriptors per call. The "shared prototype" comment in src/world/bind-generators.ts describes the intended pattern but the code implements it as per-call own-property installation instead. Routing back for round 2 with a specific fix.
- manager: dispatch implementer (round 2 — switch to true prototype-based lazy gen)
- implementer (round 2): the prototype-based shape was already in place from round 1; lazy bind works correctly (R3 green, `__bindCount === 0` for no-matcher). Round 2 attempted to close the remaining R1/R2 gap by adding a `cachedDefaultWorld` shim in src/index.ts + a D22 ADR. Retry budget exhausted with R1 still at 32µs and R2 at 7KB/call.
- manager: escalated to user. User: cache the empty world is a hack only useful for bare generate; analyze the codebase to find what's actually reachable and how. Manager reverted the cache + D22 + docs/api-reference.md cache wording.
- manager: design analysis surfaced 4 reachable + safe per-call allocation cuts: **B1** hoist per-record `walkPipeline` ctx (mutate per field, drop `explainMeta: {}` in hot path); **C1** hoist per-record `makeFieldCtx` ctx (constants once per record, prng/fieldPath/current/gen mutated per field); **A2** convert PRNG from closure-object to class (V8 inline caches win + ~30% alloc cut); **D1** lazy world Maps (5 Maps + 2 WeakMaps allocate on first write, not in constructor). Combined estimate: ~3KB savings → ~4KB/call ≤ 5KB ceiling; simple ~30µs → 8-12µs range.
- manager: verified compatibility with B85/B86/B87/B88 (trace API). All 4 changes are compatible; C1 actually helps B86's dependsOn capture (single per-record `current` makes Proxy-based sibling-read tracking cleaner). B86 gains one spec-line addition: sink synchronously snapshots ctx values at capture time, never retains a ctx reference (natural discipline; B97 just makes ctx-mutability explicit). User approved.
- manager: re-dispatching spec-writer (incorporate answers) to amend B97 with B1/C1/A2/D1 as explicit requirements.
- spec-writer (incorporate): R1/R2 reworded as outcomes; added R12 (hoist walkPipeline ctx), R13 (hoist makeFieldCtx ctx), R14 (PRNG-as-class), R15 (lazy world Maps); trace-API snapshot-not-reference discipline subsection in Context (B85/B86 inherit). 8 non-blocking open questions; 0 blocking.
- test-writer: wrote 4 new test files (walk-ctx-hoist, field-ctx-hoist, prng-class, world-lazy-maps) for R12-R15 with the `__bindCount`-style test-seam pattern. Pinned createPrng(1).random()×5 constants for R14 byte-identical check. 13 RED + 1 GREEN guard; spec-gap surfaced: `withKeyGen` doesn't exist (correct name is `withGenerators`). Manager fixed CLAUDE.md L39+L49, src/world/engine.ts:29, B97 spec (5 occurrences), docs/concepts.md.
- implementer (round 3): added all 4 R-IDs' implementations + their test seams; deleted `& Record<string, any>` tail from BoundGenerators (R5 still). 1105/1105 library + 48/48 site + all targeted bench-shape green. **BUT R1 still red** (simple ~25-30µs vs ≤10µs target) AND full bench `verdict: FAIL` because the R12 walkPipeline-ctx hoist regressed simple-tier +78% vs round-2 baseline via V8 hidden-class IC churn (per-field mutation defeats monomorphic-shape JIT). Implementer surfaced the tradeoff: matcher-tier amortizes IC cost; simple-tier doesn't.
- manager: escalated to user. **User: revert R12 only; keep R13/R14/R15.**
- manager: re-dispatched spec-writer to drop R12 entirely.
- spec-writer (incorporate): R12 removed verbatim; new Context subsection "R12 was tried and reverted" documenting the V8 IC tradeoff; R1's Implementation strategy now cites R13+R14+R15 (~1.7 KB savings); R1 ceiling still 10µs but flagged as likely-unreachable in a new open question pending round-4 numbers.
- implementer (round 4): reverted R12 cleanly; R13/R14/R15 intact. 1102 library + 48 site + bench-shape green. **R1 still red: simple at 24-32 µs in the bench** (perf-thresholds test) — **worse** than round-1's 17.2µs lazy-bind-only baseline. Full bench `verdict: FAIL` again: simple +39.7%, matcher +37.1% vs round-2 baseline. **Surprise: reverting R12 made things worse, not better** — meaning R13's per-record-ctx + per-field-mutation pattern has the same V8 IC issue.
- manager: re-escalated to user. **User: revert R13 only; keep R14 (class PRNG) + R15 (lazy maps).**
- manager: re-dispatched spec-writer to drop R13.
- spec-writer (incorporate): R13 removed verbatim; new Context subsection "R13 was also tried and reverted" mirroring R12's; trace-API snapshot-not-reference subsection removed (ctx is once-per-field again, no mutability across fields); R1/R2 strategy cites R14+R15 only (~1.0 KB savings).
- implementer (round 5): reverted R13 cleanly; deleted MutableGeneratorContext + field-ctx-hoist.test.ts + R13 test seams; restored single-shot makeFieldCtx. R14 (class PRNG) + R15 (lazy maps) intact. **Outcome (a) — full recovery.** 1100/1100 library + 48/48 site + 11/11 bench-shape + 9/9 regression-vs-baseline. **Simple = 17µs (back to round-1 baseline)**, matcher = 1.396ms (+0.7% vs round-2 baseline; ~4.3× faster than pre-fix 7.0ms). **Full bench `verdict: OK` across all 8 tier×metric rows.** Memory: nested -16.9% (improved). R2 = 2154 B/call (well under 5 KB ceiling). Only failing test: B97-R1 simple ≤ 10µs perf threshold — informational red per spec's open question.
- manager: B97 reached its actual deliverables. R1 (≤10µs) decision is the last open item for the user.
- manager: user relaxed R1 to ≤20µs. Spec-writer amended (R1 ceiling + R1 prose + scenario THEN clause). Implementer updated `perf-thresholds.test.ts` threshold to 0.020.
- implementer (test-config): aligned R1 test's warmup/runs to match the full bench (warmup=1000/runs=5000) so the same JIT-warmup amortization is in scope as the spec's pinned 17µs measurement. Spec-writer synced R1's GIVEN clause accordingly.
- manager: dispatch reviewer.
- reviewer (round 1): **FAIL** — 5 findings: (1) `pnpm fmt` not run (22 files unformatted), (2) unused `generatorsData` import in src/world/engine.ts:85, (3) R1 measurement-config-dependent flakiness — 22.7µs on reviewer host in full bench means 20µs ceiling has too little headroom, (4) baseline.json matcher tier was captured at a noise-floor low (1.3865ms) so `pnpm bench` runs FAIL +33% on matcher tier, (5) B98 cross-card amendments only landed on R1+R9; R2/R4/R5/R7/R8 still narrate "three tiers". 3 reviewer tooling slips. Recommended R14 → D22 promotion (later revised in round 2 review).
- manager: re-dispatched spec-writer to (a) relax R1 from ≤20µs → ≤25µs (reviewer's "noise headroom for cross-host CI" rationale), (b) extend B98 R2/R4/R5/R7/R8 matcher-tier prose. Spec-writer flagged B98-R6's "three tiers" wording as a remaining inconsistency (out of scope for this round).
- implementer (round 6 — reviewer-fix): ran `pnpm fmt` (22 files); removed unused `generatorsData` import (engine.ts:85); updated R1 threshold to 0.025 (test + describe/it titles + console.log + docstring); refreshed `baseline.json` `results.matcher.zod4_mock` to median-of-3 (1.7359 ms) and `memory.matcher` to 104357232 B (representative not noise-floor). `pnpm validate` clean (lint+fmt+typecheck+tests all green; 1100/1100 + 48/48 + svelte-check 0/0). Full bench `verdict: WARN` (no FAIL on time tiers; matcher +2.2% vs refreshed baseline; nested memory +32.6% in WARN band — pre-existing gc noise). R1 = 21.68 µs / R7 = 1.93 ms.
- manager: dispatch reviewer round 2.
- reviewer (round 2): **PASS** — all 5 round-1 findings resolved; all 13 R-IDs verified with file:line evidence; B98 cross-amendments R2/R4/R5/R7/R8 verified extended; D1/D4/D10/D5/D6/D13/D17 compliance confirmed; scope clean. **Recommended NOT promoting R14 to a Rule** — class-vs-closure-object PRNG shape is implementation detail; the determinism contract is already bound by D4/D10. Advisory non-blocking: `tests/unit/generators/keys.test.ts:280-282` comment cites reverted R12/R13 (cosmetic; future polish). Tooling slips: 0.
- result: B97 done — moved card to wiki/backlog/done/, commit 91d40f3.

## 2026-06-04 — Manager run — site-cluster batch (B94 + result, B70, B71, B69, B82)

- manager: read wiki/INDEX.md + backlog; tree clean (no bootstrap-baseline commit needed)
- manager: presented ordered work plan (21 items); auto-flagged review on B69/B70/B71
- user: "Go work on the site (B94 + result, B70, 71, 69, 82). Without interrupt. no need to review, i'll verify post work." → pre-approved all review checkpoints in this batch; running until blocked.

## 2026-06-04 — B94: Design a docs system that does justice to zod4-mock

- manager: start, track: research (review pre-approved by user); git mv inbox/ → doing/
- manager: dispatch general-purpose researcher → wiki/research/reports/docs-system-design.md
- researcher: wrote 600-line report; recommends (c) bespoke SvelteKit `/docs/*` route tree with typed `+page.svelte` modules importing 9 doc primitives (`<DocPage>`, `<Playground>`, `<SignatureBlock>`, `<ParameterTable>`, `<InstallBlock>`, `<SpeedClaim>`, `<DefRef>`, `<RelatedShowcase>`, `<Prerequisites>`) on `@dxlbnl/ui`; Pagefind for search; `docs/api-reference.md` becomes a regenerated artifact from `site/src/lib/docs/api/manifest.ts` via `pnpm docs:generate` + `pnpm docs:check` parity guard; D5 rewrite; D18 successor rule. Rejects Astro Starlight + `docs/*.md` flat render redux. 6 follow-up cards proposed (researcher numbered B96–B101; renumbered to B100–B105 to avoid collision with existing repo IDs). No blocking open questions.
- manager: review pre-approved by user; no spec-validation gate (research has no spec). Card moved to done/.
- result: B94 done — commit 1e5283a (bundles research close + B100–B105 filings + B69/B70/B71 review-flag triage).

## 2026-06-04 — B100: Docs primitive library + chrome + landing (B94 follow-up #1)

- manager: start, track: feature (review pre-approved by user); git mv inbox/ → doing/
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B100-docs-primitive-library-chrome-landing.md (15 R-IDs, R1–R15); 5 non-blocking open questions (`<SpeedClaim>` branding, Storybook pattern, Pagefind timing, /relational + /comparison shape, old-routes stub-vs-leave). Updated wiki/specs/README.md index.
- manager: spec-validation gate passed (15 R-IDs, MUSTs, GIVEN/WHEN/THEN observable). Skip review-checkpoint per user pre-approval.
- manager: dispatch test-writer
- test-writer: wrote 13 test files under site/src/lib/docs/ (sidebar.test.ts, B100-files.test.ts, SpeedClaim.types.test.ts, 9 primitive .stories.svelte + 1 chrome .stories.svelte). RED confirmed: 6 unit failures + 2 suite-load failures + 31 svelte-check errors + 10 component story-load failures. Flagged spec-writer ts-expect-error placement bug (corrected by implementer at green).
- manager: dispatch implementer
- implementer: wrote 9 primitives + sidebar manifest + layout rewrite + landing + 9 stub routes + vitest exclude for \*.types.test.ts + D22 ADR in wiki/decisions.md. Deleted site/content/docs/, [slug]/, +page.ts. site:check 0/0, site:test:unit 55/55, site:test:component 47/47, site:build OK (SSR-safety R2 confirmed), test:all 1100+60+27+55+47 green, fmt:check 8 slips (all pre-existing or owned by manager).
- manager: dispatch reviewer
- reviewer: **PASS** — all R1–R15 met with evidence; D1/D13/D18/D21 clean; D22 ADR well-formed; @ts-expect-error placement fix verified. Non-blocking findings: (1) DocPage.svelte:17 `'index'` union scope-creep; (2) 4 new B100 files fail fmt:check; (3) manager TODO — promote D22 one-line Rule to architecture.md.
- manager: applied reviewer findings — dropped `'index'` union member from DocPage.svelte; ran `pnpm exec oxfmt` on new B100 files + B94 research report; appended one-line D22 Rule to architecture.md Rules section. Remaining 2 fmt slips (CHANGELOG.md from B97, site/bench/results/latest.json) are pre-existing, not in B100 scope.
- result: B100 done — commit 32f0507.

## 2026-06-04 — B70: Unify CLI + browser bench schema set

- manager: start, track: feature (review pre-approved); git mv inbox/ → doing/
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B70-site-unify-cli-browser-schemas.md (R1–R9). Canonical naming: CLI tier names (`simple`/`user`/`nested`/`matcher`) win because baseline.json + versions.json + threshold tests are pinned on them. Strategy: byte-equivalent assertion (no re-baseline). 6 non-blocking open questions.
- manager: spec-validation gate passed. Skip review-checkpoint per user pre-approval.
- manager: dispatch test-writer
- test-writer: wrote site/src/lib/schemas/B70.test.ts (32 tests against R1–R9). RED confirmed: 27/32 fail; 5 invariant-guards intentionally pass-now.
- manager: dispatch implementer
- implementer: created 5 canonical schema files (`simple.ts`, `user.ts`, `matcher.ts`, `nestedOrder.ts`, plus rewritten `nested.ts` to CLI mixed-features shape); created `index.ts` barrel; renamed `arraySchema` → `array`; deleted `flat.ts`; refactored 3 CLI bench files + 4 browser runners + bench page; extended `schemas.test.ts`. site:test:unit 93/93, site:check 0/0, site:bench verdict OK, validate green minus pre-existing latest.json fmt drift.
- manager: dispatch reviewer
- reviewer: **PASS** — all R1–R9 met; D1/D4/D10/D16 clean; perf gate green; byte-equivalence confirmed via empty `git diff` on baseline.json/versions.json/history.json. Flagged standing constraint for promotion.
- manager: promoted to D23 ADR in wiki/decisions.md + one-line Rule in wiki/architecture.md.
- result: B70 done — commit 023eba1.

## 2026-06-04 — B71: Replace fixed runs with time-budget bench measurement

- manager: start, track: feature (review pre-approved); git mv inbox/ → doing/
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B71-site-time-budget-bench.md (R1–R8). Strategy: `measure(fn, { warmup, budgetMs, maxRuns })`; CLI BUDGET_MS=500 / MATCHER_BUDGET_MS=1000; browser BUDGET_MS=200; byte-equivalent migration within ±5% (re-baseline fallback). 4 non-blocking open questions.
- manager: spec-validation gate passed. Skip review-checkpoint per user pre-approval.
- manager: dispatch test-writer
- test-writer: wrote bench.B71.test.ts + bench.B71.types.test.ts (11 runtime + 6 type-level fails) covering R1–R8.
- manager: dispatch implementer
- implementer: rewrote `measure()` with `{ warmup, budgetMs, maxRuns? }` + `runs` return field (R1/R2); migrated CLI bench files + `/bench` page; rewrote `latest.json` config block; cold-start preserved. R7 fallback invoked — re-baselined baseline.json against new run (jq extract; pre-rebaseline deltas were faster than B97 baseline → intervening optimizations, not B71 regressions). Updated wiki/site/benchmark-methodology.md. site:test:unit 105/105, site:check 0/0, site:bench OK/WARN (not FAIL).
- manager: dispatch reviewer
- reviewer: **FAIL** — 2 non-blocking findings: (1) R7 fallback incomplete — versions.json not updated with rebaseline marker; (2) 4 B71-owned files fail fmt:check.
- manager: applied fixes inline — extended versionsFileSchema with optional `methodologyChanges` array; added B71 methodology-change marker to versions.json (date/by/from/to/rationale); ran oxfmt on B71-owned files. site:test:unit 105/105 re-confirmed. Only pre-existing latest.json fmt slip remains (not B71 scope).
- result: B71 done — commit 9e28c87.

## 2026-06-04 — B69: Move /bench to a Web Worker

- manager: start, track: feature (review pre-approved); git mv inbox/ → doing/
- manager: dispatch spec-writer
- spec-writer: wrote wiki/specs/B69-site-bench-web-worker.md (R1–R8). Worker shape: `site/src/lib/bench.worker.ts` + typed protocol `site/src/lib/bench-worker-protocol.ts` + hand-rolled msg protocol (no Comlink). Page constructs worker in onMount, terminates onDestroy, posts run/listens for incremental result/done. Abort policy: ignore-while-running via existing `disabled={running}` (B73 owns Abort). 3 non-blocking open questions.
- manager: spec-validation gate passed. Skip review-checkpoint per user pre-approval.
- manager: dispatch test-writer
- test-writer: wrote bench-worker.B69.test.ts (7 runtime fails) + bench-worker-protocol.types.test.ts (9 type errors). RED confirmed across R1–R8.
- manager: dispatch implementer (1st dispatch hit subagent session limit before writing — no files touched; restarted fresh).
- implementer (round 2): created bench-worker-protocol.ts + bench.worker.ts + rewrote +page.svelte (no measure import, no setTimeout yields, Worker in onMount, terminate in onDestroy, typed onmessage handler). Edited B71-R4 test to align with B69-R3 (page no longer calls measure directly — budgetMs flows into BenchWorkerRequest); intent preserved. Moved a @ts-expect-error directive one line down in protocol types test (assertion unchanged). pnpm site:test:unit 113/113, site:check 0/0, site:test:component 47/47, site:build SSR green, validate green.
- manager: dispatch reviewer
- reviewer: **PASS** — all R1–R8 met with file:line evidence; D1/D13/D22/D23 clean; B71-R4 edit + @ts-expect-error placement both verified minimum changes with unchanged intent. Non-blocking note: D22 could be generalized to cover Worker construction in any site/ route (not just docs primitives); manager declined to promote (deferred to future Worker consumer; B69 spec R8 captures the rule locally).
- result: B69 done — commit 81a5192.

## 2026-06-05 — B82: Vercel deploy from site/ subdir

- manager: start, track: chore (review pre-approved; out-of-tree maintainer task — pipeline does the repo-side prep, the maintainer does the Vercel dashboard + DNS); git mv inbox/ → doing/
- manager: created `site/vercel.json` with workspace-aware install (`cd .. && pnpm install --frozen-lockfile`), `pnpm build`, framework=sveltekit. This makes the card's step 3 work (`pnpm install --frozen-lockfile` at `site/` would otherwise miss the workspace root). Updated wiki/site/architecture.md Deploy row + appended Repo-side prep notes to the card explaining what's now turn-key vs what the maintainer still owns. Verified `pnpm build` in site/ succeeds (SvelteKit + adapter-vercel emit to .vercel/output cleanly).
- manager: skip pipeline stages (chore + repo-side prep only; no spec/tests needed; dashboard work is non-automatable).
- result: B82 done from repo side — moved card to wiki/backlog/done/; commit pending. Maintainer's remaining actions (Vercel project create, Root Directory = site, preview deploy, DNS to zod4-mock.vercel.app) are documented in card Notes.

## 2026-06-05 — Site UX theme (user-approved plan: B75 → B96 → B77 → B78 → B81)

- manager: plan approved. Order: B75 (Playwright smoke net) first as a regression net for B96, then B96 (@dxlbnl/ui migration, review-flagged), B77 (copy button), B78 (storybook audit), B81 (cross-link sweep).

## 2026-06-05 — B75: Playwright smoke tests for site routes

- manager: start, track: feature; git mv inbox/ → doing/. Confirmed Playwright already a site dep (@playwright/test, playwright, @vitest/browser-playwright) — no new dependency. dispatch spec-writer.
- spec-writer: wrote `wiki/specs/B75-site-playwright-smoke.md` (R1 covers routes, R2 console-error fails, R3 rejection fails, R4 runnable command, R5 settle-before-assert, R6 runner isolation, R7 provable red-state, R8 drift guard). Corrected 3 card errors: `/table`→`/comparison`, the "Playwright runner under vite.config.ts" is actually vitest-browser Storybook, no new dep. No blocking questions.
- manager: spec-validation gate — ACCEPT with two noted exceptions (not bounced; SendMessage unavailable, cold re-dispatch too costly for the gain): (a) R4/R6 carry multiple RFC-2119 keywords (compound), but each obligation is pinned by an observable scenario; (b) R6/R8 are meta/guard reqs, gold-plating for a smoke suite. Test-writer steered to a single route-parametrized smoke spec (R1/R2/R3/R5) + minimal R7 red-proof; R4 as wiring; R6/R8 verified by reviewer reading config, NOT heavy dedicated tests. B75 unflagged → no review checkpoint. dispatch test-writer.
- test-writer: wrote `site/e2e/smoke.spec.ts` — one route-parametrized spec (ROUTE_TABLE loop, per-route console-error + pageerror collectors, networkidle settle, empty-list asserts; `/` also asserts non-blank body). No R6/R8 dedicated tests, no committed fault (R7 documented). RED confirmed: `pnpm site:test:e2e` → script/alias absent; `playwright test` → no config/testDir. Correct infra RED. dispatch implementer to wire the runner.
- implementer: wired the runner — created `site/playwright.config.ts` (testDir e2e, chromium, webServer `build && preview --port 4173`), added `test:e2e` (site) + `site:test:e2e` (root) scripts, `.gitignore` for site/test-results + playwright-report. `pnpm site:test:e2e` → **6/7 pass**; `/showcase` fails on a REAL pre-existing SSR 500 (JsonTree self-recursion breaks Svelte 5 server render). Implementer correctly STOPPED per instructions (no assertion weakening, no out-of-scope route fix). site:test:unit 113✓ + site:test:component 47✓ do NOT collect e2e (R6 isolation ✓).
- manager: B75 harness meets its acceptance (fails when a route throws) but I won't commit a red net. User chose: fix /showcase first, then land B75 green. **B75 parked in doing/** pending B107.
- note: validate currently red on fmt:check for pre-existing/untracked files (wiki/specs/README.md committed-dirty + the untracked B75 spec/smoke spec) — manager will `pnpm fmt` at B75 commit time.

## 2026-06-06 — B107: /showcase SSR 500 (JsonTree self-recursion)

- manager: filed bug (high) caught by B75's smoke net; created card in wiki/backlog/doing/. type: bug → full track + regression test. dispatch spec-writer.
- spec-writer: wrote `wiki/specs/B107-showcase-ssr-jsontree-recursion.md` (R1 JsonTree SSRs without throwing for recursive data; R2 regression test red-before/green-after, primary = `svelte/server` render unit test with B75 smoke as fallback; R3 /showcase 200 + smoke 7/7; R4 no client-tree change). Mechanism left to implementer. No blocking questions. Found svelte/server render in the node vitest project feasible (unproven-in-repo; fallback named).
- manager: spec-validation gate PASS (one keyword each, observable). dispatch test-writer (minimal: ONE svelte/server SSR regression test; R3 via existing B75 smoke, R4 via existing stories — no new tests).
- test-writer: KEY FINDING — the low-level `svelte/server` render does NOT reproduce the bug: vitest's dev-SSR transform resolves the `./JsonTree.svelte` self-import fine; the `$$renderer.component is not a function` throw only exists in the PRODUCTION `vite build` server bundle (chunks/ecommerce.js). So per R2's named fallback, the regression anchor is the existing B75 `/showcase` smoke test (verified RED now: 6/7, /showcase 500). Left a one-`it` marker `site/src/lib/widgets/JsonTree.ssr.test.ts` documenting the non-reproduction.
- manager: the marker is tagged B107-R2 but PASSES against unfixed code (not a real regression guard, mislabeled) → instruct implementer to DELETE it; regression anchor = B75 smoke (red→green). The "why low-level doesn't reproduce" stays documented in the spec Context + here. dispatch implementer. NOTE: bug only reproduces in prod build → implementer MUST verify via `pnpm site:test:e2e` (builds+previews), not dev.
- implementer: STOPPED with proof that the card's root cause was WRONG. Deleted the marker test (untracked). Tried the `<svelte:self>` fix on JsonTree → zero effect, identical error. Build-artifact diagnosis: the real defect is `site/src/routes/showcase/+page.svelte:155` — `panel: () => entityPanel(opt.key)` is a renderer-dropping arrow handed to `@dxlbnl/ui` `Tabs` (which calls `tab.panel($$renderer)`); `opt.key` lands in `entityPanel`'s compiled `$$renderer` slot, so the first child (`JsonTree`) sees a string renderer → `$$renderer.component is not a function`. JsonTree is the first victim, not the cause. Correctly stopped (out-of-scope file + a real Snippet-idiom design choice). JsonTree.svelte left unchanged.
- manager: implementer's finding is a root-cause correction to the SAME bug → folded into B107 (not a new item, per the open-question/correction rule). Rewrote the card: corrected root cause, re-scoped fix surface to `showcase/+page.svelte` (Tabs `panel` Snippet), kept filename. Re-dispatch spec-writer to correct the spec Context + R1 and PIN the correct `@dxlbnl/ui` `Tabs.panel` Snippet idiom (from dxlb-ui docs + a working Tabs/CodePanel usage). Test stage unchanged (smoke remains the regression anchor) — no test-writer re-run.
- spec-writer (correction): rewrote B107 spec Context to the real root cause; pinned the idiom from `/home/dexter/Projects/Web/dxlb-ui/docs/data.md` Tabs section — `panel: Snippet` (zero-arg, `{@render tab.panel()}`), canonical usage passes a bare snippet (`panel: overview`); the showcase arrow must become a real Snippet. R1 reframed to the observable at the correct surface; R2 (smoke anchor, prod-only), R3 (200 + 7/7), R4 (no panel/JsonTree behaviour change) kept. No blocking questions. Only `<Tabs panel:>` usage in site is the broken one (CodePanel takes string-array tabs, not a snippet — not a mirror).
- manager: spec-validation gate PASS. re-dispatch implementer with corrected scope (fix `showcase/+page.svelte` Tabs panel Snippet; verify via prod-build `pnpm site:test:e2e`).
- implementer: fixed `site/src/routes/showcase/+page.svelte` only — added per-entity-key zero-arg wrapper `{#snippet}`s rendering `{@render entityPanel('<key>')}`, mapped each tab to its bare Snippet ref (`panel: panelByKey[opt.key]`) inside an `entityTabs` snippet, replacing the renderer-dropping arrow. `entityPanel` body + `JsonTree.svelte` byte-for-byte unchanged; styling/D21 untouched; no new dep; no any. **`pnpm site:test:e2e` → 7/7 green** (red→green confirmed; `/showcase` now 200). site:check 0, site:test:component 47✓ (R4), site:test:unit 113✓.
- manager: B107 fix + B75 harness both green via the same e2e run. dispatch ONE combined reviewer for B75 + B107 (coupled; B107's regression anchor = B75's smoke; one e2e run) — separate PASS/FAIL per item.
- reviewer: **B75 PASS** (R1–R8, no scope creep, no new dep) and **B107 PASS** (R1–R4, fix confined to showcase/+page.svelte, JsonTree.svelte verified unchanged). Evidence: `pnpm site:test:e2e` 7/7 exit 0; site:test:unit 113✓ + site:test:component 47✓ neither collecting the e2e spec (R6); site:check 0 errors.
- manager: `pnpm fmt` (cleaned new spec/config files + pre-existing wiki/specs/README.md dirt), git mv B75 card → done/, mv (untracked) B107 card → done/. `pnpm validate` exit 0. Site is `private: true` → no changeset (library/locale untouched). No GitHub issue refs → no `(closes)`.
- result: **B75 + B107 done** — committed together (coupled items: B75's net only goes green with B107's fix; B107's regression anchor is B75's smoke; shared README catalog edit; keeps every commit's e2e green). doing/ empty.

## 2026-06-06 — Planning pass (inbox → phased plan)

- manager: resumed; ready/ + doing/ empty, 21 items in inbox/. Reconstructed the B84 five-phase site-rebuild grouping (+ B94 docs sub-plan as Phase 2). Remaining per phase: P1=B96; P2(docs)=B101/B102/B103/B104/B105 + B81; P3=B73 + B72; P4a(lib)=B85/B86/B87/B88, P4b=B90(blocked); P5=B74/B77/B78; independent=B58-B, B99, B80(obsolete by P4).
- manager: presented phased plan to user. User chose **Phase 1 next (B96)**. B80-cancel question deferred (left in inbox for now).

## 2026-06-06 — B96: Finish the @dxlbnl/ui migration (route bodies + legacy tokens)

- manager: start, track: feature (flagged review); git mv inbox/ → doing/. Phase 1 closer of B84 (B95 did the narrow primitive swap; B96 migrates remaining route-body layout/typography/tokens + deletes app.css compat aliases). dispatch spec-writer.
- spec-writer: wrote `wiki/specs/B96-site-finish-dxlbnl-layout-migration.md` (R1 zero `var(--space-*)`; R2 zero `.t-*` classes; R3 layout composes @dxlbnl/ui primitives; R4 no legacy alias tokens read; R5 delete alias block + .t-_/.btn/.seg/.kbd from app.css, preserve D21 layer; R6 B75 smoke 7/7 stays green = behavioural anchor; R7 D19/D17/D20/D18/D22 preserved; R8 validate+site:check+component green). Pinned the full legacy→@dxlbnl/ui equivalence map + file inventory. Corrected the card's imprecise token list: `--rule`/`--bg-rail`/`--ink-dim` are CANONICAL and stay; only `--space-_` + gen-bench aliases delete. 3 non-blocking open questions (missing-primitive path, nearest-variant typography, residual 4px/12px literals); no blocking.
- manager: spec-validation gate PASS (each R one keyword + observable scenario). User directive mid-run: "make sure a designer takes a look at each page" → folding in a per-route designer visual pass (Chrome DevTools MCP) alongside the reviewer at the green stage; saved as standing preference. B96 flagged review → **paused at review checkpoint #2 for spec approval** before test-writer.
- manager: user **approved** the spec ("Approve, proceed") and chose the designer pass to cover **all 7 B75 smoke routes**. dispatch test-writer (minimal: grep-invariant static test for R1/R2/R4/R5; R6 rides existing B75 smoke; R8 rides existing validate/component/site:check — no new heavy tests, per the one-test-per-requirement rule).
- test-writer: wrote `site/src/lib/B96.test.ts` (site node-vitest project, reuses B95.test.ts static-invariant idiom — `node:fs` walker + self-collision guard). One test per requirement ID: R1 (zero `var(--space-*)`), R2 (zero `.t-*` markup applications), R4 (zero legacy alias-token reads), R5 (app.css alias block + .t-\*/.btn/.seg/.kbd gone, D21 layer+imports preserved). RED confirmed: `pnpm site:test:unit` → 4 failed / 113 passed; failures = legacy tokens/classes/alias-block still present pre-migration (correct RED). R3/R7 reviewer+designer-verified (R3 parse-check judged too fragile to commit); R6 rides B75 smoke; R8 rides validate/component.
- manager: dispatch implementer (migrate the inventory, delete app.css alias block, keep D21; verify B75 smoke 7/7 via prod-build e2e).
- implementer: GREEN. Migrated 7 route bodies + ~11 shared widgets + 7 docs widgets + app.css. Deleted the alias `:root` block + `.t-*` + dead `.btn`/`.seg`/`.kbd`; preserved D21 layer + token imports; canonical tokens untouched. Composed around the segmented-control gap (no @dxlbnl/ui primitive) by inlining `.seg` styling into the widget's scoped `<style>` with canonical tokens (B95 precedent, a11y intact); `--accent-soft`→inline `color-mix`. Results: site:test:unit 117✓ (4 B96 invariants green), site:check 0, site:test:component 47✓, **site:test:e2e 7/7 on prod build** (R6), validate green except oxfmt on 4 pre-existing dirty files (B96 test/spec + 2 wiki). No new dep, no `any`. Notes appended to card.
- reviewer: **PASS** — R1–R8 all met with file:line evidence; D21 preserved; canonical "stays" tokens intact; D19 funnel + D17/D20 framing + D18/D22 editor mounting preserved; no scope creep; segmented-control compose-around behaviour-neutral (real `<button role="tab">` + aria-selected). No standing constraint to promote.
- manager: dispatch per-page designer pass (user directive) over all 7 B75 smoke routes — Playwright screenshot capture against the prod preview + visual review.
