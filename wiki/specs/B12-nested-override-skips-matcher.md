# B12: BUG — Nested-object overrides skip the matcher and don't deep-merge

## Context

For a field that has both a registered matcher and a partial-object `overrides[field]`,
`generateObjectFields` ([src/world.ts](../../src/world.ts)) currently assigns the partial
override **raw** in place of the matcher's result. The matcher is never invoked, so the
fields the matcher would have populated (e.g. `avatar`) are absent from the output. The
end-of-record `deepMerge(result, options.overrides)` in `generateSingleItem` cannot
recover them because the matcher's full value was never computed — `result[key]` is
already the partial.

This contradicts the user-facing typing of `GenerateOptions['overrides']` —
`DeepPartial<input<TSchema>>` (see `DeepPartial` and `GenerateOptions` in
[src/types.ts](../../src/types.ts)) — which advertises **deep partial** merge semantics.
The end-of-record `deepMerge` already gives those semantics for fields with no matcher;
the matcher branch must do the same.

The reviewer-approved scope expansion (see Open questions, resolved) also aligns the
**key-map**, **custom key generator**, **key-based heuristic**, and **schema-based**
branches of `generateObjectFields` to apply the same in-step `deepMerge` pattern when a
non-null plain-object override is present. Today those branches take `fieldOverride`
verbatim when present (so the final-pass `deepMerge` in `generateSingleItem` is what
makes the user-visible result correct), but **sibling matchers** that read
`ctx.current.<sibling>` mid-record see the **branch-generated value** rather than the
merged value. The in-step alignment makes mid-record `ctx.current` consistent with the
final user-visible record.

Relevant code:

- All branches in `WorldImpl.generateObjectFields` ([src/world.ts](../../src/world.ts)):
  step 0 (eager-override fast path for primitives/null/arrays), step 1 (matcher),
  step 2 (per-schema key map), step 4 (custom world-level key generator), step 5
  (key-based heuristic), step 6 (schema-based: object-like recurses via
  `fieldCtx.generate(innerSchema, { overrides: fieldOverride })`, non-object takes
  `fieldOverride` verbatim).
- The final-pass `deepMerge(result, options.overrides)` in `generateSingleItem` — the
  catch-all that already gives the no-matcher path its deep-merge behaviour and remains
  in place as a safety net after this fix.
- The `deepMerge` helper in [src/utils/merge.ts](../../src/utils/merge.ts), introduced
  alongside `deepEqual` in B6 — already does exactly the right thing: nested-object
  source merges recursively, arrays/primitives/null replace.
- `DeepPartial<T>` and `GenerateOptions<T>['overrides']` in
  [src/types.ts](../../src/types.ts) — the typing this fix must remain consistent with.

Item card: [wiki/backlog/doing/B12-nested-override-skips-matcher.md](../backlog/doing/B12-nested-override-skips-matcher.md);
GitHub issue #12.

Per **D6** in [wiki/decisions.md](../decisions.md), this bug fix MUST add a regression
test. Per the architecture Rules, the implementation MUST NOT use `any` and all relative
imports MUST use `.js` extensions; the existing `deepMerge` reuse already satisfies both.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B12-R1: nested-object override deep-merges with the matcher result

When a registered matcher exists for a field **and** `overrides[field]` is a non-null
plain object (not an array), the matcher MUST be invoked first and the override MUST be
deep-merged on top of the matcher's value (`deepMerge(matcherValue, fieldOverride)`),
using the existing `deepMerge` helper from [src/utils/merge.ts](../../src/utils/merge.ts).
Matcher leaves not present in the override MUST be preserved; override leaves MUST win
over matcher leaves on conflicting keys. The merge MUST be recursive — nested objects
inside the override merge into the corresponding nested objects produced by the matcher.

This applies regardless of whether the field's Zod type is `z.object(...)` directly or
an `optional`/`nullable`/`default`-wrapped object, since the branch is selected by the
**presence of a matcher**, not by the schema shape.

- Scenario: matcher leaves preserved, override leaves win (the exact card repro)
  GIVEN a world with a schema
  `z.object({ name: z.string(), profile: z.object({ bio: z.string(), avatar: z.string() }) })`
  registered with a matcher
  `profile: () => ({ bio: "matcher-bio", avatar: "https://example.com/a.png" })`
  WHEN `world.generate(UserSchema, { overrides: { profile: { bio: "overridden-bio" } } })`
  is called
  THEN the returned `user.profile` deep-equals
  `{ bio: "overridden-bio", avatar: "https://example.com/a.png" }` — both the override's
  `bio` and the matcher's `avatar` are present.

