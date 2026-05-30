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
  1. `tests/unit/core/world.test.ts:633` — "adding a field does not change values of existing fields" — the **canonical D4 test**. Two separately-constructed `z.object(...)` schemas (SchemaA / SchemaB) get different WeakMap IDs under B39's reference-identity model, so their `name` and `email` fork keys differ → values differ → "adding `age` between them DOES change `name` and `email`." This is the foundational stability claim that D4 was *supposed* to protect.
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
- result: done — commit pending
