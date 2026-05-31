---
id: B15
title: `prng.pick` should accept `readonly T[]`; verify `shuffle`/`sample` shipped on the published `Prng` interface
type: feature
priority: medium
flags: [review]
created: 2026-05-28
spec: wiki/specs/B15-prng-pick-readonly-and-verify-shuffle-sample.md
---

## Description

Two related items on the `Prng` surface (defined in `@zod4-mock/locale-core`). (GitHub
issue #15.)

### A. `prng.pick` is too strict for plain arrays

Current signature:

```ts
pick<T>(items: readonly [T, ...T[]]): T;
```

Any caller picking from a plain `T[]` (e.g. `Object.keys(...)`,
`Object.values(SomeEnum)`, a domain-config typed as `string[]`) has to cast:

```ts
const KINDS = Object.keys(KIND_MAP); // string[]
ctx.prng.pick(KINDS as [string, ...string[]]); // forced cast
```

Constant friction in domain matchers and undermines the otherwise-nice typing.

### B. `shuffle`/`sample` may be missing from the published `Prng` interface

The commit `e48070d Add prng.shuffle() and prng.sample() (closes #1)` lands them in
source, and B5 (`related.many`) reuses `prng.sample`. The issue reports the published
`@zod4-mock/locale-core@0.2.0` interface lacks them — same class of "stale dist
published" problem that bit zod4-mock 0.6.0. Possible causes:

- they live on the world's wrapped `prng` and aren't exposed via the shared `Prng`
  interface, or
- the `locale-core` bump adding them wasn't published, or
- the published artifact was built from a stale `dist/` (now guarded against by the
  root's `prepublishOnly`, but `packages/locale-*` may not have the same guard yet).

## Proposal

**A — pick overload** (accept plain `readonly T[]` and return `T | undefined`):

```ts
pick<T>(items: readonly [T, ...T[]]): T;            // current — non-empty tuple, guaranteed T
pick<T>(items: readonly T[]): T | undefined;        // new — handles plain arrays / empty
```

Or add a companion that throws on empty for the "I know it's non-empty" case:

```ts
pickOrThrow<T>(items: readonly T[]): T;
```

Either kills the cast in ~all real call sites without losing the strict-tuple guarantee.

**B — verify and ship**:

- Confirm `shuffle`/`sample` are declared on the `Prng` interface in
  `packages/locale-core/src/...`.
- Confirm they are present in the **built** `packages/locale-core/dist/`.
- If they're only on the world-wrapped Prng (and not the shared interface), promote
  them to the shared interface so the type matches the runtime.
- Once verified, publish a fresh `@zod4-mock/locale-core` if the published version is
  missing them. Add `prepublishOnly: "pnpm build"` to each locale package's
  `package.json` to prevent the recurrence (same root-cause as the zod4-mock 0.6.0/0.6.1
  fix).

## Bonus from the issue (low-cost)

The `Prng` interface is owned by `@zod4-mock/locale-core`, which is invisible to
consumers writing matcher `ctx.prng` types. Add a brief mention in `src/types.ts`
("`Prng` is defined in `@zod4-mock/locale-core`") to save the hunt.

## Open questions (resolve in spec)

- **Overload vs. companion**: `pick(readonly T[])` returning `T | undefined` vs. a
  separate `pickOrThrow`. The overload is the user-suggested minimum; the companion is
  cleaner for the "known-non-empty" case. Adopt overload + leave `pickOrThrow` for a
  future item.
- **Should the published locale packages also gain `prepublishOnly`?** Yes — same
  root-cause as 0.6.0. Fold the fix in.

## Notes

- Touches `packages/locale-core` (`Prng` interface) and possibly its consumers in
  `src/`. Public API change (extends `Prng`) → update `docs/api-reference.md`.
- Likely needs a coordinated release of `@zod4-mock/locale-core` + root.