- Scenario: recursive merge into a doubly-nested object
  GIVEN a world with a schema
  `z.object({ profile: z.object({ contact: z.object({ email: z.string(), phone: z.string() }) }) })`
  registered with a matcher
  `profile: () => ({ contact: { email: "m@example.com", phone: "+10000000000" } })`
  WHEN `world.generate(UserSchema, { overrides: { profile: { contact: { email: "o@example.com" } } } })`
  is called
  THEN the returned `user.profile.contact` deep-equals
  `{ email: "o@example.com", phone: "+10000000000" }` — the override descends one level
  past the matcher's object and replaces only the overlapping leaf.

### B12-R2: regression test for the reported failure

A regression unit test for the exact failure in the item card MUST live under
`tests/unit/core/` (per D6) and MUST assert: matcher produces `{ bio, avatar }`,
`overrides` supplies `{ bio }` only, and the resulting record contains the override
`bio` **and** the matcher's `avatar` (asserting both leaves explicitly, so a regression
to "override replaces matcher" or "matcher replaces override" both fail). B12-R5's own
scenarios pin the parallel invariant for the other branches but do NOT replace this
regression — the card's exact repro MUST be present as its own test case.

- Scenario: regression test exists and asserts the card's expectation
  GIVEN the test file under `tests/unit/core/` containing the regression
  WHEN `pnpm test` is run
  THEN the file contains at least one test case that registers a matcher for a nested
  object field producing two leaves, generates with `overrides` for **one** of those
  leaves, asserts the override leaf equals the override value, asserts the other leaf
  equals the matcher's value, and the suite passes.

### B12-R3: existing behaviours preserved

Other interactions of the field pipeline MUST continue to behave as they do today; this
fix changes only the in-step override-merge behaviour for object overrides and does not
alter the resolution-order pipeline or the array/primitive replace semantics:

1. A field **without** a matcher (resolved by key-map, custom key generator, key-based
   heuristic, or schema-based generator) MUST still produce the same user-visible value
   as today: in-step deep-merge applies when the branch yields an object AND the
   override is a non-null plain object (B12-R5), with the final-pass
   `deepMerge(result, options.overrides)` in `generateSingleItem` remaining as the
   catch-all safety net. The two layers are idempotent — when the in-step merge has
   already produced the merged value, the final pass does nothing harmful (it merges the
   same override into the same merged object). For non-object branch values, or for
   primitive/array/null overrides, behaviour is identical to today.
2. A field **with** a matcher and **no** override MUST produce the matcher's value
   unchanged.
3. A field **with** a matcher and a **primitive, `null`, or array** override MUST take
   the override value verbatim (replace, not merge) — matching the existing step 0
   eager-override fast path and `deepMerge`'s own array/primitive replace semantics.

These three sub-behaviours MUST be pinned by scenarios so the fix cannot regress them.

- Scenario: field without a matcher still deep-merges (final user-visible value unchanged)
  GIVEN a world with the schema in B12-R1 registered with **no** matchers (so `profile`
  has no matcher; values come from the schema-based pipeline)
  WHEN `world.generate(UserSchema, { overrides: { profile: { bio: "overridden-bio" } } })`
  is called
  THEN the returned `user.profile.bio` equals `"overridden-bio"` AND `user.profile.avatar`
  is a non-empty string produced by the schema-based generator (i.e. the sibling leaf is
  preserved — identical user-visible behaviour to today's `tests/unit/core/overrides.test.ts`
  → "preserves sibling nested fields when overriding one").

- Scenario: matcher with no override produces matcher value unchanged
  GIVEN the world from B12-R1 (matcher returning `{ bio: "matcher-bio", avatar: "https://example.com/a.png" }`)
  WHEN `world.generate(UserSchema)` is called with no `overrides`
  THEN the returned `user.profile` deep-equals
  `{ bio: "matcher-bio", avatar: "https://example.com/a.png" }`.

- Scenario: primitive override on a matcher-backed field replaces (no merge)
  GIVEN a world with `z.object({ name: z.string() })` registered with a matcher
  `name: () => "matcher-name"`
  WHEN `world.generate(Schema, { overrides: { name: "overridden-name" } })` is called
  THEN the returned `result.name` equals `"overridden-name"` (the primitive override
  replaces the matcher's value — unchanged from today's step 0 behaviour).

- Scenario: array override on a matcher-backed field replaces (no element-wise merge)
  GIVEN a world with `z.object({ tags: z.array(z.string()) })` registered with a matcher
  `tags: () => ["m1", "m2", "m3"]`
  WHEN `world.generate(Schema, { overrides: { tags: ["alpha", "beta"] } })` is called
  THEN the returned `result.tags` deep-equals `["alpha", "beta"]` (the array override
  replaces wholesale; matcher elements at indices 2+ are NOT preserved).

