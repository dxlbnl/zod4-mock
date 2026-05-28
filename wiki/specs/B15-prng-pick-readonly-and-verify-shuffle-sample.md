# B15: `prng.pick` accepts `readonly T[]`; pin `shuffle`/`sample` on the shared `Prng` interface

## Context

Two related items on the `Prng` surface. The `Prng` interface is the **shared** public type
that callers reach via `ctx.prng` in matchers and via the public `Prng` re-export from the
root package. It is defined in `@zod4-mock/locale-core`
([packages/locale-core/src/types.ts](../../packages/locale-core/src/types.ts)) and
re-exported from the root package via [src/types.ts](../../src/types.ts) (an `export type`
line); the implementation lives in [src/prng.ts](../../src/prng.ts) (`createPrng`). Item
card: [wiki/backlog/doing/B15-prng-pick-readonly-and-verify-shuffle-sample.md](../backlog/doing/B15-prng-pick-readonly-and-verify-shuffle-sample.md);
GitHub issue #15.

### Current state of the code (read at spec time)

**A — `pick` is strict-tuple-only.** The interface today
([packages/locale-core/src/types.ts](../../packages/locale-core/src/types.ts) lines 8–17):

```ts
export interface Prng {
  readonly seed: number;
  random(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly [T, ...T[]]): T;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  fork(key: string): Prng;
  bytes(n: number): Uint8Array;
}
```

Plain `readonly T[]` arrays (e.g. `Object.keys(...)`, a domain-config typed `string[]`)
require a cast at the call site. The repo itself shows the friction —
`src/generators/data/string.ts`, `key-map.ts`, `finance.ts`, `vehicle.ts`, and
`playground/src/lib/schema-builder.ts` all contain `as [string, ...string[]]` casts.

**B — `shuffle` and `sample` already exist on the shared interface AND in the built
artifact.** Both methods are present in
[packages/locale-core/src/types.ts](../../packages/locale-core/src/types.ts) (lines 13–14)
**and** in the committed
[packages/locale-core/dist/index.d.ts](../../packages/locale-core/dist/index.d.ts) (lines
12–13). The implementation in [src/prng.ts](../../src/prng.ts) (lines 92–107) supplies
both with the signatures the interface declares, and `tests/unit/core/prng.test.ts`
already exercises them at runtime. So the **source/dist mismatch the issue suspected does
not exist on disk today**: the GitHub-reported `@zod4-mock/locale-core@0.2.0` on the npm
registry is the stale published artifact, not the working tree.
`packages/locale-core/package.json` is at version `0.2.0`, so a fresh release of
`@zod4-mock/locale-core` will ship the methods the registry is missing — no source
changes to the interface are required for B15-R2. What B15-R2 *does* add is a
**type-level assignability pin** so a future refactor cannot silently drop the methods
from the shared interface without a test breaking.

**C — locale packages lack `prepublishOnly`.** The root `package.json` has
`"prepublishOnly": "pnpm build"` (added after the zod4-mock 0.6.0/0.6.1 stale-dist
incident), but none of `packages/locale-core/package.json`,
`packages/locale-en/package.json`, `packages/locale-nl/package.json`, or
`packages/locale-names/package.json` have one. The same recurrence is possible until
each gains the guard. This is a **config edit with no user-observable runtime
behaviour**, so it lives under **Additional deliverables** (verified by the reviewer
reading the manifests), not in `## Requirements`.

**D — `Prng` re-export in `src/types.ts` has no provenance hint.** Lines 8–16 export the
`Prng` type from `@zod4-mock/locale-core` (and the `GeneratorContext.prng` field uses
it), but a consumer reading `MatcherCtx`/`GeneratorContext` to find the interface for
`ctx.prng` has no breadcrumb pointing at the owning package. A doc comment fixes this.
**A source-comment substring is not a behaviour test**, so it also lives under
**Additional deliverables**, not in `## Requirements`.

### Binding architecture rules that apply

- **D1**: no `any`; relative imports use `.js` (no internal imports affected here).
- **D5**: extending the `Prng` interface is a public-API change, so
  `docs/api-reference.md` MUST be updated in the same step. The update is itself a
  documentation-content edit (no user-observable runtime behaviour), so it is recorded
  under **Additional deliverables**.
- **D6**: not a bug fix; no mandatory regression test.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B15-R1: `Prng.pick` accepts a plain `readonly T[]`

The `Prng` interface in `@zod4-mock/locale-core` MUST declare a second `pick` overload
that accepts a plain `readonly T[]` and returns `T | undefined`, leaving the existing
non-empty-tuple overload returning `T` unchanged so callers with a `readonly [T, ...T[]]`
keep the strict-non-undefined return type. The runtime implementation of `pick` in
[src/prng.ts](../../src/prng.ts) MUST satisfy both overloads: for an empty array it
returns `undefined`; for any non-empty array it returns one of its elements selected by
the PRNG. The final signatures MUST be exactly:

```ts
pick<T>(items: readonly [T, ...T[]]): T;       // existing — non-empty tuple, guaranteed T
pick<T>(items: readonly T[]): T | undefined;   // new — plain arrays / empty
```

- Scenario: typed call from a plain `string[]` does not require a cast
  GIVEN a `Prng` instance `p` and a `const kinds: string[] = Object.keys({ a: 1, b: 2, c: 3 })`
  WHEN the code `const k: string | undefined = p.pick(kinds)` is type-checked under the
  repo's `tsconfig.json` (with `strict`, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`)
  THEN `tsc --noEmit` reports no error and the inferred return type of `p.pick(kinds)`
  is `string | undefined`.

- Scenario: typed call from a non-empty tuple keeps the non-undefined return
  GIVEN a `Prng` instance `p` and `const items = ["a", "b", "c"] as const` (typed
  `readonly ["a", "b", "c"]`)
  WHEN `const v = p.pick(items)` is type-checked
  THEN the inferred type of `v` is `"a" | "b" | "c"` (the union of tuple elements), with
  no `undefined` in the type — i.e. the existing strict-tuple overload still resolves
  first for non-empty literal tuples.

- Scenario: empty array returns `undefined` at runtime
  GIVEN `const p = createPrng(42)` and `const items: readonly string[] = []`
  WHEN `p.pick(items)` is called
  THEN the return value is `undefined` (the function MUST NOT throw and MUST NOT return
  any other value).

- Scenario: non-empty plain array returns one of its elements
  GIVEN `const p = createPrng(7)` and `const items: readonly number[] = [10, 20, 30]`
  WHEN `p.pick(items)` is called 50 times on independently re-seeded PRNGs
  THEN every return value is one of `10`, `20`, `30` (and is never `undefined`).

- Scenario: deterministic for the same seed under the new overload
  GIVEN `const items: readonly string[] = ["x", "y", "z"]` and two PRNGs
  `a = createPrng(123)` / `b = createPrng(123)`
  WHEN `a.pick(items)` and `b.pick(items)` are each called once
  THEN the two returned values are strictly equal (`===`) — adding the overload
  preserves the existing deterministic contract.

### B15-R2: `shuffle` and `sample` are pinned on the shared `Prng` interface (type-level invariant)

The `Prng` interface in `@zod4-mock/locale-core` MUST continue to declare both
`shuffle<T>(items: readonly T[]): T[]` and
`sample<T>(items: readonly T[], count: number): T[]` as part of the public, shared
interface. Existing runtime tests in
[tests/unit/core/prng.test.ts](../../tests/unit/core/prng.test.ts) already cover the
behaviour of both methods; this requirement adds a **type-level assignability pin** so
that any future refactor which drops, renames, or weakens either signature on the
exported `Prng` type causes a typecheck failure. The runtime contract is unchanged:
Fisher-Yates `shuffle` returns a non-mutating permutation; `sample` is
`shuffle(items).slice(0, n)` with `n = max(0, min(count, items.length))`.

- Scenario: type-level assignability pin for `shuffle` and `sample` on `Prng`
  GIVEN a TypeScript file in `tests/unit/core/` that imports the exported `Prng` type
  from the root package (or from `@zod4-mock/locale-core`)
  WHEN the file declares a type-level assertion equivalent to
  ```ts
  type _PinShuffle = <T>(items: readonly T[]) => T[];
  type _PinSample = <T>(items: readonly T[], count: number) => T[];
  const _shuffle: _PinShuffle = (null as unknown as Prng).shuffle;
  const _sample: _PinSample = (null as unknown as Prng).sample;
  ```
  (or any equivalent assignability check that requires `Prng["shuffle"]` and
  `Prng["sample"]` to match the pinned signatures)
  THEN `pnpm typecheck` succeeds with both methods present on `Prng`, **and** removing
  `shuffle` or `sample` from the `Prng` interface — or weakening either signature —
  causes `pnpm typecheck` to fail at the pin (manually verified by the test-writer
  when the assertion is authored; the existence of the failing typecheck on a stripped
  interface is the test).

- Scenario: `Prng` runtime instance satisfies the pinned interface
  GIVEN `const p = createPrng(42)` from [src/prng.ts](../../src/prng.ts)
  WHEN `p` is assigned to a variable annotated `: Prng` and `p.shuffle([1, 2, 3])` and
  `p.sample([1, 2, 3], 2)` are invoked
  THEN the assignment type-checks (the concrete implementation still satisfies the
  pinned interface), `p.shuffle([1, 2, 3])` returns a `number[]` of length 3, and
  `p.sample([1, 2, 3], 2)` returns a `number[]` of length 2. (Behavioural depth —
  determinism, non-mutation, clamping — remains covered by existing tests in
  `tests/unit/core/prng.test.ts`; this scenario only pins that the typed `Prng`
  surface exposes both methods at runtime.)

