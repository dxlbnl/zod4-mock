# B18: BUG — `deepMerge` recurses into `Date` / `Map` / `Set` / `RegExp` and loses the value

## Context

`deepMerge` in [src/utils/merge.ts](../../src/utils/merge.ts) is the single helper that
performs every override-on-generated-value merge in the library. Its current early-return
only rejects non-objects, `null`, and arrays — so any "atomic" object whose internal state
is not exposed as own enumerable keys (a `Date`, `Map`, `Set`, `RegExp`, `URL`, a typed
array, or any class instance) flows into the `Object.keys` recursion. For those values
`{ ...new Date() }` is `{}` and `Object.keys(new Date())` is `[]`, so the merge produces
`{}` and the user's atomic override is silently dropped. The repro on the item card
([wiki/backlog/doing/B18-deepmerge-atomic-objects.md](../backlog/doing/B18-deepmerge-atomic-objects.md))
pins this exactly: overriding a `z.date()` field with `new Date(...)` returns `{}` instead
of the Date.

**Root cause** (per the debugging practice — confirmed by reading
[src/utils/merge.ts](../../src/utils/merge.ts) lines 5–23 and the repro on the card): the
predicate that selects "leaf, replace verbatim" in `deepMerge` tests only
`typeof !== 'object' || null || Array.isArray`. It does not distinguish a **plain** object
(merge target) from a **non-plain** object (atomic leaf). Every non-plain object is
mis-classified as mergeable and reduced to `{}` because its internal state is not exposed
as own enumerable properties.

**Blast radius** — `deepMerge` is invoked at every override-merge site in
[src/world.ts](../../src/world.ts), so the fix in `deepMerge` itself covers all of them
in one change:

- B12's in-step layered model — the matcher branch (line 829), the per-schema key map
  branch (line 838), and the custom world-level key generator branch (line 881) each call
  `deepMerge(branchValue, fieldOverride)` on a field whose override is a non-null,
  non-array object. Whenever the override is an atomic object (e.g. a `Date`), the
  current `deepMerge` reduces it to `{}` — silently breaking the user's intent. See
  [wiki/specs/B12-nested-override-skips-matcher.md](B12-nested-override-skips-matcher.md).
- The final-pass `deepMerge(result, options.overrides)` in `generateSingleItem`
  ([src/world.ts](../../src/world.ts) line 1167) — same helper, same defect, same blast.
- The ad-hoc array-element override branch in `generateArray`
  ([src/world.ts](../../src/world.ts) line 1011) — `deepMerge(item, ov)` for each element
  override. An atomic per-element override (a `Date` element override on a `z.array(z.date())`)
  is dropped today through the same path.
- B14's transform pipeline — `transformApplied` keeps `generateSingleItem`'s outer
  `deepMerge` from double-applying after the helpers, but the helpers themselves still
  call `deepMerge` for `overrides` via `generateObjectFields` (per B12-R5), so the same
  bug fires before the transform runs. See
  [wiki/specs/B14-world-populate-factory.md](B14-world-populate-factory.md).

The sibling `deepEqual` helper in the same file ([src/utils/merge.ts](../../src/utils/merge.ts)
lines 30–58) is **separate** and **unaffected** — it only walks plain `Object.keys`
without recursing into atomic objects' internals, but it falls back through `Object.is`
on equal references (and returns `false` on differing-reference atomic objects, which is
the correct conservative answer for value-identity). No change is needed there. B6's
behaviour (`world.get` predicate matching via `deepEqual`) is unaffected by this fix.