### B12-R4: no regressions in the full test suite

The fix MUST keep the full test suite green (`pnpm test`). No existing test assertion
MAY be changed to accommodate the fix — only **new** tests for B12-R1/R2/R3/R5 may be
added. In particular, the existing `tests/unit/core/overrides.test.ts` cases (top-level
scalar override, sibling preservation under deep merge, array replace) MUST continue to
pass unmodified.

- Scenario: full suite green with no edits to existing assertions
  GIVEN the implementation of B12 on top of the current `main`
  WHEN `pnpm test` is run from the repo root
  THEN every existing test case in `tests/unit/` and `tests/integration/` passes with
  its current assertions unchanged, and the new B12 regression test(s) added under
  `tests/unit/core/` also pass.

### B12-R5: in-step deep-merge applies to the key-map, key-based, and schema-based branches too

When a field is resolved by the **per-schema key map** (step 2), the **custom
world-level key generator** (step 4), the **key-based heuristic** (step 5), or the
**schema-based** generator (step 6) **and** `overrides[field]` is a non-null plain
object (not an array), the branch's value MUST be computed first and the override MUST
be deep-merged on top using the existing `deepMerge` helper, exactly mirroring the
B12-R1 matcher pattern (`deepMerge(branchValue, fieldOverride)`). Primitive, `null`, and
array overrides keep replace semantics in every branch, consistent with the eager step 0
fast path and `deepMerge`'s own array/primitive replace.

The schema-based branch (step 6) already recurses for object-like schemas via
`fieldCtx.generate(innerSchema, { overrides: fieldOverride })`, which already deep-merges
in-step; the requirement pins that in-step behaviour and additionally extends it to the
non-recursive case where any branch happens to yield an object value.

The in-step merge is the **first** layer; the existing final-pass
`deepMerge(result, options.overrides)` in `generateSingleItem` remains as the catch-all
safety net. The two layers are idempotent for object overrides — the final pass merges
the same override into an already-merged object and produces the same value — so this
requirement does not change today's user-visible result for the no-matcher path. The
observable change it pins is that **mid-record sibling matchers** reading
`ctx.current.<sibling>` see the **merged** value rather than the branch's raw value when
the override for that sibling is an object.

**Realism note:** today the per-schema key map (step 2), the custom world-level key
generator (step 4), and the key-based heuristic (step 5) in `DEFAULT_KEY_MAP` /
`DEFAULT_KEY_PATTERNS` ([src/generators/data/key-map.ts](../../src/generators/data/key-map.ts))
only emit **primitive** values (strings, numbers, dates). For these branches the
in-step-merge rule is a **forward-looking invariant** — it fires only if a user supplies
a key-map function or custom key generator that returns a plain object. The schema-based
branch (step 6) is the realistic in-scope case: it routinely yields object values for
`z.object` fields without a matcher, and the in-step merge already applies via the
recursive `generate` call. The scenarios below pin each branch's in-step invariant; the
key-map / custom-generator / key-based scenarios are forward-looking guards (and are
realistic to construct because users can register their own generators).

- Scenario: per-schema key-map branch deep-merges an object override with its returned object
  GIVEN a schema `Schema = z.object({ profile: z.object({ bio: z.string(), avatar: z.string() }) })`
  registered with **no** matchers but with a per-schema key map
  `world.withKeyMap(Schema, { profile: () => ({ bio: "keymap-bio", avatar: "keymap-avatar" }) })`
  WHEN `world.generate(Schema, { overrides: { profile: { bio: "overridden-bio" } } })`
  is called
  THEN the returned `result.profile` deep-equals
  `{ bio: "overridden-bio", avatar: "keymap-avatar" }` — the key-map function's `avatar`
  leaf is preserved and the override's `bio` wins.

- Scenario: custom world-level key generator branch deep-merges an object override with its returned object
  GIVEN a world created with
  `createWorld({ seed: 1, generators: { profile: () => ({ bio: "custom-bio", avatar: "custom-avatar" }) } })`
  and a schema `Schema = z.object({ profile: z.object({ bio: z.string(), avatar: z.string() }) })`
  registered with **no** matchers and **no** per-schema key map
  WHEN `world.generate(Schema, { overrides: { profile: { bio: "overridden-bio" } } })`
  is called
  THEN the returned `result.profile` deep-equals
  `{ bio: "overridden-bio", avatar: "custom-avatar" }` — the custom generator's `avatar`
  leaf is preserved and the override's `bio` wins.