### B15-R3: full repo test suite and typecheck stay green

`pnpm test:all` and `pnpm typecheck` MUST pass at the repo root with the B15 changes
applied and no existing test assertions modified. New tests for B15-R1/R2 MAY be added
under `tests/unit/core/prng.test.ts` (the existing PRNG test file) or alongside it
without altering the existing cases. This requirement is the no-regression contract; it
is verified by running the full workspace suite, not by a new dedicated test.

- Scenario: full suite green
  GIVEN the B15 implementation merged into the working tree
  WHEN `pnpm typecheck` and `pnpm test:all` are run sequentially from the repo root
  THEN both commands exit with status 0; no existing test in `tests/unit/`,
  `tests/integration/`, or any `packages/*` workspace test suite is modified to
  accommodate the change.

## Additional deliverables (verified by reviewer, no failing test)

The implementer MUST also make these changes; they are not test-driven because they are
config / source-comment / documentation-content edits with no user-observable runtime
behaviour:

- **Build-guard for locale packages.** Add `"prepublishOnly": "pnpm build"` (or
  equivalent — e.g. `"pnpm run build"`) to each `packages/locale-*/package.json` that
  lacks it (`packages/locale-core`, `packages/locale-en`, `packages/locale-nl`,
  `packages/locale-names` — confirmed none currently have it; see Context → current
  state, point C). Closes the same stale-dist risk that hit `zod4-mock@0.6.0`; the root
  already has it.
- **Doc comment for `Prng` location.** Add a brief comment in
  [src/types.ts](../../src/types.ts) near the `Prng` re-export (or on the
  `GeneratorContext.prng` field) noting that the `Prng` interface is defined in
  `@zod4-mock/locale-core`, so consumers writing `ctx.prng` types know where the
  interface lives. Wording is implementer's choice; the comment MUST mention
  `@zod4-mock/locale-core` by name.
- **`docs/api-reference.md` reflects the new `pick` overload (D5).** The `Prng`
  interface block in `docs/api-reference.md` shows **both** `pick` overloads, and the
  `.pick(items)` sub-section describes the `T | undefined` return for plain
  arrays / empty inputs and the `T` return for non-empty tuples. Required by the D5
  rule (public API change → docs updated in the same step), not by a behaviour test.

The reviewer verifies all three by reading the files; no test asserts them.

## Out of scope

- A separate `pickOrThrow<T>(items: readonly T[]): T` companion. The card calls it out
  as a possible cleaner shape for the "I know it's non-empty" case but recommends the
  overload-only minimum. `pickOrThrow` is a future item, not part of B15.
- Actually publishing `@zod4-mock/locale-core` (and any dependent locale packages) to
  npm. B15 lands the source + build-guard changes; the **user** runs the release
  (`pnpm release`, `changeset publish`) on their own cadence. The spec only requires
  the working tree to be publish-ready.
- Migrating existing in-repo `as [string, ...string[]]` casts to use the new plain-array
  overload. Those casts continue to type-check under the new overload; cleaning them up
  is a follow-up `chore`, not a B15 requirement.
- Changes to the runtime behaviour of `shuffle` or `sample`. B15-R2 pins the existing
  type-level contract; it does not modify Fisher-Yates or the clamp formula.
- Changes to `Prng.int` / `Prng.bytes` / `Prng.fork` / `Prng.random` signatures.

## Open questions

- **Overload vs companion `pickOrThrow` — Non-blocking.** Adopt the overload (B15-R1);
  record `pickOrThrow` as a possible future companion (see Out of scope). The card
  recommends this; nothing about it would change the shape of B15-R1.
- **Empty-array contract for `pick(readonly T[])` — Non-blocking.** Returns
  `T | undefined` (per issue #15's recommendation and the natural type the overload
  produces). Documented in B15-R1's "empty array returns `undefined` at runtime"
  scenario.
- **`shuffle`/`sample` source-vs-dist diagnosis — Non-blocking, resolved by reading
  code.** Both methods are present in source AND in the committed
  `packages/locale-core/dist/` (see Context → current state). The user-visible gap is
  purely on the npm registry's `@zod4-mock/locale-core@0.2.0`; B15 pins the interface at
  the type level (B15-R2) so it cannot regress, and the `prepublishOnly` guard
  (Additional deliverables) ensures the next release ships the current source. No
  source promotion from a wrapper is needed.
- **`prepublishOnly` exact form across the four locale packages — Non-blocking.**
  `"pnpm build"` or `"pnpm run build"`; both invoke the package's own `tsup` build. The
  implementer picks one and applies it consistently across all four packages.
