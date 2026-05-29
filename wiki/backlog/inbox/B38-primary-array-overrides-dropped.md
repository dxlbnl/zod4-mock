---
id: B38
title: BUG — `world.generate(primaryArraySchema, { overrides })` silently drops per-index overrides
type: bug
priority: medium
flags: [review]
created: 2026-05-29
---

## Description

GitHub issue [#22](https://github.com/dxlbnl/zod4-mock/issues/22). User-classified
**Mid** severity — silent failure, plausible-looking return value, surfaces
downstream when an unrelated test fails for the wrong reason.

`world.generate(schema.array().min(N).max(N), { overrides: [...] })` on a
**primary-registered** inner schema silently ignores the per-index overrides.
The natural "give me N records with these per-record overrides" pattern at
the top of a `setupX` becomes "give me whatever the registry already has".

### Repro (from #22)

```ts
const ProductSchema = z.object({
  id: z.uuid(),
  category: z.enum(['alpha', 'bravo', 'charlie']),
  name: z.string(),
});

const world = createWorld({ seed: 1 });
world.withSchema(ProductSchema);

for (const category of ['alpha', 'bravo', 'charlie'] as const) {
  world.generate(ProductSchema.array().min(4).max(4), {
    overrides: Array.from({ length: 4 }, () => ({ category })),
  });
}

world.registry.count(ProductSchema);
// expected: 12 (4 of each category)
// actual:   4

world.registry.all(ProductSchema).map((p) => p.category);
// expected: ['alpha', 'alpha', 'alpha', 'alpha', 'bravo', …]
// actual:   ['bravo', 'alpha', 'charlie', 'alpha']   ← overrides never applied
```

### Root cause (from #22 — verified during /intake)

`generateArray`'s primary branch
([src/world.ts:917-1024](../../src/world.ts#L917), the
`primaryRegs.length > 0` arm):

```js
if (primaryRegs.length > 0) {
  const reg = primaryRegs[0];
  const existingCount = this.registry.count(innerSchema);
  const target = Math.max(existingCount, genPrng.int(...));
  while (this.registry.count(innerSchema) < target) {
    this.generateAndStorePrimary(innerSchema, reg);
    //   ↑ no options, no overrides, no per-position info
  }
  return this.registry.all(innerSchema);
}
```

Two compounded effects:

1. **Per-index overrides aren't passed through** —
   `generateAndStorePrimary(innerSchema, reg)` is called with no `options`, so
   `options.overrides[i]` never reaches the field generator. No equivalent of
   the ad-hoc array path's `result.map((item, i) => deepMerge(item, overrides[i]))`.
2. **`existingCount` short-circuits the top-up loop** —
   `target = max(existingCount, …)` means a second call with
   `existingCount >= target` does nothing observable (no records added, and
   no overrides applied to existing records either).

The ad-hoc branch (no primary registration) handles both correctly.

### Proposed directions (from #22)

- **A** — apply per-index overrides on the records this call generates
  (overrides at positions `0..(target - existingCount - 1)`). Doesn't help
  for pre-existing records, but at least overrides aren't silently dropped.
- **B** — A + also deep-merge `overrides[i]` onto `registry.all()[i]` in the
  return value (without mutating the registry). Returned array reflects
  caller intent; registry stays as-is.
- **C** — loudly throw when `overrides.length > target - existingCount`,
  pointing the caller at `world.populate(schema, count, factory)`. Makes the
  bug impossible to introduce.
- **D** — document the limitation; recommend `world.populate(schema, count, factory)`
  (already exists since 0.7.0 / B14) and explicitly state per-index
  overrides are an ad-hoc-array feature.

Recommend **C** in spec-writer's consideration: silent dropping is the
worst-case outcome; `world.populate` already does what the caller wants;
making the bad call site loud guides users to the right API without
silently surprising them. Combine with D (docs note in
`docs/api-reference.md` under `GenerateOptions.overrides`). spec-writer to
weigh A/B (silent fix that "kinda works") vs C/D (explicit error + redirect)
with the user.

Flagged `review` — design choice, regression risk on primary-array users.

## Notes

- GitHub issue: [#22](https://github.com/dxlbnl/zod4-mock/issues/22).
- Workaround: `world.populate(schema, count, factory)` — already in 0.7.0
  ([B14](../../specs/B14-world-populate-factory.md)). Recommended in #22's
  body.
- Related: B14 (`world.populate` factory — the right API for this use case);
  the related B22 complexity-research card flagged
  `generateArray` ([src/world.ts:917-1024](../../src/world.ts#L917)) as
  Dim 3 hot spot #3 and proposed B25 / B28's decomposition will improve the
  fix's home; this bug should land **before** B25 / B28 so the regression
  test isn't disturbed mid-decomposition.
- Regression test required (D6).
- Changeset required (patch).