- Scenario: key-based heuristic branch yielding a primitive — primitive override still replaces (today's behaviour pinned)
  GIVEN a schema `Schema = z.object({ email: z.string() })` (the `email` key triggers the
  key-based heuristic `data.internet.email`) registered with no matchers
  WHEN `world.generate(Schema, { overrides: { email: "override@example.com" } })` is called
  THEN the returned `result.email` equals `"override@example.com"` — the primitive
  override replaces, identical to today's behaviour. (The key-based heuristic only emits
  primitives in the shipped generator data; this scenario pins that the in-step layer is
  a no-op for primitive branch values and that the user-visible result is unchanged.)

- Scenario: schema-based branch on a `z.object` field deep-merges (in-step via recursion)
  GIVEN a schema `Schema = z.object({ profile: z.object({ bio: z.string(), avatar: z.string() }) })`
  registered with **no** matchers, **no** per-schema key map, and no custom key
  generator (so `profile` is resolved by the schema-based generator, which recurses)
  WHEN `world.generate(Schema, { overrides: { profile: { bio: "overridden-bio" } } })`
  is called
  THEN the returned `result.profile.bio` equals `"overridden-bio"` AND
  `result.profile.avatar` is a non-empty string produced by the schema-based generator —
  i.e. the schema-based branch's recursive `generate` call with `{ overrides: fieldOverride }`
  delivers the in-step deep-merge.

- Scenario: sibling matcher reading ctx.current sees the merged value, not the raw branch value
  GIVEN a schema
  `Schema = z.object({ profile: z.object({ bio: z.string(), avatar: z.string() }), summary: z.string() })`
  registered with no matcher for `profile` (schema-based branch yields an object) and a
  matcher for `summary` that returns
  `(ctx) => (ctx.current as { profile?: { bio?: string } }).profile?.bio ?? ""`,
  with the shape ordered so `profile` is generated before `summary`
  WHEN `world.generate(Schema, { overrides: { profile: { bio: "overridden-bio" } } })`
  is called
  THEN the returned `result.summary` equals `"overridden-bio"` — the `summary` matcher
  saw the **merged** `profile.bio`, demonstrating the in-step merge invariant for the
  schema-based branch.

- Scenario: primitive override on a key-map-backed object field replaces (no merge)
  GIVEN the world from the per-schema key-map scenario (key map returns an object for
  `profile`)
  WHEN `world.generate(Schema, { overrides: { profile: null } })` is called
  THEN the returned `result.profile` equals `null` — `null` overrides keep replace
  semantics in every branch, consistent with the eager step 0 fast path.

## Out of scope

- Changes to `deepMerge` itself — the helper in [src/utils/merge.ts](../../src/utils/merge.ts)
  is already correct (nested-object recurse, array/primitive replace) and is the
  intended reuse target. This fix does not add new merge semantics; it routes
  matcher- / key-map- / key-generator- / key-based- / schema-based-resolved object
  values through that existing helper when the override is a plain object.
- Element-wise array overrides (merging override `[i]` into matcher `[i]`). Arrays keep
  replace semantics, consistent with both the step 0 eager-override fast path and the
  existing top-level `deepMerge`. A future feature could introduce indexed array merge,
  but it is not part of this bug fix.
- Public API or type surface changes. `GenerateOptions['overrides']` keeps its current
  `DeepPartial<input<TSchema>>` typing; the fix makes runtime behaviour match it.
  Because there is no public-API change, `docs/api-reference.md` does **not** need an
  entry per D5 — but `docs/recipes.md` or `docs/concepts.md` MAY note the now-correct
  matcher + override merge in passing if a related example exists (optional, not
  required by this spec).
- Changes to the resolution-order pipeline (steps 1 → 6 stay in the same order; only
  the in-step handling of an object override on top of an object-valued branch result
  changes — see B12-R5).

## Open questions

- **Should an explicit `undefined` value in an object-typed override remove a matcher
  leaf, or be ignored? — Non-blocking.** `deepMerge` today copies `undefined` over,
  effectively setting the leaf to `undefined`. This is consistent with how the rest of
  the codebase uses `deepMerge` (see the array-elements branch in `WorldImpl.generateArray`
  and the final pass in `generateSingleItem`), and `DeepPartial<T>` permits undefined
  leaves. Recorded; the fix inherits `deepMerge`'s current semantics without change. Not
  blocking — the card's repro does not exercise this case.

No blocking open questions remain; the spec can advance to `test-writer`.
