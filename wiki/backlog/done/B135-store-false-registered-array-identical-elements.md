---
id: B135
title: BUG — store:false array of a registered schema yields identical elements (per-element index collapses to 0)
type: bug
priority: high
flags: [review]
created: 2026-06-09
spec: wiki/specs/B135-store-false-registered-array-identical-elements.md
---

## Description

User-reported (via `playground.ts`):

> Generating an array of a **registered** schema under `store: false` returns N **identical**
> elements instead of N distinct ones.

**Confirmed.** With `nestedThing` registered and `schema.nested = nestedThing.array()`:

```ts
const nestedThing = z.object({ age: z.number(), name: z.string(), number: z.number() });
const schema = z.object({ name: z.string(), nested: nestedThing.array() });
const world = createWorld().withSchema(nestedThing).withSchema(schema);

world.generate(schema, { defaultArrayLength: [4, 4], store: false,
  overrides: { nested: Array.from({ length: 4 }, (_, number) => ({ number })) } });
```

every `nested` element comes back as the **same** record — `{ age: 46, name: "Grace Johnson", number: i }`
— differing only in the override-injected `number`. The no-override / store-on default path
(`world.generate(schema)`) varies the elements correctly. So the collapse is the **`store: false`**
registered-array path, not the override.

## Root cause (analysis, not binding)

In `generateArrayPrimary`'s **store-off** branch
([src/world/engine.ts:1676-1683](../../../src/world/engine.ts#L1676)) each element is produced
by `generateAndStorePrimary(innerSchema, primaryReg, …)`. That method derives the per-record
seed from `recordIndex = registry.count(schema) + pending`
([src/world/engine.ts:1277-1279](../../../src/world/engine.ts#L1277)), incrementing `pending`
at entry and **decrementing it in `finally`** ([src/world/engine.ts:1307](../../../src/world/engine.ts#L1307)).
The `pending` counter exists for **re-entrant** generation (a record whose generation triggers
another record of the same schema), not for sequential array siblings. Across the synchronous
`Array.from` loop it cycles 0→1→0, 0→1→0, …, and under `store: false` `registry.count` never
advances (the store write is suppressed). So **every** element computes
`recordIndex = count(0) + pending(0) = 0` → identical `recordId` `reg<id>#0` → identical field
seed → identical record.

The store-**on** path (`while (registry.count < target)`,
[src/world/engine.ts:1685-1690](../../../src/world/engine.ts#L1685)) advances `registry.count`
per stored element, so indices are 0,1,2,3 — distinct. That asymmetry is the bug: the store-off
path lost the per-element index.

## Acceptance (rough — spec-writer to formalize)

- Under `store: false`, generating an array of a registered primary schema MUST produce
  per-element-distinct records (distinct `recordIndex` 0..N-1), matching the store-on path's
  determinism — the elements MUST vary exactly as the store-on path's first N records would.
- Determinism MUST be preserved (D4/D10): the i-th store-off element's values MUST equal what
  the store-on path would produce for record index i (same seed derivation), so toggling
  `store` does not change the i-th element's values.
- Regression test required: registered schema + `store: false` array → assert the N elements
  are pairwise distinct (and ideally equal the store-on first-N).

## Open questions (for spec-writer)

- Should the store-off element index be threaded explicitly (pass `i` to
  `generateAndStorePrimary`, e.g. an `index`/`recordIndex` option) so the seed is
  `reg<id>#<i>`, matching the store-on path exactly? That seems the minimal correct fix and
  keeps store-on/store-off determinism identical.
- Does the same collapse affect the **derived** store-off array path, or only primary?
  (`generateArrayDerived` / the derived arm — verify and scope.)
- Interaction with `existingCount` (pre-populated registry) under store:false is moot (store
  write suppressed), but confirm the index base is correct when the registry already holds
  records of `innerSchema` from an earlier store-on call.

## Notes

- **Pre-existing**, independent of B134 (done). B134 (single override-application flow) only
  *exposed* this in the override path: pre-B134 an array override short-circuited at pipeline
  step 0 and never generated the base array, so the identical-base-elements bug was hidden for
  the override case. The collapse reproduces **without** overrides (store:false alone).
- Related: **B44** (`primary-array-store-false-hangs` — added the `Array.from` store-off branch;
  its test covers termination, NOT element distinctness — the gap this bug falls into), **B10**
  (store opt-out semantics), **B39/B130** (schema-identity-based fork keys), **D4/D10**
  (determinism: call order / store toggle MUST NOT change a record's values).
- GitHub issue: none — reported conversationally via the playground.
- `flags: [review]` — determinism contract + seed-derivation change; spec sign-off before
  tests/impl.
- Repro in `playground.ts` (label "failing overrides", `store: false` + registered `nestedThing`).
- Bump: likely **patch** (correctness/determinism fix, no API surface change) — spec-writer to
  confirm.