**Realm robustness (resolved from the card's open question).** The proposed fix on the
card uses an `isPlainObject` predicate. There are two viable shapes:

- (a) `Object.getPrototypeOf(value) === Object.prototype || === null` — same-realm,
  simpler, faster, recognises only plain objects from this realm and `Object.create(null)`
  dicts.
- (b) `Object.prototype.toString.call(value) === '[object Object]'` — realm-robust,
  marginally slower, recognises plain objects from other realms too **and** still
  rejects `Date`/`Map`/`Set`/`RegExp` (each of which sets its own `@@toStringTag` so
  they stringify to `'[object Date]'`, `'[object Map]'`, `'[object Set]'`,
  `'[object RegExp]'`).

**Decision: (a).** `zod4-mock` is a Node-only ESM library used in tests, fixtures,
playground generators, and back-end seeding. It does not run inside an iframe and there is
no realm boundary to cross at the `deepMerge` boundary; the only realm the library sees
is the one its consumers' test/build process runs in. (a) is simpler, allocates no string
on the fast path, and the same-realm constraint is a documented, theoretical limit (we
are not aware of a single consumer crossing realms into `deepMerge`). This local choice
does not establish a standing constraint — it is one helper's predicate, not a pattern
future work must obey — so it is recorded **in this spec only** (per the decisions /
rules bar in `decisions.md`), not promoted to `wiki/decisions.md`.

**Per the debugging practice** ([.claude/practices/debugging.md](../../.claude/practices/debugging.md)):
the repro is the card's exact failure shape (override `z.date()` with `new Date(...)`,
result lost), the root cause is the missing plain-object guard in `deepMerge`'s
early-return predicate, the fix lands in the helper itself (single source change), and a
regression test pins both the repro and the additional atomic-object variants so the bug
cannot return. The full suite must stay green so the existing
`tests/unit/utils/merge.test.ts`-style cases (plain-object recursion, array replace,
primitive replace) cannot regress.

**Architecture Rules ([wiki/architecture.md](../architecture.md)) and decisions
([wiki/decisions.md](../decisions.md)) compliance**:
- D1 (no `any`) — the existing `deepMerge` already uses `unknown` parameters; the new
  `isPlainObject` predicate MUST follow suit. No `any`.
- D1 (`.js` import extensions) — no new imports are needed; if any are added, they MUST
  carry the `.js` extension.
- D4 (per-field PRNG determinism) — unaffected. `deepMerge` consumes no PRNG state.
- D5 (`docs/api-reference.md` on public-API change) — **not applicable** here. The fix
  changes `deepMerge`'s internal handling of non-plain objects, not the public API
  surface; `deepMerge` is not exported from `src/index.ts` and is not documented in
  `docs/api-reference.md`. The item card itself notes "No new API surface;
  `docs/api-reference.md` doesn't change."
- D6 (regression test for bug fixes) — **required and pinned by B18-R4 below**.

Item card: [wiki/backlog/doing/B18-deepmerge-atomic-objects.md](../backlog/doing/B18-deepmerge-atomic-objects.md).
Closes GitHub issue #19.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B18-R1: `deepMerge` treats any non-plain-object source as a leaf and returns it untouched

`deepMerge(target, source)` in [src/utils/merge.ts](../../src/utils/merge.ts) MUST treat
any `source` that is not a **plain object** (i.e. not an object whose prototype is
`Object.prototype` or `null`) as a leaf value and return it as-is, by reference, without
recursing. The same MUST apply when `target` is not a plain object — `deepMerge` MUST
return `source` verbatim rather than spreading `target` and dropping `source`. "Plain
object" MUST be tested via the same-realm prototype check
`Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null`
(see Context for why same-realm is the chosen scope). The leaves the predicate MUST
reject — and pass through verbatim by reference — include at minimum:

- `Date` instances,
- `Map` instances,
- `Set` instances,
- `RegExp` instances,
- class instances (any user-defined class — positive guard that the predicate is not just
  filtering on `Object.prototype.toString` tags).

`null`, primitives (`number`, `string`, `boolean`, `bigint`, `symbol`, `undefined`), and
arrays MUST continue to be returned verbatim as today; `null` MUST keep replace semantics
(B12-R3 sub-bullet 3 — `null` overrides replace).

