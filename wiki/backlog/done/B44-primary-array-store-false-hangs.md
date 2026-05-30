---
id: B44
title: BUG — `world.generate(primaryArraySchema, { store: false })` hangs forever (infinite loop)
type: bug
priority: high
flags: [review]
created: 2026-05-30
spec: wiki/specs/B44-primary-array-store-false-hangs.md
---

## Description

GitHub issue [#26](https://github.com/dxlbnl/zod4-mock/issues/26). User-classified
**high severity** — a hang is worse than a wrong value: the test process / CI worker
freezes with no stack, no failing assertion, and no hint at the offending call. The
trigger is invisible at the call site (the type is a correct `T[]`); diagnosis
requires bisecting collection-time `generate` calls by hand.

`world.generate(schema.array(), { store: false })` never returns when:

1. `schema` is registered as a **primary** (via `world.withSchema(schema, { matchers })`), AND
2. the registry holds **fewer records than the rolled target length** at call time.

### Root cause (from #26)

`generateArray` primary branch in `src/world.ts` (0.8.0):

```ts
case "primary": {
  const existingCount = this.registry.count(innerSchema);
  const target = Math.max(
    existingCount,
    genPrng.int(Math.min(minRequired, maxAllowed), Math.max(minRequired, maxAllowed)),
  );
  while (this.registry.count(innerSchema) < target) {   // ← never advances under store:false
    this.generateAndStorePrimary(innerSchema, mode.reg);
  }
  return this.registry.all(innerSchema);
}
```

`generateAndStorePrimary` gates the registry write on `this.effectiveStore`
(B10-R2/R4). Under `store: false`, the outer call sets `effectiveStore = false`,
which propagates: the record is generated but never stored, so
`this.registry.count(innerSchema)` stays at `existingCount` for every iteration.
Whenever the rolled `target` exceeds `existingCount`, `while (count < target)`
can never terminate.

The loop conflates two responsibilities — "how many have I produced for this
response" and "how many are in the registry" — and they only stay in sync while
storing is enabled.

### Repro (from #26)

```ts
const schema = z.object({ id: z.string(), name: z.string() });
const world = createWorld({ seed: 1 });
world.withSchema(schema, { matchers: { name: () => "x" } });

world.generate(schema, { store: false });                  // ✅ returns
world.generate(schema.array());                            // ✅ returns
world.generate(schema.array(), { store: false });          // ❌ HANGS
```

All three conditions are required (per #26's matrix):

| registration                         | call                                            | result    |
|--------------------------------------|-------------------------------------------------|-----------|
| unregistered (ad-hoc)                | `generate(schema.array(), { store:false })`     | ✅ returns |
| `withSchema(schema, {})` no matcher  | `generate(schema.array(), { store:false })`     | ✅ returns |
| `withSchema(schema, { matchers })`   | `generate(schema, { store:false })` (single)    | ✅ returns |
| `withSchema(schema, { matchers })`   | `generate(schema.array())` (store:true)         | ✅ returns |
| `withSchema(schema, { matchers })`   | `generate(schema.array(), { store:false })`     | ❌ **hangs** |

### Proposed fix (from #26)

Decouple the loop's progress counter from the registry so it doesn't depend on
the store side-effect. Under `store: false` the caller wants ephemeral records, so
produce `target` fresh records directly instead of reading them back from a
registry that was never written:

```ts
case "primary": {
  // …
  const target = Math.max(existingCount, genPrng.int(/* … */));

  if (!this.effectiveStore) {
    // store opted out: generate the rolled count directly; don't gate on
    // registry.count (which can never advance without a write).
    return Array.from({ length: target }, () =>
      this.generateAndStorePrimary(innerSchema, mode.reg),
    );
  }

  while (this.registry.count(innerSchema) < target) {
    this.generateAndStorePrimary(innerSchema, mode.reg);
  }
  return this.registry.all(innerSchema);
}
```

A minimal alternative is to bound the loop by a local counter rather than
`registry.count`, but the branch above keeps the store-on path byte-for-byte
identical and makes the `store:false` semantics explicit (return freshly
generated records, touch nothing).

### Severity

High. Hang > wrong value. Any spec or Storybook story that does
`generate(primarySchema.array())` through an ephemeral (`store: false`) wrapper
is exposed. Workaround today: use registry-backed getters (`store: true`) instead
of ephemeral arrays.

## Notes

- GitHub issue: [#26](https://github.com/dxlbnl/zod4-mock/issues/26).
- **Adjacent to [B43](B43-primary-array-min-max-ignored.md)** (currently in flight) —
  same primary branch of `generateArray`; both stem from "the primary branch treats
  the registry as the single source of truth for the response." B43 throws on
  `.min/.max/.length`; B44 fixes the `store: false` hang under default (auto-roll)
  bounds. Coordination: the manager should consider folding into B43's spec OR
  landing immediately after B43 — both touch the same arm.
- **Sibling of [B38](../done/B38-primary-array-overrides-dropped.md)** — also a
  primary-branch silent-bug-fix, same arm.
- **Related to [B20](../done/B20-store-false-empty-from-crash.md)** (0.7.2, closes
  #21) — same `store: false` surface, different mode (derived empty-source vs
  primary-array hang).
- **Composition with B43**: post-B43 the throw on `.min/.max/.length` fires before
  this hang would manifest (B43 covers caller-side bounds; B44 covers the default
  auto-roll loop under `store: false`). They are orthogonal: B43's scope is
  caller-side modifiers; B44's scope is the loop's correctness when `effectiveStore`
  is false.
- Regression test required (D6). Test must assert the call **returns** within a
  reasonable timeout (vitest `test.timeout` or similar) and that the returned
  array has the correct length AND the registry was not mutated (B10 transitive
  suppression preserved).
- Changeset: `patch` (silent-hang → returns ephemeral records; pure bug fix, no
  contract change; users who relied on the hang…aren't users).
- Flagged `review` — interacts with B43 (in flight); manager should checkpoint
  with user on ordering before dispatching spec-writer.
