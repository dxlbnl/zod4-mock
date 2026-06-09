---
id: B134
title: BUG — nested array-field overrides replace elements instead of per-index deep-merge
type: bug
priority: high
flags: [review]
created: 2026-06-09
spec: wiki/specs/B134-nested-array-field-overrides-replace-instead-of-merge.md
---

## Description

User-reported (via `playground.ts`):

> `generate` does not cleanly apply overrides to a **nested array field** inside an object.
> Overriding the array with partial elements drops the generated sibling fields instead of
> merging them.

**Confirmed.** With:

```ts
const schema = z.object({
  name: z.string(),
  nested: z.object({ age: z.number(), name: z.string(), number: z.number() }).array(),
});

world.generate(schema, {
  overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) },
});
```

each `nested` element comes back as `{ "number": N }` — the generated `age` and `name` are
**dropped**. Expected (deep-merge semantics): `{ age, name, number: N }` per element, with
the array length driven by the override.

## Root cause (analysis, not binding)

The field-level override deep-merge (B12 PIPELINE step 0 / the override deep-merge pass)
routes through `deepMerge` ([src/utils/merge.ts:22-32](../../../src/utils/merge.ts#L22)),
which by contract (**B18**) treats **arrays as leaf values** — a source array replaces the
target array verbatim rather than merging element-wise. So the per-index merge that **B53**
brought to _primary-registered_ arrays
(`generate(Person.array(), { overrides: [...] })`) never happens for a nested array **field**
inside an object override. The two override paths are inconsistent: per-index on primary
arrays (B53), wholesale-replace on nested array fields.

## Acceptance (rough — spec-writer to formalize)

- Overriding a nested array field with an array of partial objects MUST deep-merge
  `overrides[i]` onto generated element `i` (preserve un-overridden sibling fields),
  consistent with B53's per-index semantics for primary arrays.
- The override array length / shorter-or-longer-than-generated behavior MUST be pinned
  (parity with B53-R2 is the natural target).
- Regression test required (the playground scenario): nested array element keeps generated
  `age`/`name` when only `number` is overridden.

## Open questions (for spec-writer)

- Does the override array set the resulting array length, or merge positionally onto a
  separately-generated array (and what governs that array's length — schema `.length()`/min-max
  vs override length)? B53-R2 is the reference.
- Should this generalize to arbitrarily-deep nested arrays, or only one level?
- Interaction with B18's "arrays are leaves in `deepMerge`" contract — this fix must NOT
  change `deepMerge` itself (B18 is a standing decision); the per-index array-override merge
  belongs in the override application path, not in `deepMerge`. Confirm.

## Notes

- Related: **B53** (per-index overrides on primary arrays — the consistent target behavior),
  **B38** (primary-array overrides history), **B18** (deepMerge treats arrays as leaves —
  must not be changed), **B12** (PIPELINE step 0 eager overrides), **B52**/**D14** (array-arm
  unification).
- GitHub issue: none — reported conversationally via the playground.
- `flags: [review]` — touches the override contract; spec sign-off before tests/impl.
- Repro lives in `playground.ts` (label "failing overrides").
- Bump: likely **patch** (correctness fix, no API surface change) — spec-writer to confirm.