No `any` MUST appear in the new predicate (D1). The predicate MUST be declared with
`unknown`-typed input and a type predicate or boolean return; no cast outside the
existing `as Record<string, unknown>` shape MAY be introduced.

- Scenario: Date source replaces, by reference
  GIVEN `const target = { at: { ignored: true } }` and
  `const source = { at: new Date("2024-01-01T00:00:00Z") }`
  WHEN `const result = deepMerge(target, source) as { at: unknown }`
  THEN `result.at instanceof Date === true`, `result.at === source.at` (strict reference
  equality — the Date is passed through, not reconstructed), and
  `(result.at as Date).toISOString() === "2024-01-01T00:00:00.000Z"`.

- Scenario: Map source replaces, by reference
  GIVEN `const target = { m: { ignored: true } }` and
  `const source = { m: new Map<string, number>([["a", 1], ["b", 2]]) }`
  WHEN `const result = deepMerge(target, source) as { m: unknown }`
  THEN `result.m instanceof Map === true`, `result.m === source.m`, and
  `(result.m as Map<string, number>).get("a") === 1`.

- Scenario: Set source replaces, by reference
  GIVEN `const target = { s: { ignored: true } }` and
  `const source = { s: new Set<number>([1, 2, 3]) }`
  WHEN `const result = deepMerge(target, source) as { s: unknown }`
  THEN `result.s instanceof Set === true`, `result.s === source.s`, and
  `(result.s as Set<number>).has(2) === true`.

- Scenario: RegExp source replaces, by reference
  GIVEN `const target = { r: { ignored: true } }` and
  `const source = { r: /foo/i }`
  WHEN `const result = deepMerge(target, source) as { r: unknown }`
  THEN `result.r instanceof RegExp === true`, `result.r === source.r`, and
  `(result.r as RegExp).test("FOO") === true` (the `i` flag survived — proves the regex
  was not re-constructed as `/(?:)/`).

- Scenario: class instance source replaces, by reference (positive guard)
  GIVEN `class Box { constructor(public n: number) {} }`, `const b = new Box(7)`,
  `const target = { box: { ignored: true } }`, and `const source = { box: b }`
  WHEN `const result = deepMerge(target, source) as { box: unknown }`
  THEN `result.box === b` (reference equality), `result.box instanceof Box === true`, and
  `(result.box as Box).n === 7`. This proves the predicate guards on prototype chain, not
  just on a fixed list of built-in tags.

- Scenario: target itself is a non-plain object — source returned verbatim (no spread)
  GIVEN `const target = new Date("2024-01-01T00:00:00Z")` and
  `const source = { merged: true }`
  WHEN `const result = deepMerge(target, source)`
  THEN `result === source` (the plain-object source is returned by reference; the
  function does NOT attempt to spread the `Date` target into `{}` and lose its identity).
  This mirrors the existing "non-object target → return source" semantics and extends
  them to non-plain object targets.

- Scenario: `null`-prototype dict is treated as a plain object and recurses
  GIVEN `const target = Object.create(null) as Record<string, unknown>; target.a = 1` and
  `const source = Object.create(null) as Record<string, unknown>; source.b = 2`
  WHEN `const result = deepMerge(target, source) as Record<string, unknown>`
  THEN `result.a === 1` AND `result.b === 2` — the predicate accepts a null prototype as
  "plain" so `Object.create(null)`-backed dictionaries still merge, matching `deepMerge`'s
  current intent.

### B18-R2: `deepMerge` still recurses into plain object literals (no regression to B12)

When **both** `target` and `source` are plain objects (prototype `Object.prototype` or
`null`), `deepMerge` MUST continue to recurse key-by-key as it does today: keys present
only in `target` are preserved, keys present only in `source` are added, keys in both
recurse via `deepMerge`, and arrays/primitives at a key replace (per
[src/utils/merge.ts](../../src/utils/merge.ts) existing semantics). This is the
regression guard for B12's in-step layered model — the matcher / key-map / key-based /
schema-based branches in [src/world.ts](../../src/world.ts) all rely on `deepMerge`'s
plain-object recursion to merge user overrides on top of generated objects (see
[wiki/specs/B12-nested-override-skips-matcher.md](B12-nested-override-skips-matcher.md)
B12-R1, B12-R5).

