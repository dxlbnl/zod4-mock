---
id: B43
title: BUG — `world.generate(primaryArraySchema.min(N).max(M))` silently ignores `.min()` / `.max()` modifiers
type: bug
priority: high
flags: []
created: 2026-05-29
---

## Resolution

Fix shipped as **direction A (honour the bounds by slicing)**. When the caller writes
`.min/.max/.length` on the array schema, the returned array length is capped to the
caller's specified maximum via `Array.prototype.slice(0, callerMax)`. Library-side
`defMax` fallback is NOT used to cap returns — `world.generate(S.array())` against a
10-record registry still returns 10 records as before.

The earlier "direction B" attempt (throw + redirect to `world.populate(schema, N)`) was
reverted after the user pointed out that `.min().max()` and `populate()` should both
produce valid fixtures — refusing the call shape was overcomplicated and contradicted
the user's natural mental model.

## Description

GitHub issue [#25](https://github.com/dxlbnl/zod4-mock/issues/25).
User-classified **Mid** severity — silent: type system can't catch it
(return is correctly-typed array, just longer than expected).

Sibling of B38 (closed in commit 8703c0a, closes #22). Both originate in
the same primary branch of `WorldImpl.generateArray`:

- **B38** — `{ overrides: [...] }` option silently dropped on primary arrays.
- **B43** — `.min()` / `.max()` schema modifiers silently dropped on primary arrays.

`.min()` / `.max()` are read internally to compute the auto-provision
*target* (how many records to top the registry up to), but the return
value is unconditionally `registry.all(innerSchema)` — the entire registry,
regardless of the caller's bounds.

### Repro (from #25)

```ts
const ProductSchema = z.object({ id: z.uuid(), name: z.string() });

const world = createWorld({ seed: 1 });
world.withSchema(ProductSchema);

world.populate(ProductSchema, 6);

const pair = world.generate(ProductSchema.array().min(2).max(2));
console.log(pair.length);
// expected: 2
// actual:   6 (full registry returned; .min/.max ignored)

const ten = world.generate(ProductSchema.array().min(10).max(10));
console.log(ten.length);
// expected: 10
// actual:   10 — but only because the loop topped the registry up to 10

console.log(world.generate(ProductSchema.array().min(2).max(2)).length);
// expected: 2
// actual:   10 (registry now holds 10; the bounds STILL don't slice)
```

### Root cause (from #25)

`generateArray` primary branch in `src/world.ts` (post-B38 throw guard,
which fires only when `{ overrides }` is non-empty — does not catch this
case):

```ts
if (primaryRegs.length > 0) {
  // ... B38 guard for non-empty overrides ...

  const reg = primaryRegs[0]!;
  const existingCount = this.registry.count(innerSchema);
  const minRequired = resolveMinRequired(arraySchema, defMin);
  const maxAllowed = resolveMaxAllowed(arraySchema, defMax);
  const target = Math.max(existingCount, genPrng.int(
    Math.min(minRequired, maxAllowed),
    Math.max(minRequired, maxAllowed),
  ));
  while (this.registry.count(innerSchema) < target) {
    this.generateAndStorePrimary(innerSchema, reg);
  }
  return this.registry.all(innerSchema);   // ← bounds never applied
}
```

`.min`/`.max` wire into `target` (the floor of records to ensure exist),
but the return is unconditionally `registry.all`. The caller's
`.min/.max` is a one-way ratchet that grows the registry but never bounds
the response.

### Proposed fixes (from #25)

- **A** — Apply the same length-roll as the ad-hoc branch, then slice the
  registry to that length. `.slice(0, N)` mirrors the documented workaround.
  Trade-off: WHICH N records (first N? sample N?). Card author suggests
  first-N is acceptable given existing consumer code.
- **B** — Throw on `.min/.max` for primary-registered inner schemas with a
  clear redirect message. Loud, makes the gap explicit, mirrors B38's
  direction-C strategy ("primary-array bounds aren't supported on
  `world.generate`; use `world.populate(schema, N)` or
  `world.generate(schema.array()).slice(0, N)`").
- **C** — Document the silent behaviour in `docs/api-reference.md` +
  type-system hint; ship the `.slice(0, N)` workaround as the
  recommended pattern.

Recommend the spec-writer evaluate A vs B:

- **B aligns with B38's pattern** (just shipped) — symmetric "primary array
  modifiers / overrides → throw, redirect to populate". Internal
  consistency: both modifier paths refuse silent partial application.
- **A is gentler** — silently honours `.min/.max` by slicing. But the
  question of which N to slice (first vs random sample) opens a new
  design surface, and the existing `.slice(0, N)` workaround makes the
  silent path equivalent at the call site.

If A is picked, must decide:
- First N (simpler, matches current `.slice(0, N)` workaround semantics).
- `prng.sample(items, N)` (more random, but breaks the "deterministic
  insertion-order" guarantee #25's author mentions).

If B is picked, the throw message names `world.populate(schema, N)` as
the right API (B14 / B38 convention).

A unified primary-array contract emerges: ".min/.max + overrides MUST NOT
apply silently to primary arrays — caller must pre-populate to the desired
shape and read with explicit slicing, OR use populate." Both B38 and B43
are then specific MUST-NOT enforcements of that contract.

Flagged `review` — design choice A vs B is user-significant.

### Workaround today (from #25)

```ts
// Documented elsewhere in @dgo/mock-data:
const pair = world.generate(schema.array()).slice(0, 2);

// Or, if you need fresh records:
world.populate(schema, 2, (i) => ({ overrides: { ... } }));
```

`.slice(0, N)` works because the registry is consistently insertion-ordered.

## Notes

- GitHub issue: [#25](https://github.com/dxlbnl/zod4-mock/issues/25).
- Sibling: [B38](../done/B38-primary-array-overrides-dropped.md) (just
  shipped, closes #22) — same primary branch, adjacent bug, both silent.
- Related: B14 (`world.populate` factory — the recommended workaround).
- The cleanest outcome may be a **unified contract** (a single spec page)
  that covers both modifier-paths on primary arrays. spec-writer to consider
  whether B43 should retroactively reframe B38's "per-index overrides
  throw" as part of a broader "primary-array modifiers / options aren't
  honoured silently" rule.
- Regression test required (D6).
- Changeset: `patch` if A is chosen (silent → silent-with-correct-length);
  `minor` if B is chosen (silent → throw — matches B38's minor bump).
