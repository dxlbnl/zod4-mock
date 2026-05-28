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
- result: done — commit 850327e

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
- result: done — see commit below