- Scenario: plain-object recursion preserves sibling keys
  GIVEN `const target = { a: { b: 1 } }` and `const source = { a: { c: 2 } }`
  WHEN `const result = deepMerge(target, source) as { a: { b: number; c: number } }`
  THEN `result` deep-equals `{ a: { b: 1, c: 2 } }` — `b` was preserved from `target`,
  `c` was added from `source`.

- Scenario: plain-object recursion overrides on conflicting keys
  GIVEN `const target = { a: { b: 1, c: 1 } }` and `const source = { a: { c: 2 } }`
  WHEN `const result = deepMerge(target, source) as { a: { b: number; c: number } }`
  THEN `result.a.b === 1` (preserved) AND `result.a.c === 2` (source wins on conflict).

- Scenario: array at a key replaces wholesale (today's semantics preserved)
  GIVEN `const target = { tags: ["a", "b", "c"] }` and
  `const source = { tags: ["x", "y"] }`
  WHEN `const result = deepMerge(target, source) as { tags: string[] }`
  THEN `result.tags` deep-equals `["x", "y"]` — array replace, no element-wise merge.

- Scenario: primitive at a key replaces (today's semantics preserved)
  GIVEN `const target = { n: 1 }` and `const source = { n: 2 }`
  WHEN `const result = deepMerge(target, source) as { n: number }`
  THEN `result.n === 2`.

### B18-R3: the fix lands in `deepMerge` itself — all call sites inherit it

The fix MUST be implemented inside `deepMerge` in
[src/utils/merge.ts](../../src/utils/merge.ts) and MUST NOT add per-call-site guards in
[src/world.ts](../../src/world.ts). Specifically, the four `deepMerge(branchValue,
fieldOverride)` calls in `generateObjectFields` (lines 829, 838, 881, plus the recursive
`fieldCtx.generate(innerSchema, { overrides: fieldOverride })` path at line 899), the
per-element `deepMerge(item, ov)` in `generateArray` (line 1011), and the final-pass
`deepMerge(result, options.overrides)` in `generateSingleItem` (line 1167) MUST inherit
the fix without source edits at any of those sites. This keeps the single-source-change
property the item card specifies and avoids drift between call sites.

- Scenario: matcher-branch atomic override flows through (B12 matcher path)
  GIVEN a world `createWorld({ seed: 42 }).withSchema(EventSchema, { matchers: { at: () => new Date("2000-01-01T00:00:00Z") } })`
  with `EventSchema = z.object({ id: z.string(), at: z.date() })` and the matcher
  returning a Date sentinel
  WHEN `const e = world.generate(EventSchema, { overrides: { at: new Date("2024-06-15T12:00:00Z") } })`
  is called (the override is a Date — a non-plain object — at a matcher-resolved field)
  THEN `e.at instanceof Date === true` AND `e.at.toISOString() === "2024-06-15T12:00:00.000Z"`
  — the override won via the matcher branch's `deepMerge(matched, fieldOverride)` at
  [src/world.ts](../../src/world.ts) line 829, which now treats the Date as a leaf and
  returns it verbatim instead of reducing it to `{}`. No call-site change was needed in
  `world.ts`.

- Scenario: final-pass atomic override flows through (no matcher)
  GIVEN a world `createWorld({ seed: 42 }).withSchema(EventSchema)` with no matcher for
  `at` (so the field is resolved by the schema-based generator producing some Date),
  WHEN `const e = world.generate(EventSchema, { overrides: { at: new Date("2024-06-15T12:00:00Z") } })`
  is called
  THEN `e.at instanceof Date === true` AND `e.at.toISOString() === "2024-06-15T12:00:00.000Z"`
  — the override survives the final-pass `deepMerge(result, options.overrides)` at
  [src/world.ts](../../src/world.ts) line 1167.

- Scenario: per-element atomic override flows through (array path)
  GIVEN an ad-hoc array schema `Schema = z.array(z.date())` and
  `const overrides = [undefined, new Date("2024-06-15T12:00:00Z"), undefined]`
  WHEN `const r = createWorld({ seed: 1 }).generate(Schema, { overrides })`
  is called (the array path's per-element `deepMerge(item, ov)` runs at index 1)
  THEN `r[1] instanceof Date === true` AND `r[1].toISOString() === "2024-06-15T12:00:00.000Z"`
  — the per-element Date override survives the array branch's merge at
  [src/world.ts](../../src/world.ts) line 1011. (Indices 0 and 2 carry whatever the
  schema-based Date generator produced, unchanged from today.)

### B18-R4: regression test for the exact card repro (D6)

A regression test MUST live in `tests/unit/utils/` (alongside the existing merge tests)
**and** in `tests/unit/core/` (alongside the existing overrides tests) so the bug is
pinned at both the helper boundary and the user-facing `generate` boundary. The
`tests/unit/core/` test MUST reproduce the exact failure shape from the item card. It
MUST register no matcher for the field, use the same field name `at`, the same
`z.string()` + `z.date()` shape, the same `overrides` keys, and assert that the Date
override survives the call — i.e. `result.at instanceof Date === true` and the
`toISOString()` matches the override. If a regression to "atomic override dropped" lands
again, this test MUST be the one that fails.

- Scenario: card repro — `z.date()` field, Date override survives
  GIVEN `const Event = z.object({ id: z.string(), at: z.date() })` and a fresh world
  `createWorld({ seed: 1 }).withSchema(Event)`
  WHEN `const e = world.generate(Event, { overrides: { id: "evt-1", at: new Date("2024-01-01T00:00:00Z") } })`
  is called
  THEN `e.id === "evt-1"` AND `e.at instanceof Date === true` AND
  `e.at.toISOString() === "2024-01-01T00:00:00.000Z"`. Today (pre-B18) this test fails on
  the second assertion (`e.at` is `{}`).

- Scenario: card repro — `z.instanceof(RegExp)` field, `/foo/` override survives
  GIVEN `const Pat = z.object({ rule: z.instanceof(RegExp) })` and a fresh world
  `createWorld({ seed: 1 }).withSchema(Pat)`
  WHEN `const p = world.generate(Pat, { overrides: { rule: /foo/ } })` is called
  THEN `p.rule instanceof RegExp === true` AND `p.rule.test("foobar") === true`.

- Scenario: card repro — `Map` override survives (forward-looking)
  GIVEN `const Container = z.object({ tags: z.instanceof(Map<string, number>) })` and a
  fresh world `createWorld({ seed: 1 }).withSchema(Container)`
  WHEN `const c = world.generate(Container, { overrides: { tags: new Map([["a", 1]]) } })`
  is called
  THEN `c.tags instanceof Map === true` AND `c.tags.get("a") === 1`.

### B18-R5: full test suite stays green

The fix MUST keep the full test suite green: `pnpm test` (and `pnpm test:all` for the
workspaces) MUST exit 0 after the change. No existing test assertion MAY be changed to
accommodate the fix — only new tests for B18-R1/R2/R3/R4 may be added. In particular, the
existing plain-object recursion tests in `tests/unit/utils/` and the existing
`tests/unit/core/overrides.test.ts` cases (top-level scalar override, sibling
preservation under deep merge, array replace) MUST continue to pass unmodified, and the
B12 regression tests for nested-object overrides under the matcher branch MUST also
continue to pass unmodified.

- Scenario: full suite green with no edits to existing assertions
  GIVEN the implementation of B18 on top of the current `main`
  WHEN `pnpm test` is run from the repo root and `pnpm test:all` is run from the repo
  root
  THEN both exit 0; every existing test case in `tests/unit/` and `tests/integration/`
  passes with its current assertions unchanged, and the new B18 regression test(s) added
  under `tests/unit/utils/` and `tests/unit/core/` also pass.

## Out of scope

- **Changes to `deepEqual`** in [src/utils/merge.ts](../../src/utils/merge.ts). The
  helper is separate, is used only by `world.get`'s predicate matching (B6), and its
  current `Object.is`-then-`Object.keys` walk already returns the correct answer for
  atomic objects (`true` only on reference equality, `false` on differing references).
  This spec does not modify it.
- **Element-wise array merge** (merging override `[i]` keys into target `[i]` keys when
  both are objects). Arrays keep replace semantics, consistent with B12's existing scope
  decision (see [wiki/specs/B12-nested-override-skips-matcher.md](B12-nested-override-skips-matcher.md)
  Out of scope). B18 keeps array-element overrides as whole-value replace through
  `deepMerge`; the only B18-specific change inside that path is that an atomic
  per-element override now replaces (correctly) instead of being reduced to `{}`.
- **Cross-realm `deepMerge` correctness.** Per the resolved open question (Context), the
  fix uses the same-realm prototype check `Object.getPrototypeOf(value) === Object.prototype || === null`.
  An iframe-bridged or `vm.runInContext`-derived plain object from a different realm
  would be classified as a non-plain leaf and replace verbatim (which is conservative —
  no data loss, just no recursive merge). This is acceptable for the Node-only library
  and is documented under Context. A future item MAY widen the predicate to
  `Object.prototype.toString.call(value) === '[object Object]'` if a real cross-realm
  consumer surfaces; until then, the simpler check is the chosen scope.
- **Public API or type surface changes.** `deepMerge` is not exported from the public
  API surface (`src/index.ts` re-exports nothing from `src/utils/merge.ts`); its
  signature stays `(target: unknown, source: unknown) => unknown`. No
  `docs/api-reference.md` change is required (D5 only fires on public API changes — see
  Context).
- **Behaviour for `URL`, `Buffer`, typed arrays, `WeakMap`, `WeakSet`, `Promise`,
  `Error`, `ArrayBuffer`, `DataView`, etc.** These are all non-plain objects and the
  predicate in B18-R1 (`Object.getPrototypeOf(value) === Object.prototype || === null`)
  classifies them as leaves — they are returned verbatim by reference, identical to the
  Date/Map/Set/RegExp behaviour. No explicit per-type scenario is mandated; the
  class-instance scenario in B18-R1 is the positive guard that proves the predicate is
  prototype-based and therefore covers all of these. Adding explicit per-type assertions
  is optional and SHOULD be left to the test-writer's judgement.
- **Promotion to `wiki/decisions.md`.** The chosen prototype-check predicate is a local
  choice inside one helper, not a standing constraint future work must obey. It belongs
  in this spec (recorded under Context) per the decisions / rules bar in
  [wiki/decisions.md](../decisions.md), not the decision log.

## Open questions

- **Is the prototype-chain check robust across realms? — Resolved (in spec).** The card
  posed the choice between (a) `Object.getPrototypeOf(value) === Object.prototype || === null`
  (same-realm, simpler, faster) and (b) `Object.prototype.toString.call(value) === '[object Object]'`
  (realm-robust, marginally slower). **Adopted as (a)** for B18 (pinned in B18-R1's
  predicate spec). Rationale: `zod4-mock` is a Node-only ESM library; consumers do not
  bridge iframes or `vm` contexts into `deepMerge`; the simpler check allocates no string
  on the fast path; and the same-realm limit is documented under "Out of scope" so a
  future cross-realm consumer can revisit the predicate without surprise. Recorded, not
  blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
